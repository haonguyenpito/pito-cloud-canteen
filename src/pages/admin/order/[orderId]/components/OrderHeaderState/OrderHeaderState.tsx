import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import Button from '@components/Button/Button';
import IconLightOutline from '@components/Icons/IconLightOutline/IconLightOutline';
import { cn } from '@components/lib/utils';
import AlertModal from '@components/Modal/AlertModal';
import OutsideClickHandler from '@components/OutsideClickHandler/OutsideClickHandler';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import { isEnableToStartOrder } from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { QRCodeModeToggle } from '@pages/admin/scanner/[planId]/QRCodeModeToggle';
import { orderManagementThunks } from '@redux/slices/OrderManagement.slice';
import { adminPaths } from '@src/paths';
import type { PlanListing } from '@src/types';
import {
  ORDER_STATE_TRANSIT_FLOW,
  ORDER_STATES_TO_ENABLE_EDIT_ABILITY,
} from '@src/utils/constants';
import { Listing } from '@src/utils/data';
import { EOrderDraftStates, EOrderStates, EOrderType } from '@src/utils/enums';
import { getLabelByKey, ORDER_STATE_OPTIONS } from '@src/utils/options';
import { ETransition } from '@src/utils/transaction';
import type {
  TListing,
  TObject,
  TTransitionOrderState,
} from '@src/utils/types';

import css from './OrderHeaderState.module.scss';

type OrderHeaderStateProps = {
  order: TListing;
  handleUpdateOrderState: (state: EOrderStates) => () => void;
  onConfirmOrder?: () => void;
  updateOrderStateInProgress: boolean;
  isDraftEditing?: boolean;
  confirmUpdateDisabled?: boolean;
  turnOnDraftEditMode?: () => void;
  isAdminFlow?: boolean;
};

