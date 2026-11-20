import type { Event } from 'react-big-calendar';
import { useIntl } from 'react-intl';
import last from 'lodash/last';

import OrderEventCardContentItems from '@components/CalendarDashboard/components/OrderEventCard/OrderEventCardContentItems';
import OrderEventCardStatus from '@components/CalendarDashboard/components/OrderEventCard/OrderEventCardStatus';
import { EVENT_STATUS } from '@components/CalendarDashboard/helpers/constant';
import { isOver } from '@src/utils/dates';
import { EParticipantOrderStatus } from '@src/utils/enums';

import css from './SubOrderCard.module.scss';

type TSubOrderCardProps = {
  event: Event;
  setSelectedEvent: (event: Event) => void;
  openSubOrderDetailModal: () => void;
  ratingSection: React.ReactNode;
  dateSection?: React.ReactNode;
};

const SubOrderCard: React.FC<TSubOrderCardProps> = (props) => {
  const {
    event,
    setSelectedEvent,
    ratingSection,
    openSubOrderDetailModal,
    dateSection,
  } = props;
  const intl = useIntl();
  const {
    daySession,
    deliveryHour,
    status,
    orderColor,
    lastTransition,
    subOrderId,
    id: orderDay,
  } = event?.resource || {};

  const orderTitle = event?.title || '';
  const isFoodPicked = !!event.resource?.dishSelection?.dishSelection;
  const isNotJoined = status === EVENT_STATUS.NOT_JOINED_STATUS;
  const isExpired = isOver(event.resource?.expiredTime);
  const isExpiredToPickFood = isExpired && !isFoodPicked && !isNotJoined;
  const headerStyles = {
    backgroundColor: isExpiredToPickFood ? '#8C8C8C' : orderColor,
  };
  const onCardClick = () => {
    setSelectedEvent(event);
    openSubOrderDetailModal();
  };

  return (
    <div className={css.container} onClick={onCardClick}>
      <div className={css.header} style={headerStyles}>
        <div className={css.row}>
          <div className={css.daySession}>
            {intl.formatMessage({ id: `DayColumn.Session.${daySession}` })}
          </div>
          <div className={css.orderHour}>
            {deliveryHour} {dateSection ? ` - ${dateSection}` : ''}
          </div>
        </div>
        <div>{`#${orderTitle}`}</div>
      </div>
      <div className={css.body}>
        <div className={css.row}>
          <OrderEventCardStatus
            isFoodPicked={!!event.resource?.dishSelection?.dishSelection}
            status={status}
            lastTransition={lastTransition}
            planId={subOrderId}
            subOrderDate={last(`${orderDay || ''}`.split(' - '))}
          />
        </div>
        <div className={css.orderInfo}>
          <OrderEventCardContentItems
            event={event}
            classNameCoverImage={css.coverImage}
            isFirstHighlight={status === EParticipantOrderStatus.empty}
          />
        </div>
        {ratingSection}
      </div>
    </div>
  );
};

export default SubOrderCard;
