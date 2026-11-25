import {
  createFoodByDateByDaysOfWeekField,
  createFoodListIdByDaysOfWeekField,
  createListFoodIdsByFoodsByDate,
  createListFoodNutritionByFoodsByDate,
  createListFoodTypeByFoodIds,
  createMinPriceByDayOfWeek,
  createNutritionsByDaysOfWeekField,
} from '@pages/api/apiUtils/menu';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/integrationSdk';
import { IntegrationListing } from '@src/utils/data';
import { addWeeksToDate } from '@src/utils/dates';
import {
  EDayOfWeek,
  EListingStates,
  EListingType,
  EMenuType,
} from '@src/utils/enums';
import type { TDuplicateMenuApiParams } from '@src/utils/types';

const ZERO_MIN_FOOD_PRICE_BY_DAY = Object.fromEntries(
  Object.values(EDayOfWeek).map((day) => [`${day}MinFoodPrice`, 0]),
);

/**
 * Creates a copy of a menu, optionally on other days or with other dishes.
 * The copy starts without extra fees.
 * @param menuId - The menu to copy.
 * @param dataParams - Fields that differ from the source menu.
 * @param queryParams - Sharetribe query params of the create call.
 * @returns The Sharetribe create response.
 */
const duplicateMenu = async (
  menuId: string,
  dataParams: TDuplicateMenuApiParams,
  queryParams: Record<string, unknown> = {},
) => {
  const integrationSdk = getIntegrationSdk();

  const {
    menuType,
    mealType,
    startDate,
    daysOfWeek,
    foodsByDate,
    title,
    numberOfCycles,
    endDate,
  } = dataParams;
  const isCycleMenu = menuType === EMenuType.cycleMenu;

  const response = await integrationSdk.listings.show({
    id: menuId,
    include: ['author'],
  });

  const [menu] = denormalisedResponseEntities(response);

  const { title: titleFromMenu } = IntegrationListing(menu).getAttributes();

  const {
    mealType: mealTyperFromMenu,
    startDate: startDateFromMenu,
    endDate: endDateFromMenu,
    numberOfCycles: numberOfCyclesFromMenu,
    daysOfWeek: daysOfWeekFromMenu,
    foodsByDate: foodsByDateFromMenu,
  } = IntegrationListing(menu).getPublicData();

  const {
    monFoodIdList: monFoodIdListFromMenu,
    tueFoodIdList: tueFoodIdListFromMenu,
    wedFoodIdList: wedFoodIdListFromMenu,
    thuFoodIdList: thuFoodIdListFromMenu,
    friFoodIdList: friFoodIdListFromMenu,
    satFoodIdList: satFoodIdListFromMenu,
    sunFoodIdList: sunFoodIdListFromMenu,
    /// /
    monNutritions: monNutritionsFromMenu = [],
    tueNutritions: tueNutritionsFromMenu = [],
    wedNutritions: wedNutritionsFromMenu = [],
    thuNutritions: thuNutritionsFromMenu = [],
    friNutritions: friNutritionsFromMenu = [],
    satNutritions: satNutritionsFromMenu = [],
    sunNutritions: sunNutritionsFromMenu = [],
    restaurantId,
  } = IntegrationListing(menu).getMetadata();

  const { menuType: menuTypeFromMenu } = IntegrationListing(menu).getMetadata();

  const endDateFromMenuToSubmit =
    menuTypeFromMenu === EMenuType.cycleMenu
      ? addWeeksToDate(
          new Date(startDateFromMenu),
          numberOfCyclesFromMenu,
        ).getTime()
      : endDateFromMenu;

  const endDateToSubmit = isCycleMenu
    ? addWeeksToDate(new Date(startDate), numberOfCycles).getTime()
    : endDate;

  const listFoodIdsByDayOfWeekMap = daysOfWeek
    ? {
        ...createFoodListIdByDaysOfWeekField(
          {
            monFoodIdList: monFoodIdListFromMenu,
            tueFoodIdList: tueFoodIdListFromMenu,
            wedFoodIdList: wedFoodIdListFromMenu,
            thuFoodIdList: thuFoodIdListFromMenu,
            friFoodIdList: friFoodIdListFromMenu,
            satFoodIdList: satFoodIdListFromMenu,
            sunFoodIdList: sunFoodIdListFromMenu,
          },
          daysOfWeek,
        ),
      }
    : foodsByDate
    ? createListFoodIdsByFoodsByDate(foodsByDate)
    : {};

  const listFoodTypesByDayOfWeek = await createListFoodTypeByFoodIds(
    listFoodIdsByDayOfWeekMap,
  );

  const createParams = {
    ...(title ? { title } : { title: titleFromMenu }),
    publicData: {
      ...(daysOfWeek ? { daysOfWeek } : { daysOfWeek: daysOfWeekFromMenu }),
      ...(mealType ? { mealType } : { mealType: mealTyperFromMenu }),
      ...(startDate ? { startDate } : { startDate: startDateFromMenu }),
      ...(endDateToSubmit
        ? { endDate: endDateToSubmit }
        : { endDate: endDateFromMenuToSubmit }),
      ...(isCycleMenu
        ? {
            ...(numberOfCycles
              ? { numberOfCycles }
              : { numberOfCycles: numberOfCyclesFromMenu }),
          }
        : {}),
      ...(daysOfWeek
        ? {
            foodsByDate: createFoodByDateByDaysOfWeekField(
              foodsByDateFromMenu,
              daysOfWeek,
            ),
          }
        : {}),
      // The copy carries no extra fee, so the source's fee-inclusive minimum
      // must not be reused: recompute it from the base prices.
      ...(daysOfWeek
        ? {
            ...ZERO_MIN_FOOD_PRICE_BY_DAY,
            ...createMinPriceByDayOfWeek(
              createFoodByDateByDaysOfWeekField(
                foodsByDateFromMenu,
                daysOfWeek,
              ),
            ),
          }
        : {}),
      ...(foodsByDate
        ? {
            ...createMinPriceByDayOfWeek(foodsByDate),
          }
        : {}),
      ...(foodsByDate
        ? {
            foodsByDate,
          }
        : {}),
    },
    metadata: {
      ...listFoodTypesByDayOfWeek,
      ...listFoodIdsByDayOfWeekMap,
      ...(daysOfWeek
        ? {
            ...createNutritionsByDaysOfWeekField(
              {
                monNutritions: monNutritionsFromMenu,
                tueNutritions: tueNutritionsFromMenu,
                wedNutritions: wedNutritionsFromMenu,
                thuNutritions: thuNutritionsFromMenu,
                friNutritions: friNutritionsFromMenu,
                satNutritions: satNutritionsFromMenu,
                sunNutritions: sunNutritionsFromMenu,
              },
              daysOfWeek,
            ),
          }
        : {}),
      ...(foodsByDate
        ? { ...createListFoodNutritionByFoodsByDate(foodsByDate) }
        : {}),
      ...(menuType ? { menuType } : { menuType: menuTypeFromMenu }),
      listingType: EListingType.menu,
      restaurantId,
      listingState: IntegrationListing(menu).getMetadata().listingState,
    },
    authorId: menu.author.id.uuid,
    state: EListingStates.published,
  };

  const menuResponse = await integrationSdk.listings.create(
    createParams,
    queryParams,
  );

  return menuResponse;
};

export default duplicateMenu;
