/* eslint-disable prettier/prettier */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { toast } from 'react-toastify';
import classNames from 'classnames';
import isEmpty from 'lodash/isEmpty';
import { ShoppingCartIcon } from 'lucide-react';
import type { Duration } from 'luxon';
import { DateTime } from 'luxon';
import { useRouter } from 'next/router';

import Button from '@components/Button/Button';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import IconArrowFull from '@components/Icons/IconArrow/IconArrowFull';
import ParticipantLayout from '@components/ParticipantLayout/ParticipantLayout';
import { prepareOrderDeadline } from '@helpers/order/prepareDataHelper';
import {
  getIsAllowAddSecondaryFood,
  isOrderOverDeadline,
} from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { useViewport } from '@hooks/useViewport';
import { totalFoodPickedWithParticipant } from '@pages/participant/helpers';
import { UIActions } from '@redux/slices/UI.slice';
import type { RootState } from '@redux/store';
import { participantPaths } from '@src/paths';
import { formatTimestamp } from '@src/utils/dates';
import { EOrderType } from '@src/utils/enums';
import { Listing } from '@utils/data';

import SectionCountdown from '../../components/SectionCountdown/SectionCountdown';
import SectionOrderListing from '../../components/SectionOrderListing/SectionOrderListing';
import TabActions from '../../components/SectionOrderListing/TabActions';
import SectionOrderPanel from '../../components/SectionOrderPanel/SectionOrderPanel';
import SectionRestaurantHero from '../../components/SectionRestaurantHero/SectionRestaurantHero';

import { useLoadData } from './hooks/loadData';
import { useSelectRestaurant } from './hooks/restaurant';

import css from './ParticipantPlan.module.scss';

const stopTime = { days: 0, hours: 0, minutes: 0, seconds: 0 };

