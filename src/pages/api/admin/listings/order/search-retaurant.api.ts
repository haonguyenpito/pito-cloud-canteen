import { chunk, flatten } from 'lodash';
import { DateTime } from 'luxon';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { queryAllFoodIdList, queryAllPages } from '@helpers/apiHelpers';
import { getMenuQuery, getRestaurantQuery } from '@helpers/listingSearchQuery';
import { pickBookerRestaurantMenu } from '@helpers/pickBookerRestaurantMenu';
import { filterRestaurant, searchTitle } from '@helpers/searchRestaurantHelper';
import cookies from '@services/cookie';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk, getSdk, handleError } from '@services/sdk';
import type { TFoodInRestaurant } from '@src/types/bookerSelectRestaurant';
import {
  CurrentUser,
  denormalisedResponseEntities,
  filterRestaurantsByOpenDayAndTime,
  Listing,
} from '@src/utils/data';
import { convertWeekDay, VNTimezone } from '@src/utils/dates';
import type { TListing } from '@src/utils/types';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;
    const integrationSdk = getIntegrationSdk();
    const sdk = getSdk(req, res);

    switch (apiMethod) {
      case HttpMethod.GET: {
        const params = JSON.parse(req.query.JSONParams as string);
        const { orderId, timestamp } = params;

        const order = await fetchListing(orderId as string);
        const currentUserRes = await sdk.currentUser.show();
        const [companyAccount] = denormalisedResponseEntities(currentUserRes);

        const { keywords, ...queryWithoutKeywords } = params;
        const query = getMenuQuery({
          order,
          params: queryWithoutKeywords,
          options: {
            ignoreSearchByPackagePermember: true,
          },
        });

        const orderListing = Listing(order);
        const {
          memberAmount = 0,
          startDate,
          endDate,
          deliveryAddress = {},
          packagePerMember = 0,
          nutritions = [],
          deliveryHour,
        } = orderListing.getMetadata();
        const allMenus: TListing[] = await queryAllPages({
          sdkModel: integrationSdk.listings,
          query,
        });
        const dateTime = DateTime.fromMillis(timestamp).setZone(VNTimezone);
        const dayOfWeek = convertWeekDay(dateTime.weekday).key;
        const foodIds: string[] = [];
        const groupedRestaurantIdInMenuDatas = new Map<string, TListing[]>();
        allMenus.forEach((menu) => {
          const menuListing = Listing(menu);
          const { restaurantId } = menuListing.getMetadata();

          const dayOfWeekInFoods: any[] | null =
            menuListing.getMetadata()[`${dayOfWeek}FoodIdList`];
          if (!restaurantId || !dayOfWeekInFoods) {
            return;
          }
          if (groupedRestaurantIdInMenuDatas.has(restaurantId)) {
            groupedRestaurantIdInMenuDatas.get(restaurantId)?.push(menu);
          } else {
            groupedRestaurantIdInMenuDatas.set(restaurantId, [menu]);
          }
          foodIds.push(...dayOfWeekInFoods);
        });

        const totalRestaurantIds = Array.from(
          groupedRestaurantIdInMenuDatas.keys(),
        );
        const slicedRestaurantIdsBy100 = chunk(totalRestaurantIds, 100);

        const restaurantQueries = slicedRestaurantIdsBy100.map(
          (restaurantIds) =>
            getRestaurantQuery({
              restaurantIds,
              companyAccount,
              params: {
                ...queryWithoutKeywords,
                memberAmount,
                startDate,
                endDate,
              },
            }),
        );

        const restaurantsResponse = await Promise.all(
          restaurantQueries.map(async (restaurantQuery) => {
            const response = await integrationSdk.listings.query(
              restaurantQuery,
            );
            const { meta: chunkRestaurantResponseMeta } = response.data;

            return {
              chunkRestaurantsResponse: denormalisedResponseEntities(response),
              chunkRestaurantResponseMeta,
            };
          }),
        );

        const restaurantIdList: any[] = [];
        const combinedRestaurantMenuData: {
          restaurantId: string;
          menuId: string;
        }[] = [];

        const foodQueries = chunk(foodIds, 100).map((slicedFoodIds) =>
          queryAllFoodIdList(slicedFoodIds, nutritions),
        );

        const foodsResponse = await Promise.all(
          foodQueries.map(async (foodQuery) => {
            const response = await integrationSdk.listings.query(foodQuery);

            return denormalisedResponseEntities(response);
          }),
        );

        const foodListings: TListing[] = flatten(foodsResponse);
        const mapFoodId = foodListings.reduce((acc, current: TListing) => {
          const id = current.id.uuid;
          if (!acc.has(id)) {
            acc.set(id, current);
          }

          return acc;
        }, new Map<string, TListing>());
        const searchResult: TListing[] = [];
        const combinedRestaurantInFoods: TFoodInRestaurant[] = [];

        filterRestaurantsByOpenDayAndTime(
          flatten(
            restaurantsResponse.map(
              ({ chunkRestaurantsResponse }) => chunkRestaurantsResponse,
            ),
          ).map((restaurant) => {
            return {
              restaurant,
            };
          }),
          {
            dayOfWeek,
            rangeStart: deliveryHour?.split('-')[0],
            rangeEnd: deliveryHour?.split('-')[1],
          },
        ).forEach(({ restaurant }: { restaurant: TListing }) => {
          const restaurantListing = Listing(restaurant);
          const restaurantId = restaurantListing.getId();
          const { title } = restaurantListing.getAttributes();
          const isValidKeyWords = filterRestaurant(
            restaurant,
            timestamp,
            deliveryAddress,
          );

          const menusForRestaurant =
            groupedRestaurantIdInMenuDatas.get(restaurantId);
          if (!isValidKeyWords || !menusForRestaurant?.length) {
            return;
          }

          const pickMenuParams = {
            menus: menusForRestaurant,
            dayOfWeek,
            mapFoodId,
            packagePerMember,
          };

          const { menu: menuPicked, foods: foodsPicked } =
            !keywords || searchTitle(title, keywords)
              ? pickBookerRestaurantMenu(pickMenuParams)
              : pickBookerRestaurantMenu({
                  ...pickMenuParams,
                  foodNameKeywords: keywords,
                });

          if (menuPicked && foodsPicked.length) {
            combinedRestaurantMenuData.push({
              restaurantId,
              menuId: menuPicked.id.uuid as string,
            });
            searchResult.push(restaurant);
            combinedRestaurantInFoods.push(...foodsPicked);
            restaurantIdList.push(restaurantId);
          }
        });

        if (keywords && companyAccount) {
          const currentUserId = CurrentUser(companyAccount).getId();
          const { previousKeywords = [] } =
            CurrentUser(companyAccount).getMetadata();

          if (
            !previousKeywords ||
            previousKeywords.length === 0 ||
            keywords !== previousKeywords[0]
          ) {
            const arrayKeywords = [
              ...[keywords],
              ...(previousKeywords
                ? previousKeywords.filter((kw: string) => kw !== keywords)
                : []),
            ];
            integrationSdk.users.updateProfile({
              id: currentUserId,
              metadata: {
                previousKeywords: arrayKeywords,
              },
            });
          }
        }

        const matchedPackagePerMemberRestaurants = searchResult.map(
          (restaurant) => {
            const restaurantId = restaurant.id.uuid;
            const restHavingMatchedPackagePerMemberFoods =
              combinedRestaurantInFoods.filter(
                (food) =>
                  food.restaurantId === restaurantId &&
                  food.price === packagePerMember,
              );

            return {
              ...restaurant,
              numberOfMatchedPackagePerMemberFoods:
                restHavingMatchedPackagePerMemberFoods.length,
            };
          },
        );

        return res.status(200).json({
          ...(restaurantIdList.length > 0 && {
            restaurantIdList,
          }),
          searchResult: matchedPackagePerMemberRestaurants,
          combinedRestaurantMenuData,
          totalItems: searchResult.length,
          combinedRestaurantInFoods,
        });
      }

      default:
        break;
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(handler);
