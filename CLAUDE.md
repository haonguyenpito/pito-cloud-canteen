# PITO Cloud Canteen — AI Context Guide

> Production is live. Do not change business logic without explicit instruction.

**PITO Cloud Canteen** is a B2B corporate lunch delivery marketplace (Vietnam, Vietnamese locale `vi`).
- **Companies (bookers)** order recurring daily lunches for employees
- **Participants (employees)** pick individual food from the daily menu
- **Partners (restaurants)** fulfill the meal orders
- **Admins (PITO operators)** oversee the entire lifecycle

An "order" is a date-range meal plan. Each delivery date is a "sub-order" backed by a Sharetribe Flex transaction.

---

## Tech Stack

Next.js 13 (TypeScript) · Tailwind CSS · Redux Toolkit · Sharetribe Flex · Firebase Firestore · BullMQ + Redis · AWS EventBridge + Lambda · AWS SES · OneSignal · Algolia · Slack webhooks · Sentry · Vercel

---

## Role-Based Docs (load only what you need)

| Role            | Source directory         | CLAUDE.md auto-loaded       | Full docs                         |
| --------------- | ------------------------ | --------------------------- | --------------------------------- |
| Admin           | `src/pages/admin/`       | `src/pages/admin/CLAUDE.md` | `docs/roles/admin/`               |
| Company/Booker  | `src/pages/company/`     | `src/pages/company/CLAUDE.md` | `docs/roles/booker/`            |
| Participant     | `src/pages/participant/` | `src/pages/participant/CLAUDE.md` | `docs/roles/participant/`   |
| Partner         | `src/pages/partner/`     | `src/pages/partner/CLAUDE.md` | `docs/roles/partner/`           |

When working in a role's source directory, the role-specific CLAUDE.md is auto-loaded with `@import` refs to the right docs. You do not need to read other roles' docs.

**For cross-cutting tasks**, use slash commands to explicitly set focus:
- `/admin` — load admin context only
- `/booker` — load booker context only
- `/participant` — load participant context only
- `/partner` — load partner context only

---

## Shared Docs (cross-role, load when relevant)

- `docs/shared/auth-flow.md` — Sharetribe SDK auth, SDK modes, sub-account pattern, route guards
- `docs/shared/notification-flow.md` — All 4 channels: Firebase, OneSignal, Slack, SES (full enum tables)
- `docs/shared/transaction-flow.md` — Sharetribe transaction state machine (`sub-order-transaction-process/release-2`)
- `docs/shared/services.md` — All external service integrations + Lambda ARN map
- `docs/shared/redux-store.md` — All 54 Redux slices inventory
- `docs/shared/sensitive-areas.md` — **Read before touching money, order state, auth, or food selection**

---

## Critical Invariants (applies to all roles)

@docs/shared/sensitive-areas.md

Quick summary — never do these:
- Write directly to `plan.metadata.orderDetail` outside BullMQ + Redis lock
- Call `initiate-transaction` more than once per sub-order date
- Expose `ENCRYPT_PASSWORD_SECRET_KEY` in logs or client code
- Change VAT logic without verifying all 3 modes (`vat`, `noExportVat`, `direct`)
- Delete Sharetribe order/plan/quotation listings — use state fields instead
- Mismatch `bookingProcessAlias` in `src/configs.ts` with the deployed Sharetribe process alias
- Use UTC instead of `Asia/Ho_Chi_Minh` for EventBridge schedule expressions

---

## Project Structure

```
src/
├── pages/
│   ├── admin/        — Admin portal + CLAUDE.md
│   ├── company/      — Booker portal + CLAUDE.md
│   ├── participant/  — Participant portal + CLAUDE.md
│   ├── partner/      — Partner portal + CLAUDE.md
│   └── api/          — All API routes (admin/, orders/, plans/, users/, webhook/)
├── redux/            — Store + all slices
├── services/         — Firebase, AWS, BullMQ, SDK wrappers
├── helpers/          — Price calc, date utils
├── utils/            — Enums, order/transaction helpers
└── services/permissionChecker/ — Role guards for all portals
transaction-process/process.edn — Sharetribe transaction process (deploy via Sharetribe CLI)
```
