import type { Event } from 'react-big-calendar';
import { FormattedMessage, useIntl } from 'react-intl';

import { EVENT_STATUS } from '@components/CalendarDashboard/helpers/constant';
import IconBanned from '@components/Icons/IconBanned/IconBanned';
import IconClockWithExclamation from '@components/Icons/IconClock/IconClockWithExclamation';
import IconDish from '@components/Icons/IconDish/IconDish';
import IconLocation from '@components/Icons/IconLocation/IconLocation';
import IconShop from '@components/Icons/IconShop/IconShop';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import ResponsiveImage from '@components/ResponsiveImage/ResponsiveImage';
import { Listing } from '@src/utils/data';
import { calculateRemainTime, isOver } from '@src/utils/dates';
import { EImageVariants, EParticipantOrderStatus } from '@src/utils/enums';
import { getDecorator } from '@src/utils/string';

import OrderEventCardContentItem from './OrderEventCardContentItem';

import css from './OrderEventCard.module.scss';

export type TEventCardContentProps = {
  event: Event;
  isFirstHighlight?: boolean;
  classNameCoverImage: string;
};

const EventCardContent: React.FC<TEventCardContentProps> = ({
  event,
  classNameCoverImage,
  isFirstHighlight,
}) => {
  const {
    restaurantAddress,
    restaurant: restaurantObj,
    expiredTime,
    isOrderStarted = false,
    foodName,
    secondaryFoodName,
    status,
    pickedFoodDetail,
  } = event?.resource || {};
  const intl = useIntl();

  const isExpired = isOver(expiredTime);
  const remainTime = calculateRemainTime(new Date(expiredTime).getTime());
  const shouldShowCountdown = !isExpired && !isOrderStarted;
  const shouldShowRejectButton = [EVENT_STATUS.NOT_JOINED_STATUS].includes(
    status,
  );

  const pickedFoodListing =
    pickedFoodDetail && pickedFoodDetail.id?.uuid
      ? Listing(pickedFoodDetail)
      : null;
  const image = pickedFoodListing
    ? pickedFoodListing.getImages()[0]
    : undefined;

  const showCoverImage = [EParticipantOrderStatus.joined].includes(status);
  const hasSecondaryFood =
    status === EParticipantOrderStatus.joined && !!secondaryFoodName;

  return (
    <>
      <RenderWhen condition={showCoverImage}>
        <div className={classNameCoverImage}>
          {pickedFoodListing?.getImages().length > 0 ? (
            <ResponsiveImage
              image={image}
              alt="foodPicked"
              variants={[EImageVariants.default]}
              emptyType="food"
            />
          ) : (
            <div className={css.decoratorWrapper}>
              <img
                src={getDecorator(pickedFoodListing?.getId())}
                alt=""
                className={css.decoratorImage}
              />
            </div>
          )}
        </div>
      </RenderWhen>

      <RenderWhen condition={status === EParticipantOrderStatus.joined}>
        <OrderEventCardContentItem icon={<IconDish />}>
          <span className="font-semibold">{foodName}</span>
        </OrderEventCardContentItem>

        <RenderWhen condition={hasSecondaryFood}>
          <OrderEventCardContentItem icon={<IconDish />}>
            <span className="font-semibold">{secondaryFoodName}</span>
          </OrderEventCardContentItem>
        </RenderWhen>
      </RenderWhen>

      <RenderWhen condition={shouldShowRejectButton}>
        <OrderEventCardContentItem icon={<IconBanned />}>
          <span>
            {intl.formatMessage({
              id: 'SectionOrderListing.unCheckThisDateButtonLabel',
            })}
          </span>
        </OrderEventCardContentItem>
      </RenderWhen>
      <RenderWhen condition={shouldShowCountdown}>
        <OrderEventCardContentItem
          icon={<IconClockWithExclamation />}
          isHighlight={isFirstHighlight}>
          <span>
            {intl.formatMessage({ id: 'con' })} {remainTime}{' '}
            {intl.formatMessage({ id: 'de-chon' })}
          </span>
        </OrderEventCardContentItem>
      </RenderWhen>
      {restaurantAddress && (
        <OrderEventCardContentItem icon={<IconLocation />}>
          <FormattedMessage
            id="EventCard.deliveryAddress"
            values={{
              address: restaurantAddress,
            }}
          />
        </OrderEventCardContentItem>
      )}
      <OrderEventCardContentItem icon={<IconShop />}>
        {restaurantObj.name}
      </OrderEventCardContentItem>
    </>
  );
};

export default EventCardContent;
