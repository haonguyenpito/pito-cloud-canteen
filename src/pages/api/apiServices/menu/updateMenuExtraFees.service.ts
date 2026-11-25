import {
  fetchListingsByChunkedIds,
  queryAllListings,
} from '@helpers/apiHelpers';
import { getMinBillablePrice } from '@helpers/menuExtraFee';
import type { TPlanOrderDetail } from '@helpers/order/partnerPriceHelper';
import { repriceSubOrder } from '@helpers/order/repriceSubOrderHelper';
import { getIsAllowAddSecondaryFood } from '@helpers/orderHelper';
import { withPlanLock } from '@services/distributedLock';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import type { MenuListing, OrderListing, PlanListing } from '@src/types';
import { IntegrationMenuListing } from '@src/utils/data';
import {
  EBookerOrderDraftStates,
  EDayOfWeek,
  EListingStates,
  EListingType,
  EOrderDraftStates,
} from '@src/utils/enums';
import type { TListing } from '@src/utils/types';

/** Approval freezes the fee: only these menu states accept a new one. */
const EDITABLE_MENU_STATES: string[] = [
  EListingStates.draft,
  EListingStates.pendingApproval,
];

/** Orders whose plan snapshot is not final yet and follows the menu's fee. */
const DRAFT_ORDER_STATES: string[] = [
  EOrderDraftStates.draft,
  EOrderDraftStates.pendingApproval,
  EBookerOrderDraftStates.bookerDraft,
];

export class MenuExtraFeeError extends Error {
  status: number;

  invalidFoodIds: string[];

  /**
   * @param message - Message shown to the admin.
   * @param status - HTTP status the API answers with.
   * @param invalidFoodIds - Dishes whose submitted fee was rejected.
   */
  constructor(message: string, status: number, invalidFoodIds: string[] = []) {
    super(message);
    this.status = status;
    this.invalidFoodIds = invalidFoodIds;
  }
}

/**
 * Checks a submitted fee map against the dishes of the menu.
 * @param extraFees - The submitted `{ [foodId]: fee }`.
 * @param menuFoodIds - The dishes the menu serves.
 * @returns The dishes whose fee is not a non-negative whole number or that the
 *   menu does not serve. Empty when the map is valid.
 */
export const findInvalidExtraFees = (
  extraFees: Record<string, unknown>,
  menuFoodIds: string[],
): string[] => {
  const servedFoodIds = new Set(menuFoodIds);

  return Object.entries(extraFees)
    .filter(
      ([foodId, fee]) =>
        !servedFoodIds.has(foodId) ||
        typeof fee !== 'number' ||
        !Number.isInteger(fee) ||
        fee < 0,
    )
    .map(([foodId]) => foodId);
};

/**
 * Computes `<day>MinFoodPrice` of every day from the food listings (the source
 * of the partner price) and the new fee map. A day whose dishes cannot be read
 * is left out, so its current value is kept rather than reset to 0.
 * @param menu - The menu listing.
 * @param extraFees - The new fee map.
 * @returns `{ monMinFoodPrice, … }` for the days that could be computed.
 */
const computeMinFoodPriceByDay = async (
  menu: MenuListing,
  extraFees: Record<string, number>,
): Promise<Record<string, number>> => {
  const integrationSdk = getIntegrationSdk();
  const menuGetter = IntegrationMenuListing(menu as TListing);
  const metadata = menuGetter.getMetadata();
  const foods: TListing[] = await fetchListingsByChunkedIds(
    menuGetter.getListFoodIds(),
    integrationSdk,
  );
  const priceByFoodId = new Map<string, number>(
    foods.map((food) => [food.id.uuid, food.attributes.price?.amount || 0]),
  );

  return Object.values(EDayOfWeek).reduce<Record<string, number>>(
    (result, day) => {
      const dayFoods = ((metadata[`${day}FoodIdList`] || []) as string[])
        .filter((foodId) => priceByFoodId.has(foodId))
        .map((foodId) => ({ foodId, price: priceByFoodId.get(foodId) }));

      return dayFoods.length === 0
        ? result
        : {
            ...result,
            [`${day}MinFoodPrice`]: getMinBillablePrice(dayFoods, extraFees),
          };
    },
    {},
  );
};

