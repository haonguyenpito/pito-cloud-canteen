import { createSlice } from '@reduxjs/toolkit';
import { intersection } from 'lodash';
import chunk from 'lodash/chunk';
import flatten from 'lodash/flatten';
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';

import type { ParticipantSubOrderAddDocumentApiBody } from '@apis/firebaseApi';
import {
  participantSubOrderAddDocumentApi,
  participantSubOrderGetByIdApi,
} from '@apis/firebaseApi';
import { updateParticipantOrderApi } from '@apis/index';
import {
  fetchOrdersApi,
  participantPostRatingApi,
  recommendFoodForSubOrdersApi,
} from '@apis/participantApi';
import { disableWalkthroughApi } from '@apis/userApi';
import { getFoodQuery } from '@helpers/listingSearchQuery';
import { getBillablePrice } from '@helpers/menuExtraFee';
import {
  getIsAllowAddSecondaryFood,
  markColorForOrder,
} from '@helpers/orderHelper';
import type { POSTParticipantRating } from '@pages/api/participants/ratings/index.api';
import { createAsyncThunk } from '@redux/redux.helper';
import { ParticipantOrderManagementActions } from '@redux/slices/ParticipantOrderManagementPage.slice';
import { userThunks } from '@redux/slices/user.slice';
import type { FoodListing, ParticipantSubOrderDocument } from '@src/types';
import type { TUpdateParticipantOrderBody } from '@src/types/order';
import type { Image, VariantKey } from '@src/types/utils';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@src/utils/data';
import { EParticipantOrderStatus, ESubOrderTxStatus } from '@src/utils/enums';
import { convertStringToNumber } from '@src/utils/number';
import { ALLERGIES_OPTIONS, getLabelByKey } from '@src/utils/options';
import { toNonAccentVietnamese } from '@src/utils/string';
import type { TListing, TObject, TTransaction, TUser } from '@src/utils/types';

import { SubOrdersThunks } from '../sub-orders/SubOrders.slice';

// ================ Initial states ================ //
type TOrderListState = {
  updateProfileInProgress: boolean;
  updateProfileError: any;

  walkthroughCurrentStep: number;
  disableWalkthroughInProgress: boolean;
  disableWalkthroughError: any;

  ordersNotConfirmFirstTime: any[];
  foodsInPlans: any[];
  orders: any[];
  allSubOrders: any[];
  allPlans: any[];
  mappingSubOrderToOrder: TObject;
  fetchOrdersInProgress: boolean;
  fetchOrdersError: any;

  subOrderTxs: TTransaction[];
  fetchSubOrderTxInProgress: boolean;
  fetchSubOrderTxError: any;

  colorOrderMap: TObject;

  participantPostRatingInProgress: boolean;
  participantPostRatingError: any;

  addSubOrderDocumentToFirebaseInProgress: boolean;
  addSubOrderDocumentToFirebaseError: any;

  updateSubOrderInProgress: boolean;
  updateSubOrderError: any;

  subOrderDocument: ParticipantSubOrderDocument;
  fetchSubOrderDocumentInProgress: boolean;
  fetchSubOrderDocumentError: any;

  restaurants: TListing[];

  pickFoodForSubOrdersInProgress: boolean;
  pickFoodForSubOrdersError: any;

  pickFoodForSpecificSubOrderInProgress: boolean;
  pickFoodForSpecificSubOrderError: any;

  company: TUser | null;
  isAllowAddSecondaryFood: boolean;
};
const initialState: TOrderListState = {
  updateProfileInProgress: false,
  updateProfileError: null,

  walkthroughCurrentStep: 0,
  disableWalkthroughInProgress: false,
  disableWalkthroughError: null,
  ordersNotConfirmFirstTime: [],
  foodsInPlans: [],
  orders: [],
  allSubOrders: [],
  allPlans: [],
  mappingSubOrderToOrder: {},
  fetchOrdersInProgress: false,
  fetchOrdersError: null,

  subOrderTxs: [],
  fetchSubOrderTxInProgress: false,
  fetchSubOrderTxError: null,

  colorOrderMap: {},

  participantPostRatingInProgress: false,
  participantPostRatingError: null,

  addSubOrderDocumentToFirebaseInProgress: false,
  addSubOrderDocumentToFirebaseError: null,

  updateSubOrderInProgress: false,
  updateSubOrderError: null,

  subOrderDocument: {},
  fetchSubOrderDocumentInProgress: false,
  fetchSubOrderDocumentError: null,

  restaurants: [],

  pickFoodForSubOrdersInProgress: false,
  pickFoodForSubOrdersError: null,

  pickFoodForSpecificSubOrderInProgress: false,
  pickFoodForSpecificSubOrderError: null,

  company: null,
  isAllowAddSecondaryFood: false,
};

