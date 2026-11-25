/* eslint-disable @typescript-eslint/no-loop-func, no-loop-func */
/* eslint-disable no-await-in-loop */
// pub_* are Sharetribe query parameter names.
/* eslint-disable camelcase */
import { mapLimit } from 'async';
import { chunk, flatten, mapValues, omit, uniq } from 'lodash';

import type { TFoodFilter } from '@apis/foodApi';
import { queryAllListings } from '@helpers/apiHelpers';
import {
  getMinBillablePrice,
  sanitizeExtraFeeMap,
} from '@helpers/menuExtraFee';
import type {
  TPlanOrderDetail,
  TPlanSubOrder,
} from '@helpers/order/partnerPriceHelper';
import { repriceSubOrder } from '@helpers/order/repriceSubOrderHelper';
import { getIsAllowAddSecondaryFood } from '@helpers/orderHelper';
import { denormalisedResponseEntities } from '@services/data';
import { withPlanLock } from '@services/distributedLock';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import type { PlanListing } from '@src/types';
import { getUniqueString, IntegrationListing, Listing } from '@src/utils/data';
import {
  EBookerOrderDraftStates,
  EDayOfWeek,
  EListingStates,
  EListingType,
  EOrderDraftStates,
} from '@src/utils/enums';
import type { TFoodList } from '@src/utils/orderTypes';
import type { TIntegrationListing, TListing } from '@src/utils/types';

/**
 * Computes a menu day's `<day>MinFoodPrice` from the day's food listings.
 * @param foods - Food listings served that day.
 * @param foodExtraFees - The menu's raw `foodExtraFees`.
 * @returns The cheapest client price (base + the menu's fee), 0 when empty.
 */
const getMinBillablePriceOfFoods = (
  foods: TIntegrationListing[],
  foodExtraFees?: Record<string, unknown> | null,
): number =>
  getMinBillablePrice(
    foods.map((food) => ({
      foodId: food.id.uuid,
      price: food.attributes?.price?.amount || 0,
    })),
    sanitizeExtraFeeMap(foodExtraFees),
  );

/**
 * Drops the fees of deleted dishes so they cannot resurface if the dish is
 * added back to the menu.
 * @param foodExtraFees - The menu's raw `foodExtraFees`.
 * @param deletedFoodIds - The deleted dishes.
 * @returns The remaining fees, or undefined when nothing has to change.
 */
const omitDeletedFoodExtraFees = (
  foodExtraFees: Record<string, unknown> | null | undefined,
  deletedFoodIds: string[],
): Record<string, number> | undefined =>
  foodExtraFees && deletedFoodIds.some((foodId) => foodId in foodExtraFees)
    ? omit(sanitizeExtraFeeMap(foodExtraFees), deletedFoodIds)
    : undefined;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const startOfVietnamDay = (date: string) =>
  new Date(`${date}T00:00:00+07:00`).getTime();

export const buildFoodFilterQuery = (
  restaurantId: string,
  filter: TFoodFilter = {},
) => {
  const {
    keywords,
    pub_category,
    pub_foodType,
    priceFrom,
    priceTo,
    createdAtFrom,
    createdAtTo,
  } = filter;

  return {
    meta_listingType: EListingType.food,
    meta_restaurantId: restaurantId,
    meta_isDeleted: false,
    // Integration API also returns closed listings; match what the Marketplace API used to show.
    states: EListingStates.published,
    ...(keywords ? { keywords } : {}),
    ...(pub_category?.length ? { pub_category } : {}),
    ...(pub_foodType ? { pub_foodType } : {}),
    // Sharetribe range upper bounds are exclusive; filters are inclusive.
    ...(priceFrom || priceTo
      ? { price: `${priceFrom || ''},${priceTo ? priceTo + 1 : ''}` }
      : {}),
    ...(createdAtFrom
      ? {
          createdAtStart: new Date(
            startOfVietnamDay(createdAtFrom),
          ).toISOString(),
        }
      : {}),
    ...(createdAtTo
      ? {
          createdAtEnd: new Date(
            startOfVietnamDay(createdAtTo) + ONE_DAY_MS,
          ).toISOString(),
        }
      : {}),
  };
};

