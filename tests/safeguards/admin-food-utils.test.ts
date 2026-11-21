/**
 * ADMIN FOOD UTILS SAFEGUARDS
 *
 * Tests for getSubmitFoodData, getUpdateFoodData, getDuplicateData —
 * the form-value serializers that write food data back to Sharetribe.
 *
 * Critical invariant: a food listing carries NO extra fee. The fee is scoped to
 * a (menu, dish) pair and lives in `menu.publicData.foodExtraFees`, because a
 * dish listing is shared by many menus — a dish-level fee silently repriced the
 * dish in every menu serving it.
 *
 * These serializers spread `...rest` into publicData, so anything left on the
 * form values leaks straight into Sharetribe. That is what makes an explicit
 * regression guard worth having here.
 *
 * Source file: src/pages/admin/partner/[restaurantId]/settings/food/utils.ts
 */

import {
  getDuplicateData,
  getSubmitFoodData,
  getUpdateFoodData,
} from '@pages/admin/partner/[restaurantId]/settings/food/utils';
import { EListingType } from '@utils/enums';

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

describe('food serializers no longer write a dish-level extra fee', () => {
  it('getSubmitFoodData omits extraFee from publicData', () => {
    const result = getSubmitFoodData(BASE_VALUES);

    expect(result.publicData).not.toHaveProperty('extraFee');
  });

  it('getUpdateFoodData omits extraFee from publicData', () => {
    const result = getUpdateFoodData({ ...BASE_VALUES, id: 'food-1' } as any);

    expect(result.publicData).not.toHaveProperty('extraFee');
  });

  it('getDuplicateData omits extraFee from publicData', () => {
    const result = getDuplicateData(BASE_VALUES);

    expect(result.publicData).not.toHaveProperty('extraFee');
  });

  it('does not let a stray extraFee value ride in through the ...rest spread', () => {
    const result = getSubmitFoodData({
      ...BASE_VALUES,
      extraFee: '13,000',
    } as any);

    expect(result.publicData).not.toHaveProperty('extraFee');
  });
});

describe('food serializers — price', () => {
  it('parses the dot-separated price the form produces into a Money amount', () => {
    // `parsePrice` (the field's parser) formats with dots, e.g. "50.000".
    const result = getSubmitFoodData({ ...BASE_VALUES, price: '50.000' });

    expect(result.price).toMatchObject({ amount: 50_000, currency: 'VND' });
  });

  it('writes the listing type and restaurant into metadata', () => {
    const result = getSubmitFoodData(BASE_VALUES);

    expect(result.metadata).toMatchObject({
      restaurantId: 'restaurant-abc',
      listingType: EListingType.food,
    });
  });
});