export const getFoodIdListWithSuitablePrice = ({
  payload,
  orders,
  allPlans,
}: {
  payload: {
    planId: string;
    orderId: string;
    subOrderDate: string;
  };
  orders: TListing[];
  allPlans: TListing[];
}) => {
  const { planId, subOrderDate, orderId } = payload;
  const order = orders.find((_order) => _order.id.uuid === orderId);
  const plan = allPlans.find((_plan) => _plan.id.uuid === planId);
  const orderListing = Listing(order!);
  const planListing = Listing(plan!);
  const { packagePerMember = 0 } = orderListing.getMetadata();
  const { orderDetail = {} } = planListing.getMetadata();
  const subOrder = orderDetail[subOrderDate];
  const { foodList } = subOrder.restaurant;
  const suitablePriceFoodList = Object.keys(foodList).reduce(
    (result: any, foodId: string) => {
      const { foodPrice = 0, foodExtraFee = 0 } = foodList[foodId] || {};
      // Budget is fee-inclusive — compare what the company is billed.
      if (getBillablePrice(foodPrice, foodExtraFee) <= packagePerMember) {
        result.push(foodId);
      }

      return result;
    },
    [],
  );

  return suitablePriceFoodList;
};

export const recommendFood = ({
  foodList,
  subOrderFoodIds,
  allergies,
}: {
  foodList: FoodListing[];
  subOrderFoodIds: string[];
  allergies: string[];
}) => {
  const subOrderFoodList = foodList.filter(
    (food) => food.id?.uuid && subOrderFoodIds.includes(food.id.uuid),
  );

  const filteredFoodListByAllergies = subOrderFoodList.filter((food) => {
    const parsedFoodAllergies =
      food.attributes?.publicData?.allergicIngredients?.map(
        (_foodAllergy) => _foodAllergy && toNonAccentVietnamese(_foodAllergy),
      );
    const parsedAllergies = allergies.map((allergy) =>
      toNonAccentVietnamese(getLabelByKey(ALLERGIES_OPTIONS, allergy)),
    );
    const overlapAllergies = intersection(parsedFoodAllergies, parsedAllergies);

    return !overlapAllergies.length;
  });

  return filteredFoodListByAllergies[
    Math.floor(Math.random() * filteredFoodListByAllergies.length)
  ];
};

type TGroupedRecommendedFood = Record<
  string,
  Record<string, { primary?: FoodListing; secondary?: FoodListing }>
>;

/**
 * Update the recommended food to the order detail
 * @param allPlans - The list of plans
 * @param planId - The plan id
 * @param currentUserGetter - The current user getter
 * @param groupedFood - The grouped food
 * @returns The updated order detail
 */
