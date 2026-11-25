import { DateTime } from 'luxon';

import { queryAllListings } from '@helpers/apiHelpers';
import {
  getMenuQuery,
  getMenuQueryWithDraftOrderData,
} from '@helpers/listingSearchQuery';
import { calculateDistance } from '@helpers/mapHelpers';
import {
  getBillablePrice,
  getFoodBillablePrice,
  getMenuExtraFeeMap,
  sanitizeExtraFeeMap,
} from '@helpers/menuExtraFee';
import { mealTypeAdapter } from '@helpers/order/adapterHelper';
import {
  adjustFoodListPrice,
  buildSnapshotFoodList,
} from '@helpers/orderHelper';
import { fetchListing, fetchUser } from '@services/integrationHelper';
import config from '@src/configs';
import type { FoodListing, MenuListing, TMenuPublicData } from '@src/types';
import { Listing, User } from '@src/utils/data';
import { convertWeekDay, renderDateRange, VNTimezone } from '@src/utils/dates';
import type { EDayOfWeek } from '@src/utils/enums';
import { EOrderType } from '@src/utils/enums';
import type { TListing, TObject } from '@src/utils/types';

export const combineMenusWithRestaurantData = ({
  menus,
  restaurants,
  shouldCalculateDistance,
  deliveryOrigin,
}: {
  menus: TListing[];
  restaurants: TListing[];
  shouldCalculateDistance: boolean;
  deliveryOrigin: TObject;
}) => {
  return menus.reduce((result: any, menu: TListing) => {
    const { restaurantId } = Listing(menu).getMetadata();
    const restaurant = restaurants.find((r: TListing) => {
      const restaurantGetter = Listing(r);

      if (shouldCalculateDistance) {
        const { geolocation: restaurantOrigin } =
          restaurantGetter.getAttributes();

        const distanceToDeliveryPlace = calculateDistance(
          deliveryOrigin,
          restaurantOrigin,
        );
        const isValidRestaurant =
          distanceToDeliveryPlace <=
          Number(config.maxKilometerFromRestaurantToDeliveryAddressForBooker);

        return isValidRestaurant && restaurantGetter.getId() === restaurantId;
      }

      return restaurantGetter.getId() === restaurantId;
    });

    return !restaurant
      ? result
      : result.concat({
          menu,
          restaurant,
        });
  }, []);
};

export const prepareRestaurantDataForOrderDetail = (
  restaurant: TListing,
  menu: TListing,
  foodList: TObject,
) => {
  const restaurantGetter = Listing(restaurant);
  const { minQuantity = 0, maxQuantity = Number.MAX_VALUE } =
    restaurantGetter.getPublicData();

  return {
    id: restaurantGetter.getId(),
    restaurantName: restaurantGetter.getAttributes().title,
    restaurantOwnerId: restaurant.author?.id?.uuid,
    foodList,
    phoneNumber: restaurantGetter.getPublicData().phoneNumber,
    menuId: menu.id.uuid,
    minQuantity,
    maxQuantity,
  };
};

/**
 * Picks the dishes of a recommended menu for one delivery date and snapshots
 * them with client and partner prices.
 * @param params.menu - The recommended menu.
 * @param params.timestamp - Timestamp of the delivery date.
 * @param params.mealType - Food types to keep.
 * @param params.nutritions - Special diets to keep.
 * @param params.packagePerMember - Keep only dishes whose client price equals
 *   it; 0 keeps every dish.
 * @param params.order - The order, to halve prices for dual-selection companies.
 * @returns The snapshotted dishes keyed by foodId.
 */
export const prepareMenuFoodList = async ({
  menu,
  timestamp,
  mealType: foodTypes = [],
  nutritions = [],
  packagePerMember = 0,
  order,
}: {
  menu: TListing;
  timestamp: number;
  mealType: string[];
  nutritions: string[];
  packagePerMember: number;
  order: TListing | null;
}) => {
  // * prepare params
  const dateTime = DateTime.fromMillis(+timestamp).setZone(VNTimezone);
  const dayOfWeek = convertWeekDay(dateTime.weekday).key;
  const foodIdList = Listing(menu).getMetadata()[`${dayOfWeek}FoodIdList`];

  const foodTypeParamMaybe =
    foodTypes.length > 0
      ? {
          pub_foodType: foodTypes.map((item: string) => mealTypeAdapter(item)),
        }
      : {};
  const specialDietParamMaybe =
    nutritions.length > 0
      ? { pub_specialDiets: `has_any:${nutritions.join(',')}` }
      : {};

  // * query food list
  const foodListFromSharetribe = await queryAllListings({
    query: {
      ids: foodIdList,
      meta_isDeleted: false,
      meta_isFoodEnable: true,
      ...foodTypeParamMaybe,
      ...specialDietParamMaybe,
    },
  });

  const extraFeeByFoodId = getMenuExtraFeeMap(menu as MenuListing);

  // * find valid food items
  const suitableFoodList: FoodListing[] = foodListFromSharetribe.filter(
    (foodListing: FoodListing) =>
      packagePerMember <= 0 ||
      getFoodBillablePrice(foodListing, extraFeeByFoodId) === packagePerMember,
  );

  // * convert food list (array) to food map
  const normalizedFoodList = buildSnapshotFoodList(
    suitableFoodList,
    suitableFoodList.map((foodItem) => foodItem.id?.uuid || ''),
    extraFeeByFoodId,
  );

  // Adjust food list price if the company is allowed to add a second food
  const foodList = order
    ? adjustFoodListPrice(normalizedFoodList, order)
    : normalizedFoodList;

  return foodList;
};

