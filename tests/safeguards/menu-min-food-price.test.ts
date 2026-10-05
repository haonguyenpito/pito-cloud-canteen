/**
 * Safeguard (review item 12): `<day>MinFoodPrice` is fee-inclusive.
 *
 * The restaurant search filters menus with
 * `pub_<day>MinFoodPrice <= packagePerMember` (`listingSearchQuery.ts`), and
 * the package is fee-inclusive. A base-price minimum let a menu pass the filter
 * and then offer no dish within budget (base 45,000 + fee 10,000 = 55,000 for a
 * 50,000 package). The same field orders menus "closest to the package".
 *
 * Writers covered here: menu save (`updateMenu`) and fee save
 * (`updateMenuExtraFees`).
 */
import { getMinBillablePrice } from '@helpers/menuExtraFee';
import updateMenu from '@pages/api/apiServices/menu/updateMenu.service';
import updateMenuExtraFees from '@pages/api/apiServices/menu/updateMenuExtraFees.service';
import { createMinPriceByDayOfWeek } from '@pages/api/apiUtils/menu';
import { getIntegrationSdk as getFeeServiceSdk } from '@services/integrationSdk';
import { getIntegrationSdk as getMenuServiceSdk } from '@services/sdk';
import { EListingStates } from '@src/utils/enums';

jest.mock('@services/sdk', () => ({ getIntegrationSdk: jest.fn() }));
jest.mock('@services/integrationSdk');
jest.mock('@pages/api/apiUtils/menu', () => ({
  ...jest.requireActual('@pages/api/apiUtils/menu'),
  createListFoodTypeByFoodIds: jest.fn().mockResolvedValue({}),
}));
jest.mock(
  '@pages/api/apiServices/menu/updateMenuIdListAndMenuWeekDayListForFood.service',
  () => jest.fn().mockResolvedValue(undefined),
);

const MENU_ID = 'menu-1';
const FOOD_A = 'food-a';
const FOOD_B = 'food-b';

describe('getMinBillablePrice', () => {
  it('takes the minimum of base + fee, not of the base price', () => {
    // Base minimum is FOOD_B (45,000) but its fee makes it 55,000.
    expect(
      getMinBillablePrice(
        [
          { foodId: FOOD_A, price: 48_000 },
          { foodId: FOOD_B, price: 45_000 },
        ],
        { [FOOD_A]: 2_000, [FOOD_B]: 10_000 },
      ),
    ).toBe(50_000);
  });

  it('uses the base price for a dish without fee, and keeps 0 for an empty day', () => {
    expect(getMinBillablePrice([{ foodId: FOOD_A, price: 45_000 }])).toBe(
      45_000,
    );
    expect(getMinBillablePrice([], { [FOOD_A]: 10_000 })).toBe(0);
  });
});

describe('createMinPriceByDayOfWeek', () => {
  const foodsByDate = {
    mon: { [FOOD_A]: { price: 45_000 }, [FOOD_B]: { price: 48_000 } },
    tue: {},
  };

  it('is fee-inclusive when given the menu fee map', () => {
    expect(
      createMinPriceByDayOfWeek(foodsByDate, { [FOOD_A]: 10_000 }),
    ).toEqual({ monMinFoodPrice: 48_000, tueMinFoodPrice: 0 });
  });

  it('stays at the base price for a menu without fees (duplicate, new menu)', () => {
    expect(createMinPriceByDayOfWeek(foodsByDate)).toEqual({
      monMinFoodPrice: 45_000,
      tueMinFoodPrice: 0,
    });
  });
});

describe('updateMenu — writes a fee-inclusive MinFoodPrice', () => {
  const run = async (
    foodExtraFees: Record<string, number>,
    monFoodIdList: string[],
    foodsByDate: Record<string, Record<string, object>>,
  ) => {
    const menu = {
      id: { uuid: MENU_ID },
      type: 'listing',
      attributes: {
        publicData: { daysOfWeek: ['mon'], foodExtraFees },
        metadata: {
          listingState: EListingStates.pendingApproval,
          monFoodIdList,
        },
      },
    };
    const update = jest.fn().mockResolvedValue({ data: { data: menu } });
    (getMenuServiceSdk as jest.Mock).mockReturnValue({
      listings: {
        show: jest.fn().mockResolvedValue({ data: { data: menu } }),
        update,
      },
    });

    await updateMenu(MENU_ID, {
      id: MENU_ID,
      daysOfWeek: ['mon'],
      foodsByDate,
    } as any);

    return update.mock.calls[0][0].publicData;
  };

  afterEach(() => jest.clearAllMocks());

  it('adds the fee of dishes that stay in the menu', async () => {
    const publicData = await run({ [FOOD_A]: 10_000 }, [FOOD_A, FOOD_B], {
      mon: { [FOOD_A]: { price: 45_000 }, [FOOD_B]: { price: 58_000 } },
    });

    expect(publicData.monMinFoodPrice).toBe(55_000);
  });

  it('ignores a leftover fee pruned by the same save (re-added dish)', async () => {
    // FOOD_A is re-added: its old fee is dropped, so it counts at base price.
    const publicData = await run({ [FOOD_A]: 10_000 }, [FOOD_B], {
      mon: { [FOOD_A]: { price: 45_000 }, [FOOD_B]: { price: 58_000 } },
    });

    expect(publicData.foodExtraFees).toEqual({});
    expect(publicData.monMinFoodPrice).toBe(45_000);
  });
});

describe('updateMenuExtraFees — recomputes MinFoodPrice with the new fees', () => {
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
    attributes: { price: { amount, currency: 'VND' } },
  });

  const run = async (foods: any[]) => {
    const menu = {
      id: { uuid: MENU_ID },
      attributes: {
        publicData: {},
        metadata: {
          listingState: EListingStates.pendingApproval,
          monFoodIdList: [FOOD_A, FOOD_B],
          tueFoodIdList: [FOOD_B],
        },
      },
    };
    const update = jest.fn().mockResolvedValue({ data: {} });
    (getFeeServiceSdk as jest.Mock).mockReturnValue({
      listings: {
        show: jest.fn().mockResolvedValue(asResponse([menu])),
        query: jest
          .fn()
          .mockImplementation((params: any) =>
            Promise.resolve(asResponse(params?.meta_menuIds ? [] : foods)),
          ),
        update,
      },
    });

    await updateMenuExtraFees(MENU_ID, {
      extraFees: { [FOOD_A]: 10_000, [FOOD_B]: 2_000 },
    });

    return update.mock.calls.find(([p]: any[]) => p.id === MENU_ID)[0]
      .publicData;
  };

  afterEach(() => jest.clearAllMocks());

  it('writes fee-inclusive minimums per day alongside the fee map', async () => {
    const publicData = await run([food(FOOD_A, 45_000), food(FOOD_B, 48_000)]);

    expect(publicData).toEqual({
      foodExtraFees: { [FOOD_A]: 10_000, [FOOD_B]: 2_000 },
      // mon: min(55,000, 50,000); tue: only FOOD_B
      monMinFoodPrice: 50_000,
      tueMinFoodPrice: 50_000,
    });
  });

  it('leaves a day untouched when its dishes cannot be resolved', async () => {
    const publicData = await run([food(FOOD_A, 45_000)]);

    expect(publicData.monMinFoodPrice).toBe(55_000);
    expect(publicData).not.toHaveProperty('tueMinFoodPrice');
  });
});