/**
 * `foodsByDate` with the price and title of every updated dish taken from its
 * listing, or null when no entry changed.
 */
export const syncFoodsByDate = (
  foodsByDate: Record<string, Record<string, any>> | undefined,
  updatedFoodList: TFoodList,
) => {
  if (!foodsByDate) return null;
  let changed = false;
  const synced = Object.fromEntries(
    Object.entries(foodsByDate).map(([day, dayFoods]) => [
      day,
      Object.fromEntries(
        Object.entries(dayFoods || {}).map(([foodId, food]) => {
          const updatedFood = updatedFoodList[foodId];
          if (
            !updatedFood ||
            (food?.price === updatedFood.foodPrice &&
              food?.title === updatedFood.foodName)
          ) {
            return [foodId, food];
          }
          changed = true;

          return [
            foodId,
            {
              ...food,
              price: updatedFood.foodPrice,
              title: updatedFood.foodName,
            },
          ];
        }),
      ),
    ]),
  );

  return changed ? synced : null;
};

export const fetchListingsByChunkedIds = async (ids: string[], sdk: any) => {
  const listingsResponse = await Promise.all(
    chunk<string>(ids, 100).map(async (_ids) => {
      const response = await sdk.listings.query({
        ids: _ids,
      });

      return denormalisedResponseEntities(response);
    }),
  );

  return flatten(listingsResponse);
};

export const queryMenuByIdList = async (menuIdList: string[]) => {
  const integrationSdk = getIntegrationSdk();

  const menuResponse = await integrationSdk.listings.query({
    ids: menuIdList,
  });

  const menus = denormalisedResponseEntities(menuResponse);

  return menus;
};

/**
 * Removes deleted dishes from every menu serving them: per-day food lists,
 * `foodsByDate`, the dishes' extra fees and the fee-inclusive
 * `<day>MinFoodPrice`.
 * @param foodIds - The deleted dishes.
 */