export const prepareParamsFromOrderForSpecificDay = async ({
  order,
  menuQueryParams,
}: TObject) => {
  const {
    plans = [],
    memberAmount = 0,
    deliveryAddress = {},
    companyId,
    nutritions = [],
    mealType = [],
    packagePerMember,
    orderType,
    deliveryHour,
  } = Listing(order as TListing).getMetadata();
  let orderDetail = {};

  if (plans[0]) {
    const planListing = await fetchListing(plans[0]);
    orderDetail = planListing?.attributes?.metadata?.orderDetail || {};
  }

  const company = await fetchUser(companyId);
  const { companyLocation = {} } = User(company).getPublicData();

  return {
    isNormalOrder: orderType === EOrderType.normal,
    deliveryOrigin: deliveryAddress?.origin || companyLocation?.origin,
    orderDetail,
    memberAmount,
    nutritions,
    mealType,
    packagePerMember,
    menuQuery: getMenuQuery({ order, params: menuQueryParams }),
    deliveryHour,
  };
};

// * recommend from draft order data (recommend params)
export const prepareParamsFromGivenParamsForSpecificDay = ({
  recommendParams,
  menuQueryParams,
}: TObject) => {
  const {
    memberAmount = 0,
    deliveryOrigin,
    orderDetail,
    nutritions = [],
    mealType = [],
    packagePerMember,
    daySession,
    isNormalOrder = true,
    deliveryHour,
  } = recommendParams;

  return {
    isNormalOrder,
    deliveryOrigin,
    orderDetail,
    memberAmount,
    mealType,
    nutritions,
    packagePerMember,
    menuQuery: getMenuQueryWithDraftOrderData({
      orderParams: {
        nutritions,
        mealType,
        packagePerMember,
        daySession,
      },
      params: menuQueryParams,
    }),
    deliveryHour,
  };
};

// * recommend from order data
export const prepareParamsFromOrderForAllDays = async ({ order }: TObject) => {
  const {
    dayInWeek = [],
    startDate,
    endDate,
    orderType = EOrderType.group,
    companyId,
    deliveryAddress = {},
    memberAmount = 0,
    packagePerMember = 0,
    nutritions = [],
    mealType = [],
    deliveryHour,
  } = Listing(order as TListing).getMetadata();

  const company = await fetchUser(companyId);
  const { companyLocation = {} } = User(company).getPublicData();

  return {
    nutritions,
    deliveryOrigin: deliveryAddress?.origin || companyLocation?.origin,
    packagePerMember,
    memberAmount,
    mealType,
    dayInWeek,
    totalDates: renderDateRange(startDate, endDate),
    isNormalOrder: orderType === EOrderType.normal,
    deliveryHour,
  };
};
// * recommend from draft order data (recommend params)
export const prepareParamsFromGivenParamsForAllDays = ({
  recommendParams,
}: TObject) => {
  const {
    memberAmount = 0,
    deliveryOrigin,
    dayInWeek,
    startDate,
    endDate,
    isNormalOrder,
    nutritions,
    mealType,
    packagePerMember,
    deliveryHour,
  } = recommendParams;

  return {
    nutritions,
    deliveryOrigin,
    packagePerMember,
    memberAmount,
    mealType,
    dayInWeek,
    totalDates: renderDateRange(startDate, endDate),
    isNormalOrder,
    deliveryHour,
  };
};

/**
 * Keeps the menus serving at least one dish priced exactly at the package on
 * the delivery date.
 * @param allMenus - Candidate menus.
 * @param timestamp - Timestamp of the delivery date.
 * @param packagePerMember - The fee-inclusive budget per participant.
 * @returns The menus with a dish whose client price equals the package.
 */
export function filterMenusHavePackagePerMember(
  allMenus: TListing[],
  timestamp: number,
  packagePerMember: number,
): TListing[] {
  const dateTime = DateTime.fromMillis(timestamp).setZone(VNTimezone);
  const dayOfWeek = convertWeekDay(dateTime.weekday).key as EDayOfWeek;

  return allMenus.filter((menu) => {
    const { foodsByDate, foodExtraFees } = Listing(
      menu,
    ).getPublicData() as Partial<TMenuPublicData>;
    const extraFeeByFoodId = sanitizeExtraFeeMap(foodExtraFees);

    return Object.entries(foodsByDate?.[dayOfWeek] || {}).some(
      ([foodId, food]) =>
        getBillablePrice(food?.price, extraFeeByFoodId[foodId]) ===
        packagePerMember,
    );
  });
}
