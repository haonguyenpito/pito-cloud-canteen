/**
 * Safeguard for the one-off backfill of review item 12
 * (scripts/backfill-menu-min-food-price.js). The script is plain Node so it
 * can run without the app build; it must compute exactly what the app writes.
 */
import { getMinBillablePrice as appGetMinBillablePrice } from '@helpers/menuExtraFee';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  computeMinFoodPriceChanges,
  getMinBillablePrice,
} = require('../../scripts/backfill-menu-min-food-price');

const FOOD_A = 'food-a';
const FOOD_B = 'food-b';

describe('backfill-menu-min-food-price', () => {
  it('matches the app helper', () => {
    const cases: [any[], Record<string, number>][] = [
      [[], {}],
      [[{ foodId: FOOD_A, price: 45_000 }], {}],
      [
        [
          { foodId: FOOD_A, price: 45_000 },
          { foodId: FOOD_B, price: 48_000 },
        ],
        { [FOOD_A]: 10_000, [FOOD_B]: 0 },
      ],
    ];

    cases.forEach(([foods, fees]) => {
      expect(getMinBillablePrice(foods, fees)).toBe(
        appGetMinBillablePrice(foods, fees),
      );
    });
  });

  it('returns only the days whose stored value is wrong', () => {
    expect(
      computeMinFoodPriceChanges({
        publicData: {
          foodExtraFees: { [FOOD_A]: 10_000 },
          monMinFoodPrice: 45_000, // base-price minimum — stale
          tueMinFoodPrice: 48_000, // already correct
        },
        metadata: {
          monFoodIdList: [FOOD_A, FOOD_B],
          tueFoodIdList: [FOOD_B],
        },
        priceByFoodId: { [FOOD_A]: 45_000, [FOOD_B]: 48_000 },
      }),
    ).toEqual({ monMinFoodPrice: 48_000 });
  });

  it('leaves a day untouched when none of its dishes resolve', () => {
    expect(
      computeMinFoodPriceChanges({
        publicData: { foodExtraFees: { [FOOD_A]: 10_000 }, monMinFoodPrice: 1 },
        metadata: { monFoodIdList: ['deleted-food'] },
        priceByFoodId: {},
      }),
    ).toEqual({});
  });

  it('ignores junk fees like the app does', () => {
    expect(
      computeMinFoodPriceChanges({
        publicData: { foodExtraFees: { [FOOD_A]: 'abc', [FOOD_B]: -5 } },
        metadata: { monFoodIdList: [FOOD_A, FOOD_B] },
        priceByFoodId: { [FOOD_A]: 45_000, [FOOD_B]: 48_000 },
      }),
    ).toEqual({ monMinFoodPrice: 45_000 });
  });
});
