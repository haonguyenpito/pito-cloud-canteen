import { fetchListingsByChunkedIds, queryAllPages } from '@helpers/apiHelpers';
import { getMinBillablePrice } from '@helpers/menuExtraFee';
import { getIsAllowAddSecondaryFood } from '@helpers/orderHelper';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/integrationSdk';
import { IntegrationListing, IntegrationMenuListing } from '@src/utils/data';
import {
  EBookerOrderDraftStates,
  EListingStates,
  EListingType,
} from '@src/utils/enums';
import type { TIntegrationListing, TListing, TObject } from '@src/utils/types';

export type TMenuExtraFeeMap = Record<string, number>;

export type TUpdateMenuExtraFeesParams = {
  extraFees: TMenuExtraFeeMap;
  /**
   * `replace` — the map becomes exactly what was submitted (bulk apply).
   * `merge` — only the submitted dishes change (per-dish override).
   */
  mode?: 'replace' | 'merge';
};

/** Menu states in which an admin may still set the extra fee. */
const EDITABLE_MENU_STATES: string[] = [
  EListingStates.draft,
  EListingStates.pendingApproval,
];

/** Order states whose plan snapshot is still a draft and may be re-synced. */
const DRAFT_ORDER_STATES: string[] = [
  EListingStates.draft,
  EListingStates.pendingApproval,
  EBookerOrderDraftStates.bookerDraft,
];

/**
 * A fee of 0 is a valid, intentional value ("no surcharge") — it must never be
 * dropped by a truthiness check. Anything that is not a finite, non-negative
 * number is discarded instead of silently becoming NaN.
 */
export const normalizeExtraFees = (
  extraFees: TObject = {},
  allowedFoodIds: string[] = [],
): TMenuExtraFeeMap => {
  const allowed = new Set(allowedFoodIds);

  return Object.entries(extraFees).reduce<TMenuExtraFeeMap>(
    (result, [foodId, rawValue]) => {
      if (allowed.size > 0 && !allowed.has(foodId)) {
        return result;
      }

      const value = Number(rawValue);

      if (!Number.isFinite(value) || value < 0) {
        return result;
      }

      return { ...result, [foodId]: Math.round(value) };
    },
    {},
  );
};

/**
 * The fee a draft sub-order snapshots for one dish. Dual-selection companies
 * split one package across two dishes, so — exactly like `adjustFoodListPrice`
 * does for the base price — a multi-dish food carries half the fee; otherwise
 * the markup would be charged twice per meal.
 */
const getSnapshotExtraFee = (
  fee: number,
  numberOfMainDishes: unknown,
  isSecondaryFoodAllowed: boolean,
) => {
  const isSingleSelectionFood =
    numberOfMainDishes !== undefined &&
    numberOfMainDishes !== null &&
    Number(numberOfMainDishes) === 1;

  return isSecondaryFoodAllowed && !isSingleSelectionFood ? fee / 2 : fee;
};

/**
 * Rewrites the fee snapshot of ONE draft sub-order served by the edited menu:
 * `restaurant.foodList[*].foodExtraFee` (group orders) and
 * `lineItems[*].unitExtraFee` (normal orders). Base prices are never touched.
 */
export const syncSubOrderExtraFees = ({
  subOrder,
  extraFees,
  isSecondaryFoodAllowed = false,
}: {
  subOrder: TObject;
  extraFees: TMenuExtraFeeMap;
  isSecondaryFoodAllowed?: boolean;
}): { subOrder: TObject; hasChange: boolean } => {
  const { restaurant = {}, lineItems } = subOrder;
  const { foodList = {} } = restaurant;
  let hasChange = false;

  const feeFor = (foodId: string) =>
    getSnapshotExtraFee(
      extraFees[foodId] ?? 0,
      foodList[foodId]?.numberOfMainDishes,
      isSecondaryFoodAllowed,
    );

  const newFoodList = Object.keys(foodList).reduce(
    (foodListResult: TObject, foodId: string) => {
      const food = foodList[foodId] || {};
      const nextExtraFee = feeFor(foodId);

      if (food.foodExtraFee !== nextExtraFee) {
        hasChange = true;
      }

      return {
        ...foodListResult,
        [foodId]: { ...food, foodExtraFee: nextExtraFee },
      };
    },
    {},
  );

  const newLineItemsMaybe = Array.isArray(lineItems)
    ? {
        lineItems: lineItems.map((lineItem: TObject) => {
          const nextExtraFee = feeFor(lineItem?.id);

          if (lineItem?.unitExtraFee === nextExtraFee) {
            return lineItem;
          }

          hasChange = true;

          return { ...lineItem, unitExtraFee: nextExtraFee };
        }),
      }
    : {};

  return {
    subOrder: {
      ...subOrder,
      restaurant: { ...restaurant, foodList: newFoodList },
      ...newLineItemsMaybe,
    },
    hasChange,
  };
};

/**
 * Re-syncs the `foodExtraFee` snapshot of orders that have not been started yet.
 *
 * Scoped to `menuId` on purpose: a plan spans several menus, and the whole point
 * of menu-scoped fees is that a dish priced in one menu must not move in another.
 * Started orders are never touched — their snapshot is final.
 */
