/**
 * Safeguard: the menu surcharge (phí phụ thu) is billed to the client only.
 *
 * The surcharge is PITO's markup on top of the partner's base price, so:
 *  - every client-facing total includes it — including the total recomputed
 *    from the quotation when a sub-order is canceled
 *    (`modify-payment-when-cancel-sub-order.service.ts`), which previously
 *    dropped it and overwrote the client payment record with a smaller amount;
 *  - every partner-facing total excludes it — the partner sub-order cart and
 *    the "order updated" email previously showed a fee-inclusive total.
 *
 * Unlike `price-quotation-aggregation.test.ts`, `@helpers/orderHelper` is NOT
 * mocked here: the fee travels through `getFoodDataMap` / `getTotalInfo`.
 */
import omit from 'lodash/omit';

import {
  calculatePriceQuotationInfoFromOrder,
  calculatePriceQuotationInfoFromQuotation,
  calculateTotalPriceAndDishes,
} from '@helpers/order/cartInfoHelper';
import { getTotalInfo } from '@helpers/orderHelper';
import { ensureListing } from '@utils/data';
import {
  EOrderStates,
  EOrderType,
  EParticipantOrderStatus,
  EPartnerVATSetting,
  ESubOrderStatus,
} from '@utils/enums';
import { ETransition } from '@utils/transaction';

const DATE_A = '1710432000000';
const DATE_B = '1710518400000';
const PARTNER_ID = 'restaurant-1';

// Base 75,000 + surcharge 25,000 — the company is billed 100,000 a serving.
const BASE = 75_000;
const FEE = 25_000;

const makeOrder = (orderType: EOrderType) =>
  ensureListing({
    attributes: {
      metadata: {
        packagePerMember: 100_000,
        orderState: EOrderStates.picking,
        orderType,
      },
    },
  });

const groupEntry = {
  memberOrders: {
    u1: { foodId: 'f1', status: EParticipantOrderStatus.joined },
    u2: { foodId: 'f1', status: EParticipantOrderStatus.joined },
  },
  restaurant: {
    id: PARTNER_ID,
    foodList: {
      f1: { foodName: 'Cơm gà', foodPrice: BASE, foodExtraFee: FEE },
    },
  },
  status: ESubOrderStatus.inProgress,
  lastTransition: ETransition.INITIATE_TRANSACTION,
};

const normalEntry = {
  restaurant: { id: PARTNER_ID, foodList: {} },
  lineItems: [
    {
      id: 'f1',
      name: 'Cơm gà',
      quantity: 2,
      unitPrice: BASE,
      price: BASE * 2,
      unitExtraFee: FEE,
    },
  ],
  status: ESubOrderStatus.inProgress,
  lastTransition: ETransition.INITIATE_TRANSACTION,
};

const fromOrder = (
  orderType: EOrderType,
  overrides: Partial<
    Parameters<typeof calculatePriceQuotationInfoFromOrder>[0]
  >,
) =>
  calculatePriceQuotationInfoFromOrder({
    planOrderDetail: {
      [DATE_A]: orderType === EOrderType.group ? groupEntry : normalEntry,
    },
    order: makeOrder(orderType),
    orderVATPercentage: 0.1,
    hasSpecificPCCFee: true,
    specificPCCFee: 0,
    ...overrides,
  });

// ── getTotalInfo ──────────────────────────────────────────────────────────────

describe('getTotalInfo — includeExtraFee', () => {
  const foodDataList = [
    { foodId: 'f1', foodPrice: BASE, foodExtraFee: FEE, frequency: 2 },
  ] as any[];

  it('includes the fee by default (client side)', () => {
    expect(getTotalInfo(foodDataList).totalPrice).toBe(200_000);
  });

  it('drops the fee when includeExtraFee is false (partner side)', () => {
    expect(
      getTotalInfo(foodDataList, { includeExtraFee: false }).totalPrice,
    ).toBe(150_000);
  });
});

// ── calculateTotalPriceAndDishes ──────────────────────────────────────────────

describe('calculateTotalPriceAndDishes — includeExtraFee', () => {
  it.each([
    ['group', true, groupEntry],
    ['normal', false, normalEntry],
  ])(
    '%s order: base only when includeExtraFee is false',
    (_, isGroup, entry) => {
      const orderDetail = { [DATE_A]: entry };

      expect(
        calculateTotalPriceAndDishes({ orderDetail, isGroupOrder: isGroup })
          .totalPrice,
      ).toBe(200_000);
      expect(
        calculateTotalPriceAndDishes({
          orderDetail,
          isGroupOrder: isGroup,
          includeExtraFee: false,
        }).totalPrice,
      ).toBe(150_000);
    },
  );
});

