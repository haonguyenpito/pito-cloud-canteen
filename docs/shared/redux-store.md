# Redux Store

## Store Configuration

**File:** `src/redux/store.ts`

- **Middleware:** Redux Toolkit's default middleware with `serializableCheck` disabled (Sharetribe SDK objects are non-serializable)
- **Extra argument:** The Sharetribe SDK instance is injected as `extraArgument` in the middleware, making it available in all thunk action creators via `thunkAPI.extra`
- **DevTools:** Enabled in development

---

## Critical Slices (Read First)

| Slice             | File                                        | What It Manages                                                                            |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `auth`            | `src/redux/slices/auth.slice.ts`            | Authentication state — whether user is logged in, login/logout thunks, session tokens      |
| `user`            | `src/redux/slices/user.slice.ts`            | Current user profile — Sharetribe currentUser entity, roles, metadata, `isAdmin` flag      |
| `Order`           | `src/redux/slices/Order.slice.ts`           | Active order being viewed/managed — order listing data, plan data, quotation, participants |
| `OrderManagement` | `src/redux/slices/OrderManagement.slice.ts` | Admin order list — paginated order listing, filters, bulk state updates                    |

---

## All Redux Slices (54 total)

### Core Application Slices

| Slice Name          | File                         | State Managed                                                                     |
| ------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `auth`              | `auth.slice.ts`              | Auth state, login/logout                                                          |
| `user`              | `user.slice.ts`              | Current user profile and metadata                                                 |
| `Order`             | `Order.slice.ts`             | Active order + plan + quotation                                                   |
| `OrderManagement`   | `OrderManagement.slice.ts`   | Admin order list with filters                                                     |
| `shoppingCart`      | `shoppingCart.slice.ts`      | Participant food cart: `{ [userId]: { [planId]: { [dayTimestamp]: CartItem } } }` |
| `Quiz`              | `Quiz.slice.ts`              | New order creation wizard multi-step state                                        |
| `Notification`      | `notification.slice.ts`      | User notification feed                                                            |
| `notificationPopup` | `notificationPopup.slice.ts` | In-app popup notification queue                                                   |
| `UI`                | `UI.slice.ts`                | Global UI state — modals, sidebars, loading indicators                            |
| `SystemAttributes`  | `systemAttributes.slice.ts`  | System-wide settings (VAT rates, etc.)                                            |
| `marketplaceData`   | `marketplaceData.slice.ts`   | Marketplace-wide data from Sharetribe                                             |
| `scanner`           | `scanner.slice.ts`           | QR scanner mode state (plan-level toggle)                                         |
| `walkthrough`       | `walkthrough.slice.ts`       | App onboarding walkthrough progress                                               |
| `uploadImage`       | `uploadImage.slice.ts`       | Image upload progress tracking                                                    |
| `password`          | `password.slice.ts`          | Password reset/change flow state                                                  |
| `emailVerification` | `emailVerification.slice.ts` | Email verification state                                                          |

### Restaurant & Food Slices

| Slice Name             | File                            | State Managed                           |
| ---------------------- | ------------------------------- | --------------------------------------- |
| `foods`                | `foods.slice.ts`                | Food catalog items                      |
| `menus`                | `menus.slice.ts`                | Menu listings                           |
| `partners`             | `partners.slice.ts`             | Restaurant partner list                 |
| `RestaurantSearch`     | `RestaurantSearch.slice.ts`     | Restaurant search filters and results   |
| `SelectRestaurantPage` | `SelectRestaurantPage.slice.ts` | Restaurant selection page UI state      |
| `Favorite`             | `Favorite.slice.ts`             | Favorited restaurants/foods             |
| `Calendar`             | `Calendar.slice.ts`             | Calendar view data for order scheduling |

### Company / Booker Slices

| Slice Name           | File                           | State Managed                        |
| -------------------- | ------------------------------ | ------------------------------------ |
| `company`            | `company.slice.ts`             | Current company details              |
| `BookerCompanies`    | `BookerCompanies.slice.ts`     | List of companies the booker manages |
| `companyInvitation`  | `companyInvitation.slice.ts`   | Pending company invitations          |
| `companyMember`      | `companyMember.slice.ts`       | Company member list and management   |
| `priceQuotation`     | `priceQuotation.slice.ts`      | Quotation data for price breakdowns  |
| `adminReviews`       | `Reviews.admin.slice.ts`       | Review data for admin view           |
| `participantReviews` | `Reviews.participant.slice.ts` | Participant's review history         |
| `partnerReviews`     | `Reviews.partner.slice.ts`     | Partner's review responses           |

### Page-Scoped Slices (Admin)

