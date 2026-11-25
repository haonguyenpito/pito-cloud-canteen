import chunk from 'lodash/chunk';
import flatten from 'lodash/flatten';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';
import { DateTime } from 'luxon';

import { queryAllListings } from '@helpers/apiHelpers';
import {
  getMenuQuery,
  getMenuQueryWithDraftOrderData,
  getRestaurantQuery,
} from '@helpers/listingSearchQuery';
import { initLineItemsFromFoodList } from '@helpers/orderHelper';
import { adminQueryListings, fetchListing } from '@services/integrationHelper';
import {
  filterRestaurantsByOpenDayAndTime,
  isTimeRangeWithinInterval,
  Listing,
} from '@src/utils/data';
import { convertWeekDay, VNTimezone } from '@src/utils/dates';
import type { TDayOfWeek, TListing, TObject } from '@src/utils/types';

import {
  combineMenusWithRestaurantData,
  filterMenusHavePackagePerMember,
  prepareMenuFoodList,
  prepareParamsFromGivenParamsForAllDays,
  prepareParamsFromGivenParamsForSpecificDay,
  prepareParamsFromOrderForAllDays,
  prepareParamsFromOrderForSpecificDay,
  prepareRestaurantDataForOrderDetail,
} from './prepareData';

type TAvailabilityPlanEntries = {
  dayOfWeek: TDayOfWeek;
  seats: number;
  startTime?: string;
  endTime?: string;
};

export const recommendRestaurantForSpecificDay = async ({
  orderId,
  timestamp,
  recommendParams = {},
  shouldCalculateDistance,
  favoriteRestaurantIdList = [],
}: {
  orderId: string;
  timestamp: number;
  recommendParams?: TObject;
  shouldCalculateDistance: boolean;
  favoriteRestaurantIdList?: string[];
}) => {
  const order = await fetchListing(orderId);

  const menuQueryParams = {
    timestamp,
    favoriteRestaurantIdList,
  };

  const {
    packagePerMember,
    nutritions,
    menuQuery,
    memberAmount,
    orderDetail,
    deliveryOrigin,
    mealType,
    isNormalOrder,
    deliveryHour,
  } = isEmpty(recommendParams)
    ? await prepareParamsFromOrderForSpecificDay({
        order,
        menuQueryParams,
      })
    : prepareParamsFromGivenParamsForSpecificDay({
        recommendParams,
        menuQueryParams,
      });

  const allMenus = await queryAllListings({
    query: menuQuery,
  });

  const filteredMenus = filterMenusHavePackagePerMember(
    allMenus,
    timestamp,
    packagePerMember,
  );

  const restaurantIdList = chunk(
    uniq<string>(
      filteredMenus.map(
        (menu: TListing) => menu?.attributes?.metadata?.restaurantId,
      ),
    ),
    100,
  );

  const restaurantsResponse = flatten(
    await Promise.all(
      restaurantIdList.map(async (ids) =>
        adminQueryListings(
          getRestaurantQuery({
            restaurantIds: ids,
            companyAccount: null,
            deliveryLatLng: {
              lat:
                order?.attributes?.metadata?.deliveryAddress?.origin?.lat ?? 0,
              lng:
                order?.attributes?.metadata?.deliveryAddress?.origin?.lng ?? 0,
            },
            isRestrictDistance: true,
            params: {
              memberAmount,
            },
          }),
        ),
      ),
    ),
  );

  const restaurants = combineMenusWithRestaurantData({
    menus: filteredMenus,
    restaurants: restaurantsResponse,
    shouldCalculateDistance,
    deliveryOrigin,
  });
  let restaurantsFiltered = restaurants;

  const dateTime = DateTime.fromMillis(timestamp).setZone(VNTimezone);
  const dayOfWeek = convertWeekDay(dateTime.weekday).key;

  if (dayOfWeek) {
    restaurantsFiltered = filterRestaurantsByOpenDayAndTime(restaurants, {
      dayOfWeek,
      rangeStart: deliveryHour?.split('-')[0],
      rangeEnd: deliveryHour?.split('-')[1],
    });
  }

  if (restaurantsFiltered.length > 0) {
    const randomNumber = Math.floor(Math.random() * restaurantsFiltered.length);

    const otherRandomNumber = Math.abs(
      randomNumber - restaurantsFiltered.length + 1,
    );

    const randomRestaurantObjA = restaurantsFiltered[randomNumber];

    const randomRestaurantObj =
      randomRestaurantObjA?.restaurant?.id?.uuid !==
      orderDetail[timestamp]?.restaurant?.id
        ? randomRestaurantObjA
        : restaurantsFiltered[otherRandomNumber];

    const { menu, restaurant } = randomRestaurantObj;

    const foodList = await prepareMenuFoodList({
      menu,
      timestamp,
      nutritions,
      packagePerMember,
      mealType,
      order,
    });

    return {
      ...orderDetail,
      [timestamp]: {
        ...orderDetail[timestamp],
        lineItems: initLineItemsFromFoodList(foodList, isNormalOrder),
        restaurant: prepareRestaurantDataForOrderDetail(
          restaurant,
          menu,
          foodList,
        ),
      },
    };
  }

  return {
    ...orderDetail,
    [timestamp]: {
      ...orderDetail[timestamp],
      hasNoRestaurants: true,
    },
  };
};

