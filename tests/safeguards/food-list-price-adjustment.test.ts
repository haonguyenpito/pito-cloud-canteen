/**
 * FOOD LIST PRICE ADJUSTMENT SAFEGUARDS
 *
 * These tests protect the adjustFoodListPrice helper in orderHelper.ts.
 * This function applies a 50% price discount to non-single-selection foods
 * when a company is permitted to add a secondary food selection (dual-pick mode).
 *
 * The logic reads `canAddSecondaryFood` from the order listing's metadata via
 * the Listing data accessor. Single-selection foods (numberOfMainDishes === 1)
 * are always priced at full price regardless of the canAddSecondaryFood flag.
 *
 * A null or undefined foodList input is treated as an empty object to prevent
 * runtime errors when order data is missing.
 *
 * Source: src/helpers/orderHelper.ts — adjustFoodListPrice
 */

import { adjustFoodListPrice } from '@helpers/orderHelper';

/**
 * Creates a minimal TListing-compatible order object that the Listing data
 * accessor can read. canAddSecondaryFood is stored in publicData.metadata.
 */
const makeOrder = (canAddSecondaryFood: boolean) =>
  ({
    id: { uuid: 'order-1' },
    attributes: {
      metadata: { canAddSecondaryFood, companyId: 'company-1' },
    },
  } as any);

describe('adjustFoodListPrice', () => {
  it('returns an empty object when foodList is null', () => {
    expect(adjustFoodListPrice(null as any, makeOrder(true))).toEqual({});
  });

  it('returns an empty object when foodList is undefined', () => {
    expect(adjustFoodListPrice(undefined as any, makeOrder(true))).toEqual({});
  });

  describe('canAddSecondaryFood = false', () => {
    it('leaves all food prices unchanged regardless of numberOfMainDishes', () => {
      const foodList = {
        'food-1': {
          foodName: 'Cơm gà',
          foodPrice: 60_000,
          foodUnit: 'phần',
          numberOfMainDishes: 2,
        },
        'food-2': {
          foodName: 'Cơm sườn',
          foodPrice: 55_000,
          foodUnit: 'phần',
          numberOfMainDishes: 1,
        },
      } as any;

      const result = adjustFoodListPrice(foodList, makeOrder(false));

      expect(result['food-1'].foodPrice).toBe(60_000);
      expect(result['food-2'].foodPrice).toBe(55_000);
    });
  });

  describe('canAddSecondaryFood = true', () => {
    it('halves the price of a multi-dish food (numberOfMainDishes = 2)', () => {
      const foodList = {
        'food-1': {
          foodName: 'Cơm gà',
          foodPrice: 60_000,
          foodUnit: 'phần',
          numberOfMainDishes: 2,
        },
      } as any;

      const result = adjustFoodListPrice(foodList, makeOrder(true));

      expect(result['food-1'].foodPrice).toBe(30_000);
    });

    it('leaves the price unchanged for a single-dish food (numberOfMainDishes = 1)', () => {
      const foodList = {
        'food-1': {
          foodName: 'Cơm sườn',
          foodPrice: 55_000,
          foodUnit: 'phần',
          numberOfMainDishes: 1,
        },
      } as any;

      const result = adjustFoodListPrice(foodList, makeOrder(true));

      expect(result['food-1'].foodPrice).toBe(55_000);
    });

    it('halves the price when numberOfMainDishes is undefined (not single-selection)', () => {
      const foodList = {
        'food-1': {
          foodName: 'Món phụ',
          foodPrice: 20_000,
          foodUnit: 'phần',
          numberOfMainDishes: undefined,
        },
      } as any;

      const result = adjustFoodListPrice(foodList, makeOrder(true));

      expect(result['food-1'].foodPrice).toBe(10_000);
    });
  });
});
