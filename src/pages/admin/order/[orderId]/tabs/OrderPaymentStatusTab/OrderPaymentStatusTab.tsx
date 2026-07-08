import { useEffect, useState } from 'react';
import { shallowEqual } from 'react-redux';
import compact from 'lodash/compact';
import isEmpty from 'lodash/isEmpty';

import IconCheckmarkWithCircle from '@components/Icons/IconCheckmark/IconCheckmarkWithCircle';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import Tabs from '@components/Tabs/Tabs';
import Tooltip from '@components/Tooltip/Tooltip';
import {
  calculatePriceQuotationInfoFromOrder,
  calculatePriceQuotationPartner,
} from '@helpers/order/cartInfoHelper';
import { ensureVATSetting } from '@helpers/order/prepareDataHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { AdminManageOrderThunks } from '@pages/admin/order/AdminManageOrder.slice';
import { Listing } from '@src/utils/data';
import { getDayOfWeek } from '@src/utils/dates';
import {
  type EOrderStates,
  EPaymentType,
  ESubOrderStatus,
} from '@src/utils/enums';
import { TRANSITIONS_TO_STATE_CANCELED } from '@src/utils/transaction';
import type { TListing, TUser } from '@src/utils/types';

import OrderHeaderState from '../../components/OrderHeaderState/OrderHeaderState';
import { calculatePaidAmountBySubOrderDate } from '../../helpers/AdminOrderDetail';

import ClientPaymentDetail from './components/ClientPaymentDetail/ClientPaymentDetail';
import PartnerPaymentDetail from './components/PartnerPaymentDetail/PartnerPaymentDetail';

import css from './OrderPaymentStatusTab.module.scss';

type OrderPaymentStatusTabProps = {
  order: TListing;
  orderDetail: any;
  company: TUser;
  booker: TUser;
  quotations: TListing[];
  updateOrderState: (newOrderState: string) => void;
  updateOrderStateInProgress: boolean;
  subOrderDate?: string;
};

