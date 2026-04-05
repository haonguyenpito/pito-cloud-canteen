/**
 * ⚠️ BEHAVIORAL CONTRACT — cartInfoHelper.ts
 *
 * PURPOSE: Core price calculation engine. All monetary amounts in VND (integers).
 * Rounding errors compound — always use Math.round(), never Math.floor()/Math.ceil().
 *
 * WHY `isEmpty(client) || isEmpty(partner)` (not &&):
 *   - calculatePriceQuotationInfoFromQuotation returns {} early if EITHER the
 *     client or partner quotation is missing. A quotation is only meaningful
 *     when both sides are present. Using && would allow half-populated quotations
 *     to proceed, producing incorrect totals.
 *
 * WHY noExportVat DEDUCTS INSTEAD OF ADDS:
 *   - vatPercentageBaseOnVatSetting returns a NEGATIVE percentage for noExportVat
 *     (e.g., -0.04 instead of 0.04). This means VATFee is negative and
 *     totalWithVAT < totalPrice — the partner pays the VAT, not the client.
 *   - The UI displays Math.abs(VATFee), so the sign is internal only.
 *   - DO NOT change the sign convention without updating all callers.
 *
 * WHY isPartnerFlow SKIPS PITOFee:
 *   - When calculating the partner-facing quotation for a specific date+partner,
 *     PITOFee (the PITO Cloud Canteen service fee charged TO THE CLIENT) must not
 *     appear on the partner invoice. PITOFee is always 0 in partner flows.
 *   - The isPartnerFlow condition is `date && partnerId` — both must be present.
 *
 * VAT MODES SUMMARY:
 *   - vat:         Standard: VAT applied on provisional total (totalWithoutVAT)
 *   - noExportVat: Deduction: negative VAT applied on menu price (totalPrice).
 *                  Used when the partner cannot issue a VAT invoice.
 *   - direct:      No VAT: vatPercentage = 0. totalWithVAT = totalWithoutVAT.
 *
 * SERVICE FEE vs PITOFee:
 *   - serviceFee: deducted from partner payment (percentage of totalPrice)
 *   - PITOFee (PCCFee): added to client invoice per delivery day (tiered by headcount)
 *   - They are calculated independently and must not be conflated.
 */
import isEmpty from 'lodash/isEmpty';
import pick from 'lodash/pick';

import {
  getFoodDataMap,
  getOrderParticipantNumber,
  getPCCFeeByMemberAmount,
  getTotalInfo,
} from '@helpers/orderHelper';
import {
  EOrderStates,
  EOrderType,
  EPartnerVATSetting,
  ESubOrderStatus,
} from '@src/utils/enums';
import { TRANSITIONS_TO_STATE_CANCELED } from '@src/utils/transaction';
import { Listing } from '@utils/data';
import type { TListing, TObject, TQuotation } from '@utils/types';

import { isJoinedPlan } from './orderPickingHelper';
import { vatPercentageBaseOnVatSetting } from './prepareDataHelper';

/**
 * Calculate VAT based on VAT setting and user type: partner or customer
 * @param vatPercentage VAT percentage from 0 to 1
 */
export const calculateVATFee = ({
  vatPercentage,
  partnerVATSetting,
  orderProvisionalPrice,
  orderMenuPrice,
  target = 'partner',
}: {
  vatPercentage: number;
  partnerVATSetting: EPartnerVATSetting;
  orderProvisionalPrice: number;
  orderMenuPrice: number;
  target: 'partner' | 'customer';
}) => {
  if (!(target === 'partner')) {
    return Math.round(orderProvisionalPrice * vatPercentage);
  }

  if (target === 'partner') {
    switch (partnerVATSetting) {
      case EPartnerVATSetting.noExportVat:
        return Math.round(orderMenuPrice * vatPercentage);
      default:
        return Math.round(orderProvisionalPrice * vatPercentage);
    }
  }

  // Safe return - Never reach here
  return 0;
};

