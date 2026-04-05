# Frontend Data Flow

## Overview

```
Component (useAppSelector / useAppDispatch)
    │
    ▼
Redux Slice (state, reducers)
    │
    ▼
Async Thunk (createAsyncThunk)
    │
    ├──► API Layer (src/apis/) → Next.js API routes → server logic
    └──► Sharetribe client SDK (via thunk.extra) → Sharetribe directly
    │
    ▼
Response normalized / error serialized
    │
    ▼
Reducer (fulfilled / rejected) updates state
    │
    ▼
Component re-renders
```

---

## CSR-First: No SSR on Portal Pages

All portal pages (admin, company, participant, partner) load data **client-side**. There is no `getServerSideProps` or `getStaticProps` on portal pages.

The standard pattern:

```typescript
// *.page.tsx
const MyPage = () => {
  const dispatch = useAppDispatch();
  const { orderId } = useRouter().query;
  const order = useAppSelector(state => state.MyPageSlice.order, shallowEqual);
  const loadDataInProgress = useAppSelector(state => state.MyPageSlice.loadDataInProgress);

  useEffect(() => {
    if (orderId) {
      dispatch(myPageThunks.loadData(orderId as string));
    }
  }, [orderId]);

  if (loadDataInProgress) return <LoadingSpinner />;
  return <div>{/* render order */}</div>;
};
```

---

## Redux Typed Hooks

Always use the typed hooks from `src/hooks/reduxHooks.ts`:

```typescript
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';

const dispatch = useAppDispatch();
const value = useAppSelector(state => state.slice.property);

// For complex/nested state — prevents unnecessary re-renders:
const value = useAppSelector(state => state.slice.property, shallowEqual);
```

Never use raw `useDispatch` or `useSelector` — they are untyped.

---

## Async Thunk Pattern

All thunks use the custom `createAsyncThunk` wrapper from `src/redux/redux.helper.ts` (not Redux Toolkit's directly — the wrapper adds correct `RootState` typing):

```typescript
import { createAsyncThunk } from '@redux/redux.helper';

const loadData = createAsyncThunk(
  'MyPage/LOAD_DATA',
  async (orderId: string, { extra: sdk, getState, dispatch, fulfillWithValue, rejectWithValue }) => {
    try {
      const { data } = await orderApi.getOrderApi(orderId);
      return fulfillWithValue(data);
    } catch (error) {
      return rejectWithValue({ error: storableError(error) });
    }
  },
  {
    serializeError: storableAxiosError, // use for HTTP API errors
  },
);

export const myPageThunks = { loadData };
```

**Key rules:**
- Always export thunks as a named `thunks` object from the slice
- Use `storableError` for SDK/general errors, `storableAxiosError` for HTTP errors
- Every async operation tracks `loadDataInProgress: boolean` + `loadDataError: TError | null` in state

---

## Sharetribe Client SDK in Thunks

The Sharetribe **client-side SDK** is injected into Redux middleware as `thunk.extraArgument`. Access it in any thunk:

```typescript
const uploadAvatar = createAsyncThunk(
  'user/UPLOAD_AVATAR',
  async (file: File, { extra: sdk }) => {
    const response = await sdk.images.upload({ image: file });
    const [image] = denormalisedResponseEntities(response);
    return image;
  }
);
```

**Important:** This is the **browser-side Sharetribe SDK** (uses the user's cookie token). It is different from the server-side Integration SDK used in API routes. The browser SDK can only do what the logged-in user is permitted to do.

---

## Sharetribe Response Denormalization

Sharetribe SDK responses use [JSON:API](https://jsonapi.org/) format — entities are deeply nested with `id`, `type`, and `relationships`. **Always** call `denormalisedResponseEntities` before using the data:

```typescript
import { denormalisedResponseEntities } from '@utils/data';

const response = await sdk.currentUser.show();
const [currentUser] = denormalisedResponseEntities(response);
// currentUser is now a flat object with all relationships resolved
```

Forgetting this gives you a raw JSON:API envelope instead of a usable entity.

Helper constructors `User(entity)` and `Listing(entity)` in `src/utils/data.ts` provide typed accessors on top of denormalized entities:

```typescript
const { isAdmin } = CurrentUser(currentUser).getMetadata();
```

---

## Deep Equal Selectors

For selectors that return derived/complex objects, use `createDeepEqualSelector` from `src/redux/redux.helper.ts` to prevent unnecessary re-renders:

```typescript
import { createDeepEqualSelector } from '@redux/redux.helper';

const selectFilteredOrders = createDeepEqualSelector(
  (state: RootState) => state.OrderManagement.orders,
  (state: RootState) => state.OrderManagement.filters,
  (orders, filters) => orders.filter(/* ... */)
);
```

---

## Error Handling in Slices

Every async operation follows the same state shape:

```typescript
type TMyPageState = {
  loadDataInProgress: boolean;
  loadDataError: TError | null;
  data: TOrderData | null;
};

// In extraReducers:
.addCase(loadData.pending, (state) => {
  state.loadDataInProgress = true;
  state.loadDataError = null;
})
.addCase(loadData.fulfilled, (state, action) => {
  state.loadDataInProgress = false;
  state.data = action.payload;
})
.addCase(loadData.rejected, (state, action) => {
  state.loadDataInProgress = false;
  state.loadDataError = action.error as TError;
})
```

`TError` shape (from `src/utils/errors.ts`):
```typescript
{
  type: 'error';
  name?: string;
  message?: string;
  status?: number;           // HTTP status
  apiErrors?: { code: string }[]; // Sharetribe-specific error codes
}
```
