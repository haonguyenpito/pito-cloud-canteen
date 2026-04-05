/**
 * ORDER DETAIL HELPER — QUOTATION & PICKING SAFEGUARDS
 *
 * Tests for the three currently-uncovered exported functions in orderDetailHelper.ts:
 *
 * 1. groupFoodOrderByDateFromQuotation — builds display data from a quotation listing
 *    (used in quotation preview before the order is started)
 * 2. groupPickingOrderByFood — aggregates per-food frequency from memberOrders
 *    (used for partner kitchen display during picking phase)
 * 3. groupPickingOrderByFoodLevels — same as above but split by member groups
 *    (used in the group-order scanner/admin view)
 *
 * Source: src/helpers/order/orderDetailHelper.ts
 */

import {
  groupFoodOrderByDateFromQuotation,
  groupPickingOrderByFood,
  groupPickingOrderByFoodLevels,
} from '@helpers/order/orderDetailHelper';
import { EParticipantOrderStatus, ESubOrderStatus } from '@utils/enums';

// buildFullName can have complex transitive deps — mock it to keep tests isolated
jest.mock('@src/utils/emailTemplate/participantOrderPicking', () => ({
  buildFullName: jest.fn().mockReturnValue('Nguyễn Văn A'),
}));
// generateScannerBarCode uses Node crypto — mock to avoid environment issues
jest.mock('@pages/api/admin/scanner/[planId]/toggle-mode.api', () => ({
  generateScannerBarCode: jest.fn().mockReturnValue('barcode-abc'),
}));

// ---------------------------------------------------------------------------
// Helpers — build minimal Sharetribe-shaped listing objects
// ---------------------------------------------------------------------------

const makeListing = (metadata: Record<string, any>) => ({
  id: { uuid: 'listing-1' },
  type: 'listing' as const,
  attributes: {
    title: 'Test Listing',
    metadata,
    publicData: {},
    protectedData: {},
    privateData: {},
  },
});

const makeParticipant = (id: string) => ({
  id: { uuid: id },
  type: 'user' as const,
  attributes: {
    profile: {
      firstName: 'Văn',
      lastName: 'Nguyễn',
      displayName: 'Nguyễn Văn A',
    },
  },
});

// ---------------------------------------------------------------------------
// groupFoodOrderByDateFromQuotation
// ---------------------------------------------------------------------------

