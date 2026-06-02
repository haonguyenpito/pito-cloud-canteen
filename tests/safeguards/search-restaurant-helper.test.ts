/**
 * SEARCH RESTAURANT HELPER SAFEGUARDS
 *
 * Protects menu-priority helpers used by booker restaurant search.
 *
 * Covered contracts:
 * - `sortMenusByPackagePerMemberProximity` orders menus by:
 *   1) closest `{day}MinFoodPrice` to `packagePerMember`
 *   2) tie-break: prefer menu priced at/below package over above package
 * - `getMenuMinFoodPriceForDay` reads weekday min-price metadata from menu publicData.
 *
 * Source: src/helpers/searchRestaurantHelper.ts
 */

import {
  getMenuMinFoodPriceForDay,
  sortMenusByPackagePerMemberProximity,
} from '@helpers/searchRestaurantHelper';
import type { TListing } from '@src/utils/types';

const makeMenu = (id: string, monMinFoodPrice: number): TListing =>
  ({
    id: { uuid: id },
    type: 'listing',
    attributes: {
      title: '',
      publicData: {
        monMinFoodPrice,
      },
      metadata: {},
    },
  } as unknown as TListing);

describe('sortMenusByPackagePerMemberProximity', () => {
  it('puts menu with min price closest to packagePerMember first', () => {
    const menu65k = makeMenu('menu-65', 65000);
    const menu100k = makeMenu('menu-100', 100000);

    const sorted = sortMenusByPackagePerMemberProximity(
      [menu100k, menu65k],
      'mon',
      65000,
    );

    expect(sorted.map((m) => m.id.uuid)).toEqual(['menu-65', 'menu-100']);
  });

  it('prefers menu at or below package when distance is equal', () => {
    const below = makeMenu('below', 60000);
    const above = makeMenu('above', 70000);

    const sorted = sortMenusByPackagePerMemberProximity(
      [above, below],
      'mon',
      65000,
    );

    expect(sorted[0].id.uuid).toBe('below');
  });

  it('returns a copy when packagePerMember is zero', () => {
    const menus = [makeMenu('a', 100000)];
    const sorted = sortMenusByPackagePerMemberProximity(menus, 'mon', 0);

    expect(sorted).toEqual(menus);
    expect(sorted).not.toBe(menus);
  });
});

describe('getMenuMinFoodPriceForDay', () => {
  it('reads weekday min food price from publicData', () => {
    const menu = makeMenu('m', 65000);

    expect(getMenuMinFoodPriceForDay(menu, 'mon')).toBe(65000);
  });
});
