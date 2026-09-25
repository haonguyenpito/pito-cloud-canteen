/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import isEqual from 'lodash/isEqual';
import { useRouter } from 'next/router';

import AutomaticPickingForm from '@components/OrderDetails/EditView/AutomaticInfoSection/AutomaticPickingForm';
import ManageLineItemsSection from '@components/OrderDetails/EditView/ManageOrderDetailSection/ManageLineItemsSection';
import ManageOrdersSection from '@components/OrderDetails/EditView/ManageOrderDetailSection/ManageOrdersSection';
import ManageParticipantsSection from '@components/OrderDetails/EditView/ManageParticipantsSection/ManageParticipantsSection';
import OrderDeadlineCountdownSection from '@components/OrderDetails/EditView/OrderDeadlineCountdownSection/OrderDeadlineCountdownSection';
import OrderLinkSection from '@components/OrderDetails/EditView/OrderLinkSection/OrderLinkSection';
import SubOrderChangesHistorySection from '@components/OrderDetails/EditView/SubOrderChangesHistorySection/SubOrderChangesHistorySection';
import ReviewOrderStatesSection from '@components/OrderDetails/ReviewView/ReviewOrderStatesSection/ReviewOrderStatesSection';
import ReviewView from '@components/OrderDetails/ReviewView/ReviewView';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import Tabs from '@components/Tabs/Tabs';
import { groupFoodOrderByDate } from '@helpers/order/orderDetailHelper';
import { checkMinMaxQuantityInPickingState } from '@helpers/order/orderPickingHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { useDownloadPriceQuotation } from '@hooks/useDownloadPriceQuotation';
import useExportOrderDetails from '@hooks/useExportOrderDetails';
import { usePrepareOrderDetailPageData } from '@hooks/usePrepareOrderManagementData';
import { AdminManageOrderThunks } from '@pages/admin/order/AdminManageOrder.slice';
import { ReviewContent } from '@pages/admin/order/StepScreen/ReviewOrder/ReviewOrder';
import OrderDetailTrackingSection from '@pages/company/orders/[orderId]/components/OrderDetailTrackingSection';
import { useAutoPickFood } from '@pages/company/orders/[orderId]/hooks/useAutoPickFood';
import OrderQuantityErrorSection from '@pages/company/orders/[orderId]/picking/OrderQuantityErrorSection';
import {
  OrderManagementsAction,
  orderManagementThunks,
} from '@redux/slices/OrderManagement.slice';
import { Listing } from '@src/utils/data';
import { formatTimestamp } from '@src/utils/dates';
import { EOrderStates, EOrderType } from '@src/utils/enums';
import { ETransition } from '@src/utils/transaction';
import type { TListing, TObject, TUser } from '@src/utils/types';

import OrderHeaderInfor from '../../components/OrderHeaderInfor/OrderHeaderInfor';
import OrderHeaderState from '../../components/OrderHeaderState/OrderHeaderState';

import css from './OrderDetailTab.module.scss';

enum EPageViewMode {
  edit = 'edit',
  review = 'review',
  priceQuotation = 'priceQuotation',
}

const allowedOrderStatesToShowStateSection = [
  EOrderStates.inProgress,
  EOrderStates.pendingPayment,
  EOrderStates.completed,
  EOrderStates.reviewed,
];

type OrderDetailTabProps = {
  order: TListing;
  orderDetail: any;
  company: TUser;
  booker: TUser;
  updateStaffName: (staffName: string) => void;
  updateOrderStaffNameInProgress: boolean;
  updateOrderState: (newOrderState: string) => void;
  updateOrderStateInProgress: boolean;
  onSaveOrderNote: (orderNote: string) => void;
};