const updateRecommendFoodToOrderDetail = ({
  allPlans,
  planId,
  currentUserGetter,
  groupedFood,
}: {
  allPlans: TListing[];
  planId: string;
  currentUserGetter: any;
  groupedFood: TGroupedRecommendedFood;
}) => {
  const plan = allPlans.find((_plan) => _plan.id.uuid === planId);
  const planListing = Listing(plan!);
  const { orderDetail = {} } = planListing.getMetadata();
  const newOrderDetail = Object.keys(orderDetail).reduce(
    (newOrderDetailResult: any, subOrderDate: string) => {
      const recommendedFood = groupedFood?.[planId]?.[subOrderDate];
      const primaryFood = recommendedFood?.primary as TListing | undefined;
      const secondaryFood = recommendedFood?.secondary as TListing | undefined;
      const primaryFoodId = primaryFood
        ? Listing(primaryFood).getId()
        : undefined;
      const secondaryFoodId = secondaryFood
        ? Listing(secondaryFood).getId()
        : undefined;

      if (!primaryFoodId)
        return {
          ...newOrderDetailResult,
          [subOrderDate]: {
            ...orderDetail[subOrderDate],
          },
        };

      return {
        ...newOrderDetailResult,
        [subOrderDate]: {
          ...orderDetail[subOrderDate],
          memberOrders: {
            ...orderDetail[subOrderDate]?.memberOrders,
            [currentUserGetter.getId()]: {
              foodId: primaryFoodId,
              status: EParticipantOrderStatus.joined,
              ...(secondaryFoodId && { secondaryFoodId }),
            },
          },
        },
      };
    },
    {},
  );

  return newOrderDetail;
};

/**
 * Build recommended meals for a sub order
 * @param foodList - The list of foods to recommend
 * @param subOrderFoodIds - The list of food ids for the sub order
 * @param allergies - The list of allergies for the user
 * @param isAllowAddSecondaryFood - Whether to allow adding a second food
 * @returns The recommended meals for the sub order
 */
const buildRecommendedMealsForSubOrder = ({
  foodList,
  subOrderFoodIds,
  allergies,
  isAllowAddSecondaryFood,
}: {
  foodList: FoodListing[];
  subOrderFoodIds: string[];
  allergies: string[];
  isAllowAddSecondaryFood: boolean;
}): { primary?: FoodListing; secondary?: FoodListing } => {
  const primaryFood = recommendFood({
    foodList,
    subOrderFoodIds,
    allergies,
  });

  if (!primaryFood) {
    return {};
  }

  if (!isAllowAddSecondaryFood) {
    return { primary: primaryFood };
  }

  const primaryListing = Listing(primaryFood as TListing);
  const primaryFoodId = primaryListing.getId();
  const primaryNumberOfMainDishes =
    primaryListing.getPublicData()?.numberOfMainDishes;
  const isPrimarySingleSelectionFood =
    primaryNumberOfMainDishes !== undefined &&
    primaryNumberOfMainDishes !== null &&
    Number(primaryNumberOfMainDishes) === 1;

  if (isPrimarySingleSelectionFood) {
    return { primary: primaryFood };
  }

  const secondaryCandidateIds = subOrderFoodIds.filter(
    (foodId) => foodId && foodId !== primaryFoodId,
  );

  if (!secondaryCandidateIds.length) {
    return { primary: primaryFood };
  }

  const secondaryCandidates = foodList.filter((food) => {
    const listing = Listing(food as TListing);
    const foodId = listing.getId();
    if (!foodId || !secondaryCandidateIds.includes(foodId)) {
      return false;
    }

    const numberOfMainDishes = listing.getPublicData()?.numberOfMainDishes;
    const isSingleSelectionFood =
      numberOfMainDishes !== undefined &&
      numberOfMainDishes !== null &&
      Number(numberOfMainDishes) === 1;

    return !isSingleSelectionFood;
  });

  if (!secondaryCandidates.length) {
    return { primary: primaryFood };
  }

  const secondaryFood = recommendFood({
    foodList: secondaryCandidates,
    subOrderFoodIds: secondaryCandidateIds,
    allergies,
  });

  if (!secondaryFood) {
    return { primary: primaryFood };
  }

  const secondaryListing = Listing(secondaryFood as TListing);
  const secondaryFoodId = secondaryListing.getId();

  if (!secondaryFoodId || secondaryFoodId === primaryFoodId) {
    return { primary: primaryFood };
  }

  return {
    primary: primaryFood,
    secondary: secondaryFood,
  };
};
// ================ Thunk types ================ //
const DISABLE_WALKTHROUGH = 'app/ParticipantOrderList/DISABLE_WALKTHROUGH';
const FETCH_ORDERS = 'app/ParticipantOrderList/FETCH_ORDERS';
const UPDATE_SUB_ORDER = 'app/ParticipantOrderList/UPDATE_SUB_ORDER';

