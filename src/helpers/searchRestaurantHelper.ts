import * as unidecode from 'unidecode';

import { calculateDistance } from '@helpers/mapHelpers';
import config from '@src/configs';
import type { TFoodInRestaurant } from '@src/types/bookerSelectRestaurant';
import { Listing } from '@src/utils/data';
import type { TListing } from '@src/utils/types';

export function searchTitle(
  title: string | null | undefined,
  keywords: string | undefined,
): boolean {
  if (!keywords || !title) return false;

  const unidecodeTitle = String(unidecode(keywords));
  const unidecodeKeywords = String(unidecode(title));
  const keyWordsSet = new Set(
    unidecodeKeywords.trim().toLowerCase().split(' '),
  );

  return unidecodeTitle
    .trim()
    .toLowerCase()
    .split(' ')
    .some((word) => keyWordsSet.has(word));
}

export function filterRestaurant(
  restaurant: TListing,
  timestamp: number,
  deliveryAddress: any,
) {
  const restaurantListing = Listing(restaurant);

  const {
    stopReceiveOrder = false,
    startStopReceiveOrderDate = 0,
    endStopReceiveOrderDate = 0,
  } = restaurantListing.getPublicData();
  const isInStopReceiveOrderTime =
    stopReceiveOrder &&
    Number(timestamp) >= startStopReceiveOrderDate &&
    Number(timestamp) <= endStopReceiveOrderDate;

  const { geolocation: restaurantOrigin } = restaurantListing.getAttributes();

  const distanceToDeliveryPlace = calculateDistance(
    deliveryAddress?.origin,
    restaurantOrigin,
  );
  const isValidRestaurant =
    !isInStopReceiveOrderTime &&
    distanceToDeliveryPlace <=
      Number(config.maxKilometerFromRestaurantToDeliveryAddressForBooker);

  return isValidRestaurant;
}

export function parseFoodsFromMenu(
  menu: TListing,
  dayOfWeek: string,
  mapfoods: Map<string, TListing>,
  options?: {
    findExactPackagePerMember?: {
      active: boolean;
      packagePerMember: number;
    };
  },
): TFoodInRestaurant[] {
  const result: TFoodInRestaurant[] = [];
  const menuListing = Listing(menu);
  const foodInList = menuListing.getPublicData().foodsByDate[dayOfWeek];
  const { restaurantId } = menuListing.getMetadata();
  Object.keys(foodInList).forEach((key) => {
    const foodMenu = foodInList[key];
    const food = mapfoods.get(key);
    if (foodMenu && food) {
      const foodListing = Listing(food);
      const { price, title, publicData } = foodListing.getAttributes();

      if (
        options?.findExactPackagePerMember &&
        options?.findExactPackagePerMember?.active
      ) {
        const packagePerMember =
          options?.findExactPackagePerMember.packagePerMember;

        if (price.amount !== packagePerMember) {
          return;
        }
      }

      result.push({
        restaurantId,
        foodId: key,
        foodName: title,
        minQuantity: foodListing.getPublicData().minQuantity ?? 0,
        price: price.amount,
        foodUnit: publicData?.unit ?? '',
        numberOfMainDishes: publicData?.numberOfMainDishes ?? 2,
      });
    }
  });

  return result;
}

/** Min food price for the delivery weekday (e.g. monMinFoodPrice). */
export function getMenuMinFoodPriceForDay(
  menu: TListing,
  dayOfWeek: string,
): number {
  const minFoodPrice =
    Listing(menu).getPublicData()[`${dayOfWeek}MinFoodPrice`] ?? 0;

  return Number(minFoodPrice) || 0;
}

/**
 * Menus with min price closest to packagePerMember are tried first in search-restaurant.
 */
export function sortMenusByPackagePerMemberProximity(
  menus: TListing[],
  dayOfWeek: string,
  packagePerMember: number,
): TListing[] {
  if (!menus.length || !packagePerMember) {
    return [...menus];
  }

  return [...menus].sort((first, second) => {
    const firstMin = getMenuMinFoodPriceForDay(first, dayOfWeek);
    const secondMin = getMenuMinFoodPriceForDay(second, dayOfWeek);
    const firstDistance = Math.abs(firstMin - packagePerMember);
    const secondDistance = Math.abs(secondMin - packagePerMember);

    if (firstDistance !== secondDistance) {
      return firstDistance - secondDistance;
    }

    // Same distance: prefer menu whose min is at or below package (not above).
    const firstAbovePackage = firstMin > packagePerMember;
    const secondAbovePackage = secondMin > packagePerMember;
    if (firstAbovePackage !== secondAbovePackage) {
      return firstAbovePackage ? 1 : -1;
    }

    return 0;
  });
}
