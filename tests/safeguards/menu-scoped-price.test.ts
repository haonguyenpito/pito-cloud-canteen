/**
 * MENU-SCOPED PRICE SAFEGUARDS
 *
 * The whole point of moving the extra fee onto the menu is that the SAME dish
 * can cost different amounts in different menus. These tests exercise the read
 * path end to end at the two places money is decided:
 *
 *  - `parseFoodsFromMenu` — the price a booker browses and the value compared
 *    against `packagePerMember`.
 *  - `getSelectedRestaurantAndFoodList` / `getUpdateLineItems` — the snapshot
 *    written into `plan.metadata.orderDetail`, which is what the client is
 *    billed from.
 *
 * If any of these ever read `food.publicData.extraFee` again, a fee set in one
 * menu silently reprices every other menu serving that dish. That regression is
 * exactly what these tests exist to catch.
 *
 * Sources: src/helpers/menuExtraFee.ts, src/helpers/searchRestaurantHelper.ts,
 *          src/helpers/orderHelper.ts
 */

import {
  getBillablePrice,
  getMenuExtraFeeMap,
  getMenuFoodExtraFee,
} from '@helpers/menuExtraFee';
import {
  adjustFoodListPrice,
  getSelectedRestaurantAndFoodList,
  getTotalInfo,
  getUpdateLineItems,
} from '@helpers/orderHelper';
import { parseFoodsFromMenu } from '@helpers/searchRestaurantHelper';
import type { TListing } from '@src/utils/types';

const FOOD_A = 'food-a';
const BASE_PRICE = 50000;

const makeMenu = (foodExtraFees?: Record<string, number>): TListing =>
  ({
    id: { uuid: 'menu-1' },
    type: 'listing',
    attributes: {
      title: 'Menu',
      publicData: {
        foodsByDate: { mon: { [FOOD_A]: { id: FOOD_A } } },
        ...(foodExtraFees ? { foodExtraFees } : {}),
      },
      metadata: { restaurantId: 'restaurant-1' },
    },
  } as unknown as TListing);

/** A dish that still carries a legacy dish-level fee, to prove it is ignored. */
const makeFood = (legacyExtraFee?: number): TListing =>
  ({
    id: { uuid: FOOD_A },
    type: 'listing',
    attributes: {
      title: 'Cơm gà',
      price: { amount: BASE_PRICE, currency: 'VND' },
      publicData: {
        unit: 'phần',
        minQuantity: 1,
        numberOfMainDishes: 2,
        ...(legacyExtraFee === undefined ? {} : { extraFee: legacyExtraFee }),
      },
    },
  } as unknown as TListing);

describe('getMenuExtraFeeMap', () => {
  it('reads the map off the menu', () => {
    expect(getMenuExtraFeeMap(makeMenu({ [FOOD_A]: 15000 }))).toEqual({
      [FOOD_A]: 15000,
    });
  });

  it('keeps a 0 fee and returns 0 for dishes with no entry', () => {
    const menu = makeMenu({ [FOOD_A]: 0 });

    expect(getMenuExtraFeeMap(menu)).toEqual({ [FOOD_A]: 0 });
    expect(getMenuFoodExtraFee(menu, 'unknown-food')).toBe(0);
  });

  it('is empty for a menu with no fees, and for no menu at all', () => {
    expect(getMenuExtraFeeMap(makeMenu())).toEqual({});
    expect(getMenuExtraFeeMap(null)).toEqual({});
    expect(getMenuExtraFeeMap(undefined)).toEqual({});
  });

  it('drops junk values rather than producing NaN prices', () => {
    const menu = makeMenu({ [FOOD_A]: 'abc', 'food-b': -5 } as any);

    expect(getMenuExtraFeeMap(menu)).toEqual({});
  });
});

describe('parseFoodsFromMenu — price is menu-scoped', () => {
  const mapFoods = (food: TListing) => new Map([[FOOD_A, food]]);

  it('prices the same dish differently in two menus', () => {
    const food = makeFood();

    const [morning] = parseFoodsFromMenu(
      makeMenu({ [FOOD_A]: 15000 }),
      'mon',
      mapFoods(food),
    );
    const [lunch] = parseFoodsFromMenu(
      makeMenu({ [FOOD_A]: 20000 }),
      'mon',
      mapFoods(food),
    );

    expect(morning.price).toBe(BASE_PRICE + 15000);
    expect(lunch.price).toBe(BASE_PRICE + 20000);
  });

  it('ignores a legacy dish-level extraFee entirely', () => {
    const [result] = parseFoodsFromMenu(
      makeMenu(),
      'mon',
      mapFoods(makeFood(99000)),
    );

    expect(result.price).toBe(BASE_PRICE);
  });

  it('matches packagePerMember against the fee-inclusive price', () => {
    const found = parseFoodsFromMenu(
      makeMenu({ [FOOD_A]: 15000 }),
      'mon',
      mapFoods(makeFood()),
      {
        findExactPackagePerMember: {
          active: true,
          packagePerMember: BASE_PRICE + 15000,
        },
      },
    );
    expect(found).toHaveLength(1);

    const notFound = parseFoodsFromMenu(
      makeMenu({ [FOOD_A]: 15000 }),
      'mon',
      mapFoods(makeFood()),
      {
        findExactPackagePerMember: {
          active: true,
          packagePerMember: BASE_PRICE,
        },
      },
    );
    expect(notFound).toHaveLength(0);
  });
});

