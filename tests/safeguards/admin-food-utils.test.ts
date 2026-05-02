/**
 * ADMIN FOOD UTILS SAFEGUARDS
 *
 * Tests for getSubmitFoodData, getUpdateFoodData, getDuplicateData —
 * the form-value serializers that write food data back to Sharetribe.
 *
 * Critical invariant: extraFee must be parsed from its comma-formatted
 * string form and written as a number into publicData.extraFee.
 * It must never end up as a raw string in Sharetribe, and must never
 * bleed through the `...rest` spread as an unformatted value.
 *
 * Source file: src/pages/admin/partner/[restaurantId]/settings/food/utils.ts
 */

jest.mock('@helpers/sdkLoader', () => ({
  types: {
    Money: class Money {
      amount: number;
      currency: string;
      constructor(amount: number, currency: string) {
        this.amount = amount;
        this.currency = currency;
      }
    },
  },
}));

jest.mock('@utils/images', () => ({
  getSubmitImageId: jest.fn(() => []),
  getUniqueImages: jest.fn((ids: string[]) => ids),
}));

import {
  getDuplicateData,
  getSubmitFoodData,
  getUpdateFoodData,
} from '@pages/admin/partner/[restaurantId]/settings/food/utils';
import { EListingType } from '@utils/enums';

// ---------------------------------------------------------------------------
// Shared base values
// ---------------------------------------------------------------------------

const BASE_VALUES = {
  images: [],
  addImages: [],
  title: 'Phở bò',
  description: 'Phở bò đặc biệt',
  price: '50,000',
  menuType: 'fixedMenu' as any,
  minOrderHourInAdvance: '24',
  minQuantity: '10',
  maxMember: '100',
  category: [],
  specialDiets: [],
  foodType: 'savoryDish',
  categoryOther: '',
  ingredients: '',
  sideDishes: [],
  notes: '',
  restaurantId: 'restaurant-abc',
  unit: 'phần',
  isDraft: false,
};

// ---------------------------------------------------------------------------
// getSubmitFoodData — extraFee
// ---------------------------------------------------------------------------

describe('getSubmitFoodData — extraFee', () => {
  it('stores extraFee as a number in publicData', () => {
    const result = getSubmitFoodData({ ...BASE_VALUES, extraFee: '13,000' });
    expect(result.publicData.extraFee).toBe(13_000);
  });

  it('stores 0 when extraFee is "0"', () => {
    const result = getSubmitFoodData({ ...BASE_VALUES, extraFee: '0' });
    expect(result.publicData.extraFee).toBe(0);
  });

  it('stores 0 when extraFee is undefined', () => {
    const result = getSubmitFoodData({ ...BASE_VALUES, extraFee: undefined });
    expect(result.publicData.extraFee).toBe(0);
  });

  it('strips commas — "25,000" becomes 25000', () => {
    const result = getSubmitFoodData({ ...BASE_VALUES, extraFee: '25,000' });
    expect(result.publicData.extraFee).toBe(25_000);
  });

  it('does not include extraFee as a string key in publicData via ...rest spread', () => {
    const result = getSubmitFoodData({ ...BASE_VALUES, extraFee: '13,000' });
    // publicData.extraFee must be a number, not the raw string
    expect(typeof result.publicData.extraFee).toBe('number');
  });

  it('correctly sets metadata restaurantId and listingType', () => {
    const result = getSubmitFoodData({ ...BASE_VALUES, extraFee: '0' });
    expect(result.metadata.restaurantId).toBe('restaurant-abc');
    expect(result.metadata.listingType).toBe(EListingType.food);
  });
});

// ---------------------------------------------------------------------------
// getUpdateFoodData — extraFee
// ---------------------------------------------------------------------------

describe('getUpdateFoodData — extraFee', () => {
  it('stores extraFee as a number in publicData', () => {
    const result = getUpdateFoodData({ ...BASE_VALUES, id: 'food-1', extraFee: '20,000' });
    expect(result.publicData.extraFee).toBe(20_000);
  });

  it('stores 0 when extraFee is omitted', () => {
    const result = getUpdateFoodData({ ...BASE_VALUES, id: 'food-1', extraFee: undefined });
    expect(result.publicData.extraFee).toBe(0);
  });

  it('includes the food id in the result', () => {
    const result = getUpdateFoodData({ ...BASE_VALUES, id: 'food-1', extraFee: '5,000' });
    expect(result.id).toBe('food-1');
  });
});

// ---------------------------------------------------------------------------
// getDuplicateData — extraFee
// ---------------------------------------------------------------------------

describe('getDuplicateData — extraFee', () => {
  it('stores extraFee as a number in publicData', () => {
    const result = getDuplicateData({ ...BASE_VALUES, extraFee: '8,000' });
    expect(result.publicData.extraFee).toBe(8_000);
  });

  it('stores 0 when extraFee is undefined', () => {
    const result = getDuplicateData({ ...BASE_VALUES, extraFee: undefined });
    expect(result.publicData.extraFee).toBe(0);
  });
});
