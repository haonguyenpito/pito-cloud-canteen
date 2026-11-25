import chunk from 'lodash/chunk';

import {
  fetchListingsByChunkedIds,
  queryAllListings,
} from '@helpers/apiHelpers';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/integrationSdk';
import { getUniqueString, IntegrationListing } from '@src/utils/data';
import type { TIntegrationListing, TObject } from '@src/utils/types';

// Keeps the `has_any:` filter of one query to a safe URL length.
const FOOD_IDS_PER_QUERY = 50;

const getWeekDayFromListId = (menu: TIntegrationListing, foodId: string) => {
  const {
    monFoodIdList = [],
    tueFoodIdList = [],
    wedFoodIdList = [],
    thuFoodIdList = [],
    friFoodIdList = [],
    satFoodIdList = [],
    sunFoodIdList = [],
  } = IntegrationListing(menu).getMetadata();
  const listIds = {
    sunFoodIdList,
    tueFoodIdList,
    monFoodIdList,
    wedFoodIdList,
    thuFoodIdList,
    friFoodIdList,
    satFoodIdList,
  } as TObject;
  const keys = Object.keys(listIds).filter((key: string) => {
    return listIds[key].includes(foodId);
  });

  return keys.map((k) => String(k).substring(0, 3));
};

/**
 * Finds which dishes any menu still serves on a weekday.
 * @param day - Weekday prefix, e.g. `mon`.
 * @param foodIds - The dishes to check.
 * @returns The subset of `foodIds` listed in some menu's `<day>FoodIdList`.
 */
const findFoodIdsServedOnDay = async (
  day: string,
  foodIds: string[],
): Promise<Set<string>> => {
  const menus: TIntegrationListing[] = (
    await Promise.all(
      chunk(foodIds, FOOD_IDS_PER_QUERY).map((ids) =>
        queryAllListings({
          query: { [`meta_${day}FoodIdList`]: `has_any:${ids.join(',')}` },
        }),
      ),
    )
  ).flat();
  const servedFoodIds = new Set<string>(
    menus.flatMap(
      (menu) =>
        IntegrationListing(menu).getMetadata()[`${day}FoodIdList`] || [],
    ),
  );

  return new Set(foodIds.filter((foodId) => servedFoodIds.has(foodId)));
};

/**
 * Keeps each dish's `menuIdList` / `menuWeekDay` in sync after a menu save:
 * links the menu's dishes to it, then unlinks the dishes it no longer serves
 * and drops the weekdays no menu serves a dish on any more.
 * Batches the Sharetribe reads (one query per weekday instead of one per dish
 * and weekday) and writes only the dishes that change, so a large menu stays
 * within the serverless timeout.
 * @param menu - The saved menu, with its `<day>FoodIdList` metadata.
 */
const updateMenuIdListAndMenuWeekDayListForFood = async (
  menu: TIntegrationListing,
) => {
  const {
    monFoodIdList = [],
    tueFoodIdList = [],
    wedFoodIdList = [],
    thuFoodIdList = [],
    friFoodIdList = [],
    satFoodIdList = [],
    sunFoodIdList = [],
  } = IntegrationListing(menu).getMetadata();
  const menuId = IntegrationListing(menu).getId();
  const foodIds = getUniqueString([
    ...monFoodIdList,
    ...tueFoodIdList,
    ...wedFoodIdList,
    ...thuFoodIdList,
    ...friFoodIdList,
    ...satFoodIdList,
    ...sunFoodIdList,
  ]);
  const integrationSdk = getIntegrationSdk();

  if (foodIds.length > 0) {
    const foods: TIntegrationListing[] = await fetchListingsByChunkedIds(
      foodIds,
      integrationSdk,
    );

    await Promise.all(
      foods.map(async (food) => {
        const id = IntegrationListing(food).getId();
        const { menuIdList = [], menuWeekDay = [] } =
          IntegrationListing(food).getPublicData();
        const weekDaysInMenu = getWeekDayFromListId(menu, id);
        const isUpToDate =
          menuIdList.includes(menuId) &&
          weekDaysInMenu.every((day) => menuWeekDay.includes(day));

        if (isUpToDate) {
          return;
        }

        await integrationSdk.listings.update({
          id,
          publicData: {
            menuIdList: getUniqueString([...menuIdList, menuId]),
            menuWeekDay: getUniqueString([...menuWeekDay, ...weekDaysInMenu]),
          },
        });
      }),
    );
  }

  const response = await integrationSdk.listings.query({
    pub_menuIdList: menuId,
  });
  const linkedFoods = denormalisedResponseEntities(
    response,
  ) as TIntegrationListing[];
  const getMenuWeekDay = (food: TIntegrationListing): string[] =>
    IntegrationListing(food).getPublicData().menuWeekDay || [];

  const weekDaysToCheck = getUniqueString(linkedFoods.flatMap(getMenuWeekDay));
  const servedFoodIdsByDay = Object.fromEntries(
    await Promise.all(
      weekDaysToCheck.map(async (day) => [
        day,
        await findFoodIdsServedOnDay(
          day,
          linkedFoods
            .filter((food) => getMenuWeekDay(food).includes(day))
            .map((food) => IntegrationListing(food).getId()),
        ),
      ]),
    ),
  ) as Record<string, Set<string>>;

  await Promise.all(
    linkedFoods.map(async (food) => {
      const id = IntegrationListing(food).getId();
      const { menuIdList = [] } = IntegrationListing(food).getPublicData();
      const menuWeekDay = getMenuWeekDay(food);
      const isRemovedFromMenu = !foodIds.includes(id);
      const newMenuWeekDay = menuWeekDay.filter((day) =>
        servedFoodIdsByDay[day]?.has(id),
      );
      const isMenuWeekDayChanged = newMenuWeekDay.length !== menuWeekDay.length;

      if (!isRemovedFromMenu && !isMenuWeekDayChanged) {
        return;
      }

      await integrationSdk.listings.update({
        id,
        publicData: {
          ...(isRemovedFromMenu
            ? { menuIdList: menuIdList.filter((mId: string) => mId !== menuId) }
            : {}),
          ...(isMenuWeekDayChanged ? { menuWeekDay: newMenuWeekDay } : {}),
        },
      });
    }),
  );
};

export default updateMenuIdListAndMenuWeekDayListForFood;