export const calculateTotalPriceAndDishes = ({
  orderDetail = {},
  isGroupOrder,
  date,
}: {
  orderDetail: TObject;
  isGroupOrder: boolean;
  date?: number | string;
}) => {
  return isGroupOrder
    ? Object.entries<TObject>(orderDetail).reduce<TObject>(
        (result, currentOrderDetailEntry) => {
          const [dateKey, rawOrderDetailOfDate] = currentOrderDetailEntry;
          if (date && date?.toString() !== dateKey) {
            return result;
          }

          const {
            memberOrders,
            restaurant = {},
            status,
            lastTransition,
          } = rawOrderDetailOfDate;
          const { foodList: foodListOfDate } = restaurant;
          if (
            status === ESubOrderStatus.canceled ||
            TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition)
          ) {
            return result;
          }

          const foodDataMap = getFoodDataMap({ foodListOfDate, memberOrders });
          const foodDataList = Object.values(foodDataMap);
          const totalInfo = getTotalInfo(foodDataList);
          const totalParticipantOrdered =
            getOrderParticipantNumber(memberOrders);

          return {
            ...result,
            totalPrice: result.totalPrice + totalInfo.totalPrice,
            totalDishes: result.totalDishes + totalInfo.totalDishes,
            totalParticipantOrdered:
              result.totalParticipantOrdered + totalParticipantOrdered,
            [dateKey]: foodDataList,
          };
        },
        {
          totalDishes: 0,
          totalPrice: 0,
          totalParticipantOrdered: 0,
        },
      )
    : Object.entries<TObject>(orderDetail).reduce<TObject>(
        (result, currentOrderDetailEntry) => {
          const [dateKey, rawOrderDetailOfDate] = currentOrderDetailEntry;
          const {
            lineItems = [],
            status,
            lastTransition,
          } = rawOrderDetailOfDate;

          if (
            (date && date?.toString() !== dateKey) ||
            status === ESubOrderStatus.canceled ||
            TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition)
          ) {
            return result;
          }
          const totalInfo = lineItems.reduce(
            (
              res: {
                totalPrice: number;
                totalDishes: number;
              },
              item: TObject,
            ) => {
              const { quantity = 1, price = 0 } = item || {};

              return {
                totalPrice: res.totalPrice + price,
                totalDishes: res.totalDishes + quantity,
                totalParticipantOrdered: res.totalDishes + quantity,
              };
            },
            { totalPrice: 0, totalDishes: 0 },
          );
          const foodDataList = lineItems.map((item: TObject) => {
            return {
              foodName: item?.name,
              frequency: item?.quantity,
            };
          });

          return {
            ...result,
            totalPrice: result.totalPrice + totalInfo.totalPrice,
            totalDishes: result.totalDishes + totalInfo.totalDishes,
            [dateKey]: foodDataList,
          };
        },
        {
          totalDishes: 0,
          totalPrice: 0,
        },
      );
};

export const calculatePCCFeeByDate = ({
  isGroupOrder,
  memberOrders = {},
  lineItems = [],
  hasSpecificPCCFee,
  specificPCCFee,
}: {
  isGroupOrder: boolean;
  memberOrders: TObject;
  lineItems: TObject[];
  hasSpecificPCCFee?: boolean;
  specificPCCFee: number;
}) => {
  const memberAmountOfDate = isGroupOrder
    ? Object.values(memberOrders).reduce(
        (resultOfDate: number, currentMemberOrder: any) => {
          const { foodId, status } = currentMemberOrder;

          return isJoinedPlan(foodId, status) ? resultOfDate + 1 : resultOfDate;
        },
        0,
      )
    : lineItems.reduce((res: number, item: TObject) => {
        return res + (item?.quantity || 1);
      }, 0);

  const PCCFeeOfDate = hasSpecificPCCFee
    ? memberAmountOfDate > 0
      ? specificPCCFee
      : 0
    : getPCCFeeByMemberAmount(memberAmountOfDate);

  return PCCFeeOfDate;
};