export const recommendRestaurants = async ({
  orderId,
  recommendParams = {},
  shouldCalculateDistance,
  favoriteRestaurantIdList = [],
}: {
  orderId: string;
  recommendParams?: TObject;
  shouldCalculateDistance: boolean;
  favoriteRestaurantIdList?: string[];
}) => {
  const orderDetail: TObject = {};
  const order = await fetchListing(orderId as string);

  const {
    nutritions,
    deliveryOrigin,
    packagePerMember,
    memberAmount,
    mealType,
    dayInWeek,
    totalDates,
    isNormalOrder,
    deliveryHour,
  } = isEmpty(recommendParams)
    ? await prepareParamsFromOrderForAllDays({ order })
    : prepareParamsFromGivenParamsForAllDays({ recommendParams });

  const lineItemsMaybe = isNormalOrder ? { lineItems: [] } : {};

  await Promise.all(
    totalDates.map(async (timestamp) => {
      // * query all menus
      const menuQueryParams = {
        timestamp,
        favoriteRestaurantIdList,
      };
      const menuQuery = isEmpty(recommendParams)
        ? getMenuQuery({
            order,
            params: menuQueryParams,
          })
        : getMenuQueryWithDraftOrderData({
            params: menuQueryParams,
            orderParams: recommendParams,
          });
      const allMenus = await queryAllListings({
        query: menuQuery,
      });

      const filteredMenus = filterMenusHavePackagePerMember(
        allMenus,
        timestamp,
        packagePerMember,
      );

      const restaurantIdList = chunk(
        uniq<string>(
          filteredMenus.map((menu: TListing) => {
            const { restaurantId } = Listing(menu).getMetadata();

            return restaurantId;
          }),
        ),
        100,
      );

      const restaurantsResponse = flatten(
        await Promise.all(
          restaurantIdList.map(async (ids) => {
            const restaurantQuery = getRestaurantQuery({
              restaurantIds: ids,
              companyAccount: null,
              deliveryLatLng: {
                lat:
                  order?.attributes?.metadata?.deliveryAddress?.origin?.lat ??
                  0,
                lng:
                  order?.attributes?.metadata?.deliveryAddress?.origin?.lng ??
                  0,
              },
              isRestrictDistance: true,
              params: {
                memberAmount,
              },
            });

            return adminQueryListings(restaurantQuery);
          }),
        ),
      );

      const restaurants = combineMenusWithRestaurantData({
        menus: filteredMenus,
        restaurants: restaurantsResponse,
        shouldCalculateDistance,
        deliveryOrigin,
      });

      const restaurantsFiltered = restaurants?.filter((item: any) =>
        item?.restaurant?.attributes?.availabilityPlan?.entries?.some(
          (entry: TAvailabilityPlanEntries) => {
            const isDayMatch = dayInWeek?.includes(entry?.dayOfWeek);

            if (deliveryHour) {
              const [rangeStart, rangeEnd] = deliveryHour.split('-');
              const isTimeMatch = isTimeRangeWithinInterval(
                entry?.startTime,
                entry?.endTime,
                rangeStart,
                rangeEnd,
              );

              return isDayMatch && isTimeMatch;
            }

            return isDayMatch;
          },
        ),
      );
      if (restaurantsFiltered.length > 0) {
        const randomRestaurant =
          restaurantsFiltered[
            Math.floor(Math.random() * restaurantsFiltered.length)
          ];
        const { menu, restaurant } = randomRestaurant;

        const timestampWeekDay = convertWeekDay(
          DateTime.fromMillis(timestamp).setZone(VNTimezone).weekday,
        ).key;

        if (dayInWeek.includes(timestampWeekDay)) {
          const foodList = await prepareMenuFoodList({
            menu,
            timestamp,
            nutritions,
            mealType,
            packagePerMember,
            order,
          });

          orderDetail[timestamp] = {
            ...orderDetail[timestamp],
            lineItems: initLineItemsFromFoodList(foodList, isNormalOrder),
            restaurant: prepareRestaurantDataForOrderDetail(
              restaurant,
              menu,
              foodList,
            ),
            hasNoRestaurants: false,
          };
        } else {
          orderDetail[timestamp] = {
            ...orderDetail[timestamp],
            ...lineItemsMaybe,
            hasNoRestaurants: false,
          };
        }
      } else {
        orderDetail[timestamp] = {
          ...orderDetail[timestamp],
          ...lineItemsMaybe,
          hasNoRestaurants: true,
        };
      }
    }),
  );

  return orderDetail;
};