const ParticipantPlan = () => {
  const intl = useIntl();
  const infoSectionController = useBoolean();
  const dispatch = useAppDispatch();
  const [diffTime, setDiffTime] = useState<Duration | null>(null);
  const router = useRouter();
  const isRouterReady = router.isReady;
  const { planId, from = 'orderList' } = router.query;
  const { isMobileLayout } = useViewport();

  const { loadDataInProgress, order, plan } = useLoadData();
  const { orderDayState, selectedRestaurant, handleSelectRestaurant } =
    useSelectRestaurant();

  const cartList = useAppSelector((state: RootState) => {
    const { currentUser } = state.user;
    const currUserId = currentUser?.id?.uuid;

    return state.shoppingCart.orders?.[currUserId]?.[(planId as string) || 1];
  });
  const orderId = order?.id?.uuid;

  const orderDays = Object.keys(plan);

  const {
    deadlineDate = Date.now(),
    deadlineHour,
    orderType = EOrderType.group,
  } = Listing(order).getMetadata();
  const isAllowAddSecondaryFood = getIsAllowAddSecondaryFood(order);
  const isGroupOrder = orderType === EOrderType.group;
  const isOrderDeadlineOver = isOrderOverDeadline(order);

  const orderDeadline = prepareOrderDeadline(deadlineDate, deadlineHour);

  const formattedTimeLeft = (
    diffTime === null
      ? DateTime.fromMillis(deadlineDate).diffNow()
      : (diffTime! as Duration)
  ).toFormat("d'd':h'h':mm'm':ss's'");
  const formattedDeadlineDate = DateTime.fromMillis(deadlineDate).toFormat(
    `HH:mm, dd '${intl.formatMessage({ id: 'thang' })}' MM, yyyy`,
  );

  const timeLeftText = intl.formatMessage(
    {
      id: 'ParticipantPlan.summary.timeLeft',
    },
    {
      timeLeft: <span className={css.timeLeftTime}>{formattedTimeLeft}</span>,
    },
  );

  const infoSectionClasses = classNames(css.infoSection, {
    [css.visible]: infoSectionController.value,
  });

  const showMobileInfoSection = () => {
    infoSectionController.setTrue();
  };
  const hideMobileInfoSection = () => {
    infoSectionController.setFalse();
  };

  useEffect(() => {
    if (isRouterReady && !loadDataInProgress && !isGroupOrder) {
      router.push(participantPaths.OrderList);
    }
  }, [isRouterReady, loadDataInProgress, isGroupOrder]);

  useEffect(() => {
    if (infoSectionController.value) {
      dispatch(UIActions.disableScrollRequest('Plan_InfoSection'));
    } else {
      dispatch(UIActions.disableScrollRemove('Plan_InfoSection'));
    }

    return () => {
      dispatch(UIActions.disableScrollRemove('Plan_InfoSection'));
    };
  }, [infoSectionController.value]);

  useEffect(() => {
    if (isEmpty(order)) {
      return;
    }
    const intervalId = setInterval(() => {
      let diffObj = DateTime.fromMillis(
        parseInt(`${deadlineDate}`, 10),
      ).diffNow(['day', 'hour', 'minute', 'second']);
      if (stopTime !== null) {
        if (
          diffObj.get('days') <= stopTime.days &&
          diffObj.get('hours') <= stopTime.hours &&
          diffObj.get('minutes') <= stopTime.minutes &&
          diffObj.get('seconds') <= stopTime.seconds
        ) {
          diffObj = diffObj.set({
            ...stopTime,
          });
          clearInterval(intervalId);
        }
      }
      setDiffTime(diffObj);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [deadlineDate, JSON.stringify(order)]);

  const handleGoBack = () => {
    if (!orderId) {
      return;
    }
    router.push({
      pathname:
        from === 'orderList'
          ? participantPaths.OrderList
          : participantPaths.Order,
      query: {
        ...(from === 'orderDetail' && { orderId }),
      },
    });
  };

  const getNextSubOrderDay = (dayId: string) => {
    const subOrderDates = Object.keys(plan);

    const dayIndex = subOrderDates.findIndex((item) => item === dayId);
    const firstDayIndexNotHaveDish = subOrderDates.findIndex(
      (item) => !cartList?.[+item]?.foodId,
    );
    const nextDayIndex =
      subOrderDates.length - 1 === dayIndex
        ? firstDayIndexNotHaveDish !== -1
          ? firstDayIndexNotHaveDish
          : dayIndex
        : dayIndex + 1;

    return (
      subOrderDates[nextDayIndex] || subOrderDates[firstDayIndexNotHaveDish]
    );
  };

  const scrollTimeoutRef = useRef<any | null>(null);

  const onAddedToCart = ({
    foodName,
    timestamp,
  }: {
    foodName?: string;
    timestamp: string;
  }) => {
    toast.success(
      foodName
        ? `${intl.formatMessage({
            id: 'da-them-mon',
          })} ${foodName} ${intl.formatMessage({
            id: 'cho-ngay',
          })} ${formatTimestamp(+timestamp)}`
        : `${intl.formatMessage({
            id: 'khong-chon-mon-cho-ngay',
          })} ${formatTimestamp(+timestamp)}`,
      {
        position: isMobileLayout ? 'top-center' : 'bottom-center',
        toastId: 'add-to-cart',
        updateId: 'add-to-cart',
        pauseOnHover: false,
        autoClose: 3000,
      },
    );

    scrollTimeoutRef.current = setTimeout(() => {
      const nextDate = getNextSubOrderDay(timestamp);
      handleSelectRestaurant({ id: nextDate });
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }, 1000);
  };
  const selectedDays = totalFoodPickedWithParticipant(
    orderDays,
    cartList,
    plan,
    isAllowAddSecondaryFood,
  );
  const isAllDaysHaveDishInCart = selectedDays === orderDays.length;

  const selectedDayDate =
    orderDayState && Number(orderDayState)
      ? DateTime.fromMillis(Number(orderDayState)).toJSDate()
      : null;
  const selectedDayLabel = selectedDayDate
    ? `${intl.formatMessage({
        id: `Calendar.week.dayHeader.${selectedDayDate.getDay()}`,
      })}, ${selectedDayDate.getDate()}/${selectedDayDate.getMonth() + 1}`
    : '';

  return (
    <ParticipantLayout>
      <div className={css.root}>
        {isMobileLayout && (
          <button
            type="button"
            className={css.cartCornerButton}
            onClick={showMobileInfoSection}>
            <ShoppingCartIcon className="w-4 h-4" />
            <span className={css.cartCornerBadge}>
              {selectedDays}/{orderDays.length}
            </span>
          </button>
        )}
        <div className={css.leftSection}>
          <div className={css.goBack} onClick={handleGoBack}>
            <IconArrow direction="left" />
            <span>
              {intl.formatMessage({
                id: 'booker.orders.draft.foodDetailModal.back',
              })}
            </span>
          </div>
          <SectionRestaurantHero
            listing={selectedRestaurant}
            orderDay={Number(orderDayState)}
            inProgress={loadDataInProgress}
          />
          <SectionOrderListing
            plan={plan}
            onSelectTab={handleSelectRestaurant}
            orderDay={`${orderDayState}`}
            onAddedToCart={onAddedToCart}
          />
        </div>
        <div className={css.rightSection}>
          <SectionCountdown orderDeadline={orderDeadline} />
          <SectionOrderPanel planId={`${planId}`} orderId={orderId} />
        </div>
        <div className={css.summarySection}>
          <div>
            <div className={css.timeLeft}>{timeLeftText}</div>
            <div className={css.orderEndAt}>
              {intl.formatMessage(
                { id: 'ParticipantPlan.summary.orderEndAt' },
                {
                  deadline: (
                    <span className={css.orderEndAtTime}>
                      {formattedDeadlineDate}
                    </span>
                  ),
                },
              )}
            </div>
            {selectedDayLabel && (
              <div className={css.currentDayText}>
                {intl.formatMessage({
                  id: 'ParticipantPlan.summary.currentDayText',
                })}
                <span className={css.currentDayHighlight}>
                  {selectedDayLabel}
                </span>
              </div>
            )}
          </div>
          {isAllDaysHaveDishInCart ? (
            <Button
              className={classNames(css.viewCartMobile, {
                [css.ctaBtn]: isAllDaysHaveDishInCart,
              })}
              onClick={showMobileInfoSection}>
              <div>
                {intl.formatMessage({ id: 'ParticipantPlan.summary.cart' })}
              </div>
              <div className={css.selections}>
                {intl.formatMessage(
                  { id: 'ParticipantPlan.summary.selections' },
                  {
                    selectedDays,
                    totalDays: orderDays.length,
                  },
                )}
              </div>
            </Button>
          ) : (
            <TabActions
              planId={`${planId}`}
              orderId={orderId}
              orderDay={`${orderDayState}`}
              isOrderDeadlineOver={isOrderDeadlineOver}
              onAddedToCart={onAddedToCart}
            />
          )}
        </div>

        <div className={infoSectionClasses}>
          <Button
            variant="inline"
            className={css.goBackBtn}
            onClick={hideMobileInfoSection}>
            <IconArrowFull />
            <FormattedMessage id="ParticipantPlan.goBackText" />
          </Button>
          <SectionCountdown orderDeadline={orderDeadline} />
          <SectionOrderPanel planId={`${planId}`} orderId={orderId} />
        </div>
      </div>
    </ParticipantLayout>
  );
};

export default ParticipantPlan;