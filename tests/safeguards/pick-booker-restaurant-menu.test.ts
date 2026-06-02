/**
 * PICK BOOKER RESTAURANT MENU SAFEGUARDS
 *
 * Protects single-menu selection logic for booker restaurant search.
 *
 * Business invariant:
 * - Each restaurant must resolve to exactly one menu in search/listing flow.
 *
 * Covered contracts:
 * - Picks menu with the highest number of foods matching `packagePerMember`.
 * - If tie, picks menu whose weekday min price is closest to package.
 * - If no candidate has foods for the weekday, returns `{ menu: null, foods: [] }`.
 *
 * Source: src/helpers/pickBookerRestaurantMenu.ts
 */

import { pickBookerRestaurantMenu } from '@helpers/pickBookerRestaurantMenu';
import type { TListing } from '@src/utils/types';

const makeFood = (id: string, price: number, title: string): TListing =>
  ({
    id: { uuid: id },
    type: 'listing',
    attributes: {
      title,
      price: { amount: price },
      publicData: { unit: 'phần' },
      metadata: {},
    },
  } as unknown as TListing);

const makeMenu = ({
  id,
  monMinFoodPrice,
  foods,
}: {
  id: string;
  monMinFoodPrice: number;
  foods: { id: string; price: number; title: string }[];
}): TListing => {
  const foodIds = foods.map((f) => f.id);
  const foodsByDate = foods.reduce((acc, food) => {
    acc[food.id] = true;

    return acc;
  }, {} as Record<string, true>);

  return {
    id: { uuid: id },
    type: 'listing',
    attributes: {
      title: '',
      publicData: {
        monMinFoodPrice,
        foodsByDate: { mon: foodsByDate },
      },
      metadata: {
        restaurantId: 'rest-1',
        monFoodIdList: foodIds,
      },
    },
  } as unknown as TListing;
};

describe('pickBookerRestaurantMenu', () => {
  const mapFoodId = new Map<string, TListing>([
    ['f-65', makeFood('f-65', 65000, 'Com 65')],
    ['f-100', makeFood('f-100', 100000, 'Com 100')],
    ['f-65-b', makeFood('f-65-b', 65000, 'Bun 65')],
  ]);

  it('picks menu with more foods matching packagePerMember', () => {
    const menu65k = makeMenu({
      id: 'menu-65',
      monMinFoodPrice: 65000,
      foods: [
        { id: 'f-65', price: 65000, title: 'Com 65' },
        { id: 'f-65-b', price: 65000, title: 'Bun 65' },
      ],
    });
    const menu100k = makeMenu({
      id: 'menu-100',
      monMinFoodPrice: 100000,
      foods: [{ id: 'f-100', price: 100000, title: 'Com 100' }],
    });

    const { menu, foods } = pickBookerRestaurantMenu({
      menus: [menu100k, menu65k],
      dayOfWeek: 'mon',
      mapFoodId,
      packagePerMember: 65000,
    });

    expect(menu?.id.uuid).toBe('menu-65');
    expect(foods.filter((f) => f.price === 65000)).toHaveLength(2);
  });

  it('when match counts tie, prefers menu with min price closer to package', () => {
    const menu65k = makeMenu({
      id: 'menu-65',
      monMinFoodPrice: 65000,
      foods: [{ id: 'f-65', price: 65000, title: 'Com 65' }],
    });
    const menu70k = makeMenu({
      id: 'menu-70',
      monMinFoodPrice: 70000,
      foods: [{ id: 'f-100', price: 100000, title: 'Com 100' }],
    });

    const { menu } = pickBookerRestaurantMenu({
      menus: [menu70k, menu65k],
      dayOfWeek: 'mon',
      mapFoodId,
      packagePerMember: 65000,
    });

    expect(menu?.id.uuid).toBe('menu-65');
  });

  it('returns empty when no menu has foods', () => {
    const emptyMenu = makeMenu({
      id: 'empty',
      monMinFoodPrice: 65000,
      foods: [],
    });

    const result = pickBookerRestaurantMenu({
      menus: [emptyMenu],
      dayOfWeek: 'mon',
      mapFoodId,
      packagePerMember: 65000,
    });

    expect(result.menu).toBeNull();
    expect(result.foods).toEqual([]);
  });
});
