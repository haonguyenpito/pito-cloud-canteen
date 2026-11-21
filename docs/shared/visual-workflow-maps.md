# Visual Workflow Maps

Mermaid diagrams for every major workflow in PITO Cloud Canteen, verified against source code.

> **Render tip:** GitHub, VS Code (Mermaid Preview extension), and Obsidian all render these natively.

---

## Contents

1. [System Context — All Actors & Services](#1-system-context--all-actors--services)
2. [Order Lifecycle State Machine](#2-order-lifecycle-state-machine)
3. [Sub-Order (Sharetribe Transaction) State Machine](#3-sub-order-sharetribe-transaction-state-machine)
4. [Sequence: Start Order (Point of No Return)](#4-sequence-start-order-point-of-no-return)
5. [Food Selection Flow — Participant → Sharetribe via BullMQ](#5-food-selection-flow--participant--sharetribe-via-bullmq)
6. [Partner Menu & Food Lifecycle](#6-partner-menu--food-lifecycle)
7. [Quotation & Payment Flow](#7-quotation--payment-flow)
8. [Notification Dispatch Map](#8-notification-dispatch-map)
9. [Auth & SDK Mode Map](#9-auth--sdk-mode-map)
10. [AWS EventBridge Scheduler Map](#10-aws-eventbridge-scheduler-map)
11. [Full Cross-Role Interaction Sequence](#11-full-cross-role-interaction-sequence)

---

## Code-vs-Doc Notes (cross-doc invariants)

| # | Topic | Reality |
|---|-------|---------|
| 1 | SDK modes | 4 mainline modes (`getSdk`, `getTrustedSdk`, `getIntegrationSdk`, `getSubAccountTrustedSdk`) plus `getTrustedSdkWithSubAccountToken` (`src/services/sdk.ts:116`) — used when the user token is already known and a fresh `req` is not available. |
| 2 | Food selection | Participant self-pick (`POST /api/participants/orders/:orderId`) calls `addToProcessOrderQueue` **directly** — no Firebase indirection. There is no `place-order.api.ts`. Admin/booker edits (`PUT /api/orders/:orderId/member-order`) bypass the queue and write straight to Sharetribe. |
| 3 | Transit endpoints | Admin's `transit.api.ts` handles `START_DELIVERY`, `COMPLETE_DELIVERY`, and the 3 `OPERATOR_CANCEL_*` cases. Partner's `transit.api.ts` (`src/pages/api/partner/[partnerId]/orders/[orderId]/transit.api.ts`) handles `PARTNER_CONFIRM_SUB_ORDER` and `PARTNER_REJECT_SUB_ORDER`. `REVIEW_RESTAURANT` / `REVIEW_RESTAURANT_AFTER_EXPIRE_TIME` are fired from `participants/plans/summarize-reviews.service.ts`. |
| 4 | BullMQ workers | Two files exist (`processOrder.job.ts`, `processMemberOrder.job.ts`) both bound to queue `processOrder`. **Only `processOrder.job.ts` has callers** — `processMemberOrder.job.ts` is unused as of the last audit. |
| 5 | Expired transitions | In `process.edn`, **only** `expired-review-time` has an `:at` clause (auto-fires 14 days after `state/completed`). `expired-start-delivery` and `expired-delivery` are operator-triggered despite their names. |
| 6 | `transitionOrderStatus` cadence | Admin `transit.api.ts` calls `transitionOrderStatus` **only after `COMPLETE_DELIVERY`** — not after every transition. |

---

## 1. System Context — All Actors & Services

```mermaid
graph TD
    subgraph Actors
        Admin["Admin (PITO Ops)"]
        Booker["Booker (Company)"]
        Participant["Participant (Employee)"]
        Partner["Partner (Restaurant)"]
    end

    subgraph Portals["Next.js Portals"]
        AP["/admin/*"]
        CP["/company/*"]
        PP["/participant/*"]
        RP["/partner/*"]
    end

    subgraph API["Next.js API Routes"]
        AdminAPI["/api/admin/"]
        OrderAPI["/api/orders/"]
        ParticipantAPI["/api/participants/"]
        PartnerAPI["/api/partner/"]
        WebhookAPI["/api/webhook/onwheel"]
    end

    subgraph External["External Services"]
        ST["Sharetribe Flex\nlistings · users · transactions"]
        FB["Firebase Firestore\nnotifications · payment ledger"]
        Redis["Redis + BullMQ\nfood selection queue"]
        EB["AWS EventBridge\nscheduled automation"]
        Lambda["AWS Lambda\nauto-start · auto-pick · rating reminders"]
        SES["AWS SES\ntransactional email"]
        OS["OneSignal\nmobile/browser push"]
        Slack["Slack Webhooks\nops alerts x5 channels"]
        Onwheel["Onwheel\ndelivery tracking webhook"]
    end

    Admin --> AP --> AdminAPI
    Booker --> CP --> OrderAPI
    Participant --> PP --> ParticipantAPI
    Partner --> RP --> PartnerAPI
    Onwheel --> WebhookAPI

    AdminAPI & OrderAPI & ParticipantAPI & PartnerAPI --> ST
    AdminAPI & OrderAPI & ParticipantAPI --> FB
    ParticipantAPI --> Redis
    OrderAPI --> EB --> Lambda
    AdminAPI & OrderAPI & ParticipantAPI & PartnerAPI --> SES
    AdminAPI & OrderAPI & ParticipantAPI & PartnerAPI --> OS
    AdminAPI & OrderAPI & ParticipantAPI & PartnerAPI --> Slack
```

---

## 2. Order Lifecycle State Machine

`order.metadata.orderState` — defined in `src/utils/types.ts` (`EOrderState`, `EOrderDraftStates`).

```mermaid
stateDiagram-v2
    [*] --> draft : Admin creates order\nsrc/pages/api/orders/create.service.ts
    [*] --> bookerDraft : Booker creates order\nsrc/pages/api/orders/create.service.ts

    draft --> pendingApproval : Admin submits for approval
    bookerDraft --> pendingApproval : Booker submits

    pendingApproval --> picking : Admin approves\npublish-order.service.ts\nfires ORDER_PICKING notifications\ncreates EventBridge schedulers
    pendingApproval --> canceled : Admin rejects

    draft --> canceled : Canceled before approval
    bookerDraft --> canceled : Canceled before approval

    picking --> inProgress : Admin or Lambda calls start-order\nstart-order.api.ts\ninitiates Sharetribe transactions per date\nfires SUB_ORDER_INPROGRESS to partners

    inProgress --> pendingPayment : All sub-orders delivered\ntransition-order-status.service.ts\nat least one payment not yet confirmed

    inProgress --> completed : All sub-orders delivered\nAND both client and partner payments confirmed

    pendingPayment --> completed : Admin confirms client payment\nconfirm-client-payment.api.ts\nAND admin confirms partner payment\nconfirm-partner-payment.api.ts

    canceled --> [*]
    completed --> [*]
```

**Key files:**
- `src/pages/api/orders/create.service.ts` — creation
- `src/pages/api/orders/[orderId]/publish-order.service.ts` — draft → picking
- `src/pages/api/orders/[orderId]/plan/[planId]/start-order.api.ts` — picking → inProgress
- `src/pages/api/admin/plan/transition-order-status.service.ts` — auto-advance on sub-order completion
- `src/pages/api/admin/payment/confirm-client-payment.api.ts` / `confirm-partner-payment.api.ts` — pendingPayment → completed

---

## 3. Sub-Order (Sharetribe Transaction) State Machine

Each delivery date is one Sharetribe transaction. Process alias: `sub-order-transaction-process/release-2`.
State stored in `plan.metadata.orderDetail[timestamp].lastTransition`.

```mermaid
stateDiagram-v2
    [*] --> initiated : initiate-transaction\ncustomer privileged token\nsubAccountTrustedSdk\ninitiate-transaction.service.ts

    initiated --> partner_confirmed : partner-confirm-sub-order\noperator (PITO server) on partner UI action\nsrc/pages/api/partner/[partnerId]/orders/[orderId]/transit.api.ts
    initiated --> partner_rejected : partner-reject-sub-order\nsame file
    initiated --> canceled : operator-cancel-plan\nsrc/pages/api/admin/plan/transit.api.ts
    initiated --> failed_delivery : expired-start-delivery\noperator (no :at clause in process.edn)

    partner_confirmed --> delivering : start-delivery\nadmin/plan/transit.api.ts\nfires ORDER_DELIVERING to participants
    partner_confirmed --> canceled : operator-cancel-after-partner-confirmed\nadmin/plan/transit.api.ts

    partner_rejected --> canceled : operator-cancel-after-partner-rejected\nadmin/plan/transit.api.ts

    delivering --> completed : complete-delivery\nadmin/plan/transit.api.ts\nfires ORDER_SUCCESS\ncreates food rating EventBridge scheduler\ncalls transitionOrderStatus()
    delivering --> failed_delivery : expired-delivery (operator)\nor cancel-delivery (operator)

    completed --> reviewed : review-restaurant\nfired from participants/plans/summarize-reviews.service.ts\nwhen the last participant submits a rating
    completed --> expired_review : expired-review-time\nSharetribe-managed (:at = completed + P14D)

    expired_review --> reviewed : review-restaurant-after-expire-time\nfired from participants/plans/summarize-reviews.service.ts

    canceled --> [*]
    failed_delivery --> [*]
    reviewed --> [*]
```

> Only `COMPLETE_DELIVERY` in admin `transit.api.ts` calls `transitionOrderStatus()` (line 320). Other transitions persist `lastTransition` to `plan.metadata.orderDetail` but do not re-evaluate the parent order state.

---

## 4. Sequence: Start Order (Point of No Return)

Once called, Sharetribe transactions are created and cannot be deleted — only transitioned to CANCELED.

```mermaid
sequenceDiagram
    participant AdminUI as Admin Portal
    participant API as start-order.api.ts
    participant StartSvc as start-order.service.ts
    participant InitTx as initiate-transaction.service.ts
    participant IntSDK as integrationSdk
    participant SubSDK as subAccountTrustedSdk
    participant FB as Firebase

    AdminUI->>API: PUT /api/orders/:orderId/plan/:planId/start-order

    API->>StartSvc: startOrder(orderId, planId)
    StartSvc->>IntSDK: listings.update(orderId)\norderState = inProgress
    StartSvc->>FB: createFirebaseDocNotification\nBOOKER_ORDER_SUCCESS
    StartSvc-->>API: done

    API->>InitTx: initiateTransaction(orderId, planId)
    InitTx->>IntSDK: listings.show(orderId) + listings.show(planId)

    Note over InitTx: Split into two groups:\nsubOrdersWithNoTxId = new dates\neditedSubOrders = lastTx == INITIATE_TRANSACTION

    loop For each EDITED sub-order
        InitTx->>IntSDK: transactions.transition\nOPERATOR_CANCEL_PLAN\nclears old transactionId from orderDetail
    end

    InitTx->>IntSDK: listings.query(partnerIds)\ncapture VAT settings snapshot per partner

    Note over InitTx: normalizeOrderDetail()\nbuild booking params for each date

    loop For each new sub-order date in parallel
        InitTx->>SubSDK: sdk.login(subAccount email + decrypted password)
        SubSDK->>SubSDK: sdk.exchangeToken() → trusted token
        InitTx->>SubSDK: transactions.initiate\nprocessAlias, INITIATE_TRANSACTION\nlistingId = restaurantId\nbookingStart/End, metadata
        SubSDK-->>InitTx: transactionId
        InitTx->>FB: createFirebaseDocNotification\nSUB_ORDER_INPROGRESS to partnerId
    end

    InitTx->>IntSDK: listings.update(planId)\norderDetail[timestamp].transactionId per date
    InitTx->>IntSDK: listings.update(orderId)\npartnerIds + vatSettings snapshot
    InitTx-->>API: done
    API-->>AdminUI: 200 OK
```

**Why `subAccountTrustedSdk` and not `integrationSdk`?**
`transactions.initiate` requires `privileged: true` in the Sharetribe process definition. The integration SDK cannot satisfy this — only a token obtained via `sdk.exchangeToken()` from a user login can. The sub-account (company's Sharetribe user) is logged in server-side, then its token is exchanged for a trusted token.

---

## 5. Food Selection Flow — Participant → Sharetribe via BullMQ

```mermaid
sequenceDiagram
    participant UI as Participant Portal
    participant Redux as Redux shoppingCart.slice
    participant API as POST /api/participants/orders/:orderId
    participant BullMQ as BullMQ (processOrder.job.ts)\nworker concurrency 5
    participant Redis as Redis\nlock:plan:{planId}
    participant ST as Sharetribe\nplan.metadata.orderDetail
    participant Slack

    UI->>Redux: addToCart(memberId, planId, dayId, foodId)
    Note over Redux: In-memory only, no API call yet

    UI->>API: POST /api/participants/orders/:orderId\nbody: planId, planData, orderDay(s), memberOrders
    API->>BullMQ: addToProcessOrderQueue({ orderId, planId, currentUserId, ... })
    API-->>UI: 200 { jobId } — fire-and-forget

    BullMQ->>Redis: ACQUIRE lock:plan:{planId}\nLua CAS script, TTL 30s, up to 100 retries

    loop Contended — retry with backoff
        Redis-->>BullMQ: 0 (locked by another worker)
        BullMQ->>Redis: retry after exponential backoff
    end

    Redis-->>BullMQ: 1 (lock acquired)

    BullMQ->>ST: integrationSdk.listings.show(planId)\nfetch FRESH orderDetail
    BullMQ->>BullMQ: merge new selections into orderDetail[dayId].memberOrders
    BullMQ->>ST: integrationSdk.listings.update(planId)\nmetadata.orderDetail = merged
    BullMQ->>Redis: RELEASE lock (Lua token-check-and-delete)

    BullMQ->>ST: listings.show(planId) — post-release verification
    Note over BullMQ: expected vs. actual diff

    alt Persistence verification FAILS / job exhausts 3 retries
        BullMQ->>Slack: PARTICIPANT_ORDER_PERSISTENCE_FAILED\nto SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL
    end
```

**No Firebase indirection.** The participant API enqueues the BullMQ job directly. There is no `/place-order` endpoint and no Firebase listener step.

**Two entry points** — admin/booker edits go through `PUT /api/orders/:orderId/member-order` and write **directly** to Sharetribe (no queue, no lock). Only the participant self-pick path uses the queue. See `docs/roles/participant/food-selection.md`.

**Lock invariant:** The lock key is `lock:plan:{planId}` — per plan, not per user. Every participant writing to the same plan serializes through this single lock, preventing concurrent overwrites of `plan.metadata.orderDetail`.

---

## 6. Partner Menu & Food Lifecycle

```mermaid
stateDiagram-v2
    state "FOOD lifecycle" as food_machine {
        [*] --> food_pending : Partner creates food\nPOST /api/partner/food\nShT listing state = published\nmetadata.adminApproval = pending

        food_pending --> food_approved : Admin approves\nPUT /api/admin/food/foodId\nfires PARTNER_FOOD_ACCEPTED_BY_ADMIN
        food_pending --> food_rejected : Admin rejects\nfires PARTNER_FOOD_REJECTED_BY_ADMIN

        food_approved --> food_approved : Partner updates food\nPUT /api/partner/food/foodId\nsyncs changes to all parent menus
        food_approved --> food_deleted : Partner soft-deletes\nmetadata.isDeleted = true\nremoved from all parent menus
    }

    state "MENU lifecycle" as menu_machine {
        [*] --> menu_draft : Partner creates menu\nPOST /api/partner/menus\nmetadata.listingState = draft

        menu_draft --> menu_draft : Partner edits\nPUT /api/partner/menus\nupdates draftFoodByDate

        menu_draft --> menu_pendingRestaurant : Partner publishes BUT\nrestaurant not yet authorized\npublishDraftMenu.service.ts

        menu_pendingRestaurant --> menu_pending : Admin authorizes restaurant

        menu_draft --> menu_pending : Partner publishes\nrestaurant already authorized\npublishDraftMenu.service.ts\nSlack PARTNER_MENU_PUBLISHED_DRAFT_TO_PENDING

        menu_pending --> menu_published : Admin approves\nPUT /api/admin/pending-menus/menuId\nfires PARTNER_MENU_APPROVED_BY_ADMIN\nFirebase + OneSignal + Email
        menu_pending --> menu_rejected : Admin rejects\nfires PARTNER_MENU_REJECTED_BY_ADMIN\nFirebase + OneSignal + Email

        menu_published --> menu_closed : Menu deactivated
    }
```

**Key files:**
- `src/pages/api/apiServices/menu/createMenu.service.ts`
- `src/pages/api/apiServices/menu/updateMenu.service.ts`
- `src/pages/api/apiServices/menu/publishDraftMenu.service.ts`
- `src/pages/api/partner/food/index.api.ts` (POST) / `[foodId]/index.api.ts` (PUT/DELETE)

---

## 7. Quotation & Payment Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Portal
    participant QuotAPI as POST /api/orders/:id/quotation
    participant QuotSvc as createQuotation.service.ts
    participant ST as Sharetribe quotation listing
    participant InitPay as initialize-payment.service.ts
    participant CartHelper as cartInfoHelper.ts
    participant FB as Firebase payment ledger
    participant ConfirmAPI as /api/admin/payment/confirm-*

    Note over Admin,ST: STEP 1 — Create Quotation

    Admin->>QuotAPI: POST body: client quotation + partner quotation per restaurantId
    QuotAPI->>QuotSvc: createQuotation()
    QuotSvc->>ST: fetch admin user to get+increment quotationIdNumber counter
    QuotSvc->>ST: listings.create quotation listing\nmetadata: status=active, client, partner
    QuotSvc->>ST: listings.update old quotation\nstatus = inactive
    QuotSvc->>ST: listings.update order\nquotationId = new listing id
    QuotSvc-->>Admin: quotation listing

    Note over Admin,FB: STEP 2 — Initialize Payment Records at start-order time

    Admin->>InitPay: initializePayment(orderId, planId)
    InitPay->>ST: fetch quotation listing

    loop For each non-canceled sub-order date
        InitPay->>CartHelper: calculatePriceQuotationPartner\nVAT mode: vat or noExportVat or direct
        CartHelper-->>InitPay: totalWithVAT for this partner on this date
        InitPay->>FB: createPaymentRecordOnFirebase EPaymentType.PARTNER\nisAdminConfirmed=false, isHideFromHistory=true
    end

    InitPay->>CartHelper: calculatePriceQuotationInfoFromOrder\nclient total including PCC fee
    CartHelper-->>InitPay: totalWithVAT for client
    InitPay->>FB: createPaymentRecordOnFirebase EPaymentType.CLIENT\nisAdminConfirmed=false

    Note over Admin,FB: STEP 3 — Admin Confirms Payments (IRREVERSIBLE)

    Admin->>ConfirmAPI: PUT /api/admin/payment/confirm-client-payment
    ConfirmAPI->>FB: updateClientRootPaymentRecord isAdminConfirmed=true
    ConfirmAPI->>ST: listings.update order\nisAdminConfirmedClientPayment=true

    Admin->>ConfirmAPI: PUT /api/admin/payment/confirm-partner-payment\nbody: orderId, subOrderDate
    ConfirmAPI->>FB: updatePartnerRootPaymentRecord isAdminConfirmed=true
    ConfirmAPI->>ST: listings.update plan\norderDetail[date].isAdminPaymentConfirmed=true

    Note over ConfirmAPI,ST: transitionOrderStatus() runs after each confirmation\nif ALL sub-orders done AND both payments confirmed\nthen order.state = completed
```

**VAT calculation modes** (`src/helpers/order/cartInfoHelper.ts`):

| Mode | Effect on customer | Effect on partner |
|------|--------------------|-------------------|
| `vat` | `+total × vatPct` | `+total × vatPct` |
| `noExportVat` | `+total × vatPct` | `−total × vatPct` (VAT deducted from payout) |
| `direct` | 0 | 0 |

The `noExportVat` partner formula uses a **negative** vatPercentage internally. The UI always displays `Math.abs(VATFee)`.

---

## 8. Notification Dispatch Map

Every event fires across up to 4 independent channels. There is no coordinator — if one channel fails, the others still execute.

```mermaid
graph LR
    subgraph Events["Order / Sub-Order Events"]
        E1[Order enters picking]
        E2[Order enters inProgress]
        E3[Sub-order enters delivering]
        E4[Sub-order completed]
        E5[Sub-order canceled]
        E6[Order enters pendingPayment]
        E7[Participant submits rating]
        E8[Menu approved or rejected by admin]
        E9[Food approved or rejected by admin]
        E10[Partner confirms sub-order]
        E11[Partner rejects sub-order]
        E13[Food selection fails to persist]
    end

    subgraph FB["Firebase — in-app feed\nsrc/services/notifications.ts"]
        F1[ORDER_PICKING to participants]
        F2[BOOKER_PICKING_ORDER to booker]
        F3[SUB_ORDER_INPROGRESS to partner]
        F4[ORDER_DELIVERING to participants]
        F5[ORDER_SUCCESS to participants]
        F6[BOOKER_SUB_ORDER_COMPLETED to booker]
        F7[ORDER_CANCEL to participants]
        F8[BOOKER_SUB_ORDER_CANCELLED to booker]
        F9[BOOKER_RATE_ORDER to booker]
        F10[ORDER_RATING to partner]
        F11[PARTNER_MENU_APPROVED/REJECTED to partner]
        F12[PARTNER_FOOD_ACCEPTED/REJECTED to partner]
    end

    subgraph OS["OneSignal — push\nsrc/services/nativeNotification.ts"]
        N1[BookerTransitOrderStateToPicking to participants]
        N2[BookerTransitOrderStateToInProgress to participants and partners]
        N3[AdminTransitSubOrderToDelivered to participant]
        N4[AdminTransitSubOrderToCanceled to participants and partners]
        N5[SubOrderDelivering / Delivered / Cancelled to booker]
        N6[OrderIsPendingPayment to booker]
        N7[AdminApprove/RejectPartnerMenu to partner]
    end

    subgraph SES["SES Email\nsrc/services/email.ts"]
        M1[BOOKER_ORDER_SUCCESS to booker]
        M2[PARTNER_NEW_ORDER_APPEAR to partner]
        M3[BOOKER_SUB_ORDER_CANCELED to booker]
        M4[PARTICIPANT_SUB_ORDER_CANCELED to each participant with food]
        M5[PARTNER_SUB_ORDER_CANCELED to partner]
        M6[PARTNER_MENU_APPROVED/REJECTED to partner]
    end

    subgraph SL["Slack\nsrc/services/slackNotification.ts"]
        S1[ORDER_STATUS_CHANGES_TO_IN_PROGRESS to main channel]
        S2[SUB_ORDER_CANCELED to main channel]
        S3[PARTNER_CONFIRMS_SUB_ORDER to main channel]
        S4[PARTNER_REJECTS_SUB_ORDER to main channel]
        S5[PARTNER_MENU_PUBLISHED_DRAFT_TO_PENDING to partner channel]
        S6[ADMIN_APPROVE/REJECT_PARTNER_MENU to partner channel]
        S7[PARTICIPANT_ORDER_PERSISTENCE_FAILED to missing-orders channel CRITICAL]
        S8[PARTICIPANT_RATING to ratings channel]
    end

    E1 --> F1 & F2 & N1
    E2 --> F3 & N2 & S1 & M1 & M2
    E3 --> F4 & N5
    E4 --> F5 & F6 & N3 & N5
    E5 --> F7 & F8 & N4 & N5 & S2 & M3 & M4 & M5
    E6 --> F9 & N6
    E7 --> F10 & S8
    E8 --> F11 & N7 & M6 & S6
    E9 --> F12
    E10 --> S3
    E11 --> S4
    E13 --> S7
```

---

## 9. Auth & SDK Mode Map

There are **5 SDK helpers** in the codebase (auth docs list only 4 — `getTrustedSdkWithSubAccountToken` is the undocumented 5th).

```mermaid
graph TD
    subgraph Browser
        Cookie["HTTP Cookie\nShT token managed by expressCookieStore"]
    end

    subgraph Server["Server-side API Routes"]
        SDK1["getSdk(req, res)\nsrc/sharetribe/\nReads user cookie token\nUSE: standard reads and writes\nfor the logged-in user"]

        SDK2["getTrustedSdk(req)\nsrc/services/sdk.ts\nReads cookie token then exchangeToken()\nUSE: privileged transitions that\nrequire trusted token"]

        SDK3["getIntegrationSdk()\nsrc/services/integrationSdk.ts\nUses FLEX_INTEGRATION_CLIENT_SECRET\nNo user context needed\nUSE: all admin-level listing ops\n(create, update, query listings)"]

        SDK4["getSubAccountTrustedSdk(subAccount)\nsrc/services/subAccountSdk.ts\n1. Decrypt AES password via ENCRYPT_PASSWORD_SECRET_KEY\n2. sdk.login(subAccount email + password)\n3. sdk.exchangeToken() to get trusted token\nUSE: initiate-transaction ONLY\n(creates Sharetribe tx as company user)"]

        SDK5["getTrustedSdkWithSubAccountToken(userToken)\nsrc/services/sdk.ts line 116\nAccepts a pre-obtained userToken string\nthen exchangeToken()\nUSE: when sub-account login was already\nperformed externally e.g. in subAccountSdk.ts"]
    end

    subgraph Sharetribe["Sharetribe Flex APIs"]
        UserAPI["User-scoped API\n(reads and writes as logged-in user)"]
        TrustedAPI["Privileged API\n(required for privileged:true transitions)"]
        IntegAPI["Integration API\n(operator-level, no user context)"]
    end

    Cookie --> SDK1 & SDK2
    SDK1 --> UserAPI
    SDK2 --> TrustedAPI
    SDK3 --> IntegAPI
    SDK4 --> TrustedAPI
    SDK4 -.->|"provides userToken to"| SDK5
    SDK5 --> TrustedAPI
```

**Security invariant:** `ENCRYPT_PASSWORD_SECRET_KEY` is used only inside `subAccountSdk.ts` to AES-decrypt the company sub-account password stored in `company.privateData.accountPassword`. If this key is rotated, all sub-account passwords become unreadable. **Never log the decrypted password.**

---

## 10. AWS EventBridge Scheduler Map

All schedulers fire one-shot (`at(yyyy-MM-ddTHH:mm:ss)` format) in `Asia/Ho_Chi_Minh` timezone.
File: `src/services/awsEventBrigdeScheduler.ts`

```mermaid
graph TD
    subgraph "At Order Creation"
        S1["sendRemindPOE-orderId\nFires: deadlineDate MINUS SEND_REMIND_PICKING_ORDER_TIME_TO_DEADLINE_IN_MINUTES\nLambda: LAMBDA_ARN\nAction: push food-picking reminder to all participants"]

        S2["automaticStartOrder-orderId\nFires: startDate + deliveryHour MINUS OFFSET_IN_HOUR\nLambda: AUTOMATIC_START_ORDER_JOB_LAMBDA_ARN\nAction: auto-start order if admin has not done it manually"]
    end

    subgraph "At Order publish to picking"
        S3["PFFEM-orderId\nFires: deadlineDate exactly\nLambda: PICK_FOOD_FOR_EMPTY_MEMBER_LAMBDA_ARN\nAction: assign default food to members with no selection\n(only if isAutoPickFood = true)"]

        S4["sendRPNNTB-orderId\nFires: deadlineDate MINUS REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_TIME_TO_DEADLINE_IN_MINUTES\nLambda: SEND_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_LAMBDA_ARN\nAction: push deadline reminder to booker"]
    end

    subgraph "Per sub-order complete-delivery"
        S5["sendFRN-orderId-timestamp\nFires: NOW + TIME_TO_SEND_FOOD_RATING_NOTIFICATION minutes\nLambda: SEND_FOOD_RATING_NOTIFICATION_LAMBDA_ARN\nAction: send food rating prompt to participants who ate that day\nOne scheduler per delivered sub-order date"]
    end

    OrderCreated["Order Created"] --> S1 & S2
    OrderPicking["Order → picking"] --> S3 & S4
    DeliveryComplete["Sub-order complete-delivery"] --> S5
```

**Rules:**
- Scheduler names must be **unique per order**: `{prefix}{orderId}` (e.g. `automaticStartOrder_abc123`)
- Schedulers for `PFFEM` and `sendRPNNTB` are **upserted** (create-or-update) when order is re-published
- All schedulers must be **deleted when an order is canceled** — otherwise Lambdas fire on stale state and attempt duplicate operations

---

## 11. Full Cross-Role Interaction Sequence

End-to-end view of all actors across the full order lifecycle.

```mermaid
sequenceDiagram
    actor Admin
    actor Booker
    actor Participant
    actor Partner

    Note over Admin,Partner: PHASE 1 — ORDER SETUP

    Admin->>Admin: Creates order (draft) on behalf of company\nor Booker self-creates (bookerDraft)
    Admin->>Admin: Configures restaurants + menus per delivery date
    Note over Admin: EventBridge schedulers created:\nauto-start + participant deadline reminder
    Admin->>Admin: Publishes order to picking state\npublish-order.service.ts
    Note over Admin: EventBridge schedulers created or upserted:\nauto-pick food + booker deadline reminder

    Note over Admin,Partner: PHASE 2 — FOOD PICKING

    Admin->>Participant: ORDER_PICKING notification (Firebase + OneSignal)
    Admin->>Booker: BOOKER_PICKING_ORDER notification (Firebase)
    Participant->>Participant: Browses menu on /participant/plans/planId
    Participant->>Participant: Submits food selection\nplace-order.api.ts writes to Firebase\nFB listener enqueues BullMQ job\nBullMQ acquires Redis lock and persists to Sharetribe
    Booker->>Booker: Can view and edit member selections in admin UI

    Note over Admin: Lambda fires at deadline:\nauto-picks default food for empty member slots

    Note over Admin,Partner: PHASE 3 — ORDER START

    Admin->>Admin: Calls start-order\norder.state = inProgress\ninitiate-transaction.service.ts creates\none Sharetribe transaction per date\nusing subAccountTrustedSdk
    Admin->>Partner: SUB_ORDER_INPROGRESS notification (Firebase)

    Partner->>Partner: Reviews assigned sub-order on /partner/orders
    Partner->>Admin: Confirms sub-order\npartner/transit.api.ts triggers operator transition
    Note over Admin: Alternatively partner rejects,\nadmin cancels via operator-cancel-after-partner-rejected

    Note over Admin,Partner: PHASE 4 — DELIVERY

    Admin->>Admin: Triggers start-delivery\ntransaction → delivering
    Admin->>Participant: ORDER_DELIVERING notification (Firebase)
    Admin->>Booker: SubOrderDelivering push (OneSignal)

    Admin->>Admin: Triggers complete-delivery\ntransaction → completed
    Admin->>Participant: ORDER_SUCCESS notification (Firebase + OneSignal per food eaten)
    Admin->>Booker: SubOrderDelivered push (OneSignal)
    Note over Admin: EventBridge scheduler created:\nfood rating notification fires after configurable delay

    Note over Admin,Partner: PHASE 5 — REVIEW AND PAYMENT

    Participant->>Participant: Prompted by Lambda to rate food
    Participant->>Participant: Submits rating\nreview-restaurant.api.ts updates tx metadata
    Note over Participant: When LAST participant rates:\nsummarizeReviews() updates restaurant publicData.rating\ntransaction transitions to reviewed state

    Admin->>Admin: Confirms client payment\nconfirm-client-payment.api.ts\nFirebase isAdminConfirmed=true + Sharetribe listing updated
    Admin->>Admin: Confirms partner payment per sub-order date\nconfirm-partner-payment.api.ts
    Note over Admin: transitionOrderStatus() runs:\nif all sub-orders done AND both payments confirmed\norder.state = completed
```

---

*Generated by cross-referencing source code against existing docs. Last verified: 2026-04-15.*
