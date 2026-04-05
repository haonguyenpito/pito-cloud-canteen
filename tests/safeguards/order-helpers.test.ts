/**
 * ORDER BUSINESS LOGIC SAFEGUARDS
 *
 * These tests protect critical order lifecycle logic:
 *
 * 1. isJoinedPlan         — determines if a participant has selected food
 *                           (used in price calculation and start-order validation)
 * 2. isEnableUpdateBookingInfo — controls which order states allow editing
 * 3. isEnableToStartOrder — gate before initiating Sharetribe transactions
 *                           (once started, the order is irreversible)
 * 4. calculatePriceQuotationPartner — calculates partner payment amount from quotation
 *
 * Source files:
 *   src/helpers/order/orderPickingHelper.ts — isJoinedPlan
 *   src/helpers/orderHelper.ts              — isEnableUpdateBookingInfo, isEnableToStartOrder
 *   src/helpers/order/cartInfoHelper.ts     — calculatePriceQuotationPartner
 */

import { calculatePriceQuotationPartner } from '@helpers/order/cartInfoHelper';
import { isJoinedPlan } from '@helpers/order/orderPickingHelper';
import {
  isEnableToStartOrder,
  isEnableUpdateBookingInfo,
} from '@helpers/orderHelper';
import type { TPlan } from '@src/utils/orderTypes';
import {
  EBookerOrderDraftStates,
  EOrderDraftStates,
  EOrderStates,
  EParticipantOrderStatus,
  EPartnerVATSetting,
} from '@utils/enums';

// ---------------------------------------------------------------------------
// isJoinedPlan
// ---------------------------------------------------------------------------