const syncExtraFeesToDraftPlans = async (
  menuId: string,
  extraFees: TMenuExtraFeeMap,
) => {
  const integrationSdk = getIntegrationSdk();

  // Every page: a menu used for a whole season can be referenced by far more
  // than one page (100) of plans, most of them already started. A single-page
  // query silently left the remaining draft orders on the old fee.
  const plans = await queryAllPages({
    sdkModel: integrationSdk.listings,
    query: {
      meta_menuIds: `has_any:${menuId}`,
      meta_listingType: EListingType.subOrder,
    },
  });

  if (plans.length === 0) {
    return;
  }

  const orderIdList = plans
    .map(
      (plan: TIntegrationListing) =>
        IntegrationListing(plan).getMetadata().orderId,
    )
    .filter(Boolean);

  const orders = await fetchListingsByChunkedIds(orderIdList, integrationSdk);

  await Promise.all(
    orders.map(async (order: TIntegrationListing) => {
      const { orderState, plans: orderPlans = [] } =
        IntegrationListing(order).getMetadata();

      if (!DRAFT_ORDER_STATES.includes(orderState)) {
        return;
      }

      const planId = orderPlans[0];
      const plan = plans.find((p: TIntegrationListing) => p.id.uuid === planId);

      if (!plan) {
        return;
      }

      const { orderDetail = {} } = IntegrationListing(plan).getMetadata();
      const isSecondaryFoodAllowed = getIsAllowAddSecondaryFood(
        order as unknown as TListing,
      );
      let hasChange = false;

      const newOrderDetail = Object.keys(orderDetail).reduce(
        (result: TObject, subOrderDate: string) => {
          const subOrder = orderDetail[subOrderDate] || {};

          // Only dates served by THIS menu.
          if (subOrder.restaurant?.menuId !== menuId) {
            return { ...result, [subOrderDate]: subOrder };
          }

          const synced = syncSubOrderExtraFees({
            subOrder,
            extraFees,
            isSecondaryFoodAllowed,
          });

          hasChange = hasChange || synced.hasChange;

          return { ...result, [subOrderDate]: synced.subOrder };
        },
        {},
      );

      if (!hasChange) {
        return;
      }

      await integrationSdk.listings.update({
        id: planId,
        metadata: { orderDetail: newOrderDetail },
      });
    }),
  );
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * `<day>MinFoodPrice` drives the restaurant search budget filter
 * (`pub_<day>MinFoodPrice <= packagePerMember`) and is fee-inclusive, so it
 * must be recomputed whenever the fee map changes. Prices come from the food
 * listings (the source of truth for the base price). A day whose dishes cannot
 * be resolved is left untouched rather than reset to 0, which would let the
 * menu pass every budget filter.
 */
const computeMinFoodPriceByDay = async ({
  menuMetadata,
  foodIdList,
  foodExtraFees,
  integrationSdk,
}: {
  menuMetadata: TObject;
  foodIdList: string[];
  foodExtraFees: TMenuExtraFeeMap;
  integrationSdk: any;
}): Promise<TObject> => {
  if (foodIdList.length === 0) {
    return {};
  }

  const foods = await fetchListingsByChunkedIds(foodIdList, integrationSdk);
  const priceByFoodId = foods.reduce(
    (result: Record<string, number>, food: TIntegrationListing) => ({
      ...result,
      [food.id.uuid]:
        IntegrationListing(food).getAttributes().price?.amount || 0,
    }),
    {},
  );

  return DAY_KEYS.reduce((result: TObject, day) => {
    const dayFoods = ((menuMetadata[`${day}FoodIdList`] || []) as string[])
      .filter((foodId) => foodId in priceByFoodId)
      .map((foodId) => ({ foodId, price: priceByFoodId[foodId] }));

    if (dayFoods.length === 0) {
      return result;
    }

    return {
      ...result,
      [`${day}MinFoodPrice`]: getMinBillablePrice(dayFoods, foodExtraFees),
    };
  }, {});
};

/**
 * Writes the menu-scoped extra fee map and the fee-inclusive `<day>MinFoodPrice`
 * derived from it. Touches nothing else on the menu — in particular it must not
 * go through `updateMenu.service.ts`, which rebuilds `foodsByDate` /
 * `<day>FoodIdList` from a client payload.
 */
const updateMenuExtraFees = async (
  menuId: string,
  { extraFees, mode = 'replace' }: TUpdateMenuExtraFeesParams,
) => {
  const integrationSdk = getIntegrationSdk();

  const [menu] = denormalisedResponseEntities(
    await integrationSdk.listings.show({ id: menuId }),
  );

  const menuListing = IntegrationMenuListing(menu);
  const { listingState } = menuListing.getMetadata();

  if (!EDITABLE_MENU_STATES.includes(listingState)) {
    throw new Error('Menu đã được duyệt. Không thể cập nhật phụ phí');
  }

  const foodIdList = menuListing.getListFoodIds();
  const { foodExtraFees: currentExtraFees = {} } = menuListing.getPublicData();

  const submittedExtraFees = normalizeExtraFees(extraFees, foodIdList);

  // Drop entries for dishes no longer in the menu, whichever mode we are in.
  const keptExtraFees =
    mode === 'merge' ? normalizeExtraFees(currentExtraFees, foodIdList) : {};

  const foodExtraFees = { ...keptExtraFees, ...submittedExtraFees };

  const minFoodPriceByDay = await computeMinFoodPriceByDay({
    menuMetadata: menuListing.getMetadata(),
    foodIdList,
    foodExtraFees,
    integrationSdk,
  });

  const response = await integrationSdk.listings.update(
    { id: menuId, publicData: { foodExtraFees, ...minFoodPriceByDay } },
    { expand: true },
  );

  await syncExtraFeesToDraftPlans(menuId, foodExtraFees);

  return response;
};

export default updateMenuExtraFees;
