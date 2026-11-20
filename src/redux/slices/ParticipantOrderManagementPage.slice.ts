import { createSlice } from '@reduxjs/toolkit';
import compact from 'lodash/compact';
import uniq from 'lodash/uniq';

import { updateParticipantOrderApi } from '@apis/index';
import { updateFirstTimeViewOrderApi } from '@apis/participantApi';
import { fetchTxApi } from '@apis/txApi';
import {
  applyParticipantOrderToPlan,
  getParticipantOrderDays,
} from '@helpers/order/orderDetailHelper';
import { createAsyncThunk } from '@redux/redux.helper';
import { runParticipantOrderJob } from '@redux/slices/ParticipantOrderJob.slice';
import type { TUpdateParticipantOrderBody } from '@src/types/order';
import { denormalisedResponseEntities, Listing } from '@src/utils/data';
import { EImageVariants, EParticipantOrderStatus } from '@src/utils/enums';
import { storableError } from '@utils/errors';
import type { TListing, TTransaction, TUser } from '@utils/types';

const LOAD_DATA = 'app/OrderManagementPage/LOAD_DATA';
const UPDATE_ORDER = 'app/OrderManagementPage/UPDATE_ORDER';
const UPDATE_FIRST_TIME_VIEW_ORDER =
  'app/OrderManagementPage/UPDATE_FIRST_TIME_VIEW_ORDER';

type TParticipantOrderManagementState = {
  company: TUser | {};
  booker: TUser | {};
  order: TListing | {};
  plans: TListing[];
  pickedFoods: TListing[];
  subOrders: any[];
  loadDataInProgress: boolean;
  loadDataError: any;
  // Update order
  updateOrderInProgress: boolean;
  updateOrderError: any;
  restaurants: TListing[];
  subOrderTxs: TTransaction[];

  shouldShowFirstTimeOrderModal: boolean;
  updateFirstTimeViewOrderInProgress: boolean;
};

const initialState: TParticipantOrderManagementState = {
  company: {},
  booker: {},
  order: {},
  plans: [],
  subOrders: [],
  pickedFoods: [],
  loadDataInProgress: false,
  loadDataError: null,

  // Update order
  updateOrderInProgress: false,
  updateOrderError: null,

  restaurants: [],
  subOrderTxs: [],
  shouldShowFirstTimeOrderModal: false,
  updateFirstTimeViewOrderInProgress: false,
};

const loadData = createAsyncThunk(
  LOAD_DATA,
  async (orderId: string, { extra: sdk, getState }) => {
    const { currentUser } = getState().user;
    const currentUserId = currentUser?.id?.uuid;
    let returnValues = {};

    const order = denormalisedResponseEntities(
      await sdk.listings.show({
        id: orderId,
      }),
    )[0];
    const orderListing = Listing(order);
    const { plans = [], companyId, bookerId } = orderListing.getMetadata();
    const plan = denormalisedResponseEntities(
      await sdk.listings.show({
        id: plans[0],
      }),
    )[0];

    const { orderDetail: subOrders } = Listing(plan).getMetadata();
    const allRelatedRestaurantsIdList = uniq(
      compact(
        Object.values(subOrders).map(
          (subOrder: any) => subOrder?.restaurant?.id,
        ),
      ),
    );

    const pickedFoodIds: any[] = [];
    Object.keys(subOrders).forEach((key) => {
      const subOrderDate = subOrders[key];
      const memberOrder = subOrderDate?.memberOrders[currentUserId];
      if (memberOrder) {
        const { foodId, status, secondaryFoodId } = memberOrder;

        if (foodId && status === EParticipantOrderStatus.joined) {
          pickedFoodIds.push(foodId);
        }
        if (secondaryFoodId && status === EParticipantOrderStatus.joined) {
          pickedFoodIds.push(secondaryFoodId);
        }
      }
    });

    const pickedFoods = denormalisedResponseEntities(
      await sdk.listings.query({
        ids: pickedFoodIds,
        include: ['images'],
        'fields.image': [`variants.${EImageVariants.default}`],
      }),
    );

    const allRelatedRestaurants = denormalisedResponseEntities(
      await sdk.listings.query({
        ids: allRelatedRestaurantsIdList,
      }),
    );
    const txIds = compact(
      Object.values(subOrders).map((subOrder: any) => subOrder?.transactionId),
    );

    const subOrderTxs = await Promise.all(
      txIds.map(async (txId: string) => {
        const { data: tx } = await fetchTxApi(txId);

        return tx;
      }),
    );

    returnValues = {
      order,
      plans: [plan],
      pickedFoods,
      restaurants: allRelatedRestaurants,
      subOrderTxs,
      shouldShowFirstTimeOrderModal:
        !orderListing.getMetadata()[`hideFirstTimeOrderModal_${currentUserId}`],
    };

    if (companyId) {
      const company = (denormalisedResponseEntities(
        await sdk.users.show({
          id: companyId,
          include: ['profileImage'],
          'fields.image': [`variants.${EImageVariants.squareSmall}`],
        }),
      ) || [{}])[0];

      returnValues = { ...returnValues, company };
    }
    if (bookerId) {
      const booker = (denormalisedResponseEntities(
        await sdk.users.show({
          id: bookerId,
          include: ['profileImage'],
          'fields.image': [`variants.${EImageVariants.squareSmall}`],
        }),
      ) || [{}])[0];
      returnValues = { ...returnValues, booker };
    }

    return returnValues;
  },
  {
    serializeError: storableError,
  },
);

