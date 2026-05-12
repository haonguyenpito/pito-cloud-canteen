# Admin — Order Management

## Sub-Order State Machine Hub: `transit.api.ts`

**File:** `src/pages/api/admin/plan/transit.api.ts`
**Endpoint:** `PUT /api/admin/plan/transit`
**Input:** `{ txId: string, transition: ETransition }`

This is the admin-side hub for the post-confirmation half of the sub-order lifecycle (start delivery, complete delivery, cancel). The **behavioral contract** lives as a block comment at the top of `transit.api.ts` (lines 1–44) — always read it before modifying.

> **Not the only transit endpoint.** Partners use a parallel endpoint at `PUT /api/partner/:partnerId/orders/:orderId/transit` to confirm or reject incoming sub-orders (`PARTNER_CONFIRM_SUB_ORDER`, `PARTNER_REJECT_SUB_ORDER`). At the Sharetribe level both endpoints call `integrationSdk.transactions.transition` as the operator role — the actor is always operator in `process.edn` regardless of who initiated the request. See `docs/shared/transaction-flow.md` for the full transition map.

### Transitions Handled

| Transition                                            | Action                                                          | Notifications                                                                                                                      | Payment Updates                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ETransition.START_DELIVERY`                          | Marks sub-order as out for delivery                             | Firebase: `ORDER_DELIVERING` to participants; OneSignal: `SubOrderDelivering` to booker                                            | None                                                                                                    |
| `ETransition.COMPLETE_DELIVERY`                       | Marks sub-order as delivered; schedules food rating notification | Firebase: `ORDER_SUCCESS`, `BOOKER_SUB_ORDER_COMPLETED`; OneSignal: `SubOrderDelivered`, `AdminTransitSubOrderToDelivered`         | Calls `transitionOrderStatus()` — checks if all sub-orders done, moves order to `pendingPayment` if so  |
| `ETransition.OPERATOR_CANCEL_PLAN`                    | Cancels initiated sub-order                                     | Email: booker (`BOOKER_SUB_ORDER_CANCELED`), participants, partner; Firebase + Slack notifications                                 | Calls `modifyPaymentWhenCancelSubOrderService()` to adjust payment ledger; creates revised quotation    |
| `ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED` | Cancel after partner already confirmed                          | Same as `OPERATOR_CANCEL_PLAN`                                                                                                     | Same as `OPERATOR_CANCEL_PLAN`                                                                          |
| `ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED`  | Cancel after partner rejected                                   | Same as `OPERATOR_CANCEL_PLAN`                                                                                                     | Same as `OPERATOR_CANCEL_PLAN`                                                                          |

After `COMPLETE_DELIVERY`, an AWS EventBridge scheduler (`createFoodRatingNotificationScheduler`) fires food rating prompts via `SEND_FOOD_RATING_NOTIFICATION_LAMBDA_ARN`.

---

## Order State Management

Beyond the sub-order transit hub, admin has direct order state controls:

| Action                | API                                                   | Notes                                                                                                                                  |
| --------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Update order state    | `PUT /api/admin/listings/order/:orderId/update-state` | Generic state setter; only allows transitions listed in `ORDER_STATE_TRANSIT_FLOW` (`src/utils/constants.ts`). Used to publish, cancel, etc. |
| Cancel picking        | `PUT /api/orders/:orderId/cancel-picking-order`       | `picking` → `canceled` only. Also cleans up EventBridge schedulers and notifies all participants.                                      |
| Publish to picking    | `POST /api/orders/:orderId/publish-order`             | `draft` → `picking`. Sets up EventBridge schedulers (auto-pick, picking reminder, auto-start).                                         |
| Start order           | `PUT /api/orders/:orderId/plan/:planId/start-order`   | **Irreversible** — creates Sharetribe transactions, triggers `initialize-payment`, moves order to `inProgress`.                        |
| Booker request approval | `PUT /api/orders/:orderId/request-approval-order`   | Booker-only: `draft` → `pendingApproval`. Admin then publishes via `update-state`.                                                     |
| Booker cancel pending | `PUT /api/orders/:orderId/cancel-pending-approval-order` | Booker-only: `pendingApproval` → `canceledByBooker`.                                                                                |

**Allowed `ORDER_STATE_TRANSIT_FLOW` transitions** (single source of truth in `src/utils/constants.ts`):

```
draft            → pendingApproval | canceled
bookerDraft      → canceled
pendingApproval  → picking | canceledByBooker | canceled
picking          → inProgress | canceled
inProgress       → pendingPayment
pendingPayment   → completed
completed        → reviewed
```

### Order States Reference

```
              bookerDraft ─────────┐
                                   ▼
            draft ── (request-approval) ──> pendingApproval ──> picking ──> inProgress ──> pendingPayment ──> completed ──> reviewed
              │                       │              │
              ▼                       ▼              ▼
           canceled            canceledByBooker   canceled
                                  /canceled
```

`expiredStart` is set by the auto-start scheduler when the order is in `picking` and the auto-start window has elapsed without progress; it is set directly by scheduler logic and is not part of `ORDER_STATE_TRANSIT_FLOW`.

| State              | Who Sets It  | Meaning                                                                              |
| ------------------ | ------------ | ------------------------------------------------------------------------------------ |
| `bookerDraft`      | Booker       | Booker began creating an order but has not submitted; only outgoing transition is `canceled`. |
| `draft`            | Admin/System | Default state for admin-created orders; awaits booker `request-approval-order`.      |
| `pendingApproval`  | Booker       | Booker requested approval; admin reviews and either publishes (→ `picking`) or cancels. |
| `picking`          | Admin        | Published — participants can pick food until the deadline.                           |
| `inProgress`       | System       | `start-order` ran; Sharetribe transactions exist; delivery underway.                 |
| `pendingPayment`   | System       | All sub-orders completed; awaiting partner + client payment confirmation.            |
| `completed`        | System       | Both `isAdminConfirmedPartnerPayment` and `isAdminConfirmedClientPayment` are true.  |
| `reviewed`         | System/Admin | Restaurant reviews submitted (`review-restaurant` transition).                       |
| `canceled`         | Admin        | Order canceled at any pre-`inProgress` state.                                        |
| `canceledByBooker` | Booker       | Booker canceled while in `pendingApproval`.                                          |
| `expiredStart`     | System       | Auto-start scheduler fired but order was not in a startable state.                   |

---

## Start Order (Point of No Return)

**File:** `src/pages/api/orders/[orderId]/plan/[planId]/start-order.api.ts`

What happens:
1. Order state → `inProgress`
2. For each date in the plan, `initiateTransaction` creates a Sharetribe transaction using sub-account trusted SDK
3. `transactionId` written back to `plan.metadata.orderDetail[timestamp].transactionId`
4. Firebase notifications to participants and restaurants

**Never call this more than once per order.** Check if `transactionId` already exists before initiating.

See `docs/shared/transaction-flow.md` for the full Sharetribe state machine.
