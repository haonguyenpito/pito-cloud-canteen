/* eslint-disable import/no-cycle */
import { createSlice, current } from '@reduxjs/toolkit';
import isEmpty from 'lodash/isEmpty';
import { DateTime } from 'luxon';

import {
  confirmClientPaymentApi,
  confirmPartnerPaymentApi,
  createPaymentRecordApi,
  deletePaymentRecordApi,
  disapproveClientPaymentApi,
  disapprovePartnerPaymentApi,
  getPaymentRecordsApi,
  transitionOrderPaymentStatusApi,
  transitPlanApi,
} from '@apis/admin';
import { participantSubOrderUpdateDocumentApi } from '@apis/firebaseApi';
import { createNotificationApi } from '@apis/notificationApi';
import {
  adminUpdateOrderStateApi,
  requestApprovalOrderApi,
  updateOrderApi,
  updatePlanDetailsApi,
} from '@apis/orderApi';
import { getOrderQuotationsQuery } from '@helpers/listingSearchQuery';
import { createAsyncThunk } from '@redux/redux.helper';
import {
  OrderManagementsAction,
  orderManagementThunks,
} from '@redux/slices/OrderManagement.slice';
import type { NotificationInvitationParams } from '@services/notifications';
import {
  denormalisedResponseEntities,
  Listing,
  Transaction,
  User,
} from '@src/utils/data';
import { formatTimestamp } from '@src/utils/dates';
import {
  EApiUpdateMode,
  ENotificationType,
  EPaymentType,
  ESubOrderTxStatus,
} from '@src/utils/enums';
import {
  ETransition,
  TRANSITIONS_TO_STATE_CANCELED,
} from '@src/utils/transaction';
import type {
  TListing,
  TObject,
  TPagination,
  TPaymentRecord,
  TTransaction,
  TUser,
} from '@src/utils/types';

const transitionShouldChangeFirebaseSubOrderStatus = [
  ETransition.START_DELIVERY,
  ETransition.COMPLETE_DELIVERY,
];
const mapTxTransitionToFirebaseSubOrderStatus = (lastTransition: string) => {
  switch (lastTransition) {
    case ETransition.START_DELIVERY:
      return ESubOrderTxStatus.DELIVERING;
    case ETransition.COMPLETE_DELIVERY:
      return ESubOrderTxStatus.DELIVERED;
    case ETransition.OPERATOR_CANCEL_PLAN:
    case ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED:
    case ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED:
      return ESubOrderTxStatus.CANCELED;
    default:
      return ESubOrderTxStatus.PENDING;
  }
};
const mapTxTransitionToNotificationType = (lastTransition: string) => {
  switch (lastTransition) {
    case ETransition.START_DELIVERY:
      return ENotificationType.SUB_ORDER_DELIVERING;
    case ETransition.COMPLETE_DELIVERY:
      return ENotificationType.SUB_ORDER_DELIVERED;
    case ETransition.OPERATOR_CANCEL_PLAN:
    case ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED:
    case ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED:
      return ENotificationType.SUB_ORDER_CANCELED;
    default:
      return ENotificationType.SUB_ORDER_INPROGRESS;
  }
};

