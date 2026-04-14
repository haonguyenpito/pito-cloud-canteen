/**
 * Order validation safeguard tests
 *
 * Tests pure functions that enforce min/max quantity constraints
 * and track user actions during order picking and in-progress states.
 */

// ---------------------------------------------------------------------------
// Module mocks — all factories use only inline jest.fn() (no external refs)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { checkMinMaxQuantityInProgressState } from '@helpers/order/orderInProgressHelper';
import { checkMinMaxQuantityInPickingState } from '@helpers/order/orderPickingHelper';
import { EParticipantOrderStatus } from '@utils/enums';
import { buildExpectedUserPlan, buildUserActions } from '@utils/order';

// planValidations is inferred as `{}` in the source — cast needed to index by date key
type TPlanValidations = Record<
  string,
  {
    planReachMinRestaurantQuantity: boolean;
    planReachMaxRestaurantQuantity: boolean;
  }
>;

jest.mock('@helpers/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@services/integrationHelper', () => ({
  __esModule: true,
  fetchListing: jest.fn(),
  fetchUser: jest.fn(),
}));

jest.mock('@services/slackNotification', () => ({
  __esModule: true,
  createSlackNotification: jest.fn(),
}));

jest.mock('@src/utils/emailTemplate/participantOrderPicking', () => ({
  __esModule: true,
  buildFullName: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  process.env.NEXT_PUBLIC_MAX_ORDER_DETAIL_MODIFIED_PERCENT = '30';
});

// =========================================================================
// 1. checkMinMaxQuantityInPickingState
// =========================================================================

describe('checkMinMaxQuantityInPickingState', () => {
  // -----------------------------------------------------------------------
  // Early exit
  // -----------------------------------------------------------------------

  it('returns all false when isPicking is false', () => {
    const result = checkMinMaxQuantityInPickingState(true, false, {});

    expect(result.planValidations).toEqual({});
    expect(result.orderReachMaxRestaurantQuantity).toBe(false);
    expect(result.orderReachMinRestaurantQuantity).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Normal orders
  // -----------------------------------------------------------------------

  describe('normal orders', () => {
    it('quantity exactly at min boundary is not flagged', () => {
      const orderDetail = {
        '1700000000': {
          lineItems: [
            { id: '', name: '', quantity: 5, price: 0, unitPrice: 0 },
          ],
          restaurant: { minQuantity: 5, maxQuantity: 100 },
          memberOrders: {},
        },
      };

      const result = checkMinMaxQuantityInPickingState(true, true, orderDetail);

      expect(
        (result.planValidations as TPlanValidations)['1700000000']
          .planReachMinRestaurantQuantity,
      ).toBe(false);
      expect(result.orderReachMinRestaurantQuantity).toBe(false);
    });

    it('quantity below min is flagged', () => {
      const orderDetail = {
        '1700000000': {
          lineItems: [
            { id: '', name: '', quantity: 2, price: 0, unitPrice: 0 },
          ],
          restaurant: { minQuantity: 5, maxQuantity: 100 },
          memberOrders: {},
        },
      };

      const result = checkMinMaxQuantityInPickingState(true, true, orderDetail);

      expect(
        (result.planValidations as TPlanValidations)['1700000000']
          .planReachMinRestaurantQuantity,
      ).toBe(true);
      expect(result.orderReachMinRestaurantQuantity).toBe(true);
    });

    it('quantity above max is flagged', () => {
      const orderDetail = {
        '1700000000': {
          lineItems: [
            { id: '', name: '', quantity: 50, price: 0, unitPrice: 0 },
            { id: '', name: '', quantity: 60, price: 0, unitPrice: 0 },
          ],
          restaurant: { minQuantity: 1, maxQuantity: 100 },
          memberOrders: {},
        },
      };

      const result = checkMinMaxQuantityInPickingState(true, true, orderDetail);

      expect(
        (result.planValidations as TPlanValidations)['1700000000']
          .planReachMaxRestaurantQuantity,
      ).toBe(true);
      expect(result.orderReachMaxRestaurantQuantity).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Group orders
  // -----------------------------------------------------------------------

  describe('group orders', () => {
    it('joined count exactly at min is not flagged', () => {
      const orderDetail = {
        '1700000000': {
          memberOrders: {
            user1: {
              foodId: 'food-a',
              status: EParticipantOrderStatus.joined,
            },
            user2: {
              foodId: 'food-b',
              status: EParticipantOrderStatus.joined,
            },
          },
          restaurant: { minQuantity: 2, maxQuantity: 100 },
        },
      };

      const result = checkMinMaxQuantityInPickingState(
        false,
        true,
        orderDetail,
      );

      expect(
        (result.planValidations as TPlanValidations)['1700000000']
          .planReachMinRestaurantQuantity,
      ).toBe(false);
      expect(result.orderReachMinRestaurantQuantity).toBe(false);
    });

    it('joined count below min is flagged', () => {
      const orderDetail = {
        '1700000000': {
          memberOrders: {
            user1: {
              foodId: 'food-a',
              status: EParticipantOrderStatus.joined,
            },
          },
          restaurant: { minQuantity: 3, maxQuantity: 100 },
        },
      };

      const result = checkMinMaxQuantityInPickingState(
        false,
        true,
        orderDetail,
      );

      expect(
        (result.planValidations as TPlanValidations)['1700000000']
          .planReachMinRestaurantQuantity,
      ).toBe(true);
      expect(result.orderReachMinRestaurantQuantity).toBe(true);
    });

    it('members with status empty or notAllowed are not counted', () => {
      const orderDetail = {
        '1700000000': {
          memberOrders: {
            user1: {
              foodId: 'food-a',
              status: EParticipantOrderStatus.joined,
            },
            user2: {
              foodId: 'food-b',
              status: EParticipantOrderStatus.empty,
            },
            user3: {
              foodId: 'food-c',
              status: EParticipantOrderStatus.notAllowed,
            },
            user4: { foodId: '', status: EParticipantOrderStatus.joined },
          },
          restaurant: { minQuantity: 2, maxQuantity: 100 },
        },
      };

      const result = checkMinMaxQuantityInPickingState(
        false,
        true,
        orderDetail,
      );

      // Only user1 qualifies (user2 = empty, user3 = notAllowed, user4 = empty foodId)
      expect(
        (result.planValidations as TPlanValidations)['1700000000']
          .planReachMinRestaurantQuantity,
      ).toBe(true);
      expect(result.orderReachMinRestaurantQuantity).toBe(true);
    });
  });
});

// =========================================================================
// 2. checkMinMaxQuantityInProgressState
// =========================================================================

describe('checkMinMaxQuantityInProgressState', () => {
  /**
   * Helper: wraps raw metadata into a Sharetribe-like listing structure
   * so that Listing(orderData).getMetadata() returns the expected shape.
   */
  const makeListing = (metadata: Record<string, any>) => ({
    id: { uuid: 'listing-1' },
    type: 'listing',
    attributes: { publicData: {}, metadata },
  });

  // -----------------------------------------------------------------------
  // Early exits
  // -----------------------------------------------------------------------

  it('returns all false when orderState is not inProgress', () => {
    const orderData = makeListing({
      orderState: 'picking',
      orderType: 'normal',
    });

    const result = checkMinMaxQuantityInProgressState(orderData, {}, {}, false);

    expect(result.orderReachMaxRestaurantQuantity).toBe(false);
    expect(result.orderReachMinRestaurantQuantity).toBe(false);
    expect(result.orderReachMaxCanModify).toBe(false);
  });

  it('returns all false when isAdminFlow is true', () => {
    const orderData = makeListing({
      orderState: 'inProgress',
      orderType: 'normal',
    });
    const orderDetail = {
      '1700000000': {
        lineItems: [{ id: 'f1', quantity: 1 }],
        restaurant: { minQuantity: 10, maxQuantity: 100 },
      },
    };
    const oldOrderDetail = {
      '1700000000': {
        lineItems: [{ id: 'f1', quantity: 50 }],
        restaurant: { minQuantity: 10, maxQuantity: 100 },
      },
    };

    const result = checkMinMaxQuantityInProgressState(
      orderData,
      orderDetail,
      oldOrderDetail,
      true,
    );

    expect(result.orderReachMinRestaurantQuantity).toBe(false);
    expect(result.orderReachMaxRestaurantQuantity).toBe(false);
    expect(result.orderReachMaxCanModify).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Normal orders — in-progress
  // -----------------------------------------------------------------------

  describe('normal order in-progress', () => {
    it('diff within allowed percent does not flag orderReachMaxCanModify', () => {
      // Old total = 100, 30% => can change up to 30 quantity units
      const orderData = makeListing({
        orderState: 'inProgress',
        orderType: 'normal',
      });
      const oldOrderDetail = {
        '1700000000': {
          lineItems: [{ id: 'f1', quantity: 100 }],
          restaurant: { minQuantity: 1, maxQuantity: 200 },
        },
      };
      // Change quantity by 20 (within 30)
      const orderDetail = {
        '1700000000': {
          lineItems: [{ id: 'f1', quantity: 80 }],
          restaurant: { minQuantity: 1, maxQuantity: 200 },
        },
      };

      const result = checkMinMaxQuantityInProgressState(
        orderData,
        orderDetail,
        oldOrderDetail,
        false,
      );

      expect(result.orderReachMaxCanModify).toBe(false);
    });

    it('diff exceeding allowed percent flags orderReachMaxCanModify', () => {
      // Old total = 100, 30% => can change up to 30 quantity units
      const orderData = makeListing({
        orderState: 'inProgress',
        orderType: 'normal',
      });
      const oldOrderDetail = {
        '1700000000': {
          lineItems: [{ id: 'f1', quantity: 100 }],
          restaurant: { minQuantity: 1, maxQuantity: 200 },
        },
      };
      // Change quantity by 50 (exceeds 30)
      const orderDetail = {
        '1700000000': {
          lineItems: [{ id: 'f1', quantity: 50 }],
          restaurant: { minQuantity: 1, maxQuantity: 200 },
        },
      };

      const result = checkMinMaxQuantityInProgressState(
        orderData,
        orderDetail,
        oldOrderDetail,
        false,
      );

      expect(result.orderReachMaxCanModify).toBe(true);
    });

    it('new quantity below min flags orderReachMinRestaurantQuantity', () => {
      const orderData = makeListing({
        orderState: 'inProgress',
        orderType: 'normal',
      });
      const oldOrderDetail = {
        '1700000000': {
          lineItems: [{ id: 'f1', quantity: 100 }],
          restaurant: { minQuantity: 10, maxQuantity: 200 },
        },
      };
      const orderDetail = {
        '1700000000': {
          lineItems: [{ id: 'f1', quantity: 5 }],
          restaurant: { minQuantity: 10, maxQuantity: 200 },
        },
      };

      const result = checkMinMaxQuantityInProgressState(
        orderData,
        orderDetail,
        oldOrderDetail,
        false,
      );

      expect(result.orderReachMinRestaurantQuantity).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Group orders — in-progress
  // -----------------------------------------------------------------------

  describe('group order in-progress', () => {
    it('member food change exceeding allowed percent flags orderReachMaxCanModify', () => {
      // Old: 10 joined members, 30% => can change up to 3 members
      const orderData = makeListing({
        orderState: 'inProgress',
        orderType: 'group',
      });

      const makeMembers = (count: number, foodPrefix: string) => {
        const members: Record<string, any> = {};
        for (let i = 0; i < count; i++) {
          members[`user${i}`] = {
            foodId: `${foodPrefix}-${i}`,
            status: EParticipantOrderStatus.joined,
          };
        }

        return members;
      };

      const oldMembers = makeMembers(10, 'old-food');
      const newMembers = { ...makeMembers(10, 'old-food') };
      // Change 5 members' food (exceeds 30% of 10 = 3)
      for (let i = 0; i < 5; i++) {
        newMembers[`user${i}`] = {
          foodId: `new-food-${i}`,
          status: EParticipantOrderStatus.joined,
        };
      }

      const oldOrderDetail = {
        '1700000000': {
          memberOrders: oldMembers,
          restaurant: { minQuantity: 1, maxQuantity: 100 },
        },
      };
      const orderDetail = {
        '1700000000': {
          memberOrders: newMembers,
          restaurant: { minQuantity: 1, maxQuantity: 100 },
        },
      };

      const result = checkMinMaxQuantityInProgressState(
        orderData,
        orderDetail,
        oldOrderDetail,
        false,
      );

      expect(result.orderReachMaxCanModify).toBe(true);
    });
  });
});

// =========================================================================
// 3. buildUserActions
// =========================================================================

describe('buildUserActions', () => {
  const userId = 'user-1';

  // -----------------------------------------------------------------------
  // No changes
  // -----------------------------------------------------------------------

  it('returns empty array when nothing changed', () => {
    const planData = {
      day1: {
        [userId]: { status: 'joined', foodId: 'food-a', requirement: '' },
      },
    };
    const oldDetail = {
      day1: {
        memberOrders: {
          [userId]: { status: 'joined', foodId: 'food-a', requirement: '' },
        },
      },
    };

    const actions = buildUserActions(['day1'], planData, userId, oldDetail);

    expect(actions).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Add food
  // -----------------------------------------------------------------------

  it('detects addFood when old has no foodId and new has one', () => {
    const planData = {
      day1: {
        [userId]: { status: 'joined', foodId: 'food-a', requirement: '' },
      },
    };
    const oldDetail = {
      day1: {
        memberOrders: {
          [userId]: { status: 'joined', foodId: '', requirement: '' },
        },
      },
    };

    const actions = buildUserActions(['day1'], planData, userId, oldDetail);

    expect(actions.some((a) => a.type === 'addFood')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Remove food
  // -----------------------------------------------------------------------

  it('detects removeFood when old has foodId and new does not', () => {
    const planData = {
      day1: {
        [userId]: { status: 'joined', foodId: '', requirement: '' },
      },
    };
    const oldDetail = {
      day1: {
        memberOrders: {
          [userId]: { status: 'joined', foodId: 'food-a', requirement: '' },
        },
      },
    };

    const actions = buildUserActions(['day1'], planData, userId, oldDetail);

    expect(actions.some((a) => a.type === 'removeFood')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Change food
  // -----------------------------------------------------------------------

  it('detects changeFood when both have different foodIds', () => {
    const planData = {
      day1: {
        [userId]: { status: 'joined', foodId: 'food-b', requirement: '' },
      },
    };
    const oldDetail = {
      day1: {
        memberOrders: {
          [userId]: { status: 'joined', foodId: 'food-a', requirement: '' },
        },
      },
    };

    const actions = buildUserActions(['day1'], planData, userId, oldDetail);
    const changeFoodAction = actions.find((a) => a.type === 'changeFood');

    expect(changeFoodAction).toBeDefined();
    expect(changeFoodAction!.fromFoodId).toBe('food-a');
    expect(changeFoodAction!.toFoodId).toBe('food-b');
  });

  // -----------------------------------------------------------------------
  // Change requirement
  // -----------------------------------------------------------------------

  it('detects changeRequirement when requirement differs', () => {
    const planData = {
      day1: {
        [userId]: {
          status: 'joined',
          foodId: 'food-a',
          requirement: 'no spicy',
        },
      },
    };
    const oldDetail = {
      day1: {
        memberOrders: {
          [userId]: { status: 'joined', foodId: 'food-a', requirement: '' },
        },
      },
    };

    const actions = buildUserActions(['day1'], planData, userId, oldDetail);

    expect(actions.some((a) => a.type === 'changeRequirement')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Status change
  // -----------------------------------------------------------------------

  it('detects statusChanged when status differs', () => {
    const planData = {
      day1: {
        [userId]: { status: 'joined', foodId: 'food-a', requirement: '' },
      },
    };
    const oldDetail = {
      day1: {
        memberOrders: {
          [userId]: { status: 'empty', foodId: 'food-a', requirement: '' },
        },
      },
    };

    const actions = buildUserActions(['day1'], planData, userId, oldDetail);

    expect(actions.some((a) => a.type === 'statusChanged')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Multiple changes on same day
  // -----------------------------------------------------------------------

  it('produces multiple actions when several fields change on same day', () => {
    const planData = {
      day1: {
        [userId]: {
          status: 'joined',
          foodId: 'food-b',
          requirement: 'extra rice',
        },
      },
    };
    const oldDetail = {
      day1: {
        memberOrders: {
          [userId]: { status: 'empty', foodId: 'food-a', requirement: '' },
        },
      },
    };

    const actions = buildUserActions(['day1'], planData, userId, oldDetail);

    const types = actions.map((a) => a.type);
    expect(types).toContain('statusChanged');
    expect(types).toContain('changeFood');
    expect(types).toContain('changeRequirement');
    expect(actions.length).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Multiple days with different changes
  // -----------------------------------------------------------------------

  it('handles multiple days with different changes', () => {
    const planData = {
      day1: {
        [userId]: { status: 'joined', foodId: 'food-a', requirement: '' },
      },
      day2: {
        [userId]: { status: 'joined', foodId: 'food-c', requirement: '' },
      },
    };
    const oldDetail = {
      day1: {
        memberOrders: {
          [userId]: { status: 'joined', foodId: '', requirement: '' },
        },
      },
      day2: {
        memberOrders: {
          [userId]: { status: 'joined', foodId: 'food-b', requirement: '' },
        },
      },
    };

    const actions = buildUserActions(
      ['day1', 'day2'],
      planData,
      userId,
      oldDetail,
    );

    const day1Actions = actions.filter((a) => a.date === 'day1');
    const day2Actions = actions.filter((a) => a.date === 'day2');
    expect(day1Actions.some((a) => a.type === 'addFood')).toBe(true);
    expect(day2Actions.some((a) => a.type === 'changeFood')).toBe(true);
  });
});

// =========================================================================
// 4. buildExpectedUserPlan
// =========================================================================

describe('buildExpectedUserPlan', () => {
  const userId = 'user-1';

  it('returns correct entries for given days and user', () => {
    const planData = {
      day1: {
        [userId]: { foodId: 'food-a', status: 'joined' },
        'other-user': { foodId: 'food-x', status: 'joined' },
      },
      day2: {
        [userId]: { foodId: 'food-b', status: 'joined' },
      },
    };

    const result = buildExpectedUserPlan(['day1', 'day2'], planData, userId);

    expect(result.day1).toEqual({ foodId: 'food-a', status: 'joined' });
    expect(result.day2).toEqual({ foodId: 'food-b', status: 'joined' });
  });

  it('returns empty object for missing day', () => {
    const planData = {
      day1: {
        [userId]: { foodId: 'food-a', status: 'joined' },
      },
    };

    const result = buildExpectedUserPlan(
      ['day1', 'day-missing'],
      planData,
      userId,
    );

    expect(result.day1).toEqual({ foodId: 'food-a', status: 'joined' });
    expect(result['day-missing']).toEqual({});
  });
});
