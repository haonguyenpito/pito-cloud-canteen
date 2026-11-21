/**
 * MENU-SCOPED EXTRA FEE SAFEGUARDS
 *
 * The extra fee (phí phụ thu) is PITO's admin markup on top of a partner's dish
 * price. It is stored on the MENU (`menu.publicData.foodExtraFees`), keyed by
 * foodId — never on the food listing.
 *
 * WHY THIS MATTERS:
 * - A dish listing is shared by many menus. Storing the fee on the dish made
 *   editing it in one menu silently change every other menu serving that dish.
 *   These tests pin the (menu, dish) scoping so that regression cannot return.
 * - A fee of 0 is a valid, intentional value ("no surcharge"). A truthiness
 *   check would drop it and fall back to whatever was there before.
 * - Approval freezes the fee: once a menu is published its map is read-only.
 * - The draft-plan fan-out must only rewrite dates served BY THIS MENU, and
 *   must never touch an order that has already started — its snapshot is what
 *   the client is billed from.
 *
 * Source: src/pages/api/apiServices/menu/updateMenuExtraFees.service.ts
 */

import {
  applyFeeToFoods,
  buildExtraFeeRows,
  hasUnsavedExtraFeeChanges,
  toAmount,
} from '@pages/admin/partner/pending-menus/components/MenuExtraFeePanel/utils';
import updateMenuExtraFees, {
  normalizeExtraFees,
} from '@pages/api/apiServices/menu/updateMenuExtraFees.service';
import { getIntegrationSdk } from '@services/integrationSdk';
import { EListingStates } from '@src/utils/enums';

jest.mock('@services/integrationSdk');

const MENU_ID = 'menu-morning';
const OTHER_MENU_ID = 'menu-lunch';
const FOOD_A = 'food-a';
const FOOD_B = 'food-b';

const buildMenu = ({
  listingState = EListingStates.pendingApproval,
  foodIds = [FOOD_A, FOOD_B],
  foodExtraFees,
}: {
  listingState?: string;
  foodIds?: string[];
  foodExtraFees?: Record<string, number>;
} = {}) => ({
  id: { uuid: MENU_ID },
  attributes: {
    publicData: { ...(foodExtraFees ? { foodExtraFees } : {}) },
    metadata: {
      listingState,
      monFoodIdList: foodIds,
      tueFoodIdList: foodIds,
    },
  },
});

/** Sharetribe responses are denormalised before use — mimic that shape. */
const asResponse = (entities: any[]) => ({
  data: {
    data: entities.map((e) => ({
      id: e.id,
      type: 'listing',
      attributes: e.attributes,
    })),
  },
});

const makeSdk = ({
  menu = buildMenu(),
  plans = [] as any[],
  orders = [] as any[],
} = {}) => {
  const update = jest.fn().mockResolvedValue({ data: {} });

  return {
    update,
    listings: {
      show: jest.fn().mockResolvedValue(asResponse([menu])),
      query: jest.fn().mockImplementation((params: any) => {
        // The plan query is the one carrying meta_menuIds.
        if (params?.meta_menuIds) {
          return Promise.resolve(asResponse(plans));
        }

        return Promise.resolve(asResponse(orders));
      }),
      update,
    },
  };
};

const lastMenuUpdate = (sdk: any) =>
  (sdk.listings.update as jest.Mock).mock.calls.find(
    ([params]: any[]) => params.id === MENU_ID,
  )?.[0];

describe('normalizeExtraFees', () => {
  it('keeps a 0 fee — it means "no surcharge", not "unset"', () => {
    expect(normalizeExtraFees({ [FOOD_A]: 0 }, [FOOD_A])).toEqual({
      [FOOD_A]: 0,
    });
  });

  it('drops dishes that are not in the menu', () => {
    expect(
      normalizeExtraFees({ [FOOD_A]: 15000, 'food-elsewhere': 9000 }, [FOOD_A]),
    ).toEqual({ [FOOD_A]: 15000 });
  });

  it('discards non-numeric and negative values instead of storing NaN', () => {
    expect(
      normalizeExtraFees(
        { [FOOD_A]: 'abc', [FOOD_B]: -1, 'food-c': 12000 } as any,
        [FOOD_A, FOOD_B, 'food-c'],
      ),
    ).toEqual({ 'food-c': 12000 });
  });

  it('coerces numeric strings, as the fee input submits them', () => {
    expect(normalizeExtraFees({ [FOOD_A]: '15000' } as any, [FOOD_A])).toEqual({
      [FOOD_A]: 15000,
    });
  });
});