// ================ Initial states ================ //
type TOrderDetailState = {
  order: TListing;
  orderDetail: any;
  company: TUser;
  booker: TUser;
  participantData: Array<TUser>;
  anonymousParticipantData: Array<TUser>;

  fetchOrderInProgress: boolean;
  fetchOrderError: any;

  transitInProgress: boolean;
  transitError: any;

  confirmPartnerPaymentInProgress: boolean;
  confirmClientPaymentInProgress: boolean;

  updateOrderStaffNameInProgress: boolean;
  updateOrderStaffNameError: any;

  updateOrderStateInProgress: boolean;
  updateOrderStateError: any;

  quotations: TListing[];
  quotationsPagination: TPagination;
  fetchQuotationsInProgress: boolean;
  fetchQuotationsError: any;

  partnerPaymentRecords: {
    [subOrderDate: string]: TPaymentRecord[];
  };
  fetchPartnerPaymentRecordsInProgress: boolean;
  fetchPartnerPaymentRecordsError: any;

  createPartnerPaymentRecordInProgress: boolean;
  createPartnerPaymentRecordError: any;

  deletePartnerPaymentRecordInProgress: boolean;
  deletePartnerPaymentRecordError: any;

  clientPaymentRecords: TPaymentRecord[];

  createClientPaymentRecordInProgress: boolean;
  createClientPaymentRecordError: any;

  deleteClientPaymentRecordInProgress: boolean;
  deleteClientPaymentRecordError: any;

  fetchOnlyOrderInProgress: boolean;
};
const initialState: TOrderDetailState = {
  order: null!,
  orderDetail: {},
  company: null!,
  booker: null!,
  participantData: [],
  anonymousParticipantData: [],

  fetchOrderInProgress: false,
  fetchOrderError: null,

  transitInProgress: false,
  transitError: null,

  confirmPartnerPaymentInProgress: false,
  confirmClientPaymentInProgress: false,

  updateOrderStaffNameInProgress: false,
  updateOrderStaffNameError: null,

  updateOrderStateInProgress: false,
  updateOrderStateError: null,

  quotations: [],
  quotationsPagination: null!,
  fetchQuotationsInProgress: false,
  fetchQuotationsError: null,
  partnerPaymentRecords: {},

  fetchPartnerPaymentRecordsInProgress: false,
  fetchPartnerPaymentRecordsError: null,

  createPartnerPaymentRecordInProgress: false,
  createPartnerPaymentRecordError: null,

  deletePartnerPaymentRecordInProgress: false,
  deletePartnerPaymentRecordError: null,

  clientPaymentRecords: [],
  createClientPaymentRecordInProgress: false,
  createClientPaymentRecordError: null,

  deleteClientPaymentRecordInProgress: false,
  deleteClientPaymentRecordError: null,

  fetchOnlyOrderInProgress: false,
};

// ================ Thunk types ================ //
const FETCH_ORDER = 'app/AdminManageOrder/FETCH_ORDER';
const CONFIRM_CLIENT_PAYMENT = 'app/AdminManageOrder/CONFIRM_CLIENT_PAYMENT';
const UPDATE_STAFF_NAME = 'app/AdminManageOrder/UPDATE_STAFF_NAME';
const UPDATE_ORDER_STATE = 'app/AdminManageOrder/UPDATE_ORDER_STATE';
const FETCH_QUOTATIONS = 'app/AdminManageOrder/FETCH_QUOTATIONS';
const CREATE_PARTNER_PAYMENT_RECORD =
  'app/AdminManageOrder/CREATE_PARTNER_PAYMENT_RECORD';
const FETCH_PARTNER_PAYMENT_RECORD =
  'app/AdminManageOrder/FETCH_PARTNER_PAYMENT_RECORD';
const DELETE_PARTNER_PAYMENT_RECORD =
  'app/AdminManageOrder/DELETE_PARTNER_PAYMENT_RECORD';
const FETCH_CLIENT_PAYMENT_RECORD =
  'app/AdminManageOrder/FETCH_CLIENT_PAYMENT_RECORD';
const CREATE_CLIENT_PAYMENT_RECORD =
  'app/AdminManageOrder/CREATE_CLIENT_PAYMENT_RECORD';
const DELETE_CLIENT_PAYMENT_RECORD =
  'app/AdminManageOrder/DELETE_CLIENT_PAYMENT_RECORD';
// ================ Async thunks ================ //

const fetchOrder = createAsyncThunk(
  FETCH_ORDER,
  async (orderId: string, { extra: sdk }) => {
    const order = await sdk.listings.show({ id: orderId });

    return denormalisedResponseEntities(order)[0];
  },
);

const updateStaffName = createAsyncThunk(
  UPDATE_STAFF_NAME,
  async (payload: { orderId: string; staffName: string }, { dispatch }) => {
    const { orderId, staffName } = payload;
    const apiBody = {
      generalInfo: {
        staffName,
      },
    };
    dispatch(OrderManagementsAction.updateStaffName(staffName));

    const { data: orderListing } = await updateOrderApi(orderId, apiBody);

    return orderListing;
  },
);