export const calculatePriceQuotationInfoFromOrder = ({
  planOrderDetail = {},
  order,
  orderVATPercentage,
  orderServiceFeePercentage = 0,
  date,
  shouldIncludePITOFee = true,
  hasSpecificPCCFee = false,
  specificPCCFee = 0,
  isPartner = false,
  vatSetting = EPartnerVATSetting.vat,
}: {
  planOrderDetail: TObject;
  order: TObject;
  orderVATPercentage: number;
  date?: number | string;
  shouldIncludePITOFee?: boolean;
  orderServiceFeePercentage?: number;
  hasSpecificPCCFee?: boolean;
  specificPCCFee?: number;
  isPartner?: boolean;
  vatSetting?: EPartnerVATSetting;
}) => {
  const {
    packagePerMember = 0,
    orderState,
    orderType = EOrderType.group,
  } = Listing(order as TListing).getMetadata();
  const isOrderInProgress = orderState === EOrderStates.inProgress;
  const isGroupOrder = orderType === EOrderType.group;

  const currentOrderDetail = Object.entries<TObject>(
    planOrderDetail,
  ).reduce<TObject>((result, currentOrderDetailEntry) => {
    const [subOrderDate, rawOrderDetailOfDate] = currentOrderDetailEntry;
    const { status, transactionId, lastTransition } = rawOrderDetailOfDate;

    if (
      status === ESubOrderStatus.canceled ||
      TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition) ||
      (!transactionId && isOrderInProgress)
    ) {
      return result;
    }

    return {
      ...result,
      [subOrderDate]: {
        ...rawOrderDetailOfDate,
      },
    };
  }, {});

  const PCCFee = Object.values(currentOrderDetail).reduce(
    (result, currentOrderDetailOfDate) => {
      const { memberOrders, lineItems = [] } = currentOrderDetailOfDate;
      const PCCFeeOfDate = calculatePCCFeeByDate({
        isGroupOrder,
        memberOrders,
        lineItems,
        hasSpecificPCCFee,
        specificPCCFee,
      });

      return result + PCCFeeOfDate;
    },
    0,
  );
  const actualPCCFee = shouldIncludePITOFee ? PCCFee : 0;
  const { totalPrice = 0, totalDishes = 0 } = calculateTotalPriceAndDishes({
    orderDetail: planOrderDetail,
    isGroupOrder,
    date,
  });

  const PITOPoints = Math.floor(totalPrice / 100000);
  const isOverflowPackage = totalDishes * packagePerMember < totalPrice;
  const serviceFee = date
    ? Math.round(totalPrice * orderServiceFeePercentage)
    : 0;
  const transportFee = 0;
  const promotion = 0;

  const PITOFee = actualPCCFee;
  const totalWithoutVAT =
    totalPrice - serviceFee + transportFee + PITOFee - promotion;

  // * VAT
  const vatPercentage = vatPercentageBaseOnVatSetting({
    vatSetting,
    vatPercentage: orderVATPercentage,
    isPartner,
  });

  const VATFee = calculateVATFee({
    vatPercentage,
    orderProvisionalPrice: totalWithoutVAT,
    orderMenuPrice: totalPrice,
    partnerVATSetting: vatSetting,
    target: isPartner ? 'partner' : 'customer',
  });

  const totalWithVAT = VATFee + totalWithoutVAT;
  const overflow = isOverflowPackage
    ? totalWithVAT - totalDishes * packagePerMember
    : 0;

  return {
    totalPrice,
    totalDishes,
    PITOPoints,
    VATFee: Math.abs(VATFee),
    vatPercentage: Math.abs(vatPercentage),
    totalWithVAT,
    serviceFee,
    transportFee,
    promotion,
    overflow,
    isOverflowPackage,
    totalWithoutVAT,
    PITOFee,
  };
};

const calculateTotalPriceCb = (singleDateSum: number, item: any) =>
  singleDateSum + item.foodPrice * item.frequency;

export const calculatePriceQuotationPartner = ({
  quotation = {},
  serviceFeePercentage = 0,
  orderVATPercentage,
  subOrderDate,
  vatSetting = EPartnerVATSetting.vat,
}: {
  quotation: TQuotation;
  serviceFeePercentage: number;
  orderVATPercentage: number;
  subOrderDate?: string;
  shouldSkipVAT?: boolean;
  vatSetting: EPartnerVATSetting;
}) => {
  const promotion = 0;
  const totalPrice = subOrderDate
    ? quotation[subOrderDate]?.reduce(calculateTotalPriceCb, 0)
    : Object.keys(quotation).reduce((result: number, orderDate: string) => {
        const totalPriceInDate = quotation[orderDate]?.reduce(
          calculateTotalPriceCb,
          0,
        );

        return result + totalPriceInDate;
      }, 0);

  const serviceFee = Math.round((totalPrice * serviceFeePercentage) / 100);
  const totalWithoutVAT = totalPrice - promotion - serviceFee;
  const vatPercentage = vatPercentageBaseOnVatSetting({
    vatSetting,
    vatPercentage: orderVATPercentage,
  });
  const VATFee = calculateVATFee({
    vatPercentage,
    orderProvisionalPrice: totalWithoutVAT,
    orderMenuPrice: totalPrice,
    partnerVATSetting: vatSetting,
    target: 'partner',
  });
  const totalWithVAT = VATFee + totalWithoutVAT;

  return {
    totalPrice,
    VATFee: Math.abs(VATFee),
    serviceFee,
    totalWithoutVAT,
    totalWithVAT,
    promotion,
    vatPercentage: Math.abs(vatPercentage),
  };
};

