import React from 'react';
import { useIntl } from 'react-intl';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import type { TEventStatus } from '@components/CalendarDashboard/helpers/types';
import { useIsSubOrderProcessing } from '@hooks/useIsSubOrderProcessing';
import { ETransition } from '@src/utils/transaction';

import { EVENT_STATUS } from '../../helpers/constant';

import css from './OrderEventCard.module.scss';

type TOrderEventCardStatusProps = {
  status: TEventStatus;
  className?: string;
  lastTransition: string;
  isFoodPicked: boolean;
  /** With subOrderDate, shows the pending state while the pick is queued. */
  planId?: string;
  subOrderDate?: string | number;
};

const StatusToBadgeTypeMap = {
  [EVENT_STATUS.EMPTY_STATUS]: EBadgeType.warning,
  [EVENT_STATUS.JOINED_STATUS]: EBadgeType.success,
  [EVENT_STATUS.NOT_JOINED_STATUS]: EBadgeType.info,
  [EVENT_STATUS.EXPIRED_STATUS]: EBadgeType.info,
  [EVENT_STATUS.CANCELED_STATUS]: EBadgeType.danger,

  [ETransition.INITIATE_TRANSACTION]: EBadgeType.info,
  [ETransition.PARTNER_CONFIRM_SUB_ORDER]: EBadgeType.info,
  [ETransition.PARTNER_REJECT_SUB_ORDER]: EBadgeType.info,
  [ETransition.START_DELIVERY]: EBadgeType.info,
  [ETransition.COMPLETE_DELIVERY]: EBadgeType.success,
  [ETransition.EXPIRED_START_DELIVERY]: EBadgeType.info,
  [ETransition.CANCEL_DELIVERY]: EBadgeType.danger,
  [ETransition.OPERATOR_CANCEL_PLAN]: EBadgeType.danger,
  [ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED]: EBadgeType.danger,
  [ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED]: EBadgeType.danger,
  [ETransition.EXPIRED_REVIEW_TIME]: EBadgeType.success,
};

const txStateToLabelMapper = (lastTransition: string) => {
  switch (lastTransition) {
    case ETransition.INITIATE_TRANSACTION:
    case ETransition.PARTNER_CONFIRM_SUB_ORDER:
    case ETransition.PARTNER_REJECT_SUB_ORDER:
      return 'StateItemToolTip.initialTx';
    case ETransition.START_DELIVERY:
      return 'StateItemToolTip.stateDelivering';
    case ETransition.COMPLETE_DELIVERY:
      return 'StateItemToolTip.stateDelivered';
    case ETransition.EXPIRED_START_DELIVERY:
      return 'StateItemToolTip.expire';
    case ETransition.CANCEL_DELIVERY:
      return 'StateItemToolTip.stateCanceled';
    case ETransition.OPERATOR_CANCEL_PLAN:
    case ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED:
    case ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED:
      return 'StateItemToolTip.stateSubOrderCanceled';

    default:
      return 'StateItemToolTip.stateDelivered';
  }
};
const OrderEventCardStatus: React.FC<TOrderEventCardStatusProps> = ({
  status,
  isFoodPicked,
  lastTransition,
  planId,
  subOrderDate,
}) => {
  const intl = useIntl();
  const isProcessing = useIsSubOrderProcessing(planId, subOrderDate);

  let extendStatusData = null;

  if (isProcessing) {
    extendStatusData = {
      type: EBadgeType.warning,
      label: intl.formatMessage({ id: 'OrderEventCardStatus.processing' }),
    };
  } else if (!!lastTransition && !isFoodPicked) {
    extendStatusData = {
      type: EBadgeType.default,
      label: intl.formatMessage({ id: 'OrderEventCardStatus.notPicked' }),
    };
  }

  if (extendStatusData) {
    return (
      <>
        <Badge
          className={css.badge}
          type={extendStatusData.type}
          label={extendStatusData.label}
        />
      </>
    );
  }

  return (
    <>
      {lastTransition ? (
        <Badge
          className={css.badge}
          type={StatusToBadgeTypeMap[lastTransition]}
          label={intl.formatMessage({
            id: txStateToLabelMapper(lastTransition!),
          })}
        />
      ) : (
        <Badge
          className={css.badge}
          type={StatusToBadgeTypeMap[status]}
          label={intl.formatMessage({
            id: `DayColumn.Status.${status || 'empty'}`,
          })}
        />
      )}
    </>
  );
};

export default OrderEventCardStatus;
