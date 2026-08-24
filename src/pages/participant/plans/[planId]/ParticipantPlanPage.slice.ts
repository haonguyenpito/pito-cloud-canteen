import { createSlice } from '@reduxjs/toolkit';
import { AxiosError } from 'axios';
import difference from 'lodash/difference';

import { participantSubOrderAddDocumentApi } from '@apis/firebaseApi';
import { loadPlanDataApi, updateParticipantOrderApi } from '@apis/index';
import { placeOrderApi, placeOrderFailedApi } from '@apis/participantApi';
import {
  pickRandomFood,
  pickRandomFoodExcludingIds,
} from '@helpers/foodPickerHelpers';
import { sleep } from '@helpers/index';
import { getBillablePrice } from '@helpers/menuExtraFee';
import { getIsAllowAddSecondaryFood } from '@helpers/orderHelper';
import { createAsyncThunk } from '@redux/redux.helper';
import type { TMemberPlan } from '@redux/slices/shoppingCart.slice';
import {
  shoppingCartActions,
  shoppingCartThunks,
} from '@redux/slices/shoppingCart.slice';
import type {
  TCartItem,
  TPlanData,
  TShoppingCartMemberPlan,
  TUpdateParticipantOrderBody,
} from '@src/types/order';
import { CurrentUser, Listing } from '@src/utils/data';
import type { ApiResponse } from '@src/utils/response';
import type { TListing } from '@src/utils/types';
import { EParticipantOrderStatus } from '@utils/enums';
import { storableError } from '@utils/errors';

const LOAD_DATA = 'app/ParticipantPlanPage/LOAD_DATA';
const RELOAD_DATA = 'app/ParticipantPlanPage/RELOAD_DATA';
const UPDATE_ORDER = 'app/ParticipantPlanPage/UPDATE_ORDER';
const RECOMMEND_FOOD_SUB_ORDER =
  'app/ParticipantPlanPage/RECOMMEND_FOOD_SUB_ORDER';
const RECOMMEND_FOOD_SUB_ORDERS =
  'app/ParticipantPlanPage/RECOMMEND_FOOD_SUB_ORDERS';
const PLACE_ORDER = 'app/ParticipantPlanPage/PLACE_ORDER';

