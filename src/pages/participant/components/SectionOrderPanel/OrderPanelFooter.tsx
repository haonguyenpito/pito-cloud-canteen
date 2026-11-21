import { useIntl } from 'react-intl';
import classNames from 'classnames';

import Button from '@components/Button/Button';
import { useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import { verifyAllFoodPickedWithParticipant } from '@pages/participant/helpers';
import type { TMemberPlan } from '@redux/slices/shoppingCart.slice';

import css from './SectionOrderPanel.module.scss';

type TOrderPanelFooter = {
  className?: string;
  submitDataInprogress?: boolean;
  isOrderDeadlineOver: boolean;
  handleSubmit: () => void;
  handleRemoveAllItem: () => void;
  cartListKeys?: string[];
  orderDetailIds: string[];
  cartList: TMemberPlan;
};

const OrderPanelFooter: React.FC<TOrderPanelFooter> = ({
  submitDataInprogress,
  cartListKeys = [],
  orderDetailIds = [],
  isOrderDeadlineOver,
  handleSubmit,
  handleRemoveAllItem,
  cartList,
}) => {
  const intl = useIntl();

  const plan = useAppSelector((state) => state.ParticipantPlanPage.plan);

  const isAllowAddSecondaryFood = useAppSelector(
    (state) => state.ParticipantPlanPage.isAllowAddSecondaryFood,
  );
  const isRequireSecondFood = true; // TODO: need to handle this flag after second food feature is applied to all companies
  const submitDisabled =
    isOrderDeadlineOver ||
    submitDataInprogress ||
    cartListKeys.length === 0 ||
    verifyAllFoodPickedWithParticipant(
      orderDetailIds,
      cartList,
      plan,
      isAllowAddSecondaryFood,
      isRequireSecondFood,
    );

  const removeAllDisabled =
    isOrderDeadlineOver || submitDataInprogress || cartListKeys.length === 0;

  const completeOrderButtonLabel = intl.formatMessage({
    id: 'SectionOrderPanel.completeOrder',
  });
  const removeAllOrderCartLabel = intl.formatMessage({
    id: 'SectionOrderPanel.removeAllOrderCartLabel',
  });

  const { isMobileLayout } = useViewport();

  return (
    <div
      className={classNames(
        css.sectionFooter,
        isMobileLayout
          ? 'fixed bottom-0 left-0 right-0 bg-white shadow-[rgba(0,0,15,0.1)_0px_-4px_8px_2px] !py-4'
          : '',
      )}>
      <Button
        fullWidth
        onClick={handleSubmit}
        variant="primary"
        disabled={submitDisabled}
        inProgress={submitDataInprogress}
        loadingMode="extend">
        {submitDataInprogress
          ? intl.formatMessage({ id: 'OrderEventCardStatus.processing' })
          : completeOrderButtonLabel}
      </Button>
      <Button
        variant="secondary"
        disabled={removeAllDisabled}
        className={css.removeCartLabel}
        onClick={handleRemoveAllItem}>
        {removeAllOrderCartLabel}
      </Button>
    </div>
  );
};

export default OrderPanelFooter;
