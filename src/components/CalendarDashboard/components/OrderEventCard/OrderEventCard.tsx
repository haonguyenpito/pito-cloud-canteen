import type { Event } from 'react-big-calendar';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';

import Button from '@components/Button/Button';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import Tooltip from '@components/Tooltip/Tooltip';
import { useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { useViewport } from '@hooks/useViewport';
import { buildParticipantSubOrderDocumentId } from '@pages/api/participants/document/document.service';
import { isOver } from '@src/utils/dates';
import { EParticipantOrderStatus } from '@src/utils/enums';
import { ETransition } from '@src/utils/transaction';

import OrderEventCardContentItems from './OrderEventCardContentItems';
import OrderEventCardHeader from './OrderEventCardHeader';
import OrderEventCardPopup from './OrderEventCardPopup';
import OrderEventCardStatus from './OrderEventCardStatus';

import css from './OrderEventCard.module.scss';

export type TOrderEventCardProps = {
  event: Event;
  index: number;
  resources?: any;
};

const OrderEventCard: React.FC<TOrderEventCardProps> = ({
  event,
  resources,
}) => {
  const { isMobileLayout } = useViewport();
  const {
    openRatingSubOrderModal,
    setSelectedEvent,
    recommendFoodForSpecificSubOrder,
    pickFoodForSpecificSubOrderInProgress,
  } = resources || {};
  const {
    status,
    expiredTime,
    isOrderStarted = false,
    planId,
    orderId,
    timestamp,
    lastTransition,
  } = event.resource || {};

  const tooltipVisibleController = useBoolean();

  const isFoodPicked = !!event.resource?.dishSelection?.dishSelection;
  const isNotJoined = status === EParticipantOrderStatus.notJoined;
  const isExpired = isOver(expiredTime);
  const isExpiredAndNotPickedFood =
    !isFoodPicked && (isExpired || isOrderStarted) && !isNotJoined;

  const { orderColor } = event?.resource || {};
  const dotStyles = {
    backgroundColor: isExpiredAndNotPickedFood ? '#8C8C8C' : orderColor,
  };
  const cardStyles = {
    borderColor: isExpiredAndNotPickedFood ? '#8C8C8C' : orderColor,
  };
  const subOrderDocument = useAppSelector(
    (state) => state.ParticipantOrderList.subOrderDocument,
    shallowEqual,
  );

  const deliveredSubOrders = useAppSelector(
    (state) => state.ParticipantSubOrderList.deliveredSubOrders,
    shallowEqual,
  );
  const intl = useIntl();

  const fetchSubOrdersInProgress = useAppSelector(
    (state) => state.ParticipantSubOrderList.fetchSubOrdersInProgress,
    shallowEqual,
  );

  const fetchSubOrderTxInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.fetchSubOrderTxInProgress,
  );
  const fetchSubOrderDocumentInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.fetchSubOrderDocumentInProgress,
  );

  const handleOpenRatingModal = (options?: { forceNoTooltip?: boolean }) => {
    if (typeof openRatingSubOrderModal === 'function') {
      tooltipVisibleController.setFalse();
      openRatingSubOrderModal();
    }

    if (options?.forceNoTooltip) {
      setTimeout(() => tooltipVisibleController.setFalse());
    }
  };

  const onPickForMe = () => {
    recommendFoodForSpecificSubOrder({
      planId,
      orderId,
      subOrderDate: timestamp,
    });
  };

  const getRatingSectionByScope = (scope: 'card' | 'pop-up') => {
    if (!event?.resource?.dishSelection?.dishSelection) return null;

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
              onClick={() =>
                handleOpenRatingModal({
                  forceNoTooltip: true,
                })
              }>
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
                variant="primary"
                fullWidth
                className={css.ratingBtn}
                onClick={() => {
                  handleOpenRatingModal({
                    forceNoTooltip: true,
                  });
                }}>
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
        timestamp,
      );

      return subOrderId === subOrder.id;
    });
    const { reviewId } =
      scope === 'card' ? deliveriedSubOrder || {} : subOrderDocument || {};

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

  return (
    <Tooltip
      overlayClassName={css.tooltipOverlay}
      visible={tooltipVisibleController.value}
      tooltipContent={
        tooltipVisibleController.value && (
          <OrderEventCardPopup
            event={event}
            status={status}
            isExpired={isExpired}
            lastTransition={lastTransition}
            ratingSection={getRatingSectionByScope('pop-up')}
            onCloseEventCardPopup={tooltipVisibleController.setFalse}
            onPickForMe={onPickForMe}
            pickFoodForSpecificSubOrderInProgress={
              pickFoodForSpecificSubOrderInProgress
            }
          />
        )
      }
      onVisibleChange={(visible) => {
        if (visible) {
          if (typeof setSelectedEvent === 'function') setSelectedEvent(event);
        }
        tooltipVisibleController.setValue(visible);
      }}
      placement="rightTop"
      trigger={isMobileLayout ? '' : 'click'}
      overlayInnerStyle={{ backgroundColor: '#fff' }}>
      <div>
        <div
          className={classNames(css.root, {
            [css.rootExpired]: isExpiredAndNotPickedFood,
          })}
          style={cardStyles}>
          <OrderEventCardHeader event={event} />
          <div className={css.eventCardContentWrapper}>
            <OrderEventCardStatus
              isFoodPicked={isFoodPicked}
              className={css.cardStatus}
              status={status}
              lastTransition={lastTransition}
              planId={planId}
              subOrderDate={timestamp}
            />
            <div className={css.orderEventCardContentItems}>
              <OrderEventCardContentItems
                event={event}
                classNameCoverImage={css.coverImage}
                isFirstHighlight={status === EParticipantOrderStatus.empty}
              />
            </div>

            {getRatingSectionByScope('card')}
          </div>
        </div>
        <div className={css.dot} style={dotStyles}></div>
      </div>
    </Tooltip>
  );
};

export default OrderEventCard;
