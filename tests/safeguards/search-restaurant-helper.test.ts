/**
 * SEARCH RESTAURANT HELPER SAFEGUARDS
 *
 * Tests for parseFoodsFromMenu — the function that converts a menu listing's
 * foodsByDate into TFoodInRestaurant[], which drives restaurant-card price
 * display and budget matching in the booker and participant portals.
 *
 * Critical invariants protected here:
 *  - food.price = base + extraFee (final price shown to booker/participant)
 *  - Partner sees base price only (enforced elsewhere, but this is the source)
 *  - Budget filter (findExactPackagePerMember) compares against final price
 *
 * Source file: src/helpers/searchRestaurantHelper.ts
 */

import { parseFoodsFromMenu } from '@helpers/searchRestaurantHelper';

// ---------------------------------------------------------------------------
// Helpers — build minimal Sharetribe-shaped listing objects
// ---------------------------------------------------------------------------

const makeMenu = (
  restaurantId: string,
  dayOfWeek: string,
  foodIds: string[],
) => ({
  id: { uuid: 'menu-1' },
  attributes: {
    publicData: {
      foodsByDate: {
        [dayOfWeek]: Object.fromEntries(
          foodIds.map((id) => [id, { id, title: '' }]),
        ),
      },
    },
    metadata: { restaurantId },
  },
  images: [],
});

const makeFood = (
  id: string,
  basePrice: number,
  extraFee = 0,
  overrides: Record<string, any> = {},
) => ({
  id: { uuid: id },
  attributes: {
    title: `Food ${id}`,
    price: { amount: basePrice, currency: 'VND' },
    publicData: {
      extraFee,
      minQuantity: 1,
      unit: 'phần',
      numberOfMainDishes: 2,
      ...overrides,
    },
    metadata: {},
  },
  images: [],
});

// ---------------------------------------------------------------------------
// parseFoodsFromMenu — base price
// ---------------------------------------------------------------------------

describe('parseFoodsFromMenu — base price', () => {
  it('returns price equal to base price when extraFee is 0', () => {
    const menu = makeMenu('r1', 'mon', ['f1']);
    const mapFoods = new Map([['f1', makeFood('f1', 50_000, 0)]]);

    const result = parseFoodsFromMenu(menu as any, 'mon', mapFoods as any);

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(50_000);
  });

  it('returns price equal to base price when extraFee is absent', () => {
    const food = makeFood('f1', 50_000);
    delete (food.attributes.publicData as any).extraFee;
    const menu = makeMenu('r1', 'mon', ['f1']);
    const mapFoods = new Map([['f1', food]]);

    const result = parseFoodsFromMenu(menu as any, 'mon', mapFoods as any);

    expect(result[0].price).toBe(50_000);
  });
});

// ---------------------------------------------------------------------------
// parseFoodsFromMenu — extraFee adds to displayed price
// ---------------------------------------------------------------------------

describe('parseFoodsFromMenu — extraFee adds to final price', () => {
  it('sets price = base + extraFee', () => {
    const menu = makeMenu('r1', 'mon', ['f1']);
    const mapFoods = new Map([['f1', makeFood('f1', 50_000, 13_000)]]);

    const result = parseFoodsFromMenu(menu as any, 'mon', mapFoods as any);

    expect(result[0].price).toBe(63_000);
  });

  it('handles multiple foods each with different extra fees', () => {
    const menu = makeMenu('r1', 'mon', ['f1', 'f2']);
    const mapFoods = new Map([
      ['f1', makeFood('f1', 50_000, 10_000)],
      ['f2', makeFood('f2', 80_000, 5_000)],
    ]);

    const result = parseFoodsFromMenu(menu as any, 'mon', mapFoods as any);

    const prices = Object.fromEntries(result.map((f) => [f.foodId, f.price]));
    expect(prices.f1).toBe(60_000);
    expect(prices.f2).toBe(85_000);
  });

  it('returns correct restaurantId on each food item', () => {
    const menu = makeMenu('restaurant-xyz', 'tue', ['f1']);
    const mapFoods = new Map([['f1', makeFood('f1', 40_000, 10_000)]]);

    const result = parseFoodsFromMenu(menu as any, 'tue', mapFoods as any);

    expect(result[0].restaurantId).toBe('restaurant-xyz');
  });
});

// ---------------------------------------------------------------------------
// parseFoodsFromMenu — budget filter uses final price
// ---------------------------------------------------------------------------

describe('parseFoodsFromMenu — findExactPackagePerMember uses final price', () => {
  const options = (packagePerMember: number) => ({
    findExactPackagePerMember: { active: true, packagePerMember },
  });

  it('includes food whose finalPrice matches packagePerMember', () => {
    // base 75,000 + fee 25,000 = 100,000 → matches budget of 100,000
    const menu = makeMenu('r1', 'mon', ['f1']);
    const mapFoods = new Map([['f1', makeFood('f1', 75_000, 25_000)]]);

    const result = parseFoodsFromMenu(
      menu as any,
      'mon',
      mapFoods as any,
      options(100_000),
    );

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(100_000);
  });

  it('excludes food whose finalPrice does not match packagePerMember', () => {
    // base 75,000 + fee 25,000 = 100,000 → does NOT match budget of 80,000
    const menu = makeMenu('r1', 'mon', ['f1']);
    const mapFoods = new Map([['f1', makeFood('f1', 75_000, 25_000)]]);

    const result = parseFoodsFromMenu(
      menu as any,
      'mon',
      mapFoods as any,
      options(80_000),
    );

    expect(result).toHaveLength(0);
  });

  it('does not use base price alone for budget matching when extraFee is set', () => {
    // base 100,000 + fee 20,000 = 120,000 final → does NOT match budget of 100,000
    const menu = makeMenu('r1', 'mon', ['f1']);
    const mapFoods = new Map([['f1', makeFood('f1', 100_000, 20_000)]]);

    const result = parseFoodsFromMenu(
      menu as any,
      'mon',
      mapFoods as any,
      options(100_000),
    );

    expect(result).toHaveLength(0);
  });

  it('skips filter when findExactPackagePerMember.active is false', () => {
    const menu = makeMenu('r1', 'mon', ['f1']);
    const mapFoods = new Map([['f1', makeFood('f1', 50_000, 30_000)]]);

    const result = parseFoodsFromMenu(menu as any, 'mon', mapFoods as any, {
      findExactPackagePerMember: { active: false, packagePerMember: 999_999 },
    });

    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// parseFoodsFromMenu — missing foods in map are skipped
// ---------------------------------------------------------------------------

describe('parseFoodsFromMenu — missing food in map', () => {
  it('skips food IDs that are not in mapFoods', () => {
    const menu = makeMenu('r1', 'mon', ['f1', 'f2']);
    const mapFoods = new Map([['f1', makeFood('f1', 50_000)]]);
    // f2 is not in mapFoods

    const result = parseFoodsFromMenu(menu as any, 'mon', mapFoods as any);

    expect(result).toHaveLength(1);
    expect(result[0].foodId).toBe('f1');
  });
});