const POST_PARTICIPANT_RATING =
  'app/ParticipantOrderList/POST_PARTICIPANT_RATING';
const ADD_SUB_ORDER_DOCUMENT_TO_FIREBASE =
  'app/ParticipantOrderList/ADD_SUB_ORDER_DOCUMENT_TO_FIREBASE';
const FETCH_SUB_ORDERS_FROM_FIREBASE =
  'app/ParticipantOrderList/FETCH_SUB_ORDERS_FROM_FIREBASE';
const PICK_FOOD_FOR_SUB_ORDERS =
  'app/ParticipantOrderList/PICK_FOOD_FOR_SUB_ORDERS';
const PICK_FOOD_FOR_SPECIFIC_SUB_ORDER =
  'app/ParticipantOrderList/PICK_FOOD_FOR_SPECIFIC_SUB_ORDER';

// ================ Async thunks ================ //

const disableWalkthrough = createAsyncThunk(
  DISABLE_WALKTHROUGH,
  async (userId: string, { dispatch }) => {
    await disableWalkthroughApi(userId);
    await dispatch(userThunks.fetchCurrentUser());
  },
);

const fetchOrders = createAsyncThunk(
  FETCH_ORDERS,
  async ({ startDate, endDate }: TObject) => {
    const { data } = await fetchOrdersApi({
      startDate,
      endDate,
    });

    const {
      orders,
      allPlans,
      restaurants,
      mappingSubOrderToOrder,
      company,
      foodsInPlans,
      ordersNotConfirmFirstTime,
    } = data;

    return {
      orders,
      allPlans,
      restaurants,
      mappingSubOrderToOrder,
      company,
      ordersNotConfirmFirstTime,
      foodsInPlans,
    };
  },
);

const updateSubOrder = createAsyncThunk(
  UPDATE_SUB_ORDER,
  async (
    data: { orderId: string; updateValues: TUpdateParticipantOrderBody },
    { getState },
  ) => {
    const { allPlans } = getState().ParticipantOrderList;
    const { orderId, updateValues } = data;
    const { data: updateResponse } = await updateParticipantOrderApi(
      orderId,
      updateValues,
    );

    const { plan } = updateResponse;

    const newAllPlans = allPlans.map((oldPlan: any) => {
      if (oldPlan.id.uuid === plan.id.uuid) {
        return plan;
      }

      return oldPlan;
    });

    return {
      allPlans: newAllPlans,
    };
  },
);

const postParticipantRating = createAsyncThunk(
  POST_PARTICIPANT_RATING,
  async (
    payload: Omit<POSTParticipantRating, 'imageIdList' | 'imageUrlList'>,
    { getState, dispatch },
  ) => {
    const { images } = getState().uploadImage;
    const { currentUser } = getState().user;
    const { planId, rating } = payload;
    const { timestamp } = rating;

    const { data: response } = await participantPostRatingApi({
      ...payload,
      imageUrlList: Object.values(
        images as (Image['attributes'] & {
          imageId: string;
          uploadedImage: Image;
        })[],
      ).reduce<string[]>((result, image) => {
        if (image.uploadedImage.attributes.variants) {
          const { variants } = image.uploadedImage.attributes;
          const firstVariantKey = Object.keys(variants)[0];

          result.push(variants[firstVariantKey as VariantKey].url);
        }

        return result;
      }, []),
      imageIdList: Object.values(images as { imageId: string }[]).map(
        (image) => image.imageId,
      ),
    });

    dispatch(
      SubOrdersThunks.fetchSubOrderFromFirebase({
        subOrderDocumentId: `${currentUser?.id.uuid} - ${planId} - ${timestamp}`,
        subOrderType: ESubOrderTxStatus.DELIVERED,
      }),
    );

    return response;
  },
);