const requestApprovalOrder = createAsyncThunk(
  'app/Order/REQUEST_APPROVAL_ORDER',
  async ({ orderId }: TObject) => {
    const { data: responseData } = await requestApprovalOrderApi(orderId);

    return responseData;
  },
);

const updateOrderState = createAsyncThunk(
  UPDATE_ORDER_STATE,
  async (payload: Parameters<typeof adminUpdateOrderStateApi>[0]) => {
    const { data: orderListing } = await adminUpdateOrderStateApi({
      orderId: payload.orderId,
      orderState: payload.orderState,
      options: payload.options,
    });

    return orderListing;
  },
);

const transit = createAsyncThunk(
  'app/AdminManageOrder/TRANSIT',
  async ({ transactionId, transition }: TObject, { getState, dispatch }) => {
    const { companyData } = getState().OrderManagement;
    const { companyName } = User(companyData!).getPublicData();
    const { data: response } = await transitPlanApi({
      transactionId,
      transition,
    });

    const txGetter = Transaction(response.tx as TTransaction);
    const { booking, provider } = txGetter.getFullData();
    const { displayStart } = booking.attributes;
    const { lastTransition } = txGetter.getAttributes();
    const { planId, participantIds = [], orderId } = txGetter.getMetadata();
    const timestamp = new Date(displayStart).getTime();
    const subOrderTimestamp = DateTime.fromMillis(timestamp)
      .setZone('Asia/Ho_Chi_Minh')
      .startOf('day')
      .toMillis();
    const firebaseSubOrderIdList = participantIds.map(
      (id: string) => `${id} - ${planId} - ${subOrderTimestamp}`,
    );

    if (transitionShouldChangeFirebaseSubOrderStatus.includes(lastTransition)) {
      Promise.all(
        firebaseSubOrderIdList.map(async (subOrderId: string) => {
          await participantSubOrderUpdateDocumentApi({
            subOrderId,
            params: {
              txStatus: mapTxTransitionToFirebaseSubOrderStatus(lastTransition),
            },
          });
        }),
      );
    }
    createNotificationApi({
      notifications: [
        {
          type: mapTxTransitionToNotificationType(transition),
          params: {
            userId: User(provider).getId(),
            orderId,
            planId,
            subOrderName: `${companyName}_${formatTimestamp(timestamp)}`,
            subOrderDate: DateTime.fromISO(displayStart)
              .startOf('day')
              .toMillis(),
            companyName,
            transition,
          } as NotificationInvitationParams,
        },
      ],
    });

    dispatch(
      OrderManagementsAction.updateOrderDetailLastTransition({
        lastTransition,
        subOrderDate: subOrderTimestamp,
      }),
    );

    return { transactionId, transition, createdAt: new Date().toISOString() };
  },
);

const fetchQuotations = createAsyncThunk(
  FETCH_QUOTATIONS,
  async (orderId: string, { extra: sdk }) => {
    const query = getOrderQuotationsQuery({ orderId });
    const response = await sdk.listings.query(query);

    const { meta } = response;
    const quotations = denormalisedResponseEntities(response);

    return {
      quotations,
      quotationsPagination: meta,
    };
  },
);

const updatePlanDetail = createAsyncThunk(
  'app/AdminManageOrder/UPDATE_PLAN_DETAIL',
  async (
    {
      orderId,
      planId,
      orderDetail,
      subOrderDate,
      subOrderPatch,
      skipRefetch = false,
    }: TObject,
    { dispatch, fulfillWithValue, rejectWithValue },
  ) => {
    try {
      await updatePlanDetailsApi(orderId, {
        orderDetail: { [subOrderDate]: subOrderPatch },
        planId,
        updateMode: EApiUpdateMode.PATCH_SUB_ORDER,
      });

      if (skipRefetch) {
        return fulfillWithValue(orderDetail);
      }
      if (orderId) {
        dispatch(
          orderManagementThunks.loadData({
            orderId: orderId as string,
            isAdminFlow: true,
          }),
        );
      }

      return fulfillWithValue(null);
    } catch (error) {
      return rejectWithValue(error);
    }
  },
);

