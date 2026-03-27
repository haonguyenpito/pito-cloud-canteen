import { createSlice } from '@reduxjs/toolkit';
import { uniq } from 'lodash';
import uniqBy from 'lodash/uniqBy';

import {
  fetchFoodListFromMenuApi,
  getRestaurantFoodsApi,
  searchRestaurantListFromMenuApi,
} from '@apis/admin';
import { updatePlanDetailsApi } from '@apis/orderApi';
import {
  deleteRecentKeywordApi,
  fetchRecommendedKeywordsApi,
} from '@apis/restaurant';
import type { TMenuQueryParams } from '@helpers/listingSearchQuery';
import { sortRestaurants } from '@helpers/sort';
import { createAsyncThunk } from '@redux/redux.helper';
// eslint-disable-next-line import/no-cycle
import { orderAsyncActions } from '@redux/slices/Order.slice';
import type {
  FlexDSKMeta,
  RatingListing,
  UserListing,
  WithFlexSDKData,
} from '@src/types';
import type { TFoodInRestaurant } from '@src/types/bookerSelectRestaurant';
import { denormalisedResponseEntities, Listing } from '@utils/data';
import { EImageVariants, EListingType } from '@utils/enums';
import type { TListing, TObject, TUser } from '@utils/types';

export const MANAGE_ORDER_PAGE_SIZE = 10;

type WithReviewer<T> = T & {
  reviewer: UserListing;
};

export type RatingListingWithReviewer = WithReviewer<RatingListing>;

const parseHiddenReviewUserIds = (value: string | undefined) => {
  const raw = (value || '').trim();
  if (!raw) {
    return [];
  }

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => String(id || '').trim()).filter(Boolean);
      }
    } catch (error) {
      console.error('Error parsing hidden review user ids', error);
    }
  }

  return raw
    .split(',')
    .map((id) => id.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
};

const hiddenReviewUserIds = new Set(
  parseHiddenReviewUserIds(process.env.NEXT_PUBLIC_HIDDEN_REVIEWS_USER_IDS),
);

// ================ Initial states ================ //
type TOrderInitialState = {
  restaurant: TListing | null;
  restaurantIdList: string[];

  searchResult: TListing[];
  totalItems: number;
  combinedRestaurantMenuData: {
    restaurantId: string;
    menuId: string;
  }[];
  combinedRestaurantInFoods: TFoodInRestaurant[];
  foodsByRestaurantAndTimestamp: TFoodInRestaurant[];

  searchInProgress: boolean;

  order: TListing | null;
  fetchOrderInProgress: boolean;
  fetchOrderError: any;

  planDetail: TListing | null;
  fetchPlanDetailInProgress: boolean;
  fetchPlanDetailError: any;

  updatePlanDetailInProgress: boolean;
  updatePlanDetailError: any;

  companyAccount: TUser | null;
  fetchCompanyAccountInProgress: boolean;
  fetchCompanyAccountError: any;

  restaurantFood: {
    [restaurantId: string]: TListing[];
  };
  fetchRestaurantFoodInProgress: boolean;
  fetchRestaurantFoodError: any;

  currentMenuId?: string;
  selectedRestaurantId: string;

  restaurantBookerReviews: RatingListingWithReviewer[];
  restaurantBookerReviewsMeta?: FlexDSKMeta;

  restaurantParticipantReviews: RatingListingWithReviewer[];
  restaurantParticipantReviewsMeta?: FlexDSKMeta;

  fetchRestaurantReviewInProgress: boolean;
  fetchRestaurantReviewError: any;

  fetchRecommendedKeywordsInProgress: boolean;
  fetchRecommendedKeywordsError: any;
  popularKeywords: string[];
  recentKeywords: string[];
};

