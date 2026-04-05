# Notification Flow

## Overview

Every significant order event fires notifications across **four independent channels** simultaneously. There is no coordinator — each channel fires independently. If one fails (e.g., OneSignal API error), the others still succeed. There is no rollback or consistency guarantee across channels.

```
Order Event
    │
    ├──► Firebase Firestore    (in-app notification feed)
    ├──► OneSignal             (mobile/browser push)
    ├──► Slack                 (internal ops alerts)
    └──► AWS SES Email         (transactional emails)
```

---

## Channel 1: Firebase Firestore Notifications

**File:** `src/services/notifications.ts`
**Collection:** env var `FIREBASE_NOTIFICATION_COLLECTION_NAME`

Firestore notifications power the in-app notification bell/feed visible in each portal. Each document has a `relatedLink` field that the UI uses to navigate to the relevant screen.

### Document Structure

```typescript
{
  userId: string                    // recipient
  notificationType: ENotificationType
  isNew: boolean                    // unread indicator
  relatedLink: string               // deep link to portal screen
  createdAt: Date
  // Type-specific context fields:
  bookerName?: string
  companyName?: string
  orderTitle?: string
  orderId?: string
  subOrderDate?: string
  planId?: string
  foodName?: string
  menuId?: string
  menuName?: string
  transition?: string
  startDate?: string
  endDate?: string
  oldOrderDetail?: object           // for order change diffs
  newOrderDetail?: object
  reviewerId?: string
  partnerName?: string
  subOrderName?: string
}
```

### ENotificationType — All 31 Values

| Value                                | Recipient   | Trigger                                        |
| ------------------------------------ | ----------- | ---------------------------------------------- |
| `INVITATION`                         | Participant | Invited to join a company                      |
| `COMPANY_JOINED`                     | Booker      | New participant joined company                 |
| `ORDER_SUCCESS`                      | Participant | Sub-order delivery completed                   |
| `ORDER_CANCEL`                       | Participant | Sub-order canceled                             |
| `ORDER_DELIVERING`                   | Participant | Sub-order is now delivering                    |
| `ORDER_PICKING`                      | Participant | Order published — can now pick food            |
| `ORDER_RATING`                       | Participant | Prompted to rate sub-order                     |
| `SUB_ORDER_UPDATED`                  | Participant | Sub-order details changed                      |
| `SUB_ORDER_INPROGRESS`               | Participant | Sub-order started                              |
| `SUB_ORDER_CANCELED`                 | Participant | Sub-order canceled (partner/admin)             |
| `SUB_ORDER_DELIVERED`                | Participant | Sub-order delivered                            |
| `SUB_ORDER_DELIVERING`               | Participant | Sub-order out for delivery                     |
| `SUB_ORDER_REVIEWED_BY_BOOKER`       | Participant | Booker submitted review                        |
| `SUB_ORDER_REVIEWED_BY_PARTICIPANT`  | Participant | Participant submitted review                   |
| `PARTNER_MENU_CREATED_BY_ADMIN`      | Partner     | Admin created a menu on their behalf           |
| `PARTNER_FOOD_CREATED_BY_ADMIN`      | Partner     | Admin created a food item on their behalf      |
| `PARTNER_PROFILE_UPDATED_BY_ADMIN`   | Partner     | Admin edited partner profile                   |
| `PARTNER_FOOD_ACCEPTED_BY_ADMIN`     | Partner     | Submitted food approved                        |
| `PARTNER_FOOD_REJECTED_BY_ADMIN`     | Partner     | Submitted food rejected                        |
| `PARTNER_MENU_APPROVED_BY_ADMIN`     | Partner     | Submitted menu approved                        |
| `PARTNER_MENU_REJECTED_BY_ADMIN`     | Partner     | Submitted menu rejected                        |
| `PARTNER_SUB_ORDER_CHANGED`          | Partner     | Sub-order assignment changed                   |
| `BOOKER_NEW_ORDER_CREATED`           | Booker      | Admin created a new order for company          |
| `BOOKER_SUB_ORDER_COMPLETED`         | Booker      | Sub-order completed                            |
| `BOOKER_SUB_ORDER_CANCELLED`         | Booker      | Sub-order canceled                             |
| `BOOKER_ORDER_CHANGED`               | Booker      | Order details updated                          |
| `BOOKER_RATE_ORDER`                  | Booker      | Prompted to rate completed order               |
| `BOOKER_PICKING_ORDER`               | Booker      | Order entered picking phase                    |
| `ADMIN_REPLY_REVIEW`                 | Participant | Admin replied to their review                  |
| `ADMIN_APPROVE_PARTNER_REPLY_REVIEW` | Participant | Admin approved partner's reply to their review |
| `PARTNER_REPLY_REVIEW`               | Participant | Partner replied to their review                |

