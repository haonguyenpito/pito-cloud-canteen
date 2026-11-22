import { createSlice } from '@reduxjs/toolkit';
import compact from 'lodash/compact';
import isEmpty from 'lodash/isEmpty';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import uniq from 'lodash/uniq';
import { DateTime } from 'luxon';

import {
  handleDeleteOldDataAfterEditInProgressOrderApi,
  handleSendNotificationParticipantAfterEditInProgressOrderApi,
  handleSendNotificationPartnerAfterEditInProgressOrderApi,
  handleSendNotificationPartnerAfterEditInProgressOrderDetailApi,
} from '@apis/admin';
import {
  companyApi,
  getCompanyNotificationsApi,
  getCompanyOrderSummaryApi,
} from '@apis/companyApi';
import { fetchUserApi } from '@apis/index';
import type { TUpdateOrderApiBody } from '@apis/orderApi';
import {
  adminNotifyUserPickingOrderChangesApi,
  bookerCancelPendingApprovalOrderApi,
  bookerDeleteDraftOrderApi,
  createBookerOrderApi,
  publishOrderApi,
  queryOrdersApi,
  recommendRestaurantApi,
  reorderApi,
  sendOrderChangeFirebaseNotificationToBokerApi,
  sendOrderChangeFirebaseNotificationToPartnerApi,
  updateOrderApi,
  updateOrderStateToDraftApi,
  updatePlanDetailsApi,
} from '@apis/orderApi';
import { queryRestaurantListingsApi } from '@apis/restaurant';
import { queryAllPages } from '@helpers/apiHelpers';
import { convertHHmmStringToTimeParts } from '@helpers/dateHelpers';
import { getMenuQueryInSpecificDay } from '@helpers/listingSearchQuery';
import { mergeRecommendOrderDetailWithCurrentOrderDetail } from '@helpers/orderHelper';
import { createAsyncThunk } from '@redux/redux.helper';
import config from '@src/configs';
import { CompanyPermissions } from '@src/types/UserPermission';
import { getSelectedDaysOfWeek } from '@src/utils/dates';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
  User,
} from '@utils/data';
import {
  ECompanyDashboardNotificationType,
  EInvalidRestaurantCase,
  EListingStates,
  EListingType,
  EManageCompanyOrdersTab,
  EOrderType,
  ERestaurantListingStatus,
  MANAGE_COMPANY_ORDERS_TAB_MAP,
} from '@utils/enums';
import { storableAxiosError, storableError } from '@utils/errors';
import type {
  TCompanyOrderNoticationMap,
  TCompanyOrderSummary,
  TListing,
  TObject,
  TOrderStateCountMap,
  TPagination,
} from '@utils/types';

// eslint-disable-next-line import/no-cycle
import { BookerSelectRestaurantActions } from '../../pages/company/booker/orders/draft/[orderId]/restaurants/BookerSelectRestaurant.slice';

import { SystemAttributesThunks } from './systemAttributes.slice';

export const MANAGE_ORDER_PAGE_SIZE = 10;

type TOrderInitialState = {
  order: TListing | null;
  draftEditOrderData: {
    generalInfo: TObject;
    orderDetail?: TObject;
  };
  fetchOrderInProgress: boolean;
  fetchOrderError: any;
  plans: TListing[];

  createOrderInProcess: boolean;
  createOrderError: any;

  completeOrderInProgress: boolean;
  completeOrderError: any;
  draftOrder: any;
  selectedCompany: any;

  fetchBookersInProgress: boolean;
  fetchBookersError: any;
  bookerList: any[];
  selectedBooker: any;

  selectedCalendarDate: Date;
  isSelectingRestaurant: boolean;

  updateOrderInProgress: boolean;
  updateOrderError: any;

  updateOrderDetailInProgress: boolean;
  updateOrderDetailError: any;

  orderDetail: any;
  justDeletedMemberOrder: boolean;
  fetchOrderDetailInProgress: boolean;
  fetchOrderDetailError: any;

  publishOrderInProgress: boolean;
  publishOrderError: any;

  // Manage Orders Page
  queryParams: TObject;
  orders: TListing[];
  queryOrderInProgress: boolean;
  queryMoreOrderInProgress: boolean;
  queryOrderError: any;
  deleteDraftOrderInProgress: boolean;
  deleteDraftOrderError: any;
  manageOrdersPagination: TPagination;

  queryTotalOrdersCountByTabInProgress: boolean;
  queryTotalOrdersCountByTabError: any;
  totalItemMap: TOrderStateCountMap | null;

  companyOrderNotificationMap: TCompanyOrderNoticationMap;
  getOrderNotificationInProgress: boolean;
  getOrderNotificationError: any;

  restaurantCoverImageList: {
    [restaurantId: string]: any;
  };
  restaurantListings: TListing[];
  fetchRestaurantCoverImageInProgress: boolean;
  fetchRestaurantCoverImageError: any;

  isAllDatesHaveNoRestaurants: boolean;
  recommendRestaurantInProgress: boolean;
  recommendRestaurantError: any;

  step2SubmitInProgress: boolean;
  step4SubmitInProgress: boolean;
  currentSelectedMenuId: string;

  canNotGoAfterOderDetail: boolean;
  canNotGoAfterFoodQuantity: boolean;
  onRecommendRestaurantInProgress: boolean;
  onRescommendRestaurantForSpecificDateInProgress: boolean;
  onRescommendRestaurantForSpecificDateError: any;

  availableOrderDetailCheckList: {
    [timestamp: string]: {
      isAvailable: boolean;
      status?: EInvalidRestaurantCase;
    };
  };

  orderRestaurantList: TListing[];
  fetchOrderRestaurantListInProgress: boolean;
  fetchOrderRestaurantListError: any;

  getCompanyOrderSummaryInProgress: boolean;
  getCompanyOrderSummaryError: any;
  companyOrderSummary: TCompanyOrderSummary;

  allOrders: TListing[];
  queryAllOrdersInProgress: boolean;
  queryAllOrdersError: any;
  currentOrderVATPercentage: number;

  reorderInProgressId: string | null;
  reorderError: any;

  updateOrderStateToDraftInProgress: boolean;
  updateOrderStateToDraftError: any;

  bookerDeleteOrderInProgress: boolean;
  bookerDeleteOrderError: any;

  queryCompanyPlansByOrderIdsInProgress: boolean;
  queryCompanyPlansByOrderIdsError: any;
  plansByOrderIds: TListing[];
  currentQueryPlansByOrderIdsRequestId: string | null;

  menuListings: TListing[];
  fetchMenuListingsInProgress: boolean;
  fetchMenuListingsError: any;
};

