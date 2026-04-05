# Frontend API Layer

## Overview

All HTTP calls from the browser go through `src/apis/configs.ts` helper functions. These call Next.js API routes (`/api/*`) — never external services directly.

**File:** `src/apis/configs.ts`

---

## Base URL

```typescript
// Development: http://localhost:{PORT}/api
// Production:  {window.location.origin}/api
```

The base URL is determined at runtime. Never hardcode `/api` paths — always use the exported helper functions.

---

## Core Functions

```typescript
getApi(path, params?, options?)        // GET  — params encoded as JSONParams
postApi(path, body, options?)          // POST
putApi(path, body)                     // PUT
patchApi(path, body, options?)         // PATCH
deleteApi(path, data?)                 // DELETE — params encoded as JSONParams
getDedupApi(path, params?)             // GET with in-flight request deduplication
```

---

## `JSONParams` Encoding — GET and DELETE

**This is the most common mistake.** GET and DELETE requests with object params must encode them using `JSONParams`:

```typescript
// ✅ Correct — what getApi() does internally:
params: { JSONParams: JSON.stringify({ orderId, status: 'active' }) }

// ❌ Wrong — standard query params will not be parsed correctly by the backend:
params: { orderId, status: 'active' }
```

On the **server side**, API routes must decode them:
```typescript
const params = JSON.parse(req.query.JSONParams as string);
```

This is already handled by `getApi()` and `getDedupApi()` — just pass a plain object as `params` and the encoding happens automatically.

---

## `getDedupApi` vs `getApi`

`getDedupApi` deduplicates in-flight requests using a key of `{ method, url, params, data }`. If an identical request is already in-flight, the second call returns the same Promise instead of making a new HTTP request.

| Use `getApi` when... | Use `getDedupApi` when... |
| --- | --- |
| Request fires once per user action | Request may fire multiple times simultaneously |
| Form submissions, mutations | Data loading triggered by scroll, resize, concurrent renders |
| One-off fetches | High-frequency reads on shared data |

```typescript
// In an API module (src/apis/orderApi.ts):
export const getOrderApi = (orderId: string) =>
  getDedupApi<TOrderResponse>(`/orders/${orderId}`);

export const updateOrderApi = (orderId: string, body: TUpdateOrderBody) =>
  putApi(`/orders/${orderId}`, body);
```

---

## AbortSignal Support

All `getApi`, `postApi`, and `patchApi` calls accept `{ signal: AbortSignal }` to cancel in-flight requests. Use this to avoid state updates after a component unmounts:

```typescript
useEffect(() => {
  const controller = new AbortController();

  dispatch(myThunks.loadData({ orderId, signal: controller.signal }));

  return () => controller.abort();
}, [orderId]);
```

In the thunk:
```typescript
const loadData = createAsyncThunk(
  'MyPage/LOAD_DATA',
  async ({ orderId, signal }: { orderId: string; signal?: AbortSignal }) => {
    const { data } = await getOrderApi(orderId, {}, { signal });
    return data;
  }
);
```

---

## API Module Conventions

Each domain has its own API module in `src/apis/`:

```
src/apis/
├── orderApi.ts         — order CRUD
├── companyApi.ts       — company management
├── participantApi.ts   — participant operations
├── partnerApi.ts       — partner/restaurant operations
├── menuApi.ts          — menu catalog
├── foodApi.ts          — food catalog
├── userApi.ts          — user management
├── adminApi.ts         — admin operations
├── notificationApi.ts  — notifications
├── reviewApi.ts        — ratings & reviews
├── txApi.ts            — transactions/payments
└── ...
```

**Type safety:** API functions import request/response types directly from the corresponding Next.js API route file:

```typescript
import type { POSTUpdateStateBody } from '@pages/api/admin/listings/order/[orderId]/update-state.api';

export const updateOrderStateApi = (orderId: string, body: POSTUpdateStateBody) =>
  postApi(`/admin/listings/order/${orderId}/update-state`, body);
```

This ensures the frontend contract stays in sync with the backend — a type mismatch becomes a compile error.