const updateOrder = createAsyncThunk(
  UPDATE_ORDER,
  async (
    data: { orderId: string; updateValues: TUpdateParticipantOrderBody },
    { getState, dispatch },
  ) => {
    const { orderId, updateValues } = data;
    const currentUserId = getState().user.currentUser?.id?.uuid as string;
    await runParticipantOrderJob({
      dispatch,
      planId: updateValues.planId,
      userId: currentUserId,
      days: getParticipantOrderDays(updateValues),
      submit: async () =>
        (
          await updateParticipantOrderApi(orderId, updateValues)
        ).data,
    });

    const { plans } = getState().ParticipantOrderManagementPage;
    const newAllPlans = plans.map((plan: any) =>
      applyParticipantOrderToPlan(plan, updateValues, currentUserId),
    );

    return {
      plans: newAllPlans,
    };
  },
  {
    serializeError: storableError,
  },
);

const updateFirstTimeViewOrder = createAsyncThunk(
  UPDATE_FIRST_TIME_VIEW_ORDER,
  async (orderId: string) => {
    await updateFirstTimeViewOrderApi(orderId);
  },
  {
    serializeError: storableError,
  },
);

export const participantOrderManagementThunks = {
  loadData,
  updateOrder,
  updateFirstTimeViewOrder,
};

const participantOrderSlice = createSlice({
  name: 'ParticipantOrderManagement',
  initialState,
  reducers: {
    setFirstTimeViewOrder(state, { payload }) {
      state.shouldShowFirstTimeOrderModal = payload;
    },
    updatePlans: (state, { payload }) => {
      state.plans = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      /* =============== loadData =============== */
      .addCase(loadData.pending, (state) => ({
        ...state,
        loadDataInProgress: true,
        loadDataError: null,
      }))
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
      .addCase(updateOrder.pending, (state) => ({
        ...state,
        updateOrderInProgress: true,
        updateOrderError: null,
      }))
      .addCase(updateOrder.fulfilled, (state, { payload }) => ({
        ...state,
        updateOrderInProgress: false,
        plans: payload.plans,
      }))
      .addCase(updateOrder.rejected, (state, { error }) => ({
        ...state,
        updateOrderInProgress: false,
        updateOrderError: error.message,
      }))

      .addCase(updateFirstTimeViewOrder.pending, (state) => ({
        ...state,
        firstTimeViewOrderInProgress: true,
      }))

      .addCase(updateFirstTimeViewOrder.fulfilled, (state) => ({
        ...state,
        firstTimeViewOrderInProgress: false,
        shouldShowFirstTimeOrderModal: false,
      }))

      .addCase(updateFirstTimeViewOrder.rejected, (state) => ({
        ...state,
        firstTimeViewOrderInProgress: false,
      }));
  },
});

export const ParticipantOrderManagementActions = participantOrderSlice.actions;

export default participantOrderSlice.reducer;