const addSubOrderDocumentToFirebase = createAsyncThunk(
  ADD_SUB_ORDER_DOCUMENT_TO_FIREBASE,
  async (payload: ParticipantSubOrderAddDocumentApiBody) => {
    await participantSubOrderAddDocumentApi(payload);
  },
);

const fetchSubOrdersFromFirebase = createAsyncThunk(
  FETCH_SUB_ORDERS_FROM_FIREBASE,
  async (subOrderId: string) => {
    const { data: response } = await participantSubOrderGetByIdApi(subOrderId);

    return response || {};
  },
);

const pickFoodForSubOrders = createAsyncThunk(
  PICK_FOOD_FOR_SUB_ORDERS,
  async (
    payload: {
      recommendSubOrders: {
        planId: string;
        orderId: string;
        subOrderDate: string;
      }[];
      recommendFrom: 'orderList' | 'orderDetail';
    },
    { getState, extra: sdk, dispatch },
  ) => {
    const { recommendFrom, recommendSubOrders } = payload;
    const { orders: orderListOrders, allPlans: orderListAllPlans } =
      getState().ParticipantOrderList;
    const { order: detailOrderOrder, plans: detailOrderPlans } =
      getState().ParticipantOrderManagementPage;
    const orders =
      recommendFrom === 'orderList' ? orderListOrders : [detailOrderOrder];
    const allPlans =
      recommendFrom === 'orderList' ? orderListAllPlans : detailOrderPlans;

    const { currentUser } = getState().user;
    const currentUserGetter = CurrentUser(currentUser!);
    const { allergies = [] } = currentUserGetter.getPublicData();

    const foodIdChunkList = recommendSubOrders.map(
      (item) =>
        getFoodIdListWithSuitablePrice({
          payload: item,
          orders,
          allPlans,
        }) || [],
    );

    const flattenFoodIdList = uniq(flatten(foodIdChunkList));
    const slicedFoodIdsBy100 = chunk(flattenFoodIdList, 100);
    const foodQueries = slicedFoodIdsBy100.map((foodIds) =>
      getFoodQuery({
        foodIds,
        params: {},
      }),
    );

    const foodsResponse: FoodListing[] = flatten(
      await Promise.all(
        foodQueries.map(async (foodQuery) => {
          const response = denormalisedResponseEntities(
            await sdk.listings.query(foodQuery),
          );

          return response;
        }),
      ),
    ) as FoodListing[];

    const groupedFoodBySubOrderDate: TGroupedRecommendedFood =
      recommendSubOrders.reduce((result: any, item, index: number) => {
        // Find the correct order for this subOrder to get isAllowAddSecondaryFood
        const targetOrder = orders.find(
          (_order: TListing) => _order.id.uuid === item.orderId,
        );

        if (!targetOrder) {
          console.error(
            `pickFoodForSubOrders: Order ${item.orderId} not found for subOrder ${item.subOrderDate}`,
          );

          return result;
        }

        // Get isAllowAddSecondaryFood from the correct order for this subOrder
        const isAllowAddSecondaryFood = getIsAllowAddSecondaryFood(
          targetOrder as TListing,
        );

        const subOrderFoodIds = foodIdChunkList[index] || [];
        const meals = buildRecommendedMealsForSubOrder({
          foodList: foodsResponse,
          subOrderFoodIds,
          allergies,
          isAllowAddSecondaryFood,
        });

        if (!meals.primary) {
          return result;
        }

        return {
          ...result,
          [item.planId]: {
            ...result[item.planId],
            [item.subOrderDate]: meals,
          },
        };
      }, {});

    const mappedRecommendFoodToOrderDetail = Object.keys(
      groupedFoodBySubOrderDate,
    ).reduce((result: any, planId) => {
      const newOrderDetail = updateRecommendFoodToOrderDetail({
        allPlans,
        planId,
        currentUserGetter,
        groupedFood: groupedFoodBySubOrderDate,
      });

      return {
        ...result,
        [planId]: {
          orderDetail: newOrderDetail,
        },
      };
    }, {});

    await recommendFoodForSubOrdersApi({ mappedRecommendFoodToOrderDetail });
    recommendSubOrders.forEach((item) => {
      const { planId, subOrderDate } = item;
      participantSubOrderAddDocumentApi({
        participantId: currentUserGetter.getId(),
        planId,
        timestamp: +subOrderDate,
      });
    });

    const newAllPlans = allPlans.map((plan: TListing) => {
      if (
        Object.keys(mappedRecommendFoodToOrderDetail).includes(plan.id.uuid)
      ) {
        return {
          ...plan,
          attributes: {
            ...plan.attributes,
            metadata: {
              ...plan.attributes.metadata,
              orderDetail:
                mappedRecommendFoodToOrderDetail[plan.id.uuid].orderDetail,
            },
          },
        };
      }

      return plan;
    });

    if (recommendFrom === 'orderList') {
      return newAllPlans;
    }

    dispatch(ParticipantOrderManagementActions.updatePlans(newAllPlans));

    return orderListAllPlans;
  },
);

