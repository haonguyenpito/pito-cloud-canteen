import { createSlice } from '@reduxjs/toolkit';
import uniq from 'lodash/uniq';

import {
  approvePartnerMenuApi,
  getPartnerPendingMenuApi,
  getPartnerPendingMenuDetailApi,
  rejectPartnerMenuApi,
} from '@apis/admin';
import { updateMenuExtraFeesApi } from '@apis/menuApi';
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
  // Per-dish extra fee on the menu detail screen
  saveMenuExtraFeesInProgress: boolean;
  saveMenuExtraFeesError: TError | null;
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
  // Per-dish extra fee
  saveMenuExtraFeesInProgress: false,
  saveMenuExtraFeesError: null,
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

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Every dish in a menu, from the same metadata index the server prunes against.
 */
const getMenuFoodIds = (menu: MenuListing): string[] => {
  const metadata = menu.attributes?.metadata as any;

  return uniq(
    DAY_KEYS.flatMap(
      (day) => (metadata?.[`${day}FoodIdList`] as string[]) || [],
    ),
  );
};

/** One fee for every dish of a menu. */
const buildFlatExtraFeeMap = (menu: MenuListing, extraFee: number) =>
  getMenuFoodIds(menu).reduce<Record<string, number>>(
    (result, foodId) => ({ ...result, [foodId]: extraFee }),
    {},
  );

/**
 * Applies one fee to every dish of every selected menu.
 *
 * The fee is stored on the MENU, so the same dish keeps a different fee in a
 * different menu. This must never write to food listings.
 */
const applyExtraFeeToMenus = createAsyncThunk<
  { menuIds: string[]; extraFee: number },
  {
    selectedMenuIds: string[];
    menus: (MenuListing & { restaurantName: string })[];
    extraFee: number;
  }
>(
  'admin/ManagePartnersMenus/APPLY_EXTRA_FEE',
  async ({ selectedMenuIds, menus, extraFee }, { rejectWithValue }) => {
    try {
      const selectedMenus = menus.filter((menu) =>
        selectedMenuIds.includes(menu.id?.uuid ?? ''),
      );

      await Promise.all(
        selectedMenus.map((menu) =>
          updateMenuExtraFeesApi(menu.id?.uuid ?? '', {
            extraFees: buildFlatExtraFeeMap(menu, extraFee),
            mode: 'replace',
          }),
        ),
      );

      return { menuIds: selectedMenuIds, extraFee };
    } catch (error) {
      return rejectWithValue(storableError(error));
    }
  },
);

/**
 * Saves the per-dish fee map for one menu (menu detail screen).
 *
 * The screen shows every dish in the menu, so it submits the complete picture
 * in `replace` mode — clearing a field means that dish is no longer surcharged.
 */
const saveMenuExtraFees = createAsyncThunk<
  { menuId: string; extraFees: Record<string, number> },
  { menuId: string; extraFees: Record<string, number> }
>(
  'admin/ManagePartnersMenus/SAVE_MENU_EXTRA_FEES',
  async ({ menuId, extraFees }, { rejectWithValue }) => {
    try {
      await updateMenuExtraFeesApi(menuId, { extraFees, mode: 'replace' });

      return { menuId, extraFees };
    } catch (error) {
      return rejectWithValue(storableError(error));
    }
  },
);

export const ManagePartnersMenusThunks = {
  fetchPendingMenus,
  fetchMenuDetail,
  approveMenu,
  rejectMenu,
  applyExtraFeeToMenus,
  saveMenuExtraFees,
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
      .addCase(applyExtraFeeToMenus.fulfilled, (state, { payload }) => {
        state.applyExtraFeeInProgress = false;
        // Mirror the write locally so the column refreshes without a refetch.
        state.pendingMenus = state.pendingMenus.map((menu) => {
          if (!payload.menuIds.includes(menu.id?.uuid ?? '')) {
            return menu;
          }

          return {
            ...menu,
            attributes: {
              ...menu.attributes,
              publicData: {
                ...menu.attributes?.publicData,
                foodExtraFees: buildFlatExtraFeeMap(menu, payload.extraFee),
              },
            },
          } as MenuListing & { restaurantName: string };
        });
      })
      .addCase(applyExtraFeeToMenus.rejected, (state, { payload }) => {
        state.applyExtraFeeInProgress = false;
        state.applyExtraFeeError = payload as TError;
      })
      // =============== saveMenuExtraFees ===============
      .addCase(saveMenuExtraFees.pending, (state) => {
        state.saveMenuExtraFeesInProgress = true;
        state.saveMenuExtraFeesError = null;
      })
      .addCase(saveMenuExtraFees.fulfilled, (state, { payload }) => {
        state.saveMenuExtraFeesInProgress = false;
        // Mirror the write into the list so the row summary and the open panel
        // both re-read the saved values without a refetch.
        state.pendingMenus = state.pendingMenus.map((menu) =>
          menu.id?.uuid === payload.menuId
            ? ({
                ...menu,
                attributes: {
                  ...menu.attributes,
                  publicData: {
                    ...menu.attributes?.publicData,
                    foodExtraFees: payload.extraFees,
                  },
                },
              } as MenuListing & { restaurantName: string })
            : menu,
        );
      })
      .addCase(saveMenuExtraFees.rejected, (state, { payload }) => {
        state.saveMenuExtraFeesInProgress = false;
        state.saveMenuExtraFeesError = payload as TError;
      });
  },
});

// ================ Actions ================ //
export const ManagePartnersMenusActions = ManagePartnersMenusSlice.actions;
export default ManagePartnersMenusSlice.reducer;
