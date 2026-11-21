/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import classNames from 'classnames';
import { has, omit, pickBy } from 'lodash';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import { DateTime } from 'luxon';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import CalendarDashboard from '@components/CalendarDashboard/CalendarDashboard';
import AddMorePlan from '@components/CalendarDashboard/components/MealPlanCard/components/AddMorePlan';
import MealPlanCard from '@components/CalendarDashboard/components/MealPlanCard/MealPlanCard';
import IconDangerWithCircle from '@components/Icons/IconDangerWithCircle/IconDangerWithCircle';
import IconRefreshing from '@components/Icons/IconRefreshing/IconRefreshing';
import IconSetting from '@components/Icons/IconSetting/IconSetting';
import AlertModal from '@components/Modal/AlertModal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import { calculateGroupMembersAmount } from '@helpers/company';
import { parseDateFromTimestampAndHourString } from '@helpers/dateHelpers';
import { addCommas } from '@helpers/format';
import { getItem } from '@helpers/localStorageHelpers';
import { findSuitableAnchorDate } from '@helpers/order/prepareDataHelper';
import {
  adjustFoodListPrice,
  buildLineItem,
  getIsAllowAddSecondaryFood,
  getRestaurantListFromOrderDetail,
  getSelectedRestaurantAndFoodList,
  getUpdateLineItems,
  mergeRecommendOrderDetailWithCurrentOrderDetail,
} from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { normalizePlanDetailsToEvent } from '@pages/company/booker/orders/draft/[orderId]/helpers/normalizeData';
import { BookerSelectRestaurantThunks } from '@pages/company/booker/orders/draft/[orderId]/restaurants/BookerSelectRestaurant.slice';
import { useGetCalendarExtraResources } from '@pages/company/booker/orders/draft/[orderId]/restaurants/hooks/calendar';
import {
  addCurrentSelectedMenuId,
  orderAsyncActions,
  saveDraftEditOrder,
  selectCalendarDate,
  selectRestaurant,
  setCanNotGoAfterOderDetail,
  setOnRecommendRestaurantInProcess,
  unSelectRestaurant,
} from '@redux/slices/Order.slice';
import { selectRestaurantPageThunks } from '@redux/slices/SelectRestaurantPage.slice';
import type { TFoodInRestaurant } from '@src/types/bookerSelectRestaurant';
import { convertWeekDay, renderDateRange } from '@src/utils/dates';
import { EOrderStates, EOrderType } from '@src/utils/enums';
import { Listing, User } from '@utils/data';
import type { TListing, TObject } from '@utils/types';

// eslint-disable-next-line import/no-cycle
import NavigateButtons, {
  EFlowType,
} from '../../components/NavigateButtons/NavigateButtons';
import OrderSettingModal, {
  OrderSettingField,
} from '../../components/OrderSettingModal/OrderSettingModal';
import type { TSelectFoodFormValues } from '../../components/SelectFoodModal/components/SelectFoodForm/SelectFoodForm';
import SelectFoodModal from '../../components/SelectFoodModal/SelectFoodModal';
import SelectRestaurantPage from '../../components/SelectRestaurantPage/SelectRestaurant.page';

import ChangeSelectedFoodConfirmModal from './ChangeSelectedFoodConfirmModal/ChangeSelectedFoodConfirmModal';

import css from './SetupOrderDetail.module.scss';

type TSetupOrderDetailProps = {
  goBack: () => void;
  nextTab: () => void;
  nextToReviewTab?: () => void;
  flowType?: EFlowType;
};