const initialState: TOrderInitialState = {
  restaurant: null,
  restaurantIdList: [],

  searchResult: [],
  totalItems: 0,
  combinedRestaurantMenuData: [],
  combinedRestaurantInFoods: [],
  foodsByRestaurantAndTimestamp: [],

  searchInProgress: false,

  order: null,
  fetchOrderInProgress: false,
  fetchOrderError: null,

  planDetail: null,
  fetchPlanDetailInProgress: false,
  fetchPlanDetailError: null,

  updatePlanDetailInProgress: false,
  updatePlanDetailError: null,

  companyAccount: null,
  fetchCompanyAccountInProgress: false,
  fetchCompanyAccountError: null,

  restaurantFood: {},
  fetchRestaurantFoodInProgress: false,
  fetchRestaurantFoodError: null,

  currentMenuId: undefined,

  restaurantBookerReviews: [],
  restaurantBookerReviewsMeta: null!,

  restaurantParticipantReviews: [],
  restaurantParticipantReviewsMeta: null!,

  fetchRestaurantReviewInProgress: false,
  fetchRestaurantReviewError: null,

  selectedRestaurantId: '',

  fetchRecommendedKeywordsInProgress: false,
  fetchRecommendedKeywordsError: null,
  popularKeywords: [],
  recentKeywords: [],
};

// ================ Thunk types ================ //
const FETCH_RESTAURANT = 'app/BookerSelectRestaurant/FETCH_RESTAURANT';
const FETCH_RECOMMENDED_KEYWORDS =
  'app/BookerSelectRestaurant/FETCH_RECOMMENDED_KEYWORDS';
const DELETE_RECENT_KEYWORD =
  'app/BookerSelectRestaurant/DELETE_RECENT_KEYWORD';
const SEARCH_RESTAURANT = 'app/BookerSelectRestaurant/SEARCH_RESTAURANT';
const FETCH_FOODS_BY_RESTAURANT_AND_TIMESTAMPS =
  'app/BookerSelectRestaurant/FETCH_FOODS_BY_RESTAURANT_AND_TIMESTAMPS';
const FETCH_FOOD_LIST_FROM_RESTAURANT =
  'app/BookerSelectRestaurant/FETCH_FOOD_LIST_FROM_RESTAURANT';
const FETCH_ORDER = 'app/BookerSelectRestaurant/FETCH_ORDER';
const FETCH_PLAN_DETAIL = 'app/BookerSelectRestaurant/FETCH_PLAN_DETAIL';
const UPDATE_PLAN_DETAIL = 'app/BookerSelectRestaurant/UPDATE_PLAN_DETAIL';
const FETCH_COMPANY_FROM_ORDER =
  'app/BookerSelectRestaurant/FETCH_COMPANY_FROM_ORDER';
const FETCH_RESTAURANT_REVIEWS =
  'app/BookerSelectRestaurant/FETCH_RESTAURAN_REVIEWS';

// ================ Async thunks ================ //
const fetchRestaurant = createAsyncThunk(
  FETCH_RESTAURANT,
  async (restaurantId: string, { extra: sdk, getState }) => {
    const {
      restaurantIdList = [],
      searchResult = [],
      totalItems,
    } = getState().BookerSelectRestaurant;
    if (restaurantId) {
      const isRestaurantExisted = restaurantIdList.includes(restaurantId);

      if (isRestaurantExisted)
        return {
          restaurant: searchResult.find(
            (restaurant) => restaurant.id.uuid === restaurantId,
          ),
          restaurantIdList,
          searchResult,
          totalItems,
        };

      const response = denormalisedResponseEntities(
        await sdk.listings.show({
          id: restaurantId,
          include: ['images'],
          'fields.image': [
            `variants.${EImageVariants.default}`,
            `variants.${EImageVariants.squareSmall}`,
            `variants.${EImageVariants.landscapeCrop}`,
            `variants.${EImageVariants.landscapeCrop2x}`,
          ],
        }),
      )[0];

      return {
        restaurant: response,
        restaurantIdList: restaurantIdList.concat(restaurantId),
        searchResult: uniqBy(searchResult.concat(response), 'id.uuid'),
        totalItems: totalItems + 1,
      };
    }

    return {
      restaurant: null,
      restaurantIdList,
      searchResult,
      totalItems,
    };
  },
);

