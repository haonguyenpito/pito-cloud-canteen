import React from 'react';
import type { Event } from 'react-big-calendar';
import { useIntl } from 'react-intl';
import isEmpty from 'lodash/isEmpty';
import { useRouter } from 'next/router';

import RenderWhen from '@components/RenderWhen/RenderWhen';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { OrderListThunks } from '@pages/participant/orders/OrderList.slice';
import { participantOrderManagementThunks } from '@redux/slices/ParticipantOrderManagementPage.slice';
import { currentUserSelector } from '@redux/slices/user.slice';
import { participantPaths } from '@src/paths';
import { EOrderStates, EParticipantOrderStatus } from '@src/utils/enums';
import { CurrentUser } from '@utils/data';

import type { TEventStatus } from '../../helpers/types';

import DishSelectionForm from './DishSelectionForm';
import OrderEventCardContentItems from './OrderEventCardContentItems';
import OrderEventCardStatus from './OrderEventCardStatus';

import css from './OrderEventCardPopup.module.scss';

type TOrderEventCardPopupProps = {
  event: Event;
  status: TEventStatus;
  isExpired: boolean;
  lastTransition: string;
  onCloseEventCardPopup: () => void;
  onPickForMe: () => void;
  pickFoodForSpecificSubOrderInProgress?: boolean;
  ratingSection: React.ReactNode;
};

const OrderEventCardPopup: React.FC<TOrderEventCardPopupProps> = ({
  event,
  status,
  isExpired = false,
  lastTransition,
  onCloseEventCardPopup,
  onPickForMe,
  pickFoodForSpecificSubOrderInProgress,
  ratingSection,
}) => {
  const router = useRouter();
  const intl = useIntl();
  const user = useAppSelector(currentUserSelector);
  const dispatch = useAppDispatch();

  const {
    orderId,
    subOrderId: planId,
    id: orderDay,
    transactionId,
    daySession,
    deliveryHour: startTime,
    isOrderStarted = false,
    orderState,
  } = event.resource;
  const isOrderCancelled = orderState === EOrderStates.canceled;
  const isOrderPicking = orderState === EOrderStates.picking;

  const shouldShowPickFoodSection =
    (!isOrderStarted || isOrderPicking) &&
    !isExpired &&
    isEmpty(transactionId) &&
    !isOrderCancelled;
  const timestamp =
    orderDay.split(' - ').length > 1 ? orderDay.split(' - ')[1] : orderDay;
  const from =
    router.pathname === participantPaths.OrderList
      ? 'orderList'
      : 'orderDetail';

  const onNavigateToOrderDetail = () => {
    router.push({
      pathname: participantPaths.PlanDetail,
      query: { orderDay: timestamp as string, planId, from },
    });
  };

  const onRejectDish = async () => {
    const currentUserId = CurrentUser(user).getId();
    const payload = {
      updateValues: {
        orderId,
        orderDay: timestamp,
        planId,
        memberOrders: {
          [currentUserId]: {
            status: EParticipantOrderStatus.notJoined,
            foodId: '',
          },
        },
      },
      orderId,
    };

    if (from === 'orderList') {
      await dispatch(OrderListThunks.updateSubOrder(payload));
    } else {
      await dispatch(participantOrderManagementThunks.updateOrder(payload));
    }
    dispatch(
      OrderListThunks.addSubOrderDocumentToFirebase({
        participantId: currentUserId,
        planId,
        timestamp: parseInt(`${timestamp}`, 10),
      }),
    );
    onCloseEventCardPopup();
  };

  const handlePickForMe = () => {
    if (status !== EParticipantOrderStatus.empty) return;

    onPickForMe();
  };

  return (
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.title}>
          {intl.formatMessage({ id: `DayColumn.Session.${daySession}` })}
        </div>
      </div>
      <div className={css.cardStatus}>
        <OrderEventCardStatus
          isFoodPicked={!!event.resource?.dishSelection?.dishSelection}
          status={status}
          lastTransition={lastTransition}
          planId={planId}
          subOrderDate={timestamp}
        />
      </div>
      <div className={css.mealType}>
        <span className={css.regularText}>#{event.title}</span> |{' '}
        {intl.formatMessage({ id: 'EventCard.PCC' })}
      </div>
      <div className={css.eventTime}>{startTime}</div>
      <div className={css.divider} />
      <OrderEventCardContentItems
        event={event}
        classNameCoverImage={css.coverImage}
      />
      <RenderWhen condition={status !== undefined && shouldShowPickFoodSection}>
        <div className={css.divider} />
        <div className={css.selectFoodForm}>
          <div className={css.selectDishContent}>
            <DishSelectionForm
              onNavigateToOrderDetail={onNavigateToOrderDetail}
              actionsDisabled={isExpired}
              onReject={onRejectDish}
              subOrderStatus={status}
              onPickForMe={handlePickForMe}
              pickForMeInProgress={pickFoodForSpecificSubOrderInProgress}
            />
          </div>
        </div>
      </RenderWhen>
      {ratingSection}
    </div>
  );
};

export default OrderEventCardPopup;
