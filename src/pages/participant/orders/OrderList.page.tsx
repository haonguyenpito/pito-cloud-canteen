import { useEffect, useRef, useState } from 'react';
import type { Event, View } from 'react-big-calendar';
import { Views } from 'react-big-calendar';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import flatten from 'lodash/flatten';
import { DateTime } from 'luxon';
import { useRouter } from 'next/router';

import BottomNavigationBar from '@components/BottomNavigationBar/BottomNavigationBar';
import Button from '@components/Button/Button';
import CalendarDashboard from '@components/CalendarDashboard/CalendarDashboard';
import OrderEventCard from '@components/CalendarDashboard/components/OrderEventCard/OrderEventCard';
import { EVENT_STATUS } from '@components/CalendarDashboard/helpers/constant';
import { EVENTS_MOCKUP } from '@components/CalendarDashboard/helpers/mockupData';
import useSelectDay from '@components/CalendarDashboard/hooks/useSelectDay';
import LoadingModal from '@components/LoadingModal/LoadingModal';
import ParticipantLayout from '@components/ParticipantLayout/ParticipantLayout';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import Tabs from '@components/Tabs/Tabs';
import { getItem } from '@helpers/localStorageHelpers';
import { prepareDaySession } from '@helpers/order/prepareDataHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { useViewport } from '@hooks/useViewport';
import { buildParticipantSubOrderDocumentId } from '@pages/api/participants/document/document.service';
import { CalendarActions } from '@redux/slices/Calendar.slice';
import { participantPaths } from '@src/paths';
import type { PlanListing } from '@src/types';
import { CurrentUser, Listing } from '@src/utils/data';
import {
  getEndDayOfWeek,
  getEndOfMonth,
  getNextMonth,
  getNextWeek,
  getPrevMonth,
  getPrevWeek,
  getStartDayOfWeek,
  getStartOfMonth,
  isOver,
  isSameDate,
} from '@src/utils/dates';
import {
  EOrderStates,
  EParticipantOrderStatus,
  ESubOrderTxStatus,
} from '@src/utils/enums';
import {
  ETransition,
  TRANSITIONS_TO_STATE_CANCELED,
} from '@src/utils/transaction';

import ParticipantToolbar from '../components/ParticipantToolbar/ParticipantToolbar';
import { SubOrdersThunks } from '../sub-orders/SubOrders.slice';

import EmptySubOrder from './components/EmptySubOrder/EmptySubOrder';
import NotificationModal from './components/NotificationModal/NotificationModal';
import OnboardingOrderModal from './components/OnboardingOrderModal/OnboardingOrderModal';
import OnboardingTour from './components/OnboardingTour/OnboardingTour';
import OrderListHeaderSection from './components/OrderListHeaderSection/OrderListHeaderSection';
import RatingSubOrderModal from './components/RatingSubOrderModal/RatingSubOrderModal';
import SubOrderCard from './components/SubOrderCard/SubOrderCard';
import SubOrderDetailModal from './components/SubOrderDetailModal/SubOrderDetailModal';
import UpdateProfileModal from './components/UpdateProfileModal/UpdateProfileModal';
import WelcomeModal from './components/WelcomeModal/WelcomeModal';
import { OrderListActions, OrderListThunks } from './OrderList.slice';

import css from './OrderList.module.scss';