const searchRestaurants = createAsyncThunk(
  SEARCH_RESTAURANT,
  async (params: TMenuQueryParams, { getState, dispatch }) => {
    const { orderId } = params;

    await dispatch(orderAsyncActions.fetchOrder(orderId!));
    const { order } = getState().Order;

    const { deliveryAddress = {} } = Listing(order).getMetadata();

    if (!deliveryAddress || !deliveryAddress.origin) {
      return {
        restaurantIdList: [],
        searchResult: [],
        combinedRestaurantMenuData: [],
        totalItems: 0,
        combinedRestaurantInFoods: [],
      };
    }

    const { data: restaurantData } = await searchRestaurantListFromMenuApi(
      params,
    );

    const matchedPackagePerMemberRestaurants =
      restaurantData.searchResult.filter(
        (restaurant: any) => !!restaurant.numberOfMatchedPackagePerMemberFoods,
      );

    const nonMatchedPackagePerMemberRestaurants =
      restaurantData.searchResult.filter(
        (restaurant: any) => !restaurant.numberOfMatchedPackagePerMemberFoods,
      );

    const sortedRestaurants = [
      ...(matchedPackagePerMemberRestaurants.sort(
        (first: TListing, second: TListing) =>
          sortRestaurants(deliveryAddress.origin, first, second),
      ) || []),
      ...(nonMatchedPackagePerMemberRestaurants.sort(
        (first: TListing, second: TListing) =>
          sortRestaurants(deliveryAddress.origin, first, second),
      ) || []),
    ];

    return {
      restaurantIdList: restaurantData.restaurantIdList ?? [],
      searchResult: sortedRestaurants,
      combinedRestaurantMenuData:
        restaurantData.combinedRestaurantMenuData ?? [],
      totalItems: restaurantData.totalItems ?? 0,
      combinedRestaurantInFoods: restaurantData.combinedRestaurantInFoods ?? [],
      keywords: params.keywords,
    };
  },
);

const fetchFoodsByRestaurantAndTimestamp = createAsyncThunk(
  FETCH_FOODS_BY_RESTAURANT_AND_TIMESTAMPS,
  async (
    {
      timestamp,
      orderId,
      restaurantId,
    }: {
      timestamp: number;
      orderId: string;
      restaurantId: string;
    },
    { getState, dispatch },
  ) => {
    await dispatch(orderAsyncActions.fetchOrder(orderId!));
    const { order } = getState().Order;

    const { deliveryAddress = {} } = Listing(order).getMetadata();

    if (!deliveryAddress || !deliveryAddress.origin) {
      return {
        foodsByRestaurantAndTimestamp: [],
      };
    }

    const { data: restaurantData } = await getRestaurantFoodsApi({
      timestamp,
      orderId,
      restaurantIdParam: restaurantId,
    });

    return {
      foodsByRestaurantAndTimestamp:
        restaurantData.foodsByRestaurantAndTimestamp ?? [],
    };
  },
);

const fetchRecommendedKeywords = createAsyncThunk(
  FETCH_RECOMMENDED_KEYWORDS,
  async () => {
    const {
      data: { previousKeywords, popularKeywords },
    } = await fetchRecommendedKeywordsApi();

    return {
      previousKeywords,
      popularKeywords,
    };
  },
);

const deleteRecentKeyword = createAsyncThunk(
  DELETE_RECENT_KEYWORD,
  async ({ keyword }: { keyword: string }, { dispatch }) => {
    deleteRecentKeywordApi({
      keyword,
    }).catch(() => {
      dispatch(fetchRecommendedKeywords());
    });

    return keyword;
  },
);

const fetchOrder = createAsyncThunk(
  FETCH_ORDER,
  async (orderId: string, { extra: sdk }) => {
    const response = denormalisedResponseEntities(
      await sdk.listings.show({
        id: orderId,
      }),
    )[0];

    return response;
  },
);

const fetchPlanDetail = createAsyncThunk(
  FETCH_PLAN_DETAIL,
  async (planId: string, { extra: sdk }) => {
    if (planId) {
      const response = denormalisedResponseEntities(
        await sdk.listings.show({
          id: planId,
        }),
      )[0];

      return response;
    }

    return {};
  },
);