describe('updateMenuExtraFees', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('writes only publicData.foodExtraFees — never foodsByDate or metadata', async () => {
    const sdk = makeSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateMenuExtraFees(MENU_ID, {
      extraFees: { [FOOD_A]: 15000, [FOOD_B]: 0 },
    });

    const params = lastMenuUpdate(sdk);
    expect(params).toEqual({
      id: MENU_ID,
      publicData: { foodExtraFees: { [FOOD_A]: 15000, [FOOD_B]: 0 } },
    });
    expect(params.metadata).toBeUndefined();
  });

  it('never writes to a food listing', async () => {
    const sdk = makeSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateMenuExtraFees(MENU_ID, { extraFees: { [FOOD_A]: 15000 } });

    const touchedIds = (sdk.listings.update as jest.Mock).mock.calls.map(
      ([params]: any[]) => params.id,
    );
    expect(touchedIds).not.toContain(FOOD_A);
    expect(touchedIds).not.toContain(FOOD_B);
  });

  it('replace mode drops fees for dishes not submitted', async () => {
    const sdk = makeSdk({
      menu: buildMenu({ foodExtraFees: { [FOOD_A]: 15000, [FOOD_B]: 15000 } }),
    });
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateMenuExtraFees(MENU_ID, {
      extraFees: { [FOOD_A]: 20000 },
      mode: 'replace',
    });

    expect(lastMenuUpdate(sdk).publicData.foodExtraFees).toEqual({
      [FOOD_A]: 20000,
    });
  });

  it('merge mode leaves untouched dishes alone (per-dish override)', async () => {
    const sdk = makeSdk({
      menu: buildMenu({ foodExtraFees: { [FOOD_A]: 15000, [FOOD_B]: 15000 } }),
    });
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateMenuExtraFees(MENU_ID, {
      extraFees: { [FOOD_A]: 20000 },
      mode: 'merge',
    });

    expect(lastMenuUpdate(sdk).publicData.foodExtraFees).toEqual({
      [FOOD_A]: 20000,
      [FOOD_B]: 15000,
    });
  });

  it('prunes stored fees for dishes that have left the menu', async () => {
    const sdk = makeSdk({
      menu: buildMenu({
        foodIds: [FOOD_A],
        foodExtraFees: { [FOOD_A]: 15000, 'food-removed': 15000 },
      }),
    });
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateMenuExtraFees(MENU_ID, {
      extraFees: { [FOOD_A]: 15000 },
      mode: 'merge',
    });

    expect(lastMenuUpdate(sdk).publicData.foodExtraFees).toEqual({
      [FOOD_A]: 15000,
    });
  });

  it.each([
    EListingStates.published,
    EListingStates.closed,
    EListingStates.rejected,
  ])(
    'rejects the write once the menu is %s — approval freezes the fee',
    async (listingState) => {
      const sdk = makeSdk({ menu: buildMenu({ listingState }) });
      (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

      await expect(
        updateMenuExtraFees(MENU_ID, { extraFees: { [FOOD_A]: 15000 } }),
      ).rejects.toThrow(/Không thể cập nhật phụ phí/);

      expect(sdk.listings.update).not.toHaveBeenCalled();
    },
  );

  it.each([EListingStates.draft, EListingStates.pendingApproval])(
    'allows the write while the menu is %s',
    async (listingState) => {
      const sdk = makeSdk({ menu: buildMenu({ listingState }) });
      (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

      await updateMenuExtraFees(MENU_ID, { extraFees: { [FOOD_A]: 15000 } });

      expect(lastMenuUpdate(sdk)).toBeDefined();
    },
  );
});

describe('updateMenuExtraFees — draft plan fan-out', () => {
  const PLAN_ID = 'plan-1';

  const buildPlan = (orderDetail: any) => ({
    id: { uuid: PLAN_ID },
    attributes: { metadata: { orderId: 'order-1', orderDetail } },
  });

  const buildOrder = (orderState: string) => ({
    id: { uuid: 'order-1' },
    attributes: { metadata: { orderState, plans: [PLAN_ID] } },
  });

  const orderDetailAcrossTwoMenus = () => ({
    '1000': {
      restaurant: {
        menuId: MENU_ID,
        foodList: { [FOOD_A]: { foodPrice: 50000, foodExtraFee: 0 } },
      },
    },
    '2000': {
      restaurant: {
        menuId: OTHER_MENU_ID,
        foodList: { [FOOD_A]: { foodPrice: 50000, foodExtraFee: 20000 } },
      },
    },
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates only the dates served by this menu — the same dish under another menu keeps its own fee', async () => {
    const sdk = makeSdk({
      plans: [buildPlan(orderDetailAcrossTwoMenus())],
      orders: [buildOrder(EListingStates.draft)],
    });
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateMenuExtraFees(MENU_ID, { extraFees: { [FOOD_A]: 15000 } });

    const planUpdate = (sdk.listings.update as jest.Mock).mock.calls.find(
      ([params]: any[]) => params.id === PLAN_ID,
    )?.[0];

    expect(
      planUpdate.metadata.orderDetail['1000'].restaurant.foodList[FOOD_A],
    ).toEqual({ foodPrice: 50000, foodExtraFee: 15000 });
    expect(
      planUpdate.metadata.orderDetail['2000'].restaurant.foodList[FOOD_A],
    ).toEqual({ foodPrice: 50000, foodExtraFee: 20000 });
  });

  it('never rewrites a started order — the snapshot is what gets billed', async () => {
    const sdk = makeSdk({
      plans: [buildPlan(orderDetailAcrossTwoMenus())],
      orders: [buildOrder('inProgress')],
    });
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateMenuExtraFees(MENU_ID, { extraFees: { [FOOD_A]: 15000 } });

    const planUpdate = (sdk.listings.update as jest.Mock).mock.calls.find(
      ([params]: any[]) => params.id === PLAN_ID,
    );
    expect(planUpdate).toBeUndefined();
  });

  it('clears the snapshot fee to 0 when a dish is no longer surcharged', async () => {
    const sdk = makeSdk({
      menu: buildMenu({ foodExtraFees: { [FOOD_A]: 15000 } }),
      plans: [
        buildPlan({
          '1000': {
            restaurant: {
              menuId: MENU_ID,
              foodList: { [FOOD_A]: { foodPrice: 50000, foodExtraFee: 15000 } },
            },
          },
        }),
      ],
      orders: [buildOrder(EListingStates.draft)],
    });
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateMenuExtraFees(MENU_ID, { extraFees: {}, mode: 'replace' });

    const planUpdate = (sdk.listings.update as jest.Mock).mock.calls.find(
      ([params]: any[]) => params.id === PLAN_ID,
    )?.[0];

    expect(
      planUpdate.metadata.orderDetail['1000'].restaurant.foodList[FOOD_A]
        .foodExtraFee,
    ).toBe(0);
  });
});

/**
 * The admin's per-dish editor derives its rows from the menu's foodsByDate.
 * Because the fee map is flat (one value per dish per menu), a dish served on
 * several weekdays must collapse into a SINGLE row — otherwise an admin could
 * type two different fees for one dish and silently lose one of them on save.
 */
describe('buildExtraFeeRows — per-dish editor rows', () => {
  it('collapses a dish served on several days into one row', () => {
    const rows = buildExtraFeeRows({
      mon: { [FOOD_A]: { title: 'Cơm gà', price: 50000 } },
      wed: { [FOOD_A]: { title: 'Cơm gà', price: 50000 } },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      foodId: FOOD_A,
      title: 'Cơm gà',
      price: 50000,
      days: ['T2', 'T4'],
    });
  });

  it('lists each distinct dish once, sorted by title', () => {
    const rows = buildExtraFeeRows({
      mon: {
        [FOOD_B]: { title: 'Bún bò', price: 45000 },
        [FOOD_A]: { title: 'Cơm gà', price: 50000 },
      },
    });

    expect(rows.map((row) => row.title)).toEqual(['Bún bò', 'Cơm gà']);
  });

  it('returns no rows for an empty menu so the section can hide itself', () => {
    expect(buildExtraFeeRows({})).toEqual([]);
    expect(buildExtraFeeRows(undefined)).toEqual([]);
  });
});

describe('toAmount — fee input parsing', () => {
  it('strips the thousand separators the input renders', () => {
    expect(toAmount('15.000')).toBe(15000);
    expect(toAmount('15,000')).toBe(15000);
  });

  it('treats an empty field as 0 — "no surcharge", never NaN', () => {
    expect(toAmount('')).toBe(0);
    expect(toAmount('abc')).toBe(0);
  });
});

/**
 * The accordion keeps unsaved edits in page state while a panel is collapsed,
 * so the dirty flag is the only thing telling the admin work is outstanding.
 * An empty field must read as "0", not as a change, or every freshly opened
 * panel would claim to be dirty and the warning would become noise.
 */
describe('hasUnsavedExtraFeeChanges', () => {
  it('is false when the draft matches what is stored', () => {
    expect(
      hasUnsavedExtraFeeChanges(
        { [FOOD_A]: '15.000', [FOOD_B]: '' },
        { [FOOD_A]: 15000 },
        [FOOD_A, FOOD_B],
      ),
    ).toBe(false);
  });

  it('treats an empty field and a missing saved fee as equal', () => {
    expect(hasUnsavedExtraFeeChanges({ [FOOD_A]: '' }, {}, [FOOD_A])).toBe(
      false,
    );
    expect(
      hasUnsavedExtraFeeChanges({ [FOOD_A]: '' }, { [FOOD_A]: 0 }, [FOOD_A]),
    ).toBe(false);
  });

  it('is true when a fee is edited', () => {
    expect(
      hasUnsavedExtraFeeChanges({ [FOOD_A]: '20.000' }, { [FOOD_A]: 15000 }, [
        FOOD_A,
      ]),
    ).toBe(true);
  });

  it('is true when an existing fee is cleared', () => {
    expect(
      hasUnsavedExtraFeeChanges({ [FOOD_A]: '' }, { [FOOD_A]: 15000 }, [
        FOOD_A,
      ]),
    ).toBe(true);
  });
});

/**
 * Bulk-applying one fee to the dishes ticked inside a single menu's panel.
 *
 * This is a convenience layer over the same draft the per-row inputs write to —
 * it must never write, and it must never shrink what the save submits. The save
 * runs in `replace` mode with the complete map, so if a bulk apply dropped the
 * dishes it did not touch, their stored fees would be cleared on the next save.
 */
describe('applyFeeToFoods', () => {
  const FOOD_C = 'food-c';

  /** Mirrors how the page turns a draft into the save payload. */
  const buildSaveMap = (draft: Record<string, string>, foodIds: string[]) =>
    foodIds.reduce<Record<string, number>>(
      (result, foodId) => ({
        ...result,
        [foodId]: toAmount(draft[foodId] || ''),
      }),
      {},
    );

  it('applies the value to exactly the selected dishes', () => {
    const next = applyFeeToFoods(
      { [FOOD_A]: '', [FOOD_B]: '', [FOOD_C]: '' },
      [FOOD_A, FOOD_C],
      '10.000',
    );

    expect(next).toEqual({
      [FOOD_A]: '10.000',
      [FOOD_B]: '',
      [FOOD_C]: '10.000',
    });
  });

  it('keeps an unsaved manual edit on a dish that was not selected', () => {
    const next = applyFeeToFoods(
      { [FOOD_A]: '', [FOOD_B]: '25.000' },
      [FOOD_A],
      '10.000',
    );

    expect(next[FOOD_B]).toBe('25.000');
  });

  it('applies an explicit 0 so a batch of surcharges can be cleared', () => {
    const next = applyFeeToFoods(
      { [FOOD_A]: '15.000', [FOOD_B]: '15.000' },
      [FOOD_A, FOOD_B],
      '0',
    );

    expect(next).toEqual({ [FOOD_A]: '0', [FOOD_B]: '0' });
    expect(toAmount(next[FOOD_A])).toBe(0);
  });

  it('is a no-op when nothing is selected', () => {
    const draft = { [FOOD_A]: '15.000' };

    expect(applyFeeToFoods(draft, [], '10.000')).toEqual(draft);
  });

  it('leaves every dish of the menu in the map the save submits', () => {
    const foodIds = [FOOD_A, FOOD_B, FOOD_C];
    const next = applyFeeToFoods(
      { [FOOD_A]: '', [FOOD_B]: '15.000', [FOOD_C]: '' },
      [FOOD_A, FOOD_C],
      '10.000',
    );

    // All three keys survive — `replace` mode would otherwise clear FOOD_B.
    expect(buildSaveMap(next, foodIds)).toEqual({
      [FOOD_A]: 10000,
      [FOOD_B]: 15000,
      [FOOD_C]: 10000,
    });
  });

  it('marks the panel dirty so the admin still has to save', () => {
    const next = applyFeeToFoods({ [FOOD_A]: '' }, [FOOD_A], '10.000');

    expect(hasUnsavedExtraFeeChanges(next, {}, [FOOD_A])).toBe(true);
  });
});
