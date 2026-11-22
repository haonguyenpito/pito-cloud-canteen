import { useState } from 'react';
import { useIntl } from 'react-intl';

import Button from '@components/Button/Button';
import { EVENT_STATUS } from '@components/CalendarDashboard/helpers/constant';
import { useAppSelector } from '@hooks/reduxHooks';

import css from './DishSelectionForm.module.scss';

type TDishSelectionFormProps = {
  onNavigateToOrderDetail: () => void;
  onReject: () => void;
  actionsDisabled: boolean;
  subOrderStatus?: string;
  onPickForMe: () => void;
  pickForMeInProgress?: boolean;
};

const DishSelectionForm: React.FC<TDishSelectionFormProps> = ({
  onNavigateToOrderDetail,
  onReject,
  actionsDisabled = false,
  subOrderStatus = EVENT_STATUS.EMPTY_STATUS,
  onPickForMe,
  pickForMeInProgress,
}) => {
  const intl = useIntl();
  const [clickedType, setClickedType] = useState<
    'reject' | 'submit' | undefined
  >(undefined);

  const { updateOrderError, updateOrderInProgress } = useAppSelector(
    (state) => state.ParticipantOrderManagementPage,
  );

  const updateSubOrderInProgress = useAppSelector(
    (state) => state.ParticipantOrderList.updateSubOrderInProgress,
  );

  const handleReject = () => {
    setClickedType('reject');
    onReject();
  };

  const handlePickForMe = () => {
    onPickForMe();
  };

  const disabledRejectButton =
    actionsDisabled ||
    updateOrderInProgress ||
    updateOrderError ||
    subOrderStatus === EVENT_STATUS.NOT_JOINED_STATUS;

  const rejectSubmitting =
    clickedType === 'reject' &&
    (updateOrderInProgress || updateSubOrderInProgress);
  const confirmSubmitting =
    clickedType === 'submit' &&
    (updateOrderInProgress || updateSubOrderInProgress);

  return (
    <>
      <div className={css.sectionWrapper}>
        <Button
          className={css.btn}
          onClick={onNavigateToOrderDetail}
          disabled={actionsDisabled}
          inProgress={confirmSubmitting}>
          {intl.formatMessage({
            id:
              subOrderStatus === EVENT_STATUS.JOINED_STATUS
                ? 'DishSelectionForm.pickOtherChoose'
                : 'EventCard.form.selectFood',
          })}
        </Button>
        <Button
          className={css.btn}
          variant="secondary"
          type="button"
          onClick={handlePickForMe}
          // Pick-for-me only fills a date that has no choice yet.
          disabled={
            actionsDisabled || subOrderStatus !== EVENT_STATUS.EMPTY_STATUS
          }
          inProgress={pickForMeInProgress}>
          {intl.formatMessage({
            id: 'DishSelectionForm.pickForMe',
          })}
        </Button>
      </div>
      <Button
        className={css.btnReject}
        variant="inline"
        type="button"
        onClick={handleReject}
        disabled={disabledRejectButton}
        inProgress={rejectSubmitting}>
        <span>
          {intl.formatMessage({
            id: 'DishSelectionForm.reject',
          })}
        </span>
      </Button>
    </>
  );
};

export default DishSelectionForm;
