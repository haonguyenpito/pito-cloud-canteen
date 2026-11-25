import { createSlice } from '@reduxjs/toolkit';
import chunk from 'lodash/chunk';
import compact from 'lodash/compact';
import flatten from 'lodash/flatten';
import uniq from 'lodash/uniq';

import { fetchFoodListFromMenuApi } from '@apis/admin';
import { queryAllPages } from '@helpers/apiHelpers';
import { getMenuQuery } from '@helpers/listingSearchQuery';
import { createAsyncThunk } from '@redux/redux.helper';
import type { FoodListing } from '@src/types';
import { toNonAccentVietnamese } from '@src/utils/string';
import { denormalisedResponseEntities, Listing } from '@utils/data';
import type { TListing, TObject, TPagination } from '@utils/types';

type TSelectRestaurantPageSliceInitialState = {
  fetchRestaurantsPending: boolean;
  restaurants: any[] | null;
  pagination: TPagination | null;
  selectRestaurantPageError: any;

  foodOfRestaurant: string | null;
  foodList: any[];
  foodExtraFees: Record<string, number>;
  fetchFoodPending: boolean;
  fetchFoodError: any;

  selectedRestaurant: TListing | null;
  fetchSelectedRestaurantInProgress: boolean;
  fetchSelectedRestaurantError: any;
};

const initialState: TSelectRestaurantPageSliceInitialState = {
  fetchRestaurantsPending: false,
  restaurants: null,
  pagination: null,
  selectRestaurantPageError: null,
  foodOfRestaurant: null,
  foodList: [],
  foodExtraFees: {},
  fetchFoodPending: false,
  fetchFoodError: null,
  selectedRestaurant: null,
  fetchSelectedRestaurantInProgress: false,
  fetchSelectedRestaurantError: null,
};

// ================ Thunk types ================ //
const QUERY_RESTAURANTS = 'app/SelectRestaurantPage/QUERY_RESTAURANTS';
const QUERY_RESTAURANT_FOOD = 'app/SelectRestaurantPage/QUERY_RESTAURANT_FOOD';
const FETCH_SELECTED_RESTAURANT =
  'app/SelectRestaurantPage/FETCH_SELECTED_RESTAURANT';
// ================ Thunks ================ //
const getRestaurants = createAsyncThunk(
  QUERY_RESTAURANTS,
  async (params: TObject | undefined, { extra: sdk, getState }) => {
    const { order } = getState().Order;
    const {
      dateTime,
      favoriteRestaurantIdList = [],
      favoriteFoodIdList = [],
      title = '',
      page = 1,
      perPage = 10,
    } = params || {};

    const menuQuery = getMenuQuery({
      order,
      params: {
        favoriteRestaurantIdList,
        favoriteFoodIdList,
        page,
        perPage,
        timestamp: dateTime,
      },
    });

    const menuList = await queryAllPages({
      sdkModel: sdk.listings,
      query: { ...menuQuery, perPage: 100 },
    });

    const restaurantIdList: string[] = uniq(
      menuList.map((menu: TListing) => {
        const { restaurantId } = Listing(menu).getMetadata();

        return restaurantId;
      }),
    );
    const restaurantList = flatten(
      await Promise.all(
        chunk<string>(restaurantIdList, 100).map(async (ids) => {
          return denormalisedResponseEntities(
            await sdk.listings.query({
              ids,
              include: ['images'],
              keywords: title,
              'fields.image': [
                'variants.landscape-crop',
                'variants.landscape-crop2x',
              ],
            }),
          );
        }),
      ),
    );
    const restaurantWithMenuList = compact<TObject>(
      menuList.map((menu: TListing) => {
        const restaurantInfo = restaurantList.find((r: TListing) => {
          return menu?.attributes?.metadata?.restaurantId === r.id.uuid;
        });

        if (restaurantInfo) {
          return {
            restaurantInfo,
            menu,
          };
        }

        return null;
      }),
    ).sort((obj1: TObject, obj2: TObject) => {
      const title1 = toNonAccentVietnamese(
        obj1.restaurantInfo?.attributes?.title,
        true,
      );
      const title2 = toNonAccentVietnamese(
        obj2.restaurantInfo?.attributes?.title,
        true,
      );

      if (title1 < title2) return -1;
      if (title2 < title1) return 1;

      return 0;
    });

    const totalRestaurants = restaurantWithMenuList.length;
    const totalPages = Math.round(totalRestaurants / perPage + 0.5);
    const newPage = page > totalPages ? 1 : page;
    const customMeta = {
      totalItems: totalRestaurants,
      totalPages,
      page: newPage,
      paginationLimit: totalPages,
      perPage,
    };
    const suitableRestaurantList = restaurantWithMenuList.slice(
      (customMeta.page - 1) * perPage,
      customMeta.page * perPage,
    );

    return { restaurants: suitableRestaurantList, pagination: customMeta };
  },
);

