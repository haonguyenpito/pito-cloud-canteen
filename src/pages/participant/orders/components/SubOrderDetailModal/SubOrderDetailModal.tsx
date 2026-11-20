/* eslint-disable react-hooks/exhaustive-deps */
import type { Event } from 'react-big-calendar';
import { useIntl } from 'react-intl';
import last from 'lodash/last';
import { useRouter } from 'next/router';

import DishSelectionForm from '@components/CalendarDashboard/components/OrderEventCard/DishSelectionForm';
import OrderEventCardContentItems from '@components/CalendarDashboard/components/OrderEventCard/OrderEventCardContentItems';
import OrderEventCardStatus from '@components/CalendarDashboard/components/OrderEventCard/OrderEventCardStatus';
import { EVENT_STATUS } from '@components/CalendarDashboard/helpers/constant';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import SlideModal from '@components/SlideModal/SlideModal';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { participantOrderManagementThunks } from '@redux/slices/ParticipantOrderManagementPage.slice';
import { currentUserSelector } from '@redux/slices/user.slice';
import { participantPaths } from '@src/paths';
import type { TUpdateParticipantOrderBody } from '@src/types/order';
import { CurrentUser } from '@src/utils/data';
import { isOver } from '@src/utils/dates';
import { EOrderStates, EParticipantOrderStatus } from '@src/utils/enums';

import { OrderListThunks } from '../../OrderList.slice';

import css from './SubOrderDetailModal.module.scss';

type TSubOrderDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  ratingSection: React.ReactNode;
  from: string;
  recommendFoodForSpecificSubOrder: (params: {
    planId: string;
    orderId: string;
    subOrderDate: string;
  }) => void;
  pickFoodForSpecificSubOrderInProgress?: boolean;
};

const SubOrderDetailModal: React.FC<TSubOrderDetailModalProps> = (props) => {
  const {
    isOpen,
    onClose,
    event,
    ratingSection,
    from,
    recommendFoodForSpecificSubOrder,
    pickFoodForSpecificSubOrderInProgress,
  } = props;
  const intl = useIntl();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const {
    orderId,
    subOrderId: planId,
    id: orderDay,
    status,
    expiredTime,
    daySession,
    deliveryHour: startTime,
    orderState,
    lastTransition,
  } = event.resource;
  const user = useAppSelector(currentUserSelector);

  const fetchSubOrderTxInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.fetchSubOrderTxInProgress,
  );
  const fetchSubOrderDocumentInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.fetchSubOrderDocumentInProgress,
  );

  const timestamp = last<string>(orderDay.split(' - '));

  const isExpired = isOver(expiredTime);
  const shouldShowPickFoodSection =
    !isExpired && orderState === EOrderStates.picking;

  const onNavigateToOrderDetail = () => {
    router.push({
      pathname: participantPaths.PlanDetail,
      query: { orderDay: timestamp as string, planId, from },
    });
  };

  const onPickForMe = () => {
    if (status !== EVENT_STATUS.EMPTY_STATUS) return;
    recommendFoodForSpecificSubOrder({
      planId,
      orderId,
      subOrderDate: timestamp!,
    });
  };

  const onRejectDish = async () => {
    const currentUserId = CurrentUser(user).getId();
    const updateValues: TUpdateParticipantOrderBody = {
      orderId,
      orderDay: last(orderDay.split(' - ')),
      planId,
      memberOrders: {
        [currentUserId]: {
          status: EParticipantOrderStatus.notJoined,
          foodId: '',
          requirement: '',
        },
      },
    };
    const payload = {
      updateValues,
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
    onClose();
  };

  return (
    <SlideModal
      id="SubOrderDetailModal"
      isOpen={isOpen}
      onClose={onClose}
      modalTitle={intl.formatMessage({ id: 'chi-tiet-don-hang' })}>
      <div className={css.root}>
        <div className={css.header}>
          <div className={css.title}>
            {intl.formatMessage({ id: `DayColumn.Session.${daySession}` })}
          </div>
          {status && (
            <OrderEventCardStatus
              isFoodPicked={!!event.resource?.dishSelection?.dishSelection}
              status={status}
              lastTransition={lastTransition}
              planId={planId}
              subOrderDate={timestamp}
            />
          )}
        </div>
        <div className={css.mealType}>
          <span className={css.regularText}>#{event.title}</span> |{' '}
          {intl.formatMessage({ id: 'EventCard.PCC' })}
        </div>
        <div className={css.eventTime}>{startTime}</div>
        <OrderEventCardContentItems
          event={event}
          isFirstHighlight
          classNameCoverImage={css.coverImage}
        />
        <RenderWhen condition={shouldShowPickFoodSection}>
          <RenderWhen
            condition={
              fetchSubOrderTxInProgress || fetchSubOrderDocumentInProgress
            }>
            <div className={css.loading}>Đang tải</div>
            <RenderWhen.False>
              <div className={css.divider} />
              <div className={css.selectFoodForm}>
                <div className={css.selectDishContent}>
                  <DishSelectionForm
                    onNavigateToOrderDetail={onNavigateToOrderDetail}
                    actionsDisabled={isExpired}
                    onReject={onRejectDish}
                    subOrderStatus={status}
                    onPickForMe={onPickForMe}
                    pickForMeInProgress={pickFoodForSpecificSubOrderInProgress}
                  />
                </div>
              </div>
            </RenderWhen.False>
          </RenderWhen>
        </RenderWhen>
        {ratingSection}
      </div>
    </SlideModal>
  );
};
export default SubOrderDetailModal;