describe('order snapshot — foodExtraFee comes from the menu', () => {
  const currentRestaurant = { id: { uuid: 'restaurant-1' }, attributes: {} };

  it('snapshots the menu fee, not the dish fee', () => {
    const { submitFoodListData } = getSelectedRestaurantAndFoodList({
      foodList: [makeFood(99000)],
      foodIds: [FOOD_A],
      currentRestaurant,
      extraFeeByFoodId: { [FOOD_A]: 15000 },
    });

    expect((submitFoodListData as any)[FOOD_A]).toMatchObject({
      foodPrice: BASE_PRICE,
      foodExtraFee: 15000,
    });
  });

  it('snapshots 0 when the menu does not surcharge the dish', () => {
    const { submitFoodListData } = getSelectedRestaurantAndFoodList({
      foodList: [makeFood(99000)],
      foodIds: [FOOD_A],
      currentRestaurant,
    });

    expect((submitFoodListData as any)[FOOD_A].foodExtraFee).toBe(0);
  });

  it('getUpdateLineItems keeps the base price and carries the menu fee apart', () => {
    // Line items also feed the partner quotation, so `unitPrice` / `price`
    // must stay at the base amount; the markup is billed to the company via
    // `unitExtraFee`.
    const lineItems = getUpdateLineItems([makeFood(99000)], [FOOD_A], {
      [FOOD_A]: 15000,
    });

    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]).toMatchObject({
      id: FOOD_A,
      unitPrice: BASE_PRICE,
      price: BASE_PRICE,
      unitExtraFee: 15000,
    });
  });

  it('getUpdateLineItems writes unitExtraFee 0 when the menu does not surcharge', () => {
    const [lineItem] = getUpdateLineItems([makeFood(99000)], [FOOD_A]);

    expect(lineItem.unitExtraFee).toBe(0);
  });
});

/**
 * Dual-selection companies let a participant split one package across two
 * dishes, so `adjustFoodListPrice` halves the base price. The menu's markup
 * must follow the same rule: charging it twice would silently inflate the bill
 * for exactly those companies, and dropping it (the old behaviour) undercharged.
 */
describe('adjustFoodListPrice — keeps the menu fee', () => {
  const makeOrder = (companyId: string) =>
    ({
      id: { uuid: 'order-1' },
      type: 'listing',
      attributes: { metadata: { companyId } },
    } as unknown as TListing);

  const foodList = {
    [FOOD_A]: {
      foodName: 'Cơm gà',
      foodPrice: BASE_PRICE,
      foodExtraFee: 15000,
      foodUnit: 'phần',
      numberOfMainDishes: 2,
    },
  };

  it('passes the fee through untouched for a normal company', () => {
    const result = adjustFoodListPrice(foodList, makeOrder('not-dual'));

    expect(result[FOOD_A]).toMatchObject({
      foodPrice: BASE_PRICE,
      foodExtraFee: 15000,
    });
  });

  it('never drops the fee', () => {
    const result = adjustFoodListPrice(foodList, makeOrder('not-dual'));

    expect(result[FOOD_A].foodExtraFee).toBeDefined();
  });

  it('defaults a missing fee to 0 rather than undefined', () => {
    const result = adjustFoodListPrice(
      {
        [FOOD_A]: {
          foodName: 'Cơm gà',
          foodPrice: BASE_PRICE,
          foodUnit: 'phần',
          numberOfMainDishes: 2,
        },
      },
      makeOrder('not-dual'),
    );

    expect(result[FOOD_A].foodExtraFee).toBe(0);
  });
});

/**
 * `packagePerMember` is a FEE-INCLUSIVE budget: the partner prices below the
 * package and PITO's markup closes the gap (base 75.000 + fee 25.000 matches a
 * 100.000 budget — see docs/roles/booker/order-creation.md).
 *
 * Billing already works this way: `isOverflowPackage` compares
 * `totalDishes × packagePerMember` against `getTotalInfo`'s fee-inclusive total.
 * Every selection-time filter must use the same basis, otherwise a dish is
 * offered as "within budget" and then trips the overflow check at billing.
 *
 * The comparison OPERATORS are deliberately left alone — admin sourcing asks
 * "which dishes hit this price point exactly" (`===`) while participant
 * selection asks "what can this person afford" (`<=`). Only the basis changed.
 */
describe('getBillablePrice — the budget comparison basis', () => {
  it('matches the documented example: 75.000 base + 25.000 fee fills a 100.000 package', () => {
    expect(getBillablePrice(75000, 25000)).toBe(100000);
  });

  it('is the base price when a menu adds no fee', () => {
    expect(getBillablePrice(BASE_PRICE)).toBe(BASE_PRICE);
    expect(getBillablePrice(BASE_PRICE, 0)).toBe(BASE_PRICE);
    expect(getBillablePrice(BASE_PRICE, undefined)).toBe(BASE_PRICE);
  });

  it('never yields NaN from missing or junk input', () => {
    expect(getBillablePrice(undefined, undefined)).toBe(0);
    expect(getBillablePrice(BASE_PRICE, 'abc' as any)).toBe(BASE_PRICE);
  });

  it('agrees with what getTotalInfo bills for one serving', () => {
    const { totalPrice } = getTotalInfo([
      {
        foodId: FOOD_A,
        foodName: 'Cơm gà',
        foodPrice: BASE_PRICE,
        foodExtraFee: 15000,
        frequency: 1,
        numberOfMainDishes: 2,
      },
    ]);

    // Selection basis and billing basis must not diverge.
    expect(getBillablePrice(BASE_PRICE, 15000)).toBe(totalPrice);
  });

  it('a dish at exactly the package no longer matches once a fee is added', () => {
    // Correct signalling: the dish now costs more than the budget, so the
    // partner should be re-priced below the package.
    const packagePerMember = BASE_PRICE;

    expect(getBillablePrice(BASE_PRICE, 0)).toBe(packagePerMember);
    expect(getBillablePrice(BASE_PRICE, 15000)).not.toBe(packagePerMember);
  });
});
