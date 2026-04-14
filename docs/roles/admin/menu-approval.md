# Admin — Menu, Food, Company & Partner Management

## Menu Approval Workflow

Partners submit menus in `pending` state. Admin approves or rejects.

```
Partner submits menu
    │
    ▼
Menu state: pending
    │
    ├──► Admin approves → state: published
    │    Notifications: Firebase PARTNER_MENU_APPROVED_BY_ADMIN,
    │                   OneSignal AdminApprovePartnerMenu,
    │                   Slack ADMIN_APPROVE_PARTNER_MENU (→ SLACK_PARTNER_WEBHOOK_URL),
    │                   Email PARTNER_MENU_APPROVED
    │
    └──► Admin rejects → state: rejected
         Notifications: Firebase PARTNER_MENU_REJECTED_BY_ADMIN,
                        OneSignal AdminRejectPartnerMenu,
                        Slack ADMIN_REJECT_PARTNER_MENU (→ SLACK_PARTNER_WEBHOOK_URL),
                        Email PARTNER_MENU_REJECTED
```

**Admin API:** `PUT /api/admin/listings/menu/:menuId/update-state`

---

## Food Approval Workflow

Partners submit new food items for review before they appear on menus.

```
Partner creates food item (state: pending)
    │
    ├──► Admin approves → state: accepted
    │    Notifications: Firebase PARTNER_FOOD_ACCEPTED_BY_ADMIN,
    │                   OneSignal AdminTransitFoodStateToApprove
    │
    └──► Admin rejects → state: rejected
         Notifications: Firebase PARTNER_FOOD_REJECTED_BY_ADMIN,
                        OneSignal AdminTransitFoodStateToReject
```

**Admin API:** `PUT /api/admin/listings/food/:foodId/update-state`

---

## Company Management

**Admin can:**

- Create companies: `POST /api/admin/company`
- Update company details: `PUT /api/admin/listings/company/:companyId/update`
- Add/remove company members (participants)
- Set company permissions (e.g., `isAutoPickFood`, `isQrScannerMode`)
- Transfer company ownership to another member

**QR Scanner Mode:** `isQrScannerMode` is a plan-level flag on the company. When enabled, participant food selection switches from the web form to QR-code scanning at meal handover. Controlled via `scanner` Redux slice (`src/redux/slices/scanner.slice.ts`).

---

## Partner Management

Partners begin as `draft` and must be published before appearing in restaurant search.

```
Admin creates partner → state: draft
    │
    └──► Admin publishes → state: published
         Partner appears in restaurant search results
```

**Admin can also:**

- Edit partner profile → sends `PARTNER_PROFILE_UPDATED_BY_ADMIN` Firebase notification
- Create/edit food items on behalf of partners → sends `PARTNER_FOOD_CREATED_BY_ADMIN`
- Create/edit menus on behalf of partners → sends `PARTNER_MENU_CREATED_BY_ADMIN`

**Admin API:** `PUT /api/admin/listings/partner/:partnerId/update-state`