const initialState: TOrderInitialState = {
  order: null,
  fetchOrderInProgress: false,
  fetchOrderError: null,
  plans: [] as TListing[],
  orderDetail: {},
  draftEditOrderData: {
    generalInfo: {},
    orderDetail: {},
  },
  justDeletedMemberOrder: false,
  createOrderInProcess: false,
  createOrderError: null,

  completeOrderInProgress: false,
  completeOrderError: null,
  draftOrder: {},
  selectedCompany: null,

  fetchBookersInProgress: false,
  fetchBookersError: null,
  bookerList: [],
  selectedBooker: null,

  updateOrderDetailInProgress: false,
  updateOrderDetailError: null,

  selectedCalendarDate: undefined!,
  isSelectingRestaurant: false,

  updateOrderInProgress: false,
  updateOrderError: null,

  fetchOrderDetailInProgress: false,
  fetchOrderDetailError: null,

  publishOrderInProgress: false,
  publishOrderError: null,

  // Manage Orders
  queryParams: {},
  orders: [],
  queryOrderInProgress: false,
  queryMoreOrderInProgress: false,
  queryOrderError: null,
  deleteDraftOrderInProgress: false,
  deleteDraftOrderError: null,
  manageOrdersPagination: {
    totalItems: 0,
    totalPages: 1,
    page: 1,
    perPage: 10,
  },
  totalItemMap: null,

  queryTotalOrdersCountByTabInProgress: false,
  queryTotalOrdersCountByTabError: null,

  getOrderNotificationInProgress: false,
  getOrderNotificationError: null,
  companyOrderNotificationMap: {
    [ECompanyDashboardNotificationType.completedOrder]: null,
    [ECompanyDashboardNotificationType.deadlineDueOrder]: null,
    [ECompanyDashboardNotificationType.draftOrder]: null,
    [ECompanyDashboardNotificationType.pickingOrder]: null,
  },

  restaurantCoverImageList: {},
  restaurantListings: [],
  fetchRestaurantCoverImageInProgress: false,
  fetchRestaurantCoverImageError: null,

  isAllDatesHaveNoRestaurants: false,
  recommendRestaurantInProgress: false,
  recommendRestaurantError: null,
  step2SubmitInProgress: false,
  step4SubmitInProgress: false,
  currentSelectedMenuId: '',
  canNotGoAfterOderDetail: false,
  canNotGoAfterFoodQuantity: false,
  onRecommendRestaurantInProgress: false,

  onRescommendRestaurantForSpecificDateInProgress: false,
  onRescommendRestaurantForSpecificDateError: null,

  availableOrderDetailCheckList: {},
  orderRestaurantList: [],
  fetchOrderRestaurantListInProgress: false,
  fetchOrderRestaurantListError: null,

  getCompanyOrderSummaryInProgress: false,
  getCompanyOrderSummaryError: null,
  companyOrderSummary: {
    totalOrderDishes: 0,
    totalOrderCost: 0,
  },

  allOrders: [],
  queryAllOrdersInProgress: false,
  queryAllOrdersError: null,
  currentOrderVATPercentage: config.VATPercentage,

  reorderInProgressId: null,
  reorderError: null,

  updateOrderStateToDraftInProgress: false,
  updateOrderStateToDraftError: null,

  bookerDeleteOrderInProgress: false,
  bookerDeleteOrderError: null,

  queryCompanyPlansByOrderIdsInProgress: false,
  queryCompanyPlansByOrderIdsError: null,
  plansByOrderIds: [],
  currentQueryPlansByOrderIdsRequestId: null,

  menuListings: [],
  fetchMenuListingsInProgress: false,
  fetchMenuListingsError: null,
};

const CREATE_ORDER = 'app/Order/CREATE_ORDER';
const UPDATE_ORDER = 'app/Order/UPDATE_ORDER';
const FETCH_COMPANY_BOOKERS = 'app/Order/FETCH_COMPANY_BOOKERS';
const FETCH_ORDER = 'app/Order/FETCH_ORDER';
const FETCH_ORDER_DETAIL = 'app/Order/FETCH_ORDER_DETAIL';
const QUERY_SUB_ORDERS = 'app/Order/QUERY_SUB_ORDERS';
const UPDATE_PLAN_DETAIL = 'app/Order/UPDATE_PLAN_DETAIL';
const FETCH_PLAN_DETAIL = 'app/Order/FETCH_PLAN_DETAIL';
const FETCH_RESTAURANT_COVER_IMAGE = 'app/Order/FETCH_RESTAURANT_COVER_IMAGE';
const RECOMMEND_RESTAURANT = 'app/Order/RECOMMEND_RESTAURANT';
const RECOMMEND_RESTAURANT_FOR_SPECIFIC_DAY =
  'app/Order/RECOMMEND_RESTAURANT_FOR_SPECIFIC_DAY';
const CHECK_RESTAURANT_STILL_AVAILABLE =
  'app/Order/CHECK_RESTAURANT_STILL_AVAILABLE';
const FETCH_ORDER_RESTAURANTS = 'app/Order/FETCH_ORDER_RESTAURANTS';
const FETCH_MENU_BY_IDS = 'app/Order/FETCH_ORDER_MENU_FOOD_QUANTITY';

const GET_COMPANY_ORDER_NOTIFICATIONS =
  'app/Order/GET_COMPANY_ORDER_NOTIFICATIONS';

const GET_COMPANY_ORDER_SUMMARY = 'app/Order/GET_COMPANY_ORDER_SUMMARY';
const QUERY_ALL_ORDERS = 'app/Order/QUERY_ALL_ORDERS';

const BOOKER_REORDER = 'app/Order/BOOKER_REORDER';
const UPDATE_ORDER_STATE_TO_DRAFT = 'app/Order/UPDATE_ORDER_STATE_TO_DRAFT';
const BOOKER_DELETE_ORDER = 'app/Order/BOOKER_DELETE_ORDER';
const HANDLE_SEND_EDIT_INPROGRESS_ORDER_NOTIFICATION_TO_PARTICIPANT =
  'app/Order/HANDLE_SEND_EDIT_INPROGRESS_ORDER_NOTIFICATION_TO_PARTICIPANT';
const HANDLE_SEND_EDIT_INPROGRESS_ORDER_NOTIFICATION_TO_PARTNER =
  'app/Order/HANDLE_SEND_EDIT_INPROGRESS_ORDER_NOTIFICATION_TO_PARTNER';
const HANDLE_SEND_EDIT_INPROGRESS_ORDER_DETAIL_NOTIFICATION_TO_PARTNER =
  'app/Order/HANDLE_SEND_EDIT_INPROGRESS_ORDER_DETAIL_NOTIFICATION_TO_PARTNER';
const HANDLE_DELETE_OLD_DATA_AFTER_EDIT_IN_PROGRESS_ORDER =
  'app/Order/HANDLE_DELETE_OLD_DATA_AFTER_EDIT_IN_PROGRESS_ORDER';

const SEND_ORDER_CHANGE_FIREBASE_NOTIFICATION_TO_BOOKER =
  'app/Order/SEND_ORDER_CHANGE_FIREBASE_NOTIFICATION_TO_BOOKER';
const SEND_ORDER_CHANGE_FIREBASE_NOTIFICATION_TO_PARTNER =
  'app/Order/SEND_ORDER_CHANGE_FIREBASE_NOTIFICATION_TO_PARTNER';

