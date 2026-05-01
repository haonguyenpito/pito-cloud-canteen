import { createSlice } from '@reduxjs/toolkit';

import {
  approvePartnerMenuApi,
  getPartnerPendingMenuApi,
  getPartnerPendingMenuDetailApi,
  rejectPartnerMenuApi,
} from '@apis/admin';
import { partnerFoodApi } from '@apis/foodApi';
import { createAsyncThunk } from '@redux/redux.helper';
import type { MenuListing, TQueryParams } from '@src/types';
import type { EListingStates } from '@src/utils/enums';
import { storableError } from '@src/utils/errors';
import type { TError, TPagination } from '@src/utils/types';

// ================ Initial State ================ //
type TManagePartnersMenusState = {
  // List
  pendingMenus: (MenuListing & { restaurantName: string })[];
  pagination: TPagination;
  fetchPendingMenusInProgress: boolean;
  fetchPendingMenusError: TError | null;
  // Detail
  currentMenu: (MenuListing & { restaurantName: string }) | null;
  fetchMenuDetailInProgress: boolean;
  fetchMenuDetailError: TError | null;
  // Approve
  approveMenuInProgress: boolean;
  approveMenuError: TError | null;
  // Reject
  rejectMenuInProgress: boolean;
  rejectMenuError: TError | null;
  // Apply extra fee
  applyExtraFeeInProgress: boolean;
  applyExtraFeeError: TError | null;
};

const initialState: TManagePartnersMenusState = {
  // List
  pendingMenus: [],
  pagination: {
    page: 1,
    perPage: 20,
    totalItems: 0,
    totalPages: 1,
  },
  fetchPendingMenusInProgress: false,
  fetchPendingMenusError: null,
  // Detail
  currentMenu: null,
  fetchMenuDetailInProgress: false,
  fetchMenuDetailError: null,
  // Approve
  approveMenuInProgress: false,
  approveMenuError: null,
  // Reject
  rejectMenuInProgress: false,
  rejectMenuError: null,
  // Apply extra fee
  applyExtraFeeInProgress: false,
  applyExtraFeeError: null,
};

// ================ Async Thunks ================ //
/**
 * Fetch pending menus
 * @param payload - Query parameters
 * @returns Response with paginated menus data with restaurant name
 */
const fetchPendingMenus = createAsyncThunk<
  {
    menus: (MenuListing & { restaurantName: string })[];
    pagination: TPagination;
  },
  TQueryParams
>(
  'admin/ManagePartnersMenus/FETCH_PENDING_MENUS',
  async (payload: TQueryParams, { rejectWithValue }) => {
    try {
      const response = await getPartnerPendingMenuApi({
        page: payload.page,
        perPage: payload.perPage,
      });

      return {
        menus: response.data.data || [],
        pagination: response.data.pagination || {
          page: 1,
          perPage: 20,
          totalItems: 0,
          totalPages: 1,
        },
      };
    } catch (error) {
      return rejectWithValue(storableError(error));
    }
  },
);

/**
 * Fetch menu detail
 * @param payload - Menu ID
 * @returns Response with menu detail with restaurant name
 */
const fetchMenuDetail = createAsyncThunk<
  MenuListing & { restaurantName: string },
  { menuId: string }
>(
  'admin/ManagePartnersMenus/FETCH_MENU_DETAIL',
  async (payload: { menuId: string }, { rejectWithValue }) => {
    try {
      const { menuId } = payload;
      const response = await getPartnerPendingMenuDetailApi(menuId);

      if (!response.data.data) {
        return rejectWithValue(storableError(new Error('Menu not found')));
      }

      return response.data.data;
    } catch (error) {
      return rejectWithValue(storableError(error));
    }
  },
);

/**
 * Approve menu
 * @param payload - Menu ID
 * @returns Response with menu ID
 */
const approveMenu = createAsyncThunk<
  { id: string; status: EListingStates },
  { menuId: string }
>(
  'admin/ManagePartnersMenus/APPROVE_MENU',
  async (payload: { menuId: string }, { rejectWithValue }) => {
    try {
      const { menuId } = payload;
      const response = await approvePartnerMenuApi(menuId);

      if (!response.data.data) {
        return rejectWithValue(storableError(new Error('Menu not found')));
      }

      return response.data.data;
    } catch (error) {
      return rejectWithValue(storableError(error));
    }
  },
);

/**
 * Reject menu
 * @param payload - Menu ID and reason
 * @returns Response with menu
 */
const rejectMenu = createAsyncThunk<
  { id: string; status: EListingStates },
  { menuId: string; reason: string }
>(
  'admin/ManagePartnersMenus/REJECT_MENU',
  async (payload: { menuId: string; reason: string }, { rejectWithValue }) => {
    try {
      const { menuId, reason } = payload;
      const response = await rejectPartnerMenuApi(menuId, reason);

      if (!response.data.data) {
        return rejectWithValue(storableError(new Error('Menu not found')));
      }

      return response.data.data;
    } catch (error) {
      return rejectWithValue(storableError(error));
    }
  },
);

const applyExtraFeeToMenus = createAsyncThunk<
  void,
  { selectedMenuIds: string[]; menus: (MenuListing & { restaurantName: string })[]; extraFee: number }
