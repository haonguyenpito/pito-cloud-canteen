import { fetchListingsByChunkedIds } from '@helpers/apiHelpers';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/integrationSdk';
import { IntegrationListing, IntegrationMenuListing } from '@src/utils/data';
import {
  EBookerOrderDraftStates,
  EListingStates,
  EListingType,
} from '@src/utils/enums';
import type { TIntegrationListing, TObject } from '@src/utils/types';

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

  const plans = denormalisedResponseEntities(
    await integrationSdk.listings.query({
      meta_menuIds: `has_any:${menuId}`,
      meta_listingType: EListingType.subOrder,
    }),
  );

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
      let hasChange = false;

      const newOrderDetail = Object.keys(orderDetail).reduce(
        (result: TObject, subOrderDate: string) => {
          const subOrder = orderDetail[subOrderDate] || {};
          const { restaurant = {} } = subOrder;
          const { foodList = {} } = restaurant;

          // Only dates served by THIS menu.
          if (restaurant.menuId !== menuId) {
            return { ...result, [subOrderDate]: subOrder };
          }

          const newFoodList = Object.keys(foodList).reduce(
            (foodListResult: TObject, foodId: string) => {
              const food = foodList[foodId] || {};
              const nextExtraFee = extraFees[foodId] ?? 0;

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

          return {
            ...result,
            [subOrderDate]: {
              ...subOrder,
              restaurant: { ...restaurant, foodList: newFoodList },
            },
          };
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

/**
 * Writes the menu-scoped extra fee map. Touches nothing else on the menu — in
 * particular it must not go through `updateMenu.service.ts`, which rebuilds
 * `foodsByDate` / `<day>FoodIdList` / `<day>MinFoodPrice` from a client payload.
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

  const response = await integrationSdk.listings.update(
    { id: menuId, publicData: { foodExtraFees } },
    { expand: true },
  );

  await syncExtraFeesToDraftPlans(menuId, foodExtraFees);

  return response;
};

export default updateMenuExtraFees;
