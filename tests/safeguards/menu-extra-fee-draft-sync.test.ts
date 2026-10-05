/**
 * Safeguard: changing a menu's surcharge re-syncs DRAFT orders of both kinds.
 *
 * - Group orders snapshot the fee on `restaurant.foodList[*].foodExtraFee`.
 * - Normal orders bill from `lineItems[*].unitExtraFee` (base `unitPrice` /
 *   `price` stay untouched — they also feed the partner quotation).
 * - Dual-selection companies split one package across two dishes, so a
 *   multi-dish food carries HALF the fee, mirroring `adjustFoodListPrice`.
 *   Writing the full fee would charge the markup twice per meal.
 *
 * Source: src/pages/api/apiServices/menu/updateMenuExtraFees.service.ts
 */
import updateMenuExtraFees, {
  syncSubOrderExtraFees,
} from '@pages/api/apiServices/menu/updateMenuExtraFees.service';
import { getIntegrationSdk } from '@services/integrationSdk';
import { EListingStates } from '@src/utils/enums';

jest.mock('@services/integrationSdk');

const MENU_ID = 'menu-1';
const PLAN_ID = 'plan-1';
const FOOD_A = 'food-a';
const FOOD_B = 'food-b';

const normalSubOrder = (numberOfMainDishes?: number) => ({
  restaurant: {
    menuId: MENU_ID,
    foodList: {
      [FOOD_A]: { foodPrice: 75_000, foodExtraFee: 0, numberOfMainDishes },
    },
  },
  lineItems: [
    {
      id: FOOD_A,
      name: 'Cơm gà',
      unitPrice: 75_000,
      price: 150_000,
      quantity: 2,
    },
  ],
});

describe('syncSubOrderExtraFees', () => {
  it('writes the fee onto normal-order line items without touching base prices', () => {
    const { subOrder, hasChange } = syncSubOrderExtraFees({
      subOrder: normalSubOrder(),
      extraFees: { [FOOD_A]: 25_000 },
    });

    expect(hasChange).toBe(true);
    expect(subOrder.lineItems[0]).toEqual({
      id: FOOD_A,
      name: 'Cơm gà',
      unitPrice: 75_000,
      price: 150_000,
      quantity: 2,
      unitExtraFee: 25_000,
    });
    expect(subOrder.restaurant.foodList[FOOD_A].foodExtraFee).toBe(25_000);
  });

  it('writes 0 for a dish the menu no longer surcharges', () => {
    const base = normalSubOrder();
    const { subOrder } = syncSubOrderExtraFees({
      subOrder: {
        ...base,
        lineItems: [{ ...base.lineItems[0], unitExtraFee: 25_000 }],
      },
      extraFees: {},
    });

    expect(subOrder.lineItems[0].unitExtraFee).toBe(0);
  });

  it('reports no change when line items and food list already match', () => {
    const base = normalSubOrder();
    const { hasChange } = syncSubOrderExtraFees({
      subOrder: {
        ...base,
        restaurant: {
          ...base.restaurant,
          foodList: { [FOOD_A]: { foodPrice: 75_000, foodExtraFee: 25_000 } },
        },
        lineItems: [{ ...base.lineItems[0], unitExtraFee: 25_000 }],
      },
      extraFees: { [FOOD_A]: 25_000 },
    });

    expect(hasChange).toBe(false);
  });

  it('leaves a group sub-order without lineItems without adding the key', () => {
    const { subOrder } = syncSubOrderExtraFees({
      subOrder: {
        restaurant: {
          menuId: MENU_ID,
          foodList: { [FOOD_A]: { foodPrice: 75_000, foodExtraFee: 0 } },
        },
        memberOrders: {},
      },
      extraFees: { [FOOD_A]: 25_000 },
    });

    expect(subOrder).not.toHaveProperty('lineItems');
    expect(subOrder.restaurant.foodList[FOOD_A].foodExtraFee).toBe(25_000);
  });

  describe('dual-selection company', () => {
    it('halves the fee of a multi-dish food on both food list and line item', () => {
      const { subOrder } = syncSubOrderExtraFees({
        subOrder: normalSubOrder(2),
        extraFees: { [FOOD_A]: 25_000 },
        isSecondaryFoodAllowed: true,
      });

      expect(subOrder.restaurant.foodList[FOOD_A].foodExtraFee).toBe(12_500);
      expect(subOrder.lineItems[0].unitExtraFee).toBe(12_500);
    });

    it('treats a missing numberOfMainDishes as multi-dish, like adjustFoodListPrice', () => {
      const { subOrder } = syncSubOrderExtraFees({
        subOrder: normalSubOrder(),
        extraFees: { [FOOD_A]: 25_000 },
        isSecondaryFoodAllowed: true,
      });

      expect(subOrder.lineItems[0].unitExtraFee).toBe(12_500);
    });

    it('keeps the full fee of a single-selection food', () => {
      const { subOrder } = syncSubOrderExtraFees({
        subOrder: normalSubOrder(1),
        extraFees: { [FOOD_A]: 25_000 },
        isSecondaryFoodAllowed: true,
      });

      expect(subOrder.lineItems[0].unitExtraFee).toBe(25_000);
    });
  });
});