export const updateMenuAfterFoodDeletedByListId = async (foodIds: string[]) => {
  try {
    const integrationSdk = getIntegrationSdk();

    let updateMap: any = {};

    let menuListWithFoodIds: any = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const deletedFoodId of foodIds) {
      const deletedFood = await fetchListing(deletedFoodId);

      const { menuIdList = [] } =
        IntegrationListing(deletedFood).getPublicData();

      const menus = (await queryMenuByIdList(menuIdList)) || [];
      menus.forEach((menu: TIntegrationListing) => {
        menuListWithFoodIds = {
          ...menuListWithFoodIds,
          [menu.id.uuid]: {
            ...menuListWithFoodIds[menu.id.uuid],
            details: menu,
            foodIds: [
              ...(menuListWithFoodIds[menu.id.uuid]?.foodIds || []),
              deletedFoodId,
            ],
          },
        };
      });
    }
    await Promise.all(
      Object.keys(menuListWithFoodIds).map(async (key) => {
        const { details, foodIds: deletedFoodIds = [] } =
          menuListWithFoodIds[key];

        return Promise.all(
          Object.keys(EDayOfWeek).map(async (dayKey) => {
            const day = EDayOfWeek[dayKey as keyof typeof EDayOfWeek];
            const foodIdList =
              IntegrationListing(details).getMetadata()[`${day}FoodIdList`] ||
              [];

            const currentMinFoodPrice =
              IntegrationListing(details).getPublicData()[
                `${day}MinFoodPrice`
              ] || 0;

            const { foodsByDate = {}, foodExtraFees } =
              IntegrationListing(details).getPublicData();

            const foodsByDay = foodsByDate?.[day];

            deletedFoodIds.forEach((foodId: string) => {
              delete foodsByDay?.[foodId];
            });

            const prunedExtraFees = omitDeletedFoodExtraFees(
              foodExtraFees,
              deletedFoodIds,
            );

            const newFoodIdList = foodIdList.filter(
              (foodId: string) => !deletedFoodIds.includes(foodId),
            );

            let newMinFoodPrice;
            let newFoodTypeList;
            let newFoodNutritions;
            const deletedFoodIsInDay = foodIdList.some((id: string) =>
              deletedFoodIds.includes(id),
            );

            if (deletedFoodIsInDay) {
              const listFoodResponse = await integrationSdk.listings.query({
                ids: newFoodIdList.slice(0, 50),
              });

              const foods = denormalisedResponseEntities(listFoodResponse);

              newMinFoodPrice = getMinBillablePriceOfFoods(
                foods,
                prunedExtraFees ?? foodExtraFees,
              );
              newFoodTypeList = getUniqueString(
                foods.reduce((prev: string[], f: TIntegrationListing) => {
                  const { foodType } = IntegrationListing(f).getPublicData();
                  if (!foodType) return prev;

                  return [...prev, foodType];
                }, [] as string[]),
              );

              newFoodNutritions = uniq(
                foods.reduce((result: any, food: TIntegrationListing) => {
                  const { specialDiets = [] } =
                    IntegrationListing(food).getPublicData();

                  return [...result, ...specialDiets];
                }, []),
              );
            }
            const minPriceChanged = newMinFoodPrice !== currentMinFoodPrice;
            const menuId = IntegrationListing(details).getId();
            updateMap = {
              ...updateMap,
              [menuId]: {
                publicData: {
                  ...(updateMap[menuId as keyof typeof updateMap]?.publicData ||
                    {}),
                  ...(minPriceChanged
                    ? {
                        [`${day}MinFoodPrice`]: newMinFoodPrice,
                      }
                    : {}),
                  ...(prunedExtraFees
                    ? { foodExtraFees: prunedExtraFees }
                    : {}),
                  foodsByDate: {
                    ...(updateMap[menuId as keyof typeof updateMap]?.publicData
                      ?.foodsByDate || foodsByDate),
                    ...(foodsByDay ? { [day]: foodsByDay } : {}),
                  },
                },
                metadata: {
                  ...(updateMap[menuId as keyof typeof updateMap]?.metadata ||
                    {}),
                  [`${day}FoodIdList`]: newFoodIdList,
                  [`${day}FoodType`]: newFoodTypeList,
                  [`${day}Nutritions`]: newFoodNutritions,
                },
              },
            };
          }),
        );
      }),
    );
    const response = await Promise.all(
      Object.keys(updateMap).map(async (menuId) => {
        await integrationSdk.listings.update({
          id: menuId,
          publicData: {
            ...(updateMap[menuId as keyof typeof updateMap]?.publicData || {}),
          },
          metadata: {
            ...(updateMap[menuId as keyof typeof updateMap]?.metadata || {}),
          },
        });
      }),
    );

    return response;
  } catch (error) {
    console.error(`SERVER updateMenuAfterFoodDeletedByListId`, error);
  }
};

