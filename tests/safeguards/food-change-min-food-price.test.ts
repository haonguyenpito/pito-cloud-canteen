/**
 * Safeguard (review item 12, phase 12b): when a dish's price changes or a dish
 * is deleted, the menus serving it recompute `<day>MinFoodPrice` — and that
 * value is fee-inclusive (it feeds the restaurant search budget filter, which
 * compares it with the fee-inclusive package). Recomputing from the bare food
 * listing price would undo the fix every time a partner edits a dish.
 *
 * Source: src/pages/api/helpers/foodHelpers.ts
 */
import {
  updateMenuAfterFoodDeleted,
  updateMenuAfterFoodUpdated,
} from '@pages/api/helpers/foodHelpers';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';

jest.mock('@services/integrationSdk');
jest.mock('@services/integrationHelper', () => ({
  fetchListing: jest.fn(),
}));

const MENU_ID = 'menu-1';
const FOOD_A = 'food-a';
const FOOD_B = 'food-b';

const asResponse = (entities: any[]) => ({
  data: {
    data: entities.map((e) => ({
      id: e.id,
      type: 'listing',
      attributes: e.attributes,
    })),
  },
});

const food = (id: string, amount: number) => ({
  id: { uuid: id },
  type: 'listing',
  attributes: {
    title: id,
    price: { amount, currency: 'VND' },
    publicData: { menuIdList: [MENU_ID] },
    metadata: {},
  },
});

const menu = {
  id: { uuid: MENU_ID },
  type: 'listing',
  attributes: {
    publicData: {
      foodsByDate: { mon: { [FOOD_A]: {}, [FOOD_B]: {} } },
      monMinFoodPrice: 0,
      // FOOD_A is the cheapest on base price but the most expensive billed.
      foodExtraFees: { [FOOD_A]: 15_000, [FOOD_B]: 2_000 },
    },
    metadata: { monFoodIdList: [FOOD_A, FOOD_B] },
  },
};

const setup = (foods: any[]) => {
  const pool = [menu, ...foods];
  const update = jest.fn().mockResolvedValue({ data: {} });
  (getIntegrationSdk as jest.Mock).mockReturnValue({
    listings: {
      query: jest.fn().mockImplementation((params: any) => {
        if (params?.meta_menuIds) {
          return Promise.resolve(asResponse([]));
        }
        const ids: string[] = params?.ids || [];

        return Promise.resolve(
          asResponse(pool.filter((listing) => ids.includes(listing.id.uuid))),
        );
      }),
      update,
    },
  });

  return update;
};

const menuPublicDataUpdate = (update: jest.Mock) =>
  update.mock.calls.find(([params]: any[]) => params.id === MENU_ID)?.[0]
    .publicData;

afterEach(() => jest.clearAllMocks());

describe('updateMenuAfterFoodUpdated', () => {
  it('recomputes MinFoodPrice including the menu surcharge', async () => {
    const foods = [food(FOOD_A, 40_000), food(FOOD_B, 50_000)];
    const update = setup(foods);
    (fetchListing as jest.Mock).mockResolvedValue(foods[0]);

    await updateMenuAfterFoodUpdated(FOOD_A);

    // min(40,000 + 15,000, 50,000 + 2,000) — not the base 40,000
    expect(menuPublicDataUpdate(update).monMinFoodPrice).toBe(52_000);
  });
});

describe('updateMenuAfterFoodDeleted', () => {
  it('recomputes MinFoodPrice from the remaining dishes including fees', async () => {
    const foods = [food(FOOD_A, 40_000), food(FOOD_B, 50_000)];
    const update = setup([foods[1]]);
    (fetchListing as jest.Mock).mockResolvedValue(foods[0]);

    await updateMenuAfterFoodDeleted(FOOD_A);

    const publicData = menuPublicDataUpdate(update);
    expect(publicData.monMinFoodPrice).toBe(52_000);
    expect(publicData.foodExtraFees).toEqual({ [FOOD_B]: 2_000 });
  });
});
