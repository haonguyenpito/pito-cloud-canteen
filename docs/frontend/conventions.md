# Frontend Conventions

## Page File Structure: `.route.tsx` + `.page.tsx`

Every portal page is split into **two files**:

| File | Role |
| --- | --- |
| `index.route.tsx` | Thin routing wrapper — renders a `<MetaWrapper>` and mounts the page component. This is the Next.js page entry point. |
| `*.page.tsx` | The actual page content — all data loading, state, and UI logic lives here. |

**Example** (`src/pages/company/booker/orders/draft/[orderId]/`):

```
index.route.tsx          ← Next.js sees this
BookerDraftOrder.page.tsx ← all logic here
BookerDraftOrderPage.slice.ts ← page-scoped Redux slice, co-located
BookerDraftOrder.module.scss
components/              ← page-local components
forms/
helpers/
hooks/
```

**Rule:** Never put business logic in `.route.tsx`. Never put routing wrappers in `.page.tsx`.

---

## Page-Local Components: `components/` or `_components/`

Shared components live in `src/components/`. Components used only by one page live **next to that page** in a local `components/` (or `_components/`) subfolder.

Do not put page-specific components in `src/components/` — they pollute the shared library.

---

## Page-Scoped Redux Slices

Each major page has its own Redux slice **co-located with the page file**, not in `src/redux/slices/`.

```
src/pages/company/booker/orders/draft/[orderId]/
  └── BookerDraftOrderPage.slice.ts    ← lives here, not in src/redux/slices/
```

This is intentional — page slices are owned by their page. All slices (both shared and page-scoped) are registered in the root reducer. See `docs/shared/redux-store.md` for the full slice inventory.

---

## Styling: SCSS Modules — NOT Tailwind

Despite Tailwind being in `package.json`, **portal pages use SCSS Modules exclusively**. Do not use Tailwind utility classes in portal pages — they will be inconsistent with the rest of the codebase.

### Design Tokens

All variables (colors, spacing, typography) are in `src/styles/vars.scss`:

```scss
@use '/src/styles/vars.scss' as *;
@use '/src/styles/mixins.scss' as *;

.root {
  color: $primaryPri2;
  @include buttonStyles;
}
```

### Component File Pair

Every styled component has:
```
Button.tsx
Button.module.scss
```

CSS module classes are applied as:
```typescript
import css from './Button.module.scss';
<div className={css.root} />
```

---

## TypeScript Naming Conventions

| Prefix | Usage | Example |
| --- | --- | --- |
| `T` | Types and interfaces | `TObject`, `TError`, `TDefaultProps` |
| `E` | Enums | `EOrderStates`, `EPaymentType` |

Sharetribe SDK types are re-exported via `src/utils/types.ts` — use those instead of importing from the SDK directly.

---

## i18n

- Default locale: **Vietnamese (`vi`)**
- Framework: `react-intl` — use `<FormattedMessage>` for all user-facing strings
- Language switching: `useLang()` hook from `src/translations/TranslationProvider.tsx`
- Date/number locale: `useLocaleTimeProvider()` returns the matching `date-fns` locale

All message keys live in `src/translations/vi.json` (Vietnamese) and `src/translations/en.json` (English).

---

## Icons

Icons are React components in `src/components/Icons/`, one per icon (e.g. `IconCheck`, `IconBell`). Use these — do not import SVGs directly or use third-party icon libraries.
