import mapValues from 'lodash/mapValues';

import type { TPlanSubOrder } from './partnerPriceHelper';
import { getFoodPartnerPrice } from './partnerPriceHelper';

type TRepriceParams = {
  /** New partner price per dish (undivided). Dishes absent keep theirs. */
  basePriceByFoodId?: Record<string, number>;
  /** The menu's new extra fee per dish (undivided). Absent keeps the
   * sub-order's current fee for every dish. */
  extraFeeByFoodId?: Record<string, number>;
  isSecondaryFoodAllowed?: boolean;
};

/**
 * Tells how many dishes share one package for a dual-selection company.
 * @param numberOfMainDishes - The dish's `numberOfMainDishes`.
 * @param isSecondaryFoodAllowed - Whether the company picks two dishes.
 * @returns 2 for a multi-dish food of a dual-selection company, otherwise 1.
 */
const getPriceDivisor = (
  numberOfMainDishes: number | string | undefined,
  isSecondaryFoodAllowed: boolean,
) => {
  const isSingleSelectionFood =
    numberOfMainDishes !== undefined &&
    numberOfMainDishes !== null &&
    Number(numberOfMainDishes) === 1;

  return isSecondaryFoodAllowed && !isSingleSelectionFood ? 2 : 1;
};

/**
 * Re-prices the dishes of one draft sub-order after a partner price or a menu
 * fee changed. Line items take the re-priced dish prices so both stay equal.
 * @param subOrder - A plan sub-order (`orderDetail[date]`).
 * @param params.basePriceByFoodId - New partner prices; omit to keep them.
 * @param params.extraFeeByFoodId - The menu's new fees; omit to keep them.
 * @param params.isSecondaryFoodAllowed - Halve both prices of multi-dish foods.
 * @returns The re-priced sub-order and whether any price changed.
 */
export const repriceSubOrder = (
  subOrder: TPlanSubOrder,
  {
    basePriceByFoodId = {},
    extraFeeByFoodId,
    isSecondaryFoodAllowed = false,
  }: TRepriceParams,
): { subOrder: TPlanSubOrder; hasChange: boolean } => {
  const { restaurant, lineItems } = subOrder;
  const foodList = restaurant?.foodList;

  if (!foodList) {
    return { subOrder, hasChange: false };
  }

  let hasChange = false;
  const newFoodList = mapValues(foodList, (food, foodId) => {
    const divisor = getPriceDivisor(
      food?.numberOfMainDishes,
      isSecondaryFoodAllowed,
    );
    const currentPartnerPrice = getFoodPartnerPrice(food);
    const currentFee = (food?.foodPrice ?? 0) - currentPartnerPrice;
    const partnerPrice =
      basePriceByFoodId[foodId] !== undefined
        ? basePriceByFoodId[foodId] / divisor
        : currentPartnerPrice;
    const fee = extraFeeByFoodId
      ? (extraFeeByFoodId[foodId] ?? 0) / divisor
      : currentFee;
    const foodPrice = partnerPrice + fee;

    if (
      foodPrice !== food?.foodPrice ||
      partnerPrice !== food?.foodPartnerPrice
    ) {
      hasChange = true;
    }

    return { ...food, foodPrice, foodPartnerPrice: partnerPrice };
  });

  const newLineItems = Array.isArray(lineItems)
    ? lineItems.map((lineItem) => {
        const food = newFoodList[lineItem?.id || ''];

        if (!food) {
          return lineItem;
        }

        const unitPrice = food.foodPrice;

        if (
          unitPrice !== lineItem?.unitPrice ||
          food.foodPartnerPrice !== lineItem?.unitPartnerPrice
        ) {
          hasChange = true;
        }

        return {
          ...lineItem,
          unitPrice,
          unitPartnerPrice: food.foodPartnerPrice,
          price: unitPrice * (lineItem?.quantity ?? 1),
        };
      })
    : lineItems;

  return {
    subOrder: {
      ...subOrder,
      restaurant: { ...restaurant, foodList: newFoodList },
      ...(newLineItems && { lineItems: newLineItems }),
    },
    hasChange,
  };
};
