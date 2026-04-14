/**
 * RESTAURANT SUITABILITY SAFEGUARDS
 *
 * These tests protect the isRestaurantStillSuitable helper in orderHelper.ts.
 * This function guards the "recommend restaurant" flow: when a booker changes
 * order parameters after a restaurant has already been selected, it checks
 * whether the previously chosen restaurant is still compatible with the new
 * settings. Returning true means the restaurant is kept; false means it must
 * be cleared and re-selected.
 *
 * The checks run sequentially and short-circuit on the first failure:
 *   1. Restaurant must exist in dayData
 *   2. At least one food item priced at finalPackagePerMember
 *   3. finalMemberAmount within [minQuantity, maxQuantity] (maxQuantity defaults to Infinity)
 *   4. Current nutritions must be a subset of finalNutritions
 *   5. mealType must exactly equal mealTypeValue
 *   6. Delivery session (morning / afternoon) must match between deliveryHour and finalDeliveryHour
 *
 * getDaySessionFromDeliveryTime("7")  → MORNING_SESSION   (07:00 = 25 200 s, range 23 400–37 800)
 * getDaySessionFromDeliveryTime("11") → AFTERNOON_SESSION (11:00 = 39 600 s, range 37 800–50 400)
 *
 * Source: src/helpers/orderHelper.ts — isRestaurantStillSuitable
 */

import { isRestaurantStillSuitable } from '@helpers/orderHelper';

// Minimal valid dayData used as the "all-good" baseline
const validDayData = {
  restaurant: {
    foodList: {
      'food-1': { foodPrice: 55_000 },
    },
    minQuantity: 5,
    maxQuantity: 50,
  },
};

const baseArgs = {
  dayData: validDayData as any,
  finalPackagePerMember: 55_000,
  finalMemberAmount: 20,
  nutritions: ['vegetarian'],
  finalNutritions: ['vegetarian', 'halal'],
  mealType: ['lunch'],
  mealTypeValue: ['lunch'],
  deliveryHour: '11:00-12:00', // session: AFTERNOON
  finalDeliveryHour: '11:30', // session: AFTERNOON
};

describe('isRestaurantStillSuitable', () => {
  it('returns true when all conditions are satisfied', () => {
    expect(isRestaurantStillSuitable(baseArgs)).toBe(true);
  });

  it('returns false when dayData has no restaurant', () => {
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        dayData: {} as any,
      }),
    ).toBe(false);
  });

  it('returns false when no food item has the required price', () => {
    const dayData = {
      restaurant: {
        foodList: {
          'food-1': { foodPrice: 40_000 }, // wrong price
        },
        minQuantity: 5,
        maxQuantity: 50,
      },
    };
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        dayData: dayData as any,
        finalPackagePerMember: 55_000,
      }),
    ).toBe(false);
  });

  it('returns false when finalMemberAmount is below the restaurant minQuantity', () => {
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        finalMemberAmount: 2, // below minQuantity=5
      }),
    ).toBe(false);
  });

  it('returns false when finalMemberAmount is above the restaurant maxQuantity', () => {
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        finalMemberAmount: 100, // above maxQuantity=50
      }),
    ).toBe(false);
  });

  it('returns true for a very large member amount when the restaurant has no maxQuantity (defaults to Infinity)', () => {
    const dayData = {
      restaurant: {
        foodList: {
          'food-1': { foodPrice: 55_000 },
        },
        // no maxQuantity field → defaults to Infinity
        minQuantity: 1,
      },
    };
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        dayData: dayData as any,
        finalMemberAmount: 99_999,
      }),
    ).toBe(true);
  });

  it('returns false when current nutritions are not a subset of finalNutritions', () => {
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        nutritions: ['vegetarian', 'gluten-free'],
        finalNutritions: ['vegetarian'], // 'gluten-free' is missing
      }),
    ).toBe(false);
  });

  it('returns false when mealType does not match mealTypeValue', () => {
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        mealType: ['lunch'],
        mealTypeValue: ['dinner'],
      }),
    ).toBe(false);
  });

  it('returns false when delivery session differs (morning vs afternoon)', () => {
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        deliveryHour: '7:00-8:00', // MORNING_SESSION
        finalDeliveryHour: '11:30', // AFTERNOON_SESSION
      }),
    ).toBe(false);
  });

  it('returns true when both delivery hours resolve to the same morning session', () => {
    expect(
      isRestaurantStillSuitable({
        ...baseArgs,
        deliveryHour: '7:00-8:00', // MORNING_SESSION
        finalDeliveryHour: '7:30', // MORNING_SESSION
      }),
    ).toBe(true);
  });
});
