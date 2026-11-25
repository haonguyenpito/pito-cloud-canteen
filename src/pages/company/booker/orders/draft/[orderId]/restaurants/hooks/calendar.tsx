/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useMemo, useState } from 'react';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import { DateTime } from 'luxon';
import { useRouter } from 'next/router';

import AddMorePlan from '@components/CalendarDashboard/components/MealPlanCard/components/AddMorePlan';
import IconCheckWithBackground from '@components/Icons/IconCheckWithBackground/IconCheckWithBackground';
import {
  adjustFoodListPrice,
  getIsAllowAddSecondaryFood,
} from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import {
  orderAsyncActions,
  setOnRecommendRestaurantInProcess,
} from '@redux/slices/Order.slice';
import type { TFoodInRestaurant } from '@src/types/bookerSelectRestaurant';
import { convertWeekDay, renderDateRange } from '@src/utils/dates';
import { Listing } from '@utils/data';
import type { TFoodList } from '@utils/orderTypes';
import type { TListing, TObject } from '@utils/types';

import { BookerDraftOrderPageActions } from '../../BookerDraftOrderPage.slice';
import Toolbar from '../../components/Toolbar/Toolbar';
import {
  BookerSelectRestaurantActions,
  BookerSelectRestaurantThunks,
} from '../BookerSelectRestaurant.slice';

import css from '../BookerSelectRestaurant.module.scss';

