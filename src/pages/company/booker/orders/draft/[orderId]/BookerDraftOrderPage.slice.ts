import { createSlice } from '@reduxjs/toolkit';
import uniq from 'lodash/uniq';

import {
  addParticipantToOrderApi,
  deleteParticipantFromOrderApi,
  getBookerOrderDataApi,
  sendRemindEmailToMemberApi,
} from '@apis/orderApi';
import { createAsyncThunk } from '@redux/redux.helper';
import { setNonAccountEmails } from '@redux/slices/Order.slice';
import { EOrderType } from '@src/utils/enums';
import { denormalisedResponseEntities, Listing } from '@utils/data';
import type { TListing, TObject, TUser } from '@utils/types';

// ================ Initial states ================ //
type TBookerDraftOrderPageState = {
  companyAccount: TUser | null;
  fetchCompanyAccountInProgress: boolean;
  fetchCompanyAccountError: any;
  selectedCalendarDate: Date;

  fetchOrderParticipantsInProgress: boolean;
  participantData: TObject[];
  removedParticipantData: TObject[];
  addOrderParticipantsInProgress: boolean;
  toastShowedAfterSuccessfullyCreatingOrder: boolean;
  walkthroughStep: number;

  fetchOrderRestaurantsInProgress: boolean;
  restaurantData: TObject[];
};
const initialState: TBookerDraftOrderPageState = {
  companyAccount: null,
  fetchCompanyAccountInProgress: false,
  fetchCompanyAccountError: null,
  selectedCalendarDate: undefined!,

  fetchOrderParticipantsInProgress: false,
  participantData: [],
  removedParticipantData: [],
  addOrderParticipantsInProgress: false,
  toastShowedAfterSuccessfullyCreatingOrder: false,
  walkthroughStep: -1,
  fetchOrderRestaurantsInProgress: false,
  restaurantData: [],
};

// ================ Thunk types ================ //
const FETCH_COMPANY_FROM_ORDER =
  'app/BookerDraftOrderPage/FETCH_COMPANY_FROM_ORDER';

// ================ Async thunks ================ //
const fetchCompanyAccount = createAsyncThunk(
  FETCH_COMPANY_FROM_ORDER,
  async (_, { getState, extra: sdk }) => {
    const { order } = getState().Order;
    const { companyId } = Listing(order as TListing).getMetadata();
    const companyAccount = denormalisedResponseEntities(
      await sdk.users.show({
        id: companyId,
      }),
    )[0];

    return {
      companyAccount,
    };
  },
);

const fetchOrderParticipants = createAsyncThunk(
  'app/BookerDraftOrderPage/FETCH_ORDER_PARTICIPANTS',
  async (_, { getState }) => {
    const { order } = getState().Order;
    const orderGetter = Listing(order as TListing);
    const { orderType = EOrderType.normal } = orderGetter.getMetadata();

    if (orderType === EOrderType.group) {
      const { data } = await getBookerOrderDataApi(orderGetter.getId());

      return {
        participantData: data.participantData,
        removedParticipantData: data.removedParticipantData,
      };
    }

    return {
      participantData: [],
      removedParticipantData: [],
    };
  },
);

const fetchOrderRestaurants = createAsyncThunk(
  'app/BookerDraftOrderPage/FETCH_ORDER_RESTAURANTS',
  async (_, { getState }) => {
    const { order } = getState().Order;
    const orderGetter = Listing(order as TListing);
    const { orderType = EOrderType.normal } = orderGetter.getMetadata();

    if (orderType === EOrderType.group) {
      const { data } = await getBookerOrderDataApi(orderGetter.getId());

      return data.restaurantData;
    }

    return [];
  },
);

const addOrderParticipants = createAsyncThunk(
  'app/BookerDraftOrderPage/ADD_ORDER_PARTICIPANTS',
  async (
    {
      orderId,
      newUserIds,
      newUsers,
      nonAccountEmails,
    }: {
      orderId: string;
      newUserIds: string[];
      newUsers: TObject[];
      nonAccountEmails: string[];
    },
    { dispatch },
  ) => {
    const bodyParams = {
      orderId,
      nonAccountEmails,
      userIds: newUserIds,
    };

    await addParticipantToOrderApi(orderId, bodyParams);

    dispatch(setNonAccountEmails(nonAccountEmails));

    return { newUsers, nonAccountEmails };
  },
);