const removeFoodFromDraftOrder = async (
  menuIds: string[],
  deletedFoodId: string,
) => {
  if (menuIds.length === 0) return;
  const integrationSdk = getIntegrationSdk();

  const plans = await queryAllListings({
    query: {
      meta_listingType: EListingType.subOrder,
      meta_menuIds: `has_any:${menuIds.join(',')}`,
    },
  });

  await mapLimit(plans, 10, async (plan: TListing) => {
    try {
      const planListing = Listing(plan);

      const { orderId } = planListing.getMetadata();

      const order = await fetchListing(orderId);

      const orderListing = Listing(order);

      const { orderState } = orderListing.getMetadata();

      const orderIsDraft = [
        EOrderDraftStates.draft,
        EBookerOrderDraftStates.bookerDraft,
        EOrderDraftStates.pendingApproval,
      ].includes(orderState);

      if (!orderIsDraft) return;

      const planId = planListing.getId();
      await withPlanLock(planId, async () => {
        const { orderDetail = {} } = Listing(
          await fetchListing(planId),
        ).getMetadata();

        let newOrderDetail = { ...orderDetail };

        Object.keys(newOrderDetail).forEach((subOrderDate: string) => {
          const {
            memberOrders = {},
            restaurant = {},
            lineItems = [],
          } = newOrderDetail[subOrderDate];

          const newMemberOrders = { ...memberOrders };

          const newFoodList = { ...restaurant.foodList };

          Object.keys(newMemberOrders).forEach((memberId: string) => {
            const { foodId } = newMemberOrders[memberId];

            if (foodId === deletedFoodId) {
              newMemberOrders[memberId].foodId = '';
            }
          });

          Object.keys(newFoodList).forEach((foodId: string) => {
            if (foodId === deletedFoodId) {
              delete newFoodList[foodId];
            }
          });

          const newLineItems = lineItems.filter(
            (lineItem: any) => lineItem.id !== deletedFoodId,
          );

          newOrderDetail = {
            ...newOrderDetail,
            [subOrderDate]: {
              ...newOrderDetail[subOrderDate],
              memberOrders: newMemberOrders,
              restaurant: {
                ...restaurant,
                foodList: newFoodList,
              },
              lineItems: newLineItems,
            },
          };
        });

        await integrationSdk.listings.update({
          id: planId,
          metadata: {
            orderDetail: newOrderDetail,
          },
        });
      });
    } catch (error) {
      console.error(`SERVER removeFoodFromDraftOrder`, error);
    }
  });
};

/**
 * Removes one deleted dish from every menu serving it: per-day food lists,
 * `foodsByDate`, its extra fee and the fee-inclusive `<day>MinFoodPrice`.
 * @param deletedFoodId - The deleted dish.
 */
export const updateMenuAfterFoodDeleted = async (deletedFoodId: string) => {
  try {
    const integrationSdk = getIntegrationSdk();

    const deletedFood = await fetchListing(deletedFoodId);

    const deletedFoodListing = IntegrationListing(deletedFood);

    const { menuIdList = [] } = deletedFoodListing.getPublicData();

    const menus = await queryMenuByIdList(menuIdList);

    let updateMap: any = {};

    const menuIds = menus.map((menu: TIntegrationListing) => menu.id.uuid);

    await Promise.all(
      menus.map(async (menu: TIntegrationListing) => {
        return Promise.all(
          Object.keys(EDayOfWeek).map(async (key) => {
            const day = EDayOfWeek[key as keyof typeof EDayOfWeek];
            const menuListing = IntegrationListing(menu);
            const foodIdList =
              menuListing.getMetadata()[`${day}FoodIdList`] || [];

            const currentMinFoodPrice =
              menuListing.getPublicData()[`${day}MinFoodPrice`] || 0;

            const { foodsByDate, foodExtraFees } = menuListing.getPublicData();

            const foodsByDay = foodsByDate?.[day];

            delete foodsByDay?.[deletedFoodId];

            const prunedExtraFees = omitDeletedFoodExtraFees(foodExtraFees, [
              deletedFoodId,
            ]);

            const newFoodIdList = foodIdList.filter(
              (foodId: string) => foodId !== deletedFoodId,
            );

            let newMinFoodPrice;
            let newFoodTypeList;
            let newFoodNutritions;

            if (foodIdList.includes(deletedFoodId)) {
              const foods = await fetchListingsByChunkedIds(
                newFoodIdList,
                integrationSdk,
              );

              newFoodTypeList = getUniqueString(
                foods.reduce((prev: string[], food: TIntegrationListing) => {
                  const { foodType } = IntegrationListing(food).getPublicData();
                  // If menu still has any food has the same food type with the deleted food => Won't do any thing => Else remove that food type from menu
                  if (deletedFoodId !== food.id.uuid || !foodType) {
                    return prev;
                  }

                  return [...prev, foodType];
                }, []),
              );

              newMinFoodPrice = getMinBillablePriceOfFoods(
                foods,
                prunedExtraFees ?? foodExtraFees,
              );
              newFoodNutritions = uniq(
                foods.reduce((result: any, food: TIntegrationListing) => {
                  const { specialDiets = [] } =
                    IntegrationListing(food).getPublicData();

                  return [...result, ...specialDiets];
                }, []),
              );
            }
            const minPriceChanged = newMinFoodPrice !== currentMinFoodPrice;
            const menuId = IntegrationListing(menu).getId();
            updateMap = {
              ...updateMap,
              [menuId]: {
                publicData: {
                  ...(updateMap[menuId as keyof typeof updateMap]?.publicData ||
                    {}),
                  ...(minPriceChanged
                    ? {
                        [`${day}MinFoodPrice`]: newMinFoodPrice,
                      }
                    : {}),
                  ...(prunedExtraFees
                    ? { foodExtraFees: prunedExtraFees }
                    : {}),
                  foodsByDate: {
                    ...(updateMap[menuId as keyof typeof updateMap]?.publicData
                      ?.foodsByDate || foodsByDate),
                    ...(foodsByDay ? { [day]: foodsByDay } : {}),
                  },
                },
                metadata: {
                  ...(updateMap[menuId as keyof typeof updateMap]?.metadata ||
                    {}),
                  [`${day}FoodIdList`]: newFoodIdList,
                  [`${day}FoodType`]: newFoodTypeList,
                  [`${day}Nutritions`]: newFoodNutritions,
                },
              },
            };
          }),
        );
      }),
    );
    const response = await Promise.all(
      Object.keys(updateMap).map(async (menuId) => {
        await integrationSdk.listings.update({
          id: menuId,
          publicData: {
            ...(updateMap[menuId as keyof typeof updateMap]?.publicData || {}),
          },
          metadata: {
            ...(updateMap[menuId as keyof typeof updateMap]?.metadata || {}),
          },
        });
      }),
    );

    await removeFoodFromDraftOrder(menuIds, deletedFoodId);

    return response;
  } catch (error) {
    console.error(`SERVER updateMenuAfterFoodDeleted ${deletedFoodId}`, error);
  }
};