const confirmPartnerPayment = createAsyncThunk(
  'app/OrderDetail/CONFIRM_PARTNER_PAYMENT',
  async (
    {
      planId,
      subOrderDate,
    }: {
      planId: string;
      subOrderDate: string | number;
    },
    { getState },
  ) => {
    const { order } = getState().AdminManageOrder;
    const orderId = Listing(order).getId();

    const response = await confirmPartnerPaymentApi({ planId, subOrderDate });
    await transitionOrderPaymentStatusApi(orderId, planId);

    return response.data.orderDetail;
  },
);

const disapprovePartnerPayment = createAsyncThunk(
  'app/OrderDetail/DISAPPROVE_PARTNER_PAYMENT',
  async ({
    planId,
    subOrderDate,
  }: {
    planId: string;
    subOrderDate: string | number;
  }) => {
    const response = await disapprovePartnerPaymentApi({
      planId,
      subOrderDate,
    });

    return response.data.orderDetail;
  },
);

const confirmClientPayment = createAsyncThunk(
  CONFIRM_CLIENT_PAYMENT,
  async (orderId: string, { getState, dispatch }) => {
    const { order } = getState().AdminManageOrder;
    const orderListing = Listing(order);
    const { plans = [] } = orderListing.getMetadata();

    const response = await confirmClientPaymentApi(orderId);
    await transitionOrderPaymentStatusApi(orderId, plans[0]);
    await dispatch(fetchOrder(orderId));

    return response.data?.order;
  },
);

const disapproveClientPayment = createAsyncThunk(
  'app/OrderDetail/DISAPPROVE_CLIENT_PAYMENT',
  async (orderId: string) => {
    const response = await disapproveClientPaymentApi(orderId);

    return response.data?.order;
  },
);

const fetchPartnerPaymentRecords = createAsyncThunk(
  FETCH_PARTNER_PAYMENT_RECORD,
  async (orderId: string) => {
    const { data: partnerPaymentRecords } = await getPaymentRecordsApi({
      dataParams: { orderId, paymentType: EPaymentType.PARTNER },
    });

    return partnerPaymentRecords || {};
  },
);
const createPartnerPaymentRecord = createAsyncThunk(
  CREATE_PARTNER_PAYMENT_RECORD,
  async (payload: TObject, { getState, dispatch }) => {
    const { partnerPaymentRecords = {}, order } = getState().AdminManageOrder;
    const orderListing = Listing(order);
    const orderId = orderListing.getId();
    const { plans = [] } = orderListing.getMetadata();
    const { paymentType, subOrderDate } = payload;
    const apiBody = {
      paymentRecordType: paymentType,
      paymentRecordParams: {
        ...payload,
      },
    };
    const { data: newPaymentRecord } = await createPaymentRecordApi(apiBody);
    const currentPaymentRecordsBySubOrder =
      partnerPaymentRecords[subOrderDate] || [];
    const newPartnerPaymentRecords = {
      ...partnerPaymentRecords,
      [subOrderDate]: [newPaymentRecord, ...currentPaymentRecordsBySubOrder],
    };
    await transitionOrderPaymentStatusApi(orderId, plans[0]);
    await dispatch(fetchOrder(orderId));

    return newPartnerPaymentRecords;
  },
);

const deletePartnerPaymentRecord = createAsyncThunk(
  DELETE_PARTNER_PAYMENT_RECORD,
  async (
    {
      paymentRecordId,
      subOrderDate,
      shouldDisapprovePayment,
    }: {
      paymentRecordId: string;
      subOrderDate: string | number;
      shouldDisapprovePayment: boolean;
    },
    { getState, dispatch },
  ) => {
    const { partnerPaymentRecords = {}, order } = getState().AdminManageOrder;
    const orderListing = Listing(order);
    const orderId = orderListing.getId();
    const { plans = [] } = orderListing.getMetadata();
    await deletePaymentRecordApi({ paymentRecordId });

    const newPartnerPaymentRecords = Object.entries(
      partnerPaymentRecords,
      // eslint-disable-next-line @typescript-eslint/no-shadow
    ).reduce((acc: any, [subOrderDate, paymentRecords]) => {
      const newPaymentRecords = (paymentRecords as TObject[]).filter(
        (paymentRecord: any) => paymentRecord.id !== paymentRecordId,
      );
      acc[subOrderDate] = newPaymentRecords;

      return acc;
    }, {});

    if (shouldDisapprovePayment) {
      await dispatch(
        disapprovePartnerPayment({ subOrderDate, planId: plans[0] }),
      );
    }
    await transitionOrderPaymentStatusApi(orderId, plans[0]);
    await dispatch(fetchOrder(orderId));

    return newPartnerPaymentRecords;
  },
);

