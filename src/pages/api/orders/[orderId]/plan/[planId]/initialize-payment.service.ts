/**
 * ⚠️ BEHAVIORAL CONTRACT — initialize-payment.service.ts
 * =======================================================
 * PURPOSE: Creates Firebase payment records (client + partner) for a plan at
 * order start time. This materialises the payment ledger entries that admin will
 * later confirm.
 *
 * PRECONDITIONS:
 *   - orderListing and planListing must be valid, fully-populated Sharetribe
 *     listing objects (fetched server-side via integration SDK).
 *   - The plan must NOT already have a confirmed payment record. Calling this
 *     again on a confirmed order will create duplicate partner records (there is
 *     no idempotency guard on partner writes — the caller is responsible).
 *   - For in-progress edited orders (isEditInProgressOrder), the existing client
 *     record is UPDATED, not duplicated. This path is safe to re-run.
 *
 * SIDE EFFECTS:
 *   - Writes N partner payment records to Firestore (one per active sub-order
 *     date). These writes are FIRE-AND-FORGET (no await) — failures are silent.
 *   - Writes or updates one client payment record in Firestore.
 *   - All Firestore writes are IRREVERSIBLE in practice once admin-confirmed.
 *
 * INVARIANTS:
 *   - totalPrice values come from calculatePriceQuotationPartner /
 *     calculatePriceQuotationInfoFromOrder (VAT already applied). Never pass
 *     raw prices here.
 *   - Sub-orders with lastTransition ∈ {OPERATOR_CANCEL_PLAN,
 *     OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED,
 *     OPERATOR_CANCEL_AFTER_PARTNER_REJECTED} are excluded — they must NEVER
 *     generate payment records.
 *   - orderId and planId must both be non-empty strings.
 *   - amount is intentionally 0 at initialisation — it is the actual cash
 *     collected, filled in later by admin.
 *
 * FAILURE:
 *   - Partner record write failures are currently silent (fire-and-forget).
 *     Do NOT change the client record write to fire-and-forget without
 *     understanding the audit implications.
 *   - If this function throws, the caller (start-order.api.ts) must not
 *     proceed to initiate-transaction — the payment record must exist first.
 */
import compact from 'lodash/compact';
import isEmpty from 'lodash/isEmpty';

import {
  calculatePriceQuotationInfoFromOrder,
  calculatePriceQuotationPartner,
} from '@helpers/order/cartInfoHelper';
import { ensureVATSetting } from '@helpers/order/prepareDataHelper';
import {
  checkIsOrderHasInProgressState,
  getEditedSubOrders,
} from '@helpers/orderHelper';
import { generateSKU } from '@pages/admin/order/[orderId]/helpers/AdminOrderDetail';
import {
  adminQueryListings,
  fetchListing,
  fetchUser,
} from '@services/integrationHelper';
import type { PaymentBaseParams } from '@services/payment';
import {
  createPaymentRecordOnFirebase,
  queryPaymentRecordOnFirebase,
  updatePaymentRecordOnFirebase,
} from '@services/payment';
import { Listing, User } from '@src/utils/data';
import { EPaymentType } from '@src/utils/enums';
import { ETransition } from '@src/utils/transaction';
import type { TListing, TObject } from '@src/utils/types';

