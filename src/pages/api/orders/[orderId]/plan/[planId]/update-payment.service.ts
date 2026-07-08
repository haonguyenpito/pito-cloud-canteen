import {
  calculatePriceQuotationInfoFromOrder,
  calculatePriceQuotationPartner,
} from '@helpers/order/cartInfoHelper';
import { ensureVATSetting } from '@helpers/order/prepareDataHelper';
import { queryAllCollectionData } from '@services/firebase';
import { fetchListing } from '@services/integrationHelper';
import { updatePaymentRecordOnFirebase } from '@services/payment';
import { Listing } from '@src/utils/data';
import { EPaymentType } from '@src/utils/enums';
import type { TPlan } from '@src/utils/orderTypes';
import type { TListing, TObject, TPccFeeTier } from '@src/utils/types';

const { FIREBASE_PAYMENT_RECORD_COLLECTION_NAME } = process.env;

const updatePartnerPaymentRecord = async (
  orderId: string,
  partner: TObject,
  orderDetail: TPlan['orderDetail'],
  serviceFees: TObject,
  orderVATPercentage: number,
  vatSettings: TObject,
) => {
  await Promise.all(
    Object.entries(orderDetail).map(
      async ([subOrderDate, subOrderData]: [string, any]) => {
        const { restaurant = {} } = subOrderData;
        const { id: restaurantId } = restaurant;
        const vatSettingFromOrder = vatSettings[restaurantId];

        const { totalWithVAT: totalPrice } = calculatePriceQuotationPartner({
          quotation: partner[restaurantId]?.quotation,
          serviceFeePercentage: serviceFees[restaurantId],
          orderVATPercentage,
          subOrderDate,
          vatSetting: ensureVATSetting(vatSettingFromOrder),
        });

        const paymentRecords = await queryAllCollectionData({
          collectionName: FIREBASE_PAYMENT_RECORD_COLLECTION_NAME!,
          queryParams: {
            orderId: {
              operator: '==',
              value: orderId,
            },
            paymentType: {
              operator: '==',
              value: EPaymentType.PARTNER,
            },
            subOrderDate: {
              operator: '==',
              value: subOrderDate,
            },
          },
        });

        await Promise.all(
          paymentRecords.map(async (paymentRecord) => {
            const { id } = paymentRecord;

            await updatePaymentRecordOnFirebase(id, {
              totalPrice,
            });
          }),
        );
      },
    ),
  );
};

const updateClientPaymentRecord = async (
  orderDetail: TPlan['orderDetail'],
  order: TListing,
  orderVATPercentage: number,
  hasSpecificPCCFee: boolean,
  specificPCCFee: number,
  specificPCCFeeTiers?: TPccFeeTier[],
) => {
  const { totalWithVAT: clientTotalPrice } =
    calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order,
      orderVATPercentage,
      hasSpecificPCCFee,
      specificPCCFee,
      specificPCCFeeTiers,
    });

  const paymentRecords = await queryAllCollectionData({
    collectionName: FIREBASE_PAYMENT_RECORD_COLLECTION_NAME!,
    queryParams: {
      orderId: {
        operator: '==',
        value: Listing(order).getId(),
      },
      paymentType: {
        operator: '==',
        value: EPaymentType.CLIENT,
      },
    },
  });

  await Promise.all(
    paymentRecords.map(async (paymentRecord) => {
      const { id } = paymentRecord;

      await updatePaymentRecordOnFirebase(id, {
        totalPrice: clientTotalPrice,
      });
    }),
  );
};

const updatePayment = async (orderId: string, planId: string) => {
  const order = await fetchListing(orderId);
  const plan = await fetchListing(planId);

  const planListingGetter = Listing(plan);
  const orderListingGetter = Listing(order);

  const {
    orderVATPercentage,
    quotationId,
    serviceFees = {},
    hasSpecificPCCFee,
    specificPCCFee,
    specificPCCFeeTiers,
    vatSettings,
  } = orderListingGetter.getMetadata();

  const quotationListing = await fetchListing(quotationId);
  const { partner = {} } = Listing(quotationListing).getMetadata();

  const { orderDetail = {} } = planListingGetter.getMetadata();

  await updatePartnerPaymentRecord(
    orderId,
    partner,
    orderDetail,
    serviceFees,
    orderVATPercentage,
    vatSettings,
  );

  await updateClientPaymentRecord(
    orderDetail,
    order,
    orderVATPercentage,
    hasSpecificPCCFee,
    specificPCCFee,
    specificPCCFeeTiers,
  );
};

export default updatePayment;
