/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable unused-imports/no-unused-vars */
import { types as sdkTypes } from '@helpers/sdkLoader';
import { FOOD_TYPE_OPTIONS, MENU_TYPE_OPTIONS } from '@src/utils/options';
import type { EFoodApprovalState, EListingStates } from '@utils/enums';
import { type EMenuType, EListingType } from '@utils/enums';
import { getSubmitImageId, getUniqueImages } from '@utils/images';
import { toNonAccentVietnamese } from '@utils/string';
import type { TImage } from '@utils/types';

const { Money } = sdkTypes;

const getNumberOnly = (price: string) => {
  return price.replace(/\D/g, '');
};

const parsePriceToMoneyFormat = (price: string) => {
  const formattedPrice = getNumberOnly(String(price));
  const parsedPrice = Number(formattedPrice);

  return new Money(Number(parsedPrice), 'VND');
};

export type TEditPartnerFoodFormValues = {
  id?: string;
  images: TImage[];
  addImages: TImage[] | number[];
  title: string;
  menuType: typeof EMenuType.fixedMenu | typeof EMenuType.cycleMenu;
  minOrderHourInAdvance: string;
  minOrderNumberInAdvance: string;
  minQuantity: string;
  maxMember: string;
  category: string[];
  specialDiets: string[];
  foodType: string;
  categoryOther: string;
  price: string;
  ingredients: string;
  sideDishes: string[];
  description: string;
  notes: string;
  restaurantId?: string;
  unit?: string;
  tempValue?: string;
  isDraft: boolean;
  adminApproval?: EFoodApprovalState;
  state?: EListingStates;
};

export const getSubmitFoodData = (values: TEditPartnerFoodFormValues) => {
  const {
    images,
    title,
    description,
    price,
    addImages,
    tempValue,
    restaurantId,
    isDraft,
    state,
    adminApproval,
    ...rest
  } = values;
  const priceRemoveComma = price.toString().split('.');
  const mergeWithoutComma = priceRemoveComma.join('');
  const parsePrice = Number(mergeWithoutComma);

  return {
    images: getUniqueImages([...getSubmitImageId(images)]),
    title,
    ...(description && { description }),
    price: new Money(Number(parsePrice), 'VND'),
    ...(state && { state }),
    publicData: {
      ...rest,
    },
    metadata: {
      adminApproval,
      restaurantId,
      listingType: EListingType.food,
      isFoodEnable: true,
      isDraft,
    },
  };
};

export const getUpdateFoodData = (values: TEditPartnerFoodFormValues) => {
  const {
    id,
    images,
    title,
    description,
    price,
    addImages,
    tempValue,
    isDraft,
    adminApproval,
    ...rest
  } = values;

  return {
    ...(id ? { id } : {}),
    images: getUniqueImages([...getSubmitImageId(images)]),
    title,
    description,
    price: parsePriceToMoneyFormat(price),
    publicData: {
      ...rest,
    },
    metadata: {
      ...(isDraft !== undefined ? { isDraft } : {}),
      ...(adminApproval ? { adminApproval } : {}),
    },
  };
};

export const getDuplicateData = (values: TEditPartnerFoodFormValues) => {
  const {
    images = [],
    title,
    description,
    price,
    addImages,
    tempValue,
    restaurantId,
    ...rest
  } = values;

  return {
    ...(images ? { images: images.filter((i: TImage) => !!i) } : {}),
    title,
    description,
    price: parsePriceToMoneyFormat(price),
    publicData: {
      ...rest,
    },
    metadata: {
      restaurantId,
      listingType: EListingType.food,
      isFoodEnable: true,
    },
  };
};

const EXCEL_FILE_COLUMN_NAME_AS_ENGLISH = [
  {
    columnIndex: 4,
    key: 'packaging',
  },
  {
    columnIndex: 12,
    key: 'notes',
  },
  {
    columnIndex: 1,
    key: 'menuType',
  },
  {
    columnIndex: 8,
    key: 'soup',
  },
  {
    columnIndex: 7,
    key: 'stir-fried-meal',
  },
  {
    columnIndex: 3,
    key: 'description',
  },
  {
    columnIndex: 10,
    key: 'drink',
  },
  {
    columnIndex: 2,
    key: 'foodType',
  },
  {
    columnIndex: 6,
    key: 'numberOfMainDishes',
  },
  {
    columnIndex: 11,
    key: 'allergicIngredients',
  },
  {
    columnIndex: 9,
    key: 'dessert',
  },
  {
    columnIndex: 0,
    key: 'title',
  },
  {
    columnIndex: 5,
    key: 'price',
  },
];

export const getImportDataFromCsv = (
  values: any,
  packagingOptions: any[] = [],
  __altValuesInEnglish?: any,
) => {
  const valuesInEnglish =
    __altValuesInEnglish ||
    Object.keys(values).reduce((acc, key, index) => {
      const headerInEnglish = EXCEL_FILE_COLUMN_NAME_AS_ENGLISH.find((item) => {
        return item.columnIndex === index;
      });

      const keyWordInEnglish = headerInEnglish?.key;

      return {
        ...acc,
        [keyWordInEnglish || key]: values[key],
      };
    }, {});

  const {
    title,
    description,
    price,
    allergicIngredients = '',
    foodType,
    numberOfMainDishes = 0,
    menuType,
    packaging,
    notes,
    ...sideDishesValues
  } = valuesInEnglish as any;

  const { restaurantId } = values;

  const sideDishes = Object.keys(sideDishesValues || {}).reduce(
    (acc: string[], key: string) => {
      if (toNonAccentVietnamese(sideDishesValues[key], true).trim() === 'co') {
        return [...acc, key];
      }

      return acc;
    },
    [],
  );

  const packagingArray = packagingOptions.find(
    (item) =>
      toNonAccentVietnamese(item.label, true).trim() ===
      toNonAccentVietnamese(packaging, true).trim(),
  )?.key;

  const foodTypeValue = FOOD_TYPE_OPTIONS.find(
    (item) =>
      toNonAccentVietnamese(item.label, true).trim() ===
      toNonAccentVietnamese(foodType, true).trim(),
  )?.key;

  const menuTypeValue = MENU_TYPE_OPTIONS.find(
    (item) =>
      toNonAccentVietnamese(item.label, true).trim() ===
      toNonAccentVietnamese(menuType, true).trim(),
  )?.key;

  return {
    title,
    description,
    price: parsePriceToMoneyFormat(price),
    publicData: {
      ...(allergicIngredients &&
      toNonAccentVietnamese(allergicIngredients, true).trim() !== 'khong'
        ? {
            allergicIngredients: allergicIngredients.trim().split(','),
          }
        : {}),
      ...(foodTypeValue ? { foodType: foodTypeValue } : {}),
      ...(menuTypeValue ? { menuType: menuTypeValue } : {}),
      numberOfMainDishes: Number(numberOfMainDishes),
      ...(packagingArray?.length && packagingArray.length > 0
        ? { packaging: packagingArray }
        : {}),
      sideDishes,
      ...(notes ? { notes } : {}),
    },
    metadata: {
      restaurantId,
      listingType: EListingType.food,
      isFoodEnable: true,
    },
  };
};
