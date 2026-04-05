/**
 * GROUP FOOD ORDER BY DATE SAFEGUARDS
 *
 * These tests protect the groupFoodOrderByDate helper in orderDetailHelper.ts.
 * This function is the primary data-shaping step before rendering order summaries,
 * quotations, and partner/admin reports. It aggregates food frequency across all
 * delivery dates from two different data sources depending on order type:
 *
 *   - Group order: reads memberOrders and aggregates food selections into a
 *     frequency map via getFoodDataMap.
 *   - Normal order: reads lineItems directly.
 *
 * In both modes, sub-orders with status === 'canceled' are skipped entirely.
 * An optional `date` parameter narrows the result to a single date.
 *
 * NOTE: orderDetailHelper.ts imports generateScannerBarCode from a Next.js API
 * route that uses Node crypto internally, but groupFoodOrderByDate itself does
 * not invoke that function — these tests are safe to run in the ts-jest environment.
 *
 * Source: src/helpers/order/orderDetailHelper.ts — groupFoodOrderByDate
 */

import { groupFoodOrderByDate } from '@helpers/order/orderDetailHelper';
import { EParticipantOrderStatus, ESubOrderStatus } from '@utils/enums';

const joined = EParticipantOrderStatus.joined;

describe('groupFoodOrderByDate', () => {
  it('returns an empty array for an empty orderDetail', () => {
    expect(
      groupFoodOrderByDate({ orderDetail: {}, isGroupOrder: true }),
    ).toEqual([]);
    expect(
      groupFoodOrderByDate({ orderDetail: {}, isGroupOrder: false }),
    ).toEqual([]);
  });

  describe('group order', () => {
    it('aggregates two members choosing the same food into frequency=2', () => {
      const orderDetail = {
        '1700000000000': {
          restaurant: {
            id: 'restaurant-1',
            restaurantName: 'Test Restaurant',
            foodList: {
              'food-1': {
                foodName: 'Cơm sườn',
                foodPrice: 55_000,
                numberOfMainDishes: 1,
              },
            },
          },
          memberOrders: {
            user1: { foodId: 'food-1', status: joined },
            user2: { foodId: 'food-1', status: joined },
          },
        },
      };

      const result = groupFoodOrderByDate({ orderDetail, isGroupOrder: true });

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('1700000000000');
      expect(result[0].foodDataList).toHaveLength(1);
      expect(result[0].foodDataList[0].frequency).toBe(2);
      expect(result[0].foodDataList[0].foodName).toBe('Cơm sườn');
    });

    it('skips a sub-order whose status is canceled', () => {
      const orderDetail = {
        '1700000000000': {
          status: ESubOrderStatus.canceled,
          restaurant: {
            id: 'restaurant-1',
            restaurantName: 'Test Restaurant',
            foodList: {
              'food-1': {
                foodName: 'Cơm sườn',
                foodPrice: 55_000,
                numberOfMainDishes: 1,
              },
            },
          },
          memberOrders: {
            user1: { foodId: 'food-1', status: joined },
          },
        },
      };

      const result = groupFoodOrderByDate({ orderDetail, isGroupOrder: true });

      expect(result).toHaveLength(0);
    });

    it('returns only the matching date when the date filter is provided', () => {
      const orderDetail = {
        '1700000000000': {
          restaurant: {
            id: 'restaurant-1',
            restaurantName: 'Restaurant A',
            foodList: {
              'food-1': {
                foodName: 'Cơm sườn',
                foodPrice: 55_000,
                numberOfMainDishes: 1,
              },
            },
          },
          memberOrders: {
            user1: { foodId: 'food-1', status: joined },
          },
        },
        '1700086400000': {
          restaurant: {
            id: 'restaurant-1',
            restaurantName: 'Restaurant A',
            foodList: {
              'food-2': {
                foodName: 'Bún bò',
                foodPrice: 60_000,
                numberOfMainDishes: 1,
              },
            },
          },
          memberOrders: {
            user1: { foodId: 'food-2', status: joined },
          },
        },
      };

      const result = groupFoodOrderByDate({
        orderDetail,
        isGroupOrder: true,
        date: '1700000000000',
      });

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('1700000000000');
    });
  });

  describe('normal order', () => {
    it('builds foodDataList from lineItems with correct totals', () => {
      const orderDetail = {
        '1700000000000': {
          restaurant: {
            id: 'restaurant-1',
            restaurantName: 'Test Restaurant',
            foodList: {},
          },
          lineItems: [
            {
              id: 'food-1',
              name: 'Cơm gà',
              quantity: 2,
              unitPrice: 50_000,
              price: 100_000,
            },
            {
              id: 'food-2',
              name: 'Canh chua',
              quantity: 3,
              unitPrice: 20_000,
              price: 60_000,
            },
          ],
        },
      };

      const result = groupFoodOrderByDate({ orderDetail, isGroupOrder: false });

      expect(result).toHaveLength(1);
      expect(result[0].totalDishes).toBe(5);
      expect(result[0].totalPrice).toBe(160_000);
      expect(result[0].foodDataList).toHaveLength(2);
    });

    it('skips a normal-order sub-order whose status is canceled', () => {
      const orderDetail = {
        '1700000000000': {
          status: ESubOrderStatus.canceled,
          restaurant: {
            id: 'restaurant-1',
            restaurantName: 'Test Restaurant',
            foodList: {},
          },
          lineItems: [
            {
              id: 'food-1',
              name: 'Cơm gà',
              quantity: 2,
              unitPrice: 50_000,
              price: 100_000,
            },
          ],
        },
      };

      const result = groupFoodOrderByDate({ orderDetail, isGroupOrder: false });

      expect(result).toHaveLength(0);
    });
  });
});
