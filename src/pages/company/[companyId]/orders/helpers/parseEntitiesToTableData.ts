import uniq from 'lodash/uniq';

import { calculatePriceQuotationInfoFromOrder } from '@helpers/order/cartInfoHelper';
import { combineOrderDetailWithPriceInfo } from '@helpers/orderHelper';
import { Listing } from '@utils/data';
import { formatTimestamp } from '@utils/dates';
import type { EOrderStates } from '@utils/enums';
import { EOrderDraftStates, EOrderType } from '@utils/enums';
import type { TIntegrationOrderListing, TListing, TObject } from '@utils/types';

export const parseEntitiesToTableData = (
  orders: TIntegrationOrderListing[],
  plans: TListing[],
  queryCompanyPlansByOrderIdsInProgress: boolean,
  page: number,
  orderVATPercentage: number,
  openOrderStateWarningModal?: (e: EOrderStates) => void,
  setSelectedOrderId?: (orderId: string) => void,
) => {
  return orders.map((entity, index) => {
    const orderId = entity?.id?.uuid;
    const {
      orderType = EOrderType.group,
      hasSpecificPCCFee = false,
      specificPCCFee = 0,
      specificPCCFeeTiers,
    } = Listing(entity as TListing).getMetadata();

    const plan =
      plans.find((p) => Listing(p).getMetadata().orderId === orderId) ||
      ({} as any);

    const { orderDetail: planOrderDetail = {} } = Listing(
      plan as TListing,
    ).getMetadata();

    const {
      startDate,
      companyId = '',
      endDate,
      deliveryHour,
      deliveryAddress,
      orderState,
      orderStateHistory = [],
      ratings,
    } = Listing(entity as TListing).getMetadata();

    const { totalWithVAT } = calculatePriceQuotationInfoFromOrder({
      order: entity,
      planOrderDetail,
      orderVATPercentage,
      hasSpecificPCCFee,
      specificPCCFee,
      specificPCCFeeTiers,
    });

    const isCreatedByPitoAdmin = orderStateHistory.some(
      ({ state }: TObject) => state === EOrderDraftStates.pendingApproval,
    );

    return {
      key: orderId,
      data: {
        id: orderId,
        title: entity.attributes.title,
        orderNumber: (page - 1) * 10 + index + 1,
        location: deliveryAddress?.address,
        startDate: startDate ? formatTimestamp(startDate) : '',
        startDateTimestamp: startDate,
        endDate: endDate ? formatTimestamp(endDate) : '',
        state: orderState,
        isCreatedByPitoAdmin,
        orderId,
        companyId,
        hasRating: !!ratings,
        isGroupOrder: orderType === EOrderType.group,
        queryCompanyPlansByOrderIdsInProgress,
        plan: {
          ...plan,
          attributes: {
            ...((plan as TListing)?.attributes || {}),
            metadata: {
              ...((plan as TListing)?.attributes?.metadata || {}),
              orderDetail: combineOrderDetailWithPriceInfo({
                orderDetail: planOrderDetail,
              }),
            },
          },
        },
        restaurants: uniq(
          Object.keys(planOrderDetail).map((key) => {
            return planOrderDetail[key]?.restaurant?.restaurantName;
          }),
        ),
        orderName: entity.attributes.publicData.orderName,
        deliveryHour,
        totalWithVAT,
        openOrderStateWarningModal,
        paymentStatus: entity.attributes.metadata?.isClientSufficientPaid,
        setSelectedOrderId,
      },
    };
  });
};