---

## Channel 2: OneSignal Push Notifications

**File:** `src/services/nativeNotification.ts`
**Device ID storage:** `currentUser.privateData.oneSignalUserIds[]` (array — one user can have multiple devices)

Sends mobile/browser push notifications. On logout, the device ID is removed from the array to stop notifications to that device.

### ENativeNotificationType — 18 Values (Participant/Partner audience)

| Value                                 | Target                | Deep Link Pattern                                                             |
| ------------------------------------- | --------------------- | ----------------------------------------------------------------------------- |
| `BookerTransitOrderStateToPicking`    | Participant           | `/participant/order/{orderId}/?subOrderDate={startDate}&viewMode=week`        |
| `BookerTransitOrderStateToInProgress` | Participant + Partner | `/participant/order/{orderId}/?subOrderDate={startDate}&viewMode=week`        |
| `AdminTransitSubOrderToDelivered`     | Participant           | `/participant/orders/?planId={planId}&timestamp={subOrderDate}&viewMode=week` |
| `AdminTransitSubOrderToCanceled`      | Participant + Partner | `/participant/orders/?planId={planId}&timestamp={subOrderDate}&viewMode=week` |
| `TransitOrderStateToCanceled`         | Participant + Partner | `/participant/orders/?planId={planId}&timestamp={startDate}&viewMode=week`    |
| `AdminTransitFoodStateToApprove`      | Partner               | `/partner/products/food/{foodId}/?fromTab=accepted`                           |
| `AdminTransitFoodStateToReject`       | Partner               | `/partner/products/food/{foodId}/?fromTab=accepted`                           |
| `AdminUpdateOrder`                    | Partner               | _(order detail page)_                                                         |
| `AdminChangePartnerInformation`       | Partner               | `/partner/settings/account/info`                                              |
| `PartnerTransitOrderToCanceled`       | Partner               | _(order list)_                                                                |
| `PartnerEditSubOrder`                 | Partner               | _(sub-order detail)_                                                          |
| `PartnerSubOrderNegativeRating`       | Partner               | `/partner/reviews?rating=1,2`                                                 |
| `AdminReplyReview`                    | Participant           | `/participant/sub-orders?tab=rating-history`                                  |
| `AdminApprovePartnerReplyReview`      | Participant           | `/participant/sub-orders?tab=rating-history`                                  |
| `AdminApprovePartnerMenu`             | Partner               | `/partner/products/menu/{menuId}`                                             |
| `AdminRejectPartnerMenu`              | Partner               | `/partner/products/menu/{menuId}`                                             |
| `Events`                              | Participant           | `/participant/events/mens-day`                                                |
| `Tet2026`                             | Participant           | `/participant/events/tet-2026/{companyId}`                                    |

### EBookerNativeNotificationType — 7 Values (Booker audience)

| Value                   | Deep Link Pattern                                        | Trigger                                 |
| ----------------------- | -------------------------------------------------------- | --------------------------------------- |
| `AdminCreateNewOrder`   | `/company/booker/orders/draft/{orderId}?userRole=booker` | Admin created order for company         |
| `AdminStartOrder`       | `/company/orders/{orderId}?userRole=booker`              | Order started                           |
| `RemindBeforeDeadline`  | `/company/orders/{orderId}?userRole=booker`              | Reminder before food selection deadline |
| `SubOrderCancelled`     | `/company/orders/{orderId}?userRole=booker`              | Sub-order canceled                      |
| `SubOrderDelivering`    | `/company/orders/{orderId}?userRole=booker`              | Sub-order out for delivery              |
| `SubOrderDelivered`     | `/company/orders/{orderId}?userRole=booker`              | Sub-order delivered                     |
| `OrderIsPendingPayment` | `/company/orders/{orderId}/rating?userRole=booker`       | Order awaiting payment confirmation     |

