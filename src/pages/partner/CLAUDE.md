# Partner Portal — Claude Context

You are working in the **Partner portal** (`src/pages/partner/`). Load only partner-relevant context.

@docs/roles/partner/overview.md
@docs/roles/partner/sub-order-flow.md
@docs/roles/partner/menu-management.md
@docs/shared/sensitive-areas.md
@docs/frontend/conventions.md
@docs/frontend/data-flow.md
@docs/frontend/api-layer.md

## Quick Rules
- At the Sharetribe level, every post-initiation transition uses `actor: operator` in `process.edn` — so PITO's server is always the Sharetribe actor
- Partners DO trigger two transitions from their own portal: `PARTNER_CONFIRM_SUB_ORDER` and `PARTNER_REJECT_SUB_ORDER` via `PUT /api/partner/:partnerId/orders/:orderId/transit` (PITO server then runs them as operator on Sharetribe)
- All other sub-order transitions (`START_DELIVERY`, `COMPLETE_DELIVERY`, `OPERATOR_CANCEL_*`) go through admin's `PUT /api/admin/plan/transit`
- New food items and menus require admin approval before becoming active
- Partner reply to reviews requires admin approval before publishing to participants
- Partners start as `draft` in Sharetribe — admin must publish them before they appear in restaurant search