export const initializePayment = async (
  orderListing: TListing,
  planListing: TListing,
) => {
  const orderListingGetter = Listing(orderListing);
  const planListingGetter = Listing(planListing);

  const orderId = orderListingGetter.getId();
  const { title: orderTitle } = orderListingGetter.getAttributes();
  const {
    companyName,
    deliveryHour,
    orderVATPercentage,
    quotationId,
    serviceFees = {},
    vatSettings,
    orderStateHistory = [],
  } = orderListingGetter.getMetadata();

  const isOrderHasInProgressState =
    checkIsOrderHasInProgressState(orderStateHistory);

  const quotationListing = await fetchListing(quotationId);
  const { partner = {} } = Listing(quotationListing).getMetadata();

  const { orderDetail = {} } = planListingGetter.getMetadata();
  const editedSubOrders = getEditedSubOrders(orderDetail);

  const isEditInProgressOrder =
    isOrderHasInProgressState && !isEmpty(editedSubOrders);

  let partnerPaymentRecordsData: Partial<PaymentBaseParams>[] = [];

  const generatePaymentRecordData = (subOrders: TObject) => {
    return Object.entries(subOrders).map(
      ([subOrderDate, subOrderData]: [string, any]) => {
        const { restaurant = {}, lastTransition } = subOrderData;
        const { id, restaurantName } = restaurant;
        if (
          [
            ETransition.OPERATOR_CANCEL_PLAN,
            ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED,
            ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED,
          ].includes(lastTransition)
        ) {
          return;
        }

        const vatSettingFromOrder = vatSettings[id];

        const { totalWithVAT } = calculatePriceQuotationPartner({
          quotation: partner[id].quotation,
          serviceFeePercentage: serviceFees[id],
          orderVATPercentage,
          subOrderDate,
          vatSetting: ensureVATSetting(vatSettingFromOrder),
        });

        return {
          SKU: generateSKU('PARTNER', orderId),
          amount: 0,
          paymentNote: '',
          orderId,
          partnerId: id,
          partnerName: restaurantName,
          subOrderDate,
          companyName,
          orderTitle,
          totalPrice: totalWithVAT,
          deliveryHour,
          isHideFromHistory: true,
          isAdminConfirmed: false,
        };
      },
    );
  };

  partnerPaymentRecordsData = compact(generatePaymentRecordData(orderDetail));

  const {
    startDate,
    endDate,
    bookerId,
    partnerIds = [],
    companyId,
    hasSpecificPCCFee = false,
    specificPCCFee = 0,
  } = orderListingGetter.getMetadata();

  const company = companyId ? await fetchUser(companyId) : null;

  const listings = await adminQueryListings({ ids: partnerIds });
  const restaurants = listings.reduce((prev: any, listing: any) => {
    const { title } = Listing(listing as any).getAttributes();
    const restaurantId = Listing(listing as any).getId();

    return [
      ...prev,
      {
        restaurantName: title,
        restaurantId,
      },
    ];
  }, [] as any);

  const bookerUser = await fetchUser(bookerId);

  const bookerDisplayName = User(bookerUser).getProfile().displayName;
  const bookerPhoneNumber = User(bookerUser).getProtectedData().phoneNumber;

  const { totalWithVAT: clientTotalPrice } =
    calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order: orderListing,
      orderVATPercentage,
      hasSpecificPCCFee,
      specificPCCFee,
    });

  const clientPaymentData: Partial<PaymentBaseParams> = {
    SKU: generateSKU('CUSTOMER', orderId),
    amount: 0,
    orderId,
    paymentNote: '',
    companyName,
    isHideFromHistory: true,
    isAdminConfirmed: false,
    orderTitle,
    totalPrice: clientTotalPrice,
    deliveryHour,
    startDate,
    endDate,
    ...(restaurants ? { restaurants } : {}),
    ...(company
      ? {
          company: {
            companyName: companyName || '',
            companyId,
          },
        }
      : {}),
    ...(bookerUser
      ? {
          booker: {
            bookerDisplayName: bookerDisplayName || '',
            bookerPhoneNumber: bookerPhoneNumber || '',
            bookerId,
          },
        }
      : {}),
  };

  partnerPaymentRecordsData.forEach((paymentRecordData) => {
    createPaymentRecordOnFirebase(EPaymentType.PARTNER, paymentRecordData);
  });

  if (isEditInProgressOrder) {
    const paymentRecords = await queryPaymentRecordOnFirebase({
      paymentType: EPaymentType.CLIENT,
      orderId,
    });

    if (!isEmpty(paymentRecords)) {
      await updatePaymentRecordOnFirebase(paymentRecords?.[0].id, {
        ...clientPaymentData,
      });
    }
  } else {
    createPaymentRecordOnFirebase(EPaymentType.CLIENT, clientPaymentData);
  }
};
