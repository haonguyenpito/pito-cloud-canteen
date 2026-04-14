# Admin Role — Overview

## What Admins Do

Admins are PITO operators who oversee the entire order lifecycle. They have two categories of work:

1. **Order lifecycle interventions** — driving sub-order delivery state transitions
2. **Content and entity management** — menus, food items, companies, partners, payments

All admin endpoints are protected by the `adminChecker` middleware.

---

## Permission Gate: `adminChecker`

**File:** `src/services/permissionChecker/admin.ts`

Every admin API route wraps its handler with `adminChecker`:

```typescript
const adminChecker =
  (handler: NextApiHandler) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    const sdk = getSdk(req, res);
    const currentUserResponse = await sdk.currentUser.show();
    const [currentUser] = denormalisedResponseEntities(currentUserResponse);

    if (!currentUser) return res.status(401).json({ message: 'Unauthenticated!' });

    const { isAdmin = false } = CurrentUser(currentUser).getMetadata();
    if (!isAdmin) return res.status(403).json({ message: 'Forbidden' });

    req.previewData = { currentUser };
    return handler(req, res);
  };
```

`isAdmin` is a flag stored in the user's Sharetribe profile metadata — not a separate role value.

---

## Admin Portal Pages

| Page             | URL                            | Function                          |
| ---------------- | ------------------------------ | --------------------------------- |
| Order management | `/admin/orders/*`              | View and drive all orders         |
| Plan transit     | `/admin/plan/*`                | Sub-order state transitions       |
| Partner menus    | `/admin/partner/pending-menus` | Approve/reject pending menus      |
| Client payments  | `/admin/payment-client/*`      | Confirm client payments           |
| Partner payments | `/admin/payment-partner/*`     | Confirm partner payments          |
| Personalization  | `/admin/pcc-personalization`   | Algolia participant segmentation  |
| Dashboard        | `/admin/pcc-dashboard`         | Algolia order analytics           |

---

## Admin Redux Slices

| Slice                       | File                                                       | What It Manages                          |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `AdminManageOrder`          | `src/pages/admin/order/AdminManageOrder.slice.ts`          | Admin order list, filters, bulk updates  |
| `adminManagePartnersMenus`  | `src/pages/admin/partner/pending-menus/ManagePartnersMenus.slice.ts` | Pending menus queue          |
| `AdminManageClientPayments` | `src/pages/admin/payment-client/AdminManageClientPayments.slice.ts`  | Client payment confirmation  |
| `PaymentPartner`            | `src/pages/admin/payment-partner/PaymentPartner.slice.ts`  | Partner payment confirmation             |
| `AdminAttributes`           | `src/pages/admin/AdminAttributes.slice.ts`                 | Admin attribute management               |
| `OrderManagement`           | `src/redux/slices/OrderManagement.slice.ts`                | Shared order list slice                  |

---

## Key Docs

- `docs/roles/admin/order-management.md` — Transit hub, order state controls
- `docs/roles/admin/payment-flow.md` — Payment ledger: initialization, confirmation, VAT
- `docs/roles/admin/menu-approval.md` — Menu/food approval, company and partner management
- `docs/shared/transaction-flow.md` — Sharetribe transaction state machine
- `docs/shared/sensitive-areas.md` — What to never break
