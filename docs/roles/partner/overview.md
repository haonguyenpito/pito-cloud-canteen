# Partner (Restaurant) Role — Overview

## What Partners Do

Partners are restaurants that fulfill meal orders. They:

- Submit food items and menus for admin approval
- Confirm or reject sub-orders assigned to them
- Manage delivery and mark sub-orders as delivered
- Respond to participant reviews

---

## Portal

**URL prefix:** `/partner/*`

Identified by `currentUser.attributes.profile.publicData.userType === 'partner'`.

Partners begin as `draft` in Sharetribe and must be published by admin before appearing in restaurant search.

---

## Partner Redux Slices

| Slice                   | File                                                          | State Managed                    |
| ----------------------- | ------------------------------------------------------------- | -------------------------------- |
| `PartnerManageOrders`   | `src/pages/partner/orders/ManageOrders.slice.ts`              | Partner's order queue            |
| `PartnerSubOrderDetail` | `src/pages/partner/orders/[subOrderId]/PartnerSubOrderDetail.slice.ts` | Sub-order detail view   |
| `PartnerFood`           | `src/pages/partner/products/food/PartnerFood.slice.ts`        | Food catalog management          |
| `PartnerManageMenus`    | `src/pages/partner/products/menu/PartnerManageMenus.slice.ts` | Menu management                  |
| `PartnerManagePayments` | `src/pages/partner/payments/PartnerManagePayments.slice.ts`   | Payment history                  |
| `ManageReviews`         | `src/pages/partner/reviews/ManageReviews.slice.ts`            | Review management                |
| `PartnerSettingsPage`   | `src/pages/partner/settings/PartnerSettings.slice.ts`         | Account settings                 |
| `PartnerDashboard`      | `src/pages/partner/Dashboard.slice.ts`                        | Dashboard metrics                |
| `partnerReviews`        | `src/redux/slices/Reviews.partner.slice.ts`                   | Partner review responses         |

---

## Key Docs

- `docs/roles/partner/sub-order-flow.md` — Sub-order confirm/reject/deliver lifecycle
- `docs/roles/partner/menu-management.md` — Food and menu submission, approval process
- `docs/shared/transaction-flow.md` — Sharetribe transaction state machine (admin-driven)
- `docs/shared/notification-flow.md` — Notifications partners receive
