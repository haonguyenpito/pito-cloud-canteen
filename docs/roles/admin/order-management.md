# Admin — Order Management

## Sub-Order State Machine Hub: `transit.api.ts`

**File:** `src/pages/api/admin/plan/transit.api.ts`
**Endpoint:** `POST /api/admin/plan/transit`
**Input:** `{ txId: string, transition: ETransition }`

This is the **central hub** for all sub-order delivery state transitions. Every step after a sub-order is initiated flows through this endpoint. The **behavioral contract** for this file is documented as a block comment at the top of `transit.api.ts` (lines 1–44) — always read it before modifying.

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

| Action                | API                                                   | Notes                                           |
| --------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Approve pending order | `PUT /api/admin/listings/order/:orderId/update-state` | `pendingApproval` → `draft`                     |
| Cancel order          | `PUT /api/admin/listings/order/:orderId/update-state` | Any pre-`inProgress` state                      |
| Cancel picking        | `PUT /api/orders/:orderId/cancel-picking-order`       | `picking` → `draft` or `canceled`               |
| Publish to picking    | `POST /api/orders/:orderId/publish-order`             | `draft` → `picking`                             |
| Start order           | `PUT /api/orders/:orderId/plan/:planId/start-order`   | **Irreversible** — creates Sharetribe transactions |

### Order States Reference

```
bookerDraft → pendingApproval → draft → picking → inProgress → pendingPayment → completed → reviewed
                                  │
                                  ▼
                          canceled / expiredStart / canceledByBooker
```

| State              | Who Sets It  | Meaning                                                            |
| ------------------ | ------------ | ------------------------------------------------------------------ |
| `bookerDraft`      | Booker       | Initial booker-created draft                                       |
| `pendingApproval`  | Booker       | Booker submitted for admin review                                  |
| `draft`            | Admin        | Admin approved — ready for setup                                   |
| `picking`          | Admin/Booker | Published — participants can pick food                             |
| `inProgress`       | System       | Sharetribe transactions initiated, delivery underway               |
| `pendingPayment`   | System       | All deliveries done, awaiting payment confirmation                 |
| `completed`        | Admin        | Both payments confirmed                                            |
| `reviewed`         | System/Admin | Restaurant reviews submitted                                       |
| `canceled`         | Admin        | Order canceled at any pre-`inProgress` state                       |
| `canceledByBooker` | Booker       | Booker canceled the order                                          |
| `expiredStart`     | System       | Order never started — auto-start window expired                    |

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