---

## Channel 3: Slack Internal Alerts

**File:** `src/services/slackNotification.ts`
**Master toggle:** `SLACK_WEBHOOK_ENABLED === 'true'` — setting to `'false'` disables all Slack notifications globally.

Slack notifications go to 5 different webhook channels. Some support rich block formatting and threaded replies.

### ESlackNotificationType — All 21 Values with Channel Routing

| Value                                     | Webhook Env Var                        | Trigger                                     |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------- |
| `CREATE_NEW_FOOD`                         | `SLACK_WEBHOOK_URL`                    | New food item created by partner            |
| `UPDATE_FOOD`                             | `SLACK_WEBHOOK_URL`                    | Food item updated                           |
| `ORDER_STATUS_CHANGES_TO_IN_PROGRESS`     | `SLACK_WEBHOOK_URL`                    | Order transitions to in-progress            |
| `DELIVERY_AGENT_IMAGES_UPLOADED`          | `SLACK_WEBHOOK_URL`                    | Delivery agent uploads proof photos         |
| `PARTICIPANT_GROUP_ORDER_FOOD_CHANGED`    | `SLACK_WEBHOOK_URL`                    | Participant changes food in group order     |
| `PARTICIPANT_NORMAL_ORDER_FOOD_CHANGED`   | `SLACK_WEBHOOK_URL`                    | Participant changes food in normal order    |
| `SUB_ORDER_CANCELED`                      | `SLACK_WEBHOOK_URL`                    | Sub-order canceled                          |
| `RESTAURANT_CHANGED`                      | `SLACK_WEBHOOK_URL`                    | Restaurant swapped in order                 |
| `PARTNER_CONFIRMS_SUB_ORDER`              | `SLACK_WEBHOOK_URL`                    | Restaurant confirms sub-order               |
| `PARTNER_REJECTS_SUB_ORDER`               | `SLACK_WEBHOOK_URL`                    | Restaurant rejects sub-order                |
| `PARTICIPANT_RATING`                      | `SLACK_RATING_WEBHOOK_URL`             | Participant submits food rating — message includes company name: `[${userTypeData.label} - *${companyName}*]` |
| `PARTICIPANT_ORDER_PERSISTENCE_FAILED`    | `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` | BullMQ job failed to persist food selection |
| `PARTNER_REPLY_REVIEW`                    | `SLACK_RATING_WEBHOOK_URL`             | Partner replies to review                   |
| `ADMIN_REPLY_REVIEW`                      | `SLACK_RATING_WEBHOOK_URL`             | Admin replies to review                     |
| `ADMIN_APPROVE_PARTNER_REPLY_REVIEW`      | `SLACK_RATING_WEBHOOK_URL`             | Admin approves partner reply                |
| `PARTNER_MENU_PUBLISHED_DRAFT_TO_PENDING` | `SLACK_PARTNER_WEBHOOK_URL`            | Partner submits menu for approval           |
| `ADMIN_APPROVE_PARTNER_MENU`              | `SLACK_PARTNER_WEBHOOK_URL`            | Admin approves partner menu                 |
| `ADMIN_REJECT_PARTNER_MENU`               | `SLACK_PARTNER_WEBHOOK_URL`            | Admin rejects partner menu                  |
| `PARTICIPANT_PLACE_ORDER_FAILED`          | `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` | Food selection persistence error (critical) |
| `HANDOVER_FOOD_CHECKLIST_CREATED`         | `SLACK_OPERATION_WEBHOOK_URL`          | Delivery handover checklist created         |
| `HANDOVER_FOOD_CHECKLIST`                 | `SLACK_OPERATION_WEBHOOK_URL`          | Handover checklist signed off               |

#### `PARTICIPANT_RATING` Message Format

