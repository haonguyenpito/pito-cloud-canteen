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

## Bulk Extra Fee — "Thêm phụ phí" (Pending Menu List)

**Screen:** `/admin/partner/pending-menus`

**File:** `src/pages/admin/partner/pending-menus/ManagePartnersMenus.page.tsx`

The fee is stored on the MENU (`publicData.foodExtraFees`, keyed by foodId), so
the same dish keeps its own fee in every other menu. Nothing here writes to food
listings.

**Bulk — one fee for every dish in the selected menus:**
1. Admin checks menus → "Thêm phụ phí (N)" appears in the header
2. Enters an amount → "Áp dụng"
3. `applyExtraFeeToMenus` builds `{ [foodId]: fee }` over each menu's dishes and
   `PUT`s `/admin/listings/menus/:menuId/extra-fee` per menu (mode `replace`)

**Per dish — expand the menu row:**
- The chevron opens "Phụ phí theo món": one row per dish (a dish served on
  several weekdays collapses into a single row, because the fee map is flat),
  with base price, fee input and resulting display price
- Unsaved edits are held in page state keyed by menuId, so collapsing and
  reopening keeps them; a "• chưa lưu" marker shows while they are pending
- One panel is open at a time, so at most one can hold unsaved edits
- `saveMenuExtraFees` submits the complete map (mode `replace`) — clearing a
  field means that dish is no longer surcharged

**Bulk apply inside one menu — tick dishes, one amount:**
- Each dish row carries a checkbox, plus a select-all in the table header
  (indeterminate on a partial selection). The column only renders while the menu
  is editable, matching the disabled inputs and hidden save footer
- The amount field and "Áp dụng cho N món" sit in the panel header. Applying
  **writes nothing** — `applyFeeToFoods` fills the page's draft for the ticked
  dishes in one state update, the "• chưa lưu" marker appears, and the existing
  "Lưu phụ phí" is still the only writer
- An explicit `0` is allowed and clears the surcharge on those dishes; an empty
  field keeps the button disabled. The check is `bulkAmount !== ''` and never a
  truthiness test, because `'0'` is falsy — and the field short-circuits an empty
  value instead of formatting it, since `parsePrice('')` returns `'0'`
- Selection and the amount are panel-local state, so they reset when the panel
  collapses or another menu is expanded. The applied fee **values** live in the
  page's `feeDrafts` and survive a collapse like any manual edit
- Deliberately scoped to the open menu: the fee map is flat and per-menu, so the
  same dish in another menu is a separate fee by design
- Looping the per-row `onChange` would not work — each call would rebase on the
  same stale draft and only the last dish would keep the fee. Hence one helper
  producing the whole next draft
- Pinned by the `applyFeeToFoods` block in `tests/safeguards/menu-extra-fee.test.ts`,
  including that a partial selection still leaves every dish in the `replace`
  payload

**Displaying the current fee in the list:**
- Read straight off `menu.publicData.foodExtraFees` — the list API already
  returns whole menu listings, so there is no extra fetch
- Shown in the "Phụ phí" column as a single value when every dish agrees, a
  range (`15.000đ – 20.000đ`) when they differ, or `—` when unset

**Excel export / import ("Xuất phụ phí" / "Import phụ phí"):** removed 2026-09-27
— no longer needed. The fee is set only through the bulk modal and the per-dish
panel; there is no sheet round-trip and no `extra-fee-import` / `extra-fee-export`
endpoint.

**Once approved:** the map is frozen. `updateMenuExtraFees.service.ts` rejects
writes for `published` / `closed` / `rejected` menus, and the panel renders
read-only.

**Key files:**
- `src/pages/admin/partner/pending-menus/ManagePartnersMenus.slice.ts` — `applyExtraFeeToMenus`, `saveMenuExtraFees`
- `src/pages/admin/partner/pending-menus/components/MenuExtraFeePanel/` — per-dish editor (`utils.ts` holds `buildExtraFeeRows`)
- `src/pages/admin/partner/pending-menus/components/ApplyExtraFeeModal/ApplyExtraFeeModal.tsx` — bulk fee modal
- `src/pages/api/apiServices/menu/updateMenuExtraFees.service.ts` — the only writer

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