const deleteOrderParticipants = createAsyncThunk(
  'app/BookerDraftOrderPage/DELETE_ORDER_PARTICIPANTS',
  async ({ participantId }: { participantId: string }, { getState }) => {
    const { participantData } = getState().BookerDraftOrderPage;
    const { order } = getState().Order;
    const orderId = Listing(order as TListing).getId();

    await deleteParticipantFromOrderApi(orderId, { participantId });

    return participantData.filter((p) => p.id.uuid !== participantId);
  },
);

const sendRemindEmailToMembers = createAsyncThunk(
  'app/OrderManagement/SEND_REMIND_EMAIL_TO_MEMBER',
  async (params: TObject) => {
    const { orderId, description, memberIdList } = params;

    await sendRemindEmailToMemberApi(orderId, {
      description,
      uniqueMemberIdList: uniq(memberIdList),
    });
  },
);

export const BookerDraftOrderPageThunks = {
  fetchCompanyAccount,
  fetchOrderParticipants,
  fetchOrderRestaurants,
  addOrderParticipants,
  deleteOrderParticipants,
  sendRemindEmailToMembers,
};

// ================ Slice ================ //
const BookerDraftOrderPageSlice = createSlice({
  name: 'BookerDraftOrderPage',
  initialState,
  reducers: {
    selectCalendarDate: (state, { payload }) => ({
      ...state,
      selectedCalendarDate: payload,
    }),
    setToastShowedAfterSuccessfullyCreatingOrder: (state, { payload }) => ({
      ...state,
      toastShowedAfterSuccessfullyCreatingOrder: payload,
    }),
    setWalkthroughStep: (state, { payload }) => ({
      ...state,
      walkthroughStep: payload,
    }),
    setRemovedParticipantData: (state, { payload }) => ({
      ...state,
      removedParticipantData: [...state.removedParticipantData, payload],
    }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanyAccount.pending, (state) => {
        state.fetchCompanyAccountInProgress = true;
        state.fetchCompanyAccountError = null;
      })
      .addCase(fetchCompanyAccount.fulfilled, (state, action) => {
        state.companyAccount = action.payload.companyAccount;
        state.fetchCompanyAccountInProgress = false;
      })
      .addCase(fetchCompanyAccount.rejected, (state, { payload }) => {
        state.fetchCompanyAccountInProgress = false;
        state.fetchCompanyAccountError = payload;
      })
      /* =============== fetchOrderParticipants =============== */
      .addCase(fetchOrderParticipants.pending, (state) => {
        state.fetchOrderParticipantsInProgress = true;
      })
      .addCase(fetchOrderParticipants.fulfilled, (state, { payload }) => {
        state.fetchOrderParticipantsInProgress = false;
        state.participantData = payload.participantData;
        state.removedParticipantData = payload.removedParticipantData;
      })
      .addCase(fetchOrderParticipants.rejected, (state) => {
        state.fetchOrderParticipantsInProgress = false;
      })
      /* =============== fetchOrderRestaurants =============== */
      .addCase(fetchOrderRestaurants.pending, (state) => {
        state.fetchOrderRestaurantsInProgress = true;
      })
      .addCase(fetchOrderRestaurants.fulfilled, (state, { payload }) => {
        state.fetchOrderRestaurantsInProgress = false;
        state.restaurantData = payload;
      })
      .addCase(fetchOrderRestaurants.rejected, (state) => {
        state.fetchOrderRestaurantsInProgress = false;
      })
      /* =============== addOrderParticipants =============== */
      .addCase(addOrderParticipants.pending, (state) => {
        state.addOrderParticipantsInProgress = true;
      })
      .addCase(addOrderParticipants.fulfilled, (state, { payload }) => {
        state.addOrderParticipantsInProgress = false;
        state.participantData = state.participantData.concat(payload.newUsers);
        state.removedParticipantData = state.removedParticipantData.filter(
          (p) => !payload.newUsers.map((u) => u.id.uuid).includes(p.id.uuid),
        );
      })
      .addCase(addOrderParticipants.rejected, (state) => {
        state.addOrderParticipantsInProgress = false;
      })
      /* =============== deleteOrderParticipants =============== */
      .addCase(deleteOrderParticipants.pending, (state) => {
        return state;
      })
      .addCase(deleteOrderParticipants.fulfilled, (state, { payload }) => {
        state.participantData = payload;
        state.removedParticipantData = state.removedParticipantData.filter(
          (p) => !payload.includes(p),
        );
      })
      .addCase(deleteOrderParticipants.rejected, (state) => {
        return state;
      });
  },
});

// ================ Actions ================ //
export const BookerDraftOrderPageActions = BookerDraftOrderPageSlice.actions;
export default BookerDraftOrderPageSlice.reducer;

// ================ Selectors ================ //
