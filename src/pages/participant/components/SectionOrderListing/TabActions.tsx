import { FormattedMessage } from 'react-intl';
import classNames from 'classnames';

import Button from '@components/Button/Button';
import IconBanned from '@components/Icons/IconBanned/IconBanned';
import IconRefreshing from '@components/Icons/IconRefreshing/IconRefreshing';
import Tracker from '@helpers/tracker';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { ParticipantPlanThunks } from '@pages/participant/plans/[planId]/ParticipantPlanPage.slice';
import { shoppingCartThunks } from '@redux/slices/shoppingCart.slice';

import css from './SectionOrderListing.module.scss';

type TTabActionsProps = {
  className?: string;
  planId: string;
  orderId: string;
  orderDay: string;
  isOrderDeadlineOver: boolean;
  onAddedToCart?: ({
    foodName,
    timestamp,
  }: {
    foodName?: string;
    timestamp: string;
  }) => void;
};

const TabActions: React.FC<TTabActionsProps> = ({
  className,
  planId,
  orderId,
  orderDay,
  isOrderDeadlineOver,
  onAddedToCart,
}) => {
  const dispatch = useAppDispatch();
  // Locked from "Đặt món" until the queued pick is written.
  const submitDataInprogress = useAppSelector(
    (state) => state.ParticipantPlanPage.submitDataInprogress,
  );
  const actionDisabled = isOrderDeadlineOver || submitDataInprogress;

  const handleAutoSelect = () => {
    Tracker.track('participant:food:randomly-suggest', {
      orderId,
      timestamp: +orderDay,
    });

    dispatch(ParticipantPlanThunks.recommendFoodSubOrder(orderDay))
      .unwrap()
      .then((data) => {
        onAddedToCart?.({ foodName: data.foodName, timestamp: orderDay });
      });
  };

  const handleNotJoinDay = () => {
    Tracker.track('participant:food:ignore', {
      orderId,
      timestamp: +orderDay,
    });
    dispatch(
      shoppingCartThunks.addToCart({
        planId,
        dayId: orderDay,
        mealId: 'notJoined',
      }),
    );
    onAddedToCart?.({ timestamp: orderDay });
  };

  return (
    <div className={classNames(css.tabActions, className)}>
      <Button
        variant="secondary"
        disabled={actionDisabled}
        onClick={handleAutoSelect}
        className={css.autoSelect}>
        <IconRefreshing className={css.iconRefresh} />
        <p className="one-line-text">
          &nbsp;&nbsp;
          <FormattedMessage id="SectionOrderListing.selectForMeBtn" />
        </p>
      </Button>
      <Button
        variant="secondary"
        disabled={actionDisabled}
        onClick={handleNotJoinDay}
        className={css.notJoinThisDay}>
        <IconBanned className={css.iconNotJoined} />
        <p className="one-line-text">
          &nbsp;&nbsp;
          <FormattedMessage id="SectionOrderListing.notJoinThisDay" />
        </p>
      </Button>
    </div>
  );
};

export default TabActions;