export const useGetCalendarExtraResources = ({
  order,
  startDate,
  endDate,
}: {
  order: TListing | null;
  startDate: Date;
  endDate: Date;
}) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { orderId } = router.query;

  const [isApplyingOtherDays, setIsApplyingOtherDays] = useState(false);

  const fetchOrderInProgress = useAppSelector(
    (state) => state.Order.fetchOrderInProgress,
  );
  const orderDetail = useAppSelector(
    (state) => state.Order.orderDetail,
    shallowEqual,
  );

  const fetchOrderDetailInProgress = useAppSelector(
    (state) => state.Order.fetchOrderDetailInProgress,
  );
  const planDetail = useAppSelector(
    (state) => state.BookerSelectRestaurant.planDetail,
  );
  const updatePlanDetailInprogress = useAppSelector(
    (state) => state.Order.updateOrderDetailInProgress,
  );
  const selectedDate = useAppSelector(
    (state) => state.BookerDraftOrderPage.selectedCalendarDate,
  );
  const onRescommendRestaurantForSpecificDateInProgress = useAppSelector(
    (state) => state.Order.onRescommendRestaurantForSpecificDateInProgress,
  );

  const orderData = Listing(order as TListing);
  const planId = orderData.getMetadata().plans?.[0];
  const { dayInWeek = [], deliveryHour, companyId } = orderData.getMetadata();

  const onSearchRestaurant = useCallback(
    (date: Date) => {
      router.push(
        `/company/booker/orders/draft/${orderId}/restaurants?timestamp=${date.getTime()}&deliveryHour=${deliveryHour}`,
      );
    },
    [orderId, router],
  );

  const onApplyOtherDays = useCallback(
    async (date: string, selectedDates: string[]) => {
      if (selectedDates.length === 0) {
        return;
      }

      setIsApplyingOtherDays(true);

      try {
        const totalDates = renderDateRange(
          startDate.getTime(),
          endDate.getTime(),
        );

        const timestampsToFetch = totalDates.filter((curr) =>
          selectedDates.includes(
            convertWeekDay(DateTime.fromMillis(curr).weekday).key,
          ),
        );

        const newOrderId = Array.isArray(orderId) ? orderId[0] : orderId;

        const fetchedData = await Promise.all(
          timestampsToFetch.map((timestamp) =>
            dispatch(
              BookerSelectRestaurantThunks.fetchFoodsByRestaurantAndTimestamp({
                restaurantId: orderDetail?.[date]?.restaurant?.id,
                timestamp,
                orderId: newOrderId ?? '',
              }),
            ),
          ),
        );

        const isCompanyAllowDualSelection = getIsAllowAddSecondaryFood(
          order as TListing,
        );

        const newOrderDetail = totalDates.reduce((result, curr) => {
          if (
            selectedDates.includes(
              convertWeekDay(DateTime.fromMillis(curr).weekday).key,
            )
          ) {
            const fetchedDataForTimestamp = fetchedData.find(
              (data) => data.meta.arg.timestamp === curr,
            );

            if (fetchedDataForTimestamp) {
              const combinedFoods = (fetchedDataForTimestamp?.payload as any)
                ?.foodsByRestaurantAndTimestamp;

              const foodList = combinedFoods?.reduce(
                (foodResult: TFoodList, food: TFoodInRestaurant) => {
                  foodResult[food.foodId] = {
                    foodName: food.foodName,
                    foodPrice: food.price,
                    foodPartnerPrice: food.partnerPrice,
                    foodUnit: food.foodUnit,
                    numberOfMainDishes: food?.numberOfMainDishes || 2,
                  };

                  return foodResult;
                },
                {},
              );

              // Adjust the food list price if the company is allowed to add a second food
              const adjustedFoodList = isCompanyAllowDualSelection
                ? adjustFoodListPrice(foodList, order as TListing)
                : foodList;

              return {
                ...result,
                [curr]: {
                  ...orderDetail?.[date],
                  restaurant: {
                    ...orderDetail?.[date]?.restaurant,
                    foodList: adjustedFoodList,
                  },
                },
              };
            }
          }

          return result;
        }, orderDetail);

        await dispatch(
          orderAsyncActions.updatePlanDetail({
            orderId,
            planId,
            orderDetail: newOrderDetail,
          }),
        );
      } catch (error) {
        toast.error(
          'Xin lỗi, đã có sự cố. Vui lòng thử tải lại trang hoặc liên hệ với chúng tôi để được hỗ trợ.',
        );
      } finally {
        setIsApplyingOtherDays(false);
      }
    },
    [startDate, endDate, orderDetail, dispatch, orderId, planId, companyId],
  );

  const onRecommendRestaurantForSpecificDay = useCallback(
    async (date: number) => {
      dispatch(
        BookerDraftOrderPageActions.selectCalendarDate(
          DateTime.fromMillis(date).toJSDate(),
        ),
      );
      const { payload } = await dispatch(
        orderAsyncActions.recommendRestaurantForSpecificDay({
          dateTime: date,
        }),
      );
      const newPlanDetail = {
        ...planDetail,
        attributes: {
          ...planDetail?.attributes,
          metadata: {
            ...planDetail?.attributes.metadata,
            orderDetail: (payload as TObject)?.orderDetail,
          },
        },
      };
      dispatch(BookerSelectRestaurantActions.setPlanDetail(newPlanDetail));
    },
    [dispatch, JSON.stringify(planDetail)],
  );

  const onRecommendRestaurantForSpecificDayInProgress = useCallback(
    (timestamp: number) => {
      return (
        onRescommendRestaurantForSpecificDateInProgress &&
        selectedDate?.getTime() === timestamp
      );
    },
    [onRescommendRestaurantForSpecificDateInProgress, selectedDate],
  );

  const calendarExtraResources = useMemo(() => {
    return {
      planId,
      startDate,
      endDate,
      updatePlanDetailInprogress,
      fetchPlanDetailInProgress:
        fetchOrderDetailInProgress || fetchOrderInProgress,
      onSearchRestaurant,
      dayInWeek,
      onApplyOtherDays,
      onRecommendRestaurantForSpecificDay,
      onRecommendRestaurantForSpecificDayInProgress,
      onApplyOtherDaysInProgress: isApplyingOtherDays,
    };
  }, [
    planId,
    endDate,
    fetchOrderDetailInProgress,
    fetchOrderInProgress,
    startDate,
    updatePlanDetailInprogress,
    onSearchRestaurant,
    dayInWeek,
    onApplyOtherDays,
    onRecommendRestaurantForSpecificDay,
    onRecommendRestaurantForSpecificDayInProgress,
    isApplyingOtherDays,
  ]);

  return calendarExtraResources;
};

