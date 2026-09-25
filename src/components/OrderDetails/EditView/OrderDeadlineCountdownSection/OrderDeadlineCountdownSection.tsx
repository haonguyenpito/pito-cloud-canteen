import { useState } from 'react';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { DateTime } from 'luxon';

import Button from '@components/Button/Button';
import CountdownTimer from '@components/CountdownTimer/CountdownTimer';
import IconEdit from '@components/Icons/IconEdit/IconEdit';
import { convertHHmmStringToTimeParts } from '@helpers/dateHelpers';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { orderManagementThunks } from '@redux/slices/OrderManagement.slice';
import { currentUserSelector } from '@redux/slices/user.slice';
import type { UserListing } from '@src/types';
import { formatTimestamp } from '@src/utils/dates';
import type { TDefaultProps } from '@utils/types';

import type { TEditOrderDeadlineFormValues } from './EditOrderDeadlineForm';
import EditOrderDeadlineModal from './EditOrderDeadlineModal';

import css from './OrderDeadlineCountdownSection.module.scss';

type TOrderDeadlineCountdownSectionProps = TDefaultProps & {
  data: {
    startDate: number;
    deadlineHour: string;
    orderDeadline: number;
  };
  ableToUpdateOrder: boolean;
  visibleOnMobile?: boolean;
  children?: React.ReactNode;
};

const OrderDeadlineCountdownSection: React.FC<
  TOrderDeadlineCountdownSectionProps
> = (props) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const currentUser: UserListing = useAppSelector(currentUserSelector);

  const [isEditOrderDeadlineModalOpen, setIsEditOrderDeadlineModalOpen] =
    useState(false);

  const {
    className,
    rootClassName,
    data: { startDate, deadlineHour, orderDeadline },
    ableToUpdateOrder,
    visibleOnMobile = false,
  } = props;
  const currentTime = new Date().getTime();
  const rootClasses = classNames(rootClassName || css.root, className, {
    [css.visibleOnMobile]: visibleOnMobile,
  });

  const disabledEditButton = currentUser?.attributes?.profile?.metadata?.isAdmin
    ? false // Admin can edit order deadline anytime
    : currentTime >= orderDeadline || !ableToUpdateOrder;
  const formattedDeadline = `${deadlineHour}, ${formatTimestamp(
    orderDeadline,
    "dd 'tháng' MM, yyyy",
  )}`;

  const sectionTitle = intl.formatMessage({
    id: 'OrderDeadlineCountdownSection.title',
  });
  const orderEndAtMessage = intl.formatMessage(
    {
      id: 'OrderDeadlineCountdownSection.orderEndAt',
    },
    {
      deadline: <b>{formattedDeadline}</b>,
    },
  );

  const handleClickEditIcon = () => {
    setIsEditOrderDeadlineModalOpen(true);
  };
  const handleCloseEditDeadlineModal = () => {
    setIsEditOrderDeadlineModalOpen(false);
  };

  const handleSubmitEditDeadline = (values: TEditOrderDeadlineFormValues) => {
    const {
      deadlineDate: deadlineDateFromSubmission,
      deadlineHour: deadlineHourFromSubmission,
    } = values;
    const parsedDeadlineDate = DateTime.fromMillis(deadlineDateFromSubmission)
      .startOf('day')
      .plus({ ...convertHHmmStringToTimeParts(deadlineHourFromSubmission) })
      .toMillis();

    const updateData = {
      deadlineDate: parsedDeadlineDate,
      deadlineHour: deadlineHourFromSubmission,
    };

    dispatch(orderManagementThunks.updateOrderGeneralInfo(updateData));
    setIsEditOrderDeadlineModalOpen(false);
  };

  return (
    <div className={rootClasses}>
      <div className={css.titleContainer}>
        <div className={css.title}>{sectionTitle}</div>
        <Button
          disabled={disabledEditButton}
          variant="inline"
          className={css.editDeadlineButton}
          onClick={handleClickEditIcon}>
          <IconEdit className={css.editIcon} />
        </Button>
      </div>

      <CountdownTimer deadline={orderDeadline} stopAt={0} />
      <div className={css.orderEndAtMessage}>{orderEndAtMessage}</div>

      {props?.children}
      <EditOrderDeadlineModal
        data={{
          orderDeadline,
          orderStartDate: startDate,
          orderDeadlineHour: deadlineHour,
        }}
        isOpen={isEditOrderDeadlineModalOpen}
        onClose={handleCloseEditDeadlineModal}
        onSubmit={handleSubmitEditDeadline}
      />
    </div>
  );
};

export default OrderDeadlineCountdownSection;