const OrderListPage = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    planId: planIdFromQuery,
    timestamp: timestampFromQuery,
    viewMode,
  } = router.query;
  const localStorageView = getItem('participant_calendarView');
  const isValidLocalStorageView = ['month', 'week'].includes(
    localStorageView as View,
  );

  const currentView =
    viewMode || (isValidLocalStorageView ? localStorageView : Views.WEEK);

  const [defaultCalendarView] = useState<View>(currentView);

  const updateProfileModalControl = useBoolean();
  const onBoardingModal = useBoolean();
  const tourControl = useBoolean();
  const ratingSubOrderModalControl = useBoolean();
  const { selectedDay, handleSelectDay } = useSelectDay();
  const [anchorDate, setAnchorDate] = useState<Date>(selectedDay || new Date());

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState<Date>(
    selectedDay || new Date(),
  );
  const [maxSelectedMonth, setMaxSelectedMonth] = useState<Date>(
    getEndOfMonth(getEndDayOfWeek(selectedDayOfMonth)),
  );
  const [minSelectedMonth, setMinSelectedMonth] = useState<Date>(
    getStartOfMonth(getStartDayOfWeek(selectedDayOfMonth)),
  );
  const isFirstTimeReachMinOrMaxMonthControl = useBoolean(true);
  const hasFetchedOrders = useRef(false);

  const subOrderDetailModalControl = useBoolean();
  const { isMobileLayout } = useViewport();
  const notificationModalControl = useBoolean();
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const orders = useAppSelector(
    (state) => state.ParticipantOrderList.orders,
    shallowEqual,
  );
  const ordersNotConfirmFirstTime = useAppSelector(
    (state) => state.ParticipantOrderList.ordersNotConfirmFirstTime,
    shallowEqual,
  );

  const deliveredSubOrders = useAppSelector(
    (state) => state.ParticipantSubOrderList.deliveredSubOrders,
    shallowEqual,
  );

  const fetchSubOrdersInProgress = useAppSelector(
    (state) => state.ParticipantSubOrderList.fetchSubOrdersInProgress,
    shallowEqual,
  );

  const fetchSubOrderDocumentInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.fetchSubOrderDocumentInProgress,
  );

  const subOrderDocument = useAppSelector(
    (state) => state.ParticipantOrderList.subOrderDocument,
    shallowEqual,
  );

  const fetchOrdersInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.fetchOrdersInProgress,
  );
  const plans = useAppSelector(
    (state) => state.ParticipantOrderList.allPlans,
    shallowEqual,
  );
  const restaurants = useAppSelector(
    (state) => state.ParticipantOrderList.restaurants,
    shallowEqual,
  );
  const mappingSubOrderToOrder = useAppSelector(
    (state) => state.ParticipantOrderList.mappingSubOrderToOrder,
    shallowEqual,
  );
  const intl = useIntl();
  const updateSubOrderInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.updateSubOrderInProgress,
  );
  const colorOrderMap = useAppSelector(
    (state) => state.ParticipantOrderList.colorOrderMap,
  );
  const addSubOrderDocumentToFirebaseInProgress = useAppSelector(
    (state) =>
      state.ParticipantOrderList.addSubOrderDocumentToFirebaseInProgress,
  );
  const participantPostRatingInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.participantPostRatingInProgress,
  );
  const notifications = useAppSelector(
    (state) => state.Notification.notifications,
  );
  const foodsInPlans = useAppSelector(
    (state) => state.ParticipantOrderList.foodsInPlans,
  );
  const fetchSubOrderTxInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.fetchSubOrderTxInProgress,
  );
  const pickFoodForSubOrdersInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.pickFoodForSubOrdersInProgress,
  );
  const pickFoodForSpecificSubOrderInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.pickFoodForSpecificSubOrderInProgress,
  );

  const currentUserGetter = CurrentUser(currentUser!);
  const currentUserId = currentUserGetter.getId();
  const walkthroughEnable = false;
  const welcomeModalControl = useBoolean(walkthroughEnable);

  const showLoadingModal =
    (fetchOrdersInProgress ||
      updateSubOrderInProgress ||
      addSubOrderDocumentToFirebaseInProgress ||
      participantPostRatingInProgress ||
      fetchOrdersInProgress ||
      updateSubOrderInProgress ||
      addSubOrderDocumentToFirebaseInProgress ||
      participantPostRatingInProgress ||
      fetchSubOrderTxInProgress) &&
    !walkthroughEnable;

  const unseenNotifications = notifications.filter(
    (notification) => !notification.seen,
  );
  const numberOfUnseenNotifications = unseenNotifications.length;

  const allPlansIdList = plans?.map((plan) => Listing(plan).getId()) || [];

  const mapPlanIdInFoods = foodsInPlans.reduce((acc, currentFoodsInPlan) => {
    const { planId } = currentFoodsInPlan;
    if (!acc[planId]) {
      acc[planId] = currentFoodsInPlan;
    }

    return acc;
  }, {});

  const events = allPlansIdList.map((planId: string) => {
    const foodsInPlan = mapPlanIdInFoods[planId];

    const currentPlan = plans?.find(
      (plan) => Listing(plan).getId() === planId,
    ) as PlanListing;
    const allowToScan = currentPlan.attributes?.metadata?.allowToScan;
    const orderId = mappingSubOrderToOrder[planId];
    const order = orders?.find((_order) => Listing(_order).getId() === orderId);
    const orderGetter = Listing(order);
    const {
      deliveryHour,
      deadlineDate,
      orderStateHistory = [],
      orderState,
      companyName = 'PCC',
      daySession,
    } = orderGetter.getMetadata();
    const { title: orderTitle } = orderGetter.getAttributes();
    const isOrderCanceled =
      orderState === EOrderStates.canceled ||
      orderState === EOrderStates.canceledByBooker;

    const { orderDetail = {} } = Listing(currentPlan as any).getMetadata();
    const listEvent: Event[] = [];

    Object.keys(orderDetail).forEach((planItemKey: string) => {
      const {
        lastTransition,
        memberOrders = {},
        restaurant = {},
      } = orderDetail[planItemKey] || {};
      const { foodList = {}, restaurantName, id } = restaurant;
      const restaurantListing = restaurants?.find(
        (_restaurant) => Listing(_restaurant).getId() === id,
      );
      const restaurantGetter = Listing(restaurantListing!);
      const dishes = Object.keys(foodList).map((foodId: string) => ({
        key: foodId,
        value: foodList[foodId].foodName,
      }));

      const foodSelection = memberOrders[currentUserId] || {};
      const expiredTime = deadlineDate
        ? DateTime.fromMillis(+deadlineDate)
        : DateTime.fromMillis(+planItemKey).minus({ day: 2 });

      const alreadyPickFood = !!foodSelection?.foodId;
      const pickFoodStatus = isOrderCanceled
        ? EVENT_STATUS.CANCELED_STATUS
        : alreadyPickFood
        ? EParticipantOrderStatus.joined
        : isOver(expiredTime.toMillis())
        ? EParticipantOrderStatus.expired
        : foodSelection?.status;

      const isSubOrderNotAbleToEdit = [
        ...TRANSITIONS_TO_STATE_CANCELED,
        ETransition.START_DELIVERY,
        ETransition.COMPLETE_DELIVERY,
      ].includes(lastTransition);

      const isOrderAlreadyInProgress =
        orderStateHistory.findIndex(
          ({ state }: { state: string }) => state === EOrderStates.inProgress,
        ) !== -1;

      const pickedFoodDetail = alreadyPickFood
        ? foodsInPlan?.foodListings[foodSelection?.foodId]
        : {};
      const pickedSecondaryFoodDetail = foodSelection?.secondaryFoodId
        ? foodsInPlan?.foodListings[foodSelection.secondaryFoodId]
        : {};
      const secondaryFoodName = dishes.find(
        (_dish) => _dish.key === foodSelection?.secondaryFoodId,
      )?.value;

      const event = {
        resource: {
          id: `${planId} - ${planItemKey}`,
          timestamp: planItemKey,
          subOrderId: planId,
          orderId,
          planId,
          allowToScan,
          daySession: prepareDaySession(daySession, deliveryHour),
          status: pickFoodStatus,
          type: 'dailyMeal',
          restaurantAddress: restaurantGetter.getPublicData().location?.address,
          restaurant: {
            name: restaurantName,
            id,
          },
          meal: {
            dishes,
          },
          deadlineDate,
          companyName,
          isOrderStarted: isOrderAlreadyInProgress,
          orderColor: colorOrderMap[orderId],
          expiredTime: expiredTime.toMillis(),
          deliveryHour,
          dishSelection: { dishSelection: foodSelection?.foodId },
          secondaryDishSelection: foodSelection?.secondaryFoodId,
          orderState,
          lastTransition,
          foodName: dishes.find((_dish) => _dish.key === foodSelection?.foodId)
            ?.value,
          secondaryFoodName,
          barcode: foodSelection?.barcode,
          disableSelectFood:
            isOrderAlreadyInProgress && isSubOrderNotAbleToEdit,
          pickedFoodDetail,
          pickedSecondaryFoodDetail,
        },
        title: orderTitle,
        start: DateTime.fromMillis(+planItemKey).toJSDate(),
        end: DateTime.fromMillis(+planItemKey).plus({ hour: 1 }).toJSDate(),
      };
      listEvent.push(event);
    });

    return listEvent;
  });

  const flattenEvents = flatten<Event>(events);

  const subOrdersFromSelectedDay = flattenEvents.filter((_event: any) => {
    const _anchorDate = selectedDay || anchorDate;

    return isSameDate(_event.start, _anchorDate);
  });

  const openUpdateProfileModal = () => {
    updateProfileModalControl.setTrue();
  };
  const handleCloseWalkThrough = () => {
    tourControl.setFalse();
    onBoardingModal.setFalse();
    dispatch(OrderListThunks.disableWalkthrough(currentUserId));
    updateProfileModalControl.setFalse();
  };

  const handleOnBoardingModalOpen = () => {
    onBoardingModal.setTrue();
    updateProfileModalControl.setFalse();
    setTimeout(() => {
      tourControl.setTrue();
    }, 0);
  };

  const openRatingSubOrderModal = (options?: { forceNoTooltip?: boolean }) => {
    subOrderDetailModalControl.setFalse();
    ratingSubOrderModalControl.setTrue();

    if (options?.forceNoTooltip) {
      setTimeout(() => {
        subOrderDetailModalControl.setFalse();
      });
    }
  };

  const handleChangeTimePeriod = (action: string) => {
    if (action === 'TODAY') {
      handleSelectDay(new Date());

      return;
    }

    if (action === 'NEXT') {
      if (currentView === Views.MONTH) {
        const nextDayOfMonth = getNextMonth(selectedDayOfMonth!);
        setSelectedDayOfMonth(nextDayOfMonth);

        if (nextDayOfMonth.getTime() > maxSelectedMonth.getTime()) {
          setMaxSelectedMonth(getEndOfMonth(nextDayOfMonth));
          hasFetchedOrders.current = false;
          isFirstTimeReachMinOrMaxMonthControl.setTrue();

          return;
        }
      } else {
        const nextDayOfMonth = getNextWeek(selectedDayOfMonth!);
        setSelectedDayOfMonth(nextDayOfMonth);

        const startDayOfWeek = getStartDayOfWeek(nextDayOfMonth);
        const endDayOfWeek = getEndDayOfWeek(nextDayOfMonth);

        const normalize = (d: Date) =>
          new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (
          normalize(startDayOfWeek) < normalize(minSelectedMonth) ||
          normalize(endDayOfWeek) > normalize(maxSelectedMonth)
        ) {
          setMinSelectedMonth(getStartOfMonth(startDayOfWeek));
          setMaxSelectedMonth(getEndOfMonth(endDayOfWeek));
          hasFetchedOrders.current = false;
          isFirstTimeReachMinOrMaxMonthControl.setTrue();

          return;
        }
      }
    } else if (currentView === Views.MONTH) {
      const prevMonth = getPrevMonth(selectedDayOfMonth!);
      setSelectedDayOfMonth(prevMonth);

      if (prevMonth.getTime() < minSelectedMonth.getTime()) {
        setMinSelectedMonth(prevMonth);
        hasFetchedOrders.current = false;
        isFirstTimeReachMinOrMaxMonthControl.setTrue();

        return;
      }
    } else {
      const prevDayOfMonth = getPrevWeek(selectedDayOfMonth!);
      setSelectedDayOfMonth(prevDayOfMonth);

      const startDayOfWeek = getStartDayOfWeek(prevDayOfMonth);
      const endDayOfWeek = getEndDayOfWeek(prevDayOfMonth);

      const normalize = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate());

      if (
        normalize(startDayOfWeek) < normalize(minSelectedMonth) ||
        normalize(endDayOfWeek) > normalize(maxSelectedMonth)
      ) {
        setMinSelectedMonth(getStartOfMonth(startDayOfWeek));
        setMaxSelectedMonth(getEndOfMonth(endDayOfWeek));
        hasFetchedOrders.current = false;
        isFirstTimeReachMinOrMaxMonthControl.setTrue();

        return;
      }
    }
    isFirstTimeReachMinOrMaxMonthControl.setFalse();
  };

  const recommendFoodForSubOrder = () => {
    const neededRecommendSubOrders = flattenEvents.reduce(
      (result: any, _event: Event) => {
        const { resource } = _event;
        const { status, dishSelection, orderState } = resource;
        if (
          status === EParticipantOrderStatus.empty &&
          !dishSelection.dishSelection &&
          orderState === EOrderStates.picking
        ) {
          result.push({
            planId: resource.planId,
            orderId: resource.orderId,
            subOrderDate: resource.timestamp,
          });
        }

        return result;
      },
      [],
    );

    dispatch(
      OrderListThunks.pickFoodForSubOrders({
        recommendSubOrders: neededRecommendSubOrders,
        recommendFrom: 'orderList',
      }),
    );
  };

  const recommendFoodForSpecificSubOrder = (params: {
    planId: string;
    orderId: string;
    subOrderDate: string;
  }) => {
    dispatch(
      OrderListThunks.pickFoodForSpecificSubOrder({
        recommendSubOrder: params,
        recommendFrom: 'orderList',
      }),
    );
  };

  useEffect(() => {
    if (selectedEvent) {
      const { timestamp, planId } = selectedEvent.resource;
      const subOrderId = `${currentUserId} - ${planId} - ${timestamp}`;
      dispatch(OrderListThunks.fetchSubOrdersFromFirebase(subOrderId));
    }
  }, [selectedEvent]);

  const [isReadyLatestOrders, setReadyLatestOrders] = useState(false);

  useEffect(() => {
    (async () => {
      if (
        isFirstTimeReachMinOrMaxMonthControl.value &&
        currentUserId &&
        !hasFetchedOrders.current
      ) {
        hasFetchedOrders.current = true;
        try {
          await dispatch(
            OrderListThunks.fetchOrders({
              userId: currentUserId,
              startDate: minSelectedMonth,
              endDate: maxSelectedMonth,
            }),
          );
          setReadyLatestOrders(true);
          dispatch(OrderListActions.markColorToOrder());
        } catch (error) {
          hasFetchedOrders.current = false;
        }
      }
    })();
  }, [
    currentUserId,
    minSelectedMonth,
    maxSelectedMonth,
    isFirstTimeReachMinOrMaxMonthControl.value,
  ]);

  useEffect(() => {
    if (planIdFromQuery && timestampFromQuery) {
      const planId = planIdFromQuery as string;
      const timestamp = timestampFromQuery as string;
      const event = flattenEvents.find(
        (_event) =>
          _event.resource.planId === planId &&
          _event.resource.timestamp === timestamp,
      );
      if (event) {
        dispatch(CalendarActions.setSelectedDay(new Date(+timestamp)));
        setSelectedEvent(event);
        subOrderDetailModalControl.setTrue();
      } else {
        const monthInQuery = DateTime.fromMillis(+timestamp).toJSDate();
        setSelectedDayOfMonth(monthInQuery);

        if (monthInQuery.getTime() > maxSelectedMonth.getTime()) {
          setMaxSelectedMonth(getEndOfMonth(monthInQuery));
          hasFetchedOrders.current = false;
          isFirstTimeReachMinOrMaxMonthControl.setTrue();
        }

        if (monthInQuery.getTime() < minSelectedMonth.getTime()) {
          setMinSelectedMonth(getStartOfMonth(monthInQuery));
          hasFetchedOrders.current = false;
          isFirstTimeReachMinOrMaxMonthControl.setTrue();
        }
      }
    }
  }, [planIdFromQuery, timestampFromQuery, JSON.stringify(flattenEvents)]);

  /**
   * Load sub orders from firebase to view the sub order rating statuses
   */
  useEffect(() => {
    const orderIds = orders.map((order) => Listing(order).getId());
    if (orderIds.length) {
      dispatch(
        SubOrdersThunks.fetchSubOrdersFromFirebase({
          participantId: currentUserId,
          txStatus: ESubOrderTxStatus.DELIVERED,
          extraQueryParams: {
            orderId: {
              operator: 'in',
              value: orderIds,
            },
          },
        }),
      );
    }
  }, [JSON.stringify(orders)]);

  const getRatingSectionByScope = (
    scope: 'card' | 'pop-up',
    _event?: Event,
  ) => {
    const buttonNode = (() => {
      switch (scope) {
        case 'card':
          return (
            <Button
              disabled={
                fetchSubOrderTxInProgress || fetchSubOrderDocumentInProgress
              }
              variant="primary"
              fullWidth
              size="small"
              style={{
                padding: '4px',
                marginTop: '6px',
                height: 'auto',
              }}
              onClick={() => openRatingSubOrderModal({ forceNoTooltip: true })}>
              {intl.formatMessage({
                id: 'CompanyOrderDetailPage.titleSection.reviewButtonText',
              })}
            </Button>
          );
        case 'pop-up':
          return (
            <div className={css.ratingWrapper}>
              <Button
                disabled={
                  fetchSubOrderTxInProgress || fetchSubOrderDocumentInProgress
                }
                fullWidth
                variant="primary"
                className={css.ratingBtn}
                onClick={() => openRatingSubOrderModal()}>
                {intl.formatMessage({
                  id: 'CompanyOrderDetailPage.titleSection.reviewButtonText',
                })}
              </Button>
            </div>
          );
        default:
          return null;
      }
    })();

    const deliveriedSubOrder = deliveredSubOrders.find((subOrder) => {
      const subOrderId = buildParticipantSubOrderDocumentId(
        subOrder?.participantId!,
        subOrder.planId!,
        _event?.resource?.timestamp,
      );

      return subOrderId === subOrder.id;
    });

    const { reviewId } =
      scope === 'card' ? deliveriedSubOrder || {} : subOrderDocument || {};

    const { lastTransition, status } =
      scope === 'card'
        ? _event?.resource || {}
        : scope === 'pop-up'
        ? selectedEvent?.resource || {}
        : {};
    const canRate =
      (scope === 'card' &&
        !fetchSubOrdersInProgress &&
        lastTransition === ETransition.COMPLETE_DELIVERY &&
        status === EParticipantOrderStatus.joined &&
        (!deliveriedSubOrder || (!!deliveriedSubOrder && !reviewId))) ||
      (scope === 'pop-up' &&
        lastTransition === ETransition.COMPLETE_DELIVERY &&
        status === EParticipantOrderStatus.joined &&
        !reviewId) ||
      false;

    return <RenderWhen condition={canRate}>{buttonNode}</RenderWhen>;
  };

  useEffect(() => {
    dispatch(CalendarActions.setSelectedDay(selectedDay));
  }, []);

  useEffect(() => {
    if (
      ordersNotConfirmFirstTime &&
      ordersNotConfirmFirstTime.length &&
      isReadyLatestOrders
    ) {
      const firstOrderNotConfirmFirstTime = Listing(
        ordersNotConfirmFirstTime[0],
      );
      router.push({
        pathname: participantPaths.Order,
        query: { orderId: firstOrderNotConfirmFirstTime.getId() },
      });
    }
  }, [ordersNotConfirmFirstTime, isReadyLatestOrders]);

  useEffect(() => {
    if (selectedDay) {
      const dayEvents = flattenEvents.filter((_event: any) =>
        isSameDate(_event.start, selectedDay),
      );

      if (dayEvents.length > 0 && isMobileLayout) {
        window.scrollTo({
          top: (
            document.querySelector(`.${css.subOrderContainer}`) as HTMLElement
          )?.offsetTop,
          behavior: 'smooth',
        });
      }
    }
  }, [selectedDay]);

  const orderListPageContent = (
    <>
      <div className={css.calendarContainer}>
        <CalendarDashboard
          anchorDate={anchorDate}
          events={walkthroughEnable ? EVENTS_MOCKUP : flattenEvents}
          renderEvent={OrderEventCard}
          inProgress={fetchOrdersInProgress}
          defaultView={defaultCalendarView}
          preventSelectDay={!isMobileLayout}
          exposeAnchorDate={(date: any) => {
            setAnchorDate(date);
          }}
          components={{
            toolbar: (toolBarProps: any) => {
              return (
                <ParticipantToolbar
                  {...toolBarProps}
                  isAllowChangePeriod
                  anchorDate={anchorDate}
                  onChangeDate={handleSelectDay}
                  onCustomPeriodClick={handleChangeTimePeriod}
                  onPickForMe={recommendFoodForSubOrder}
                  onPickForMeLoading={pickFoodForSubOrdersInProgress}
                  onCustomViewChange={() => {
                    setAnchorDate(new Date());
                    handleSelectDay(new Date());
                  }}
                />
              );
            },
          }}
          resources={{
            walkthroughEnable,
            openRatingSubOrderModal,
            setSelectedEvent,
            recommendFoodForSpecificSubOrder,
            pickFoodForSpecificSubOrderInProgress,
            hideEmptySubOrderSection: !!isMobileLayout,
          }}
        />
      </div>
      <div className={css.subOrderContainer}>
        {subOrdersFromSelectedDay.length ? (
          subOrdersFromSelectedDay.map((_event) => (
            <SubOrderCard
              key={_event.resource?.id}
              event={_event}
              setSelectedEvent={setSelectedEvent}
              openSubOrderDetailModal={subOrderDetailModalControl.setTrue}
              ratingSection={getRatingSectionByScope('card', _event)}
            />
          ))
        ) : (
          <RenderWhen condition={isMobileLayout}>
            <EmptySubOrder />
          </RenderWhen>
        )}
      </div>
      <RenderWhen condition={walkthroughEnable}>
        <WelcomeModal
          isOpen={welcomeModalControl.value}
          onClose={welcomeModalControl.setFalse}
          openUpdateProfileModal={openUpdateProfileModal}
        />
        <UpdateProfileModal
          isOpen={updateProfileModalControl.value}
          onClose={() => {}}
          currentUser={currentUser!}
          handleCloseWalkThrough={handleCloseWalkThrough}
          handleOnBoardingModalOpen={handleOnBoardingModalOpen}
        />
        <OnboardingOrderModal
          isOpen={onBoardingModal.value}
          onClose={onBoardingModal.setFalse}
          isDuringTour={tourControl.value}
        />
        <OnboardingTour
          isTourOpen={tourControl.value}
          closeTour={handleCloseWalkThrough}
        />
      </RenderWhen>
      <RenderWhen condition={!!selectedEvent}>
        <div className={css.subOrderDetailModal}>
          <RenderWhen condition={isMobileLayout}>
            <SubOrderDetailModal
              isOpen={subOrderDetailModalControl.value}
              onClose={subOrderDetailModalControl.setFalse}
              event={selectedEvent!}
              ratingSection={getRatingSectionByScope('pop-up')}
              from="orderList"
              recommendFoodForSpecificSubOrder={
                recommendFoodForSpecificSubOrder
              }
              pickFoodForSpecificSubOrderInProgress={
                pickFoodForSpecificSubOrderInProgress
              }
            />
          </RenderWhen>
        </div>
      </RenderWhen>
      <RatingSubOrderModal
        isOpen={ratingSubOrderModalControl.value}
        onClose={ratingSubOrderModalControl.setFalse}
        selectedEvent={selectedEvent}
        currentUserId={currentUserId}
        participantPostRatingInProgress={participantPostRatingInProgress}
      />

      <RenderWhen condition={isMobileLayout}>
        <NotificationModal
          isOpen={notificationModalControl.value}
          onClose={notificationModalControl.setFalse}
        />
      </RenderWhen>
    </>
  );

  const tabOptions = [
    {
      id: 'company',
      label: ' ',
      childrenFn: () => orderListPageContent,
      childrenProps: {},
      children: null,
    },
  ];

  return (
    <ParticipantLayout>
      <OrderListHeaderSection
        openNotificationModal={notificationModalControl.setTrue}
        numberOfUnseenNotifications={numberOfUnseenNotifications}
      />
      <Tabs
        items={tabOptions}
        className={css.tabHeaderPosition}
        headerWrapperClassName={css.headerWrapperClassName}
        headerClassName={css.tabHeader}
      />
      <BottomNavigationBar />
      <LoadingModal isOpen={showLoadingModal} />
    </ParticipantLayout>
  );
};

export default OrderListPage;
