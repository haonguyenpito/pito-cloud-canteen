/**
 * MENU foodsByDate PRICE SYNC
 *
 * Menus keep a per-day copy of every dish in publicData.foodsByDate. Its
 * `price` feeds the booker restaurant search (filterMenusHavePackagePerMember)
 * and is what the next menu save recomputes `<day>MinFoodPrice` from, so a
 * food price change must update that copy too.
 *
 * Source: src/pages/api/helpers/foodHelpers.ts (syncFoodsByDate)
 */
import { syncFoodsByDate } from '@pages/api/helpers/foodHelpers';

jest.mock('@services/distributedLock', () => ({ withPlanLock: jest.fn() }));
jest.mock('@services/integrationHelper', () => ({ fetchListing: jest.fn() }));
jest.mock('@services/integrationSdk', () => ({ getIntegrationSdk: jest.fn() }));
jest.mock('@helpers/apiHelpers', () => ({ queryAllListings: jest.fn() }));

const updated = {
  'food-A': { foodName: 'Bún bò', foodPrice: 95000, foodUnit: 'phần' },
} as any;

describe('syncFoodsByDate', () => {
  it('updates price and title of the updated dish on every day it appears', () => {
    const foodsByDate = {
      mon: {
        'food-A': {
          id: 'food-A',
          title: 'Bun bo',
          price: 92500,
          foodNote: 'x',
        },
        'food-B': { id: 'food-B', title: 'Com', price: 80000 },
      },
      tue: { 'food-A': { id: 'food-A', title: 'Bun bo', price: 92500 } },
    };

    expect(syncFoodsByDate(foodsByDate, updated)).toEqual({
      mon: {
        'food-A': {
          id: 'food-A',
          title: 'Bún bò',
          price: 95000,
          foodNote: 'x',
        },
        'food-B': { id: 'food-B', title: 'Com', price: 80000 },
      },
      tue: { 'food-A': { id: 'food-A', title: 'Bún bò', price: 95000 } },
    });
  });

  it('returns null when nothing changes, so the menu is not rewritten', () => {
    expect(
      syncFoodsByDate(
        { mon: { 'food-A': { title: 'Bún bò', price: 95000 } } },
        updated,
      ),
    ).toBeNull();
    expect(
      syncFoodsByDate({ mon: { 'food-B': { price: 1 } } }, updated),
    ).toBeNull();
    expect(syncFoodsByDate(undefined, updated)).toBeNull();
  });
});
