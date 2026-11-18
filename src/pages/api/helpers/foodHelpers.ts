/* eslint-disable @typescript-eslint/no-loop-func */
/* eslint-disable no-await-in-loop */
import { mapLimit } from 'async';
import { chunk, flatten, uniq } from 'lodash';

import type { TFoodFilter } from '@apis/foodApi';
import { queryAllListings } from '@helpers/apiHelpers';
import { adjustFoodListPrice } from '@helpers/orderHelper';
import { denormalisedResponseEntities } from '@services/data';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
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

            const foodsByDate =
              IntegrationListing(details).getPublicData().foodsByDate || {};

            const foodsByDay = foodsByDate?.[day];

            deletedFoodIds.forEach((foodId: string) => {
              delete foodsByDay?.[foodId];
            });

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

              newMinFoodPrice = foods.reduce(
                (min: number, food: TIntegrationListing, index: number) => {
                  const { price = {} } =
                    IntegrationListing(food).getAttributes();
                  const { amount = 0 } = price;
                  if (index === 0) {
                    return amount;
                  }

                  return amount < min ? amount : min;
                },
                0,
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

      const { orderDetail = {} } = planListing.getMetadata();

      let newOrderDetail = { ...orderDetail };

      Object.keys(newOrderDetail).forEach((subOrderDate: string) => {
        const {
          memberOrders = {},
          restaurant = {},
          lineItems = [],
        } = newOrderDetail[subOrderDate];

        const newMemberOrders = { ...memberOrders };

        const newFoodList = { ...restaurant.foodList };

        const newLineItems = [...lineItems];

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

        newLineItems.filter((lineItem: any) => {
          return lineItem.id !== deletedFoodId;
        });

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
        id: plan.id.uuid,
        metadata: {
          orderDetail: newOrderDetail,
        },
      });
    } catch (error) {
      console.error(`SERVER removeFoodFromDraftOrder`, error);
    }
  });
};

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

            const { foodsByDate } = menuListing.getPublicData();

            const foodsByDay = foodsByDate?.[day];

            delete foodsByDay?.[deletedFoodId];

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

              newMinFoodPrice = foods.reduce(
                (min: number, food: TIntegrationListing, index: number) => {
                  const { price = {} } =
                    IntegrationListing(food).getAttributes();
                  const { amount = 0 } = price;
                  if (index === 0) {
                    return amount;
                  }

                  return amount < min ? amount : min;
                },
                0,
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
    const menuIdList: string[] = uniq(
      flatten(
        updatedFoods.map(
          (food: TIntegrationListing) =>
            IntegrationListing(food).getPublicData().menuIdList || [],
        ),
      ),
    );
    if (!menuIdList.length) return;

    const menus = await queryMenuByIdList(menuIdList);
    const isUpdatedFood = (foodId: string) => !!updatedFoodList[foodId];

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

    const updateMap: Record<string, any> = menuDays.reduce(
      (result: any, { menu, day, foodIdList }) => {
        const foods = foodIdList
          .map((foodId) => dayFoodById.get(foodId))
          .filter(Boolean) as TIntegrationListing[];

        const newMinFoodPrice = foods.reduce(
          (min: number, food: TIntegrationListing, index: number) => {
            const { price = {} } = IntegrationListing(food).getAttributes();
            const { amount = 0 } = price;
            if (index === 0) {
              return amount;
            }

            return amount < min ? amount : min;
          },
          0,
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
          const plan = plans.find(
            (p: TIntegrationListing) => p.id.uuid === orderPlans[0],
          );
          const planListing = IntegrationListing(plan);
          const { orderDetail } = planListing.getMetadata();
          // Same price rule the booker/admin pickers apply (half price for dual-selection companies).
          const orderFoodList = adjustFoodListPrice(
            updatedFoodList,
            order as unknown as TListing,
          );
          const newOrderDetail = Object.keys(orderDetail).reduce(
            (result, subOrderDate: string) => {
              const { restaurant = {} } = orderDetail[subOrderDate] || {};
              const { foodList } = restaurant;
              if (!foodList) return result;

              const newFoodList = Object.keys(foodList).reduce(
                (foodListResult: any, foodId: string) => {
                  const food = foodList[foodId] || {};
                  const updatedFood = orderFoodList[foodId];
                  if (updatedFood) {
                    return {
                      ...foodListResult,
                      [foodId]: {
                        ...food,
                        foodName: updatedFood.foodName,
                        foodPrice: updatedFood.foodPrice,
                        foodUnit: updatedFood.foodUnit,
                      },
                    };
                  }

                  return {
                    ...foodListResult,
                    [foodId]: food,
                  };
                },
                {},
              );

              return {
                ...result,
                [subOrderDate]: {
                  ...orderDetail[subOrderDate],
                  restaurant: {
                    ...restaurant,
                    foodList: newFoodList,
                  },
                },
              };
            },
            orderDetail,
          );

          await integrationSdk.listings.update({
            id: orderPlans[0],
            metadata: {
              orderDetail: newOrderDetail,
            },
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
