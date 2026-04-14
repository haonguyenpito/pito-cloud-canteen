/**
 * PRICE QUOTATION AGGREGATION SAFEGUARDS
 *
 * These tests protect the multi-step aggregation functions that produce invoices
 * (charged to companies) and partner payments (paid to restaurants).
 * The individual VAT building blocks are covered in vat-calculation.test.ts.
 * This file guards the aggregation layer on top.
 *
 * Key invariants:
 * - Canceled sub-orders must NEVER contribute to total price or dish count
 *   → Excluded by: status === ESubOrderStatus.canceled  (explicit cancelation)
 *   → Excluded by: lastTransition in TRANSITIONS_TO_STATE_CANCELED (late-stage cancel)
 * - The service fee is deducted from totalPrice BEFORE VAT is applied
 * - calculatePriceQuotationInfoFromQuotation returns {} when client or partner quotation is empty
 * - Partner flow (date + partnerId) uses partner quotation; client flow uses client quotation
 * - PITOFee is zero in partner flow — PITO does not charge itself a commission
 *
 * Source file: src/helpers/order/cartInfoHelper.ts
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  calculatePriceQuotationInfoFromOrder,
  calculatePriceQuotationInfoFromQuotation,
  calculateTotalPriceAndDishes,
} from '@helpers/order/cartInfoHelper';
import { ensureListing } from '@utils/data';
import {
  EOrderStates,
  EOrderType,
  EPartnerVATSetting,
  ESubOrderStatus,
} from '@utils/enums';
import { ETransition } from '@utils/transaction';

jest.mock('@helpers/orderHelper', () => ({
  getFoodDataMap: jest.fn().mockReturnValue({
    'user-1': { foodName: 'pho', price: 50_000, frequency: 1 },
  }),
  getTotalInfo: jest.fn((foodDataList: any[]) => ({
    totalPrice: foodDataList.reduce(
      (s: number, f: any) => s + (f.price ?? 50_000),
      0,
    ),
    totalDishes: foodDataList.length,
  })),
  getOrderParticipantNumber: jest.fn(
    (memberOrders: object) => Object.keys(memberOrders || {}).length,
  ),
  getPCCFeeByMemberAmount: jest.fn((count: number) => count * 5_000),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DATE_A = '1710432000000'; // 2024-03-15 VN
const DATE_B = '1710518400000'; // 2024-03-16 VN

const makeOrder = (meta: object) =>
  ensureListing({ attributes: { metadata: meta } });

const activeNormalEntry = (price: number, quantity: number) => ({
  lineItems: [{ price, quantity }],
  status: ESubOrderStatus.inProgress,
  lastTransition: ETransition.INITIATE_TRANSACTION,
});

const canceledByStatus = (price: number, quantity: number) => ({
  lineItems: [{ price, quantity }],
  status: ESubOrderStatus.canceled,
  lastTransition: ETransition.OPERATOR_CANCEL_PLAN,
});

const canceledByTransition = (
  price: number,
  quantity: number,
  transition: string,
) => ({
  lineItems: [{ price, quantity }],
  status: ESubOrderStatus.inProgress, // status is NOT canceled, but lastTransition is
  lastTransition: transition,
});

const activeGroupEntry = (userId: string, foodId: string) => ({
  memberOrders: { [userId]: { foodId, status: 'joined' } },
  restaurant: { foodList: [] },
  status: ESubOrderStatus.inProgress,
  lastTransition: ETransition.INITIATE_TRANSACTION,
});

const canceledGroupEntry = (userId: string) => ({
  memberOrders: { [userId]: { foodId: 'food-1', status: 'joined' } },
  restaurant: { foodList: [] },
  status: ESubOrderStatus.canceled,
  lastTransition: ETransition.OPERATOR_CANCEL_PLAN,
});

// ── calculateTotalPriceAndDishes — non-group (lineItems) path ─────────────────

describe('calculateTotalPriceAndDishes — non-group order', () => {
  it('sums all active dates when none are canceled', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: activeNormalEntry(50_000, 2),
        [DATE_B]: activeNormalEntry(30_000, 1),
      },
      isGroupOrder: false,
    });

    expect(result.totalPrice).toBe(80_000);
    expect(result.totalDishes).toBe(3);
  });

  it('excludes sub-orders where status === canceled', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: activeNormalEntry(50_000, 2),
        [DATE_B]: canceledByStatus(99_000, 5), // must be excluded
      },
      isGroupOrder: false,
    });

    expect(result.totalPrice).toBe(50_000);
    expect(result.totalDishes).toBe(2);
  });

  it('excludes sub-orders where lastTransition is OPERATOR_CANCEL_PLAN', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: activeNormalEntry(50_000, 2),
        [DATE_B]: canceledByTransition(
          99_000,
          5,
          ETransition.OPERATOR_CANCEL_PLAN,
        ),
      },
      isGroupOrder: false,
    });

    expect(result.totalPrice).toBe(50_000);
    expect(result.totalDishes).toBe(2);
  });

  it('excludes sub-orders where lastTransition is OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: activeNormalEntry(50_000, 2),
        [DATE_B]: canceledByTransition(
          99_000,
          5,
          ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED,
        ),
      },
      isGroupOrder: false,
    });

    expect(result.totalPrice).toBe(50_000);
    expect(result.totalDishes).toBe(2);
  });

  it('excludes sub-orders where lastTransition is OPERATOR_CANCEL_AFTER_PARTNER_REJECTED', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: activeNormalEntry(50_000, 2),
        [DATE_B]: canceledByTransition(
          99_000,
          5,
          ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED,
        ),
      },
      isGroupOrder: false,
    });

    expect(result.totalPrice).toBe(50_000);
    expect(result.totalDishes).toBe(2);
  });

  it('returns zero totals when all sub-orders are canceled', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: canceledByStatus(50_000, 2),
        [DATE_B]: canceledByStatus(30_000, 1),
      },
      isGroupOrder: false,
    });

    expect(result.totalPrice).toBe(0);
    expect(result.totalDishes).toBe(0);
  });

  it('filters to only the specified date when date param is provided', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: activeNormalEntry(50_000, 2),
        [DATE_B]: activeNormalEntry(30_000, 1),
      },
      isGroupOrder: false,
      date: DATE_A,
    });

    expect(result.totalPrice).toBe(50_000);
    expect(result.totalDishes).toBe(2);
  });
});

// ── calculateTotalPriceAndDishes — group (memberOrders) path ──────────────────

describe('calculateTotalPriceAndDishes — group order', () => {
  it('excludes group sub-orders where status === canceled', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: activeGroupEntry('user-1', 'food-1'),
        [DATE_B]: canceledGroupEntry('user-2'), // must be excluded
      },
      isGroupOrder: true,
    });

    // DATE_B is canceled, so only DATE_A key should appear in result
    expect(Object.keys(result)).not.toContain(DATE_B);
    expect(Object.keys(result)).toContain(DATE_A);
  });

  it('excluded canceled group dates do not affect totalDishes count', () => {
    const result = calculateTotalPriceAndDishes({
      orderDetail: {
        [DATE_A]: activeGroupEntry('user-1', 'food-1'),
        [DATE_B]: {
          ...canceledGroupEntry('user-2'),
          lastTransition: ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED,
        },
      },
      isGroupOrder: true,
    });

    // Only DATE_A contributes; getFoodDataMap mock returns 1 food item per date
    expect(result.totalDishes).toBe(1);
  });
});

// ── calculatePriceQuotationInfoFromOrder ──────────────────────────────────────

describe('calculatePriceQuotationInfoFromOrder', () => {
  const baseOrderMeta = {
    packagePerMember: 0,
    orderState: EOrderStates.picking,
    orderType: EOrderType.normal,
  };

  it('computes totalPrice from active sub-orders only', () => {
    const order = makeOrder(baseOrderMeta);
    const orderDetail = {
      [DATE_A]: activeNormalEntry(100_000, 1),
      [DATE_B]: canceledByStatus(999_000, 10), // excluded
    };

    const result = calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order,
      orderVATPercentage: 0,
      vatSetting: EPartnerVATSetting.direct,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
    });

    expect(result.totalPrice).toBe(100_000);
  });

  it('applies zero VAT (direct setting) — totalWithVAT equals totalWithoutVAT', () => {
    const order = makeOrder(baseOrderMeta);
    const orderDetail = { [DATE_A]: activeNormalEntry(100_000, 1) };

    const result = calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order,
      orderVATPercentage: 0,
      vatSetting: EPartnerVATSetting.direct,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
    });

    expect(result.VATFee).toBe(0);
    expect(result.totalWithVAT).toBe(result.totalWithoutVAT);
  });

  it('applies 10% VAT (vat setting) on totalWithoutVAT', () => {
    const order = makeOrder(baseOrderMeta);
    const orderDetail = { [DATE_A]: activeNormalEntry(100_000, 1) };

    const result = calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order,
      orderVATPercentage: 0.1,
      vatSetting: EPartnerVATSetting.vat,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
    });

    // totalWithoutVAT = 100,000 (no service fee, no PITOFee)
    expect(result.VATFee).toBe(10_000);
    expect(result.totalWithVAT).toBe(110_000);
  });

  it('omits PITOFee from total when shouldIncludePITOFee is false', () => {
    const order = makeOrder(baseOrderMeta);
    const orderDetail = { [DATE_A]: activeNormalEntry(100_000, 2) };

    const withFee = calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order,
      orderVATPercentage: 0,
      vatSetting: EPartnerVATSetting.direct,
      hasSpecificPCCFee: false,
      specificPCCFee: 0,
      shouldIncludePITOFee: true,
    });

    const withoutFee = calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order,
      orderVATPercentage: 0,
      vatSetting: EPartnerVATSetting.direct,
      hasSpecificPCCFee: false,
      specificPCCFee: 0,
      shouldIncludePITOFee: false,
    });

    expect(withoutFee.PITOFee).toBe(0);
    expect(withFee.PITOFee).toBeGreaterThanOrEqual(0);
    // Without fee the total should be lower or equal
    expect(withoutFee.totalWithVAT).toBeLessThanOrEqual(withFee.totalWithVAT);
  });

  it('excludes sub-orders with no transactionId when order is inProgress', () => {
    const inProgressOrder = makeOrder({
      ...baseOrderMeta,
      orderState: EOrderStates.inProgress,
    });

    const orderDetail = {
      [DATE_A]: {
        lineItems: [{ price: 100_000, quantity: 1 }],
        status: ESubOrderStatus.inProgress,
        lastTransition: ETransition.START_DELIVERY,
        transactionId: 'tx-1', // has transaction → included in PCCFee calculation
      },
      [DATE_B]: {
        lineItems: [{ price: 50_000, quantity: 1 }],
        status: ESubOrderStatus.inProgress,
        lastTransition: ETransition.INITIATE_TRANSACTION,
        transactionId: null, // no transaction → excluded from PCCFee calculation
      },
    };

    const result = calculatePriceQuotationInfoFromOrder({
      planOrderDetail: orderDetail,
      order: inProgressOrder,
      orderVATPercentage: 0,
      vatSetting: EPartnerVATSetting.direct,
      hasSpecificPCCFee: true,
      specificPCCFee: 500,
    });

    // Only DATE_A has a transactionId, so PCCFee should be 500 (one date), not 1000 (two dates)
    expect(result.PITOFee).toBe(500);
  });
});

// ── calculatePriceQuotationInfoFromQuotation ──────────────────────────────────

describe('calculatePriceQuotationInfoFromQuotation', () => {
  const makeQuotationListing = (client: object, partner: object) =>
    ensureListing({ attributes: { metadata: { client, partner } } });

  it('returns empty object when client quotation is empty', () => {
    const quotation = makeQuotationListing(
      {},
      { 'partner-1': { quotation: {} } },
    );

    const result = calculatePriceQuotationInfoFromQuotation({
      quotation,
      packagePerMember: 0,
      orderVATPercentage: 0.1,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
    });

    expect(result).toEqual({});
  });

  it('returns empty object when partner quotation is empty', () => {
    const quotation = makeQuotationListing(
      { quotation: { [DATE_A]: [{ foodPrice: 50_000, frequency: 2 }] } },
      {},
    );

    const result = calculatePriceQuotationInfoFromQuotation({
      quotation,
      packagePerMember: 0,
      orderVATPercentage: 0.1,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
    });

    expect(result).toEqual({});
  });

  it('client flow: sums all dates in client quotation', () => {
    // 2 dates × 50,000 × 2 portions = 200,000 total
    const quotation = makeQuotationListing(
      {
        quotation: {
          [DATE_A]: [{ foodPrice: 50_000, frequency: 2 }],
          [DATE_B]: [{ foodPrice: 50_000, frequency: 2 }],
        },
      },
      { 'partner-1': { quotation: {} } },
    );

    const result = calculatePriceQuotationInfoFromQuotation({
      quotation,
      packagePerMember: 0,
      orderVATPercentage: 0,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
    });

    expect(result.totalPrice).toBe(200_000);
    expect(result.totalDishes).toBe(4);
  });

  it('client flow: applies 10% VAT on totalWithoutVAT', () => {
    const quotation = makeQuotationListing(
      { quotation: { [DATE_A]: [{ foodPrice: 100_000, frequency: 1 }] } },
      { 'partner-1': { quotation: {} } },
    );

    const result = calculatePriceQuotationInfoFromQuotation({
      quotation,
      packagePerMember: 0,
      orderVATPercentage: 0.1,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
    });

    expect(result.VATFee).toBe(10_000);
    expect(result.totalWithVAT).toBe(110_000);
  });

  it('partner flow: uses only the specified date and partnerId', () => {
    const quotation = makeQuotationListing(
      { quotation: { [DATE_A]: [{ foodPrice: 50_000, frequency: 2 }] } },
      {
        'partner-1': {
          quotation: {
            [DATE_A]: [{ foodPrice: 45_000, frequency: 2 }],
            [DATE_B]: [{ foodPrice: 45_000, frequency: 2 }], // different date — should be excluded
          },
        },
      },
    );

    const result = calculatePriceQuotationInfoFromQuotation({
      quotation,
      packagePerMember: 0,
      orderVATPercentage: 0,
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
      date: DATE_A,
      partnerId: 'partner-1',
    });

    // Only DATE_A for partner-1: 45,000 × 2 = 90,000
    expect(result.totalPrice).toBe(90_000);
  });

  it('partner flow: PITOFee is always zero (partner does not pay PITO commission)', () => {
    const quotation = makeQuotationListing(
      { quotation: { [DATE_A]: [{ foodPrice: 50_000, frequency: 2 }] } },
      {
        'partner-1': {
          quotation: { [DATE_A]: [{ foodPrice: 45_000, frequency: 2 }] },
        },
      },
    );

    const result = calculatePriceQuotationInfoFromQuotation({
      quotation,
      packagePerMember: 0,
      orderVATPercentage: 0,
      hasSpecificPCCFee: false, // even when PCC fee would apply for client...
      specificPCCFee: 0,
      date: DATE_A,
      partnerId: 'partner-1',
    });

    expect(result.PITOFee).toBe(0);
  });

  it('service fee is deducted from totalPrice BEFORE VAT is applied', () => {
    // totalPrice = 100,000; serviceFeePercentage = 10% → serviceFee = 10,000
    // totalWithoutVAT = 100,000 - 10,000 = 90,000
    // VAT (10%) on 90,000 = 9,000
    const quotation = makeQuotationListing(
      { quotation: { [DATE_A]: [{ foodPrice: 50_000, frequency: 2 }] } },
      {
        'partner-1': {
          quotation: { [DATE_A]: [{ foodPrice: 50_000, frequency: 2 }] },
        },
      },
    );

    const result = calculatePriceQuotationInfoFromQuotation({
      quotation,
      packagePerMember: 0,
      orderVATPercentage: 0.1,
      orderServiceFeePercentage: 0.1, // 10% service fee
      hasSpecificPCCFee: true,
      specificPCCFee: 0,
      date: DATE_A,
      partnerId: 'partner-1',
    });

    expect(result.totalPrice).toBe(100_000);
    expect(result.serviceFee).toBe(10_000);
    expect(result.totalWithoutVAT).toBe(90_000);
    expect(result.VATFee).toBe(9_000);
    expect(result.totalWithVAT).toBe(99_000);
  });
});