/**
 * Re-prices the draft orders served by the menu. Each plan is re-read and
 * written under its plan lock, and only the dates served by this menu change:
 * a plan spans several menus, each with its own fees.
 * @param menuId - The menu whose fees changed.
 * @param extraFees - The new fee map.
 * @throws MenuExtraFeeError when some plans could not be re-priced; saving the
 *   same fees again re-runs the sync.
 */
const syncExtraFeesToDraftPlans = async (
  menuId: string,
  extraFees: Record<string, number>,
) => {
  const integrationSdk = getIntegrationSdk();
  const plans: PlanListing[] = await queryAllListings({
    query: {
      meta_menuIds: `has_any:${menuId}`,
      meta_listingType: EListingType.subOrder,
    },
  });
  const orderIds = plans
    .map((plan) => plan.attributes?.metadata?.orderId)
    .filter((orderId): orderId is string => !!orderId);
  const orders: OrderListing[] = await fetchListingsByChunkedIds(
    orderIds,
    integrationSdk,
  );
  const draftOrders = orders.filter((order) =>
    DRAFT_ORDER_STATES.includes(order.attributes?.metadata?.orderState || ''),
  );

  const results = await Promise.allSettled(
    draftOrders.map(async (order) => {
      const planId = order.attributes?.metadata?.plans?.[0];

      if (!planId) {
        return;
      }

      const isSecondaryFoodAllowed = getIsAllowAddSecondaryFood(
        order as TListing,
      );

      await withPlanLock(planId, async () => {
        const plan: PlanListing = await fetchListing(planId);
        const orderDetail: TPlanOrderDetail =
          plan.attributes?.metadata?.orderDetail || {};
        let hasChange = false;

        const newOrderDetail = Object.fromEntries(
          Object.entries(orderDetail).map(([date, subOrder]) => {
            if (!subOrder || subOrder.restaurant?.menuId !== menuId) {
              return [date, subOrder];
            }

            const repriced = repriceSubOrder(subOrder, {
              extraFeeByFoodId: extraFees,
              isSecondaryFoodAllowed,
            });
            hasChange = hasChange || repriced.hasChange;

            return [date, repriced.subOrder];
          }),
        );

        if (hasChange) {
          await integrationSdk.listings.update({
            id: planId,
            metadata: { orderDetail: newOrderDetail },
          });
        }
      });
    }),
  );
  const failedCount = results.filter(
    ({ status }) => status === 'rejected',
  ).length;

  if (failedCount > 0) {
    throw new MenuExtraFeeError(
      `Đã lưu phụ phí nhưng chưa cập nhật được ${failedCount} đơn nháp. Vui lòng lưu lại`,
      500,
    );
  }
};

/**
 * Replaces a menu's extra fees (phí phụ thu), keeps `<day>MinFoodPrice`
 * fee-inclusive and re-prices the draft orders using the menu. Writes nothing
 * on the food listings.
 * @param menuId - The menu.
 * @param extraFees - The complete `{ [foodId]: fee }` map; a dish left out has
 *   no fee.
 * @returns The updated menu listing.
 * @throws MenuExtraFeeError 409 when the menu is already approved, 400 when a
 *   fee is invalid.
 */
const updateMenuExtraFees = async (
  menuId: string,
  extraFees: Record<string, unknown>,
) => {
  const integrationSdk = getIntegrationSdk();
  const menu: MenuListing = await fetchListing(menuId);
  const listingState = menu.attributes?.metadata?.listingState || '';

  if (!EDITABLE_MENU_STATES.includes(listingState)) {
    throw new MenuExtraFeeError(
      'Menu đã được duyệt. Không thể cập nhật phụ phí',
      409,
    );
  }

  const invalidFoodIds = findInvalidExtraFees(
    extraFees,
    IntegrationMenuListing(menu as TListing).getListFoodIds(),
  );

  if (invalidFoodIds.length > 0) {
    throw new MenuExtraFeeError(
      'Phụ phí phải là số nguyên không âm của món thuộc menu',
      400,
      invalidFoodIds,
    );
  }

  const foodExtraFees = extraFees as Record<string, number>;
  const minFoodPriceByDay = await computeMinFoodPriceByDay(menu, foodExtraFees);

  const response = await integrationSdk.listings.update(
    { id: menuId, publicData: { foodExtraFees, ...minFoodPriceByDay } },
    { expand: true },
  );

  await syncExtraFeesToDraftPlans(menuId, foodExtraFees);

  return response;
};

export default updateMenuExtraFees;