const menuContainsFood = (
  menu: TIntegrationListing,
  isTargetFood: (foodId: string) => boolean,
) => {
  const menuListing = IntegrationListing(menu);
  const { foodsByDate = {} } = menuListing.getPublicData();

  return Object.values(EDayOfWeek).some(
    (day) =>
      ((menuListing.getMetadata()[`${day}FoodIdList`] || []) as string[]).some(
        isTargetFood,
      ) || Object.keys(foodsByDate[day] || {}).some(isTargetFood),
  );
};

/**
 * Menus that really contain one of the foods. A food's `menuIdList` is only
 * maintained by the admin menu create/update flow and is stale for menus made
 * any other way, so the restaurant's menus are searched as well.
 */
const findMenusContainingFoods = async (
  foods: TIntegrationListing[],
  isTargetFood: (foodId: string) => boolean,
): Promise<TIntegrationListing[]> => {
  const listedMenuIds: string[] = uniq(
    flatten(
      foods.map(
        (food) => IntegrationListing(food).getPublicData().menuIdList || [],
      ),
    ),
  );
  const restaurantIds: string[] = uniq(
    foods
      .map((food) => IntegrationListing(food).getMetadata().restaurantId)
      .filter(Boolean),
  );
  const [listedMenus, restaurantMenus] = await Promise.all([
    listedMenuIds.length ? queryMenuByIdList(listedMenuIds) : [],
    restaurantIds.length
      ? queryAllListings({
          query: {
            meta_listingType: EListingType.menu,
            meta_restaurantId: restaurantIds.join(','),
          },
        })
      : [],
  ]);
  const menuById = new Map<string, TIntegrationListing>(
    [...(listedMenus || []), ...(restaurantMenus || [])].map(
      (menu: TIntegrationListing) => [menu.id.uuid, menu],
    ),
  );

  return Array.from(menuById.values()).filter((menu) =>
    menuContainsFood(menu, isTargetFood),
  );
};