const createOrder = createAsyncThunk(
  CREATE_ORDER,
  async (
    params: { isCreatedByAdmin: boolean; clientId?: string; bookerId?: string },
    { getState },
  ) => {
    const { isCreatedByAdmin = false, clientId, bookerId } = params;
    const { quiz, previousOrder, isCopyPreviousOrder, selectedCompany } =
      getState().Quiz;
    const { currentUser } = getState().user;
    const currentUserGetter = CurrentUser(currentUser!);
    const { hasOrderBefore = false, quizData: bookerQuizData } =
      currentUserGetter.getPrivateData();

    const {
      startDate,
      endDate,
      orderType,
      dayInWeek,
      daySession,
      deliveryHour,
    } = quiz;

    const newIsGroupOrder = isCopyPreviousOrder
      ? Listing(previousOrder).getMetadata().orderType === EOrderType.group
      : orderType === EOrderType.group;

    const startDateTimestamp = new Date(startDate).getTime();
    const endDateTimestamp = new Date(endDate).getTime();

    const selectedDays = getSelectedDaysOfWeek(
      startDateTimestamp,
      endDateTimestamp,
      dayInWeek,
    );

    const newOrderApiBody = {
      companyId: clientId || User(selectedCompany).getId(),
      bookerId: bookerId || User(currentUser!).getId(),
      isCreatedByAdmin,
      generalInfo: {
        ...(hasOrderBefore ? bookerQuizData : quiz),
        orderType: isCreatedByAdmin
          ? EOrderType.group
          : newIsGroupOrder
          ? EOrderType.group
          : EOrderType.normal,
        deliveryAddress:
          User(selectedCompany).getPublicData().companyLocation || {},
        dayInWeek: selectedDays,
        startDate: startDateTimestamp,
        endDate: endDateTimestamp,
        daySession,
        deliveryHour,
      },
    };

    const { data: orderListing } = isCopyPreviousOrder
      ? await reorderApi(Listing(previousOrder!).getId(), {
          startDate: startDateTimestamp,
          endDate: endDateTimestamp,
          daySession,
        })
      : await createBookerOrderApi(newOrderApiBody);

    return orderListing;
  },
);

const updateOrder = createAsyncThunk(
  UPDATE_ORDER,
  async (params: any, { getState }) => {
    const { order } = getState().Order;
    const { generalInfo } = params;
    const { deadlineDate, deadlineHour } = generalInfo || {};
    const orderId = Listing(order as TListing).getId();
    const parsedDeadlineDate =
      isNumber(deadlineDate) || isString(deadlineDate)
        ? (isNumber(deadlineDate)
            ? DateTime.fromMillis(deadlineDate)
            : DateTime.fromISO(deadlineDate)
          )
            .startOf('day')
            .plus({
              ...convertHHmmStringToTimeParts(deadlineHour),
            })
            .toMillis()
        : undefined;

    const apiBody: TUpdateOrderApiBody = {
      generalInfo: {
        ...generalInfo,
        ...(parsedDeadlineDate ? { deadlineDate: parsedDeadlineDate } : {}),
      },
    };
    const { data: orderListing } = await updateOrderApi(orderId, apiBody);

    return {
      orderListing,
    };
  },
);

const recommendRestaurants = createAsyncThunk(
  RECOMMEND_RESTAURANT,
  async (
    {
      // eslint-disable-next-line unused-imports/no-unused-vars
      shouldUpdatePlanOrderOrderDetail = true,
      recommendParams = {},
    }: TObject,
    { getState },
  ) => {
    const { order } = getState().Order;
    const orderId = Listing(order).getId();
    const { data: orderDetail } = await recommendRestaurantApi({
      orderId,
      recommendParams,
    });

    return orderDetail;
  },
);

const recommendRestaurantForSpecificDay = createAsyncThunk(
  RECOMMEND_RESTAURANT_FOR_SPECIFIC_DAY,
  async (
    {
      shouldUpdatePlanOrderOrderDetail = true,
      dateTime,
      recommendParams = {},
    }: TObject,
    { getState, dispatch },
  ) => {
    const { order, draftEditOrderData } = getState().Order;

    const orderId = Listing(order).getId();

    const { plans = [] } = Listing(order).getMetadata();

    let updateOrderDetail = {};

    const { data: newOrderDetail } = await recommendRestaurantApi({
      orderId,
      timestamp: dateTime,
      recommendParams,
    });

    if (shouldUpdatePlanOrderOrderDetail) {
      updateOrderDetail = newOrderDetail;
      updatePlanDetailsApi(orderId, {
        orderDetail: newOrderDetail,
        planId: plans[0],
      });
    } else {
      updateOrderDetail = mergeRecommendOrderDetailWithCurrentOrderDetail(
        draftEditOrderData?.orderDetail!,
        newOrderDetail,
        dateTime,
      );

      dispatch(
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        saveDraftEditOrder({
          orderDetail: updateOrderDetail,
        }),
      );
    }

    return { orderDetail: updateOrderDetail, shouldUpdatePlanOrderOrderDetail };
  },
);

const queryOrders = createAsyncThunk(
  QUERY_SUB_ORDERS,
  async (payload: TObject = {}) => {
    const params = {
      dataParams: {
        ...payload,
        states: EListingStates.published,
        perPage: MANAGE_ORDER_PAGE_SIZE,
      },
      queryParams: {
        expand: true,
      },
    };
    const { data } = await queryOrdersApi(params);
    const { orders, pagination } = data;

    return { orders, pagination };
  },
  {
    serializeError: storableError,
  },
);
const queryAllOrders = createAsyncThunk(
  QUERY_ALL_ORDERS,
  async (payload: TObject = {}) => {
    const params = {
      dataParams: {
        ...payload,
        states: EListingStates.published,
      },
      queryParams: {},
      isQueryAllPages: true,
    };

    const { data } = await queryOrdersApi(params);
    const { orders } = data;

    return orders;
  },
);

const queryCompanyPlansByOrderIds = createAsyncThunk(
  'app/Orders/COMPANY_QUERY_PLANS_BY_ORDER_IDS',
  async (payload: TObject) => {
    const { orderIds, companyId } = payload;

    const params = {
      dataParams: {
        meta_orderId: orderIds.join(','),
      },
      queryParams: {},
    };

    const { data } = await companyApi.queryCompanyPlansByOrderIdsApi(
      companyId,
      params,
    );

    return data;
  },
  {
    serializeError: storableError,
  },
);

const queryTotalOrderCountByTab = createAsyncThunk(
  'app/Orders/QUERY_TOTAL_ORDER_COUNT_BY_TAB',
  async (payload: TObject) => {
    const {
      companyId,
      currentTab = EManageCompanyOrdersTab.ALL,
      page,
      pagination,
      ...rest
    } = payload;
    const { totalItems = 0, totalPages = 1 } = pagination;

    const totalItemMap: TObject = {
      [currentTab]: page > totalPages ? 0 : totalItems,
    };

    const queryStates = Object.entries(MANAGE_COMPANY_ORDERS_TAB_MAP).reduce<
      string[][]
    >((prev, [key, states]) => {
      if (key !== currentTab) {
        const newList = [key, states.join(',')];

        return prev.concat([newList]);
      }

      return prev;
    }, []);

    const paramList = queryStates.reduce<TObject[]>(
      (previousList, [key, parsedStates]) =>
        previousList.concat([
          {
            perPage: MANAGE_ORDER_PAGE_SIZE,
            states: EListingStates.published,
            meta_listingType: EListingType.order,
            sort: 'createdAt',
            meta_orderState: parsedStates,
            tab: key,
            ...rest,
          },
        ]),
      [],
    );

    await Promise.all(
      paramList.map(async (params) => {
        const { tab, ...restParams } = params;
        const { data: orderResponse } = await companyApi.queryOrdersApi(
          companyId,
          {
            dataParams: restParams,
          },
        );
        const { totalPages: resTotalPages = 1, totalItems: resTotalItems = 0 } =
          orderResponse.data.meta;

        totalItemMap[tab] = page > resTotalPages ? 0 : resTotalItems;
      }),
    );

    return totalItemMap as any;
  },
  {
    serializeError: storableError,
  },
);

