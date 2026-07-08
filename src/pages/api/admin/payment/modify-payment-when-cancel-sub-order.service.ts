import { calculatePriceQuotationInfoFromQuotation } from '@helpers/order/cartInfoHelper';
import { fetchUser } from '@services/integrationHelper';
import {
  deletePaymentRecordByIdOnFirebase,
  queryPaymentRecordOnFirebase,
  updatePaymentRecordOnFirebase,
} from '@services/payment';
import { ensureListing, Listing, User } from '@src/utils/data';
import { EPaymentType } from '@src/utils/enums';
import type { TListing, TObject } from '@src/utils/types';

const { PITO_ADMIN_ID } = process.env;

export const modifyPaymentWhenCancelSubOrderService = async ({
  order,
  subOrderDate,
  clientQuotation,
  partnerQuotation,
}: {
  order: TListing;
  subOrderDate: number;
  clientQuotation: TObject;
  partnerQuotation: TObject;
}) => {
  const orderListing = Listing(order);
  const orderId = orderListing.getId();
  const {
    packagePerMember,
    orderVATPercentage,
    hasSpecificPCCFee,
    specificPCCFee,
    specificPCCFeeTiers,
  } = orderListing.getMetadata();
  const partnerPaymentRecord = await queryPaymentRecordOnFirebase({
    paymentType: EPaymentType.PARTNER,
    orderId,
    subOrderDate: subOrderDate.toString(),
  });

  if (partnerPaymentRecord && partnerPaymentRecord?.length > 0) {
    await deletePaymentRecordByIdOnFirebase(partnerPaymentRecord[0].id);
  }

  const clientPaymentRecords = await queryPaymentRecordOnFirebase({
    paymentType: EPaymentType.CLIENT,
    orderId,
  });
  if (clientPaymentRecords && clientPaymentRecords?.length > 0) {
    const clientPaymentRecord = clientPaymentRecords[0];
    const { id } = clientPaymentRecord;

    const admin = await fetchUser(PITO_ADMIN_ID!);
    const adminUser = User(admin);
    const { systemVATPercentage } = adminUser.getPrivateData();

    const quotationListing = ensureListing({
      attributes: {
        metadata: {
          client: clientQuotation,
          partner: partnerQuotation,
        },
      },
    });

    const { totalWithVAT: newTotalPrice } =
      calculatePriceQuotationInfoFromQuotation({
        quotation: quotationListing,
        packagePerMember,
        orderVATPercentage: orderVATPercentage || systemVATPercentage,
        hasSpecificPCCFee,
        specificPCCFee,
        specificPCCFeeTiers,
      });

    if (newTotalPrice === 0) {
      await deletePaymentRecordByIdOnFirebase(id);
    } else {
      await updatePaymentRecordOnFirebase(id, {
        totalPrice: newTotalPrice,
      });
    }
  }
};
