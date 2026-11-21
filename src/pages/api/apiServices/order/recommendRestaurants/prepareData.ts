import { DateTime } from 'luxon';

import { queryAllListings } from '@helpers/apiHelpers';
import {
  getMenuQuery,
  getMenuQueryWithDraftOrderData,
} from '@helpers/listingSearchQuery';
import { calculateDistance } from '@helpers/mapHelpers';
import { getBillablePrice, getMenuExtraFeeMap } from '@helpers/menuExtraFee';
import { mealTypeAdapter } from '@helpers/order/adapterHelper';
import {
  adjustFoodListPrice,
  getSelectedRestaurantAndFoodList,
} from '@helpers/orderHelper';
import { fetchListing, fetchUser } from '@services/integrationHelper';
import config from '@src/configs';
import { Listing, User } from '@src/utils/data';
import { convertWeekDay, renderDateRange, VNTimezone } from '@src/utils/dates';
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

export const prepareMenuFoodList = async ({
  restaurant,
  menu,
  timestamp,
  mealType: foodTypes = [],
  nutritions = [],
  packagePerMember = 0,
  order,
}: {
  restaurant: TListing;
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

  const extraFeeByFoodId = getMenuExtraFeeMap(menu);

  // * find valid food items — the budget is fee-inclusive
  const suitableFoodList = foodListFromSharetribe.filter(
    (foodListing: TListing) => {
      if (packagePerMember <= 0) return true;

      return (
        getBillablePrice(
          foodListing.attributes.price.amount,
          extraFeeByFoodId[foodListing.id.uuid],
        ) === packagePerMember
      );
    },
  );

  // * convert food list (array) to food map
  const { submitFoodListData: normalizedFoodList } =
    getSelectedRestaurantAndFoodList({
      foodList: suitableFoodList,
      foodIds: suitableFoodList.map((foodItem: TListing) => foodItem.id.uuid),
      currentRestaurant: restaurant,
      extraFeeByFoodId,
    });

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

export function filterMenusHavePackagePerMember(
  allMenus: any,
  timestamp: number,
  packagePerMember: any,
) {
  const dateTime = DateTime.fromMillis(timestamp).setZone(VNTimezone);
  const dayOfWeek = convertWeekDay(dateTime.weekday).key;

  return allMenus.filter((menu: TListing) => {
    const { foodsByDate } = Listing(menu).getPublicData();
    const foodByIds = foodsByDate[dayOfWeek];
    const foodIds = Object.keys(foodByIds);
    const extraFeeByFoodId = getMenuExtraFeeMap(menu);

    return foodIds.some(
      (foodId) =>
        getBillablePrice(foodByIds[foodId].price, extraFeeByFoodId[foodId]) ===
        packagePerMember,
    );
  });
}
