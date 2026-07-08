/* eslint-disable unused-imports/no-unused-vars */
import { calculatePriceQuotationInfoFromOrder } from '@helpers/order/cartInfoHelper';
import { calculatePaidAmountBySubOrderDate } from '@pages/admin/order/[orderId]/helpers/AdminOrderDetail';
import { fetchListing } from '@services/integrationHelper';
import type { PaymentBaseParams } from '@services/payment';
import { Listing } from '@src/utils/data';
import type { EPaymentType } from '@src/utils/enums';
import type { TPaymentRecord } from '@src/utils/types';

export const calculateClientTotalPriceAndPaidAmount = async (
  orderId: string,
  paymentRecords: TPaymentRecord[],
) => {
  const order = await fetchListing(orderId);
  const orderListing = Listing(order);
  const {
    plans = [],
    orderVATPercentage,
    hasSpecificPCCFee = false,
    specificPCCFee = 0,
    specificPCCFeeTiers,
  } = orderListing.getMetadata();
  const plan = await fetchListing(plans[0]);
  const planListing = Listing(plan);
  const { orderDetail = {} } = planListing.getMetadata();
  const { totalWithVAT: clientTotalPrice } =
    calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order,
      orderVATPercentage,
      hasSpecificPCCFee,
      specificPCCFee,
      specificPCCFeeTiers,
    });
  const clientPaidAmount = calculatePaidAmountBySubOrderDate(paymentRecords);

  return {
    clientTotalPrice,
    clientPaidAmount,
  };
};

export const checkPaymentRecordValid = async (
  paymentRecord: PaymentBaseParams,
  paymentType: EPaymentType,
) => {
  const { amount } = paymentRecord;
  if (amount === 0) return false;

  return true;
};
