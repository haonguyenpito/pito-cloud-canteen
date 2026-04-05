# Booker (Company) Role — Overview

## What Bookers Do

Bookers are corporate administrators who manage lunch orders on behalf of their company. They:

- Create new recurring orders (date-range meal plans)
- Configure restaurant assignments and food selections
- Manage participant lists
- Track order status through to payment
- Cancel orders when needed

---

## Portal

**URL prefix:** `/company/*`

Bookers are identified by `currentUser.attributes.profile.publicData.userType === 'booker'`.

---

## Booker Redux Slices

| Slice                    | File                                                                                | State Managed                         |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------- |
| `Quiz`                   | `src/redux/slices/Quiz.slice.ts`                                                    | New order wizard multi-step state     |
| `company`                | `src/redux/slices/company.slice.ts`                                                 | Current company details               |
| `BookerCompanies`        | `src/redux/slices/BookerCompanies.slice.ts`                                         | All companies the booker manages      |
| `companyMember`          | `src/redux/slices/companyMember.slice.ts`                                           | Company member list and management    |
| `priceQuotation`         | `src/redux/slices/priceQuotation.slice.ts`                                          | Quotation data for price breakdowns   |
| `Order`                  | `src/redux/slices/Order.slice.ts`                                                   | Active order + plan + quotation       |
| `BookerDraftOrderPage`   | `src/pages/company/booker/orders/draft/[orderId]/BookerDraftOrderPage.slice.ts`     | Draft order editing page state        |
| `BookerSelectRestaurant` | `src/pages/company/booker/orders/draft/[orderId]/restaurants/BookerSelectRestaurant.slice.ts` | Restaurant selection during draft |
| `BookerNewOrderPage`     | `src/pages/company/booker/orders/new/BookerNewOrder.slice.ts`                       | New order wizard navigation state     |
| `OrderRating`            | `src/pages/company/orders/[orderId]/rating/OrderRating.slice.ts`                    | Order rating submission form          |
| `Nutrition`              | `src/pages/company/[companyId]/nutrition/Nutrition.slice.ts`                        | Nutrition tracking analytics          |

---

## Key Docs

- `docs/roles/booker/order-creation.md` — Quiz wizard, order setup, quotation, publishing
- `docs/roles/booker/order-lifecycle.md` — Picking → start → delivery → payment → review + cancel flow
- `docs/shared/auth-flow.md` — Authentication and session management
- `docs/shared/notification-flow.md` — What notifications bookers receive