describe('updateMenuExtraFees — normal-order fan-out', () => {
  const asResponse = (entities: any[]) => ({
    data: {
      data: entities.map((e) => ({
        id: e.id,
        type: 'listing',
        attributes: e.attributes,
      })),
    },
  });

  const run = async (orderMetadata: object) => {
    const menu = {
      id: { uuid: MENU_ID },
      attributes: {
        publicData: {},
        metadata: {
          listingState: EListingStates.pendingApproval,
          monFoodIdList: [FOOD_A, FOOD_B],
        },
      },
    };
    const plan = {
      id: { uuid: PLAN_ID },
      attributes: {
        metadata: {
          orderId: 'order-1',
          orderDetail: { '1000': normalSubOrder(2) },
        },
      },
    };
    const order = {
      id: { uuid: 'order-1' },
      attributes: {
        metadata: {
          orderState: EListingStates.draft,
          plans: [PLAN_ID],
          ...orderMetadata,
        },
      },
    };
    const update = jest.fn().mockResolvedValue({ data: {} });
    (getIntegrationSdk as jest.Mock).mockReturnValue({
      listings: {
        show: jest.fn().mockResolvedValue(asResponse([menu])),
        query: jest
          .fn()
          .mockImplementation((params: any) =>
            Promise.resolve(
              asResponse(params?.meta_menuIds ? [plan] : [order]),
            ),
          ),
        update,
      },
    });

    await updateMenuExtraFees(MENU_ID, { extraFees: { [FOOD_A]: 25_000 } });

    return update.mock.calls.find(([p]: any[]) => p.id === PLAN_ID)?.[0]
      .metadata.orderDetail['1000'];
  };

  afterEach(() => jest.clearAllMocks());

  it('syncs unitExtraFee onto a draft normal order', async () => {
    const subOrder = await run({ companyId: 'company-1' });

    expect(subOrder.lineItems[0].unitExtraFee).toBe(25_000);
    expect(subOrder.lineItems[0].unitPrice).toBe(75_000);
  });

  it('halves it for a company allowed to pick a secondary food', async () => {
    const subOrder = await run({
      companyId: 'company-1',
      canAddSecondaryFood: true,
    });

    expect(subOrder.lineItems[0].unitExtraFee).toBe(12_500);
    expect(subOrder.restaurant.foodList[FOOD_A].foodExtraFee).toBe(12_500);
  });
});

/**
 * Review item 7: the plan lookup used a single Sharetribe query, which returns
 * one page (100 listings). A menu used all season is referenced by far more
 * plans — most of them started — so drafts beyond page 1 kept the old fee.
 */
describe('updateMenuExtraFees — fan-out reads every page of plans', () => {
  const asPage = (entities: any[], totalPages: number) => ({
    data: {
      data: entities.map((e) => ({
        id: e.id,
        type: 'listing',
        attributes: e.attributes,
      })),
      meta: { totalPages },
    },
  });

  const makePlan = (index: number) => ({
    id: { uuid: `plan-${index}` },
    attributes: {
      metadata: {
        orderId: `order-${index}`,
        orderDetail: { '1000': normalSubOrder(1) },
      },
    },
  });

  const makeOrder = (index: number, orderState: string) => ({
    id: { uuid: `order-${index}` },
    attributes: {
      metadata: { orderState, plans: [`plan-${index}`] },
    },
  });

  afterEach(() => jest.clearAllMocks());

  it('syncs a draft order whose plan is on page 2', async () => {
    const DRAFT_INDEX = 100;
    // Page 1: 100 plans of started orders. Page 2: the one draft.
    const startedPlans = Array.from({ length: 100 }, (_, i) => makePlan(i));
    const draftPlan = makePlan(DRAFT_INDEX);
    const ordersById: Record<string, any> = Object.fromEntries(
      [
        ...startedPlans.map((_, i) => makeOrder(i, 'inProgress')),
        makeOrder(DRAFT_INDEX, EListingStates.draft),
      ].map((o) => [o.id.uuid, o]),
    );

    const menu = {
      id: { uuid: MENU_ID },
      attributes: {
        publicData: {},
        metadata: {
          listingState: EListingStates.pendingApproval,
          monFoodIdList: [FOOD_A],
        },
      },
    };
    const query = jest.fn().mockImplementation((params: any) => {
      if (params?.meta_menuIds) {
        return Promise.resolve(
          params.page === 2 ? asPage([draftPlan], 2) : asPage(startedPlans, 2),
        );
      }

      return Promise.resolve(
        asPage(
          (params.ids as string[]).map((id) => ordersById[id]).filter(Boolean),
          1,
        ),
      );
    });
    const update = jest.fn().mockResolvedValue({ data: {} });
    (getIntegrationSdk as jest.Mock).mockReturnValue({
      listings: {
        show: jest.fn().mockResolvedValue(asPage([menu], 1)),
        query,
        update,
      },
    });

    await updateMenuExtraFees(MENU_ID, { extraFees: { [FOOD_A]: 25_000 } });

    const planQueries = query.mock.calls.filter(([p]: any[]) => p.meta_menuIds);
    expect(planQueries.map(([p]: any[]) => p.page).sort()).toEqual([1, 2]);

    const updatedPlanIds = update.mock.calls
      .map(([p]: any[]) => p.id)
      .filter((id: string) => id.startsWith('plan-'));
    // Only the draft is rewritten; started orders keep their snapshot.
    expect(updatedPlanIds).toEqual([`plan-${DRAFT_INDEX}`]);

    const draftUpdate = update.mock.calls.find(
      ([p]: any[]) => p.id === `plan-${DRAFT_INDEX}`,
    )[0];
    expect(
      draftUpdate.metadata.orderDetail['1000'].lineItems[0].unitExtraFee,
    ).toBe(25_000);
  });
});