const queryCompanyOrders = createAsyncThunk(
  'app/Orders/COMPANY_QUERY_ORDERS',
  async (payload: TObject, { rejectWithValue, dispatch, getState }) => {
    const { orders: prevOrders } = getState().Order;
    const {
      companyId = '',
      bookerId,
      authorId,
      currentTab,
      mode = 'replace',
      ...restPayload
    } = payload;

    if (!bookerId) {
      return rejectWithValue('Booker ID is empty');
    }

    const params = {
      dataParams: {
        ...restPayload,
        perPage: MANAGE_ORDER_PAGE_SIZE,
        states: EListingStates.published,
        ...(authorId ? { authorId } : {}),
        ...(companyId !== bookerId ? { meta_bookerId: bookerId } : {}),
        meta_listingType: EListingType.order,
        sort: 'createdAt',
      },
      queryParams: {},
    };

    if (mode === 'append' && payload.page > 1) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      dispatch(setQueryMoreOrderInProgress(true));
    }

    const { data: response } = await companyApi.queryOrdersApi(
      companyId,
      params,
    );
    let orders = denormalisedResponseEntities(response);
    if (mode === 'append' && payload.page > 1) {
      orders = prevOrders.concat(orders);
    }

    const orderIds = orders.map((order: TListing) => Listing(order).getId());
    const pagination = response.data.meta;

    dispatch(
      queryCompanyPlansByOrderIds({
        orderIds,
        companyId,
      }),
    );

    const alreadyFetchOrderCount = !!getState().Order.totalItemMap;

    if (!isEmpty(authorId) && !alreadyFetchOrderCount) {
      dispatch(
        queryTotalOrderCountByTab({
          ...(authorId ? { authorId } : {}),
          ...(companyId !== bookerId ? { meta_bookerId: bookerId } : {}),
          companyId,
          currentTab,
          page: restPayload.page,
          pagination,
        }),
      );
    }

    return { orders, pagination, queryParams: payload };
  },
  {
    serializeError: storableError,
  },
);

const fetchCompanyBookers = createAsyncThunk(
  FETCH_COMPANY_BOOKERS,
  async (companyId: string, { extra: sdk }) => {
    const companyAccount = denormalisedResponseEntities(
      await sdk.users.show({
        id: companyId,
      }),
    )[0];
    const { members = {} } = User(companyAccount).getMetadata();
    const bookerEmails = Object.keys(members).filter((email) =>
      CompanyPermissions.includes(members[email].permission),
    );
    const bookers = await Promise.all(
      bookerEmails.map(async (email) => {
        const { data } = await fetchUserApi(members[email].id);

        return data;
      }),
    );

    return bookers;
  },
);

const loadPlanOrderDetail = async (sdk: any, planId: string) => {
  const response: any = denormalisedResponseEntities(
    await sdk.listings.show({
      id: planId,
    }),
  )[0];

  return Listing(response).getMetadata().orderDetail;
};

const fetchOrderDetail = createAsyncThunk(
  FETCH_ORDER_DETAIL,
  async (plans: string[], { extra: sdk }) =>
    plans?.length > 0 ? loadPlanOrderDetail(sdk, plans[0]) : {},
);

/** Reads the plan without touching state, so an open edit keeps its baseline. */
const fetchLatestOrderDetail = createAsyncThunk(
  'app/Order/FETCH_LATEST_ORDER_DETAIL',
  async (planId: string, { extra: sdk }) => loadPlanOrderDetail(sdk, planId),
);

const fetchUserDisplayNames = createAsyncThunk(
  'app/Order/FETCH_USER_DISPLAY_NAMES',
  async (userIds: string[], { extra: sdk }) =>
    Object.fromEntries(
      await Promise.all(
        userIds.map(async (id) => {
          const [user] = denormalisedResponseEntities(
            await sdk.users.show({ id }),
          );

          return [id, User(user).getProfile().displayName as string];
        }),
      ),
    ) as Record<string, string>,
);

const fetchRestaurantCoverImages = createAsyncThunk(
  FETCH_RESTAURANT_COVER_IMAGE,
  async ({ isEditFlow = false }: any, { getState }) => {
    const { orderDetail = {} } = getState().Order;
    const { orderDetail: draftOrderDetail = {} } =
      getState().Order.draftEditOrderData;

    const suitableOrderDetail = isEditFlow ? draftOrderDetail : orderDetail;

    const restaurantIdList = compact(
      uniq(
        Object.values(suitableOrderDetail).map(
          (item: any) => item?.restaurant?.id,
        ),
      ),
    );

    const { data: restaurantResponses } = await queryRestaurantListingsApi({
      dataParams: {
        ids: restaurantIdList,
        include: ['images'],
        'fields.image': [
          'variants.landscape-crop',
          'variants.landscape-crop2x',
        ],
      },
    });

    const restaurants = denormalisedResponseEntities(restaurantResponses);

    const restaurantCoverImageList = restaurants.map((restaurant: TListing) => {
      const { coverImageId } = Listing(restaurant).getPublicData();

      return {
        [restaurant.id.uuid]: Listing(restaurant)
          .getFullData()
          .images.find((image: any) => image.id.uuid === coverImageId),
      };
    });

    return {
      restaurantCoverImageList: restaurantCoverImageList.reduce(
        (result: TObject, item: TObject) => ({
          ...result,
          ...item,
        }),
        {},
      ),
      restaurantListings: restaurants,
    };
  },
);

const fetchOrder = createAsyncThunk(
  FETCH_ORDER,
  async (orderId: string, { extra: sdk, dispatch }) => {
    const response = denormalisedResponseEntities(
      await sdk.listings.show({
        id: orderId,
      }),
    )[0];

    const { bookerId, companyId } = Listing(response).getMetadata();

    const { data: selectedBooker } = await fetchUserApi(bookerId);
    const { data: selectedCompany } = await fetchUserApi(companyId);

    dispatch(SystemAttributesThunks.fetchVATPercentageByOrderId(orderId));

    return {
      order: response,
      selectedBooker,
      selectedCompany,
    };
  },
);

