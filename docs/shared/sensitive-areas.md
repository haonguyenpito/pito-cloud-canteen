# Sensitive Areas — Do Not Break

This document lists every area of the codebase that touches money, order state, permissions, or security. Any changes here require careful review and testing against production data scenarios.

---

## Category 1: Money / Payments

### Price Calculation

**File:** `src/helpers/order/cartInfoHelper.ts`

- `calculatePriceQuotationInfoFromOrder` — total price from quotation
- `calculatePriceQuotationPartner` — per-partner price with VAT

**Risk:** Incorrect price calculation results in wrong payment amounts charged to companies or paid to restaurants. VAT logic has 3 modes (`vat`, `noExportVat`, `direct`) and PCC service fee overrides per company.

---

### Extra Fee (`extraFee`) — Admin-Only Markup

**Storage:** `food.publicData.extraFee` (VND integer, default 0) on each Sharetribe food listing.

**Price visibility by role:**

| Role | Price shown |
|---|---|
| Admin | Base price field + extra fee field + computed display price |
| Booker | `base + extraFee` (final price) |
| Participant | `base + extraFee` (final price) |
| Partner | Base price only |

**Billing pipeline** (`src/helpers/orderHelper.ts`):
- `getSelectedRestaurantAndFoodList` and `getUpdateLineItems` store both `foodPrice` (base) and `foodExtraFee` in the order's `foodList`
- `getTotalInfo` computes company billing as `(foodPrice + foodExtraFee) × frequency`
- `calculatePriceQuotationPartner` reads from the quotation listing (separate from `plan.orderDetail`) — **unaffected by extraFee**, so partner payment stays at base price

**Restaurant search** (`src/helpers/searchRestaurantHelper.ts` → `parseFoodsFromMenu`):
- `TFoodInRestaurant.price` = `base + extraFee` — the budget filter and display both use the final price

**Risk:** If `foodExtraFee` is inadvertently removed from the `getTotalInfo` calculation, companies will be under-billed. If it leaks into `calculatePriceQuotationPartner`, partners will be over-paid.

---

### Payment Initialization

**File:** `src/pages/api/orders/[orderId]/plan/[planId]/initialize-payment.service.ts`

**Risk:** This creates the Firebase payment records that admin uses to confirm actual money transfers. Errors here result in wrong amounts, missing records, or duplicate records.

---

### Payment Confirmation

**Files:**

- `src/pages/api/admin/payment/confirm-partner-payment.api.ts`
- `src/pages/api/admin/payment/confirm-client-payment.api.ts`
- `src/pages/api/admin/payment/payment.service.ts`

**Risk:** Confirmation sets `isAdminConfirmed: true` — **irreversible** in production. Adding any logic here could cause premature or double confirmation.

---

### Cancellation Payment Adjustment

**File:** `src/pages/api/admin/payment/modify-payment-when-cancel-sub-order.service.ts`

**Risk:** Adjusts payment totals when a sub-order is canceled. Bugs here cause incorrect outstanding payment amounts.

---

### Quotation Listings

**API:** `POST /api/orders/:orderId/quotation`

**Risk:** Quotation is the source of truth for all price calculations. Overwriting a finalized quotation after payment initialization causes price/payment record mismatch.

---

## Category 2: Order State Machine

### Start Order (Point of No Return)

**File:** `src/pages/api/orders/[orderId]/plan/[planId]/start-order.api.ts`

**Risk:** Initiates all Sharetribe transactions. Once called, the order is locked into `inProgress` and transactions cannot be "un-initiated". Should only be callable when order is in `picking` state. Calling twice will attempt to create duplicate transactions.

---

### Transaction Initiation

**File:** `src/pages/api/orders/[orderId]/plan/[planId]/initiate-transaction.service.ts`

**Risk:** Creates one Sharetribe transaction per delivery date using the sub-account trusted SDK. Errors mid-loop leave some dates with transactions and others without, causing inconsistent state. The `transactionId` written back to `plan.metadata` is critical for all downstream operations.

---

### Sub-Order Transition Controller

**Files:**

- `src/pages/api/admin/plan/transit.api.ts`
- `src/pages/api/admin/plan/transition-order-status.service.ts`

**Risk:** Drives the entire Sharetribe transaction state machine for sub-orders. Invalid transitions throw Sharetribe errors. Wrong state transitions can't be easily reversed (e.g., accidentally completing a delivery that hasn't happened).

