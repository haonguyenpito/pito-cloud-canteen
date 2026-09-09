/* eslint-disable @typescript-eslint/default-param-last */
import { DateTime } from 'luxon';

import { getUniqueString } from '@utils/data';
import {
  addDaysToDate,
  getDayOfWeekAsIndex,
  getDayOfWeekByIndex,
  getStartOfWeek,
} from '@utils/dates';
import type { EDayOfWeek } from '@utils/enums';
import type { TIntegrationListing } from '@utils/types';

export const MENU_INFORMATION_TAB = 'information';
export const MENU_PRICING_TAB = 'pricing';
export const MENU_COMPLETE_TAB = 'complete';

export const EDIT_PARTNER_MENU_TABS = [
  MENU_INFORMATION_TAB,
  MENU_PRICING_TAB,
  MENU_COMPLETE_TAB,
];

export type TEditMenuInformationFormValues = {
  startDate: Date;
  menuType: string;
  title: string;
  mealType: string;
  daysOfWeek: string[];
  numberOfCycles: number;
  endDate: Date;
};

export type TEditMenuPricingFormValues = {
  foodsByDate: any;
};

export type TEditMenuFormValues = TEditMenuPricingFormValues &
  TEditMenuInformationFormValues;

export type TCreateSubmitCreateMenuValues = TEditMenuFormValues & {
  restaurantId: string;
  menuId?: string;
};

export type TEditMenuPricingCalendarResources = {
  id: string;
  title: string;
  onRemovePickedFood?: (id: string, date: Date) => void;
  hideRemoveButton?: boolean;
  sideDishes: string[];
  price?: number;
  foodNote?: string;
  foodType?: string;
};

export const createMinPriceByDayOfWeek = (foodsByDate: any) => {
  let avaragePriceByDayOfWeek = {};
  Object.keys(foodsByDate).forEach((keyAsDate) => {
    let minPriceByDate = 0;
    Object.keys(foodsByDate[keyAsDate]).forEach((foodId, index) => {
      const { price = 0 } = foodsByDate[keyAsDate][foodId] || {};
      if (index === 0) minPriceByDate = price;
      else {
        minPriceByDate = price < minPriceByDate ? price : minPriceByDate;
      }
    });
    const dayAsIndex = new Date(Number(keyAsDate)).getDay() - 1;
    const dayOfWeek = getDayOfWeekByIndex(dayAsIndex);
    avaragePriceByDayOfWeek = {
      ...avaragePriceByDayOfWeek,
      [`${dayOfWeek}MinFoodPrice`]: minPriceByDate || 0,
    };
  });

  return avaragePriceByDayOfWeek;
};

export const createListFoodIdsByFoodsByDate = (foodsByDate: any) => {
  let foodIdsByDayOfWeek = {};
  Object.keys(foodsByDate).forEach((keyAsDate) => {
    const listFoodIds: string[] = [];
    Object.keys(foodsByDate[keyAsDate]).forEach((foodId) => {
      listFoodIds.push(foodId);
    });
    const dayAsIndex = new Date(Number(keyAsDate)).getDay() - 1;
    const dayOfWeek = getDayOfWeekByIndex(dayAsIndex);
    foodIdsByDayOfWeek = {
      ...foodIdsByDayOfWeek,
      [`${dayOfWeek}FoodIdList`]: listFoodIds,
    };
  });

  return foodIdsByDayOfWeek;
};

export const createListFoodNutritionByFoodsByDate = (foodsByDate: any) => {
  let nutritionsByDayOfWeek = {};
  Object.keys(foodsByDate).forEach((keyAsDate) => {
    let nutritionListByDate: string[] = [];
    Object.keys(foodsByDate[keyAsDate]).forEach((foodId) => {
      const { nutritionsList = [] } = foodsByDate[keyAsDate][foodId] || {};
      nutritionListByDate = getUniqueString([
        ...nutritionListByDate,
        ...nutritionsList,
      ]);
    });
    const dayAsIndex = new Date(Number(keyAsDate)).getDay() - 1;
    const dayOfWeek = getDayOfWeekByIndex(dayAsIndex);
    nutritionsByDayOfWeek = {
      ...nutritionsByDayOfWeek,
      [`${dayOfWeek}Nutritions`]: nutritionListByDate,
    };
  });

  return nutritionsByDayOfWeek;
};

export const createSubmitFoodsByDate = (foodsByDate: any) => {
  let submitValues = {};
  Object.keys(foodsByDate).forEach((keyAsDate) => {
    const foodByDate = foodsByDate[keyAsDate];
    let newFoodByDate = {};
    Object.keys(foodByDate).forEach((k) => {
      const food = foodByDate[k];
      const { dayOfWeek, sideDishes = [], id, foodNote, price, ...rest } = food;
      newFoodByDate = {
        ...newFoodByDate,
        [k]: {
          dayOfWeek,
          id,
          sideDishes,
          foodNote,
          price,
          ...rest,
        },
      };
    });
    const dayAsIndex = new Date(Number(keyAsDate)).getDay() - 1;
    const dayOfWeek = getDayOfWeekByIndex(dayAsIndex);
    submitValues = {
      ...submitValues,
      [dayOfWeek]: {
        ...newFoodByDate,
      },
    };
  });

  return submitValues;
};

