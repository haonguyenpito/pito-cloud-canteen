import {
  getMenuMinFoodPriceForDay,
  parseFoodsFromMenu,
  searchTitle,
} from '@helpers/searchRestaurantHelper';
import type { TFoodInRestaurant } from '@src/types/bookerSelectRestaurant';
import type { TListing } from '@src/utils/types';

export type TPickBookerRestaurantMenuResult = {
  menu: TListing | null;
  foods: TFoodInRestaurant[];
};

type TMenuCandidate = {
  menu: TListing;
  foods: TFoodInRestaurant[];
  matchedPackageCount: number;
  minPriceDistance: number;
  minPrice: number;
};

const buildMenuCandidate = (
  menu: TListing,
  dayOfWeek: string,
  mapFoodId: Map<string, TListing>,
  packagePerMember: number,
): TMenuCandidate | null => {
  const foods = parseFoodsFromMenu(menu, dayOfWeek, mapFoodId);
  if (!foods.length) {
    return null;
  }

  const minPrice = getMenuMinFoodPriceForDay(menu, dayOfWeek);
  const matchedPackageCount = packagePerMember
    ? foods.filter((food) => food.price === packagePerMember).length
    : 0;
  const minPriceDistance = packagePerMember
    ? Math.abs(minPrice - packagePerMember)
    : 0;

  return {
    menu,
    foods,
    matchedPackageCount,
    minPriceDistance,
    minPrice,
  };
};

const isBetterMenuCandidate = (
  next: TMenuCandidate,
  current: TMenuCandidate,
  packagePerMember: number,
): boolean => {
  if (next.matchedPackageCount !== current.matchedPackageCount) {
    return next.matchedPackageCount > current.matchedPackageCount;
  }

  if (next.minPriceDistance !== current.minPriceDistance) {
    return next.minPriceDistance < current.minPriceDistance;
  }

  if (packagePerMember) {
    const nextAbovePackage = next.minPrice > packagePerMember;
    const currentAbovePackage = current.minPrice > packagePerMember;
    if (nextAbovePackage !== currentAbovePackage) {
      return !nextAbovePackage;
    }
  }

  return false;
};

const menuHasFoodNameKeywordMatch = (
  foods: TFoodInRestaurant[],
  foodNameKeywords: string,
): boolean =>
  foods.some(
    (food) => food.foodName && searchTitle(food.foodName, foodNameKeywords),
  );

/**
 * Picks exactly one menu per restaurant for booker search.
 * Priority: most foods at packagePerMember → closest MinFoodPrice → min at/below package.
 */
export function pickBookerRestaurantMenu({
  menus,
  dayOfWeek,
  mapFoodId,
  packagePerMember = 0,
  foodNameKeywords,
}: {
  menus: TListing[];
  dayOfWeek: string;
  mapFoodId: Map<string, TListing>;
  packagePerMember?: number;
  /** When set, only menus with at least one food name matching keywords are considered. */
  foodNameKeywords?: string;
}): TPickBookerRestaurantMenuResult {
  let best: TMenuCandidate | null = null;

  menus.forEach((menu) => {
    const candidate = buildMenuCandidate(
      menu,
      dayOfWeek,
      mapFoodId,
      packagePerMember,
    );
    if (!candidate) {
      return;
    }

    if (
      foodNameKeywords &&
      !menuHasFoodNameKeywordMatch(candidate.foods, foodNameKeywords)
    ) {
      return;
    }

    if (!best || isBetterMenuCandidate(candidate, best, packagePerMember)) {
      best = candidate;
    }
  });

  if (!best) {
    return { menu: null, foods: [] };
  }

  const selectedMenu = best as TMenuCandidate;

  return {
    menu: selectedMenu.menu,
    foods: selectedMenu.foods,
  };
}
