# Participant Role — Overview

## What Participants Do

Participants are company employees who:

- Receive notifications when an order enters `picking` phase
- Log in to select their food for each delivery date
- Receive food at the office and sign handover checklists
- Rate the food and restaurant after delivery

---

## Portal

**URL prefix:** `/participant/*`

Identified by `currentUser.attributes.profile.publicData.userType === 'participant'`.

---

## Participant Redux Slices

| Slice                            | File                                                      | State Managed                          |
| -------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| `shoppingCart`                   | `src/redux/slices/shoppingCart.slice.ts`                  | Food cart: `{ [userId]: { [planId]: { [dayTimestamp]: CartItem } } }` |
| `ParticipantOrderList`           | `src/pages/participant/orders/OrderList.slice.ts`         | Order list with filters                |
| `ParticipantPlanPage`            | `src/pages/participant/plans/[planId]/ParticipantPlanPage.slice.ts` | Plan detail page state      |
| `ParticipantSubOrderList`        | `src/pages/participant/sub-orders/SubOrders.slice.ts`     | Sub-order history                      |
| `ParticipantOrderManagementPage` | `src/pages/participant/ParticipantOrderManagementPage.slice.ts` | Order management page state       |
| `participantReviews`             | `src/redux/slices/Reviews.participant.slice.ts`           | Participant review history             |

---

## Key Docs

- `docs/roles/participant/food-selection.md` — Food picking flow: BullMQ, Redis distributed lock, auto-pick
- `docs/shared/notification-flow.md` — Notifications participants receive (Firebase, OneSignal, Email)
- `docs/shared/auth-flow.md` — Authentication and session management
