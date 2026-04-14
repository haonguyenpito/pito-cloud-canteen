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
- All admin API routes must be wrapped with `adminChecker` middleware (`src/services/permissionChecker/admin.ts`)
- `transit.api.ts` is the sub-order state machine hub — read its block comment (lines 1–44) before modifying
- Payment confirmation is irreversible (`isAdminConfirmed: true`)
- Never call `start-order` more than once per order/plan