const fetchClientPaymentRecords = createAsyncThunk(
  FETCH_CLIENT_PAYMENT_RECORD,
  async (orderId: string) => {
    const { data: clientPaymentRecords } = await getPaymentRecordsApi({
      dataParams: { orderId, paymentType: EPaymentType.CLIENT },
    });

    return clientPaymentRecords || [];
  },
);

const createClientPaymentRecord = createAsyncThunk(
  CREATE_CLIENT_PAYMENT_RECORD,
  async (payload: TObject, { getState, dispatch }) => {
    const { clientPaymentRecords = [], order } = getState().AdminManageOrder;
    const orderListing = Listing(order);
    const orderId = orderListing.getId();
    const { plans = [] } = orderListing.getMetadata();
    const { paymentType } = payload;
    const apiBody = {
      paymentRecordType: paymentType,
      paymentRecordParams: {
        ...payload,
      },
    };
    const { data: newPaymentRecord } = await createPaymentRecordApi(apiBody);
    await transitionOrderPaymentStatusApi(orderId, plans[0]);
    await dispatch(fetchOrder(orderId));

    return [newPaymentRecord, ...clientPaymentRecords];
  },
);

const deleteClientPaymentRecord = createAsyncThunk(
  DELETE_CLIENT_PAYMENT_RECORD,
  async (
    {
      paymentRecordId,
      shouldDisapprovePayment,
    }: {
      paymentRecordId: string;
      shouldDisapprovePayment: boolean;
    },
    { getState, dispatch },
  ) => {
    const { clientPaymentRecords = [], order } = getState().AdminManageOrder;
    const orderListing = Listing(order);
    const orderId = orderListing.getId();
    const { plans = [] } = orderListing.getMetadata();
    await deletePaymentRecordApi({ paymentRecordId });

    const newClientPaymentRecords = clientPaymentRecords.filter(
      (paymentRecord: any) => paymentRecord.id !== paymentRecordId,
    );
    if (shouldDisapprovePayment) {
      await dispatch(disapproveClientPayment(orderId));
    }
    await transitionOrderPaymentStatusApi(orderId, plans[0]);
    await dispatch(fetchOrder(orderId));

    return newClientPaymentRecords;
  },
);

export const AdminManageOrderThunks = {
  updateStaffName,
  updateOrderState,
  fetchQuotations,
  transit,
  requestApprovalOrder,
  updatePlanDetail,
  // Partner payment thunks
  fetchPartnerPaymentRecords,
  createPartnerPaymentRecord,
  confirmPartnerPayment,
  deletePartnerPaymentRecord,
  // Client payment thunks
  fetchClientPaymentRecords,
  createClientPaymentRecord,
  confirmClientPayment,
  deleteClientPaymentRecord,
};

