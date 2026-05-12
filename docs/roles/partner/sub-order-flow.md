# Partner — Sub-Order Flow

## Overview

Each delivery date within an order is a "sub-order" backed by a Sharetribe transaction. In `process.edn`, **every** post-initiation transition uses `actor: :actor.role/operator` — so PITO's server is always the Sharetribe actor. From the partner's perspective, however, two transitions (`partner-confirm-sub-order`, `partner-reject-sub-order`) are triggered from the **partner portal** itself; the partner portal calls a PITO-side endpoint which then performs the operator transition on Sharetribe.

---

## Sub-Order Lifecycle (Partner's View)

```
Sub-order assigned to partner (state: initiated)
    │
    ├──► Partner clicks Confirm in portal
    │         → PUT /api/partner/:partnerId/orders/:orderId/transit
    │         → server runs partner-confirm-sub-order (operator)
    │         │
    │         ▼
    │    PARTNER_CONFIRMED
    │         │
    │    Admin clicks Start delivery
    │         → PUT /api/admin/plan/transit (START_DELIVERY)
    │         │
    │         ▼
    │    DELIVERING
    │         │
    │    Admin clicks Complete
    │         → PUT /api/admin/plan/transit (COMPLETE_DELIVERY)
    │         │
    │         ▼
    │    COMPLETED → (food-rating scheduler created → notifications to participants)
    │
    └──► Partner clicks Reject in portal
              → PUT /api/partner/:partnerId/orders/:orderId/transit
              → server runs partner-reject-sub-order (operator)
              │
              ▼
         PARTNER_REJECTED
              │
         Admin clicks Cancel → PUT /api/admin/plan/transit (OPERATOR_CANCEL_AFTER_PARTNER_REJECTED)
              │
              ▼
         CANCELED
```

**Two transit endpoints exist** (both ultimately call Sharetribe as operator):

| Endpoint                                                      | Transitions handled                                                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/partner/:partnerId/orders/:orderId/transit`         | `PARTNER_CONFIRM_SUB_ORDER`, `PARTNER_REJECT_SUB_ORDER` — passed via `newTransition` body field                                            |
| `PUT /api/admin/plan/transit`                                 | `START_DELIVERY`, `COMPLETE_DELIVERY`, `OPERATOR_CANCEL_PLAN`, `OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED`, `OPERATOR_CANCEL_AFTER_PARTNER_REJECTED` |

Partners cannot bypass PITO's server — Sharetribe's `process.edn` rejects any non-operator actor on these transitions.

---

## Notifications Partners Receive

| Event                       | Channel   | Type                                          |
| --------------------------- | --------- | --------------------------------------------- |
| New sub-order assigned      | Email     | `PARTNER_NEW_ORDER_APPEAR`                    |
| Sub-order canceled          | Email     | `PARTNER_SUB_ORDER_CANCELED`                  |
| Order details updated       | Email     | `PARTNER_ORDER_DETAILS_UPDATED`               |
| Sub-order out for delivery  | Firebase  | (delivery status)                             |
| Admin cancels               | OneSignal | `AdminTransitSubOrderToCanceled`              |
| Sub-order started           | OneSignal | `BookerTransitOrderStateToInProgress`         |
| Partner profile updated     | Firebase  | `PARTNER_PROFILE_UPDATED_BY_ADMIN`            |
| Admin created food on behalf | Firebase | `PARTNER_FOOD_CREATED_BY_ADMIN`               |
| Admin created menu on behalf | Firebase | `PARTNER_MENU_CREATED_BY_ADMIN`               |

---

## Review Flow (Partner Side)

After delivery is complete and a participant leaves a rating:

1. Participant rating appears in partner's review section
2. Partner can reply via the partner portal
3. Reply goes to admin for approval before being published

| Action                    | API                              | Slack Channel             |
| ------------------------- | -------------------------------- | ------------------------- |
| Partner submits reply     | (partner portal)                 | `SLACK_RATING_WEBHOOK_URL` — `PARTNER_REPLY_REVIEW` |
| Admin approves reply      | (admin portal)                   | `SLACK_RATING_WEBHOOK_URL` — `ADMIN_APPROVE_PARTNER_REPLY_REVIEW` |
| Participant notified      | Firebase + OneSignal             | `AdminApprovePartnerReplyReview` |

---

## Sharetribe Transaction Reference

For the full state machine, all transition names, and technical implementation, see `docs/shared/transaction-flow.md`.

Key transitions relevant to partner:

| Transition                          | Meaning                                |
| ----------------------------------- | -------------------------------------- |
| `partner-confirm-sub-order`         | Partner accepts the delivery           |
| `partner-reject-sub-order`          | Partner cannot fulfill this delivery   |
| `start-delivery`                    | Delivery marked as out for delivery    |
| `complete-delivery`                 | Delivery completed successfully        |
| `operator-cancel-plan`              | Admin cancels the sub-order            |
