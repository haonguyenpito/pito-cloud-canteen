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
/**
 * Cleans a raw `foodExtraFees` map: 0 is kept (a valid "no surcharge"), junk
 * and negative values are dropped.
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

      // 0 is a valid, intentional value ("no surcharge"); only junk is dropped.
      if (!Number.isFinite(fee) || fee < 0) {
        return result;
      }

      return { ...result, [foodId]: fee };
    },
    {},
  );
};

export const getMenuExtraFeeMap = (
  menu?: TListing | TIntegrationListing | null,
): Record<string, number> => {
  if (!menu) {
    return {};
  }

  const { foodExtraFees } = Listing(menu as TListing).getPublicData() || {};

  return sanitizeExtraFeeMap(foodExtraFees);
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

/**
 * The lowest amount a company can be billed for one dish of a menu day — the
 * value stored as `<day>MinFoodPrice`.
 *
 * The restaurant search filters menus with `pub_<day>MinFoodPrice <=
 * packagePerMember`, and the package is fee-inclusive, so this must include
 * the menu surcharge. Otherwise a menu passes the budget filter on its base
 * price and then offers no dish within budget. Returns 0 for an empty day,
 * as before.
 */
export const getMinBillablePrice = (
  foods: { foodId: string; price?: number }[],
  extraFeeByFoodId: Record<string, number> = {},
): number =>
  foods.reduce((min, { foodId, price = 0 }, index) => {
    const billable = getBillablePrice(price, extraFeeByFoodId[foodId]);

    return index === 0 ? billable : Math.min(min, billable);
  }, 0);

/**
 * The surcharge a normal order's line item adds to the company's bill.
 *
 * `unitPrice` / `price` stay at the partner's base amount because line items
 * also feed the partner quotation; the markup rides alongside as
 * `unitExtraFee`. Line items written before the field existed have none, so
 * they resolve to 0 and started orders are never re-priced.
 */
export const getLineItemExtraFeeTotal = (lineItem?: {
  quantity?: number;
  unitExtraFee?: number;
}): number => {
  const { quantity = 1, unitExtraFee } = lineItem || {};
  const fee = Number(unitExtraFee);

  if (!Number.isFinite(fee) || fee < 0) {
    return 0;
  }

  return fee * quantity;
};