// ================ Slice ================ //
const AdminManageOrderSlice = createSlice({
  name: 'AdminManageOrder',
  initialState,
  reducers: {
    saveOrder: (state, { payload }) => {
      state.order = payload;
    },
    saveOrderDetail: (state, { payload }) => {
      state.orderDetail = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateStaffName.pending, (state) => ({
        ...state,
        updateOrderStaffNameInProgress: true,
        updateOrderStaffNameError: null,
      }))
      .addCase(updateStaffName.fulfilled, (state, { payload }) => ({
        ...state,
        updateOrderStaffNameInProgress: false,
        order: payload,
      }))
      .addCase(updateStaffName.rejected, (state, { error }) => ({
        ...state,
        updateOrderStaffNameInProgress: false,
        updateOrderStaffNameError: error.message,
      }))
      /* =============== requestApprovalOrder =============== */
      .addCase(requestApprovalOrder.pending, (state) => ({
        ...state,
        updateOrderStateInProgress: true,
        updateOrderStateError: null,
      }))
      .addCase(requestApprovalOrder.fulfilled, (state, { payload }) => ({
        ...state,
        updateOrderStateInProgress: false,
        order: payload,
      }))
      .addCase(requestApprovalOrder.rejected, (state, { error }) => ({
        ...state,
        updateOrderStateInProgress: false,
        updateOrderStateError: error.message,
      }))
      .addCase(updateOrderState.pending, (state) => ({
        ...state,
        updateOrderStateInProgress: true,
        updateOrderStateError: null,
      }))
      .addCase(updateOrderState.fulfilled, (state, { payload }) => ({
        ...state,
        updateOrderStateInProgress: false,
        order: payload,
      }))
      .addCase(updateOrderState.rejected, (state, { error }) => ({
        ...state,
        updateOrderStateInProgress: false,
        updateOrderStateError: error.message,
      }))

      .addCase(fetchQuotations.pending, (state) => ({
        ...state,
        fetchQuotationsInProgress: true,
        fetchQuotationsError: null,
      }))
      .addCase(fetchQuotations.fulfilled, (state, { payload }) => ({
        ...state,
        fetchQuotationsInProgress: false,
        quotations: payload.quotations,
        quotationsPagination: payload.quotationsPagination,
      }))
      .addCase(fetchQuotations.rejected, (state, { error }) => ({
        ...state,
        fetchQuotationsInProgress: false,
        fetchQuotationsError: error.message,
      }))
      /* =============== transit =============== */
      .addCase(transit.pending, (state) => {
        state.transitInProgress = true;
        state.transitError = null;
      })
      .addCase(transit.fulfilled, (state, { payload }) => {
        const { transactionId, transition } = payload;
        const currentState = current(state);
        const currOrderDetail = currentState.orderDetail;
        const updateEnTry = Object.entries<any>(currOrderDetail).find(
          ([_, { transactionId: _transactionId }]) =>
            _transactionId === transactionId,
        );

        if (updateEnTry) {
          const [date] = updateEnTry;
          state.orderDetail = {
            ...currOrderDetail,
            [date]: {
              ...currOrderDetail[date],
              lastTransition: transition,
              ...(TRANSITIONS_TO_STATE_CANCELED.includes(transition) && {
                status: 'canceled',
              }),
            },
          };
        }

        state.transitInProgress = false;
      })
      .addCase(transit.rejected, (state, { error }) => {
        state.transitInProgress = false;
        state.transitError = error.message;
      })
      /* =============== updatePlanDetail =============== */
      .addCase(updatePlanDetail.pending, (state) => {
        return state;
      })
      .addCase(updatePlanDetail.fulfilled, (state, { payload }) => {
        if (payload !== null && !isEmpty(payload)) {
          state.orderDetail = payload;
        }
      })
      .addCase(updatePlanDetail.rejected, (state) => {
        return state;
      })

      .addCase(fetchPartnerPaymentRecords.pending, (state) => {
        state.fetchPartnerPaymentRecordsInProgress = true;
        state.fetchPartnerPaymentRecordsError = null;
      })
      .addCase(fetchPartnerPaymentRecords.fulfilled, (state, { payload }) => {
        state.fetchPartnerPaymentRecordsInProgress = false;
        state.partnerPaymentRecords = payload;
      })
      .addCase(fetchPartnerPaymentRecords.rejected, (state, { error }) => {
        state.fetchPartnerPaymentRecordsInProgress = false;
        state.fetchPartnerPaymentRecordsError = error.message;
      })

      .addCase(createPartnerPaymentRecord.pending, (state) => {
        state.createPartnerPaymentRecordInProgress = true;
        state.createPartnerPaymentRecordError = null;
      })
      .addCase(createPartnerPaymentRecord.fulfilled, (state, { payload }) => {
        state.createPartnerPaymentRecordInProgress = false;
        state.partnerPaymentRecords = payload;
      })
      .addCase(createPartnerPaymentRecord.rejected, (state, { error }) => {
        state.createPartnerPaymentRecordInProgress = false;
        state.createPartnerPaymentRecordError = error.message;
      })

      .addCase(deletePartnerPaymentRecord.pending, (state) => {
        state.deletePartnerPaymentRecordInProgress = true;
        state.deletePartnerPaymentRecordError = null;
      })
      .addCase(deletePartnerPaymentRecord.fulfilled, (state, { payload }) => {
        state.deletePartnerPaymentRecordInProgress = false;
        state.partnerPaymentRecords = payload;
      })
      .addCase(deletePartnerPaymentRecord.rejected, (state, { error }) => {
        state.deletePartnerPaymentRecordInProgress = false;
        state.deletePartnerPaymentRecordError = error.message;
      })

      .addCase(fetchClientPaymentRecords.pending, (state) => {
        state.fetchPartnerPaymentRecordsInProgress = true;
        state.fetchPartnerPaymentRecordsError = null;
      })
      .addCase(fetchClientPaymentRecords.fulfilled, (state, { payload }) => {
        state.fetchPartnerPaymentRecordsInProgress = false;
        state.clientPaymentRecords = payload;
      })
      .addCase(fetchClientPaymentRecords.rejected, (state, { error }) => {
        state.fetchPartnerPaymentRecordsInProgress = false;
        state.fetchPartnerPaymentRecordsError = error.message;
      })

      .addCase(createClientPaymentRecord.pending, (state) => {
        state.createClientPaymentRecordInProgress = true;
        state.createClientPaymentRecordError = null;
      })
      .addCase(createClientPaymentRecord.fulfilled, (state, { payload }) => {
        state.createClientPaymentRecordInProgress = false;
        state.clientPaymentRecords = payload;
      })
      .addCase(createClientPaymentRecord.rejected, (state, { error }) => {
        state.createClientPaymentRecordInProgress = false;
        state.createClientPaymentRecordError = error.message;
      })

      .addCase(deleteClientPaymentRecord.pending, (state) => {
        state.deleteClientPaymentRecordInProgress = true;
        state.deleteClientPaymentRecordError = null;
      })
      .addCase(deleteClientPaymentRecord.fulfilled, (state, { payload }) => {
        state.deleteClientPaymentRecordInProgress = false;
        state.clientPaymentRecords = payload;
      })
      .addCase(deleteClientPaymentRecord.rejected, (state, { error }) => {
        state.deleteClientPaymentRecordInProgress = false;
        state.deleteClientPaymentRecordError = error.message;
      })

      .addCase(fetchOrder.pending, (state) => {
        state.fetchOnlyOrderInProgress = true;
      })
      .addCase(fetchOrder.fulfilled, (state, { payload }) => {
        state.fetchOnlyOrderInProgress = false;
        state.order = payload;
      })
      .addCase(fetchOrder.rejected, (state) => {
        state.fetchOnlyOrderInProgress = false;
      })
      /* =============== confirmClientPayment =============== */
      .addCase(confirmClientPayment.pending, (state) => {
        state.confirmClientPaymentInProgress = true;
      })
      .addCase(confirmClientPayment.fulfilled, (state) => {
        state.confirmClientPaymentInProgress = false;
      })
      .addCase(confirmClientPayment.rejected, (state) => {
        state.confirmClientPaymentInProgress = false;
      })
      /* =============== confirmPartnerPayment =============== */
      .addCase(confirmPartnerPayment.pending, (state) => {
        state.confirmPartnerPaymentInProgress = true;
      })
      .addCase(confirmPartnerPayment.fulfilled, (state, { payload }) => {
        state.confirmPartnerPaymentInProgress = false;
        state.orderDetail = payload;
      })
      .addCase(confirmPartnerPayment.rejected, (state) => {
        state.confirmPartnerPaymentInProgress = false;
      })
      /* =============== disapprovePartnerPayment =============== */
      .addCase(disapprovePartnerPayment.pending, (state) => {
        state.confirmPartnerPaymentInProgress = true;
      })
      .addCase(disapprovePartnerPayment.fulfilled, (state, { payload }) => {
        state.confirmPartnerPaymentInProgress = false;
        state.orderDetail = payload;
      })
      .addCase(disapprovePartnerPayment.rejected, (state) => {
        state.confirmPartnerPaymentInProgress = false;
      });
  },
});

// ================ Actions ================ //
export const AdminManageOrderActions = AdminManageOrderSlice.actions;
export default AdminManageOrderSlice.reducer;

// ================ Selectors ================ //