const SetupOrderDetail: React.FC<TSetupOrderDetailProps> = ({
  goBack,
  nextTab,
  nextToReviewTab,
  flowType = EFlowType.createOrEditDraft,
}) => {
  const dispatch = useAppDispatch();
  const intl = useIntl();
  const {
    value: isOrderSettingModalOpen,
    setFalse: onOrderSettingModalClose,
    setTrue: onOrderSettingModalOpen,
  } = useBoolean();
  const {
    value: isPickFoodModalOpen,
    setTrue: openPickFoodModal,
    setFalse: closePickFoodModal,
  } = useBoolean();
  const changeSelectedFoodConfirmModal = useBoolean();
  const confirmChangeOrderDetailControl = useBoolean();
  const shouldNextTabControl = useBoolean();
  const [onNextClick, setOnNextClick] = useState<() => void>(() => () => {});
  const changedRestaurantController = useBoolean();

  const [isApplyingOtherDays, setIsApplyingOtherDays] = useState(false);

  const draftEditOrderDetail = useAppSelector(
    (state) => state.Order.draftEditOrderData.orderDetail,
  );
  const draftEditOrderData = useAppSelector(
    (state) => state.Order.draftEditOrderData.generalInfo,
  );
  const updateOrderInProgress = useAppSelector(
    (state) => state.Order.updateOrderInProgress,
  );
  const updateOrderDetailInProgress = useAppSelector(
    (state) => state.Order.updateOrderDetailInProgress,
  );
  const orderDetail = useAppSelector(
    (state) => state.Order.orderDetail,
    shallowEqual,
  );
  const justDeletedMemberOrder = useAppSelector(
    (state) => state.Order.justDeletedMemberOrder,
  );
  const order = useAppSelector((state) => state.Order.order, shallowEqual);
  const selectedCompany = useAppSelector(
    (state) => state.Order.selectedCompany,
    shallowEqual,
  );

  const companyGeoOrigin =
    User(selectedCompany).getPublicData().companyLocation?.origin || {};

  const selectedDate = useAppSelector(
    (state) => state.Order.selectedCalendarDate,
  );
  const isSelectingRestaurant = useAppSelector(
    (state) => state.Order.isSelectingRestaurant,
  );
  const fetchFoodInProgress = useAppSelector(
    (state) => state.SelectRestaurantPage.fetchFoodPending,
  );
  const currentRestaurant = useAppSelector(
    (state) => state.SelectRestaurantPage.selectedRestaurant,
  );
  const foodExtraFees = useAppSelector(
    (state) => state.SelectRestaurantPage.foodExtraFees,
    shallowEqual,
  );
  const foodList = useAppSelector(
    (state) => state.SelectRestaurantPage.foodList,
    shallowEqual,
  );
  const restaurantCoverImageList = useAppSelector(
    (state) => state.Order.restaurantCoverImageList,
    shallowEqual,
  );
  const fetchRestaurantsInProgress = useAppSelector(
    (state) => state.SelectRestaurantPage.fetchRestaurantsPending,
  );
  const currentSelectedMenuId = useAppSelector(
    (state) => state.Order.currentSelectedMenuId,
  );
  const onRecommendRestaurantInProgress = useAppSelector(
    (state) => state.Order.onRecommendRestaurantInProgress,
  );
  const onRescommendRestaurantForSpecificDateInProgress = useAppSelector(
    (state) => state.Order.onRescommendRestaurantForSpecificDateInProgress,
  );
  const availableOrderDetailCheckList = useAppSelector(
    (state) => state.Order.availableOrderDetailCheckList,
    shallowEqual,
  );

  const isEditFlow = flowType === EFlowType.edit;

  const orderGetter = Listing(order as TListing);
  const {
    orderState,
    packagePerMember = '',
    pickAllow = true,
    selectedGroups = [],
    deliveryHour,
    startDate,
    endDate,
    deliveryAddress,
    deadlineDate,
    deadlineHour,
    memberAmount,
    nutritions = [],
    plans = [],
    dayInWeek,
    daySession,
    orderStateHistory,
    orderType = EOrderType.group,
  } = orderGetter.getMetadata();
  const { title: orderTitle } = orderGetter.getAttributes();
  const orderId = orderGetter.getId();
  const planId = plans?.[0];
  const isOrderInProgress = orderState === EOrderStates.inProgress;
  const currentOrderDetail = isEditFlow ? draftEditOrderDetail : orderDetail;
  const isNormalOrder = orderType === EOrderType.normal;

  const {
    packagePerMember: draftPackagePerMember,
    pickAllow: draftPickAllow,
    selectedGroups: draftSelectGroups,
    deliveryHour: draftDeliveryHour,
    startDate: draftStartDate,
    endDate: draftEndDate,
    deliveryAddress: draftDeliveryAddress,
    deadlineDate: draftDeadlineDate,
    deadlineHour: draftDeadlineHour,
    memberAmount: draftMemberAmount,
    dayInWeek: draftDayInWeek,
    daySession: draftDaySession,
    nutritions: draftNutritions,
  } = draftEditOrderData;
  const { address: draftAddress, origin: draftOrigin } =
    draftDeliveryAddress || {};

  const isPickingOrder = orderState === EOrderStates.picking;
  const isInProgressOrder = orderState === EOrderStates.inProgress;
  const shouldHideRemoveMealIcon =
    isEditFlow && (isPickingOrder || isInProgressOrder);
  const shouldHideAddMorePlan = isEditFlow && isPickingOrder;

  const missingSelectedFood = Object.keys(orderDetail).filter(
    (dateTime) => orderDetail[dateTime]?.restaurant?.foodList?.length === 0,
  );
  const draftSelectedFoodTime = Object.keys(draftEditOrderDetail!).filter(
    (dateTime) =>
      !isEmpty(draftEditOrderDetail?.[dateTime]?.restaurant?.foodList),
  );
  const draftSelectedFoodDays = draftSelectedFoodTime.map(
    (time) => convertWeekDay(DateTime.fromMillis(Number(time)).weekday).key,
  );

  const suitableAnchorDate = useMemo(() => {
    const temp = isEditFlow
      ? findSuitableAnchorDate({
          selectedDate,
          startDate: draftStartDate || startDate,
          endDate: draftEndDate || endDate,
          orderDetail: draftEditOrderDetail || orderDetail,
        })
      : findSuitableAnchorDate({
          selectedDate,
          startDate,
          endDate,
          orderDetail,
        });

    return temp instanceof Date ? temp : temp ? new Date(temp) : new Date();
  }, [
    isEditFlow,
    selectedDate,
    draftStartDate,
    startDate,
    draftEndDate,
    endDate,
    JSON.stringify(orderDetail),
    JSON.stringify(draftEditOrderDetail),
  ]);
  const suitableDayInWeek = useMemo(() => {
    if (isEditFlow) {
      return draftDayInWeek || dayInWeek;
    }

    return dayInWeek;
  }, [isEditFlow, JSON.stringify(dayInWeek), JSON.stringify(draftDayInWeek)]);

  const { address, origin } = deliveryAddress || {};
  const { lastName: clientLastName, firstName: clientFirstName } =
    User(selectedCompany).getProfile();
  const partnerName = `${clientLastName} ${clientFirstName}`;
  const eventsForCalender = useMemo(
    () =>
      isEditFlow
        ? normalizePlanDetailsToEvent(
            draftEditOrderDetail || orderDetail,
            {
              deliveryHour: draftDeliveryHour || deliveryHour,
              daySession: draftDaySession || daySession,
              plans,
              orderState,
              orderStateHistory,
            },
            restaurantCoverImageList,
            isEditFlow,
          )
        : normalizePlanDetailsToEvent(
            orderDetail,
            {
              deliveryHour,
              daySession,
              orderState,
              plans,
            },
            restaurantCoverImageList,
          ),
    [
      isEditFlow,
      deliveryHour,
      draftDeliveryHour,
      daySession,
      draftDaySession,
      JSON.stringify(restaurantCoverImageList),
      JSON.stringify(orderDetail),
      JSON.stringify(draftEditOrderDetail),
    ],
  );
  const showPickFoodModal = isPickFoodModalOpen && !fetchFoodInProgress;

  const handleSubmitRestaurant = async (values: TObject) => {
    const { restaurant, selectedFoodList } = values;
    const foodIds = Object.keys(selectedFoodList);
    const subOrderDate = (selectedDate as Date).getTime();
    const adjustedFoodList = adjustFoodListPrice(
      selectedFoodList,
      order as TListing,
    );
    const restaurantData = {
      restaurant: {
        id: restaurant.id,
        restaurantName: restaurant.restaurantName,
        menuId: restaurant.menuId,
        phoneNumber: restaurant.phoneNumber,
        foodList: adjustedFoodList,
        minQuantity: restaurant.minQuantity || 1,
        maxQuantity: restaurant.maxQuantity || 100,
      },
    };

    if (isEditFlow) {
      const editTagVersion =
        currentOrderDetail[selectedDate?.getTime()]?.restaurant?.editTagVersion;

      let updateOrderDetailOnDate = {
        ...currentOrderDetail[subOrderDate],
        ...restaurantData,
        ...(isOrderInProgress && {
          editTagVersion: editTagVersion ? editTagVersion + 1 : 1,
        }),
      };
      const { lineItems: currentSubOrderLineItems } =
        currentOrderDetail[selectedDate?.getTime()] || {};

      const isRestaurantChanged =
        restaurantData.restaurant.id !==
        orderDetail[subOrderDate]?.restaurant.id;
      changedRestaurantController.setValue(
        isRestaurantChanged && isInProgressOrder,
      );
      if (isNormalOrder) {
        const createLineItems = (_foodList: TObject) =>
          Object.entries<{
            foodName: string;
            foodPrice: number;
            foodExtraFee?: number;
          }>(_foodList).map(([foodId, food]) => buildLineItem(foodId, food));
        const removeDeletedFoodLineItems = currentSubOrderLineItems.filter(
          (lineItem: TObject) => has(selectedFoodList, lineItem.id),
        );
        const currentFoodIds = currentSubOrderLineItems.map(
          (lineItem: TObject) => lineItem.id,
        );
        const newFoodList = pickBy(
          selectedFoodList,
          (_, foodId: string) => !currentFoodIds.includes(foodId),
        );
        const newPickedLineItems = createLineItems(newFoodList);

        const updatedLineItems = [
          ...removeDeletedFoodLineItems,
          ...newPickedLineItems,
        ];

        const newLineItems = isNormalOrder
          ? createLineItems(selectedFoodList)
          : [];

        updateOrderDetailOnDate = {
          ...updateOrderDetailOnDate,
          lineItems: isRestaurantChanged ? newLineItems : updatedLineItems,
        };
      }

      dispatch(
        saveDraftEditOrder({
          orderDetail: {
            [subOrderDate]: updateOrderDetailOnDate,
          },
          mode: 'merge',
        }),
      );
    } else {
      dispatch(setCanNotGoAfterOderDetail(true));
      const isOrderAllowAddSecondaryFood = getIsAllowAddSecondaryFood(
        order as TListing,
      );
      const lineItems = isOrderAllowAddSecondaryFood
        ? Object.entries(adjustedFoodList).map(
            ([foodId, food]: [string, any]) => buildLineItem(foodId, food),
          )
        : getUpdateLineItems(foodList, foodIds, foodExtraFees);

      await dispatch(
        orderAsyncActions.updatePlanDetail({
          orderId,
          orderDetail: {
            [subOrderDate]: {
              ...restaurantData,
              lineItems,
            },
          },
          planId,
          updateMode: 'merge',
        }),
      );
    }

    dispatch(unSelectRestaurant());
  };

  const allCompanyGroups =
    selectedCompany?.attributes.profile.metadata.groups?.reduce(
      (result: any, group: any) => {
        return {
          ...result,
          [group.id]: group.name,
        };
      },
      {},
    ) || {};
  const selectedGroupsName = (draftSelectGroups || selectedGroups).map(
    (groupId: string) => {
      if (groupId === 'allMembers') {
        return intl.formatMessage({ id: 'ParticipantSetupField.allMembers' });
      }

      return allCompanyGroups[groupId];
    },
  );
  const pickingDeadline = parseDateFromTimestampAndHourString(
    draftDeadlineDate || deadlineDate,
    draftDeadlineHour || deadlineHour,
    'dd/MM/yyyy, hh:mm',
  );
  const allMembersAmount =
    draftMemberAmount ||
    memberAmount ||
    (selectedCompany &&
      calculateGroupMembersAmount(
        selectedCompany,
        draftSelectGroups || selectedGroups,
      ));

  const initialOrderSettingValues = useMemo(
    () => ({
      [OrderSettingField.COMPANY]:
        selectedCompany?.attributes.profile.publicData.companyName,
      [OrderSettingField.DELIVERY_ADDRESS]: draftAddress || address,
      [OrderSettingField.DELIVERY_TIME]: draftDeliveryHour || deliveryHour,
      [OrderSettingField.EMPLOYEE_AMOUNT]: allMembersAmount,
      [OrderSettingField.SPECIAL_DEMAND]: '',
      [OrderSettingField.PER_PACK]: intl.formatMessage(
        { id: 'SetupOrderDetail.perPack' },
        {
          value:
            addCommas(
              (draftPackagePerMember || packagePerMember)?.toString(),
            ) || '',
        },
      ),
      ...(typeof draftPickAllow !== 'undefined'
        ? draftPickAllow
        : pickAllow
        ? {
            [OrderSettingField.PICKING_DEADLINE]: pickingDeadline,
            [OrderSettingField.ACCESS_SETTING]: (
              draftSelectGroups || selectedGroupsName
            )?.join(', '),
          }
        : {}),
    }),
    [
      draftAddress,
      address,
      allMembersAmount,
      selectedCompany?.attributes.profile.publicData.companyName,
      draftDeliveryHour,
      deliveryHour,
      draftPackagePerMember,
      packagePerMember,
      draftPickAllow,
      pickAllow,
      pickingDeadline,
      JSON.stringify(draftSelectGroups),
      JSON.stringify(selectedGroupsName),
    ],
  );

  const inProgress =
    (updateOrderInProgress || updateOrderDetailInProgress) &&
    !onRecommendRestaurantInProgress;
  const isOrderDetailChanged = !isEqual(orderDetail, draftEditOrderDetail);
  const shouldShowConfirmChangedModal =
    isPickingOrder && isEditFlow && isOrderDetailChanged;
  const disabledSubmit =
    !isEditFlow &&
    (Object.keys(orderDetail).length === 0 ||
      missingSelectedFood.length > 0 ||
      Object.keys(availableOrderDetailCheckList).some(
        (item) => !availableOrderDetailCheckList[item].isAvailable,
      ));
  const initialFoodList = isPickFoodModalOpen
    ? currentOrderDetail[selectedDate?.getTime()]?.restaurant?.foodList
    : {};

  useEffect(() => {
    const menuListingIds = Object.values(orderDetail)?.map(
      (date: any) => date.restaurant?.menuId,
    );
    dispatch(
      orderAsyncActions.fetchMenuListingsByIds({
        menuListingIds,
      }),
    );
  }, [JSON.stringify(orderDetail)]);

  useEffect(() => {
    if (isEmpty(orderDetail) && !justDeletedMemberOrder && !isEmpty(plans)) {
      dispatch(orderAsyncActions.fetchOrderDetail(plans));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(order),
    JSON.stringify(orderDetail),
    JSON.stringify(plans),
  ]);
  const restaurantListFromOrder = Object.keys(
    getRestaurantListFromOrderDetail(
      isEditFlow ? draftEditOrderDetail : orderDetail,
    ),
  );
  const orderDetailToRecommendRestaurant = Object.keys(
    draftEditOrderDetail || {},
  ).reduce((res, time) => {
    return {
      ...res,
      [time]: {
        restaurant: { id: draftEditOrderDetail?.[time]?.restaurant?.id },
      },
    };
  }, {});

  const recommendParams = {
    startDate: draftStartDate || startDate,
    endDate: draftEndDate || endDate,
    dayInWeek: isPickingOrder ? draftSelectedFoodDays : suitableDayInWeek,
    deliveryOrigin: draftOrigin || origin,
    memberAmount: draftMemberAmount || memberAmount,
    isNormalOrder: !(draftPickAllow || pickAllow),
    nutritions: draftNutritions || nutritions,
    packagePerMember: draftPackagePerMember || packagePerMember,
    daySession: draftDaySession || daySession,
    orderDetail: orderDetailToRecommendRestaurant,
  };

  // TODO: handle next tab and next to review tab clicks
  const handleNextTabClick = () => {
    dispatch(setCanNotGoAfterOderDetail(false));

    if (shouldShowConfirmChangedModal) {
      confirmChangeOrderDetailControl.setTrue();
      shouldNextTabControl.setTrue();
    } else {
      nextTab();
    }
  };
  const handleNextReviewTabClick = () => {
    if (shouldShowConfirmChangedModal) {
      confirmChangeOrderDetailControl.setTrue();
    } else if (nextToReviewTab) {
      nextToReviewTab();
    }
  };

  const handleNextTabClickWithConfirmationModal = () => {
    const isHideChangeSelectedFoodConfirmModal = getItem(
      'isHideChangeSelectedFoodConfirmModal',
    );

    if (
      !isHideChangeSelectedFoodConfirmModal &&
      changedRestaurantController.value
    ) {
      changeSelectedFoodConfirmModal.setTrue();
      setOnNextClick(() => handleNextTabClick);
    } else {
      handleNextTabClick();
    }
  };

  const handleNextReviewTabClickWithConfirmationModal = () => {
    const isHideChangeSelectedFoodConfirmModal = getItem(
      'isHideChangeSelectedFoodConfirmModal',
    );

    if (
      !isHideChangeSelectedFoodConfirmModal &&
      changedRestaurantController.value
    ) {
      changeSelectedFoodConfirmModal.setTrue();
      setOnNextClick(() => handleNextReviewTabClick);
    } else {
      handleNextReviewTabClick();
    }
  };

  useEffect(() => {
    if (!isEmpty(restaurantListFromOrder)) {
      dispatch(orderAsyncActions.fetchRestaurantCoverImages({ isEditFlow }));
    }
  }, [JSON.stringify(restaurantListFromOrder)]);

  // TODO: handle confirm order detail changed action clicks
  const handleConfirmOrderDetailChanges = () => {
    confirmChangeOrderDetailControl.setFalse();
    if (shouldNextTabControl.value) {
      nextTab();
    } else if (nextToReviewTab) nextToReviewTab();
  };
  const handleRejectOrderDetailChanges = () => {
    dispatch(
      saveDraftEditOrder({
        orderDetail,
      }),
    );
    handleConfirmOrderDetailChanges();
  };

  // TODO: handle click add more plan
  const handleAddMorePlanClick = (date: Date) => {
    dispatch(selectCalendarDate(date));
    dispatch(selectRestaurant());
  };

  // TODO: handle go back calendar flow when selecting restaurant
  const handleGoBackWhenSelectingRestaurant = () => {
    dispatch(unSelectRestaurant());
  };

  // TODO: check edit food is in progress
  const onEditFoodInProgress = (timestamp: number) => {
    return (
      (fetchFoodInProgress || fetchRestaurantsInProgress) &&
      selectedDate?.getTime() === timestamp
    );
  };

  // TODO: check recommend restaurant for day is in progress
  const onRecommendRestaurantForSpecificDayInProgress = (timestamp: number) => {
    return (
      onRescommendRestaurantForSpecificDateInProgress &&
      selectedDate?.getTime() === timestamp
    );
  };

  // TODO: handle selecting food from food modal
  const handleSelectFood = async (values: TSelectFoodFormValues) => {
    dispatch(setCanNotGoAfterOderDetail(true));
    const { food: foodIds } = values;
    const updateLineItems = getUpdateLineItems(
      foodList,
      foodIds,
      foodExtraFees,
    );

    const { submitRestaurantData, submitFoodListData } =
      getSelectedRestaurantAndFoodList({
        foodList,
        foodIds,
        currentRestaurant,
        extraFeeByFoodId: foodExtraFees,
      });
    await handleSubmitRestaurant({
      restaurant: { ...submitRestaurantData, menuId: currentSelectedMenuId },
      selectedFoodList: submitFoodListData,
      lineItems: updateLineItems,
    });
    closePickFoodModal();
  };

  const onCancelChangeFood = () => {
    dispatch(
      saveDraftEditOrder({
        orderDetail,
      }),
    );
    changedRestaurantController.setFalse();
  };

  // TODO: handle change food in meal
  const handleEditFoodInMealPlanCard = async (
    dateTime: any,
    restaurantId: string,
    menuId: string,
  ) => {
    dispatch(selectCalendarDate(DateTime.fromMillis(+dateTime).toJSDate()));
    dispatch(addCurrentSelectedMenuId(menuId));
    await dispatch(
      selectRestaurantPageThunks.fetchSelectedRestaurant(restaurantId),
    );
    await dispatch(
      selectRestaurantPageThunks.getRestaurantFood({
        menuId,
        subOrderDate: dateTime,
      }),
    );
    openPickFoodModal();
  };

  // TODO: handle remove day's meal
  const handleRemoveMeal = (id: string) => (resourceId: string) => {
    if (isEditFlow) {
      dispatch(
        saveDraftEditOrder({
          orderDetail: {
            [resourceId]: { restaurant: { foodList: [] } },
          },
          mode: 'merge',
        }),
      );
    } else {
      dispatch(setCanNotGoAfterOderDetail(true));
      dispatch(
        orderAsyncActions.updatePlanDetail({
          orderId,
          planId: id,
          orderDetail: {
            [resourceId]: null,
          },
          updateMode: 'merge',
        }),
      );
    }
  };

  // TODO: handle recommend restaurant days in week
  const onRecommendNewRestaurants = useCallback(async () => {
    dispatch(setOnRecommendRestaurantInProcess(true));

    if (isEditFlow) {
      const { payload: recommendOrderDetail }: any = await dispatch(
        orderAsyncActions.recommendRestaurants({
          shouldUpdatePlanOrderOrderDetail: isEditFlow,
          recommendParams,
        }),
      );

      let updateOrderDetail = {};

      if (isInProgressOrder) {
        const disableEditingTimestamps = eventsForCalender.reduce(
          (acc, _event) => {
            if (_event.resource.disableEditing) {
              return [...acc, _event.resource.id];
            }

            return acc;
          },
          [] as string[],
        );
        const shouldRecommendOrderDetail = omit(
          recommendOrderDetail,
          disableEditingTimestamps,
        );

        updateOrderDetail = mergeRecommendOrderDetailWithCurrentOrderDetail(
          draftEditOrderDetail!,
          shouldRecommendOrderDetail,
        );
      } else {
        updateOrderDetail = mergeRecommendOrderDetailWithCurrentOrderDetail(
          draftEditOrderDetail!,
          recommendOrderDetail,
        );
      }

      dispatch(
        saveDraftEditOrder({
          orderDetail: updateOrderDetail,
        }),
      );
    } else {
      const { payload: recommendOrderDetail }: any = await dispatch(
        orderAsyncActions.recommendRestaurants({
          shouldUpdatePlanOrderOrderDetail: isEditFlow,
        }),
      );
      await dispatch(
        orderAsyncActions.updatePlanDetail({
          orderId,
          planId,
          orderDetail: recommendOrderDetail,
        }),
      );
    }
    dispatch(setOnRecommendRestaurantInProcess(false));
  }, []);

  // TODO: handle recommend restaurant for specific day
  const onRecommendRestaurantForSpecificDay = (date: number) => {
    dispatch(selectCalendarDate(DateTime.fromMillis(date).toJSDate()));
    dispatch(
      orderAsyncActions.recommendRestaurantForSpecificDay({
        shouldUpdatePlanOrderOrderDetail: !isEditFlow,
        dateTime: date,
        ...(isEditFlow ? { recommendParams } : {}),
      }),
    );
  };

  // TODO: handle apply meal for other days
  const onApplyOtherDays = useCallback(
    async (date: string, selectedDates: string[]) => {
      if (selectedDates.length === 0) {
        return;
      }

      setIsApplyingOtherDays(true);

      try {
        const totalDates = renderDateRange(
          draftStartDate || startDate,
          draftEndDate || endDate,
        );

        const timestampsToFetch = totalDates.filter((curr) =>
          selectedDates.includes(
            convertWeekDay(DateTime.fromMillis(curr).weekday).key,
          ),
        );

        const newOrderId = Array.isArray(orderId) ? orderId[0] : orderId;

        const orderDetailToHandle = isEditFlow
          ? draftEditOrderDetail
          : orderDetail;

        const fetchedData = await Promise.all(
          timestampsToFetch.map((timestamp) =>
            dispatch(
              BookerSelectRestaurantThunks.fetchFoodsByRestaurantAndTimestamp({
                restaurantId: orderDetailToHandle?.[date]?.restaurant?.id,
                timestamp,
                orderId: newOrderId ?? '',
              }),
            ),
          ),
        );

        const isOrderAllowAddSecondaryFood = getIsAllowAddSecondaryFood(
          order as TListing,
        );

        const newOrderDetail = totalDates.reduce((result, curr) => {
          const currWeekday = convertWeekDay(
            DateTime.fromMillis(curr).weekday,
          ).key;

          if (selectedDates.includes(currWeekday) && curr.toString() !== date) {
            if (
              isPickingOrder &&
              isEditFlow &&
              !draftSelectedFoodDays.includes(currWeekday)
            ) {
              return result;
            }

            const fetchedDataForTimestamp = fetchedData.find(
              (data) => data.meta.arg.timestamp === curr,
            );

            if (fetchedDataForTimestamp) {
              const combinedFoods = (fetchedDataForTimestamp?.payload as any)
                ?.foodsByRestaurantAndTimestamp;

              const newFoodList = combinedFoods?.reduce(
                (
                  foodResult: {
                    [foodId: string]: {
                      foodName: string;
                      foodPrice: number;
                      foodUnit: string;
                      numberOfMainDishes: number;
                    };
                  },
                  food: TFoodInRestaurant,
                ) => {
                  foodResult[food.foodId] = {
                    foodName: food.foodName,
                    foodPrice: food.price,
                    foodUnit: food.foodUnit,
                    numberOfMainDishes: food?.numberOfMainDishes ?? 2,
                  };

                  return foodResult;
                },
                {},
              );

              // Adjust the food list price if the company is allowed to add a second food
              const adjustedFoodList = isOrderAllowAddSecondaryFood
                ? adjustFoodListPrice(newFoodList, order as TListing)
                : newFoodList;

              return {
                ...result,
                [curr]: {
                  ...orderDetailToHandle![curr],
                  lineItems: orderDetailToHandle![date]?.lineItems || [],
                  restaurant: {
                    ...orderDetailToHandle?.[date]?.restaurant,
                    foodList: adjustedFoodList,
                  },
                },
              };
            }
          }

          return result;
        }, orderDetailToHandle);

        if (isEditFlow) {
          dispatch(
            saveDraftEditOrder({
              orderDetail: newOrderDetail,
            }),
          );
        } else {
          dispatch(setCanNotGoAfterOderDetail(true));

          await dispatch(
            orderAsyncActions.updatePlanDetail({
              orderId,
              planId,
              orderDetail: newOrderDetail,
            }),
          );
        }
      } catch (error) {
        toast.error(
          'Xin lỗi, đã có sự cố. Vui lòng thử tải lại trang hoặc liên hệ với chúng tôi để được hỗ trợ.',
        );
      } finally {
        setIsApplyingOtherDays(false);
      }
    },
    [
      dispatch,
      orderId,
      isPickingOrder,
      isEditFlow,
      JSON.stringify(draftSelectedFoodDays),
      JSON.stringify(orderDetail),
      JSON.stringify(draftEditOrderDetail),
      planId,
      selectedDate,
      draftStartDate,
      startDate,
      draftEndDate,
      endDate,
    ],
  );

  // TODO: prepare calendar resources and props
  const defaultCalendarExtraResources = useGetCalendarExtraResources({
    order,
    startDate: draftStartDate || startDate,
    endDate: draftEndDate || endDate,
  });
  const calendarExtraResources = {
    ...defaultCalendarExtraResources,
    onEditFood: handleEditFoodInMealPlanCard,
    onSearchRestaurant: handleAddMorePlanClick,
    onEditFoodInProgress,
    dayInWeek: suitableDayInWeek,
    onApplyOtherDays,
    onApplyOtherDaysInProgress: isApplyingOtherDays,
    onRecommendRestaurantForSpecificDay,
    onRecommendRestaurantForSpecificDayInProgress,
    availableOrderDetailCheckList,
    shouldHideAddMorePlan,
    shouldHideRemoveMealIcon,
    companyGeoOrigin,
  };
  const addMorePlanExtraProps = {
    onClick: handleAddMorePlanClick,
    startDate: draftStartDate || startDate,
    endDate: draftEndDate || endDate,
  };
  const renderEvent = (props: any) => {
    return (
      <MealPlanCard
        {...props}
        removeInprogress={props?.resources?.updatePlanDetailInprogress}
        onRemove={handleRemoveMeal(props?.resources?.planId)}
      />
    );
  };
  const calendarComponents = {
    contentEnd: (props: any) => (
      <AddMorePlan {...props} {...addMorePlanExtraProps} />
    ),
  };
  const recommendButton = (
    <div className={css.buttonContainer}>
      <Button
        onClick={onRecommendNewRestaurants}
        variant="secondary"
        className={css.recommendNewRestaurantBtn}>
        <IconRefreshing inProgress={onRecommendRestaurantInProgress} />
        <FormattedMessage id="SetupOrderDetail.recommendNewRestaurant" />
      </Button>
    </div>
  );

  useEffect(() => {
    if (!isEmpty(restaurantListFromOrder)) {
      dispatch(orderAsyncActions.fetchRestaurantCoverImages({ isEditFlow }));
    }
  }, [JSON.stringify(restaurantListFromOrder), isEditFlow]);

  useEffect(() => {
    if (isEditFlow ? !isEmpty(draftEditOrderDetail) : !isEmpty(orderDetail)) {
      dispatch(orderAsyncActions.checkRestaurantStillAvailable({ isEditFlow }));
    }
  }, [
    dispatch,
    isEditFlow,
    JSON.stringify(orderDetail),
    JSON.stringify(draftEditOrderDetail),
  ]);

  return (
    <>
      <RenderWhen condition={isSelectingRestaurant}>
        <SelectRestaurantPage
          onSubmitRestaurant={handleSubmitRestaurant}
          selectedDate={selectedDate as Date}
          onBack={handleGoBackWhenSelectingRestaurant}
          selectFoodInProgress={updateOrderDetailInProgress}
        />
        <RenderWhen.False>
          <div>
            <div className={css.titleContainer}>
              <div>
                <div className={css.row}>
                  {orderTitle ? (
                    <span className={css.orderTitle}>{`#${orderTitle}`}</span>
                  ) : (
                    <span className={css.orderTitle}>
                      {intl.formatMessage({
                        id: 'SetupOrderDetail.orderId.draft',
                      })}
                    </span>
                  )}

                  <Badge
                    label={`Đơn hàng tuần • ${partnerName}`}
                    type={EBadgeType.info}
                  />
                </div>
                <div
                  className={classNames(css.row, css.settingBtn)}
                  onClick={onOrderSettingModalOpen}>
                  <IconSetting className={css.settingIcon} />
                  <FormattedMessage id="SetupOrderDetail.orderSettings" />
                </div>
              </div>
            </div>
            <div className={css.calendarContainer}>
              <CalendarDashboard
                anchorDate={suitableAnchorDate}
                events={eventsForCalender}
                renderEvent={renderEvent}
                companyLogo="Company"
                startDate={new Date(draftStartDate || startDate)}
                endDate={new Date(draftEndDate || endDate)}
                resources={calendarExtraResources}
                components={calendarComponents}
                hideMonthView
                recommendButton={recommendButton}
              />
            </div>
            <NavigateButtons
              goBack={goBack}
              onNextClick={handleNextTabClickWithConfirmationModal}
              submitDisabled={disabledSubmit}
              inProgress={inProgress}
              onCompleteClick={handleNextReviewTabClickWithConfirmationModal}
              flowType={flowType}
            />
            <OrderSettingModal
              isOpen={isOrderSettingModalOpen}
              onClose={onOrderSettingModalClose}
              initialFieldValues={initialOrderSettingValues}
            />
          </div>
        </RenderWhen.False>
      </RenderWhen>
      <SelectFoodModal
        restaurant={currentRestaurant}
        items={foodList as any[]}
        isOpen={showPickFoodModal}
        initialFoodList={initialFoodList}
        handleClose={closePickFoodModal}
        selectFoodInProgress={updateOrderDetailInProgress}
        handleSelectFood={handleSelectFood}
      />
      <ChangeSelectedFoodConfirmModal
        isOpen={changeSelectedFoodConfirmModal.value}
        handleClose={changeSelectedFoodConfirmModal.setFalse}
        onCancelChangeFood={onCancelChangeFood}
        onConfirmChangeFood={onNextClick}
      />
      <AlertModal
        isOpen={confirmChangeOrderDetailControl.value}
        containerClassName={css.confirmOrderDetailChanged}
        handleClose={confirmChangeOrderDetailControl.setFalse}
        cancelLabel={'Huỷ thay đổi'}
        shouldHideIconClose
        confirmLabel={'Tiếp tục'}
        onCancel={handleRejectOrderDetailChanges}
        onConfirm={handleConfirmOrderDetailChanges}
        childrenClassName={css.confirmOrderDetailChangedChildren}
        actionsClassName={css.confirmOrderDetailChangedActions}>
        <div className={css.modalIconContainer}>
          <IconDangerWithCircle />
        </div>
        <div className={css.description}>
          Những lựa chọn Nhà hàng & Món ăn sẽ thay đổi.
        </div>
      </AlertModal>
    </>
  );
};

export default SetupOrderDetail;