>(
  'admin/ManagePartnersMenus/APPLY_EXTRA_FEE',
  async ({ selectedMenuIds, menus, extraFee }, { rejectWithValue }) => {
    try {
      const selectedMenus = menus.filter((m) =>
        selectedMenuIds.includes(m.id?.uuid ?? ''),
      );

      const foodIdSet = new Set<string>();
      selectedMenus.forEach((menu) => {
        const foodsByDate = menu.attributes?.publicData?.foodsByDate || {};
        Object.values(foodsByDate).forEach((foodsOnDay: any) => {
          Object.values(foodsOnDay).forEach((foodItem: any) => {
            if (foodItem?.id) foodIdSet.add(foodItem.id);
          });
        });
      });

      await Promise.all(
        Array.from(foodIdSet).map((foodId) =>
          partnerFoodApi.updateFood(foodId, {
            dataParams: { id: foodId, publicData: { extraFee } },
            queryParams: {},
          }),
        ),
      );
    } catch (error) {
      return rejectWithValue(error);
    }
  },
);

export const ManagePartnersMenusThunks = {
  fetchPendingMenus,
  fetchMenuDetail,
  approveMenu,
  rejectMenu,
  applyExtraFeeToMenus,
};

// ================ Slice ================ //
const ManagePartnersMenusSlice = createSlice({
  name: 'admin/ManagePartnersMenus',
  initialState,
  reducers: {
    clearCurrentMenu: (state) => {
      state.currentMenu = null;
      state.fetchMenuDetailError = null;
    },
    clearErrors: (state) => {
      state.fetchPendingMenusError = null;
      state.fetchMenuDetailError = null;
      state.approveMenuError = null;
      state.rejectMenuError = null;
    },
    // For testing with mock data
    setMockPendingMenus: (state, { payload }) => {
      state.pendingMenus = payload;
    },
    setMockCurrentMenu: (state, { payload }) => {
      state.currentMenu = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // =============== fetchPendingMenus ===============
      .addCase(fetchPendingMenus.pending, (state) => {
        state.fetchPendingMenusInProgress = true;
        state.fetchPendingMenusError = null;
      })
      .addCase(fetchPendingMenus.fulfilled, (state, { payload }) => {
        state.fetchPendingMenusInProgress = false;
        state.pendingMenus = payload.menus || [];
        state.pagination = payload.pagination || {
          page: 1,
          perPage: 20,
          totalItems: 0,
          totalPages: 1,
        };
      })
      .addCase(fetchPendingMenus.rejected, (state, { payload }) => {
        state.fetchPendingMenusInProgress = false;
        state.fetchPendingMenusError = (payload as TError) || null;
      })
      // =============== fetchMenuDetail ===============
      .addCase(fetchMenuDetail.pending, (state) => {
        state.fetchMenuDetailInProgress = true;
        state.fetchMenuDetailError = null;
      })
      .addCase(fetchMenuDetail.fulfilled, (state, { payload }) => {
        state.fetchMenuDetailInProgress = false;
        state.currentMenu = payload;
      })
      .addCase(fetchMenuDetail.rejected, (state, { payload }) => {
        state.fetchMenuDetailInProgress = false;
        state.fetchMenuDetailError = payload as any;
      })
      // =============== approveMenu ===============
      .addCase(approveMenu.pending, (state) => {
        state.approveMenuInProgress = true;
        state.approveMenuError = null;
      })
      .addCase(approveMenu.fulfilled, (state, { payload }) => {
        state.approveMenuInProgress = false;
        state.pendingMenus = state.pendingMenus.filter(
          (menu) => menu.id?.uuid !== payload.id,
        );
      })
      .addCase(approveMenu.rejected, (state, { payload }) => {
        state.approveMenuInProgress = false;
        state.approveMenuError = payload as any;
      })
      // =============== rejectMenu ===============
      .addCase(rejectMenu.pending, (state) => {
        state.rejectMenuInProgress = true;
        state.rejectMenuError = null;
      })
      .addCase(rejectMenu.fulfilled, (state, { payload }) => {
        state.rejectMenuInProgress = false;
        // Remove rejected menu from pending list
        state.pendingMenus = state.pendingMenus.filter(
          (menu) => menu.id?.uuid !== payload.id,
        );
      })
      .addCase(rejectMenu.rejected, (state, { payload }) => {
        state.rejectMenuInProgress = false;
        state.rejectMenuError = payload as any;
      })
      // =============== applyExtraFeeToMenus ===============
      .addCase(applyExtraFeeToMenus.pending, (state) => {
        state.applyExtraFeeInProgress = true;
        state.applyExtraFeeError = null;
      })
      .addCase(applyExtraFeeToMenus.fulfilled, (state) => {
        state.applyExtraFeeInProgress = false;
      })
      .addCase(applyExtraFeeToMenus.rejected, (state, { payload }) => {
        state.applyExtraFeeInProgress = false;
        state.applyExtraFeeError = payload as TError;
      });
  },
});

// ================ Actions ================ //
export const ManagePartnersMenusActions = ManagePartnersMenusSlice.actions;
export default ManagePartnersMenusSlice.reducer;
