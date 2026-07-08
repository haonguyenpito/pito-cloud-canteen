# Plan: Range-Based PCC Service Fee per Customer

> Status: IMPLEMENTED (2026-07-08)
> Scope: Admin-configurable, per-customer (company), quantity-tiered PCC service fee, replacing the existing fixed custom-fee input. The system-wide default fee schedule (`getPCCFeeByMemberAmount`) is NOT touched.

---

## Phase 0: Documentation Discovery (DONE)

### Allowed APIs / existing patterns to copy (cite sources, do not invent)

**Form / FieldArray pattern** — copy from:
- `src/pages/admin/partner/components/FieldBankAccounts/FieldBankAccounts.tsx` (full file, 187 lines)
  - Uses `FieldArray` from `react-final-form-arrays` (`final-form-arrays@3.0.2`, `react-final-form-arrays@3.1.4` already in `package.json`)
  - `fields.push(...)` to add a row, `fields.remove(index)` to delete a row
  - Delete icon hidden on `index === 0` (`{index !== 0 && <InlineTextButton onClick={removeItem(index)}><IconDelete/></InlineTextButton>}`)
  - "Add row" button rendered after the last row (`index === fields.length - 1`)
  - Icons: `@components/Icons/IconAdd/IconAdd`, `@components/Icons/IconDelete/IconDelete`
  - Button: `InlineTextButton` from `@components/Button/Button`

**Host form already wired for arrays** — `src/pages/admin/company/components/EditCompanyOtherSettingsForm/EditCompanyOtherSettingsForm.tsx` (96 lines)
  - Already passes `mutators={{ ...arrayMutators }}` to `FinalForm` (line ~83) even though it currently has no `FieldArray` — no extra wiring needed.
  - Currently renders one `FieldTextInput` named `specificPCCFee` (lines 44-73) — **this is the field to replace**.
  - Validation today: `composeValidators(numberMinLength(msg, -1, true))` from `@src/utils/validators`.
  - Number formatting today: `parseThousandNumber` from `@helpers/format` used as both `parse` and `format`.

**Number formatting helpers** — `src/helpers/format.ts`
  - `parseThousandNumber(value, separator=',')`, `removeNonNumeric(value)`, `parseThousandNumberToInteger(value)`

**Validators to reuse/extend** — `src/utils/validators.ts`
  - `required(msg)`, `numberMinLength(msg, min, shouldPassIfEmpty)`, `numberMaxLength(msg, max, shouldPassIfEmpty)`, `composeValidators(...)`
  - Cross-field pattern precedent: `valueLessThanMax`/`valueGreaterThanMin` (lines ~566-580) and the time-range conflict validators in `src/components/FormFields/FieldAvailability/FieldAvailability.tsx` (lines 265-436) — copy the *shape* of cross-field validation (reading `allValues`), not the time-specific logic.

**i18n** — `src/translations/vi.json` / `en.json`
  - Existing keys for this form: `EditCompanyOtherSettingsForm.PCCFeeField.label` (line 465), `.min` (466), `.placeholder` (467), `.unit` (468). These will be replaced/extended with new tier-table keys (Phase 4).
  - Existing "add row" label precedent: `"FieldBankAccounts.addNewAccount": "Thêm tài khoản ngân hàng"`.

### Current system behavior (read, do not modify unless stated)

**Default fee schedule (DO NOT TOUCH)** — `src/helpers/orderHelper.ts:419-453`, `getPCCFeeByMemberAmount(memberAmount)`. Hardcoded 8-tier schedule, used whenever a company has `hasSpecificPCCFee !== true`. Out of scope per the request ("không ảnh hưởng đến Biểu phí mặc định").

**Per-customer custom fee — current fixed-value design:**
- Storage: company user's Sharetribe `metadata`: `specificPCCFee: number`, `hasSpecificPCCFee: boolean` (set together in `updateCompany.service.ts:84-92`).
- Type: `TUpdateCompanyApiParams.specificPCCFee: string` — `src/utils/types.ts:607-624`.
- Admin UI: `EditCompanyOtherSettingsForm.tsx` (see above), loaded via `EditCompanyWizard.tsx:244-259` (`specificPCCFee: User(company).getMetadata().specificPCCFee`), submitted via `EditCompanyWizard/utils.tsx:88-126` (`case COMPANY_SETTING_OTHER_TAB_ID: return { specificPCCFee }`).
- API: `PUT src/pages/api/admin/users/company/[companyId]/index.api.ts` (guarded by `adminChecker`) → `updateCompany.service.ts` → `integrationSdk.users.updateProfile()`.

