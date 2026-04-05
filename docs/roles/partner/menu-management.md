# Partner — Menu & Food Management

## Overview

Partners manage their food catalog and menus through the partner portal. All new food items and menus require admin approval before becoming active.

---

## Food Item Lifecycle

```
Partner creates food item → state: pending
    │
    ├──► Admin approves → state: accepted
    │    Partner notified: Firebase PARTNER_FOOD_ACCEPTED_BY_ADMIN
    │                      OneSignal AdminTransitFoodStateToApprove
    │
    └──► Admin rejects → state: rejected
         Partner notified: Firebase PARTNER_FOOD_REJECTED_BY_ADMIN
                           OneSignal AdminTransitFoodStateToReject
```

**Admin API:** `PUT /api/admin/listings/food/:foodId/update-state`

---

## Menu Lifecycle

```
Partner creates/updates menu → state: draft
    │
    ▼
Partner submits for approval → state: pending
    │    Slack alert to admin: SLACK_PARTNER_WEBHOOK_URL
    │                          (PARTNER_MENU_PUBLISHED_DRAFT_TO_PENDING)
    │
    ├──► Admin approves → state: published
    │    Partner notified: Firebase PARTNER_MENU_APPROVED_BY_ADMIN
    │                      OneSignal AdminApprovePartnerMenu
    │                      Slack ADMIN_APPROVE_PARTNER_MENU
    │                      Email PARTNER_MENU_APPROVED
    │
    └──► Admin rejects → state: rejected
         Partner notified: Firebase PARTNER_MENU_REJECTED_BY_ADMIN
                           OneSignal AdminRejectPartnerMenu
                           Slack ADMIN_REJECT_PARTNER_MENU
                           Email PARTNER_MENU_REJECTED
```

**Admin API:** `PUT /api/admin/listings/menu/:menuId/update-state`

---

## Admin Acting on Behalf of Partner

Admin can create and edit food items and menus directly on a partner's behalf. When admin does this, the partner is notified:

- Food created by admin → `PARTNER_FOOD_CREATED_BY_ADMIN` (Firebase)
- Menu created by admin → `PARTNER_MENU_CREATED_BY_ADMIN` (Firebase)
- Profile edited by admin → `PARTNER_PROFILE_UPDATED_BY_ADMIN` (Firebase)

---

## Partner Portal Pages

| Page     | URL                          | Function                                 |
| -------- | ---------------------------- | ---------------------------------------- |
| Orders   | `/partner/orders/*`          | View and manage sub-order queue          |
| Products | `/partner/products/food/*`   | Food catalog: add, edit, submit for approval |
| Menus    | `/partner/products/menu/*`   | Menu management: create, submit for approval |
| Payments | `/partner/payments/*`        | View payment history                     |
| Reviews  | `/partner/reviews/*`         | View ratings, submit replies             |
| Settings | `/partner/settings/*`        | Account info, profile                    |
