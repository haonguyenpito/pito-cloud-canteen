Apply Test-Driven Development for the task described by the user.

## Your Testing Environment

- **Framework:** Jest + ts-jest (`jest.config.js`)
- **Test root:** `tests/` (NOT co-located with `src/`)
  - `tests/safeguards/` — unit tests for pure functions, helpers, services, utils
  - `tests/integration/` — full API route tests (real logic, mocked external SDKs)
- **File naming:** `<subject>.test.ts`
- **Run tests:** `yarn test` or `yarn test --coverage`
- **Coverage thresholds** (enforced at 70% lines/functions):
  - `src/helpers/order/`
  - `src/services/jobs/`
  - `src/services/permissionChecker/`
  - `src/pages/api/orders/`
  - `src/pages/api/admin/payment/`

## Always-Mocked Globals

`sharetribe-flex-integration-sdk` is mocked globally via `tests/__mocks__/`. Never import real integration SDK in tests — it throws at load time without env vars.

For other external deps (BullMQ, Redis, Firebase), mock them per-test-file using `jest.mock()` at the top — see `tests/safeguards/food-selection-job.test.ts` for the pattern.

## TDD Cycle to Follow

**Red → Green → Refactor**

1. **Read** the source file(s) to understand what needs to be implemented or changed
2. **Write the test first** — one failing test that captures the requirement
3. **Run it** (`yarn test <testfile>`) — confirm it fails for the right reason
4. **Implement** the minimum code to make it pass
5. **Run again** — confirm it passes
6. **Refactor** if needed, keeping tests green
7. Repeat for each additional case

## Test File Header Convention

Every test file starts with a block comment explaining WHY these tests exist:

```typescript
/**
 * <SUBJECT> SAFEGUARDS / TESTS
 *
 * WHY THIS MATTERS:
 * - <business risk if this breaks>
 * - <edge case or invariant being protected>
 *
 * Source: <path to source file being tested>
 */
```

## What to Test

**Cover these cases in order:**
1. Happy path — normal expected input/output
2. Edge cases — empty arrays, zero values, boundary timestamps
3. Error paths — invalid input, missing fields, external service failures
4. Invariants from `docs/shared/sensitive-areas.md` (payment calc, lock behavior, permission gates)

## What NOT to Mock

- Pure utility functions — test them directly, no mocking needed
- `src/utils/`, `src/helpers/` — these should be tested without mocks

## Path Aliases in Tests

Use the same `@`-aliases as source code:
```typescript
import { fn } from '@helpers/order/cartInfoHelper'
import { fn } from '@utils/order'
import { fn } from '@services/permissionChecker/admin'
```

---

<!-- CUSTOMIZE THIS SECTION: add your team's specific conventions, extra coverage requirements, or testing patterns below -->

## Project-Specific Rules

<!-- e.g.:
- All new functions in src/helpers/ must have 100% line coverage
- Integration tests must not call real Firebase — use jest.mock('@services/firebase')
- Always test the Vietnamese locale edge cases for date/number formatting
-->