// ── calculatePriceQuotationInfoFromOrder ──────────────────────────────────────

describe('calculatePriceQuotationInfoFromOrder — fee follows the billing side', () => {
  describe.each([EOrderType.group, EOrderType.normal])(
    '%s order',
    (orderType) => {
      it('client total includes the fee', () => {
        const result = fromOrder(orderType, {
          vatSetting: EPartnerVATSetting.vat,
        });

        expect(result.totalPrice).toBe(200_000);
        expect(result.totalWithVAT).toBe(220_000);
      });

      it('partner total (isPartner) excludes the fee in every VAT mode', () => {
        [
          EPartnerVATSetting.vat,
          EPartnerVATSetting.noExportVat,
          EPartnerVATSetting.direct,
        ].forEach((vatSetting) => {
          const result = fromOrder(orderType, {
            isPartner: true,
            vatSetting,
            date: DATE_A,
            shouldIncludePITOFee: false,
          });

          expect(result.totalPrice).toBe(150_000);
        });
      });

      it('includeExtraFee: false excludes the fee without switching VAT rules', () => {
        const result = fromOrder(orderType, {
          includeExtraFee: false,
          date: DATE_A,
          shouldIncludePITOFee: false,
        });

        expect(result.totalPrice).toBe(150_000);
        expect(result.VATFee).toBe(15_000);
      });
    },
  );
});

// ── calculatePriceQuotationInfoFromQuotation ──────────────────────────────────

describe('calculatePriceQuotationInfoFromQuotation — fee follows the billing side', () => {
  const quotationItem = {
    foodId: 'f1',
    foodName: 'Cơm gà',
    foodPrice: BASE,
    foodExtraFee: FEE,
    frequency: 2,
  };

  const makeQuotation = (clientItems: object[]) =>
    ensureListing({
      attributes: {
        metadata: {
          client: {
            quotation: { [DATE_A]: clientItems, [DATE_B]: clientItems },
          },
          partner: {
            [PARTNER_ID]: {
              name: 'Nhà hàng',
              quotation: { [DATE_A]: clientItems, [DATE_B]: clientItems },
            },
          },
        },
      },
    });

  const fromQuotation = (
    overrides: Partial<
      Parameters<typeof calculatePriceQuotationInfoFromQuotation>[0]
    > = {},
  ) =>
    calculatePriceQuotationInfoFromQuotation({
      quotation: makeQuotation([quotationItem]),
      packagePerMember: 100_000,
      orderVATPercentage: 0.1,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
      ...overrides,
    });

  // This is the call `modify-payment-when-cancel-sub-order` makes to overwrite
  // the client payment record — it must agree with the record that
  // `initialize-payment` created from the order (fee included).
  it.each([
    EPartnerVATSetting.vat,
    EPartnerVATSetting.noExportVat,
    EPartnerVATSetting.direct,
  ])('client total includes the fee (%s)', (vatSetting) => {
    const result = fromQuotation({ vatSetting });

    // 2 dates × 2 servings × 100,000
    expect(result.totalPrice).toBe(400_000);
    expect(result.totalWithVAT).toBe(440_000);
    expect(result.isOverflowPackage).toBe(false);
  });

  it('client total matches calculatePriceQuotationInfoFromOrder for the same data', () => {
    const fromOrderTotal = calculatePriceQuotationInfoFromOrder({
      planOrderDetail: { [DATE_A]: groupEntry, [DATE_B]: groupEntry },
      order: makeOrder(EOrderType.group),
      orderVATPercentage: 0.1,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
    }).totalWithVAT;

    expect(fromQuotation().totalWithVAT).toBe(fromOrderTotal);
  });

  it('a quotation item without foodExtraFee stays at base price', () => {
    const legacyItem = omit(quotationItem, 'foodExtraFee');
    const result = fromQuotation({ quotation: makeQuotation([legacyItem]) });

    expect(result.totalPrice).toBe(300_000);
  });

  it('partner flow (date + partnerId) excludes the fee', () => {
    const result = fromQuotation({
      date: DATE_A,
      partnerId: PARTNER_ID,
      isPartner: true,
    });

    expect(result.totalPrice).toBe(150_000);
    expect(result.PITOFee).toBe(0);
  });
});
