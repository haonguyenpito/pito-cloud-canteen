# Admin — Payment Flow

## Overview

PITO Cloud Canteen does **not** use a payment gateway. Payments are tracked in **Firebase Firestore** as an internal ledger. Real money transfers happen outside the system (bank transfer). Admin manually marks payments as confirmed.

Two payment record types per order:
- **Partner payment** — what PITO owes each restaurant (per sub-order date)
- **Client payment** — what the company owes PITO (full order)

---

## Payment Record Lifecycle

```
initialize-payment called (after start-order)
         │
         ▼
Payment records created in Firebase
(isHideFromHistory: true, isAdminConfirmed: false, amount: 0)
         │
         ▼
Amounts calculated from quotation + VAT settings
         │
         ▼
Admin reviews payment records
         │
    ┌────┴────┐
    ▼         ▼
Confirm    Disapprove / Modify
    │
    ▼
isAdminConfirmed: true
    │
    ▼
Order moves to completed (when both partner + client confirmed)
```

---

## Payment Initialization

**Trigger:** Called after `start-order` completes

**API:** `POST /api/orders/:orderId/plan/:planId/initialize-payment`

**File:** `src/pages/api/orders/[orderId]/plan/[planId]/initialize-payment.service.ts`

**Partner payment records** (one per restaurant per active sub-order date):

```typescript
{
  SKU: string;            // generateSKU('PARTNER', orderId)
  amount: 0;              // actual cash collected — admin fills this in later
  paymentNote: '';
  orderId: string;
  partnerId: string;
  partnerName: string;
  subOrderDate: string;
  companyName: string;
  orderTitle: string;
  totalPrice: number;     // VAT-inclusive total from calculatePriceQuotationPartner
  deliveryHour: string;
  isHideFromHistory: true;
  isAdminConfirmed: false;
}
```

> Sub-orders with `lastTransition ∈ {OPERATOR_CANCEL_PLAN, OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED, OPERATOR_CANCEL_AFTER_PARTNER_REJECTED}` are **excluded** — no record is created for cancelled dates.
> Partner record writes are **fire-and-forget** (no await) — failures are silent. See behavioral contract at the top of `initialize-payment.service.ts`.

**Client payment record** (one per order):

```typescript
{
  SKU: string;            // generateSKU('CUSTOMER', orderId)
  amount: 0;              // filled in later by admin
  orderId: string;
  paymentNote: '';
  companyName: string;
  orderTitle: string;
  totalPrice: number;     // VAT-inclusive total from calculatePriceQuotationInfoFromOrder
  deliveryHour: string;
  startDate: number;
  endDate: number;
  isHideFromHistory: true;
  isAdminConfirmed: false;
  restaurants?: { restaurantId: string; restaurantName: string }[];
  company?: { companyId: string; companyName: string };
  booker?: { bookerId: string; bookerDisplayName: string; bookerPhoneNumber: string };
}
```

For in-progress edited orders (re-running `initialize-payment`), the existing client record is **updated** in place via `updatePaymentRecordOnFirebase` — not duplicated.

Firebase collection: `FIREBASE_PAYMENT_RECORD_COLLECTION_NAME` (env var, set per environment in `src/process.d.ts`).

---

## Price Calculation

**File:** `src/helpers/order/cartInfoHelper.ts`

### VAT Modes (`EPartnerVATSetting`)

| Mode          | Meaning                                                               |
| ------------- | --------------------------------------------------------------------- |
| `vat`         | VAT included and exported (restaurant issues VAT invoice to PITO)    |
| `noExportVat` | Restaurant does not issue VAT invoice                                 |
| `direct`      | Direct billing — special pricing arrangement                          |

**PCC Service Fee:** Added on top of base food price. Some companies have a custom `specificPccFee` override — check `order.metadata.specificPccFee`.

### Price Formula (simplified)

```
partnerPayment = (foodCost per date) + serviceCharges
clientPayment  = sum(partnerPayments) + pccServiceFee ± adjustments
totalWithVAT   = baseAmount × (1 + vatPercentage/100)  [only for `vat` mode]
```

---

## Admin Payment Confirmation

All confirm/disapprove endpoints use **HTTP PUT** (verified in `src/apis/admin.ts`).

### Confirm Partner Payment

**API:** `PUT /api/admin/payment/confirm-partner-payment`

Sets `isAdminConfirmed: true` on the partner record and updates the order's `isAdminConfirmedPartnerPayment` metadata flag. Once **all** partner sub-order payments are confirmed, the partner-side is considered settled.

### Confirm Client Payment

**API:** `PUT /api/admin/payment/confirm-client-payment`

Sets `isAdminConfirmed: true` on the client record and the order's `isAdminConfirmedClientPayment` metadata flag.

When both partner and client are confirmed, `transitionOrderPaymentStatus` (`/api/admin/payment/transition-order-payment-status`) advances the order from `pendingPayment` → `completed`.

### Disapprove Payment (split into two endpoints)

| Side    | API                                                  |
| ------- | ---------------------------------------------------- |
| Client  | `PUT /api/admin/payment/disapprove-client-payment`   |
| Partner | `PUT /api/admin/payment/disapprove-partner-payment`  |

Disapprove only succeeds if the corresponding `isAdminConfirmed*Payment` flag is currently `true` (otherwise returns 400). Sets `isAdminConfirmed: false` so the admin can re-confirm later.

### Modify Payment Amount

**API:** `PUT /api/orders/:orderId/plan/:planId/update-payment`

Manual amount adjustment (partial cancellations, price corrections). Implementation in `update-payment.service.ts`.

---

## Cancellation Adjustments

**File:** `src/pages/api/admin/payment/modify-payment-when-cancel-sub-order.service.ts`

When a sub-order is canceled mid-delivery:
1. Finds payment records for the canceled date
2. Adjusts total client payment
3. Marks partner payment for that date as canceled/zero

---

## Order State vs. Payment Status

| Order State      | Payment Status                                                        |
| ---------------- | --------------------------------------------------------------------- |
| `inProgress`     | Records exist but `isHideFromHistory: true`                           |
| `pendingPayment` | All deliveries done — admin needs to confirm                          |
| `completed`      | Both partner and client payments confirmed (`isAdminConfirmed: true`) |

---

## Key Files

| File                                                                          | Purpose                               |
| ----------------------------------------------------------------------------- | ------------------------------------- |
| `src/pages/api/orders/[orderId]/plan/[planId]/initialize-payment.service.ts`  | Creates payment records               |
| `src/pages/api/admin/payment/payment.service.ts`                              | Core payment operations               |
| `src/pages/api/admin/payment/confirm-partner-payment.api.ts`                  | Confirm partner payment               |
| `src/pages/api/admin/payment/confirm-client-payment.api.ts`                   | Confirm client payment                |
| `src/pages/api/admin/payment/modify-payment-when-cancel-sub-order.service.ts` | Adjust on cancellation                |
| `src/helpers/order/cartInfoHelper.ts`                                         | Price + VAT calculation               |

---

## Important Rules

1. **No real payment processing** — money moves outside PITO; this is a reconciliation system only.
2. **Payment confirmation is irreversible** — once `isAdminConfirmed: true`, there is no undo.
3. **VAT is per-partner** — never apply a blanket VAT rate; each restaurant has its own `EPartnerVATSetting`.
4. **PCC fee override** — always check `order.metadata.specificPccFee` before assuming default rates.