const fetchPlanDetail = createAsyncThunk(
  FETCH_PLAN_DETAIL,
  async ({ planId }: { planId: string }, { extra: sdk }) => {
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
  async ({ orderId, planId, orderDetail, updateMode }: any, { dispatch }) => {
    const { data: planListing } = await updatePlanDetailsApi(orderId, {
      orderDetail,
      planId,
      updateMode,
    });

    dispatch(BookerSelectRestaurantActions.setPlanDetail(planListing));

    return planListing;
  },
);

const bookerDeleteDraftOrder = createAsyncThunk(
  'app/Order/DELETE_DRAFT_ORDER',
  async ({ orderId, companyId }: TObject, { getState, dispatch }) => {
    const { queryParams } = getState().Order;

    await bookerDeleteDraftOrderApi({ orderId, companyId });
    await dispatch(queryCompanyOrders(queryParams));
  },
  {
    serializeError: storableError,
  },
);

const cancelPendingApprovalOrder = createAsyncThunk(
  'app/Order/CANCEL_PENDING_APPROVAL_ORDER',
  async ({ orderId }: TObject, { getState, dispatch }) => {
    const { queryParams } = getState().Order;

    const { data: responseData } = await bookerCancelPendingApprovalOrderApi(
      orderId,
    );

    await dispatch(queryCompanyOrders(queryParams));

    return responseData.data;
  },
);

const publishOrder = createAsyncThunk(
  'app/Order/PUBLISH_ORDER',
  async ({ orderId }: TObject) => {
    await publishOrderApi(orderId as string);
  },
  {
    serializeError: storableError,
  },
);

const checkRestaurantStillAvailable = createAsyncThunk(
  CHECK_RESTAURANT_STILL_AVAILABLE,
  async ({ isEditFlow = false }: TObject, { getState, extra: sdk }) => {
    const { order, orderDetail } = getState().Order;
    const { orderDetail: draftOrderDetail = {} } =
      getState().Order.draftEditOrderData;

    const suitableOrderDetail = isEditFlow ? draftOrderDetail : orderDetail;

    const availableOrderDetailCheckList = await Promise.all(
      Object.keys(suitableOrderDetail).map(async (timestamp) => {
        const { restaurant } = suitableOrderDetail[timestamp] || {};
        const { menuId, id: restaurantId } = restaurant || {};

        if (isEmpty(restaurantId)) {
          return {
            [timestamp]: {
              isAvailable: true,
              status: EInvalidRestaurantCase.noMenusValid,
            },
          };
        }

        const [restaurantListing] = denormalisedResponseEntities(
          (await sdk.listings.show({ id: restaurantId })) || [{}],
        );

        const { status = ERestaurantListingStatus.authorized } =
          Listing(restaurantListing).getMetadata();
        const {
          stopReceiveOrder = false,
          startStopReceiveOrderDate = 0,
          endStopReceiveOrderDate = 0,
        } = Listing(restaurantListing).getPublicData();
        const isInStopReceiveOrderTime =
          stopReceiveOrder &&
          Number(timestamp) >= startStopReceiveOrderDate &&
          Number(timestamp) <= endStopReceiveOrderDate;
        if (isInStopReceiveOrderTime) {
          return {
            [timestamp]: {
              isAvailable: false,
              status: EInvalidRestaurantCase.stopReceiveOrder,
            },
          };
        }
        if (status !== ERestaurantListingStatus.authorized) {
          return {
            [timestamp]: {
              isAvailable: false,
              status: EInvalidRestaurantCase.closed,
            },
          };
        }
        const menuQuery = getMenuQueryInSpecificDay({
          order,
          timestamp: +timestamp,
          options: {
            ignoreSearchByPackagePermember: true,
          },
        });
        const allMenus = await queryAllPages({
          sdkModel: sdk.listings,
          query: menuQuery,
        });

        const isAnyMenusValid =
          allMenus.findIndex((menu: TListing) => menu.id.uuid === menuId) !==
          -1;

        return {
          [timestamp]: {
            isAvailable: isAnyMenusValid,
            ...(isAnyMenusValid
              ? {}
              : { status: EInvalidRestaurantCase.noMenusValid }),
          },
        };
      }),
    );

    return availableOrderDetailCheckList.reduce(
      (result, item) => ({
        ...result,
        ...item,
      }),
      {},
    );
  },
);

const fetchOrderRestaurants = createAsyncThunk(
  FETCH_ORDER_RESTAURANTS,
  async ({ isEditFlow = false }: any, { extra: sdk, getState }) => {
    const { orderDetail = {} } = getState().Order;
    const { orderDetail: draftOrderDetail = {} } =
      getState().Order.draftEditOrderData;

    const suitableOrderDetail = isEditFlow ? draftOrderDetail : orderDetail;

    const restaurantIdList = uniq(
      compact(
        Object.values(suitableOrderDetail).map(
          (item: any) => item?.restaurant?.id,
        ),
      ),
    );

    const restaurantList = await Promise.all(
      restaurantIdList.map(async (restaurantId) => {
        const restaurantResponse = denormalisedResponseEntities(
          await sdk.listings.show({
            id: restaurantId,
          }),
        )[0];

        return restaurantResponse;
      }),
    );

    return restaurantList;
  },
);

const fetchMenuListingsByIds = createAsyncThunk(
  FETCH_MENU_BY_IDS,
  async (
    {
      menuListingIds,
    }: {
      menuListingIds: string[];
    },
    { extra: sdk },
  ) => {
    const menuListings = denormalisedResponseEntities(
      await sdk.listings.query({
        ids: menuListingIds,
      }),
    );

    return menuListings;
  },
);

const getCompanyOrderNotification = createAsyncThunk(
  GET_COMPANY_ORDER_NOTIFICATIONS,
  async (companyId: string) => {
    const { data } = await getCompanyNotificationsApi(companyId);

    return data;
  },
  {
    serializeError: storableAxiosError,
  },
);

const getCompanyOrderSummary = createAsyncThunk(
  GET_COMPANY_ORDER_SUMMARY,
  async (companyId: string) => {
    const { data } = await getCompanyOrderSummaryApi(companyId);

    return data;
  },
  {
    serializeError: storableAxiosError,
  },
);

const bookerReorder = createAsyncThunk(
  BOOKER_REORDER,
  async (orderId: string) => {
    const { data } = await reorderApi(orderId, {});

    return data;
  },
  {
    serializeError: storableAxiosError,
  },
);

const updateOrderStateToDraft = createAsyncThunk(
  UPDATE_ORDER_STATE_TO_DRAFT,
  async (orderId: string) => {
    await updateOrderStateToDraftApi(orderId);
  },
  {
    serializeError: storableAxiosError,
  },
);

const bookerDeleteOrder = createAsyncThunk(
  BOOKER_DELETE_ORDER,
  async ({ orderId, companyId }: TObject, { getState }) => {
    const { orders } = getState().Order;
    await bookerDeleteDraftOrderApi({
      orderId,
      companyId,
    });

    const newOrders = orders.filter((order) => order.id.uuid !== orderId);

    return newOrders;
  },
  {
    serializeError: storableAxiosError,
  },
);

const handleSendEditInProgressOrderNotificationToParticipant = createAsyncThunk(
  HANDLE_SEND_EDIT_INPROGRESS_ORDER_NOTIFICATION_TO_PARTICIPANT,
  async ({ orderId, planId }: TObject) => {
    const { data: responseData } =
      await handleSendNotificationParticipantAfterEditInProgressOrderApi(
        orderId,
        {
          planId,
        },
      );

    return responseData.data;
  },
  {
    serializeError: storableAxiosError,
  },
);

const notifyUserPickingOrderChanges = createAsyncThunk(
  'app/Order/NOTIFY_USER_PICKING_ORDER_CHANGES',
  async (
    { orderId, params }: TObject,
    { fulfillWithValue, rejectWithValue },
  ) => {
    try {
      await adminNotifyUserPickingOrderChangesApi(orderId, params);

      return fulfillWithValue(null);
    } catch (error) {
      return rejectWithValue(error);
    }
  },
);

const handleSendEditInProgressOrderNotificationToPartner = createAsyncThunk(
  HANDLE_SEND_EDIT_INPROGRESS_ORDER_NOTIFICATION_TO_PARTNER,
  async ({ orderId, planId }: TObject) => {
    const { data: responseData } =
      await handleSendNotificationPartnerAfterEditInProgressOrderApi(orderId, {
        planId,
      });

    return responseData.data;
  },
  {
    serializeError: storableAxiosError,
  },
);

const handleSendEditInProgressOrderDetailNotificationToPartner =
  createAsyncThunk(
    HANDLE_SEND_EDIT_INPROGRESS_ORDER_DETAIL_NOTIFICATION_TO_PARTNER,
    async ({ orderId, orderDetail }: TObject) => {
      const { data: responseData } =
        await handleSendNotificationPartnerAfterEditInProgressOrderDetailApi(
          orderId,
          orderDetail,
        );

      return responseData.data;
    },
    {
      serializeError: storableAxiosError,
    },
  );

const handleDeleteOldDataAfterEditInProgressOrder = createAsyncThunk(
  HANDLE_DELETE_OLD_DATA_AFTER_EDIT_IN_PROGRESS_ORDER,
  async ({ orderId, planId }: TObject) => {
    const { data: responseData } =
      await handleDeleteOldDataAfterEditInProgressOrderApi(orderId, {
        planId,
      });

    return responseData.data;
  },
  {
    serializeError: storableAxiosError,
  },
);

const sendOrderChangeFirebaseNotificationToBooker = createAsyncThunk(
  SEND_ORDER_CHANGE_FIREBASE_NOTIFICATION_TO_BOOKER,
  async (orderId: string) => {
    await sendOrderChangeFirebaseNotificationToBokerApi(orderId);
  },
  {
    serializeError: storableAxiosError,
  },
);

const sendOrderChangeFirebaseNotificationToPartner = createAsyncThunk(
  SEND_ORDER_CHANGE_FIREBASE_NOTIFICATION_TO_PARTNER,
  async ({ orderId, params }: TObject) => {
    await sendOrderChangeFirebaseNotificationToPartnerApi(orderId, params);
  },
  {
    serializeError: storableAxiosError,
  },
);

export const orderAsyncActions = {
  createOrder,
  updateOrder,
  bookerDeleteDraftOrder,
  fetchCompanyBookers,
  fetchOrder,
  fetchOrderDetail,
  fetchLatestOrderDetail,
  fetchUserDisplayNames,
  queryOrders,
  queryCompanyOrders,
  fetchPlanDetail,
  updatePlanDetail,
  publishOrder,
  cancelPendingApprovalOrder,
  fetchRestaurantCoverImages,
  recommendRestaurants,
  recommendRestaurantForSpecificDay,
  checkRestaurantStillAvailable,
  fetchOrderRestaurants,
  getCompanyOrderNotification,
  getCompanyOrderSummary,
  queryAllOrders,
  bookerReorder,
  updateOrderStateToDraft,
  bookerDeleteOrder,
  queryCompanyPlansByOrderIds,
  handleSendEditInProgressOrderNotificationToParticipant,
  notifyUserPickingOrderChanges,
  handleSendEditInProgressOrderNotificationToPartner,
  handleDeleteOldDataAfterEditInProgressOrder,
  fetchMenuListingsByIds,
  handleSendEditInProgressOrderDetailNotificationToPartner,
  sendOrderChangeFirebaseNotificationToBooker,
  sendOrderChangeFirebaseNotificationToPartner,
};

const orderSlice = createSlice({
  name: 'Order',
  initialState,
  reducers: {
    addCompanyClient: (state, { payload }) => {
      return {
        ...state,
        draftOrder: {
          ...state.draftOrder,
          clientId: payload.id,
        },
        selectedCompany: payload.company,
      };
    },
    addBooker: (state, { payload }) => ({
      ...state,
      selectedBooker: payload,
    }),
    updateDraftMealPlan: (state, { payload }) => {
      const { orderDetail = {} } = payload;
      const {
        dateTimestamp,
        restaurantId,
        restaurantName,
        foodList,
        phoneNumber,
      } = orderDetail;
      const { orderDetail: oldOrderDetail = {} } = state;
      const existedOrderDetailDate = Object.keys(oldOrderDetail).includes(
        dateTimestamp.toString(),
      );

      const updatedOrderDetailData = existedOrderDetailDate
        ? {
            ...oldOrderDetail,
            [dateTimestamp]: {
              ...oldOrderDetail[dateTimestamp],
              restaurant: {
                ...oldOrderDetail[dateTimestamp].restaurant,
                id: restaurantId,
                restaurantName,
                foodList,
                phoneNumber,
              },
            },
          }
        : {
            ...oldOrderDetail,
            [dateTimestamp]: {
              restaurant: {
                id: restaurantId,
                foodList,
                restaurantName,
              },
            },
          };

      return {
        ...state,
        orderDetail: updatedOrderDetailData,
      };
    },
    removeMealDay: (state, { payload }) => ({
      ...state,
      justDeletedMemberOrder: true,
      orderDetail: payload,
    }),
    selectCalendarDate: (state, { payload }) => ({
      ...state,
      selectedCalendarDate: payload,
    }),
    selectRestaurant: (state) => ({
      ...state,
      isSelectingRestaurant: true,
    }),
    unSelectRestaurant: (state) => ({
      ...state,
      isSelectingRestaurant: false,
    }),
    removeDraftOrder: (state) => ({
      ...state,
      draftOrder: {},
    }),
    removeBookerList: (state) => ({
      ...state,
      bookerList: [],
    }),
    resetStates: () => ({
      ...initialState,
    }),
    resetOrder: (state) => {
      state.order = null;
    },
    setOrderDetail: (state, { payload }) => {
      state.orderDetail = payload;
    },
    changeStep2SubmitStatus: (state, { payload }) => ({
      ...state,
      step2SubmitInProgress: payload,
    }),
    resetCompanyOrdersStates: (state) => ({
      ...state,
      queryParams: {},
      orders: [],
      queryOrderInProgress: false,
      queryOrderError: null,
      deleteDraftOrderInProgress: false,
      deleteDraftOrderError: null,
      manageOrdersPagination: {
        totalItems: 0,
        totalPages: 1,
        page: 1,
        perPage: 10,
      },
    }),
    changeStep4SubmitStatus: (state, { payload }) => ({
      ...state,
      step4SubmitInProgress: payload,
    }),
    addCurrentSelectedMenuId: (state, { payload }) => ({
      ...state,
      currentSelectedMenuId: payload,
    }),
    setCanNotGoAfterOderDetail: (state, { payload }) => ({
      ...state,
      canNotGoAfterOderDetail: payload,
    }),
    setCanNotGoAfterFoodQuantity: (state, { payload }) => ({
      ...state,
      canNotGoAfterFoodQuantity: payload,
    }),
    setOnRecommendRestaurantInProcess: (state, { payload }) => {
      state.onRecommendRestaurantInProgress = payload;
    },
    saveDraftEditOrder: (state, { payload }) => {
      const { generalInfo, orderDetail, mode = 'replace' } = payload || {};

      state.draftEditOrderData = {
        ...state.draftEditOrderData,
        generalInfo: {
          ...state.draftEditOrderData.generalInfo,
          ...generalInfo,
        },
        ...(!isEmpty(orderDetail)
          ? mode === 'merge'
            ? {
                orderDetail: {
                  ...state.draftEditOrderData.orderDetail,
                  ...orderDetail,
                },
              }
            : { orderDetail }
          : {}),
      };
    },
    clearDraftEditOrder: (state) => {
      state.draftEditOrderData = {
        ...state.draftEditOrderData,
        generalInfo: {},
      };
    },
    setQueryMoreOrderInProgress: (state, { payload }) => {
      state.queryMoreOrderInProgress = payload;
    },
    setNonAccountEmails: (state, { payload }) => {
      state.order!!.attributes.metadata.nonAccountEmails = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrder.pending, (state) => ({
        ...state,
        justDeletedMemberOrder: false,
        createOrderInProcess: true,
        createOrderError: null,
      }))
      .addCase(createOrder.fulfilled, (state, { payload }) => ({
        ...state,
        createOrderInProcess: false,
        order: payload,
      }))
      .addCase(createOrder.rejected, (state, { error }) => ({
        ...state,
        createOrderError: error.message,
        createOrderInProcess: false,
      }))

      .addCase(updateOrder.pending, (state) => ({
        ...state,
        updateOrderInProgress: true,
        updateOrderError: null,
      }))
      .addCase(updateOrder.fulfilled, (state, { payload }) => ({
        ...state,
        updateOrderInProgress: false,
        order: payload.orderListing,
      }))
      .addCase(updateOrder.rejected, (state, { error }) => ({
        ...state,
        updateOrderInProgress: false,
        updateOrderError: error.message,
      }))
      .addCase(queryOrders.pending, (state) => ({
        ...state,
        queryOrderInProgress: true,
        queryOrderError: null,
      }))
      .addCase(
        queryOrders.fulfilled,
        (state, { payload: { orders, pagination } }) => ({
          ...state,
          queryOrderInProgress: false,
          orders,
          manageOrdersPagination: pagination,
        }),
      )
      .addCase(queryOrders.rejected, (state, { payload }) => ({
        ...state,
        queryOrderInProgress: false,
        queryOrderError: payload,
      }))

      .addCase(fetchCompanyBookers.pending, (state) => ({
        ...state,
        fetchBookersInProgress: true,
        fetchBookersError: null,
      }))
      .addCase(fetchCompanyBookers.fulfilled, (state, { payload }) => ({
        ...state,
        fetchBookersInProgress: false,
        bookerList: payload,
      }))
      .addCase(fetchCompanyBookers.rejected, (state, { error }) => ({
        ...state,
        fetchBookersInProgress: false,
        fetchBookersError: error.message,
      }))

      .addCase(fetchOrder.pending, (state) => ({
        ...state,
        justDeletedMemberOrder: false,
        fetchOrderInProgress: true,
        fetchOrderError: null,
      }))
      .addCase(fetchOrder.fulfilled, (state, { payload }) => ({
        ...state,
        fetchOrderInProgress: false,
        order: payload.order,
        selectedBooker: payload.selectedBooker,
        selectedCompany: payload.selectedCompany,
        currentOrderVATPercentage: config.VATPercentage,
      }))
      .addCase(fetchOrder.rejected, (state, { error }) => ({
        ...state,
        fetchOrderInProgress: false,
        fetchOrderError: error.message,
      }))

      .addCase(fetchOrderDetail.pending, (state) => ({
        ...state,
        fetchOrderDetailInProgress: true,
        fetchOrderDetailError: null,
      }))
      .addCase(fetchOrderDetail.fulfilled, (state, { payload }) => ({
        ...state,
        fetchOrderDetailInProgress: false,
        orderDetail: payload,
      }))
      .addCase(fetchOrderDetail.rejected, (state, { error }) => ({
        ...state,
        fetchOrderDetailInProgress: false,
        fetchOrderDetailError: error.message,
      }))
      /* =============== queryCompanyOrders =============== */
      .addCase(queryCompanyOrders.pending, (state) => {
        state.queryOrderInProgress = true;
        state.queryOrderError = null;
      })
      .addCase(
        queryCompanyOrders.fulfilled,
        (state, { payload: { orders, pagination, queryParams } }) => ({
          ...state,
          queryParams,
          queryOrderInProgress: false,
          queryMoreOrderInProgress: false,
          orders,
          manageOrdersPagination: pagination,
        }),
      )
      .addCase(queryCompanyOrders.rejected, (state, { payload }) => {
        state.queryOrderInProgress = false;
        state.queryMoreOrderInProgress = false;
        state.queryOrderError = payload;
      })
      /* =============== bookerDeleteDraftOrder =============== */
      .addCase(bookerDeleteDraftOrder.pending, (state) => {
        state.deleteDraftOrderInProgress = true;
        state.queryOrderError = null;
      })
      .addCase(bookerDeleteDraftOrder.fulfilled, (state) => {
        state.deleteDraftOrderInProgress = false;
      })
      .addCase(bookerDeleteDraftOrder.rejected, (state, { payload }) => {
        state.deleteDraftOrderInProgress = false;
        state.queryOrderError = payload;
      })
      .addCase(updatePlanDetail.pending, (state) => ({
        ...state,
        justDeletedMemberOrder: false,
        updateOrderDetailInProgress: true,
        updateOrderDetailError: null,
      }))
      .addCase(updatePlanDetail.fulfilled, (state, { payload }) => ({
        ...state,
        updateOrderDetailInProgress: false,
        orderDetail: Listing(payload).getMetadata().orderDetail || {},
      }))
      .addCase(updatePlanDetail.rejected, (state, { error }) => ({
        ...state,
        updateOrderDetailInProgress: false,
        updateOrderDetailError: error.message,
      }))
      /* =============== cancelNeedApprovalOrder =============== */
      .addCase(cancelPendingApprovalOrder.pending, (state) => ({
        ...state,
        updateOrderInProgress: true,
        updateOrderError: null,
      }))
      .addCase(cancelPendingApprovalOrder.fulfilled, (state, { payload }) => ({
        ...state,
        updateOrderInProgress: false,
        order: payload,
      }))
      .addCase(cancelPendingApprovalOrder.rejected, (state, { error }) => ({
        ...state,
        updateOrderInProgress: false,
        updateOrderError: error.message,
      }))
      /* =============== publishOrder =============== */
      .addCase(publishOrder.pending, (state) => {
        state.publishOrderError = null;
        state.publishOrderInProgress = true;
      })
      .addCase(publishOrder.fulfilled, (state) => {
        state.publishOrderInProgress = false;
      })
      .addCase(publishOrder.rejected, (state, { payload }) => {
        state.publishOrderInProgress = false;
        state.publishOrderError = payload;
      })

      .addCase(fetchRestaurantCoverImages.pending, (state) => ({
        ...state,
        fetchRestaurantCoverImageInProgress: true,
        fetchRestaurantCoverImageError: null,
      }))
      .addCase(fetchRestaurantCoverImages.fulfilled, (state, { payload }) => ({
        ...state,
        fetchRestaurantCoverImageInProgress: false,
        restaurantCoverImageList: payload.restaurantCoverImageList,
        restaurantListings: payload.restaurantListings,
      }))
      .addCase(fetchRestaurantCoverImages.rejected, (state, { error }) => ({
        ...state,
        fetchRestaurantCoverImageInProgress: false,
        fetchRestaurantCoverImageError: error.message,
      }))

      .addCase(recommendRestaurants.pending, (state) => ({
        ...state,
        recommendRestaurantInProgress: true,
        recommendRestaurantError: null,
      }))
      .addCase(recommendRestaurants.fulfilled, (state, { payload }) => {
        state.isAllDatesHaveNoRestaurants = Object.values(payload).every(
          ({ hasNoRestaurants = false }: any) => hasNoRestaurants,
        );
        state.recommendRestaurantInProgress = false;
      })
      .addCase(recommendRestaurants.rejected, (state, { error }) => ({
        ...state,
        recommendRestaurantInProgress: false,
        recommendRestaurantError: error.message,
      }))

      .addCase(recommendRestaurantForSpecificDay.pending, (state) => ({
        ...state,
        onRescommendRestaurantForSpecificDateInProgress: true,
        onRescommendRestaurantForSpecificDateError: null,
      }))
      .addCase(
        recommendRestaurantForSpecificDay.fulfilled,
        (state, { payload }) => {
          const { shouldUpdatePlanOrderOrderDetail, orderDetail } = payload;
          state.onRescommendRestaurantForSpecificDateInProgress = false;

          if (shouldUpdatePlanOrderOrderDetail) {
            state.orderDetail = orderDetail;
          } else {
            state.draftEditOrderData = {
              ...state.draftEditOrderData,
              orderDetail,
            };
          }
        },
      )
      .addCase(
        recommendRestaurantForSpecificDay.rejected,
        (state, { error }) => ({
          ...state,
          onRescommendRestaurantForSpecificDateInProgress: false,
          onRescommendRestaurantForSpecificDateError: error.message,
        }),
      )

      .addCase(checkRestaurantStillAvailable.pending, () => {})
      .addCase(
        checkRestaurantStillAvailable.fulfilled,
        (state, { payload }) => ({
          ...state,
          availableOrderDetailCheckList: payload,
        }),
      )
      .addCase(checkRestaurantStillAvailable.rejected, (state, { payload }) => {
        state.fetchOrderDetailError = payload;
      })

      .addCase(fetchOrderRestaurants.pending, (state) => ({
        ...state,
        fetchOrderRestaurantListInProgress: true,
        fetchOrderRestaurantListError: null,
      }))
      .addCase(fetchOrderRestaurants.fulfilled, (state, { payload }) => ({
        ...state,
        fetchOrderRestaurantListInProgress: false,
        orderRestaurantList: payload,
      }))
      .addCase(fetchOrderRestaurants.rejected, (state, { error }) => ({
        ...state,
        fetchOrderRestaurantListInProgress: false,
        fetchOrderRestaurantListError: error.message,
      }))
      .addCase(fetchMenuListingsByIds.pending, (state) => ({
        ...state,
        fetchMenuListingsInProgress: true,
        fetchMenuListingsError: null,
      }))
      .addCase(fetchMenuListingsByIds.fulfilled, (state, { payload }) => ({
        ...state,
        fetchMenuListingsInProgress: false,
        menuListings: payload,
      }))
      .addCase(fetchMenuListingsByIds.rejected, (state, { error }) => ({
        ...state,
        fetchMenuListingsInProgress: false,
        fetchMenuListingsError: error.message,
      }))
      .addCase(getCompanyOrderNotification.pending, (state) => ({
        ...state,
        getCompanyOrderNotificationInProgress: true,
        getCompanyOrderNotificationError: null,
      }))
      .addCase(getCompanyOrderNotification.fulfilled, (state, { payload }) => ({
        ...state,
        getCompanyOrderNotificationInProgress: false,
        companyOrderNotificationMap: payload,
      }))
      .addCase(getCompanyOrderNotification.rejected, (state, { error }) => ({
        ...state,
        getOrderNotificationError: error,
        getCompanyOrderNotificationInProgress: false,
      }))
      .addCase(getCompanyOrderSummary.pending, (state) => ({
        ...state,
        getCompanyOrderSummaryInProgress: true,
        getCompanyOrderSummaryError: null,
      }))
      .addCase(getCompanyOrderSummary.fulfilled, (state, { payload }) => ({
        ...state,
        getCompanyOrderSummaryInProgress: false,
        companyOrderSummary: payload,
      }))
      .addCase(getCompanyOrderSummary.rejected, (state, { error }) => ({
        ...state,
        getCompanyOrderSummaryError: error,
        getCompanyOrderSummaryInProgress: false,
      }))

      .addCase(queryAllOrders.pending, (state) => ({
        ...state,
        queryAllOrdersInProgress: true,
        queryAllOrdersError: null,
      }))
      .addCase(queryAllOrders.fulfilled, (state, { payload }) => ({
        ...state,
        queryAllOrdersInProgress: false,
        allOrders: payload,
      }))
      .addCase(queryAllOrders.rejected, (state, { error }) => ({
        ...state,
        queryAllOrdersInProgress: false,
        queryAllOrdersError: error.message,
      }))
      .addCase(bookerReorder.pending, (state, { meta: { arg: orderId } }) => ({
        ...state,
        reorderInProgressId: orderId,
        reorderError: null,
      }))
      .addCase(bookerReorder.fulfilled, (state) => ({
        ...state,
        reorderInProgressId: null,
      }))
      .addCase(bookerReorder.rejected, (state, { error }) => ({
        ...state,
        reorderInProgressId: null,
        reorderError: error,
      }))

      .addCase(updateOrderStateToDraft.pending, (state) => ({
        ...state,
        updateOrderStateToDraftInProgress: true,
        updateOrderStateToDraftError: null,
      }))
      .addCase(updateOrderStateToDraft.fulfilled, (state) => ({
        ...state,
        updateOrderStateToDraftInProgress: false,
      }))
      .addCase(updateOrderStateToDraft.rejected, (state, { error }) => ({
        ...state,
        updateOrderStateToDraftInProgress: false,
        updateOrderStateToDraftError: error.message,
      }))

      .addCase(bookerDeleteOrder.pending, (state) => {
        state.bookerDeleteOrderInProgress = true;
        state.bookerDeleteOrderError = null;
      })
      .addCase(bookerDeleteOrder.fulfilled, (state, { payload }) => {
        state.bookerDeleteOrderInProgress = false;
        state.orders = payload;
      })
      .addCase(bookerDeleteOrder.rejected, (state, { error }) => {
        state.bookerDeleteOrderInProgress = false;
        state.bookerDeleteOrderError = error.message;
      })
      .addCase(queryCompanyPlansByOrderIds.pending, (state, { meta }) => {
        state.currentQueryPlansByOrderIdsRequestId = meta.requestId;
        state.plansByOrderIds = [];
        state.queryCompanyPlansByOrderIdsInProgress = true;
        state.queryCompanyPlansByOrderIdsError = null;
      })
      .addCase(
        queryCompanyPlansByOrderIds.fulfilled,
        (state, { payload: fetchedPlans, meta }) => {
          if (meta.requestId !== state.currentQueryPlansByOrderIdsRequestId) {
            return;
          }

          state.queryCompanyPlansByOrderIdsInProgress = false;
          state.plansByOrderIds = fetchedPlans;
        },
      )
      .addCase(queryCompanyPlansByOrderIds.rejected, (state, { error }) => {
        state.queryCompanyPlansByOrderIdsInProgress = false;
        state.queryCompanyPlansByOrderIdsError = error;
      })
      .addCase(queryTotalOrderCountByTab.pending, (state) => {
        state.queryTotalOrdersCountByTabInProgress = true;
        state.queryTotalOrdersCountByTabError = null;
      })
      .addCase(queryTotalOrderCountByTab.fulfilled, (state, { payload }) => {
        state.queryTotalOrdersCountByTabInProgress = false;
        state.totalItemMap = payload;
      })
      .addCase(queryTotalOrderCountByTab.rejected, (state, { error }) => {
        state.queryTotalOrdersCountByTabInProgress = false;
        state.queryTotalOrdersCountByTabError = error;
      });
  },
});

export const {
  setOrderDetail,
  addCompanyClient,
  updateDraftMealPlan,
  removeDraftOrder,
  removeBookerList,
  addBooker,
  removeMealDay,
  selectCalendarDate,
  selectRestaurant,
  unSelectRestaurant,
  resetStates,
  resetOrder,
  changeStep2SubmitStatus,
  resetCompanyOrdersStates,
  changeStep4SubmitStatus,
  addCurrentSelectedMenuId,
  setCanNotGoAfterOderDetail,
  setCanNotGoAfterFoodQuantity,
  setOnRecommendRestaurantInProcess,
  saveDraftEditOrder,
  clearDraftEditOrder,
  setQueryMoreOrderInProgress,
  setNonAccountEmails,
} = orderSlice.actions;

export default orderSlice.reducer;
