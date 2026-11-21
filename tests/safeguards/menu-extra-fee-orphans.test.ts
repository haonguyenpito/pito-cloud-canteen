/**
 * Safeguard (review item 2): a menu's extra fee must not "come back from the
 * dead" when a dish is removed from the menu and later re-added.
 *
 * `menu.publicData.foodExtraFees` is keyed by foodId. Before this fix, saving a
 * menu (`updateMenu.service.ts`) rebuilt the food lists but never touched the
 * fee map, so a removed dish kept its fee and silently re-applied it if the
 * partner added the dish back — a fee nobody set for the current menu.
 *
 * Rule: a fee survives a menu save only for a dish that was in the menu before
 * the save AND is still in it after. A (re-)added dish starts with no fee.
 */
import updateMenu, {
  pruneExtraFeesOnMenuSave,
} from '@pages/api/apiServices/menu/updateMenu.service';
import { getIntegrationSdk } from '@services/sdk';
import { EListingStates } from '@src/utils/enums';

jest.mock('@services/sdk', () => ({ getIntegrationSdk: jest.fn() }));
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
const FOOD_C = 'food-c';

describe('pruneExtraFeesOnMenuSave', () => {
  it('drops the fee of a dish removed by the save', () => {
    expect(
      pruneExtraFeesOnMenuSave({
        foodExtraFees: { [FOOD_A]: 10_000, [FOOD_B]: 15_000 },
        previousFoodIds: [FOOD_A, FOOD_B],
        nextFoodIds: [FOOD_A],
      }),
    ).toEqual({ [FOOD_A]: 10_000 });
  });

  it('drops a leftover fee when its dish is re-added by the save', () => {
    // FOOD_B was removed earlier (before this fix) and its fee lingered.
    expect(
      pruneExtraFeesOnMenuSave({
        foodExtraFees: { [FOOD_A]: 10_000, [FOOD_B]: 15_000 },
        previousFoodIds: [FOOD_A],
        nextFoodIds: [FOOD_A, FOOD_B],
      }),
    ).toEqual({ [FOOD_A]: 10_000 });
  });

  it('keeps an explicit 0 fee for a dish that stays', () => {
    expect(
      pruneExtraFeesOnMenuSave({
        foodExtraFees: { [FOOD_A]: 0, [FOOD_B]: 15_000 },
        previousFoodIds: [FOOD_A, FOOD_B],
        nextFoodIds: [FOOD_A],
      }),
    ).toEqual({ [FOOD_A]: 0 });
  });

  it('returns undefined when nothing changes, so the map is not rewritten', () => {
    expect(
      pruneExtraFeesOnMenuSave({
        foodExtraFees: { [FOOD_A]: 10_000 },
        previousFoodIds: [FOOD_A, FOOD_B],
        nextFoodIds: [FOOD_A, FOOD_B, FOOD_C],
      }),
    ).toBeUndefined();
    expect(
      pruneExtraFeesOnMenuSave({
        foodExtraFees: undefined,
        previousFoodIds: [FOOD_A],
        nextFoodIds: [],
      }),
    ).toBeUndefined();
  });

  it('empties the map when every surcharged dish leaves the menu', () => {
    expect(
      pruneExtraFeesOnMenuSave({
        foodExtraFees: { [FOOD_A]: 10_000 },
        previousFoodIds: [FOOD_A],
        nextFoodIds: [FOOD_B],
      }),
    ).toEqual({});
  });
});

describe('updateMenu — writes the pruned fee map with the menu save', () => {
  const buildMenu = (
    foodExtraFees: Record<string, number> | undefined,
    monFoodIdList: string[],
    tueFoodIdList: string[] = [],
  ) => ({
    id: { uuid: MENU_ID },
    type: 'listing',
    attributes: {
      publicData: {
        daysOfWeek: ['mon', 'tue'],
        ...(foodExtraFees ? { foodExtraFees } : {}),
      },
      metadata: {
        listingState: EListingStates.pendingApproval,
        monFoodIdList,
        tueFoodIdList,
      },
    },
  });

  const run = async (
    menu: ReturnType<typeof buildMenu>,
    foodsByDate: Record<string, Record<string, object>>,
  ) => {
    const update = jest.fn().mockResolvedValue({
      data: { data: menu },
    });
    (getIntegrationSdk as jest.Mock).mockReturnValue({
      listings: {
        show: jest.fn().mockResolvedValue({ data: { data: menu } }),
        update,
      },
    });

    await updateMenu(MENU_ID, {
      id: MENU_ID,
      daysOfWeek: ['mon', 'tue'],
      foodsByDate,
    } as any);

    return update.mock.calls[0][0].publicData;
  };

  afterEach(() => jest.clearAllMocks());

  it('removing a dish removes its fee', async () => {
    const publicData = await run(
      buildMenu({ [FOOD_A]: 10_000, [FOOD_B]: 15_000 }, [FOOD_A, FOOD_B]),
      { mon: { [FOOD_A]: { price: 40_000 } } },
    );

    expect(publicData.foodExtraFees).toEqual({ [FOOD_A]: 10_000 });
  });

  it('re-adding a dish does not resurrect its old fee', async () => {
    const publicData = await run(
      buildMenu({ [FOOD_A]: 10_000, [FOOD_B]: 15_000 }, [FOOD_A]),
      {
        mon: {
          [FOOD_A]: { price: 40_000 },
          [FOOD_B]: { price: 45_000 },
        },
      },
    );

    expect(publicData.foodExtraFees).toEqual({ [FOOD_A]: 10_000 });
  });

  it('a dish moved to another weekday keeps its fee', async () => {
    const publicData = await run(buildMenu({ [FOOD_A]: 10_000 }, [FOOD_A]), {
      mon: {},
      tue: { [FOOD_A]: { price: 40_000 } },
    });

    expect(publicData).not.toHaveProperty('foodExtraFees');
  });

  it('a day not sent in the save keeps its dishes and their fees', async () => {
    // Only Monday is submitted; Tuesday's list is left as-is by the metadata
    // merge, so FOOD_B is still in the menu and keeps its fee.
    const publicData = await run(
      buildMenu({ [FOOD_A]: 10_000, [FOOD_B]: 15_000 }, [FOOD_A], [FOOD_B]),
      { mon: { [FOOD_A]: { price: 40_000 } } },
    );

    expect(publicData).not.toHaveProperty('foodExtraFees');
  });
});