const recommendFoodForShoppingCart = ({
  plan,
  subOrderDate,
  packagePerMember,
  allergies,
  plans,
  dispatch,
  currentMealId,
  currentSecondaryMealId,
  isAllowAddSecondaryFood,
}: {
  plan: any;
  subOrderDate: string;
  packagePerMember: number;
  allergies: string[];
  plans: string[];
  dispatch: any;
  currentMealId?: string;
  currentSecondaryMealId?: string;
  isAllowAddSecondaryFood?: boolean;
}) => {
  const subOrder = plan[subOrderDate];
  const { foodList, foodExtraFees = {} } = subOrder;

  // get the list of foods with suitable price — the budget is fee-inclusive, so
  // auto-pick must not choose a dish that would overflow the package at billing
  const suitablePriceFoodList = foodList.filter((food: TListing) => {
    const foodId = food?.id?.uuid;

    return (
      getBillablePrice(
        Listing(food).getAttributes().price.amount,
        foodExtraFees[`${foodId}`],
      ) <= packagePerMember
    );
  });

  // pick a random food from the list of foods with suitable price without allergies
  let mostSuitableFood = pickRandomFood(suitablePriceFoodList, allergies);

  if (currentMealId) {
    // if the current meal id is not in the list of foods with suitable price,
    // pick a random food from the list of foods with suitable price excluding the current meal id
    const alternativeExcludeIds = [currentMealId];
    const alternativeFood = pickRandomFoodExcludingIds(
      suitablePriceFoodList,
      alternativeExcludeIds,
    );

    // if the alternative food is found, set it as the most suitable food
    if (alternativeFood) {
      mostSuitableFood = alternativeFood;
    }
  }

  // if the most suitable food is not found, return an empty object
  if (!mostSuitableFood) {
    return { foodName: '' };
  }

  const mostSuitableFoodListing = Listing(mostSuitableFood as TListing);

  dispatch(
    shoppingCartThunks.addToCart({
      planId: plans[0],
      dayId: subOrderDate,
      mealId: mostSuitableFoodListing.getId(),
    }),
  );

  const primaryFoodTitle = mostSuitableFoodListing.getAttributes().title || '';
  const primaryNumberOfMainDishes =
    mostSuitableFoodListing.getPublicData()?.numberOfMainDishes;
  const isPrimarySingleSelectionFood =
    primaryNumberOfMainDishes !== undefined &&
    primaryNumberOfMainDishes !== null &&
    Number(primaryNumberOfMainDishes) === 1;

  // remove secondary food if it is a single selection food
  if (isAllowAddSecondaryFood && isPrimarySingleSelectionFood) {
    dispatch(
      shoppingCartThunks.removeFromCart({
        planId: plans[0],
        dayId: subOrderDate,
        removeSecondFood: true,
      }),
    );
  }

  let secondaryFood;
  // Check if is allow add second food and the primary food is not a single selection food
  // and the list of foods with suitable price has more than 1 food
  if (
    isAllowAddSecondaryFood &&
    !isPrimarySingleSelectionFood &&
    suitablePriceFoodList.length > 1
  ) {
    const secondaryCandidates = suitablePriceFoodList.filter(
      (food: TListing) => {
        const listing = Listing(food);
        const numberOfMainDishes = listing.getPublicData()?.numberOfMainDishes;
        const isSingleSelectionFood =
          numberOfMainDishes !== undefined &&
          numberOfMainDishes !== null &&
          Number(numberOfMainDishes) === 1;

        return (
          listing.getId() !== mostSuitableFoodListing.getId() &&
          !isSingleSelectionFood
        );
      },
    );

    const excludedSecondaryIds = [
      mostSuitableFoodListing.getId(),
      currentSecondaryMealId,
    ].filter(Boolean) as string[];

    secondaryFood = pickRandomFoodExcludingIds(
      secondaryCandidates,
      excludedSecondaryIds,
    );

    if (secondaryFood) {
      const secondaryFoodListing = Listing(secondaryFood as TListing);

      dispatch(
        shoppingCartThunks.addToCart({
          planId: plans[0],
          dayId: subOrderDate,
          mealId: secondaryFoodListing.getId(),
          isSecondFood: true,
        }),
      );
    }
  }
  const secondaryFoodTitle =
    isAllowAddSecondaryFood && secondaryFood
      ? Listing(secondaryFood as TListing).getAttributes().title
      : '';

  return {
    foodName: `${primaryFoodTitle}${
      secondaryFoodTitle ? ` + ${secondaryFoodTitle}` : ''
    }`,
  };
};

type TParticipantPlanState = {
  restaurant: any;
  company: any;
  plan: TPlanData;
  order: any;
  loadDataInProgress: boolean;
  loadDataError: any;
  reloadDataInProgress: boolean;
  reloadDataError: any;
  submitDataInprogress: boolean;
  submitDataError: any;
  isAllowAddSecondaryFood: boolean;
};

const initialState: TParticipantPlanState = {
  restaurant: {},
  company: {},
  plan: {},
  order: {},
  loadDataInProgress: false,
  loadDataError: null,
  reloadDataInProgress: false,
  reloadDataError: null,
  submitDataInprogress: false,
  submitDataError: null,
  isAllowAddSecondaryFood: false,
};

const loadData = createAsyncThunk(
  LOAD_DATA,
  async (planId: string, { getState, dispatch }) => {
    const { currentUser } = getState().user;
    const currentUserId = currentUser?.id?.uuid;
    const response = await loadPlanDataApi(planId);
    const { plan, order } = response?.data?.data || {};
    const orderDays = Object.keys(plan);
    const isAllowAddSecondaryFood = getIsAllowAddSecondaryFood(
      order as TListing,
    );

    orderDays.forEach((day) => {
      const {
        status,
        foodId,
        requirement = '',
        secondaryFoodId,
        secondaryRequirement,
      } = plan[day].memberOrder[currentUserId];

      if (status !== EParticipantOrderStatus.empty) {
        dispatch(
          shoppingCartActions.addToCart({
            currentUserId,
            planId,
            dayId: day,
            mealId:
              status === EParticipantOrderStatus.notJoined ? status : foodId,
            requirement,
          }),
        );
        if (secondaryFoodId) {
          dispatch(
            shoppingCartActions.addToCart({
              currentUserId,
              planId,
              dayId: day,
              mealId:
                status === EParticipantOrderStatus.notJoined
                  ? status
                  : secondaryFoodId,
              requirement: secondaryRequirement,
              isSecondFood: true,
            }),
          );
        }
      }
    });

    return {
      ...response?.data?.data,
      isAllowAddSecondaryFood,
    };
  },
  {
    serializeError: storableError,
  },
);

