/**
 * QUOTATION HELPER SAFEGUARDS
 *
 * These tests protect the two quotation-shaping helpers in quotationHelper.ts.
 * Both functions transform the grouped-by-date food order array produced by
 * groupFoodOrderByDate into the final quotation structures that are persisted
 * on order/quotation listings.
 *
 *   calculateClientQuotation — indexes foodDataList by date for the client-facing
 *     quotation (stored under listing.metadata.client.quotation).
 *
 *   calculatePartnerQuotation — groups per-restaurant items by restaurantId and
 *     indexes foodDataList by date for the partner-facing quotation
 *     (stored under listing.metadata.partner[restaurantId].quotation).
 *
 * Structural regressions here would silently corrupt saved quotation data.
 *
 * Source: src/helpers/order/quotationHelper.ts
 */

import {
  calculateClientQuotation,
  calculatePartnerQuotation,
} from '@helpers/order/quotationHelper';

// ---------------------------------------------------------------------------
// calculateClientQuotation
// ---------------------------------------------------------------------------

describe('calculateClientQuotation', () => {
  it('returns an empty quotation for empty input', () => {
    expect(calculateClientQuotation([])).toEqual({ quotation: {} });
  });

  it('indexes a single date entry correctly', () => {
    const input = [
      {
        date: '1700000000000',
        foodDataList: [
          { foodId: 'food-1', foodName: 'Cơm sườn', frequency: 3 },
        ],
      },
    ];
    const result = calculateClientQuotation(input);

    expect(result.quotation['1700000000000']).toEqual(input[0].foodDataList);
  });

  it('indexes multiple date entries under separate keys', () => {
    const input = [
      {
        date: '1700000000000',
        foodDataList: [
          { foodId: 'food-1', foodName: 'Cơm sườn', frequency: 2 },
        ],
      },
      {
        date: '1700086400000',
        foodDataList: [{ foodId: 'food-2', foodName: 'Bún bò', frequency: 5 }],
      },
    ];
    const result = calculateClientQuotation(input);

    expect(Object.keys(result.quotation)).toHaveLength(2);
    expect(result.quotation['1700000000000']).toEqual(input[0].foodDataList);
    expect(result.quotation['1700086400000']).toEqual(input[1].foodDataList);
  });
});

// ---------------------------------------------------------------------------
// calculatePartnerQuotation
// ---------------------------------------------------------------------------

describe('calculatePartnerQuotation', () => {
  it('returns an empty object for empty input', () => {
    expect(calculatePartnerQuotation({})).toEqual({});
  });

  it('creates a single restaurant entry with a single date', () => {
    const input = {
      'restaurant-1': [
        {
          restaurantName: 'Nhà hàng A',
          date: '1700000000000',
          foodDataList: [
            { foodId: 'food-1', foodName: 'Cơm gà', frequency: 4 },
          ],
        },
      ],
    };
    const result: any = calculatePartnerQuotation(input);

    expect(result['restaurant-1'].name).toBe('Nhà hàng A');
    expect(result['restaurant-1'].quotation['1700000000000']).toEqual(
      input['restaurant-1'][0].foodDataList,
    );
  });

  it('handles a single restaurant with multiple dates in the quotation', () => {
    const input = {
      'restaurant-1': [
        {
          restaurantName: 'Nhà hàng A',
          date: '1700000000000',
          foodDataList: [
            { foodId: 'food-1', foodName: 'Cơm gà', frequency: 2 },
          ],
        },
        {
          restaurantName: 'Nhà hàng A',
          date: '1700086400000',
          foodDataList: [
            { foodId: 'food-2', foodName: 'Bún bò', frequency: 3 },
          ],
        },
      ],
    };
    const result: any = calculatePartnerQuotation(input);

    expect(result['restaurant-1'].name).toBe('Nhà hàng A');
    expect(Object.keys(result['restaurant-1'].quotation)).toHaveLength(2);
    expect(result['restaurant-1'].quotation['1700086400000']).toEqual(
      input['restaurant-1'][1].foodDataList,
    );
  });

  it('handles multiple restaurants as separate top-level keys', () => {
    const input = {
      'restaurant-1': [
        {
          restaurantName: 'Nhà hàng A',
          date: '1700000000000',
          foodDataList: [
            { foodId: 'food-1', foodName: 'Cơm gà', frequency: 1 },
          ],
        },
      ],
      'restaurant-2': [
        {
          restaurantName: 'Nhà hàng B',
          date: '1700000000000',
          foodDataList: [{ foodId: 'food-3', foodName: 'Phở', frequency: 2 }],
        },
      ],
    };
    const result: any = calculatePartnerQuotation(input);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['restaurant-1'].name).toBe('Nhà hàng A');
    expect(result['restaurant-2'].name).toBe('Nhà hàng B');
  });
});
