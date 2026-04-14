# Company / Booker Portal — Claude Context

You are working in the **Company/Booker portal** (`src/pages/company/`). Load only booker-relevant context.

@docs/roles/booker/overview.md
@docs/roles/booker/order-creation.md
@docs/roles/booker/order-lifecycle.md
@docs/shared/sensitive-areas.md
@docs/frontend/conventions.md
@docs/frontend/data-flow.md
@docs/frontend/api-layer.md

## Quick Rules
- The Quiz slice (`src/redux/slices/Quiz.slice.ts`) holds new order wizard state — cleared after successful creation
- Quotation is the source of truth for all price calculations — do not overwrite after payment initialization
- Order states span 3 enums: `EBookerOrderDraftStates`, `EOrderDraftStates`, `EOrderStates` — check all three when filtering
- `start-order` is irreversible — Sharetribe transactions cannot be un-initiated
- All EventBridge schedulers use `Asia/Ho_Chi_Minh` timezone