const reloadData = createAsyncThunk(
  RELOAD_DATA,
  async (planId: string, { getState, dispatch }) => {
    const { currentUser } = getState().user;
    const currentUserId = currentUser?.id?.uuid;
    const response = await loadPlanDataApi(planId);
    const { plan } = response?.data?.data || {};
    const orderDays = Object.keys(plan);

    dispatch(shoppingCartThunks.removeAllFromPlanCart({ planId }));

    orderDays.forEach((day) => {
      const {
        status,
        requirement,
        foodId,
        secondaryFoodId,
        secondaryRequirement,
      } = plan?.[day]?.memberOrder?.[currentUserId] || {};

      if (status !== EParticipantOrderStatus.empty) {
        dispatch(
          shoppingCartActions.addToCart({
            currentUserId,
            planId,
            dayId: day,
            mealId:
              status === EParticipantOrderStatus.notJoined ? status : foodId,
            requirement,
          }),
        );
        if (secondaryFoodId) {
          dispatch(
            shoppingCartActions.addToCart({
              currentUserId,
              planId,
              dayId: day,
              mealId: secondaryFoodId,
              isSecondFood: true,
              requirement: secondaryRequirement,
            }),
          );
        }
      }
    });

    return response?.data?.data;
  },
  {
    serializeError: storableError,
  },
);

const updateOrder = createAsyncThunk(
  UPDATE_ORDER,
  async (
    data: { orderId: string; planId: string },
    { getState, dispatch },
  ): Promise<boolean> => {
    const { orderId, planId } = data;
    const { currentUser } = getState().user;
    const currentUserId = currentUser?.id?.uuid;
    const { orders } = getState().shoppingCart;
    const planData = orders?.[currentUserId]?.[planId] || {};
    const orderDays = Object.keys(planData);

    const buildCartItem = (
      foodId: string,
      requirement: string,
      secondaryFoodId?: string,
      secondaryRequirement?: string,
    ) => {
      const isNotJoined = foodId === EParticipantOrderStatus.notJoined;
      const status = isNotJoined
        ? EParticipantOrderStatus.notJoined
        : foodId?.length > 0
        ? EParticipantOrderStatus.joined
        : EParticipantOrderStatus.empty;

      const baseItem: TCartItem = {
        status,
        foodId: isNotJoined ? '' : foodId,
        requirement,
        ...(secondaryFoodId && {
          secondaryFoodId,
          secondaryRequirement,
        }),
      };

      return baseItem;
    };

    const updatedPlan = orderDays.reduce<TShoppingCartMemberPlan>(
      (acc, curr) => {
        const {
          foodId = '',
          requirement = '',
          secondaryFoodId,
          secondaryRequirement,
        } = planData[+curr] || {};

        return {
          ...acc,
          [curr]: {
            [currentUserId]: buildCartItem(
              foodId,
              requirement,
              secondaryFoodId,
              secondaryRequirement,
            ),
          },
        };
      },
      {},
    );

    const updateValues: TUpdateParticipantOrderBody = {
      orderId,
      orderDays,
      planId,
      planData: updatedPlan,
    };

    const {
      data: { jobId },
    } = await updateParticipantOrderApi(orderId, updateValues);

    await sleep(2000); // wait for the order to be updated
    await dispatch(reloadData(planId));
    // firebase documents for history sub-orders and rating feature
    await Promise.all(
      orderDays.map((timestamp: string) =>
        participantSubOrderAddDocumentApi({
          participantId: currentUserId,
          planId,
          timestamp: parseInt(timestamp, 10),
        }),
      ),
    );

    return !!jobId;
  },
  {
    serializeError: storableError,
  },
);

/**
 * Place order for participant
 * @param data - { orderId: string; planId: string }
 * @param getState - getState function
 * @returns boolean
 */
