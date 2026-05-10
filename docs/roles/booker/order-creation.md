# Booker — Order Creation & Setup

## Overview

An "order" is a date-range meal plan (e.g., lunch Mon–Fri for March). The booker creates the order via a multi-step quiz wizard, sets it up, then publishes it so participants can pick their food.

---

## Data Model (Quick Reference)

| Listing Type  | Purpose                                       | Key Metadata                                                                                                                              |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `order`       | Master order record                           | `companyId`, `bookerId`, `orderState`, `startDate`, `endDate`, `deliveryHour`, `participants[]`, `partnerIds[]`, `quotationId`, `plans[]` |
| `sub-order` (plan) | Per-order daily plan with food selections | `orderDetail: { [timestamp]: { restaurant, memberOrders: { [userId]: { foodId, requirement } }, transactionId, lastTransition } }`    |
| `quotation`   | Price breakdown per partner per date          | Linked via `order.metadata.quotationId`                                                                                                   |

All order data lives in **Sharetribe listings** (not a traditional database).

---

## Step 1: Order Creation — Quiz Wizard

**URL:** `/company/booker/orders/new/quiz/*`

**Redux slice:** `Quiz` (`src/redux/slices/Quiz.slice.ts`)

The wizard steps:

1. Select company
2. Set delivery address + date range + meal time
3. Set participant list
4. Browse and select restaurants (filters: nutrition, menu type, distance, day availability)
5. Review and submit

Restaurant search is powered by Sharetribe listing queries with filters defined in `src/marketplaceConfig.ts`.

**API:** `POST /api/orders`

**What happens on submit:**

1. `createOrder` creates an Order listing in Sharetribe (Integration SDK, authored by sub-account)
2. `createPlan` creates a Plan (sub-order) listing linked to the order
3. AWS EventBridge schedulers are created:
   - Auto-start order at `startDate + deliveryHour` → `AUTOMATIC_START_ORDER_JOB_LAMBDA_ARN`
   - Participant deadline reminder → `LAMBDA_ARN`
4. Order state: `bookerDraft` (booker-created) or `draft` (admin-created)

**Key files:**

- `src/pages/api/orders/index.api.ts`
- `src/pages/api/orders/create.service.ts`
- `src/services/awsEventBrigdeScheduler.ts`

---

## Restaurant Browsing — Food Price Display

When a booker browses restaurants (Step 4 of the quiz wizard), the food items shown in each restaurant card ("Lựa chọn phù hợp" / "Menu tham khảo") display the **final price** (`base + extraFee`).

The budget filter (`packagePerMember`) also compares against the final price — a food with base 75,000 + extra fee 25,000 matches a 100,000 VND/person budget.

**Source:** `src/helpers/searchRestaurantHelper.ts` → `parseFoodsFromMenu`

---

## Step 2: Order Setup

Booker or admin fills in:

- Restaurant assignments per date
- Default food selections per participant
- Quotation (price per partner per date)

**Quotation API:** `POST /api/orders/:orderId/quotation`

The quotation is the **source of truth** for all payment calculations. Do not overwrite a finalized quotation after payment initialization.

If the order was created as `bookerDraft`, the booker must submit it for admin approval (`pendingApproval`) before setup can be finalized.

---

## Step 3: Publish to Picking Phase

**Trigger:** Admin or booker clicks "Publish Order"

**API:** `POST /api/orders/:orderId/publish-order`

**What happens:**

1. Order state → `picking`
2. Firebase notification sent to all participants (`ORDER_PICKING`)
3. OneSignal push notification sent

**Schedulers created at this step:**

- `upsertPickFoodForEmptyMembersScheduler` — fires at food selection deadline; Lambda auto-fills empty slots if `order.metadata.isAutoPickFood === true` → `PICK_FOOD_FOR_EMPTY_MEMBER_LAMBDA_ARN`
- `sendRemindPickingNativeNotificationToBookerScheduler` — fires `N` minutes before deadline to remind booker → `SEND_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_LAMBDA_ARN`

---

## Cancel Flow (Pre-inProgress)

Orders can be canceled before they reach `inProgress`:

| Cancel Type             | State                             | API                                                      |
| ----------------------- | --------------------------------- | -------------------------------------------------------- |
| Booker cancel           | `draft` or `picking`              | `PUT /api/orders/:orderId/cancel-order-by-booker`        |
| Cancel picking          | `picking` → `draft` or `canceled` | `PUT /api/orders/:orderId/cancel-picking-order`          |
| Cancel pending approval | `pendingApproval` → `draft`       | `PUT /api/orders/:orderId/cancel-pending-approval-order` |
| Admin cancel            | Any pre-`inProgress` state        | `PUT /api/admin/listings/order/:orderId/update-state`    |
