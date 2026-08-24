/* eslint-disable @typescript-eslint/no-loop-func */
/* eslint-disable no-await-in-loop */
import { mapLimit } from 'async';
import { chunk, flatten, omit, uniq } from 'lodash';

import { queryAllListings } from '@helpers/apiHelpers';
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
import type { TIntegrationListing, TListing } from '@src/utils/types';

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

            const { foodsByDate = {}, foodExtraFees } =
              IntegrationListing(details).getPublicData();

            const foodsByDay = foodsByDate?.[day];

            deletedFoodIds.forEach((foodId: string) => {
              delete foodsByDay?.[foodId];
            });

            // The menu-scoped extra fee is keyed by foodId — drop the orphans so
            // they cannot resurface if a dish is later re-added to this menu.
            const prunedExtraFees =
              foodExtraFees &&
              deletedFoodIds.some((foodId: string) => foodId in foodExtraFees)
                ? omit(foodExtraFees, deletedFoodIds)
                : undefined;

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

            const { foodsByDate, foodExtraFees } = menuListing.getPublicData();

            const foodsByDay = foodsByDate?.[day];

            delete foodsByDay?.[deletedFoodId];

            // The menu-scoped extra fee is keyed by foodId — drop the orphans so
            // they cannot resurface if a dish is later re-added to this menu.
            const prunedExtraFees =
              foodExtraFees && deletedFoodId in foodExtraFees
                ? omit(foodExtraFees, [deletedFoodId])
                : undefined;

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

export const updateMenuAfterFoodUpdated = async (updatedFoodId: string) => {
  try {
    const integrationSdk = getIntegrationSdk();
    const updatedFood = await fetchListing(updatedFoodId);
    const updatedFoodListing = IntegrationListing(updatedFood);

    const { menuIdList = [], unit: newFoodUnit } =
      updatedFoodListing.getPublicData();
    const {
      price: { amount: newPriceAmount = 0 },
      title: newFoodName,
    } = updatedFoodListing.getAttributes();

    const menus = await queryMenuByIdList(menuIdList);

    let updateMap: any = {};

    await Promise.all(
      menus.map(async (menu: TIntegrationListing) => {
        return Promise.all(
          Object.keys(EDayOfWeek).map(async (key) => {
            const day = EDayOfWeek[key as keyof typeof EDayOfWeek];
            const foodIdList =
              IntegrationListing(menu).getMetadata()[`${day}FoodIdList`] || [];

            if (foodIdList.includes(updatedFoodId)) {
              const foods = await fetchListingsByChunkedIds(
                foodIdList,
                integrationSdk,
              );

              const newMinFoodPrice = foods.reduce(
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

              const newFoodTypeList = getUniqueString(
                foods.reduce((prev: string[], f: TIntegrationListing) => {
                  const { foodType } = IntegrationListing(f).getPublicData();
                  if (!foodType) return prev;

                  return [...prev, foodType];
                }, [] as string[]),
              );

              const newFoodNutritions = uniq(
                foods.reduce((result: any, food: TIntegrationListing) => {
                  const { specialDiets = [] } =
                    IntegrationListing(food).getPublicData();

                  return [...result, ...specialDiets];
                }, []),
              );

              const menuId = menu.id.uuid;

              updateMap = {
                ...updateMap,
                [menuId]: {
                  publicData: {
                    ...(updateMap?.[menuId]?.publicData || {}),
                    [`${day}MinFoodPrice`]: newMinFoodPrice,
                  },
                  metadata: {
                    ...(updateMap?.[menuId]?.metadata || {}),
                    [`${day}FoodType`]: newFoodTypeList,
                    [`${day}Nutritions`]: newFoodNutritions,
                  },
                },
              };
            }
          }),
        );
      }),
    );

    const plans = denormalisedResponseEntities(
      await integrationSdk.listings.query({
        meta_menuIds: `has_any:${menuIdList.join(',')}`,
        meta_listingType: EListingType.subOrder,
      }),
    );

    const orderIdList = plans.reduce(
      (result: any, plan: TIntegrationListing) => {
        const { orderDetail, orderId } = IntegrationListing(plan).getMetadata();
        const totalFoodIdList = Object.values(orderDetail).reduce<string[]>(
          (totalFoodIdListResult: any, subOrder: any) => {
            return [
              ...totalFoodIdListResult,
              ...Object.keys(subOrder?.restaurant?.foodList || {}),
            ];
          },
          [],
        );

        if (totalFoodIdList.includes(updatedFoodId)) {
          return [...result, orderId];
        }

        return result;
      },
      [],
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
          const newOrderDetail = Object.keys(orderDetail).reduce(
            (result, subOrderDate: string) => {
              const { restaurant = {} } = orderDetail[subOrderDate];
              const { foodList } = restaurant;

              const newFoodList = Object.keys(foodList).reduce(
                (foodListResult: any, foodId: string) => {
                  const food = foodList[foodId] || {};
                  if (foodId === updatedFoodId) {
                    return {
                      ...foodListResult,
                      [foodId]: {
                        ...food,
                        foodName: newFoodName,
                        foodPrice: newPriceAmount,
                        foodUnit: newFoodUnit,
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

    const response = await Promise.all(
      Object.keys(updateMap).map(async (menuId) => {
        await integrationSdk.listings.update({
          id: menuId,
          publicData: {
            ...(updateMap[menuId as keyof typeof updateMap].publicData || {}),
          },
          metadata: {
            ...(updateMap[menuId as keyof typeof updateMap].metadata || {}),
          },
        });
      }),
    );

    return response;
  } catch (error) {
    console.error(`SERVER updateMenuAfterFoodUpdated ${updatedFoodId}`, error);
  }
};