const OrderHeaderState: React.FC<OrderHeaderStateProps> = (props) => {
  const {
    order,
    handleUpdateOrderState,
    updateOrderStateInProgress,
    onConfirmOrder,
    turnOnDraftEditMode,
    isDraftEditing = false,
    confirmUpdateDisabled = true,
    isAdminFlow = false,
  } = props;

  const intl = useIntl();
  const router = useRouter();
  const orderStateActionDropdownControl = useBoolean();
  const { planData, fetchOrderInProgress } = useAppSelector(
    (state) => state.OrderManagement,
  );
  const confirmCancelOrderActions = useBoolean();

  const planDataGetter = Listing(planData as TListing);
  const { orderDetail = {} } = planDataGetter.getMetadata();
  const orderListing = Listing(order);
  const orderId = orderListing.getId();
  const { title } = orderListing.getAttributes();
  const { orderState, orderType = EOrderType.group } =
    orderListing.getMetadata();

  const isGroupOrder = orderType === EOrderType.group;
  const isPickingOrder = orderState === EOrderStates.picking;

  const orderStateLabel = useMemo(
    () => getLabelByKey(ORDER_STATE_OPTIONS, orderState),
    [orderState],
  );
  const statusClasses = classNames(css.status, {
    [css.statusPicking]: isPickingOrder,
  });
  const canStartOrder = isEnableToStartOrder(
    orderDetail,
    isGroupOrder,
    isAdminFlow,
  );
  const disableConfirmButton = !canStartOrder || updateOrderStateInProgress;

  const shouldShowUpdateOrderStateBtn =
    orderState === EOrderDraftStates.pendingApproval ||
    orderState === EOrderDraftStates.draft;

  const shouldShowStartOrderBtn =
    typeof onConfirmOrder !== 'undefined' &&
    orderState === EOrderStates.picking;

  const hasAnyInProgressSubOrdersMaybe = (
    Object.values(orderDetail) as TObject[]
  ).some(({ lastTransition = ETransition.INITIATE_TRANSACTION }: TObject) => {
    return lastTransition === ETransition.INITIATE_TRANSACTION;
  });

  const hasAnyPartnerConfirmSubOrdersMaybe = (
    Object.values(orderDetail) as TObject[]
  ).some(({ lastTransition = ETransition.INITIATE_TRANSACTION }: TObject) => {
    return lastTransition === ETransition.PARTNER_CONFIRM_SUB_ORDER;
  });

  const shouldManagePickingBtn =
    orderState === EOrderStates.inProgress &&
    (hasAnyInProgressSubOrdersMaybe || hasAnyPartnerConfirmSubOrdersMaybe);

  const canCancelOrder = ORDER_STATE_TRANSIT_FLOW[
    orderState as TTransitionOrderState
  ]?.includes(EOrderStates.canceled);
  const canEditOrder =
    ORDER_STATES_TO_ENABLE_EDIT_ABILITY.includes(orderState) &&
    ((isPickingOrder && isGroupOrder) || !isPickingOrder);

  const hasAnyActionsCanDo =
    canEditOrder ||
    canCancelOrder ||
    shouldShowUpdateOrderStateBtn ||
    shouldManagePickingBtn;

  const handleClickEditOrder = () => {
    router.push({
      pathname: adminPaths.EditOrder,
      query: {
        orderId,
      },
    });
  };

  const handleAgreeCancelOrder = () => {
    if (canCancelOrder) {
      handleUpdateOrderState?.(EOrderStates.canceled)();
    }
    confirmCancelOrderActions.setFalse();
  };
  const handleDisagreeCancelOrder = () => {
    confirmCancelOrderActions.setFalse();
  };

  const handleCloseDropdownAfterClickedAction = (func: () => void) => () => {
    func();
    orderStateActionDropdownControl.setFalse();
  };

  const handleClickCancelOrder = handleCloseDropdownAfterClickedAction(
    confirmCancelOrderActions.setTrue,
  );
  const handleClickTurnOnDraftEditMode = handleCloseDropdownAfterClickedAction(
    turnOnDraftEditMode!,
  );
  const dispatch = useAppDispatch();

  const planListing = planData as PlanListing;

  const toggleQRCodeMode = () => {
    dispatch(
      orderManagementThunks.toggleQRCodeMode({
        orderId: planListing.attributes?.metadata?.orderId!,
        planId: planListing.id?.uuid!,
        isAdminFlow: true,
      }),
    );
    dispatch(
      orderManagementThunks.loadData({
        orderId: planListing.attributes?.metadata?.orderId!,
        isAdminFlow: true,
      }),
    );
  };

  return (
    <div className={css.header}>
      <div className={cn(css.orderTitle, 'flex flex-col md:flex-row')}>
        <div className={cn(css.titleLabel, 'hidden md:block')}>Đơn hàng </div>
        <div className={css.orderId}>{`#${title}`}</div>
        <div className={statusClasses}>{orderStateLabel}</div>
        <div className={css.action}>
          <IconLightOutline onClick={orderStateActionDropdownControl.setTrue} />
          <RenderWhen
            condition={
              orderStateActionDropdownControl.value && hasAnyActionsCanDo
            }>
            <OutsideClickHandler
              className={css.actionList}
              onOutsideClick={orderStateActionDropdownControl.setFalse}>
              <RenderWhen condition={canEditOrder}>
                <div className={css.actionItem} onClick={handleClickEditOrder}>
                  Chỉnh sửa đơn hàng
                </div>
              </RenderWhen>
              <RenderWhen condition={canCancelOrder}>
                <div
                  className={css.actionItem}
                  onClick={handleClickCancelOrder}>
                  Huỷ đơn
                </div>
              </RenderWhen>
              <RenderWhen condition={shouldShowUpdateOrderStateBtn}>
                <div
                  className={css.actionItem}
                  onClick={handleUpdateOrderState(EOrderStates.picking)}>
                  Hoàn tất
                </div>
              </RenderWhen>
              <RenderWhen condition={shouldManagePickingBtn}>
                <div
                  className={css.actionItem}
                  onClick={handleClickTurnOnDraftEditMode}>
                  {intl.formatMessage({ id: 'quan-ly-chon-mon' })}
                </div>
              </RenderWhen>
            </OutsideClickHandler>
          </RenderWhen>
        </div>

        {isGroupOrder && orderState === EOrderStates.inProgress && (
          <QRCodeModeToggle
            isLoading={fetchOrderInProgress}
            status={
              planListing.attributes?.metadata?.allowToQRCode ? 'on' : 'off'
            }
            onChange={toggleQRCodeMode}
          />
        )}
      </div>
      <RenderWhen condition={shouldShowUpdateOrderStateBtn}>
        <Button
          variant="primary"
          className={css.stateBtn}
          onClick={handleUpdateOrderState(EOrderStates.picking)}
          inProgress={updateOrderStateInProgress}>
          Đặt đơn
        </Button>
      </RenderWhen>
      <RenderWhen condition={shouldShowStartOrderBtn}>
        <Button
          variant="primary"
          className={css.stateBtn}
          onClick={onConfirmOrder}
          inProgress={updateOrderStateInProgress}
          disabled={disableConfirmButton}>
          Xác nhận
        </Button>
      </RenderWhen>
      <RenderWhen condition={isDraftEditing}>
        <Button
          variant="primary"
          className={css.stateBtn}
          disabled={confirmUpdateDisabled}
          onClick={onConfirmOrder}>
          Cập nhật
        </Button>
      </RenderWhen>
      <AlertModal
        isOpen={confirmCancelOrderActions.value}
        handleClose={confirmCancelOrderActions.setFalse}
        title={intl.formatMessage({
          id: 'BookerOrderDetailsPage.confirmCancelOrderModal.title',
        })}
        confirmLabel={intl.formatMessage({
          id: 'BookerOrderDetailsPage.confirmCancelOrderModal.confirmText',
        })}
        cancelLabel={intl.formatMessage({
          id: 'BookerOrderDetailsPage.confirmCancelOrderModal.cancelText',
        })}
        onConfirm={handleAgreeCancelOrder}
        onCancel={handleDisagreeCancelOrder}
        confirmInProgress={updateOrderStateInProgress}
        cancelDisabled={updateOrderStateInProgress}
      />
    </div>
  );
};

export default OrderHeaderState;
