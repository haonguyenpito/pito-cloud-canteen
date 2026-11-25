import type { MenuListing } from '@src/types';

// The extra fee (phí phụ thu) is scoped to a (menu, dish) pair and lives in
// `menu.publicData.foodExtraFees`. A dish listing is shared by many menus, so
// the fee must never be read from or written to the food listing.

/**
 * Cleans a raw extra fee map read from a menu or a request.
 * @param foodExtraFees - Raw `{ [foodId]: fee }` values.
 * @returns The map with only finite, non-negative fees. 0 is kept: it is a
 *   valid "no surcharge".
 */
export const sanitizeExtraFeeMap = (
  foodExtraFees?: Record<string, unknown> | null,
): Record<string, number> => {
  if (!foodExtraFees) {
    return {};
  }

  return Object.entries(foodExtraFees).reduce<Record<string, number>>(
    (result, [foodId, rawFee]) => {
      const fee = Number(rawFee);

      if (!Number.isFinite(fee) || fee < 0) {
        return result;
      }

      return { ...result, [foodId]: fee };
    },
    {},
  );
};

/**
 * Reads the extra fee map of one menu.
 * @param menu - The menu listing.
 * @returns `{ [foodId]: fee }`, empty when the menu has no fee.
 */
export const getMenuExtraFeeMap = (
  menu?: MenuListing | null,
): Record<string, number> =>
  sanitizeExtraFeeMap(menu?.attributes?.publicData?.foodExtraFees);

/**
 * Lists every dish a menu serves, whatever the day.
 * @param foodsByDate - The menu's `foodsByDate`.
 * @returns The distinct food ids.
 */
const getFoodIdsOfMenu = (
  foodsByDate: Record<string, Record<string, unknown>> = {},
): Set<string> =>
  new Set(
    Object.values(foodsByDate).flatMap((foods) => Object.keys(foods || {})),
  );

/**
 * Drops the fees a menu save must not carry over. A fee survives only for a
 * dish served both before and after the save, so a removed dish loses its fee
 * and a dish added back starts without one.
 * @param extraFees - The menu's current fees.
 * @param previousFoodsByDate - `foodsByDate` before the save.
 * @param nextFoodsByDate - `foodsByDate` after the save.
 * @returns The fees to keep.
 */
export const pruneExtraFeesOnMenuSave = (
  extraFees: Record<string, number>,
  previousFoodsByDate: Record<string, Record<string, unknown>> = {},
  nextFoodsByDate: Record<string, Record<string, unknown>> = {},
): Record<string, number> => {
  const previousFoodIds = getFoodIdsOfMenu(previousFoodsByDate);
  const nextFoodIds = getFoodIdsOfMenu(nextFoodsByDate);

  return Object.fromEntries(
    Object.entries(extraFees).filter(
      ([foodId]) => previousFoodIds.has(foodId) && nextFoodIds.has(foodId),
    ),
  );
};

/**
 * Computes what the company pays for one serving. `packagePerMember` is a
 * fee-inclusive budget, so every budget comparison must use this.
 * @param basePrice - The partner's price of the dish.
 * @param extraFee - The menu's extra fee for the dish.
 * @returns The client price.
 */
export const getBillablePrice = (basePrice = 0, extraFee = 0): number =>
  (Number(basePrice) || 0) + (Number(extraFee) || 0);

/**
 * Computes what the company pays for one serving of a dish of a given menu.
 * @param food - The food listing.
 * @param extraFeeByFoodId - The extra fees of the menu the dish is shown from.
 * @returns The client price.
 */
export const getFoodBillablePrice = (
  food: {
    id?: { uuid?: string };
    attributes?: { price?: { amount?: number } };
  },
  extraFeeByFoodId: Record<string, number> = {},
): number =>
  getBillablePrice(
    food.attributes?.price?.amount,
    extraFeeByFoodId[food.id?.uuid || ''],
  );

/**
 * Computes `<day>MinFoodPrice`: the cheapest client price of one menu day.
 * The restaurant search filters on `pub_<day>MinFoodPrice <= packagePerMember`.
 * @param foods - The dishes of the day with their partner price.
 * @param extraFeeByFoodId - The menu's extra fees.
 * @returns The lowest client price, 0 for an empty day.
 */
export const getMinBillablePrice = (
  foods: { foodId: string; price?: number }[],
  extraFeeByFoodId: Record<string, number> = {},
): number =>
  foods.reduce((min, { foodId, price = 0 }, index) => {
    const billable = getBillablePrice(price, extraFeeByFoodId[foodId]);

    return index === 0 ? billable : Math.min(min, billable);
  }, 0);