/**
 * Loads the dishes a menu serves on one delivery date, with the menu's fees.
 * @param params.menuId - The menu being browsed.
 * @param params.subOrderDate - Timestamp of the delivery date.
 * @param params.favoriteFoodIdList - The company's favourite dishes.
 * @returns The dishes and the menu's `{ [foodId]: fee }` map.
 */
const getRestaurantFood = createAsyncThunk(
  QUERY_RESTAURANT_FOOD,
  async ({
    menuId,
    subOrderDate,
    favoriteFoodIdList = [],
  }: {
    menuId: string;
    subOrderDate: number | string;
    favoriteFoodIdList?: string[];
  }) => {
    const { data } = await fetchFoodListFromMenuApi({
      menuId,
      subOrderDate,
      favoriteFoodIdList,
    });
    const {
      foodList = [],
      foodExtraFees = {},
    }: {
      foodList?: FoodListing[];
      foodExtraFees?: Record<string, number>;
    } = data || {};

    return { foodList, foodExtraFees };
  },
);

const fetchSelectedRestaurant = createAsyncThunk(
  FETCH_SELECTED_RESTAURANT,
  async (restaurantId: string, { extra: sdk }) => {
    const response = await sdk.listings.show({
      id: restaurantId,
      include: ['images'],
      'fields.image': ['variants.landscape-crop', 'variants.landscape-crop2x'],
    });

    return denormalisedResponseEntities(response)[0];
  },
);

export const selectRestaurantPageThunks = {
  getRestaurants,
  getRestaurantFood,
  fetchSelectedRestaurant,
};

const SelectRestaurantPageSlice = createSlice({
  name: 'SelectRestaurantPage',
  initialState,
  reducers: {
    setSelectedRestaurant: (state, { payload }) => ({
      ...state,
      selectedRestaurant: payload,
    }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(getRestaurants.pending, (state) => {
        return {
          ...state,
          fetchRestaurantsPending: true,
          selectRestaurantPageError: null,
        };
      })
      .addCase(getRestaurants.fulfilled, (state, { payload }) => {
        const { pagination, restaurants } = payload;
        state.restaurants = restaurants;
        state.pagination = pagination;
        state.fetchRestaurantsPending = false;
      })
      .addCase(getRestaurants.rejected, (state, { error }) => {
        return {
          ...state,
          selectRestaurantPageError: error,
          fetchRestaurantsPending: false,
        };
      })

      .addCase(getRestaurantFood.pending, (state) => {
        state.fetchFoodPending = true;
        state.fetchFoodError = null;
        state.foodList = [];
        state.foodExtraFees = {};
      })
      .addCase(getRestaurantFood.fulfilled, (state, { payload }) => {
        state.fetchFoodPending = false;
        state.foodList = payload.foodList;
        state.foodExtraFees = payload.foodExtraFees;
      })
      .addCase(getRestaurantFood.rejected, (state, { error }) => {
        state.fetchFoodPending = false;
        state.fetchFoodError = error;
        state.foodList = [];
        state.foodExtraFees = {};
      })

      .addCase(fetchSelectedRestaurant.pending, (state) => {
        state.fetchSelectedRestaurantInProgress = true;
        state.fetchSelectedRestaurantError = null;
      })
      .addCase(fetchSelectedRestaurant.fulfilled, (state, { payload }) => {
        state.fetchSelectedRestaurantInProgress = false;
        state.selectedRestaurant = payload;
      })
      .addCase(fetchSelectedRestaurant.rejected, (state, { error }) => {
        state.fetchSelectedRestaurantInProgress = false;
        state.fetchSelectedRestaurantError = error;
      });
  },
});

export const { setSelectedRestaurant } = SelectRestaurantPageSlice.actions;

export default SelectRestaurantPageSlice.reducer;
