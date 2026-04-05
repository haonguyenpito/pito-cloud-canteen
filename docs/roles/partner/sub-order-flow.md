# Partner — Sub-Order Flow

## Overview

Each delivery date within an order is a "sub-order" backed by a Sharetribe transaction. Although PITO admin drives all Sharetribe transitions (as operator), partners communicate their actions through the PITO portal — admin reads and triggers the corresponding transition on their behalf.

---

## Sub-Order Lifecycle (Partner's View)

```
Sub-order assigned to partner (state: initiated)
    │
    ├──► Partner confirms → admin triggers partner-confirm-sub-order
    │         │
    │         ▼
    │    PARTNER_CONFIRMED
    │         │
    │    Admin starts delivery → start-delivery
    │         │
    │         ▼
    │    DELIVERING
    │         │
    │    Admin marks delivered → complete-delivery
    │         │
    │         ▼
    │    COMPLETED → (food rating prompt sent to participants)
    │
    └──► Partner rejects → admin triggers partner-reject-sub-order
              │
              ▼
         PARTNER_REJECTED → admin cancels → CANCELED
```

**All Sharetribe transitions are triggered by admin** via `POST /api/admin/plan/transit`. Partners cannot call Sharetribe transitions directly.

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