const placeOrder = createAsyncThunk(
  PLACE_ORDER,
  async (
    data: { orderId: string; planId: string; userOrder?: TMemberPlan },
    { getState, rejectWithValue, dispatch },
  ) => {
    try {
      const { orderId, planId } = data;
      const { currentUser } = getState().user;
      const currentUserId = currentUser?.id?.uuid;
      const { orders } = getState().shoppingCart;
      const planData = orders?.[currentUserId]?.[planId] || {};
      const orderDays = Object.keys(planData);

      const buildCartItem = (
        foodId: string,
        requirement: string,
        secondaryFoodId?: string,
        secondaryRequirement?: string,
      ) => {
        const isNotJoined = foodId === EParticipantOrderStatus.notJoined;
        const status = isNotJoined
          ? EParticipantOrderStatus.notJoined
          : foodId?.length > 0
          ? EParticipantOrderStatus.joined
          : EParticipantOrderStatus.empty;

        const baseItem: TCartItem = {
          status,
          foodId: isNotJoined ? '' : foodId,
          requirement,
          ...(secondaryFoodId && {
            secondaryFoodId,
            secondaryRequirement,
          }),
        };

        return baseItem;
      };

      const updatedPlan = orderDays.reduce<TShoppingCartMemberPlan>(
        (acc, curr) => {
          const {
            foodId = '',
            requirement = '',
            secondaryFoodId,
            secondaryRequirement,
          } = planData[+curr] || {};

          return {
            ...acc,
            [curr]: {
              [currentUserId]: buildCartItem(
                foodId,
                requirement,
                secondaryFoodId,
                secondaryRequirement,
              ),
            },
          };
        },
        {},
      );

      const updateValues: TUpdateParticipantOrderBody = {
        orderId,
        orderDays,
        planId,
        planData: updatedPlan,
      };

      const res = await placeOrderApi(orderId, updateValues);
      const { orderMemberDocumentId } = res?.data?.data || {};
      if (!orderMemberDocumentId) {
        return rejectWithValue(new Error('Failed to place order'));
      }
      await dispatch(reloadData(planId));
      // firebase documents for history sub-orders and rating feature
      await Promise.all(
        orderDays.map((timestamp: string) =>
          participantSubOrderAddDocumentApi({
            participantId: currentUserId,
            planId,
            timestamp: parseInt(timestamp, 10),
          }),
        ),
      );

      return { status: true, orderMemberDocumentId };
    } catch (error: unknown) {
      const { orderId, planId, userOrder = {} } = data;
      const { currentUser } = getState().user;
      const errorMessage =
        error instanceof AxiosError
          ? (error as AxiosError<ApiResponse<{ message: string }>>).response
              ?.data?.message
          : error instanceof Error
          ? error.message
          : String(error);

      await placeOrderFailedApi(orderId, {
        planId,
        userOrder,
        userEmail: currentUser?.attributes?.email || '',
        error: errorMessage || 'Unknown error',
      });

      return rejectWithValue(error as Error);
    }
  },
  {
    serializeError: storableError,
  },
);

export const recommendFoodSubOrder = createAsyncThunk(
  RECOMMEND_FOOD_SUB_ORDER,
  async (subOrderDate: string, { getState, dispatch }) => {
    const { currentUser } = getState().user;
    const { plan, order, isAllowAddSecondaryFood } =
      getState().ParticipantPlanPage;
    const { orders } = getState().shoppingCart;
    const currentUserGetter = CurrentUser(currentUser!);
    const { allergies = [] } = currentUserGetter.getPublicData();
    const orderListing = Listing(order as TListing);
    const { packagePerMember = 0, plans = [] } = orderListing.getMetadata();
    const currentMealId =
      orders[currentUserGetter.getId()]?.[plans[0]]?.[+subOrderDate]?.foodId;
    const currentSecondaryMealId =
      orders[currentUserGetter.getId()]?.[plans[0]]?.[+subOrderDate]
        ?.secondaryFoodId;

    return recommendFoodForShoppingCart({
      plan,
      subOrderDate,
      packagePerMember,
      allergies,
      plans,
      dispatch,
      currentMealId,
      currentSecondaryMealId,
      isAllowAddSecondaryFood,
    });
  },
  {
    serializeError: storableError,
  },
);