export const createSubmitMenuValues = (
  values: TCreateSubmitCreateMenuValues,
  tab: string,
) => {
  const {
    menuType,
    mealType,
    startDate,
    daysOfWeek,
    restaurantId,
    foodsByDate,
    title,
    numberOfCycles,
    endDate,
  } = values;

  switch (tab) {
    case MENU_INFORMATION_TAB: {
      return {
        menuType,
        mealType,
        startDate,
        daysOfWeek,
        restaurantId,
        title,
        numberOfCycles,
        endDate,
      };
    }
    case MENU_PRICING_TAB: {
      return {
        foodsByDate: createSubmitFoodsByDate(foodsByDate),
      };
    }
    case MENU_COMPLETE_TAB: {
      return {
        foodsByDate: createSubmitFoodsByDate(foodsByDate),
      };
    }
    default:
      return {};
  }
};

export const createDuplicateSubmitMenuValues = (
  values: TCreateSubmitCreateMenuValues,
  tab: string,
) => {
  const {
    menuType,
    mealType,
    startDate,
    daysOfWeek,
    foodsByDate,
    title,
    numberOfCycles,
    endDate,
  } = values;
  switch (tab) {
    case MENU_INFORMATION_TAB: {
      return {
        title,
        daysOfWeek,
        mealType,
        startDate,
        endDate,
        menuType,
        numberOfCycles,
      };
    }
    case MENU_PRICING_TAB: {
      return {
        foodsByDate: createSubmitFoodsByDate(foodsByDate),
      };
    }
    case MENU_COMPLETE_TAB: {
      return {
        foodsByDate: createSubmitFoodsByDate(foodsByDate),
      };
    }
    default:
      return {};
  }
};

export const createInitialValuesForFoodsByDate = (
  foodListIdsByDate: any = {},
) => {
  return Object.keys(foodListIdsByDate).reduce(
    (prev: any, currentKey: string) => {
      const dayOfWeek = currentKey.substring(0, 3);
      const listIds = foodListIdsByDate?.[currentKey] || [];
      const listIdsAsMap = listIds.reduce((prevList: any, cur: string) => {
        return {
          ...prevList,
          [cur]: {
            id: cur,
          },
        };
      }, {});

      return {
        ...prev,
        [dayOfWeek]: listIdsAsMap,
      };
    },
    {},
  );
};

export const renderValuesForFoodsByDate = (
  foodsByDateParam: any,
  anchorDate: Date,
  menuPickedFoods: TIntegrationListing[] = [],
) => {
  const foodsByDate = foodsByDateParam || {};
  let initialValue = {};
  const startDayOfWeek = getStartOfWeek(anchorDate.getTime());
  Object.keys(foodsByDate).forEach((dayOfWeeks) => {
    const dayOfWeekAsNumber = getDayOfWeekAsIndex(dayOfWeeks as EDayOfWeek);
    const daysOfCurrentWeek = addDaysToDate(startDayOfWeek, dayOfWeekAsNumber);
    const foodByDate = foodsByDate[dayOfWeeks];
    let newFoodByDate = {};
    Object.keys(foodByDate).forEach((idAsKey) => {
      const food = foodByDate[idAsKey];

      const { id } = food;
      const foodFromDuck = menuPickedFoods.find((m) => m.id.uuid === id);
      const title = foodFromDuck?.attributes.title;
      const price = foodFromDuck?.attributes.price?.amount || 0;

      newFoodByDate = {
        ...newFoodByDate,
        [idAsKey]: {
          title,
          id,
          price,
          ...food,
        },
      };
    });

    const dateInTimeStaimp = daysOfCurrentWeek.getTime();
    initialValue = {
      ...initialValue,
      [dateInTimeStaimp]: {
        ...newFoodByDate,
      },
    };
  });

  return initialValue;
};

export const renderResourcesForCalendar = (
  foodsByDateParam: any,
  extraData: {
    onRemovePickedFood: (id: string, date: Date) => void;
    daysOfWeek: string[];
    hideRemoveButton?: boolean;
  },
) => {
  const foodsByDate = foodsByDateParam || {};
  const resourses: {
    resource: TEditMenuPricingCalendarResources;
    start: Date;
    end: Date;
  }[] = [];

  Object.keys(foodsByDate).forEach((key) => {
    Object.keys(foodsByDate[key]).forEach((foodKey) => {
      resourses.push({
        resource: {
          id: foodsByDate[key][foodKey]?.id,
          title: foodsByDate[key][foodKey]?.title,
          sideDishes: foodsByDate[key][foodKey]?.sideDishes || [],
          price: foodsByDate[key][foodKey]?.price || 0,
          foodNote: foodsByDate[key][foodKey]?.foodNote || '',
          foodType: foodsByDate[key][foodKey]?.foodType,
          ...extraData,
        },
        start: DateTime.fromMillis(Number(key)).toJSDate(),
        end: DateTime.fromMillis(Number(key)).plus({ hour: 1 }).toJSDate(),
      });
    });
  });

  return resourses;
};
