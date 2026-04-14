# Sharetribe Transaction Flow

## Overview

Each delivery date (sub-order) within an order is backed by a **Sharetribe Flex transaction**. The transaction lifecycle is managed by PITO admins via the Sharetribe operator role — partners and participants cannot directly trigger Sharetribe transitions.

**Process alias:** `sub-order-transaction-process/release-2`

**Source of truth:** `transaction-process/process.edn`

---

## Transaction State Machine

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
                INITIAL                                            │
                    │                                              │
        [initiate-transaction]                                     │
         (customer, privileged)                                    │
                    │                                              │
                    ▼                                              │
              INITIATED                                            │
                    │                                              │
        ┌───────────┼───────────────┐                             │
        │           │               │                             │
[operator-    [partner-reject-  [expired-start-                   │
cancel-plan]  sub-order]        delivery]                         │
 (operator)   (operator)        (time-based)                      │
        │           │               │                             │
        ▼           ▼               ▼                             │
    CANCELED  PARTNER_REJECTED FAILED_DELIVERY                    │
                    │                                              │
        [operator-cancel-after-                                    │
         partner-rejected]                                         │
         (operator)                                                │
                    │                                              │
                    ▼                                              │
                CANCELED                                           │
                                                                   │
        [partner-confirm-sub-order]                                │
         (operator)                                                │
                    │                                              │
                    ▼                                              │
          PARTNER_CONFIRMED                                        │
                    │                                              │
        ┌───────────┤                                              │
        │           │                                              │
[operator-    [start-delivery]                                     │
cancel-after-  (operator)                                         │
partner-       │                                                   │
confirmed]     ▼                                                   │
(operator) DELIVERING                                              │
        │       │                                                  │
        ▼       ├──────────────────┐                              │
    CANCELED    │                  │                              │
         [complete-delivery]  [expired-delivery]                  │
          (operator)          (time-based)                        │
                │              │                                   │
                ▼              ▼          [cancel-delivery]       │
           COMPLETED    FAILED_DELIVERY   (operator)              │
                │                              │                   │
        ┌───────┤                              ▼                   │
        │       │                        FAILED_DELIVERY           │
[review-  [expired-                                                │
restaurant] review-time]                                           │
(operator)  (time-based,                                          │
        │    14 days)                                              │
        │       │                                                  │
        ▼       ▼                                                  │
    REVIEWED EXPIRED_REVIEW ─────[review-restaurant-after-        │
                                  expire-time] (operator) ────────┘
```

---

## All Transitions

| Transition                                | Actor                 | From State          | To State            | Sharetribe Actions                             |
| ----------------------------------------- | --------------------- | ------------------- | ------------------- | ---------------------------------------------- |
| `initiate-transaction`                    | customer (privileged) | —                   | `initiated`         | `create-booking`, `privileged-update-metadata` |
| `operator-cancel-plan`                    | operator              | `initiated`         | `canceled`          | `decline-booking`                              |
| `partner-reject-sub-order`                | operator              | `initiated`         | `partner-rejected`  | —                                              |
| `operator-cancel-after-partner-rejected`  | operator              | `partner-rejected`  | `canceled`          | `decline-booking`                              |
| `partner-confirm-sub-order`               | operator              | `initiated`         | `partner-confirmed` | `accept-booking`                               |
| `operator-cancel-after-partner-confirmed` | operator              | `partner-confirmed` | `canceled`          | `cancel-booking`                               |
| `expired-start-delivery`                  | time-based            | `initiated`         | `failed-delivery`   | —                                              |
| `start-delivery`                          | operator              | `partner-confirmed` | `delivering`        | —                                              |
| `expired-delivery`                        | time-based            | `delivering`        | `failed-delivery`   | `decline-booking`                              |
| `cancel-delivery`                         | operator              | `delivering`        | `failed-delivery`   | `cancel-booking`                               |
| `complete-delivery`                       | operator              | `delivering`        | `completed`         | —                                              |
| `review-restaurant`                       | operator              | `completed`         | `reviewed`          | `post-review-by-customer`, `publish-reviews`   |
| `expired-review-time`                     | time-based            | `completed`         | `expired-review`    | — (fires 14 days after `completed`)            |
| `review-restaurant-after-expire-time`     | operator              | `expired-review`    | `reviewed`          | `post-review-by-customer`, `publish-reviews`   |

---

## Design Decisions

### All transitions are operator-controlled

After `initiate-transaction`, every transition is triggered by PITO (operator role). Partners and participants interact through the PITO portal — PITO's admin reads their actions and triggers the corresponding Sharetribe transition on their behalf.

### Why `privileged? true` on `initiate-transaction`

The `initiate-transaction` transition uses `privileged-update-metadata` which requires a trusted (server-side) token. This prevents clients from directly calling Sharetribe to create transactions. All transaction creation goes through PITO's server.

### Sharetribe bookings are used as lifecycle hooks only

The `create-booking`, `accept-booking`, `cancel-booking`, `decline-booking` actions are called to keep Sharetribe's booking calendar consistent, but the actual delivery tracking is in listing metadata (`plan.metadata.orderDetail`), not in the Sharetribe booking object.

### Reviews use customer side only

Reviews are submitted as `post-review-by-customer` (company reviewing the restaurant). There is no partner-side review in this process.

---

## Transaction Initiation (Code Flow)

Triggered by `start-order` endpoint:

```
PUT /api/orders/:orderId/plan/:planId/start-order
  → src/pages/api/orders/[orderId]/plan/[planId]/start-order.api.ts
    → startOrder() — updates order state to inProgress
    → for each date in plan:
        initiateTransaction()
          → getSubAccountTrustedSdk(subAccount)  [src/services/subAccountSdk.ts]
          → sdk.login({ username: subAccount.email, password: decryptedPassword })
          → sdk.exchangeToken()  → trusted token
          → trustedSdk.transactions.initiate({
              processAlias: 'sub-order-transaction-process/release-2',
              transition: 'transition/initiate-transaction',
              params: { listingId: restaurantListingId, bookingStart, bookingEnd, ... }
            })
          → write transactionId back to plan.metadata.orderDetail[timestamp].transactionId
```

---

## Transition Triggers (Admin Portal)

Admin triggers sub-order transitions via:

**API:** `POST /api/admin/plan/transit`

**File:** `src/pages/api/admin/plan/transit.api.ts`

After each transition, `transition-order-status.service.ts` is called to check if the overall order state should change (e.g., all sub-orders completed → move order to `pendingPayment`).

---

## Transaction State in Redux

**Slice:** `src/redux/slices/transaction.slice.ts`

The `lastTransition` field of each transaction is stored in `plan.metadata.orderDetail[timestamp].lastTransition` and synced from Sharetribe transaction data.

**Transaction state helpers:** `src/utils/transaction.ts`

Exports constants for all state names and transition names, used throughout the UI to conditionally render buttons and labels.

---

## Deploying Process Changes

If `transaction-process/process.edn` is modified, it must be deployed to Sharetribe using the Sharetribe Flex CLI:

```bash
flex-cli process push --process sub-order-transaction-process --path transaction-process --marketplace <MARKETPLACE_ID>
flex-cli process create-alias --process sub-order-transaction-process --version <VERSION> --alias release-2 --marketplace <MARKETPLACE_ID>
```

**Warning:** Do not change `bookingProcessAlias` in `src/configs.ts` unless you have deployed a new alias. A mismatch will break all transaction initiations.
