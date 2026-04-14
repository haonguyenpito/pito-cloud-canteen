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
- All Sharetribe sub-order transitions are admin-driven (operator role) — partners cannot directly trigger Sharetribe state changes
- New food items and menus require admin approval before becoming active
- Partner reply to reviews requires admin approval before publishing to participants
- Partners start as `draft` in Sharetribe — admin must publish them before they appear in restaurant search
