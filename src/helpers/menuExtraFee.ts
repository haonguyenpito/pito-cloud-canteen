import { Listing } from '@src/utils/data';
import type { TIntegrationListing, TListing } from '@src/utils/types';

/**
 * The extra fee (phí phụ thu) is scoped to a (menu, dish) pair and lives in
 * `menu.publicData.foodExtraFees`.
 *
 * It must NEVER be read from the food listing: a dish listing is shared by many
 * menus, so a dish-level fee silently applies the same surcharge everywhere the
 * dish appears. Every read site goes through this module so that stays true.
 */
export const getMenuExtraFeeMap = (
  menu?: TListing | TIntegrationListing | null,
): Record<string, number> => {
  if (!menu) {
    return {};
  }

  const { foodExtraFees } = Listing(menu as TListing).getPublicData() || {};

  if (!foodExtraFees) {
    return {};
  }

  return Object.entries(foodExtraFees).reduce<Record<string, number>>(
    (result, [foodId, rawFee]) => {
      const fee = Number(rawFee);

      // 0 is a valid, intentional value ("no surcharge"); only junk is dropped.
      if (!Number.isFinite(fee) || fee < 0) {
        return result;
      }

      return { ...result, [foodId]: fee };
    },
    {},
  );
};

/** A dish's fee within one menu. 0 when the menu does not surcharge it. */
export const getMenuFoodExtraFee = (
  menu: TListing | TIntegrationListing | null | undefined,
  foodId: string,
): number => getMenuExtraFeeMap(menu)[foodId] ?? 0;

/**
 * The amount a company is actually billed for one serving of a dish.
 *
 * `packagePerMember` is a fee-inclusive budget: the partner prices below the
 * package and PITO's markup closes the gap (base 75.000 + fee 25.000 matches a
 * 100.000 budget). Every budget comparison must therefore use this, not the
 * bare `price.amount` — billing already does, via `getTotalInfo`.
 */
export const getBillablePrice = (basePrice = 0, extraFee = 0): number =>
  (Number(basePrice) || 0) + (Number(extraFee) || 0);