const pickFoodForSpecificSubOrder = createAsyncThunk(
  PICK_FOOD_FOR_SPECIFIC_SUB_ORDER,
  async (
    payload: {
      recommendSubOrder: {
        planId: string;
        orderId: string;
        subOrderDate: string;
      };
      recommendFrom: 'orderList' | 'orderDetail';
    },
    { getState, extra: sdk, dispatch },
  ) => {
    const { recommendFrom, recommendSubOrder } = payload;
    const { planId, subOrderDate, orderId } = recommendSubOrder;
    const { orders: orderListOrders, allPlans: orderListAllPlans } =
      getState().ParticipantOrderList;
    const { order: detailOrderOrder, plans: detailOrderPlans } =
      getState().ParticipantOrderManagementPage;
    const orders =
      recommendFrom === 'orderList' ? orderListOrders : [detailOrderOrder];
    const allPlans =
      recommendFrom === 'orderList' ? orderListAllPlans : detailOrderPlans;

    // Find the correct order based on orderId
    const targetOrder = orders.find(
      (_order: TListing) => _order.id.uuid === orderId,
    );

    if (!targetOrder) {
      console.error(
        `pickFoodForSpecificSubOrder: Order ${orderId} not found in orders list`,
      );

      return recommendFrom === 'orderList' ? allPlans : orderListAllPlans;
    }

    const { currentUser } = getState().user;
    const currentUserGetter = CurrentUser(currentUser!);
    const { allergies = [] } = currentUserGetter.getPublicData();

    // Get isAllowAddSecondaryFood from the correct order, not from detailOrderOrder
    const isAllowAddSecondaryFood = getIsAllowAddSecondaryFood(
      targetOrder as TListing,
    );

    const foodIdList = getFoodIdListWithSuitablePrice({
      payload: recommendSubOrder,
      orders,
      allPlans,
    });

    const flattenFoodIdList = uniq<string>(foodIdList);
    const slicedFoodIdsBy100 = chunk(flattenFoodIdList, 100);
    const foodQueries = slicedFoodIdsBy100.map((foodIds) =>
      getFoodQuery({
        foodIds,
        params: {},
      }),
    );

    const foodsResponse: FoodListing[] = flatten(
      await Promise.all(
        foodQueries.map(async (foodQuery) => {
          const response = denormalisedResponseEntities(
            await sdk.listings.query(foodQuery),
          );

          return response;
        }),
      ),
    ) as FoodListing[];

    const meals = buildRecommendedMealsForSubOrder({
      foodList: foodsResponse,
      subOrderFoodIds: foodIdList || [],
      allergies,
      isAllowAddSecondaryFood,
    });

    if (!meals.primary) {
      return recommendFrom === 'orderList' ? allPlans : orderListAllPlans;
    }

    const groupedFood: TGroupedRecommendedFood = {
      [planId]: {
        [subOrderDate]: meals,
      },
    };

    const newOrderDetail = updateRecommendFoodToOrderDetail({
      allPlans,
      planId,
      currentUserGetter,
      groupedFood,
    });

    await recommendFoodForSubOrdersApi({
      mappedRecommendFoodToOrderDetail: {
        [planId]: {
          orderDetail: newOrderDetail,
        },
      },
    });

    participantSubOrderAddDocumentApi({
      participantId: currentUserGetter.getId(),
      planId,
      timestamp: +subOrderDate,
    });

    const newAllPlans = allPlans.map((plan: TListing) => {
      if (plan.id.uuid === planId) {
        return {
          ...plan,
          attributes: {
            ...plan.attributes,
            metadata: {
              ...plan.attributes.metadata,
              orderDetail: newOrderDetail,
            },
          },
        };
      }

      return plan;
    });

    if (recommendFrom === 'orderList') {
      return newAllPlans;
    }

    dispatch(ParticipantOrderManagementActions.updatePlans(newAllPlans));

    return orderListAllPlans;
  },
);