const recommendFoodSubOrders = createAsyncThunk(
  RECOMMEND_FOOD_SUB_ORDERS,
  async (_, { getState, dispatch }) => {
    const { currentUser } = getState().user;
    const { plan, order, isAllowAddSecondaryFood } =
      getState().ParticipantPlanPage;
    const { orders } = getState().shoppingCart;
    const currentUserGetter = CurrentUser(currentUser!);
    const currentUserId = currentUserGetter.getId();
    const { allergies = [] } = currentUserGetter.getPublicData();
    const orderListing = Listing(order as TListing);
    const { packagePerMember = 0, plans = [] } = orderListing.getMetadata();
    const subOrderDates = Object.keys(plan);
    const notJoinedDay = Object.keys(plan).reduce(
      (acc: any, subOrderDate: string) => {
        const { memberOrder } = plan[subOrderDate];
        const { status } = memberOrder[currentUserId] || {};
        if (status === EParticipantOrderStatus.notJoined) {
          return [...acc, subOrderDate];
        }

        return acc;
      },
      [],
    );
    const notJoinedDayFromOrderShoppingCart = Object.keys(
      orders[currentUserId]?.[plans[0]] || {},
    ).reduce((acc: any, subOrderDate: string) => {
      const { foodId } =
        orders[currentUserId]?.[plans[0]]?.[+subOrderDate] || {};
      if (foodId === EParticipantOrderStatus.notJoined) {
        return [...acc, subOrderDate];
      }

      return acc;
    }, []);
    const mergedNotJoinedDay = [
      ...notJoinedDay,
      ...notJoinedDayFromOrderShoppingCart,
    ];

    const recommendSubOrderDays = difference(subOrderDates, mergedNotJoinedDay);

    recommendSubOrderDays.forEach((subOrderDate: string) => {
      const currentMealId =
        orders[currentUserGetter.getId()]?.[plans[0]]?.[+subOrderDate]?.foodId;
      const currentSecondaryMealId =
        orders[currentUserGetter.getId()]?.[plans[0]]?.[+subOrderDate]
          ?.secondaryFoodId;
      recommendFoodForShoppingCart({
        plan,
        subOrderDate,
        packagePerMember,
        allergies,
        plans,
        dispatch,
        currentMealId,
        currentSecondaryMealId,
        isAllowAddSecondaryFood,
      });
    });
  },
  {
    serializeError: storableError,
  },
);

export const ParticipantPlanThunks = {
  loadData,
  reloadData,
  updateOrder,
  recommendFoodSubOrder,
  recommendFoodSubOrders,
  placeOrder,
};

const participantPlanSlice = createSlice({
  name: 'ParticipantPlanPage',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadData.pending, (state) => {
        return {
          ...state,
          loadDataInProgress: true,
          loadDataError: null,
        };
      })
      .addCase(loadData.fulfilled, (state, { payload }) => {
        return {
          ...state,
          ...payload,
          loadDataInProgress: false,
        };
      })
      .addCase(loadData.rejected, (state, { error }) => ({
        ...state,
        loadDataError: error.message,
        loadDataInProgress: false,
      }))
      .addCase(reloadData.pending, (state) => {
        return {
          ...state,
          reloadDataInProgress: true,
          reloadDataError: null,
        };
      })
      .addCase(reloadData.fulfilled, (state, { payload }) => {
        return {
          ...state,
          ...payload,
          reloadDataInProgress: false,
        };
      })
      .addCase(reloadData.rejected, (state, { error }) => ({
        ...state,
        reloadDataError: error.message,
        reloadDataInProgress: false,
      }))
      .addCase(updateOrder.pending, (state) => {
        state.submitDataInprogress = true;
        state.submitDataError = null;
      })
      .addCase(updateOrder.fulfilled, (state) => {
        state.submitDataInprogress = false;
      })
      .addCase(updateOrder.rejected, (state, { error }) => {
        state.submitDataInprogress = false;
        state.submitDataError = error.message;
      })
      .addCase(placeOrder.pending, (state) => {
        state.submitDataInprogress = true;
        state.submitDataError = null;
      })
      .addCase(placeOrder.fulfilled, (state) => {
        state.submitDataInprogress = false;
      })
      .addCase(placeOrder.rejected, (state, { error }) => {
        state.submitDataInprogress = false;
        state.submitDataError = error.message;
      });
  },
});

export default participantPlanSlice.reducer;