---

### Order State Updates

**File:** `src/pages/api/admin/listings/order/[orderId]/update-state.api.ts`

**Risk:** Direct admin override of order state. Must validate state transition is valid before writing.

---

## Category 3: Food Selection Persistence

### BullMQ Job — Distributed Lock

**Files:**

- `src/services/jobs/processOrder.job.ts`
- `src/services/jobs/processMemberOrder.job.ts`

**Risk:** The Redis Lua-script-based distributed lock (`lock:plan:{planId}`) serializes concurrent writes to `plan.metadata.orderDetail`. Removing or weakening this lock causes participant food selections to be silently overwritten. This is the "missing orders" problem monitored by the `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` Slack channel.

---

### Food Selection API Entry Point

**File:** `src/pages/api/orders/[orderId]/member-order/index.api.ts`

**Risk:** Must always route through BullMQ — never write directly to Sharetribe from this endpoint. The BullMQ job ID deduplication (`{orderId}-{planId}-{userId}`) ensures rapid successive submissions don't cause issues.

---

## Category 4: Security / Authentication

### Sub-Account Password Decryption

**File:** `src/services/subAccountSdk.ts`

**Risk:** Decrypts AES-encrypted company sub-account passwords stored in Sharetribe `privateData`. Uses `ENCRYPT_PASSWORD_SECRET_KEY`. If this key is ever rotated, all existing sub-account passwords become unreadable. Never log the decrypted password.

---

### Trusted SDK Token Exchange

**File:** `src/services/sdk.ts` — `getTrustedSdk(req)`

**Risk:** Exchanges a user token for a privileged trusted token. This elevated token can call privileged Sharetribe transitions. Must only be used for the specific operations that require it (currently: `initiate-transaction`).

---

### Permission Checkers

**Files:** `src/services/permissionChecker/`

- `order.ts` — `CompanyPermissions` role check for order operations
- `admin.ts` — Admin-only endpoint guards
- `company.ts` — Company portal guards
- `partner.ts` — Partner portal guards
- `participant.ts` — Participant portal guards

**Risk:** Removing or loosening permission checks exposes admin and financial operations to wrong user roles.

---

## Category 5: AWS Schedulers

### EventBridge Schedulers

**File:** `src/services/awsEventBrigdeScheduler.ts`

**Risk:** Schedulers for auto-start order and auto-pick-food are created at order creation time. If a scheduler fires with stale or incorrect order state (e.g., order already started manually), it may attempt duplicate operations.

**Things to preserve:**

- Scheduler names must be unique per order (`{scheduleNamePrefix}{orderId}`)
- Timezone: always `Asia/Ho_Chi_Minh`
- Schedulers must be deleted when orders are canceled

---

## Category 6: Sharetribe Transaction Process

### `transaction-process/process.edn`

**Risk:** This is the deployed Sharetribe transaction process definition. Changes require running Sharetribe CLI to deploy a new version and creating a new alias. The `bookingProcessAlias` in `src/configs.ts` must always match the deployed alias. A mismatch breaks all transaction initiations silently (Sharetribe returns error on `initiate`).

---

## Category 7: Configuration

### `src/configs.ts`

- `bookingProcessAlias` — must match deployed Sharetribe process alias
- `locale` — app is Vietnamese (`vi`); changing affects all i18n

### `src/paths.ts`

- `NonRequireAuthenticationRoutes` — adding/removing routes here affects who can access the app without auth
- `IgnoredPermissionCheckRoutes` — affects role-based redirect behavior

---

## General Rules

1. **Never write directly to `plan.metadata.orderDetail` from an API route** — always go through BullMQ + Redis lock.
2. **Never call `initiate-transaction` more than once per sub-order date** — check if `transactionId` already exists before initiating.
3. **Never expose `ENCRYPT_PASSWORD_SECRET_KEY`** in logs, errors, or client-side code.
4. **Never change VAT calculation logic** without verifying all 3 VAT modes (`vat`, `noExportVat`, `direct`) still compute correctly.
5. **Never delete Sharetribe listings** for orders, plans, or quotations — they are permanent records; use state fields to mark them inactive.
6. **Always check Slack alerts** at `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` when modifying food selection flow — this is the only observable signal for silent data loss.