export const OrderListThunks = {
  disableWalkthrough,
  fetchOrders,
  postParticipantRating,
  addSubOrderDocumentToFirebase,
  updateSubOrder,
  fetchSubOrdersFromFirebase,
  pickFoodForSubOrders,
  pickFoodForSpecificSubOrder,
};

// ================ Slice ================ //
const OrderListSlice = createSlice({
  name: 'ParticipantOrderList',
  initialState,
  reducers: {
    changeWalkthroughCurrentStep: (state, action) => {
      state.walkthroughCurrentStep = action.payload;
    },
    markColorToOrder: (state) => {
      const { orders } = state;
      const colorOrderMap = orders.reduce((result, order) => {
        const orderListing = Listing(order);
        const { title: orderTitle } = orderListing.getAttributes();
        const orderTitleNumber = convertStringToNumber(orderTitle);
        const orderColor = markColorForOrder(orderTitleNumber);

        return {
          ...result,
          [order.id.uuid]: orderColor,
        };
      }, {});

      return {
        ...state,
        colorOrderMap,
      };
    },
    updatePlanDetail: (state, action) => {
      const { payload: plan } = action;
      const newAllPlans = state.allPlans.map((oldPlan: any) => {
        if (oldPlan.id.uuid === plan.id.uuid) {
          return plan;
        }

        return oldPlan;
      });

      return {
        ...state,
        allPlans: newAllPlans,
      };
    },
    logout: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(disableWalkthrough.pending, (state) => {
        state.disableWalkthroughInProgress = true;
        state.disableWalkthroughError = false;
      })
      .addCase(disableWalkthrough.fulfilled, (state) => {
        state.disableWalkthroughInProgress = false;
      })
      .addCase(disableWalkthrough.rejected, (state, { error }) => {
        state.disableWalkthroughInProgress = false;
        state.disableWalkthroughError = error.message;
      })

      .addCase(fetchOrders.pending, (state) => {
        state.fetchOrdersInProgress = true;
        state.fetchOrdersError = false;
      })
      .addCase(fetchOrders.fulfilled, (state, { payload }) => {
        state.fetchOrdersInProgress = false;
        state.orders = uniqBy([...state.orders, ...payload.orders], 'id.uuid');
        state.ordersNotConfirmFirstTime = payload.ordersNotConfirmFirstTime;
        state.restaurants = payload.restaurants;
        state.allPlans = uniqBy(
          [...payload.allPlans, ...state.allPlans],
          'id.uuid',
        );
        state.mappingSubOrderToOrder = {
          ...state.mappingSubOrderToOrder,
          ...payload.mappingSubOrderToOrder,
        };
        state.company = payload.company;
        state.foodsInPlans = payload.foodsInPlans;
      })
      .addCase(fetchOrders.rejected, (state, { error }) => {
        state.fetchOrdersInProgress = false;
        state.fetchOrdersError = error.message;
      })

      .addCase(postParticipantRating.pending, (state) => {
        state.participantPostRatingInProgress = true;
        state.participantPostRatingError = false;
      })
      .addCase(postParticipantRating.fulfilled, (state) => {
        state.participantPostRatingInProgress = false;
      })
      .addCase(postParticipantRating.rejected, (state, { error }) => {
        state.participantPostRatingInProgress = false;
        state.participantPostRatingError = error.message;
      })

      .addCase(addSubOrderDocumentToFirebase.pending, (state) => {
        state.addSubOrderDocumentToFirebaseInProgress = true;
        state.addSubOrderDocumentToFirebaseError = false;
      })
      .addCase(addSubOrderDocumentToFirebase.fulfilled, (state) => {
        state.addSubOrderDocumentToFirebaseInProgress = false;
      })
      .addCase(addSubOrderDocumentToFirebase.rejected, (state, { error }) => {
        state.addSubOrderDocumentToFirebaseInProgress = false;
        state.addSubOrderDocumentToFirebaseError = error.message;
      })

      .addCase(updateSubOrder.pending, (state) => {
        state.updateSubOrderInProgress = true;
        state.updateSubOrderError = false;
      })
      .addCase(updateSubOrder.fulfilled, (state, { payload }) => {
        state.updateSubOrderInProgress = false;
        state.allPlans = payload.allPlans;
      })
      .addCase(updateSubOrder.rejected, (state, { error }) => {
        state.updateSubOrderInProgress = false;
        state.updateSubOrderError = error.message;
      })

      .addCase(fetchSubOrdersFromFirebase.pending, (state) => {
        state.fetchSubOrderDocumentInProgress = true;
        state.fetchSubOrderDocumentError = false;
      })

      .addCase(fetchSubOrdersFromFirebase.fulfilled, (state, { payload }) => {
        state.fetchSubOrderDocumentInProgress = false;
        state.subOrderDocument = payload;
      })
      .addCase(fetchSubOrdersFromFirebase.rejected, (state, { error }) => {
        state.fetchSubOrderDocumentInProgress = false;
        state.fetchSubOrderDocumentError = error.message;
      })

      .addCase(pickFoodForSubOrders.pending, (state) => {
        state.pickFoodForSubOrdersInProgress = true;
        state.pickFoodForSubOrdersError = false;
      })
      .addCase(pickFoodForSubOrders.fulfilled, (state, { payload }) => {
        state.pickFoodForSubOrdersInProgress = false;
        state.allPlans = payload;
      })
      .addCase(pickFoodForSubOrders.rejected, (state, { error }) => {
        state.pickFoodForSubOrdersInProgress = false;
        state.pickFoodForSubOrdersError = error.message;
      })

      .addCase(pickFoodForSpecificSubOrder.pending, (state) => {
        state.pickFoodForSpecificSubOrderInProgress = true;
        state.pickFoodForSpecificSubOrderError = false;
      })
      .addCase(pickFoodForSpecificSubOrder.fulfilled, (state, { payload }) => {
        state.pickFoodForSpecificSubOrderInProgress = false;
        state.allPlans = payload;
      })
      .addCase(pickFoodForSpecificSubOrder.rejected, (state, { error }) => {
        state.pickFoodForSpecificSubOrderInProgress = false;
        state.pickFoodForSpecificSubOrderError = error.message;
      });
  },
});

// ================ Actions ================ //
export const OrderListActions = OrderListSlice.actions;
export default OrderListSlice.reducer;

// ================ Selectors ================ //
