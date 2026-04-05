# Participant Portal — Claude Context

You are working in the **Participant portal** (`src/pages/participant/`). Load only participant-relevant context.

@docs/roles/participant/overview.md
@docs/roles/participant/food-selection.md
@docs/shared/sensitive-areas.md
@docs/frontend/conventions.md
@docs/frontend/data-flow.md
@docs/frontend/api-layer.md

## Quick Rules
- Food selections MUST go through BullMQ — never write directly to Sharetribe from the member-order API route
- The Redis distributed lock (`lock:plan:{planId}`) serializes concurrent writes to `plan.metadata.orderDetail` — do not weaken or remove it
- The `shoppingCart` slice is keyed `userId → planId → dayTimestamp`
- When a participant is deleted, call `removeParticipantFromOrderDetail()` (`src/utils/order.ts`) to clean up their food selections
- Monitor `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` for food selection persistence failures