describe('groupFoodOrderByDateFromQuotation', () => {
  it('returns [] when client is empty', () => {
    const quotation = makeListing({
      client: {},
      partner: { 'rest-1': { name: 'R', quotation: {} } },
    });
    expect(
      groupFoodOrderByDateFromQuotation({ quotation: quotation as any }),
    ).toEqual([]);
  });

  it('returns [] when partner is empty', () => {
    const quotation = makeListing({
      client: { quotation: { '2024-01-15': [] } },
      partner: {},
    });
    expect(
      groupFoodOrderByDateFromQuotation({ quotation: quotation as any }),
    ).toEqual([]);
  });

  it('returns [] when both client and partner are missing', () => {
    const quotation = makeListing({});
    expect(
      groupFoodOrderByDateFromQuotation({ quotation: quotation as any }),
    ).toEqual([]);
  });

  it('returns one entry per date with correct totalDishes and totalPrice', () => {
    const foodDataList = [
      { foodId: 'f1', foodName: 'Cơm sườn', foodPrice: 50_000, frequency: 2 },
      { foodId: 'f2', foodName: 'Canh chua', foodPrice: 20_000, frequency: 1 },
    ];
    const quotation = makeListing({
      client: { quotation: { '2024-01-15': foodDataList } },
      partner: {
        'rest-1': {
          name: 'Nhà hàng ABC',
          quotation: { '2024-01-15': foodDataList },
        },
      },
    });

    const result = groupFoodOrderByDateFromQuotation({
      quotation: quotation as any,
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].totalDishes).toBe(3); // 2 + 1
    expect(result[0].totalPrice).toBe(120_000); // 50000*2 + 20000*1
    expect(result[0].foodDataList).toBe(foodDataList);
    expect(result[0].restaurantName).toBe('Nhà hàng ABC');
  });

  it('returns only the matching date when dateFromParams is provided', () => {
    const foodA = [
      { foodId: 'f1', foodName: 'A', foodPrice: 10_000, frequency: 1 },
    ];
    const foodB = [
      { foodId: 'f2', foodName: 'B', foodPrice: 20_000, frequency: 1 },
    ];
    const quotation = makeListing({
      client: {
        quotation: {
          '2024-01-15': foodA,
          '2024-01-16': foodB,
        },
      },
      partner: {
        'rest-1': {
          name: 'Restaurant',
          quotation: {
            '2024-01-15': foodA,
            '2024-01-16': foodB,
          },
        },
      },
    });

    const result = groupFoodOrderByDateFromQuotation({
      quotation: quotation as any,
      date: '2024-01-15',
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].index).toBe(0); // dateFromParams forces index to 0
  });

  it('returns entries for all dates when no date filter is given', () => {
    const foodA = [
      { foodId: 'f1', foodName: 'A', foodPrice: 10_000, frequency: 1 },
    ];
    const foodB = [
      { foodId: 'f2', foodName: 'B', foodPrice: 20_000, frequency: 1 },
    ];
    const quotation = makeListing({
      client: { quotation: { '2024-01-15': foodA, '2024-01-16': foodB } },
      partner: {
        'rest-1': {
          name: 'Restaurant',
          quotation: { '2024-01-15': foodA, '2024-01-16': foodB },
        },
      },
    });

    const result = groupFoodOrderByDateFromQuotation({
      quotation: quotation as any,
    });

    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// groupPickingOrderByFood
// ---------------------------------------------------------------------------

describe('groupPickingOrderByFood', () => {
  it('returns [] for empty orderDetail', () => {
    expect(
      groupPickingOrderByFood({
        orderDetail: {},
        participants: [],
        anonymous: [],
      }),
    ).toEqual([]);
  });

  it('skips a sub-order with canceled status', () => {
    const orderDetail = {
      '2024-01-15': {
        status: ESubOrderStatus.canceled,
        restaurant: { id: 'rest-1', foodList: {} },
        memberOrders: {
          'user-1': { foodId: 'f1', status: EParticipantOrderStatus.joined },
        },
      },
    };

    const result = groupPickingOrderByFood({
      orderDetail,
      participants: [],
      anonymous: [],
    });

    expect(result).toHaveLength(0);
  });

  it('aggregates joined members into a food frequency map', () => {
    const orderDetail = {
      '2024-01-15': {
        restaurant: {
          id: 'rest-1',
          foodList: {
            f1: { foodName: 'Cơm sườn', foodPrice: 50_000, foodUnit: 'suất' },
          },
        },
        memberOrders: {
          'user-1': {
            foodId: 'f1',
            status: EParticipantOrderStatus.joined,
            requirement: '',
          },
          'user-2': {
            foodId: 'f1',
            status: EParticipantOrderStatus.joined,
            requirement: '',
          },
        },
      },
    };
    const participants = [makeParticipant('user-1'), makeParticipant('user-2')];

    const result = groupPickingOrderByFood({
      orderDetail,
      participants: participants as any,
      anonymous: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].foodDataList).toHaveLength(1);
    expect(result[0].foodDataList[0].frequency).toBe(2);
    expect(result[0].foodDataList[0].foodId).toBe('f1');
  });

  it('skips members who have not joined (not EParticipantOrderStatus.joined)', () => {
    const orderDetail = {
      '2024-01-15': {
        restaurant: {
          id: 'rest-1',
          foodList: {
            f1: { foodName: 'Cơm sườn', foodPrice: 50_000, foodUnit: 'suất' },
          },
        },
        memberOrders: {
          'user-1': { foodId: 'f1', status: 'not_joined', requirement: '' },
        },
      },
    };

    const result = groupPickingOrderByFood({
      orderDetail,
      participants: [],
      anonymous: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].foodDataList).toHaveLength(0);
  });

  it('includes secondary food when secondaryFoodId is present', () => {
    const orderDetail = {
      '2024-01-15': {
        restaurant: {
          id: 'rest-1',
          foodList: {
            f1: { foodName: 'Cơm sườn', foodPrice: 50_000, foodUnit: 'suất' },
            f2: { foodName: 'Canh chua', foodPrice: 20_000, foodUnit: 'tô' },
          },
        },
        memberOrders: {
          'user-1': {
            foodId: 'f1',
            secondaryFoodId: 'f2',
            status: EParticipantOrderStatus.joined,
            requirement: '',
            secondaryRequirement: '',
          },
        },
      },
    };

    const result = groupPickingOrderByFood({
      orderDetail,
      participants: [makeParticipant('user-1')] as any,
      anonymous: [],
    });

    expect(result[0].foodDataList).toHaveLength(2);
  });

  it('filters to a specific date when date param is provided', () => {
    const orderDetail = {
      '2024-01-15': {
        restaurant: {
          id: 'rest-1',
          foodList: { f1: { foodName: 'A', foodPrice: 10_000 } },
        },
        memberOrders: {
          'user-1': {
            foodId: 'f1',
            status: EParticipantOrderStatus.joined,
            requirement: '',
          },
        },
      },
      '2024-01-16': {
        restaurant: {
          id: 'rest-1',
          foodList: { f2: { foodName: 'B', foodPrice: 10_000 } },
        },
        memberOrders: {
          'user-1': {
            foodId: 'f2',
            status: EParticipantOrderStatus.joined,
            requirement: '',
          },
        },
      },
    };

    const result = groupPickingOrderByFood({
      orderDetail,
      date: '2024-01-15',
      participants: [],
      anonymous: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
  });
});

// ---------------------------------------------------------------------------
// groupPickingOrderByFoodLevels
// ---------------------------------------------------------------------------

describe('groupPickingOrderByFoodLevels', () => {
  it('returns [] for empty orderDetail', () => {
    expect(
      groupPickingOrderByFoodLevels({
        orderDetail: {},
        participants: [],
        anonymous: [],
        groups: [],
      }),
    ).toEqual([]);
  });

  it('skips a sub-order with canceled status', () => {
    const orderDetail = {
      '2024-01-15': {
        status: ESubOrderStatus.canceled,
        restaurant: { id: 'rest-1', foodList: {} },
        memberOrders: {},
      },
    };

    const result = groupPickingOrderByFoodLevels({
      orderDetail,
      participants: [],
      anonymous: [],
      groups: [],
    });

    expect(result).toHaveLength(0);
  });

  it('returns entries with empty dataOfGroups when groups array is empty', () => {
    const orderDetail = {
      '2024-01-15': {
        restaurant: { id: 'rest-1', foodList: {} },
        memberOrders: {},
      },
    };

    const result = groupPickingOrderByFoodLevels({
      orderDetail,
      participants: [],
      anonymous: [],
      groups: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].dataOfGroups).toEqual([]);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('assigns members to their group and others to the ungrouped bucket', () => {
    const orderDetail = {
      '2024-01-15': {
        restaurant: {
          id: 'rest-1',
          foodList: {
            f1: { foodName: 'Cơm sườn', foodPrice: 50_000, foodUnit: 'suất' },
          },
        },
        memberOrders: {
          'user-1': {
            foodId: 'f1',
            status: EParticipantOrderStatus.joined,
            requirement: '',
          },
          'user-2': {
            foodId: 'f1',
            status: EParticipantOrderStatus.joined,
            requirement: '',
          },
        },
      },
    };

    const groups = [
      { id: 'group-1', name: 'Nhóm A', members: [{ id: 'user-1' }] },
    ];
    const participants = [makeParticipant('user-1'), makeParticipant('user-2')];

    const result = groupPickingOrderByFoodLevels({
      orderDetail,
      participants: participants as any,
      anonymous: [],
      groups,
    });

    expect(result).toHaveLength(1);
    expect(result[0].dataOfGroups).toHaveLength(1);
    expect(result[0].dataOfGroups[0].id).toBe('group-1');
    // user-2 is not in any group — lands in foodDataList
    expect(result[0].foodDataList).toBeDefined();
  });
});