describe('isJoinedPlan', () => {
  it('returns true when foodId is set and status is joined', () => {
    expect(isJoinedPlan('food-123', EParticipantOrderStatus.joined)).toBe(true);
  });

  it('returns false when foodId is empty string', () => {
    expect(isJoinedPlan('', EParticipantOrderStatus.joined)).toBe(false);
  });

  it('returns false when status is notJoined', () => {
    expect(isJoinedPlan('food-123', EParticipantOrderStatus.notJoined)).toBe(
      false,
    );
  });

  it('returns false when status is empty', () => {
    expect(isJoinedPlan('food-123', EParticipantOrderStatus.empty)).toBe(false);
  });

  it('returns false when status is expired', () => {
    expect(isJoinedPlan('food-123', EParticipantOrderStatus.expired)).toBe(
      false,
    );
  });

  it('returns false when status is notAllowed', () => {
    expect(isJoinedPlan('food-123', EParticipantOrderStatus.notAllowed)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// isEnableUpdateBookingInfo
// ---------------------------------------------------------------------------

describe('isEnableUpdateBookingInfo', () => {
  const editableStates = [
    EBookerOrderDraftStates.bookerDraft,
    EOrderDraftStates.draft,
    EOrderDraftStates.pendingApproval,
    EOrderStates.picking,
    EOrderStates.inProgress,
  ];

  const nonEditableStates = [
    EOrderStates.canceled,
    EOrderStates.completed,
    EOrderStates.pendingPayment,
    EOrderStates.reviewed,
    EOrderStates.expiredStart,
    EOrderStates.canceledByBooker,
  ];

  editableStates.forEach((state) => {
    it(`returns true for ${state}`, () => {
      expect(isEnableUpdateBookingInfo(state as any)).toBe(true);
    });
  });

  nonEditableStates.forEach((state) => {
    it(`returns false for ${state}`, () => {
      expect(isEnableUpdateBookingInfo(state as any)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isEnableToStartOrder — group order
// ---------------------------------------------------------------------------

describe('isEnableToStartOrder (group order)', () => {
  const baseRestaurant = {
    id: 'restaurant-1',
    restaurantName: 'Test Restaurant',
    foodList: {
      'food-1': {
        foodName: 'Cơm gà',
        foodPrice: 50_000,
        numberOfMainDishes: 1,
      },
    },
  };

  it('returns false for empty orderDetail', () => {
    expect(isEnableToStartOrder({}, true)).toBe(false);
  });

  it('returns false when restaurant is not set up on a date', () => {
    const orderDetail = {
      '1711929600000': {
        restaurant: {},
        memberOrders: {},
        lineItems: [],
      },
    };
    expect(isEnableToStartOrder(orderDetail, true)).toBe(false);
  });

  it('returns false when restaurant is set but no member has joined', () => {
    const orderDetail = {
      '1711929600000': {
        restaurant: baseRestaurant,
        memberOrders: {
          'user-1': { foodId: '', status: EParticipantOrderStatus.empty },
        },
        lineItems: [],
      },
    };
    expect(isEnableToStartOrder(orderDetail, true)).toBe(false);
  });

  it('returns true when restaurant is set and at least one member has joined', () => {
    const orderDetail = {
      '1711929600000': {
        restaurant: baseRestaurant,
        memberOrders: {
          'user-1': {
            foodId: 'food-1',
            status: EParticipantOrderStatus.joined,
          },
        },
        lineItems: [],
      },
    };
    expect(isEnableToStartOrder(orderDetail, true)).toBe(true);
  });

  it('returns true if ANY date has a valid order (not ALL required for group)', () => {
    const orderDetail = {
      '1711929600000': {
        restaurant: baseRestaurant,
        memberOrders: {
          'user-1': {
            foodId: 'food-1',
            status: EParticipantOrderStatus.joined,
          },
        },
        lineItems: [],
      },
      '1712016000000': {
        // second date not set up yet
        restaurant: {},
        memberOrders: {},
        lineItems: [],
      },
    };
    expect(isEnableToStartOrder(orderDetail, true)).toBe(true);
  });

  it('returns true with multiple joined members', () => {
    const orderDetail = {
      '1711929600000': {
        restaurant: baseRestaurant,
        memberOrders: {
          'user-1': {
            foodId: 'food-1',
            status: EParticipantOrderStatus.joined,
          },
          'user-2': {
            foodId: 'food-1',
            status: EParticipantOrderStatus.joined,
          },
          'user-3': { foodId: '', status: EParticipantOrderStatus.notJoined },
        },
        lineItems: [],
      },
    };
    expect(isEnableToStartOrder(orderDetail, true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isEnableToStartOrder — normal (non-group) order
// ---------------------------------------------------------------------------

describe('isEnableToStartOrder (normal order)', () => {
  const baseRestaurant = {
    id: 'restaurant-1',
    restaurantName: 'Test Restaurant',
    foodList: {
      'food-1': {
        foodName: 'Cơm gà',
        foodPrice: 50_000,
        numberOfMainDishes: 1,
      },
    },
    minQuantity: 1,
    maxQuantity: 10,
  };

  it('returns false for empty orderDetail', () => {
    expect(isEnableToStartOrder({}, false)).toBe(false);
  });

  it('returns false when restaurant is not set up', () => {
    const orderDetail = {
      '1711929600000': { restaurant: {}, memberOrders: {}, lineItems: [] },
    };
    expect(isEnableToStartOrder(orderDetail, false)).toBe(false);
  });

  it('returns true when all dates have valid restaurant and quantity in range', () => {
    const orderDetail: TPlan['orderDetail'] = {
      '1711929600000': {
        restaurant: baseRestaurant,
        memberOrders: {},
        lineItems: [
          {
            id: 'food-1',
            name: 'Cơm gà',
            quantity: 5,
            price: 50_000,
            unitPrice: 50_000,
          },
        ],
      },
    };
    expect(isEnableToStartOrder(orderDetail, false)).toBe(true);
  });

  it('returns false when quantity is below minQuantity', () => {
    const orderDetail = {
      '1711929600000': {
        restaurant: { ...baseRestaurant, minQuantity: 5 },
        memberOrders: {},
        lineItems: [
          {
            id: 'food-1',
            name: 'Cơm gà',
            quantity: 3,
            price: 50_000,
            unitPrice: 50_000,
          },
        ],
      },
    };
    expect(isEnableToStartOrder(orderDetail, false)).toBe(false);
  });

  it('returns false when quantity exceeds maxQuantity', () => {
    const orderDetail = {
      '1711929600000': {
        restaurant: { ...baseRestaurant, maxQuantity: 5 },
        memberOrders: {},
        lineItems: [
          {
            id: 'food-1',
            name: 'Cơm gà',
            quantity: 6,
            price: 50_000,
            unitPrice: 50_000,
          },
        ],
      },
    };
    expect(isEnableToStartOrder(orderDetail, false)).toBe(false);
  });

  it('returns true regardless of quantity when isAdminFlow = true', () => {
    const orderDetail: TPlan['orderDetail'] = {
      '1711929600000': {
        restaurant: { ...baseRestaurant, minQuantity: 10, maxQuantity: 10 },
        memberOrders: {},
        lineItems: [
          {
            id: 'food-1',
            name: 'Cơm gà',
            quantity: 1,
            price: 50_000,
            unitPrice: 50_000,
          },
        ], // below min
      },
    };
    expect(isEnableToStartOrder(orderDetail, false, true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculatePriceQuotationPartner
// ---------------------------------------------------------------------------

describe('calculatePriceQuotationPartner', () => {
  // quotation: { [date]: [{ foodId, foodName, foodPrice, frequency }] }
  const quotation = {
    '1711929600000': [
      { foodId: 'f1', foodName: 'Cơm gà', foodPrice: 50_000, frequency: 2 }, // 100,000
      { foodId: 'f2', foodName: 'Phở bò', foodPrice: 30_000, frequency: 1 }, // 30,000
    ],
    '1712016000000': [
      { foodId: 'f1', foodName: 'Cơm gà', foodPrice: 50_000, frequency: 3 }, // 150,000
    ],
  };
  // totalPrice = 280,000

  describe('vat setting — standard VAT on provisional price', () => {
    it('calculates correct totalPrice', () => {
      const result = calculatePriceQuotationPartner({
        quotation,
        serviceFeePercentage: 0,
        orderVATPercentage: 0.1,
        vatSetting: EPartnerVATSetting.vat,
      });
      expect(result.totalPrice).toBe(280_000);
    });

    it('calculates correct totalWithVAT with 10% VAT and no service fee', () => {
      const result = calculatePriceQuotationPartner({
        quotation,
        serviceFeePercentage: 0,
        orderVATPercentage: 0.1,
        vatSetting: EPartnerVATSetting.vat,
      });
      // totalWithoutVAT = 280,000, VATFee = round(280,000 * 0.1) = 28,000
      expect(result.totalWithVAT).toBe(308_000);
      expect(result.VATFee).toBe(28_000);
      expect(result.serviceFee).toBe(0);
    });

    it('deducts service fee before calculating VAT', () => {
      const result = calculatePriceQuotationPartner({
        quotation,
        serviceFeePercentage: 10, // 10%
        orderVATPercentage: 0.1,
        vatSetting: EPartnerVATSetting.vat,
      });
      // serviceFee = round(280,000 * 10 / 100) = 28,000
      // totalWithoutVAT = 280,000 - 28,000 = 252,000
      // VATFee = round(252,000 * 0.1) = 25,200
      // totalWithVAT = 252,000 + 25,200 = 277,200
      expect(result.serviceFee).toBe(28_000);
      expect(result.totalWithoutVAT).toBe(252_000);
      expect(result.totalWithVAT).toBe(277_200);
    });
  });

  describe('direct setting — no VAT', () => {
    it('produces VATFee of 0 and totalWithVAT equals totalWithoutVAT', () => {
      const result = calculatePriceQuotationPartner({
        quotation,
        serviceFeePercentage: 0,
        orderVATPercentage: 0.1,
        vatSetting: EPartnerVATSetting.direct,
      });
      expect(result.VATFee).toBe(0);
      expect(result.totalWithVAT).toBe(result.totalWithoutVAT);
    });
  });

  describe('noExportVat setting — 4% deducted from partner', () => {
    it('results in totalWithVAT being LESS than totalPrice (deduction)', () => {
      const result = calculatePriceQuotationPartner({
        quotation,
        serviceFeePercentage: 0,
        orderVATPercentage: 0.04, // raw vatPercentage; overridden to -0.04 for noExportVat
        vatSetting: EPartnerVATSetting.noExportVat,
      });
      // vatPercentageBaseOnVatSetting(noExportVat, 0.04) = -0.04
      // VATFee = round(MENU_PRICE * -0.04) = round(280,000 * -0.04) = -11,200
      // totalWithVAT = -11,200 + 280,000 = 268,800
      expect(result.totalWithVAT).toBeLessThan(result.totalPrice);
      expect(result.totalWithVAT).toBe(268_800);
      expect(result.VATFee).toBe(11_200); // abs value shown
    });
  });

  describe('subOrderDate filter', () => {
    it('calculates only for the specified date when subOrderDate is provided', () => {
      const result = calculatePriceQuotationPartner({
        quotation,
        serviceFeePercentage: 0,
        orderVATPercentage: 0.1,
        vatSetting: EPartnerVATSetting.vat,
        subOrderDate: '1711929600000', // first date only: 100,000 + 30,000 = 130,000
      });
      expect(result.totalPrice).toBe(130_000);
    });

    it('calculates across all dates when subOrderDate is not provided', () => {
      const result = calculatePriceQuotationPartner({
        quotation,
        serviceFeePercentage: 0,
        orderVATPercentage: 0.1,
        vatSetting: EPartnerVATSetting.vat,
      });
      expect(result.totalPrice).toBe(280_000);
    });
  });

  describe('zero VAT', () => {
    it('returns totalWithVAT equal to totalWithoutVAT when orderVATPercentage is 0', () => {
      const result = calculatePriceQuotationPartner({
        quotation,
        serviceFeePercentage: 0,
        orderVATPercentage: 0,
        vatSetting: EPartnerVATSetting.vat,
      });
      expect(result.VATFee).toBe(0);
      expect(result.totalWithVAT).toBe(result.totalWithoutVAT);
    });
  });
});
