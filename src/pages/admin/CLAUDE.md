# Admin Portal — Claude Context

You are working in the **Admin portal** (`src/pages/admin/`). Load only admin-relevant context.

@docs/roles/admin/overview.md
@docs/roles/admin/order-management.md
@docs/roles/admin/payment-flow.md
@docs/roles/admin/menu-approval.md
@docs/shared/sensitive-areas.md
@docs/shared/transaction-flow.md
@docs/frontend/conventions.md
@docs/frontend/data-flow.md
@docs/frontend/api-layer.md

## Quick Rules
- All admin API routes must be wrapped with `adminChecker` middleware (`src/services/permissionChecker/admin.ts`), typically via `composeApiCheckers(adminChecker, ...)` from `@apis/configs`
- `src/pages/api/admin/plan/transit.api.ts` is the admin-side sub-order state machine hub for `START_DELIVERY`, `COMPLETE_DELIVERY`, and the 3 `OPERATOR_CANCEL_*` cases — read its block comment (lines 1–44) before modifying. Note that partners trigger their own confirm/reject via a separate transit endpoint.
- Payment confirm/disapprove endpoints all use HTTP **PUT** (not POST) and are split per-side (`confirm-client-payment`, `confirm-partner-payment`, `disapprove-client-payment`, `disapprove-partner-payment`)
- Payment confirmation is reversible via the `disapprove-*-payment` endpoints, but only while the order is still in `pendingPayment` — once `completed`, do not write to payment records
- Never call `start-order` more than once per order/plan — it creates Sharetribe transactions and the path is not idempotent for new dates
