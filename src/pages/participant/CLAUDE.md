# Participant Portal — Claude Context

You are working in the **Participant portal** (`src/pages/participant/`). Load only participant-relevant context.

@docs/roles/participant/overview.md
@docs/roles/participant/food-selection.md
@docs/shared/sensitive-areas.md
@docs/frontend/conventions.md
@docs/frontend/data-flow.md
@docs/frontend/api-layer.md

## Quick Rules
- **Participant self-pick** (`POST /api/participants/orders/:orderId`) MUST stay routed through BullMQ — calls `addToProcessOrderQueue` in `processOrder.job.ts`
- Admin/booker edits (`PUT /api/orders/:orderId/member-order`) write directly to Sharetribe — this is the existing, intentional path; do not change it without a queue migration plan
- The Redis distributed lock (`lock:plan:{planId}`) serializes concurrent writes to `plan.metadata.orderDetail` — do not weaken or remove it
- The `shoppingCart` slice is keyed `userId → planId → dayTimestamp`
- When a participant is deleted, call `removeParticipantFromOrderDetail()` (`src/utils/order.ts`) to clean up their food selections
- `processMemberOrder.job.ts` exists but has zero callers — `processOrder.job.ts` is the live worker
- Monitor `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` for food selection persistence failures