export const calculatePriceQuotationInfoFromQuotation = ({
  quotation,
  packagePerMember,
  orderVATPercentage,
  orderServiceFeePercentage = 0,
  date,
  partnerId,
  hasSpecificPCCFee,
  specificPCCFee = 0,
  vatSetting = EPartnerVATSetting.vat,
  isPartner = false,
}: {
  quotation: TListing;
  packagePerMember: number;
  orderVATPercentage: number;
  orderServiceFeePercentage?: number;
  date?: number | string;
  partnerId?: string;
  hasSpecificPCCFee: boolean;
  specificPCCFee?: number;
  vatSetting?: EPartnerVATSetting;
  isPartner?: boolean;
}) => {
  const quotationListingGetter = Listing(quotation);
  const { client, partner } = quotationListingGetter.getMetadata();
  if (isEmpty(client) || isEmpty(partner)) {
    return {};
  }

  const isPartnerFlow = date && partnerId;

  const clientQuotation = client.quotation;
  const partnerQuotation = isPartnerFlow
    ? pick(partner[partnerId]?.quotation || {}, date)
    : {};

  const {
    totalPrice = 0,
    totalDishes = 0,
    PITOFee = 0,
  }: any = Object.values(
    isPartnerFlow ? partnerQuotation : clientQuotation,
  ).reduce(
    (result: any, subOrder: any) => {
      const { subOrderTotalPrice, subOrderTotalDished } = subOrder.reduce(
        (subOrderResult: any, item: any) => {
          const { foodPrice, frequency } = item;

          return {
            subOrderTotalPrice:
              subOrderResult.subOrderTotalPrice + foodPrice * frequency,
            subOrderTotalDished: subOrderResult.subOrderTotalDished + frequency,
          };
        },
        {
          subOrderTotalPrice: 0,
          subOrderTotalDished: 0,
        },
      );

      const PCCFeeOfDate = hasSpecificPCCFee
        ? subOrderTotalDished > 0
          ? specificPCCFee
          : 0
        : getPCCFeeByMemberAmount(subOrderTotalDished);

      return {
        totalPrice: result.totalPrice + subOrderTotalPrice,
        totalDishes: result.totalDishes + subOrderTotalDished,
        PITOFee: isPartnerFlow ? 0 : result.PITOFee + PCCFeeOfDate,
      };
    },
    {
      totalPrice: 0,
      totalDishes: 0,
      PITOFee: 0,
    },
  );

  const PITOPoints = Math.floor(totalPrice / 100000);
  const isOverflowPackage = totalDishes * packagePerMember < totalPrice;
  const serviceFee = isPartnerFlow
    ? Math.round(orderServiceFeePercentage * totalPrice)
    : 0;
  const transportFee = 0;
  const promotion = 0;
  const totalWithoutVAT =
    totalPrice - serviceFee + transportFee + PITOFee - promotion;

  // * VAT
  const vatPercentage = vatPercentageBaseOnVatSetting({
    vatSetting,
    vatPercentage: orderVATPercentage,
    isPartner,
  });
  const VATFee = calculateVATFee({
    vatPercentage,
    orderProvisionalPrice: totalWithoutVAT,
    orderMenuPrice: totalPrice,
    partnerVATSetting: vatSetting,
    target: isPartner ? 'partner' : 'customer',
  });
  const totalWithVAT = VATFee + totalWithoutVAT;
  const overflow = isOverflowPackage
    ? totalWithVAT - totalDishes * packagePerMember
    : 0;

  return {
    totalPrice,
    totalDishes,
    PITOPoints,
    VATFee: Math.abs(VATFee),
    totalWithVAT,
    serviceFeePercentage: orderServiceFeePercentage * 100,
    serviceFee,
    transportFee,
    promotion,
    overflow,
    isOverflowPackage,
    totalWithoutVAT,
    PITOFee,
    vatPercentage: Math.abs(vatPercentage),
  };
};