/**
 * Copies the edited name and unit of dishes into a sub-order snapshot.
 * @param subOrder - A plan sub-order.
 * @param updatedFoodList - The edited dishes keyed by foodId.
 * @returns The sub-order with the new names and units.
 */
const renameUpdatedFoods = (
  subOrder: TPlanSubOrder,
  updatedFoodList: TFoodList,
): TPlanSubOrder => ({
  ...subOrder,
  restaurant: {
    ...subOrder.restaurant,
    foodList: mapValues(subOrder.restaurant?.foodList, (food, foodId) =>
      updatedFoodList[foodId]
        ? {
            ...food,
            foodName: updatedFoodList[foodId].foodName,
            foodUnit: updatedFoodList[foodId].foodUnit,
          }
        : food,
    ),
  },
});

/**
 * Propagates edited dishes (price, name, unit) to the menus serving them and to
 * the draft orders using them. Draft orders keep each dish's menu fee: only the
 * partner price and the client price built on it change.
 * @param updatedFoodIds - The edited dishes.
 */
export const updateMenuAfterFoodsUpdated = async (updatedFoodIds: string[]) => {
  try {
    const integrationSdk = getIntegrationSdk();
    const updatedFoods = await fetchListingsByChunkedIds(
      updatedFoodIds,
      integrationSdk,
    );
    const updatedFoodList: TFoodList = Object.fromEntries(
      updatedFoods.map((food: TIntegrationListing) => {
        const { unit, numberOfMainDishes } =
          IntegrationListing(food).getPublicData();
        const { price, title } = IntegrationListing(food).getAttributes();

        return [
          food.id.uuid,
          {
            foodName: title,
            foodPrice: price?.amount || 0,
            foodUnit: unit,
            numberOfMainDishes,
          },
        ];
      }),
    );
    const isUpdatedFood = (foodId: string) => !!updatedFoodList[foodId];
    const basePriceByFoodId = mapValues(
      updatedFoodList,
      (food) => food.foodPrice,
    );
    const menus = await findMenusContainingFoods(updatedFoods, isUpdatedFood);
    if (!menus.length) return;
    const menuIdList: string[] = menus.map(
      (menu: TIntegrationListing) => menu.id.uuid,
    );

    const menuDays: {
      menu: TIntegrationListing;
      day: EDayOfWeek;
      foodIdList: string[];
    }[] = flatten(
      menus.map((menu: TIntegrationListing) =>
        Object.values(EDayOfWeek)
          .map((day) => ({
            menu,
            day,
            foodIdList: (IntegrationListing(menu).getMetadata()[
              `${day}FoodIdList`
            ] || []) as string[],
          }))
          .filter(({ foodIdList }) => foodIdList.some(isUpdatedFood)),
      ),
    );
    const dayFoods = await fetchListingsByChunkedIds(
      uniq(flatten(menuDays.map(({ foodIdList }) => foodIdList))),
      integrationSdk,
    );
    const dayFoodById = new Map(
      dayFoods.map((food: TIntegrationListing) => [food.id.uuid, food]),
    );

    const dayUpdateMap: Record<string, any> = menuDays.reduce(
      (result: any, { menu, day, foodIdList }) => {
        const foods = foodIdList
          .map((foodId) => dayFoodById.get(foodId))
          .filter(Boolean) as TIntegrationListing[];

        const newMinFoodPrice = getMinBillablePriceOfFoods(
          foods,
          IntegrationListing(menu).getPublicData().foodExtraFees,
        );

        const newFoodTypeList = getUniqueString(
          foods.reduce((prev: string[], f: TIntegrationListing) => {
            const { foodType } = IntegrationListing(f).getPublicData();
            if (!foodType) return prev;

            return [...prev, foodType];
          }, [] as string[]),
        );

        const newFoodNutritions = uniq(
          foods.reduce((acc: any, food: TIntegrationListing) => {
            const { specialDiets = [] } =
              IntegrationListing(food).getPublicData();

            return [...acc, ...specialDiets];
          }, []),
        );

        const menuId = menu.id.uuid;

        return {
          ...result,
          [menuId]: {
            publicData: {
              ...(result?.[menuId]?.publicData || {}),
              [`${day}MinFoodPrice`]: newMinFoodPrice,
            },
            metadata: {
              ...(result?.[menuId]?.metadata || {}),
              [`${day}FoodType`]: newFoodTypeList,
              [`${day}Nutritions`]: newFoodNutritions,
            },
          },
        };
      },
      {},
    );

    // Menus keep a per-day copy of every dish (`foodsByDate`). Its price feeds
    // the booker restaurant search and is what the next menu save recomputes
    // `<day>MinFoodPrice` from, so it must follow the food listing.
    const updateMap: Record<string, any> = menus.reduce(
      (result: Record<string, any>, menu: TIntegrationListing) => {
        const menuId = menu.id.uuid;
        const { foodsByDate } = IntegrationListing(menu).getPublicData();
        const syncedFoodsByDate = syncFoodsByDate(foodsByDate, updatedFoodList);
        if (!syncedFoodsByDate) return result;

        return {
          ...result,
          [menuId]: {
            ...result[menuId],
            publicData: {
              ...(result[menuId]?.publicData || {}),
              foodsByDate: syncedFoodsByDate,
            },
          },
        };
      },
      dayUpdateMap,
    );

    const plans = await queryAllListings({
      query: {
        meta_menuIds: `has_any:${menuIdList.join(',')}`,
        meta_listingType: EListingType.subOrder,
      },
    });

    const orderIdList: string[] = uniq(
      plans
        .filter((plan: TIntegrationListing) =>
          Object.values(
            IntegrationListing(plan).getMetadata().orderDetail || {},
          ).some((subOrder: any) =>
            Object.keys(subOrder?.restaurant?.foodList || {}).some(
              isUpdatedFood,
            ),
          ),
        )
        .map(
          (plan: TIntegrationListing) =>
            IntegrationListing(plan).getMetadata().orderId,
        ),
    );

    const orders = await fetchListingsByChunkedIds(orderIdList, integrationSdk);

    await Promise.all(
      orders.map(async (order: TIntegrationListing) => {
        const orderListing = IntegrationListing(order);
        const { orderState, plans: orderPlans = [] } =
          orderListing.getMetadata();

        if (
          [
            EListingStates.draft,
            EListingStates.pendingApproval,
            EBookerOrderDraftStates.bookerDraft,
          ].includes(orderState)
        ) {
          const isSecondaryFoodAllowed = getIsAllowAddSecondaryFood(
            order as unknown as TListing,
          );
          const planId = orderPlans[0];
          await withPlanLock(planId, async () => {
            const plan: PlanListing = await fetchListing(planId);
            const orderDetail: TPlanOrderDetail =
              plan.attributes?.metadata?.orderDetail || {};
            const newOrderDetail = mapValues(orderDetail, (subOrder) =>
              subOrder?.restaurant?.foodList
                ? renameUpdatedFoods(
                    repriceSubOrder(subOrder, {
                      basePriceByFoodId,
                      isSecondaryFoodAllowed,
                    }).subOrder,
                    updatedFoodList,
                  )
                : subOrder,
            );

            await integrationSdk.listings.update({
              id: planId,
              metadata: {
                orderDetail: newOrderDetail,
              },
            });
          });
        }
      }),
    );

    return await Promise.all(
      Object.keys(updateMap).map(async (menuId) => {
        await integrationSdk.listings.update({
          id: menuId,
          publicData: {
            ...(updateMap[menuId].publicData || {}),
          },
          metadata: {
            ...(updateMap[menuId].metadata || {}),
          },
        });
      }),
    );
  } catch (error) {
    console.error(
      `SERVER updateMenuAfterFoodsUpdated ${updatedFoodIds.join(',')}`,
      error,
    );
  }
};