const updatePlanDetail = createAsyncThunk(
  UPDATE_PLAN_DETAIL,
  async ({ orderId, planId, orderDetail, updateMode = 'merge' }: any, _) => {
    const { data: planListing } = await updatePlanDetailsApi(orderId, {
      orderDetail,
      planId,
      updateMode,
    });

    return planListing;
  },
);

const fetchCompanyAccount = createAsyncThunk(
  FETCH_COMPANY_FROM_ORDER,
  async (companyId: string, { extra: sdk }) => {
    const companyAccount = denormalisedResponseEntities(
      await sdk.users.show({
        id: companyId,
      }),
    )[0];

    return companyAccount;
  },
);

const fetchFoodListFromRestaurant = createAsyncThunk(
  FETCH_FOOD_LIST_FROM_RESTAURANT,
  async (params: Record<string, any>, { getState, dispatch }) => {
    const { combinedRestaurantMenuData = [], restaurantFood = {} } =
      getState().BookerSelectRestaurant;
    const {
      menuId: menuIdParam,
      timestamp,
      favoriteFoodIdList = [],
      restaurantId,
    } = params;
    const { order } = getState().BookerSelectRestaurant;
    const { nutritions = [] } = Listing(order as TListing).getMetadata();
    const menuId =
      menuIdParam ||
      combinedRestaurantMenuData.find(
        (item: TObject) => item.restaurantId === restaurantId,
      )?.menuId;

    const { data: foodList } = await fetchFoodListFromMenuApi({
      menuId,
      subOrderDate: timestamp,
      favoriteFoodIdList,
      nutritions,
    });

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    dispatch(BookerSelectRestaurantActions.setCurrentMenuId(menuId));

    const newRestaurantFood = {
      ...restaurantFood,
      [restaurantId]: foodList,
    };

    return newRestaurantFood;
  },
);

const fetchRestaurantReviews = createAsyncThunk(
  FETCH_RESTAURANT_REVIEWS,
  async (
    {
      page = 1,
      reviewRole,
    }: {
      page: number;
      reviewRole: 'booker' | 'participant';
    },
    { extra: sdk, getState },
  ) => {
    const {
      selectedRestaurantId,
      restaurantBookerReviews,
      restaurantParticipantReviews,
      restaurantBookerReviewsMeta,
      restaurantParticipantReviewsMeta,
    } = getState().BookerSelectRestaurant;

    const ratingListingsResponse: WithFlexSDKData<RatingListing[]> =
      await sdk.listings.query({
        meta_listingType: EListingType.rating,
        meta_restaurantId: selectedRestaurantId,
        page,
        perPage: 5,
        meta_reviewRole: reviewRole,
      });

    const ratingListings: RatingListing[] = ratingListingsResponse.data.data;
    const visibleRatingListings = ratingListings.filter((rating) => {
      const reviewerId = rating.attributes?.metadata?.reviewerId;

      return !hiddenReviewUserIds.has(String(reviewerId || '').trim());
    });

    const ratingListWithUser = await Promise.all(
      visibleRatingListings.map(async (rating) => {
        const reviewerId = rating.attributes?.metadata?.reviewerId;

        const reviewer: WithFlexSDKData<UserListing> = await sdk.users.show({
          id: reviewerId,
          include: ['profileImage'],
          'fields.image': [`variants.${EImageVariants.squareSmall}`],
        });

        return {
          ...rating,
          reviewer: denormalisedResponseEntities(reviewer)?.[0],
        };
      }),
    );

    if (reviewRole === 'booker') {
      return {
        restaurantBookerReviews:
          page === 1
            ? ratingListWithUser
            : [...restaurantBookerReviews, ...ratingListWithUser],
        restaurantParticipantReviews,
        restaurantBookerReviewsMeta: ratingListingsResponse.data.meta,
        restaurantParticipantReviewsMeta,
      };
    }

    if (reviewRole === 'participant') {
      return {
        restaurantBookerReviews,
        restaurantParticipantReviews:
          page === 1
            ? ratingListWithUser
            : [...restaurantParticipantReviews, ...ratingListWithUser],
        restaurantBookerReviewsMeta,
        restaurantParticipantReviewsMeta: ratingListingsResponse.data.meta,
      };
    }

    return {
      restaurantBookerReviews,
      restaurantParticipantReviews,
      restaurantBookerReviewsMeta,
      restaurantParticipantReviewsMeta,
    };
  },
);

