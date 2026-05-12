/**
 * FOOD IMPORT — EXTRA FEE ROLE GATE SAFEGUARDS
 *
 * Tests for the extraFee role-gating behavior in the food import pipeline.
 *
 * Critical invariant:
 *   - Admin imports: extraFee is read from the Excel column and stored in
 *     publicData.extraFee as a number.
 *   - Non-admin (partner) imports: extraFee is NOT passed to
 *     getImportDataFromCsv even if the Excel column exists. The result
 *     must have publicData.extraFee === 0.
 *
 * How the gate works:
 *   useFoodImportPreview (isPartner flag) calls getImportDataFromCsv with
 *   the __altValuesInEnglish object. Admin builds it with extraFee included;
 *   partner omits it entirely. This test validates both paths through
 *   getImportDataFromCsv directly — the simplest stable surface to assert.
 *
 * Source file: src/pages/partner/products/food/utils.ts (getImportDataFromCsv)
 * Gate file:   src/hooks/useFoodImportPreview.ts (onImportFoodFromCsv callback)
 */

import { getImportDataFromCsv } from '@pages/partner/products/food/utils';

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

// ---------------------------------------------------------------------------
// Shared base __altValuesInEnglish (what the hook builds per row)
// ---------------------------------------------------------------------------

const BASE_ALT_VALUES = {
  title: 'Phở bò',
  description: 'Mô tả',
  price: '50,000',
  allergicIngredients: '',
  foodType: '',
  numberOfMainDishes: '1',
  menuType: '',
  packaging: '',
  notes: '',
  'stir-fried-meal': '',
  soup: '',
  dessert: '',
  drink: '',
};

const BASE_VALUES = { restaurantId: 'rest-1' };

// ---------------------------------------------------------------------------
// Admin role: extraFee IS passed in __altValuesInEnglish
// ---------------------------------------------------------------------------

describe('getImportDataFromCsv — admin import (extraFee provided)', () => {
  it('stores extraFee as a number when passed by admin', () => {
    const altValues = { ...BASE_ALT_VALUES, extraFee: '13,000' };
    const result = getImportDataFromCsv(BASE_VALUES, [], altValues);
    expect(result.publicData.extraFee).toBe(13_000);
  });

  it('strips commas from extraFee string', () => {
    const altValues = { ...BASE_ALT_VALUES, extraFee: '100,000' };
    const result = getImportDataFromCsv(BASE_VALUES, [], altValues);
    expect(result.publicData.extraFee).toBe(100_000);
  });

  it('stores 0 when admin explicitly sets extraFee to "0"', () => {
    const altValues = { ...BASE_ALT_VALUES, extraFee: '0' };
    const result = getImportDataFromCsv(BASE_VALUES, [], altValues);
    expect(result.publicData.extraFee).toBe(0);
  });

  it('stores extraFee as a number type, not a string', () => {
    const altValues = { ...BASE_ALT_VALUES, extraFee: '25,000' };
    const result = getImportDataFromCsv(BASE_VALUES, [], altValues);
    expect(typeof result.publicData.extraFee).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Partner role: extraFee is NOT passed in __altValuesInEnglish
// (hook omits it: `!isPartner && dataParamsInput.extraFee ? { extraFee } : {}`)
// ---------------------------------------------------------------------------

describe('getImportDataFromCsv — partner import (extraFee omitted)', () => {
  it('defaults extraFee to 0 when not passed (partner role)', () => {
    // Partner hook omits extraFee entirely from __altValuesInEnglish
    const altValues = { ...BASE_ALT_VALUES }; // no extraFee key
    const result = getImportDataFromCsv(BASE_VALUES, [], altValues);
    expect(result.publicData.extraFee).toBe(0);
  });

  it('ignores extraFee even if the Excel column existed (partner role)', () => {
    // Simulate: Excel had the column, but isPartner=true so hook didn't pass it.
    // The column value is NOT in altValues — same result: extraFee must be 0.
    const altValuesWithoutFee = { ...BASE_ALT_VALUES };
    const result = getImportDataFromCsv(BASE_VALUES, [], altValuesWithoutFee);
    expect(result.publicData.extraFee).toBe(0);
  });

  it('does not allow extraFee > 0 to slip through when omitted', () => {
    const result = getImportDataFromCsv(BASE_VALUES, [], BASE_ALT_VALUES);
    // Must be exactly 0 — not undefined, not NaN, not a stale value
    expect(result.publicData.extraFee).toBe(0);
    expect(result.publicData.extraFee).not.toBeNaN();
    expect(result.publicData.extraFee).not.toBeUndefined();
  });
});
