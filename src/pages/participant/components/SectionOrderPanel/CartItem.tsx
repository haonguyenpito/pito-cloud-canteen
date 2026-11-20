import { useIntl } from 'react-intl';
import classNames from 'classnames';

import IconClose from '@components/Icons/IconClose/IconClose';
import IconRefreshing from '@components/Icons/IconRefreshing/IconRefreshing';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { ParticipantPlanThunks } from '@pages/participant/plans/[planId]/ParticipantPlanPage.slice';

import css from './CartItem.module.scss';

type TCartItemProps = {
  className?: string;
  label: string;
  value: string;
  removeDisabled?: boolean;
  subOrderDate?: string;
  onRemove: () => void;
  foodPosition?: 'first' | 'second';
  isProcessing?: boolean;
};

const CartItem: React.FC<TCartItemProps> = ({
  label,
  value,
  removeDisabled = false,
  subOrderDate,
  onRemove,
  foodPosition,
  isProcessing = false,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const isAllowAddSecondaryFood = useAppSelector(
    (state) => state.ParticipantPlanPage.isAllowAddSecondaryFood,
  );

  const handleAutoSelect = () => {
    dispatch(ParticipantPlanThunks.recommendFoodSubOrder(subOrderDate!));
  };

  const isFirstFoodSelected = foodPosition === 'first';

  return (
    <div
      className={classNames(
        'px-[18px]',
        isFirstFoodSelected
          ? 'border-t border-neutralGray3 pt-[10px] mt-[10px]'
          : '',
      )}>
      <div className={css.label}>
        <span className="flex items-center gap-2">
          {label && <span>{label}</span>}
        </span>
        {!removeDisabled && !isProcessing && (
          <IconClose onClick={onRemove} className={css.iconClose} />
        )}
      </div>
      {isProcessing && (
        <span className={css.processing} role="status">
          {intl.formatMessage({ id: 'OrderEventCardStatus.processing' })}
        </span>
      )}
      {isAllowAddSecondaryFood && (
        <div>
          {foodPosition === 'first' &&
            value !==
              intl.formatMessage({ id: 'SectionOrderPanel.notJoined' }) && (
              <span className="text-primaryPri2 text-xs font-medium">
                (Món 1)
              </span>
            )}
          {foodPosition === 'second' && value !== 'notJoined' && (
            <span className="text-sematicGreen2 text-xs font-medium">
              (Món 2)
            </span>
          )}
        </div>
      )}
      <div className={css.value}>
        <IconRefreshing className={css.icon} onClick={handleAutoSelect} />
        <span>{value}</span>
      </div>
    </div>
  );
};

export default CartItem;