export const BookerSelectRestaurantThunks = {
  fetchRestaurant,
  searchRestaurants,
  fetchFoodListFromRestaurant,
  fetchOrder,
  fetchPlanDetail,
  fetchFoodsByRestaurantAndTimestamp,
  updatePlanDetail,
  fetchCompanyAccount,
  fetchRestaurantReviews,
  fetchRecommendedKeywords,
  deleteRecentKeyword,
};

const BookerSelectRestaurantSlice = createSlice({
  name: 'BookerSelectRestaurant',
  initialState,
  reducers: {
    setCurrentMenuId: (state, action) => {
      state.currentMenuId = action.payload;
    },
    setSelectedRestaurantId: (state, action) => {
      state.selectedRestaurantId = action.payload;
    },
    setPlanDetail: (state, { payload }) => {
      state.planDetail = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchRestaurants.pending, (state) => ({
        ...state,
        searchInProgress: true,
      }))
      .addCase(searchRestaurants.fulfilled, (state, action) => ({
        ...state,
        searchInProgress: false,
        restaurantIdList: action.payload.restaurantIdList ?? [],
        searchResult: action.payload.searchResult ?? [],
        totalItems: action.payload.totalItems ?? 0,
        combinedRestaurantInFoods:
          action.payload.combinedRestaurantInFoods ?? [],
        combinedRestaurantMenuData:
          action.payload.combinedRestaurantMenuData ?? [],
        recentKeywords: uniq([
          ...(action.payload.keywords ? [action.payload.keywords] : []),
          ...(state.recentKeywords || []),
        ]).slice(0, 4),
      }))
      .addCase(searchRestaurants.rejected, (state) => ({
        ...state,
        searchInProgress: false,
      }))

      .addCase(fetchFoodsByRestaurantAndTimestamp.pending, () => {})
      .addCase(
        fetchFoodsByRestaurantAndTimestamp.fulfilled,
        (state, action) => {
          state.foodsByRestaurantAndTimestamp =
            action.payload.foodsByRestaurantAndTimestamp ?? [];
        },
      )
      .addCase(fetchFoodsByRestaurantAndTimestamp.rejected, () => {})

      .addCase(fetchOrder.pending, (state) => ({
        ...state,
        fetchOrderInProgress: true,
        fetchOrderError: null,
      }))
      .addCase(fetchOrder.fulfilled, (state, { payload }) => ({
        ...state,
        fetchOrderInProgress: false,
        order: payload,
      }))
      .addCase(fetchOrder.rejected, (state, { error }) => ({
        ...state,
        fetchOrderInProgress: false,
        fetchOrderError: error,
      }))
      .addCase(fetchPlanDetail.pending, (state) => ({
        ...state,
        fetchPlanDetailInProgress: true,
        fetchPlanDetailError: null,
      }))
      .addCase(fetchPlanDetail.fulfilled, (state, { payload }) => ({
        ...state,
        fetchPlanDetailInProgress: false,
        planDetail: payload,
      }))
      .addCase(fetchPlanDetail.rejected, (state, { error }) => ({
        ...state,
        fetchPlanDetailInProgress: false,
        fetchPlanDetailError: error,
      }))
      .addCase(updatePlanDetail.pending, (state) => ({
        ...state,
        updatePlanDetailInProgress: true,
        updatePlanDetailError: null,
      }))
      .addCase(updatePlanDetail.fulfilled, (state, { payload }) => ({
        ...state,
        updatePlanDetailInProgress: false,
        planDetail: payload,
      }))
      .addCase(updatePlanDetail.rejected, (state, { error }) => ({
        ...state,
        updatePlanDetailInProgress: false,
        updatePlanDetailError: error,
      }))
      .addCase(fetchCompanyAccount.pending, (state) => ({
        ...state,
        fetchCompanyAccountInProgress: true,
        fetchCompanyAccountError: null,
      }))
      .addCase(fetchCompanyAccount.fulfilled, (state, { payload }) => ({
        ...state,
        fetchCompanyAccountInProgress: false,
        companyAccount: payload,
      }))
      .addCase(fetchCompanyAccount.rejected, (state, { error }) => ({
        ...state,
        fetchCompanyAccountInProgress: false,
        fetchCompanyAccountError: error,
      }))
      .addCase(fetchFoodListFromRestaurant.pending, (state) => {
        state.fetchRestaurantFoodInProgress = true;
        state.fetchRestaurantFoodError = null;
      })
      .addCase(fetchFoodListFromRestaurant.fulfilled, (state, action) => {
        state.restaurantFood = action.payload;
        state.fetchRestaurantFoodInProgress = false;
      })
      .addCase(fetchFoodListFromRestaurant.rejected, (state, { payload }) => {
        state.fetchRestaurantFoodInProgress = false;
        state.fetchRestaurantFoodError = payload;
      })
      .addCase(fetchRestaurant.pending, (state) => ({
        ...state,
        fetchRestaurantInProgress: true,
        fetchRestaurantError: null,
      }))
      .addCase(fetchRestaurant.fulfilled, (state, { payload }) => ({
        ...state,
        fetchRestaurantInProgress: false,
        restaurant: payload?.restaurant,
        restaurantIdList: payload?.restaurantIdList,
        searchResult: payload?.searchResult,
        totalItems: payload?.totalItems,
      }))
      .addCase(fetchRestaurant.rejected, (state, { error }) => ({
        ...state,
        fetchRestaurantInProgress: false,
        fetchRestaurantError: error,
      }))
      .addCase(fetchRecommendedKeywords.pending, (state) => ({
        ...state,
        fetchRecommendedKeywordsInProgress: true,
        fetchRecommendedKeywordsError: null,
      }))
      .addCase(fetchRecommendedKeywords.fulfilled, (state, { payload }) => ({
        ...state,
        fetchRecommendedKeywordsInProgress: false,
        popularKeywords: payload?.popularKeywords,
        recentKeywords: payload?.previousKeywords,
      }))
      .addCase(fetchRecommendedKeywords.rejected, (state, { error }) => ({
        ...state,
        fetchRecommendedKeywordsInProgress: false,
        fetchRecommendedKeywordsError: error,
      }))
      .addCase(deleteRecentKeyword.pending, (state) => ({
        ...state,
        deleteRecentKeywordInProgress: true,
      }))
      .addCase(deleteRecentKeyword.fulfilled, (state, { payload }) => ({
        ...state,
        recentKeywords: state.recentKeywords.filter(
          (_keyword) => _keyword !== payload,
        ),
        deleteRecentKeywordInProgress: false,
      }))
      .addCase(deleteRecentKeyword.rejected, (state) => ({
        ...state,
        deleteRecentKeywordInProgress: false,
      }))

      .addCase(fetchRestaurantReviews.pending, (state) => ({
        ...state,
        fetchRestaurantReviewInProgress: true,
        fetchRestaurantReviewError: null,
      }))
      .addCase(fetchRestaurantReviews.fulfilled, (state, { payload }) => {
        return {
          ...state,
          fetchRestaurantReviewInProgress: false,
          ...payload,
        };
      })
      .addCase(fetchRestaurantReviews.rejected, (state, { error }) => ({
        ...state,
        fetchRestaurantReviewInProgress: false,
        fetchRestaurantReviewError: error,
      }));
  },
});

export const BookerSelectRestaurantActions =
  BookerSelectRestaurantSlice.actions;

export default BookerSelectRestaurantSlice.reducer;