**Fee calculation (the function this feature must change):**
- `calculatePCCFeeByDate({ isGroupOrder, memberOrders, lineItems, hasSpecificPCCFee, specificPCCFee })` — `src/helpers/order/cartInfoHelper.ts:200-233`.
  - Computes `memberAmountOfDate` (quantity) at lines 213-224 — for group orders, count of joined members; for non-group, sum of `lineItems[].quantity`.
  - Decision at lines 226-230: `hasSpecificPCCFee ? (memberAmountOfDate > 0 ? specificPCCFee : 0) : getPCCFeeByMemberAmount(memberAmountOfDate)`.
  - **This is the exact spot where range-tier lookup must be substituted for the flat `specificPCCFee` branch.**
- Callers that thread `hasSpecificPCCFee`/`specificPCCFee` through and must be updated to also thread the new tiers field:
  - `calculatePriceQuotationInfoFromOrder` — `cartInfoHelper.ts:235-357` (calls `calculatePCCFeeByDate` at line ~291-297; used for order management screens and payment init)
  - `calculatePriceQuotationInfoFromQuotation` — `cartInfoHelper.ts:414-537` (same fee logic, ~474-485)
  - `src/hooks/usePrepareOrderManagementData.ts:74-76` (reads `hasSpecificPCCFee`/`specificPCCFee` from company metadata, passes into the two functions above)
  - `src/pages/admin/order/ManageOrders.page.tsx:277-394` (order management table + CSV export — reads order-level snapshot, calls `calculatePCCFeeByDate`, aggregates `pccFee`/`totalPccFee`)
  - `src/pages/api/orders/[orderId]/plan/[planId]/initialize-payment.service.ts:156-188` (payment total calc, reads order's snapshot)
  - `src/pages/admin/order/StepScreen/ServiceFeesAndNotes/ServiceFeesAndNotes.tsx` (admin order-detail fee display/edit — uses `getPCCFeeByMemberAmount` + company metadata fee flags)
  - Likely also: `check-valid-payment.service.ts`, `update-payment.service.ts` (per Phase 0 research, both read the same order-level fee flags) — **must be re-verified at the start of Phase 3, not assumed**.

**Snapshot-at-order-start invariant (must be preserved):**
- `src/pages/api/orders/[orderId]/start-order.service.ts:56-76`. At order start, the company's *current* `hasSpecificPCCFee`/`specificPCCFee` are read and copied into the order's own metadata, but only if the order doesn't already have its own values (`orderHasSpecificPCCFee === undefined && orderSpecificPCCFee === undefined`). This means **once an order has started, later edits to the company's fee config never retroactively change that order.** The new tiers field must follow the exact same snapshot pattern, or in-progress orders will silently start reading live company data instead of their frozen snapshot — a correctness regression for a sensitive money-calculation path (see `docs/shared/sensitive-areas.md` Category 1).

### Confidence & gaps (carried from research agents)
- High confidence on all file paths/line numbers above (cross-verified by 2 independent research passes + 1 direct read of `cartInfoHelper.ts:180-340`, `start-order.service.ts:1-130`, `updateCompany.service.ts`, `types.ts:595-630`, `EditCompanyOtherSettingsForm.tsx`, `FieldBankAccounts.tsx`).
- Not yet directly verified (flagged for Phase 3 step 1): exact current content of `check-valid-payment.service.ts`, `update-payment.service.ts`, `ServiceFeesAndNotes.tsx` beyond the Phase-0 subagent's summary. Re-grep before editing.
- No existing range/tier UI component exists anywhere in the codebase — the tier table (Phase 4) is new code, not a copy of an existing range component. It reuses the *FieldArray mechanics* of `FieldBankAccounts.tsx`, not a pricing-specific precedent.

---

## Design Decisions (confirm before coding)

These are inferred from the request text and existing patterns — flag any disagreement before Phase 1 starts.

1. **New metadata field, additive, not destructive:** add `specificPCCFeeTiers: TPccFeeTier[]` to company metadata, alongside the existing `specificPCCFee`/`hasSpecificPCCFee`. Do **not** delete or stop writing `specificPCCFee` for companies that haven't been re-saved yet — this keeps every already-snapshotted order (which only stores `specificPCCFee`/`hasSpecificPCCFee`, no tiers) correctly replayable, and keeps existing custom-fee customers working unchanged until an admin re-saves their settings with the new table.

2. **Tier shape:**
   ```ts
   type TPccFeeTier = {
     maxQuantity: number | null; // null only allowed on the last tier = unbounded ("≥ previous tier's maxQuantity")
     price: number;
   };
   ```
   Tiers are stored as an ordered array, ascending by `maxQuantity`, last element always has `maxQuantity: null`. Range covered by tier `i` (i>0) is `(tiers[i-1].maxQuantity, tiers[i].maxQuantity]`; tier 0 covers `(0, tiers[0].maxQuantity]`. This matches the spec literally: `0 < q1: p1`, `q1 < q2: p2`, ..., last row `≥ q_{n-1}`.

3. **Lookup precedence in `calculatePCCFeeByDate`:** when `hasSpecificPCCFee` is true:
   - if `specificPCCFeeTiers` is a non-empty array → use tier lookup (new logic)
   - else if legacy `specificPCCFee` is set → use the existing flat-fee logic (back-compat for not-yet-migrated companies and already-started orders)
   - else → `0` (mirrors existing `memberAmountOfDate > 0 ? specificPCCFee : 0` shape, generalized)
   When `hasSpecificPCCFee` is false → unchanged, always `getPCCFeeByMemberAmount`.

4. **"Replace, don't add a mode toggle":** per the request ("thay thế ô nhập phí cố định bằng bảng phí theo dải số lượng"), the Admin UI's "Custom phí" section always shows the tier table now (no separate "fixed vs. range" switch within custom-fee mode). The only toggle remains the existing enable/disable of "Custom phí" itself (`hasSpecificPCCFee`).

5. **Validation enforced both client (form) and server (API) side**, since this metadata write bypasses Sharetribe schema validation:
   - `maxQuantity` (all rows except the last): positive integer
   - `price` (all rows including the last): positive number
   - `maxQuantity` strictly increasing row-to-row
   - at least 1 tier
   - no empty cells
   The server-side check in `updateCompany.service.ts` is a defense-in-depth duplicate of the client validators — not a new validation language.

---

## Phase 1 — Pure calculation logic (helpers, no UI/API yet)

**Goal:** add tier type + lookup function + thread it through the price-calculation functions, with zero behavior change for companies not using tiers.

**What to implement (copy the existing function shapes, don't redesign them):**

1. In `src/utils/types.ts`, near `TUpdateCompanyApiParams` (~line 607), add:
   ```ts
   export type TPccFeeTier = {
     maxQuantity: number | null;
     price: number;
   };
   ```
   Add `specificPCCFeeTiers?: TPccFeeTier[];` to `TUpdateCompanyApiParams`.

2. In `src/helpers/orderHelper.ts`, immediately after `getPCCFeeByMemberAmount` (after line 453), add a new exported function `getPCCFeeByTiers(memberAmount: number, tiers: TPccFeeTier[])` that:
   - returns `0` if `!memberAmount` or `!tiers?.length`
   - finds the first tier (in ascending order by `maxQuantity`, with `null` sorted last) where `memberAmount <= tier.maxQuantity` or `tier.maxQuantity === null`
   - returns that tier's `price`, or `0` if nothing matches (defensive; shouldn't happen given validation)
   - **Do not modify `getPCCFeeByMemberAmount` itself.**

3. In `src/helpers/order/cartInfoHelper.ts`:
   - `calculatePCCFeeByDate` (lines 200-233): add optional param `specificPCCFeeTiers?: TPccFeeTier[]`. Replace the `hasSpecificPCCFee ? specificPCCFee : ...` branch with the precedence rule from Design Decision 3.
   - `calculatePriceQuotationInfoFromOrder` (lines 235-357): add `specificPCCFeeTiers` to the destructured params and forward it into the inner `calculatePCCFeeByDate` call (~line 291-297).
   - `calculatePriceQuotationInfoFromQuotation` (lines 414-537): same change at its `calculatePCCFeeByDate`-equivalent call site (~474-485).

**Anti-pattern guards:**
- Do not change the signature order of existing positional params (these are object-destructured, so adding a new optional key is additive and non-breaking).
- Do not touch `getPCCFeeByMemberAmount` or any VAT (`calculateVATFee`) code in the same file.

**Verification checklist:**
- Grep `getPCCFeeByMemberAmount` to confirm it's unchanged (`git diff` shows zero lines changed in that function).
- Manually trace `calculatePCCFeeByDate` for 4 cases: (a) `hasSpecificPCCFee=false` → must be byte-identical output to before the change; (b) `hasSpecificPCCFee=true`, no tiers, legacy `specificPCCFee` set → must match old behavior; (c) `hasSpecificPCCFee=true`, tiers set, quantity exactly on a boundary; (d) quantity above the last tier's `maxQuantity`-bearing row (should hit the `null` unbounded tier).
- `tsc --noEmit` (or the project's type-check script) passes.

---

## Phase 2 — Company metadata persistence + order-start snapshot

**Goal:** let the API store/retrieve `specificPCCFeeTiers`, and make `start-order.service.ts` snapshot it exactly like it already does for `specificPCCFee`.

**What to implement:**

1. `src/pages/api/apiServices/company/updateCompany.service.ts`:
   - Destructure `specificPCCFeeTiers` from `dataParams` (alongside existing `specificPCCFee`, line ~26).
   - In the `metadata` object (lines 83-93), when `specificPCCFeeTiers` is a non-empty array, write `{ specificPCCFeeTiers, hasSpecificPCCFee: true }` (mirrors the existing `specificPCCFee` conditional spread). Keep the existing `specificPCCFee` conditional branch as-is for back-compat — both can coexist in metadata; Phase 1's calculation precedence (tiers win over legacy flat fee) makes this safe.
   - Add the server-side validation from Design Decision 5 here (or in a small shared validator function importable by both this service and the Phase 4 form, to avoid duplicating the rules in two languages of logic — reuse, don't reinvent).

2. `src/utils/types.ts`: already covered in Phase 1 (`TUpdateCompanyApiParams.specificPCCFeeTiers`).

3. `src/pages/api/orders/[orderId]/start-order.service.ts`:
   - Line 57-58: also destructure `specificPCCFeeTiers` from `User(companyUser).getMetadata()`.
   - Lines 72-76: extend the existing conditional snapshot block to also include `specificPCCFeeTiers` when the order doesn't already have its own copy. Follow the exact same `orderHasSpecificPCCFee === undefined && orderSpecificPCCFee === undefined` guard — add a matching `orderSpecificPCCFeeTiers === undefined` read/guard so a half-started order can't get tiers from a company that has since changed them.

**Anti-pattern guards:**
- Do not change the `orderState !== EOrderStates.picking` guard or any other part of `startOrder()` unrelated to fee snapshotting (per `docs/shared/sensitive-areas.md` Category 2 — this file is a "point of no return").
- Do not remove the legacy `specificPCCFee` write path from `updateCompany.service.ts`.

**Verification checklist:**
- Save a company with tiers via the (not-yet-built) API payload (can be tested with a manual `curl`/Postman call ahead of Phase 4 UI) and confirm `integrationSdk.users.show` returns `metadata.specificPCCFeeTiers` correctly shaped.
- Start a test order for that company and confirm the order listing's metadata now also has `specificPCCFeeTiers`, `hasSpecificPCCFee: true`.
- Confirm a company *without* tiers (legacy fixed fee only) still snapshots correctly with no `specificPCCFeeTiers` key.

---

## Phase 3 — Wire remaining call sites

**Goal:** every place that currently reads `hasSpecificPCCFee`/`specificPCCFee` and feeds it into the Phase-1 functions must also read/forward `specificPCCFeeTiers`. **Re-verify each file's current content before editing — do not trust only the Phase-0 summary line numbers, since the codebase may have moved since the discovery pass.**

**Files to check and update:**
1. `src/hooks/usePrepareOrderManagementData.ts` (~lines 74-76, 203-218, 260-271) — add `specificPCCFeeTiers` to the company-metadata destructure and to both calls into `calculatePriceQuotationInfoFromOrder`/`calculatePriceQuotationInfoFromQuotation`.
2. `src/pages/admin/order/ManageOrders.page.tsx` (~lines 277-394) — same: read `specificPCCFeeTiers` from order metadata (it's a snapshot field per Phase 2), forward to `calculatePCCFeeByDate`.
3. `src/pages/api/orders/[orderId]/plan/[planId]/initialize-payment.service.ts` (~lines 156-188) — same forwarding into the price-quotation call.
4. `src/pages/api/admin/payment/check-valid-payment.service.ts` and `src/pages/api/orders/[orderId]/plan/[planId]/update-payment.service.ts` — **first grep both files for `specificPCCFee` to confirm whether they call the Phase-1 functions directly or only consume an already-computed total**; only change them if they independently re-derive the PCC fee.
5. `src/pages/admin/order/StepScreen/ServiceFeesAndNotes/ServiceFeesAndNotes.tsx` — **first read the file** to confirm whether it calls `getPCCFeeByMemberAmount`/`calculatePCCFeeByDate` directly for display, or only reads a precomputed value. If it independently computes the fee for display/edit, it needs the same `specificPCCFeeTiers` threading; if it only reads `order.metadata.pccFee`-style precomputed output, no change needed there.
6. `EditCompanyWizard.tsx` (~lines 244-259) and `EditCompanyWizard/utils.tsx` (~lines 88-126) — initial-values loader must read `specificPCCFeeTiers` from `User(company).getMetadata()`; submit-payload builder must include `specificPCCFeeTiers` in the `COMPANY_SETTING_OTHER_TAB_ID` case alongside `specificPCCFee`.

**Verification checklist:**
- `grep -rn "specificPCCFee\b" src/` and confirm every call site that reads the flat fee also now reads `specificPCCFeeTiers` (or is explicitly documented above as "consumes precomputed value only, no change needed").
- Manually exercise: order management page for a tiered company shows the correct per-date fee at a few different participant counts; CSV export "Phí dịch vụ" column matches the on-screen value.
- Payment initialization total for a tiered-company order matches manual hand-calculation against the configured tiers.

---

## Phase 4 — Admin UI: the range table

**Goal:** replace the single fixed-fee input in `EditCompanyOtherSettingsForm.tsx` with an add/remove tier table, copying the `FieldArray` mechanics from `FieldBankAccounts.tsx`.

**What to implement:**

1. New component `src/pages/admin/company/components/EditCompanyOtherSettingsForm/FieldPccFeeTiers/FieldPccFeeTiers.tsx` (or co-located in the same folder as `EditCompanyOtherSettingsForm`), modeled directly on `FieldBankAccounts.tsx`:
   - `<FieldArray name="specificPCCFeeTiers">` — push a new `{ maxQuantity: '', price: '' }` row on "Thêm hàng"; `fields.remove(index)` on delete.
   - Delete icon hidden when `index === 0` (copy `{index !== 0 && ...}` guard verbatim).
   - **Last-row special rendering:** for `index === fields.length - 1`, do not render an editable `maxQuantity` input; instead render a read-only label `≥ {fields.value[index - 1]?.maxQuantity ?? 0}`. Internally keep `maxQuantity: null` for that row's stored value (strip/ignore whatever was in the field). For all other rows, render two `FieldTextInput`s: quantity threshold and price, using `parseThousandNumber`/`removeNonNumeric` exactly as the existing `specificPCCFee` field does today.
   - "Thêm hàng" button rendered after the last row, copying the `index === fields.length - 1` placement from `FieldBankAccounts.tsx`.
2. Validation (compose with `composeValidators` from `@src/utils/validators`):
   - `maxQuantity`: `required` + positive-integer check (new validator, e.g. `positiveInteger(msg)` — check there isn't already an equivalent in `validators.ts` before adding one; if `numberMinLength`/`numberMaxLength` plus a custom integer regex check covers it, compose those instead of writing a new generic validator from scratch).
   - `price`: `required` + `numberMinLength(msg, 1)` (positive).
   - Strictly-increasing cross-field check: a validator reading `allValues.specificPCCFeeTiers` (same `allValues` pattern as `valueLessThanMax`/`valueGreaterThanMin` in `validators.ts`) that compares each row's `maxQuantity` to the previous row's.
   - Form-level "at least 1 tier" is automatically satisfied since the field array always starts with one row and the first row can't be deleted.
3. Update `EditCompanyOtherSettingsForm.tsx`:
   - Replace the single `FieldTextInput` block (lines 44-73) with `<FieldPccFeeTiers name="specificPCCFeeTiers" id="EditCompanyOtherSettingsForm.specificPCCFeeTiers" />`.
   - Update `TEditCompanyOtherSettingsFormValues` to add `specificPCCFeeTiers?: TPccFeeTier[]`.
   - `initialValues` for this form (set where `EditCompanyOtherSettingsForm` is instantiated, in `EditCompanyWizard.tsx`) should default to `[{ maxQuantity: '', price: '' }]` when the company has no existing tiers, so the table always renders with at least one row.
4. Add Vietnamese (and English) i18n keys to `src/translations/vi.json` / `en.json`, following the existing `EditCompanyOtherSettingsForm.PCCFeeField.*` naming convention — e.g. `EditCompanyOtherSettingsForm.PccFeeTiers.addRow` = "Thêm hàng", `.quantityLabel`, `.priceLabel`, `.unboundedLabel` (template for "≥ {value}"), plus error-message keys for each validator (increasing order, positive integer, required, etc).

**Anti-pattern guards:**
- Do not invent a new form library — this form already uses `react-final-form` + `final-form-arrays`; stay within that.
- Do not remove `specificPCCFee` from `TEditCompanyOtherSettingsFormValues` if any other code path still reads it for display of legacy data.
- **Pre-fill rules for initial values (two cases):**
  - Company has `hasSpecificPCCFee: true` + flat `specificPCCFee` but no `specificPCCFeeTiers` yet (old style): pre-fill table with `[{ maxQuantity: null, price: specificPCCFee }]` so admin sees their existing value rather than an empty table.
  - Company has `hasSpecificPCCFee: false` / no custom fee at all (`specificPCCFee` is empty): show empty tier table — admin must fill it in to enable custom tiers. Calculation continues to use `getPCCFeeByMemberAmount` (hardcoded default) until they save a valid tier table.

**Verification checklist:**
- Visual/manual QA in browser (per project convention — start dev server, exercise the screen):
  - Open a company with no custom fee configured: toggle on, table shows one unbounded row.
  - Add 2-3 rows, fill in increasing thresholds, save, reload page, confirm values persist.
  - Try saving with: an empty cell, a non-increasing threshold, a duplicate threshold, a negative price — confirm Vietnamese validation messages block submission for each case.
  - Delete a middle row, confirm remaining rows still validate/save correctly; confirm row 0 has no delete icon.
  - Confirm a company with the OLD flat fee (no tiers yet) still loads and displays correctly (back-compat), and resaving converts it to the new tiered shape.

---

## Phase 5 — Final Verification

1. **Re-grep for completeness:** `grep -rn "specificPCCFee\b" src/` — every result must either (a) be updated to also handle `specificPCCFeeTiers`, or (b) be explicitly justified in this plan's Phase 3 notes as "precomputed value, no change needed."
2. **Sensitive-area compliance check** (per `docs/shared/sensitive-areas.md`):
   - Confirm `getPCCFeeByMemberAmount` (default schedule) has zero diff.
   - Confirm the order-start snapshot guard (`orderHasSpecificPCCFee === undefined && ...`) still prevents any retroactive change to already-started orders, now extended to tiers.
   - Confirm no VAT calculation code (`calculateVATFee`, `vatPercentageBaseOnVatSetting`) was touched.
   - Confirm `adminChecker` still guards the company-update API route — no permission loosening.
3. **Type check + lint:** run the project's `tsc`/`eslint` scripts; fix any typing gaps introduced by the new optional fields.
4. **End-to-end manual run-through** (per Phase 4's checklist) covering: default-fee customer (unaffected), legacy fixed-custom-fee customer (unaffected until resaved), newly-tiered customer (full range behavior across multiple quantity boundaries), order export CSV, and payment total calculation.
5. **Confirm no business logic changed for the default fee schedule and no scope creep into VAT/PCC-fee-display screens beyond what Phase 3 determined was actually necessary.**
