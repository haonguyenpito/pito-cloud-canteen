import mapValues from 'lodash/mapValues';

import type { OrderDetailValue, PlanListing } from '@src/types';
import type { DeepPartial } from '@src/types/utils';

// A plan snapshot stores the CLIENT price in `foodPrice` / `unitPrice` and the
// partner's base price beside it in `foodPartnerPrice` / `unitPartnerPrice`.
// Snapshots taken before the partner field existed had no surcharge, so the
// client price is the partner price there.

export type TPlanOrderDetail = DeepPartial<Record<string, OrderDetailValue>>;
export type TPlanSubOrder = NonNullable<TPlanOrderDetail[string]>;
type TSnapshotFood = NonNullable<
  NonNullable<TPlanSubOrder['restaurant']>['foodList']
>[string];
type TSnapshotLineItem = NonNullable<TPlanSubOrder['lineItems']>[number];

export type TPricedFoodData = {
  foodPrice: number;
  foodPartnerPrice?: number;
};

/**
 * Reads what the partner is paid for one dish of a group-order snapshot.
 * @param food - A `restaurant.foodList[foodId]` entry of a plan sub-order.
 * @returns The partner price, or the client price for pre-surcharge snapshots.
 */
export const getFoodPartnerPrice = (food: TSnapshotFood = {}): number =>
  food?.foodPartnerPrice ?? food?.foodPrice ?? 0;

/**
 * Reads what the partner is paid per unit of a normal-order line item.
 * @param lineItem - A `lineItems[i]` entry of a plan sub-order.
 * @returns The partner unit price, or the client one for pre-surcharge snapshots.
 */
export const getLineItemPartnerUnitPrice = (
  lineItem: TSnapshotLineItem = {},
): number => lineItem?.unitPartnerPrice ?? lineItem?.unitPrice ?? 0;

/**
 * Turns one food row of a quotation into the row stored on the partner side.
 * @param foodData - A food row carrying both the client and partner price.
 * @returns The row with the partner price as `foodPrice`.
 */
export const toPartnerFoodData = <T extends TPricedFoodData>({
  foodPartnerPrice,
  ...foodData
}: T): Omit<T, 'foodPartnerPrice'> => ({
  ...foodData,
  foodPrice: foodPartnerPrice ?? foodData.foodPrice,
});

/**
 * Turns one food row of a quotation into the row stored on the client side.
 * @param foodData - A food row carrying both the client and partner price.
 * @returns The row without the partner price.
 */
export const toClientFoodData = <T extends TPricedFoodData>({
  foodPartnerPrice: _foodPartnerPrice,
  ...foodData
}: T): Omit<T, 'foodPartnerPrice'> => foodData;

/**
 * Rewrites one sub-order so every price in it is the partner's price.
 * @param subOrder - A plan sub-order (`orderDetail[date]`).
 * @returns The sub-order without any client price.
 */
const toPartnerSubOrder = (subOrder: TPlanSubOrder = {}): TPlanSubOrder => {
  const { restaurant, lineItems } = subOrder;
  const foodList = restaurant?.foodList;

  return {
    ...subOrder,
    ...(restaurant && {
      restaurant: {
        ...restaurant,
        ...(foodList && {
          foodList: mapValues(foodList, (food) => {
            const { foodPartnerPrice: _foodPartnerPrice, ...rest } = food || {};

            return { ...rest, foodPrice: getFoodPartnerPrice(food) };
          }),
        }),
      },
    }),
    ...(Array.isArray(lineItems) && {
      lineItems: lineItems.map((lineItem) => {
        const { unitPartnerPrice: _unitPartnerPrice, ...rest } = lineItem || {};
        const unitPrice = getLineItemPartnerUnitPrice(lineItem);

        return {
          ...rest,
          unitPrice,
          price: unitPrice * (lineItem?.quantity ?? 1),
        };
      }),
    }),
  };
};

/**
 * Converts a plan's order detail into what a partner may see.
 * @param orderDetail - `plan.metadata.orderDetail`.
 * @returns The order detail with partner prices only.
 */
export const toPartnerOrderDetail = (
  orderDetail: TPlanOrderDetail = {},
): TPlanOrderDetail => mapValues(orderDetail, toPartnerSubOrder);

/**
 * Converts a plan listing before it is returned to a partner.
 * @param plan - The plan listing as stored in Sharetribe.
 * @returns The same listing whose order detail carries partner prices only.
 */
export const toPartnerPlanListing = <T extends PlanListing>(plan: T): T => {
  const orderDetail = plan?.attributes?.metadata?.orderDetail;

  if (!orderDetail) {
    return plan;
  }

  return {
    ...plan,
    attributes: {
      ...plan.attributes,
      metadata: {
        ...plan.attributes?.metadata,
        orderDetail: toPartnerOrderDetail(orderDetail),
      },
    },
  };
};