const OrderDetailTab: React.FC<OrderDetailTabProps> = (props) => {
  const {
    orderDetail,
    order,
    company,
    booker,
    updateStaffName,
    updateOrderStaffNameInProgress,
    updateOrderState,
    updateOrderStateInProgress,
    onSaveOrderNote,
  } = props;

  const {
    subOrderChangesHistory,
    transactionMap,
    lastRecordSubOrderChangesHistoryCreatedAt,
    querySubOrderChangesHistoryInProgress,
    subOrderChangesHistoryTotalItems,
    loadMoreSubOrderChangesHistory,
    draftOrderDetail,
    draftSubOrderChangesHistory,
    orderValidationsInProgressState,
    fetchOrderInProgress,
  } = useAppSelector((state) => state.OrderManagement);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    query: { timestamp },
    isReady: isRouterReady,
  } = router;
  const [currentViewDate, setCurrentViewDate] = useState<number>(
    Number(timestamp),
  );
  const [viewMode, setViewMode] = useState<EPageViewMode>(EPageViewMode.edit);
  const [isDraftEditing, setIsDraftEditing] = useState<boolean>(false);
  const orderId = Listing(order).getId();
  const isEditMode = viewMode === EPageViewMode.edit;
  const { handler: onDownloadReviewOrderResults } = useExportOrderDetails({
    extendedFields: ['company-name', 'partner-name'],
  });

  const { planValidationsInProgressState } =
    orderValidationsInProgressState || {};

  const {
    planReachMaxRestaurantQuantity:
      planReachMaxRestaurantQuantityInProgressState,
    planReachMinRestaurantQuantity:
      planReachMinRestaurantQuantityInProgressState,
  } = planValidationsInProgressState?.[currentViewDate] || {};

  const {
    notes,
    orderStateHistory = [],
    plans = [],
    orderState,
    orderType = EOrderType.group,
    isAutoPickFood,
  } = Listing(order).getMetadata();

  const { autoPickingAllowed, toggleFoodAutoPicking, isToggleingAutoPickFood } =
    useAutoPickFood(isAutoPickFood, orderId);

  const isGroupOrder = orderType === EOrderType.group;
  const isPickingState = orderState === EOrderStates.picking;
  const planId = plans.length > 0 ? plans[0] : undefined;
  const showStateSectionCondition =
    orderStateHistory.findIndex(({ state }: { state: EOrderStates }) => {
      return state === EOrderStates.inProgress;
    }) > 0 && allowedOrderStatesToShowStateSection.includes(orderState);
  const orderDetailsNotChanged =
    isDraftEditing && isEqual(orderDetail, draftOrderDetail);

  const { lastTransition = ETransition.INITIATE_TRANSACTION } =
    draftOrderDetail?.[currentViewDate] || {};

  const lastTransitionPartnerConfirmSubOrder =
    lastTransition === ETransition.PARTNER_CONFIRM_SUB_ORDER;

  const ableToUpdateOrder =
    !fetchOrderInProgress &&
    isRouterReady &&
    ((lastTransition === ETransition.INITIATE_TRANSACTION && isDraftEditing) ||
      isPickingState ||
      lastTransitionPartnerConfirmSubOrder);

  const { orderTitle, priceQuotationData, editViewData, reviewViewData } =
    usePrepareOrderDetailPageData({
      isAdminLayout: true,
    });

  const handleDownloadPriceQuotation = useDownloadPriceQuotation({
    orderTitle,
    priceQuotationData,
  });

  const isNormalOrder = orderType === EOrderType.normal;

  const { planValidations } = checkMinMaxQuantityInPickingState(
    isNormalOrder,
    isPickingState,
    draftOrderDetail,
  );

  const {
    planReachMaxRestaurantQuantity:
      planReachMaxRestaurantQuantityInPickingState,
    planReachMinRestaurantQuantity:
      planReachMinRestaurantQuantityInPickingState,
  } = planValidations[currentViewDate as keyof typeof planValidations] || {};

  const planReachMaxRestaurantQuantity =
    planReachMaxRestaurantQuantityInProgressState ||
    planReachMaxRestaurantQuantityInPickingState;
  const planReachMinRestaurantQuantity =
    planReachMinRestaurantQuantityInProgressState ||
    planReachMinRestaurantQuantityInPickingState;

  const { minQuantity = 1 } =
    draftOrderDetail?.[currentViewDate]?.restaurant || {};

  const onQuerySubOrderHistoryChanges = useCallback(
    (lastRecordCreatedAt?: number) => {
      if (!planId || !orderId || !currentViewDate) return;

      return dispatch(
        orderManagementThunks.querySubOrderChangesHistory({
          orderId: orderId as string,
          planId,
          planOrderDate: currentViewDate,
          lastRecordCreatedAt,
        }),
      );
    },
    [planId, orderId, currentViewDate],
  );

  const tabItems = useMemo(
    () => {
      const foodOrderGroupedByDate = groupFoodOrderByDate({
        orderDetail,
        isGroupOrder,
      });

      return Object.keys(orderDetail).map((key: string) => {
        const foodOrder = foodOrderGroupedByDate.find(
          ({ date }) => date === key,
        );

        const updatePlanDetail = (updateData: TObject, skipRefetch = false) => {
          if (planId) {
            dispatch(
              AdminManageOrderThunks.updatePlanDetail({
                planId,
                orderId,
                orderDetail: {
                  ...orderDetail,
                  [key]: { ...orderDetail[key], ...updateData },
                },
                skipRefetch,
              }),
            );
          }
        };

        return {
          id: key,
          key,
          label: formatTimestamp(Number(key)),
          childrenFn: (childProps: any) => <ReviewContent {...childProps} />,
          childrenProps: {
            ...orderDetail[key],
            notes,
            updatePlanDetail,
            timeStamp: key,
            foodOrder,
            onDownloadReviewOrderResults,
            company,
          },
        };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(order), JSON.stringify(orderDetail)],
  );
  const defaultActiveKey = tabItems.findIndex(({ id }) => id === timestamp);

  const handleConfirmOrder = () => {
    setViewMode(EPageViewMode.review);
  };

  const handleGoBackFromReviewMode = () => {
    setViewMode(EPageViewMode.edit);
  };

  const handleUpdateOrderState = (state: EOrderStates) => () => {
    updateOrderState(state);
  };

  const turnOnDraftEditMode = () => {
    setIsDraftEditing(true);
  };

  const handleSetCurrentViewDate = (date: number) => {
    setCurrentViewDate(date);
  };

  const onQueryMoreSubOrderChangesHistory = () => {
    if (lastRecordSubOrderChangesHistoryCreatedAt)
      return onQuerySubOrderHistoryChanges(
        lastRecordSubOrderChangesHistoryCreatedAt,
      );
  };
  const subOrderChangesHistorySectionProps = {
    querySubOrderChangesHistoryInProgress,
    subOrderChangesHistory,
    draftSubOrderChangesHistory:
      draftSubOrderChangesHistory[
        currentViewDate as unknown as keyof typeof draftSubOrderChangesHistory
      ],
    onQueryMoreSubOrderChangesHistory,
    subOrderChangesHistoryTotalItems,
    loadMoreSubOrderChangesHistory,
  };

  useEffect(() => {
    onQuerySubOrderHistoryChanges();
  }, [onQuerySubOrderHistoryChanges]);

  useEffect(() => {
    if (draftOrderDetail) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      () => {
        dispatch(OrderManagementsAction.resetDraftSubOrderChangeHistory());

        return dispatch(OrderManagementsAction.resetDraftOrderDetails());
      };
    }
  }, []);

  const errorSection = (
    <OrderQuantityErrorSection
      planReachMaxRestaurantQuantity={planReachMaxRestaurantQuantity}
      planReachMinRestaurantQuantity={planReachMinRestaurantQuantity}
      maxQuantity={minQuantity}
      minQuantity={minQuantity}
    />
  );

  return (
    <div className={classNames(css.container, 'flex gap-2 flex-col')}>
      <RenderWhen condition={isEditMode}>
        <OrderHeaderState
          order={order}
          handleUpdateOrderState={handleUpdateOrderState}
          updateOrderStateInProgress={updateOrderStateInProgress}
          onConfirmOrder={handleConfirmOrder}
          isDraftEditing={isDraftEditing}
          turnOnDraftEditMode={turnOnDraftEditMode}
          confirmUpdateDisabled={orderDetailsNotChanged}
          isAdminFlow
        />
        <RenderWhen condition={showStateSectionCondition}>
          <ReviewOrderStatesSection
            data={{
              orderDetail,
              transactionMap,
              isCanceledOrder: false,
            }}
            isAdminLayout
            className={css.reviewOrderStates}
          />
        </RenderWhen>
        <OrderDetailTrackingSection orderDetail={orderDetail} />
        <OrderHeaderInfor
          company={company}
          booker={booker}
          order={order}
          updateStaffName={updateStaffName}
          updateOrderStaffNameInProgress={updateOrderStaffNameInProgress}
          containerClassName={css.orderInforWrapper}
        />
        <div className={css.orderDetailWrapper}>
          <RenderWhen condition={isPickingState || isDraftEditing}>
            <RenderWhen condition={isGroupOrder}>
              <div className={css.editViewRoot}>
                <div className={css.leftPart}>
                  <ManageOrdersSection
                    setCurrentViewDate={setCurrentViewDate}
                    currentViewDate={currentViewDate}
                    isDraftEditing={isDraftEditing}
                    ableToUpdateOrder={ableToUpdateOrder}
                    isAdminFlow
                    errorSection={errorSection}
                  />
                </div>
                <div className={css.rightPart}>
                  <OrderDeadlineCountdownSection
                    className={css.container}
                    data={editViewData.countdownSectionData}
                    ableToUpdateOrder={ableToUpdateOrder}
                    visibleOnMobile
                  />

                  <div className={css.container}>
                    <AutomaticPickingForm
                      disabled={isToggleingAutoPickFood}
                      initialValues={{ autoPicking: autoPickingAllowed }}
                      handleFieldChange={toggleFoodAutoPicking}
                      onSubmit={() => {}}
                    />
                    <i
                      style={{
                        fontSize: 13,
                        paddingTop: 8,
                        display: 'inline-block',
                        color: 'cornflowerblue',
                      }}>
                      <u>Lưu ý:</u> Cài đặt này sẽ tự động chọn món cho thành
                      viên chưa chọn món ngay khi <b>Thời hạn chọn món</b> kết
                      thúc
                    </i>
                  </div>

                  <OrderLinkSection
                    className={css.container}
                    data={editViewData.linkSectionData}
                    isAminLayout
                    ableToUpdateOrder={ableToUpdateOrder}
                  />
                  <ManageParticipantsSection
                    className={css.container}
                    data={editViewData.manageParticipantData}
                    ableToUpdateOrder={ableToUpdateOrder}
                  />
                  <RenderWhen condition={isDraftEditing}>
                    <SubOrderChangesHistorySection
                      className={css.container}
                      {...subOrderChangesHistorySectionProps}
                    />
                  </RenderWhen>
                </div>
              </div>

              <RenderWhen.False>
                <div
                  className={
                    isDraftEditing
                      ? css.lineItemsTableWithSubOrderSection
                      : css.lineItemsTable
                  }>
                  <ManageLineItemsSection
                    isDraftEditing={isDraftEditing}
                    ableToUpdateOrder={ableToUpdateOrder}
                    setCurrentViewDate={handleSetCurrentViewDate}
                    currentViewDate={currentViewDate}
                    isAdminFlow
                    errorSection={errorSection}
                  />
                  <RenderWhen condition={isDraftEditing}>
                    <SubOrderChangesHistorySection
                      className={classNames(
                        css.historyContainer,
                        css.normalOrderSubOrderSection,
                      )}
                      {...subOrderChangesHistorySectionProps}
                    />
                  </RenderWhen>
                </div>
              </RenderWhen.False>
            </RenderWhen>

            <RenderWhen.False>
              <Tabs
                items={tabItems as any}
                defaultActiveKey={`${
                  (defaultActiveKey < 0 ? 0 : defaultActiveKey) + 1
                }`}
              />
            </RenderWhen.False>
          </RenderWhen>
        </div>

        <RenderWhen.False>
          <ReviewView
            className={css.reviewViewRoot}
            classes={{
              leftClassName: css.leftPart,
              rightClassName: css.rightPart,
            }}
            canGoBackEditMode
            reviewViewData={reviewViewData}
            onDownloadPriceQuotation={handleDownloadPriceQuotation}
            onGoBackToEditOrderPage={handleGoBackFromReviewMode}
            onDownloadReviewOrderResults={onDownloadReviewOrderResults}
            showStartPickingOrderButton
            isAdminLayout
            onSaveOrderNote={onSaveOrderNote}
          />
        </RenderWhen.False>
      </RenderWhen>
    </div>
  );
};

export default OrderDetailTab;
