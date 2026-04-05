/**
 * ORDER HELPER SAFEGUARDS
 *
 * Tests for order utility functions used in the order lifecycle —
 * food selection state, price aggregation, sub-order editing detection,
 * and order detail validation.
 *
 * Source file: src/helpers/orderHelper.ts
 */

import {
  calculateSubOrderPrice,
  checkIsOrderHasInProgressState,
  combineOrderDetailWithPriceInfo,
  getEditedSubOrders,
  getFoodDataMap,
  getIsAllowAddSecondaryFoodInCreateOrder,
  getOrderParticipantNumber,
  getPickFoodParticipants,
  getRestaurantListFromOrderDetail,
  getTotalInfo,
  initLineItemsFromFoodList,
  isCompletePickFood,
  isEnableUpdateBookingInfo,
  isOrderDetailDatePickedFood,
  isOrderDetailFullDatePickingFood,
  markColorForOrder,
  mergeRecommendOrderDetailWithCurrentOrderDetail,
} from '@helpers/orderHelper';
import {
  EBookerOrderDraftStates,
  EOrderDraftStates,
  EOrderStates,
  EOrderType,
  EParticipantOrderStatus,
} from '@utils/enums';
import { ETransition } from '@utils/transaction';

// ---------------------------------------------------------------------------
// isEnableUpdateBookingInfo
// ---------------------------------------------------------------------------