const OrderPaymentStatusTab: React.FC<OrderPaymentStatusTabProps> = (props) => {
  const {
    orderDetail,
    order,
    updateOrderState,
    updateOrderStateInProgress,
    quotations,
    company,
    subOrderDate: subOrderDateFromQuery,
  } = props;

  const dispatch = useAppDispatch();
  const [selectedSubOrderDate, setSelectedSubOrderDate] = useState<string>('');
  const [defaultActiveKey, setDefaultActiveKey] = useState<number>(1);

  const currentOrderVATPercentage = useAppSelector(
    (state) => state.SystemAttributes.currentOrderVATPercentage,
  );
  const partnerPaymentRecords = useAppSelector(
    (state) => state.AdminManageOrder.partnerPaymentRecords,
    shallowEqual,
  );
  const clientPaymentRecords = useAppSelector(
    (state) => state.AdminManageOrder.clientPaymentRecords,
    shallowEqual,
  );

  const orderListing = Listing(order);
  const orderId = orderListing.getId();
  const { title: orderTitle } = orderListing.getAttributes();
  const {
    quotationId,
    serviceFees,
    deliveryHour,
    hasSpecificPCCFee = false,
    specificPCCFee = 0,
    specificPCCFeeTiers,
    vatSettings,
    plans = [],
    isClientSufficientPaid = false,
  } = orderListing.getMetadata();
  const planId = plans.length > 0 ? plans[0] : undefined;

  const partnerCurrentQuotation = quotations.find(
    (_quotation) => _quotation.id.uuid === quotationId,
  );
  const partnerCurrentQuotationListing = Listing(partnerCurrentQuotation!);
  const { partner = {} } = partnerCurrentQuotationListing.getMetadata();

  const partnerTabItems = !isEmpty(quotations)
    ? compact(
        Object.keys(orderDetail).map((subOrderDate: string) => {
          if (
            isEmpty(
              partner[orderDetail[subOrderDate].restaurant.id]?.quotation,
            ) ||
            orderDetail[subOrderDate].status === ESubOrderStatus.canceled ||
            TRANSITIONS_TO_STATE_CANCELED.includes(
              orderDetail[subOrderDate].lastTransition,
            ) ||
            !orderDetail[subOrderDate].transactionId
          ) {
            return null;
          }
          const vatSettingFromOrder =
            vatSettings[orderDetail[subOrderDate].restaurant.id];

          const partnerQuotationBySubOrderDate = calculatePriceQuotationPartner(
            {
              quotation:
                partner[orderDetail[subOrderDate].restaurant.id]?.quotation,
              serviceFeePercentage:
                serviceFees[orderDetail[subOrderDate].restaurant.id],
              orderVATPercentage: currentOrderVATPercentage,
              subOrderDate,
              vatSetting: ensureVATSetting(vatSettingFromOrder),
            },
          );

          const { totalWithVAT } = partnerQuotationBySubOrderDate;
          const partnerPaymentRecordsByDate =
            partnerPaymentRecords?.[subOrderDate]?.filter(
              (_record) => !_record.isHideFromHistory,
            ) || [];
          const paidAmount = calculatePaidAmountBySubOrderDate(
            partnerPaymentRecordsByDate,
          );

          const { isAdminPaymentConfirmed = false } =
            orderDetail[subOrderDate] || {};
          const showPartnerCheckMark =
            isAdminPaymentConfirmed || totalWithVAT === paidAmount;

          return {
            key: subOrderDate,
            label: (
              <Tooltip
                placement="bottomLeft"
                overlayClassName={css.tooltipOverlay}
                overlayInnerStyle={{
                  backgroundColor: '#fff',
                  padding: 0,
                }}
                tooltipContent={
                  <div className={css.tooltipName}>{`${
                    orderDetail[subOrderDate].restaurant.restaurantName
                  } #${orderTitle}-${getDayOfWeek(+subOrderDate)}`}</div>
                }>
                <div className={css.labelWrapper}>
                  <div className={css.label}>
                    {`${
                      orderDetail[subOrderDate].restaurant.restaurantName
                    } #${orderTitle}-${getDayOfWeek(+subOrderDate)}`}
                  </div>
                  <RenderWhen condition={showPartnerCheckMark}>
                    <IconCheckmarkWithCircle className={css.checkIcon} />
                  </RenderWhen>
                </div>
              </Tooltip>
            ),
            childrenFn: (childProps: any) => (
              <PartnerPaymentDetail {...childProps} />
            ),
            childrenProps: {
              partnerName: orderDetail[subOrderDate].restaurant.restaurantName,
              subOrderDate: selectedSubOrderDate,
              orderId,
              planId,
              partnerId: orderDetail[subOrderDate].restaurant.id,
              partnerPaymentRecordsByDate,
              totalWithVAT,
              paidAmount,
              company,
              orderTitle,
              deliveryHour,
            },
          };
        }),
      )
    : [];

  const tabItemKeys = partnerTabItems.map(({ key }) => key);

  const { totalWithVAT: clientTotalPrice } =
    calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order,
      orderVATPercentage: currentOrderVATPercentage,
      hasSpecificPCCFee,
      specificPCCFee,
      specificPCCFeeTiers,
    });

  const clientPaidAmount =
    calculatePaidAmountBySubOrderDate(clientPaymentRecords);
  const showClientCheckmark =
    isClientSufficientPaid || clientPaidAmount === clientTotalPrice;

  const clientTabItem = {
    key: 'client',
    label: (
      <div className={css.clientLabel}>
        <span>Khách hàng</span>
        <RenderWhen condition={showClientCheckmark}>
          <IconCheckmarkWithCircle className={css.checkIcon} />
        </RenderWhen>
      </div>
    ),
    childrenFn: (childProps: any) => <ClientPaymentDetail {...childProps} />,
    childrenProps: {
      totalWithVAT: clientTotalPrice,
      orderId,
      paymentType: EPaymentType.CLIENT,
      company,
      orderTitle,
      paidAmount: clientPaidAmount,
      deliveryHour,
      clientPaymentRecords: clientPaymentRecords?.filter(
        (_record) => !_record.isHideFromHistory,
      ),
    },
  };

  const totalTabItems = [clientTabItem].concat(partnerTabItems as any[]);

  useEffect(() => {
    if (orderId) {
      dispatch(AdminManageOrderThunks.fetchQuotations(orderId));
      dispatch(AdminManageOrderThunks.fetchPartnerPaymentRecords(orderId));
      dispatch(AdminManageOrderThunks.fetchClientPaymentRecords(orderId));
    }
  }, [dispatch, orderId]);

  useEffect(() => {
    if (subOrderDateFromQuery) {
      const tabIndexMaybe =
        tabItemKeys.findIndex((item) => item === subOrderDateFromQuery) + 2;
      setDefaultActiveKey(tabIndexMaybe === 0 ? 2 : tabIndexMaybe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subOrderDateFromQuery, tabItemKeys]);

  const handleUpdateOrderState = (state: EOrderStates) => () => {
    updateOrderState(state);
  };

  const onTabChange = (tab: any) => {
    setSelectedSubOrderDate(tab?.key);
  };

  return (
    <div>
      <OrderHeaderState
        order={order}
        handleUpdateOrderState={handleUpdateOrderState}
        updateOrderStateInProgress={updateOrderStateInProgress}
        isAdminFlow
      />
      <RenderWhen condition={!isEmpty(quotations)}>
        <div className={css.tabContainer}>
          {defaultActiveKey && (
            <Tabs
              items={totalTabItems as any}
              onChange={onTabChange}
              defaultActiveKey={`${defaultActiveKey}`}
            />
          )}
        </div>
      </RenderWhen>
    </div>
  );
};

export default OrderPaymentStatusTab;