export const useGetCalendarComponentProps = ({
  startDate,
  endDate,
  isFinishOrderDisabled,
  handleFinishOrder,
  order,
  shouldHideDayItems = false,
  shouldHideExtraActionBtn = false,
}: {
  startDate: Date;
  endDate: Date;
  isFinishOrderDisabled: boolean;
  handleFinishOrder: () => Promise<void>;
  order: TListing | null;
  shouldHideDayItems: boolean;
  shouldHideExtraActionBtn?: boolean;
  deliveryHour?: string;
}) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const publishOrderInProgress = useAppSelector(
    (state) => state.Order.publishOrderInProgress,
  );
  const onRecommendRestaurantInProgress = useAppSelector(
    (state) => state.Order.onRecommendRestaurantInProgress,
  );
  const isAllDatesHaveNoRestaurantsCurrentOrder = useAppSelector(
    (state) => state.Order.isAllDatesHaveNoRestaurants,
  );

  const { isMobileLayout } = useViewport();

  const { orderId } = router.query;
  const { plans = [] } = Listing(order).getMetadata();
  const handleAddMeal = useCallback(
    () => (date: Date) => {
      router.push(
        `/company/booker/orders/draft/${orderId}/restaurants?timestamp=${date.getTime()}`,
      );
    },
    [orderId, router],
  );

  const toastOrderSuccessfullyCreated = () => {
    dispatch(
      BookerDraftOrderPageActions.setToastShowedAfterSuccessfullyCreatingOrder(
        false,
      ),
    );

    const toastOptions = {
      autoClose: 5000,
      hideProgressBar: true,
      icon: <IconCheckWithBackground className={css.toastIcon} />,
      className: css.toastContainer,
    } as any;

    if (isMobileLayout) {
      toastOptions.position = toast.POSITION.BOTTOM_CENTER;
      toastOptions.style = { bottom: '80px' };
    }

    toast.success(
      <p>
        <b>Thực đơn cho tuần ăn đã được gợi ý.</b>
        <br />
        <span style={{ fontSize: 12 }}>
          Bạn có thể bấm <b>Tiếp tục</b> hoặc tuỳ chỉnh thực đơn cho từng ngày.
        </span>
      </p>,
      toastOptions,
    );
  };

  const onRecommendNewRestaurants = useCallback(async () => {
    if (!onRecommendRestaurantInProgress) {
      dispatch(setOnRecommendRestaurantInProcess(true));
      const { payload: recommendOrderDetail }: any = await dispatch(
        orderAsyncActions.recommendRestaurants({}),
      );

      const isAllDatesHaveNoRestaurants = Object.values(
        recommendOrderDetail || {},
      ).every(({ hasNoRestaurants = false }: any) => hasNoRestaurants);

      const isShowToastAfterSuccessfullyCreatingOrder =
        isAllDatesHaveNoRestaurantsCurrentOrder && !isAllDatesHaveNoRestaurants;

      await dispatch(
        orderAsyncActions.updatePlanDetail({
          orderId,
          planId: plans[0],
          orderDetail: recommendOrderDetail,
        }),
      );
      dispatch(setOnRecommendRestaurantInProcess(false));

      if (isShowToastAfterSuccessfullyCreatingOrder) {
        toastOrderSuccessfullyCreated();
      }
    }
  }, [dispatch, onRecommendRestaurantInProgress, orderId, plans]);

  const toolbarComponent = useCallback(
    (props: any) => (
      <Toolbar
        {...props}
        startDate={startDate.getTime()}
        endDate={endDate.getTime()}
        finishDisabled={isFinishOrderDisabled}
        finishInProgress={publishOrderInProgress}
        onFinishOrder={handleFinishOrder}
        onRecommendRestaurantInProgress={onRecommendRestaurantInProgress}
        onRecommendNewRestaurants={onRecommendNewRestaurants}
        shouldHideExtraActionBtn={shouldHideExtraActionBtn}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      startDate,
      endDate,
      isFinishOrderDisabled,
      publishOrderInProgress,
      onRecommendRestaurantInProgress,
    ],
  );

  const contentEndComponent = useCallback(
    (props: any) => (
      <AddMorePlan
        {...props}
        onClick={handleAddMeal()}
        startDate={props?.resources?.startDate?.getTime()}
        endDate={props?.resources?.endDate?.getTime()}
        loading={props?.resources?.fetchPlanDetailInProgress}
      />
    ),
    [handleAddMeal],
  );

  const componentsProps = useMemo(() => {
    return {
      toolbar: toolbarComponent,
      contentEnd: contentEndComponent,
    };
  }, [shouldHideDayItems, toolbarComponent, contentEndComponent]);

  return componentsProps;
};