describe('isEnableUpdateBookingInfo', () => {
  it.each([
    EBookerOrderDraftStates.bookerDraft,
    EOrderDraftStates.draft,
    EOrderDraftStates.pendingApproval,
    EOrderStates.picking,
    EOrderStates.inProgress,
  ])('returns true for editable state: %s', (state) => {
    expect(isEnableUpdateBookingInfo(state as any)).toBe(true);
  });

  it.each([
    EOrderStates.pendingPayment,
    EOrderStates.completed,
    EOrderStates.canceled,
  ])('returns false for non-editable state: %s', (state) => {
    expect(isEnableUpdateBookingInfo(state as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isOrderDetailDatePickedFood
// ---------------------------------------------------------------------------

describe('isOrderDetailDatePickedFood', () => {
  it('returns true when restaurant id and foodList are non-empty', () => {
    const detail = { restaurant: { id: 'r1', foodList: ['f1'] } };
    expect(isOrderDetailDatePickedFood(detail)).toBe(true);
  });

  it('returns false when foodList is empty', () => {
    const detail = { restaurant: { id: 'r1', foodList: [] } };
    expect(isOrderDetailDatePickedFood(detail)).toBe(false);
  });

  it('returns false when restaurant id is missing', () => {
    const detail = { restaurant: { id: '', foodList: ['f1'] } };
    expect(isOrderDetailDatePickedFood(detail)).toBe(false);
  });

  it('returns false when detail is null', () => {
    expect(isOrderDetailDatePickedFood(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isOrderDetailFullDatePickingFood
// ---------------------------------------------------------------------------

describe('isOrderDetailFullDatePickingFood', () => {
  it('returns true when all dates have non-empty foodList', () => {
    const detail = {
      '2024-03-01': { foodList: ['f1'] },
      '2024-03-02': { foodList: ['f2'] },
    };
    expect(isOrderDetailFullDatePickingFood(detail)).toBe(true);
  });

  it('returns false when any date has empty foodList', () => {
    const detail = {
      '2024-03-01': { foodList: ['f1'] },
      '2024-03-02': { foodList: [] },
    };
    expect(isOrderDetailFullDatePickingFood(detail)).toBe(false);
  });

  it('returns true for empty orderDetail', () => {
    expect(isOrderDetailFullDatePickingFood({})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isCompletePickFood
// ---------------------------------------------------------------------------

describe('isCompletePickFood', () => {
  const PARTICIPANT = 'user-001';

  const joined = {
    memberOrders: {
      [PARTICIPANT]: { foodId: 'f1', status: EParticipantOrderStatus.joined },
    },
  };

  const notJoined = {
    memberOrders: {
      [PARTICIPANT]: { foodId: '', status: EParticipantOrderStatus.notJoined },
    },
  };

  it('returns true when participant has joined all dates', () => {
    expect(
      isCompletePickFood({
        participantId: PARTICIPANT,
        orderDetail: { d1: joined, d2: joined },
      }),
    ).toBe(true);
  });

  it('returns false when participant has not joined a date', () => {
    expect(
      isCompletePickFood({
        participantId: PARTICIPANT,
        orderDetail: { d1: joined, d2: notJoined },
      }),
    ).toBe(false);
  });

  it('returns true for empty orderDetail (0 === 0)', () => {
    expect(
      isCompletePickFood({ participantId: PARTICIPANT, orderDetail: {} }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTotalInfo
// ---------------------------------------------------------------------------

describe('getTotalInfo', () => {
  it('sums totalPrice and totalDishes from food data list', () => {
    const data = [
      { foodId: 'f1', frequency: 3, foodPrice: 50_000 },
      { foodId: 'f2', frequency: 2, foodPrice: 80_000 },
    ];
    const result = getTotalInfo(data as any);
    expect(result.totalDishes).toBe(5);
    expect(result.totalPrice).toBe(3 * 50_000 + 2 * 80_000); // 310,000
  });

  it('returns zeros for empty list', () => {
    expect(getTotalInfo([])).toEqual({ totalDishes: 0, totalPrice: 0 });
  });
});

// ---------------------------------------------------------------------------
// getFoodDataMap
// ---------------------------------------------------------------------------

describe('getFoodDataMap', () => {
  describe('group order', () => {
    const foodListOfDate = {
      f1: { foodName: 'Cơm gà', foodPrice: 50_000, numberOfMainDishes: 1 },
      f2: { foodName: 'Phở bò', foodPrice: 60_000, numberOfMainDishes: 1 },
    };

    it('counts frequency of each joined food', () => {
      const memberOrders = {
        u1: { foodId: 'f1', status: EParticipantOrderStatus.joined },
        u2: { foodId: 'f1', status: EParticipantOrderStatus.joined },
        u3: { foodId: 'f2', status: EParticipantOrderStatus.joined },
      };
      const result = getFoodDataMap({ foodListOfDate, memberOrders });
      expect(result.f1.frequency).toBe(2);
      expect(result.f2.frequency).toBe(1);
    });

    it('excludes members who have not joined', () => {
      const memberOrders = {
        u1: { foodId: 'f1', status: EParticipantOrderStatus.joined },
        u2: { foodId: 'f1', status: EParticipantOrderStatus.notJoined },
      };
      const result = getFoodDataMap({ foodListOfDate, memberOrders });
      expect(result.f1.frequency).toBe(1);
    });

    it('returns empty map when no members joined', () => {
      const memberOrders = {
        u1: { foodId: '', status: EParticipantOrderStatus.notJoined },
      };
      expect(getFoodDataMap({ foodListOfDate, memberOrders })).toEqual({});
    });
  });

  describe('normal order (lineItems)', () => {
    it('maps lineItems to food data by id', () => {
      const lineItems = [
        { id: 'f1', name: 'Cơm', quantity: 5, unitPrice: 50_000 },
      ];
      const result = getFoodDataMap({
        foodListOfDate: {},
        memberOrders: {},
        orderType: EOrderType.normal,
        lineItems,
      });
      expect(result.f1.frequency).toBe(5);
      expect(result.f1.foodName).toBe('Cơm');
    });
  });
});

// ---------------------------------------------------------------------------
// calculateSubOrderPrice
// ---------------------------------------------------------------------------

describe('calculateSubOrderPrice', () => {
  it('calculates total for group order from memberOrders', () => {
    const data = {
      memberOrders: {
        u1: { foodId: 'f1', status: EParticipantOrderStatus.joined },
        u2: { foodId: 'f1', status: EParticipantOrderStatus.joined },
      },
      restaurant: {
        foodList: {
          f1: { foodName: 'Cơm gà', foodPrice: 50_000, numberOfMainDishes: 1 },
        },
      },
    };
    const result = calculateSubOrderPrice({ data });
    expect(result.totalDishes).toBe(2);
    expect(result.totalPrice).toBe(100_000);
  });

  it('calculates total for normal order from lineItems', () => {
    const data = {
      memberOrders: {},
      restaurant: { foodList: {} },
      // Three separate line items (quantity=1 each, price per item)
      lineItems: [
        { quantity: 1, price: 60_000 },
        { quantity: 1, price: 60_000 },
        { quantity: 1, price: 60_000 },
      ],
    };
    const result = calculateSubOrderPrice({
      data,
      orderType: EOrderType.normal,
    });
    expect(result.totalDishes).toBe(3);
    expect(result.totalPrice).toBe(180_000);
  });
});

// ---------------------------------------------------------------------------
// combineOrderDetailWithPriceInfo
// ---------------------------------------------------------------------------

describe('combineOrderDetailWithPriceInfo', () => {
  it('adds totalPrice and totalDishes to each date entry', () => {
    const orderDetail = {
      '2024-03-01': {
        memberOrders: {
          u1: { foodId: 'f1', status: EParticipantOrderStatus.joined },
        },
        restaurant: {
          foodList: {
            f1: { foodName: 'Cơm', foodPrice: 50_000, numberOfMainDishes: 1 },
          },
        },
      },
    };
    const result = combineOrderDetailWithPriceInfo({ orderDetail });
    expect(result['2024-03-01'].totalPrice).toBe(50_000);
    expect(result['2024-03-01'].totalDishes).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getRestaurantListFromOrderDetail
// ---------------------------------------------------------------------------

describe('getRestaurantListFromOrderDetail', () => {
  it('returns map of unique restaurant names', () => {
    const orderDetail = {
      d1: { restaurant: { restaurantName: 'Cơm Văn Phòng' } },
      d2: { restaurant: { restaurantName: 'Cơm Văn Phòng' } },
      d3: { restaurant: { restaurantName: 'Phở Hà Nội' } },
    };
    const result = getRestaurantListFromOrderDetail(orderDetail as any);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['Cơm Văn Phòng']).toBe(true);
    expect(result['Phở Hà Nội']).toBe(true);
  });

  it('returns empty object when orderDetail is empty', () => {
    expect(getRestaurantListFromOrderDetail({} as any)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// markColorForOrder
// ---------------------------------------------------------------------------

describe('markColorForOrder', () => {
  it('returns a color string for order number', () => {
    expect(typeof markColorForOrder(0)).toBe('string');
    expect(markColorForOrder(0)).toMatch(/^#/);
  });

  it('cycles through 5 colors (mod 5)', () => {
    expect(markColorForOrder(0)).toBe(markColorForOrder(5));
    expect(markColorForOrder(1)).toBe(markColorForOrder(6));
  });

  it('produces different colors for different order numbers (within cycle)', () => {
    const colors = [0, 1, 2, 3, 4].map(markColorForOrder);
    expect(new Set(colors).size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getPickFoodParticipants
// ---------------------------------------------------------------------------

describe('getPickFoodParticipants', () => {
  it('returns unique participant IDs who have picked food', () => {
    const orderDetail = {
      d1: {
        memberOrders: {
          u1: { foodId: 'f1' },
          u2: { foodId: '' },
        },
      },
      d2: {
        memberOrders: {
          u1: { foodId: 'f2' },
          u3: { foodId: 'f1' },
        },
      },
    };
    const result = getPickFoodParticipants(orderDetail);
    expect(result).toContain('u1');
    expect(result).toContain('u3');
    expect(result).not.toContain('u2');
    // u1 appears in both dates but deduplicated
    expect(result.filter((id) => id === 'u1')).toHaveLength(1);
  });

  it('returns empty array when no one has picked food', () => {
    const orderDetail = {
      d1: { memberOrders: { u1: { foodId: '' } } },
    };
    expect(getPickFoodParticipants(orderDetail)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getEditedSubOrders
// ---------------------------------------------------------------------------

describe('getEditedSubOrders', () => {
  it('returns only dates with oldValues and INITIATE_TRANSACTION transition', () => {
    const orderDetail = {
      '2024-03-01': {
        oldValues: { some: 'data' },
        lastTransition: ETransition.INITIATE_TRANSACTION,
      },
      '2024-03-02': {
        oldValues: {},
        lastTransition: ETransition.INITIATE_TRANSACTION,
      },
      '2024-03-03': {
        oldValues: { some: 'data' },
        lastTransition: ETransition.START_DELIVERY,
      },
    };
    const result = getEditedSubOrders(orderDetail);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['2024-03-01']).toBeDefined();
  });

  it('returns empty object when no edits match criteria', () => {
    const orderDetail = {
      d1: { oldValues: {}, lastTransition: ETransition.INITIATE_TRANSACTION },
    };
    expect(getEditedSubOrders(orderDetail)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// checkIsOrderHasInProgressState
// ---------------------------------------------------------------------------

describe('checkIsOrderHasInProgressState', () => {
  it('returns true if any history item has inProgress state', () => {
    const history = [
      { state: EOrderStates.picking, timestamp: 1 },
      { state: EOrderStates.inProgress, timestamp: 2 },
    ];
    expect(checkIsOrderHasInProgressState(history as any)).toBe(true);
  });

  it('returns false when no inProgress state in history', () => {
    const history = [
      { state: EOrderStates.picking, timestamp: 1 },
      { state: EOrderStates.completed, timestamp: 2 },
    ];
    expect(checkIsOrderHasInProgressState(history as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mergeRecommendOrderDetailWithCurrentOrderDetail
// ---------------------------------------------------------------------------

describe('mergeRecommendOrderDetailWithCurrentOrderDetail', () => {
  const current = {
    '2024-03-01': {
      memberOrders: { u1: { foodId: 'f1' } },
      restaurant: { id: 'r-old' },
    },
    '2024-03-02': { memberOrders: {}, restaurant: { id: 'r-old' } },
  };

  const recommend = {
    '2024-03-01': { restaurant: { id: 'r-new' }, hasNoRestaurants: false },
    '2024-03-02': { restaurant: {}, hasNoRestaurants: true },
  };

  it('merges recommend restaurant into current when not empty', () => {
    const result = mergeRecommendOrderDetailWithCurrentOrderDetail(
      current,
      recommend,
    );
    expect(result['2024-03-01'].restaurant.id).toBe('r-new');
  });

  it('keeps current restaurant when recommend restaurant is empty', () => {
    const result = mergeRecommendOrderDetailWithCurrentOrderDetail(
      current,
      recommend,
    );
    expect(result['2024-03-02'].restaurant.id).toBe('r-old');
  });

  it('merges only the specified timestamp when timestamp is provided', () => {
    const result = mergeRecommendOrderDetailWithCurrentOrderDetail(
      current,
      recommend,
      '2024-03-01',
    );
    expect(result['2024-03-01'].restaurant.id).toBe('r-new');
    // other dates come from current untouched
    expect(result['2024-03-02'].restaurant.id).toBe('r-old');
  });
});

// ---------------------------------------------------------------------------
// initLineItemsFromFoodList
// ---------------------------------------------------------------------------

describe('initLineItemsFromFoodList', () => {
  const foodList = {
    f1: { foodName: 'Cơm gà', foodPrice: 50_000 },
    f2: { foodName: 'Phở bò', foodPrice: 60_000 },
  };

  it('creates lineItem entries with quantity=1 for normal order', () => {
    const result = initLineItemsFromFoodList(foodList as any, true);
    expect(result).toHaveLength(2);
    expect(result[0].quantity).toBe(1);
    expect(result[0].unitPrice).toBe(result[0].price);
  });

  it('returns empty array when isNormalOrder=false', () => {
    expect(initLineItemsFromFoodList(foodList as any, false)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getIsAllowAddSecondaryFoodInCreateOrder
// ---------------------------------------------------------------------------

describe('getIsAllowAddSecondaryFoodInCreateOrder', () => {
  it('returns false for empty companyId', () => {
    expect(getIsAllowAddSecondaryFoodInCreateOrder('')).toBe(false);
  });

  it('returns false for companyId not in allowed list', () => {
    expect(getIsAllowAddSecondaryFoodInCreateOrder('not-in-allowed-list')).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// getOrderParticipantNumber
// ---------------------------------------------------------------------------

describe('getOrderParticipantNumber', () => {
  it('returns 0 for empty memberOrders', () => {
    expect(getOrderParticipantNumber({})).toBe(0);
  });

  it('counts only joined members', () => {
    const memberOrders = {
      u1: { foodId: 'f1', status: EParticipantOrderStatus.joined },
      u2: { foodId: 'f2', status: EParticipantOrderStatus.joined },
      u3: { foodId: '', status: EParticipantOrderStatus.notJoined },
    };
    expect(getOrderParticipantNumber(memberOrders as any)).toBe(2);
  });

  it('returns 0 when no members have joined', () => {
    const memberOrders = {
      u1: { foodId: '', status: EParticipantOrderStatus.notJoined },
    };
    expect(getOrderParticipantNumber(memberOrders as any)).toBe(0);
  });
});
