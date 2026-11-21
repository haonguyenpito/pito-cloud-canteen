# Participant Portal — Claude Context

You are working in the **Participant portal** (`src/pages/participant/`). Load only participant-relevant context.

@docs/roles/participant/overview.md
@docs/roles/participant/food-selection.md
@docs/shared/sensitive-areas.md
@docs/frontend/conventions.md
@docs/frontend/data-flow.md
@docs/frontend/api-layer.md

## Quick Rules
- Participant picks MUST go through `enqueueParticipantOrder` (`place-order` and `POST participants/orders/[orderId]`) — never write `orderDetail` from those routes; the job writes every pending pick of a plan in one batch
- The Redis plan lock (`lock:plan:{planId}`) serializes every write to `plan.metadata.orderDetail` (job and `withPlanLock`) — do not weaken or remove it
- The plan page waits on the Firestore job status; `submitDataInprogress` is the one busy flag (button text + disabled cart actions) — see `docs/roles/participant/food-selection.md`
- The `shoppingCart` slice is keyed `userId → planId → dayTimestamp`
- When a participant is deleted, call `removeParticipantFromOrderDetail()` (`src/utils/order.ts`) to clean up their food selections
- Monitor `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` for food selection persistence failures