| Slice Name                  | File (under `src/pages/`)                                  | State Managed                            |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `AdminAttributes`           | `admin/AdminAttributes.slice.ts`                           | Admin attribute management               |
| `AdminManageOrder`          | `admin/order/AdminManageOrder.slice.ts`                    | Admin order management page state        |
| `adminManagePartnersMenus`  | `admin/partner/pending-menus/ManagePartnersMenus.slice.ts` | Pending partner menus queue              |
| `AdminManageClientPayments` | `admin/payment-client/AdminManageClientPayments.slice.ts`  | Client payment records and confirmation  |
| `PaymentPartner`            | `admin/payment-partner/PaymentPartner.slice.ts`            | Partner payment records and confirmation |

### Page-Scoped Slices (Company/Booker)

| Slice Name               | File (under `src/pages/`)                                                           | State Managed                     |
| ------------------------ | ----------------------------------------------------------------------------------- | --------------------------------- |
| `Nutrition`              | `company/[companyId]/nutrition/Nutrition.slice.ts`                                  | Nutrition tracking analytics      |
| `BookerDraftOrderPage`   | `company/booker/orders/draft/[orderId]/BookerDraftOrderPage.slice.ts`               | Draft order editing page state    |
| `BookerSelectRestaurant` | `company/booker/orders/draft/[orderId]/restaurants/BookerSelectRestaurant.slice.ts` | Restaurant selection during draft |
| `BookerNewOrderPage`     | `company/booker/orders/new/BookerNewOrder.slice.ts`                                 | New order wizard navigation state |
| `OrderRating`            | `company/orders/[orderId]/rating/OrderRating.slice.ts`                              | Order rating submission form      |

### Page-Scoped Slices (Participant)

| Slice Name                       | File (under `src/pages/`)                                 | State Managed                         |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| `ParticipantOrderManagementPage` | `participant/ParticipantOrderManagementPage.slice.ts`     | Participant order management page     |
| `ParticipantOrderList`           | `participant/orders/OrderList.slice.ts`                   | Participant's order list with filters |
| `ParticipantPlanPage`            | `participant/plans/[planId]/ParticipantPlanPage.slice.ts` | Plan detail page state                |
| `ParticipantSubOrderList`        | `participant/sub-orders/SubOrders.slice.ts`               | Participant sub-order history         |

### Page-Scoped Slices (Partner/Restaurant)

| Slice Name              | File (under `src/pages/`)                                    | State Managed                   |
| ----------------------- | ------------------------------------------------------------ | ------------------------------- |
| `PartnerDashboard`      | `partner/Dashboard.slice.ts`                                 | Partner dashboard metrics       |
| `PartnerSubOrderDetail` | `partner/orders/[subOrderId]/PartnerSubOrderDetail.slice.ts` | Sub-order detail (partner view) |
| `PartnerManageOrders`   | `partner/orders/ManageOrders.slice.ts`                       | Partner's order queue           |
| `PartnerManagePayments` | `partner/payments/PartnerManagePayments.slice.ts`            | Partner payment history         |
| `PartnerFood`           | `partner/products/food/PartnerFood.slice.ts`                 | Partner food catalog management |
| `PartnerManageMenus`    | `partner/products/menu/PartnerManageMenus.slice.ts`          | Partner menu management         |
| `ManageReviews`         | `partner/reviews/ManageReviews.slice.ts`                     | Partner review management       |
| `PartnerSettingsPage`   | `partner/settings/PartnerSettings.slice.ts`                  | Partner account settings        |

### Other Page-Scoped Slices

| Slice Name     | File (under `src/pages/`)                     | State Managed               |
| -------------- | --------------------------------------------- | --------------------------- |
| `TrackingPage` | `tracking/[subOrderId]/TrackingPage.slice.ts` | Live delivery tracking page |

---

## Notes for AI/Developers

1. **SDK in thunks:** Access the Sharetribe SDK in any async thunk via `thunkAPI.extra` — no need to import the SDK directly in slice files.

2. **Serialization disabled:** The store skips serialization checks (`serializableCheck: false`). This means Sharetribe SDK response objects (which have non-serializable UUID types) can be stored directly. Don't rely on Redux DevTools time-travel for Sharetribe entities.

3. **Page-scoped slices:** Many slices live inside `src/pages/` rather than `src/redux/slices/`. They follow the same RTK slice pattern but are co-located with the page that owns them. All are registered in the root reducer via the central index.

4. **Shopping cart shape:** The `shoppingCart` slice is keyed by `userId → planId → dayTimestamp`. This supports admin users viewing multiple participants' carts simultaneously without collision.

5. **`Quiz` slice:** Holds multi-step form state for the new order creation wizard at `/company/booker/orders/new/quiz/*`. State is cleared after successful order creation.