The rating notification block text format (as of PR #302/#303):

```
[${userTypeData.label} - *${companyName}*] ${ratingUserName} đã đánh giá...
```

`participantRatingData` in `SlackNotificationParams` requires:

```typescript
{
  ratingUserName: string
  userType: string        // maps to userTypeData.label
  companyName: string     // added in PR #302 — company of the reviewer
  // ...other rating fields
}
```

### Webhook Channel Summary

| Env Var                                | Channel Purpose                                                  |
| -------------------------------------- | ---------------------------------------------------------------- |
| `SLACK_WEBHOOK_URL`                    | Main ops — order status, food changes, restaurant actions        |
| `SLACK_RATING_WEBHOOK_URL`             | Reviews — ratings, replies, approvals                            |
| `SLACK_PARTNER_WEBHOOK_URL`            | Partner ops — menu submissions and decisions                     |
| `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` | **Critical** — food selection persistence failures (page-worthy) |
| `SLACK_OPERATION_WEBHOOK_URL`          | Operations — food handover checklists                            |

---

## Channel 4: AWS SES Transactional Email

**File:** `src/services/email.ts`
**Sender:** "PITO Cloud Canteen"
**Config keys:** `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_SES_REGION`

Emails are dispatched via `emailSendingFactory`. Three separate enums serve three distinct audiences.

### EmailTemplateForBookerTypes — 9 Templates

| Template                       | Trigger                                 |
| ------------------------------ | --------------------------------------- |
| `BOOKER_ACCOUNT_CREATED`       | New booker account created              |
| `BOOKER_ACCOUNT_SUSPENDED`     | Booker account suspended                |
| `BOOKER_ORDER_CREATED`         | New order created                       |
| `BOOKER_ORDER_PICKING`         | Order enters picking phase              |
| `BOOKER_ORDER_SUCCESS`         | Order completed successfully            |
| `BOOKER_SUB_ORDER_CANCELED`    | A sub-order was canceled                |
| `BOOKER_REVENUE_ANALYTICS`     | Revenue analytics report                |
| `BOOKER_ORDER_CANCELLED`       | Full order canceled                     |
| `BOOKER_PICKING_ORDER_CHANGED` | Food selections modified during picking |

### EmailTemplateForParticipantTypes — 5 Templates

| Template                            | Trigger                                |
| ----------------------------------- | -------------------------------------- |
| `PARTICIPANT_COMPANY_INVITATION`    | Invited to join a company              |
| `PARTICIPANT_ORDER_PICKING`         | Order entered picking phase            |
| `PARTICIPANT_SUB_ORDER_CANCELED`    | A sub-order was canceled               |
| `PARTICIPANT_PICKING_ORDER_CHANGED` | Food selections changed during picking |
| `PARTICIPANT_REVIEW_REPLY`          | Admin or partner replied to review     |

### EmailTemplateForPartnerTypes — 5 Templates

| Template                        | Trigger                                  |
| ------------------------------- | ---------------------------------------- |
| `PARTNER_NEW_ORDER_APPEAR`      | Assigned to a new sub-order              |
| `PARTNER_SUB_ORDER_CANCELED`    | Assigned sub-order canceled              |
| `PARTNER_ORDER_DETAILS_UPDATED` | Order details (food, quantities) updated |
| `PARTNER_MENU_APPROVED`         | Submitted menu approved by admin         |
| `PARTNER_MENU_REJECTED`         | Submitted menu rejected by admin         |

---

## Key Risk: No Notification Coordinator

All four channels fire independently from the same API handler (or service call). There is no transactional wrapper:

```typescript
// Typical pattern at a transition point:
await sendFirebaseNotification(...)   // Channel 1
await sendOneSignalNotification(...)  // Channel 2
await sendSlackNotification(...)      // Channel 3
await sendEmail(...)                  // Channel 4
```

**Consequence:** If channel 2 throws, channels 3 and 4 still execute. If the process crashes after channel 1, channels 2–4 are never sent. There is no retry queue for failed notifications, no deduplication guard, and no compensating transaction. Monitor `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` for signs of partial notification delivery in critical paths.
