/**
 * MENU EXTRA FEE — CLIENT / PARTNER PRICE SAFEGUARDS
 *
 * The extra fee (phí phụ thu) is PITO's markup, set per (menu, dish) in
 * `menu.publicData.foodExtraFees`. A plan snapshot stores the CLIENT price in
 * `foodPrice` / `unitPrice` and the partner's base price in
 * `foodPartnerPrice` / `unitPartnerPrice`, so every client-side total keeps
 * reading the fields it always read, and only partner-facing flows switch.
 *
 * Money rules pinned here:
 *   - client price = base + fee; partner price = base; fee 0 is valid
 *   - dual-selection companies halve BOTH prices of a multi-dish food
 *   - snapshots taken before the partner field existed: partner = client
 *   - a partner never receives a client price (plan data, quotation)
 *   - re-pricing a draft keeps the fee on a price change and the partner
 *     price on a fee change
 *
 * Sources: src/helpers/menuExtraFee.ts, src/helpers/orderHelper.ts,
 * src/helpers/order/partnerPriceHelper.ts, quotationHelper.ts,
 * repriceSubOrderHelper.ts, pending-menus MenuExtraFeeStep/utils.ts,
 * src/pages/api/apiServices/menu/updateMenuExtraFees.service.ts
 */
import {
  getMinBillablePrice,
  pruneExtraFeesOnMenuSave,
  sanitizeExtraFeeMap,
} from '@helpers/menuExtraFee';
import {
  toPartnerOrderDetail,
  toPartnerPlanListing,
} from '@helpers/order/partnerPriceHelper';
import {
  calculateClientQuotation,
  calculatePartnerQuotation,
} from '@helpers/order/quotationHelper';
import { repriceSubOrder } from '@helpers/order/repriceSubOrderHelper';
import {
  adjustFoodListPrice,
  buildLineItem,
  buildSnapshotFoodList,
  getUpdateLineItems,
} from '@helpers/orderHelper';
import {
  buildExtraFeeDayGroups,
  toExtraFeeMap,
  toFeeInputValue,
} from '@pages/admin/partner/pending-menus/components/MenuExtraFeeStep/utils';
import { findInvalidExtraFees } from '@pages/api/apiServices/menu/updateMenuExtraFees.service';
import type { FoodListing, PlanListing } from '@src/types';
import type { TListing } from '@src/utils/types';

jest.mock('@services/distributedLock', () => ({ withPlanLock: jest.fn() }));
jest.mock('@services/integrationHelper', () => ({ fetchListing: jest.fn() }));
jest.mock('@services/integrationSdk', () => ({ getIntegrationSdk: jest.fn() }));
jest.mock('@helpers/apiHelpers', () => ({
  queryAllListings: jest.fn(),
  fetchListingsByChunkedIds: jest.fn(),
}));

const food = (
  id: string,
  price: number,
  numberOfMainDishes?: string,
): FoodListing => ({
  id: { uuid: id },
  attributes: {
    title: `Food ${id}`,
    price: { amount: price },
    publicData: { unit: 'phần', numberOfMainDishes },
  },
});

const order = (canAddSecondaryFood: boolean) =>
  ({
    id: { uuid: 'order-1' },
    attributes: {
      metadata: { canAddSecondaryFood, companyId: 'company-1' },
    },
  } as unknown as TListing);

describe('menu fee helpers', () => {
  it('keeps a 0 fee and drops junk or negative fees', () => {
    expect(sanitizeExtraFeeMap({ a: 0, b: 5000, c: -1, d: 'x' })).toEqual({
      a: 0,
      b: 5000,
    });
  });

  it('computes <day>MinFoodPrice on client prices', () => {
    expect(
      getMinBillablePrice(
        [
          { foodId: 'a', price: 40000 },
          { foodId: 'b', price: 45000 },
        ],
        { a: 10000 },
      ),
    ).toBe(45000);
    expect(getMinBillablePrice([], {})).toBe(0);
  });

  it('keeps a fee only for dishes served before and after a menu save', () => {
    expect(
      pruneExtraFeesOnMenuSave(
        { kept: 1000, removed: 2000, readded: 3000 },
        { mon: { kept: {}, removed: {} } },
        { tue: { kept: {}, readded: {} } },
      ),
    ).toEqual({ kept: 1000 });
  });
});

describe('plan snapshot', () => {
  const foods = [food('a', 40000), food('b', 50000, '1')];

  it('stores the client price with the fee and the partner price without', () => {
    expect(buildSnapshotFoodList(foods, ['a', 'b'], { a: 10000 })).toEqual({
      a: expect.objectContaining({ foodPrice: 50000, foodPartnerPrice: 40000 }),
      b: expect.objectContaining({ foodPrice: 50000, foodPartnerPrice: 50000 }),
    });
  });

  it('builds normal-order line items with both prices', () => {
    expect(getUpdateLineItems(foods, ['a'], { a: 0 })).toEqual([
      {
        id: 'a',
        name: 'Food a',
        unitPrice: 40000,
        price: 40000,
        quantity: 1,
        unitPartnerPrice: 40000,
      },
    ]);
    expect(
      buildLineItem(
        'a',
        { foodName: 'A', foodPrice: 50000, foodPartnerPrice: 40000 },
        3,
      ),
    ).toEqual(
      expect.objectContaining({
        unitPrice: 50000,
        price: 150000,
        unitPartnerPrice: 40000,
      }),
    );
  });

  it('halves both prices of a multi-dish food for dual-selection companies', () => {
    const snapshot = buildSnapshotFoodList(foods, ['a', 'b'], {
      a: 10000,
      b: 10000,
    });

    expect(adjustFoodListPrice(snapshot, order(true))).toEqual({
      a: expect.objectContaining({ foodPrice: 25000, foodPartnerPrice: 20000 }),
      b: expect.objectContaining({ foodPrice: 60000, foodPartnerPrice: 50000 }),
    });
    expect(adjustFoodListPrice(snapshot, order(false))).toEqual(snapshot);
  });
});

describe('partner view of a plan', () => {
  const orderDetail = {
    '1': {
      restaurant: {
        foodList: {
          a: { foodName: 'A', foodPrice: 50000, foodPartnerPrice: 40000 },
          legacy: { foodName: 'L', foodPrice: 30000 },
        },
      },
      lineItems: [
        {
          id: 'a',
          name: 'A',
          unitPrice: 50000,
          price: 100000,
          quantity: 2,
          unitPartnerPrice: 40000,
        },
        {
          id: 'legacy',
          name: 'L',
          unitPrice: 30000,
          price: 30000,
          quantity: 1,
        },
      ],
    },
  };

  it('replaces every price with the partner price and drops the client one', () => {
    const partnerDetail = toPartnerOrderDetail(orderDetail);

    expect(partnerDetail['1']?.restaurant?.foodList).toEqual({
      a: { foodName: 'A', foodPrice: 40000 },
      legacy: { foodName: 'L', foodPrice: 30000 },
    });
    expect(partnerDetail['1']?.lineItems).toEqual([
      { id: 'a', name: 'A', unitPrice: 40000, price: 80000, quantity: 2 },
      { id: 'legacy', name: 'L', unitPrice: 30000, price: 30000, quantity: 1 },
    ]);
  });

  it('rewrites the order detail of a plan listing', () => {
    const plan: PlanListing = {
      id: { uuid: 'plan-1' },
      attributes: { metadata: { orderId: 'o', orderDetail } },
    };

    expect(
      toPartnerPlanListing(plan).attributes?.metadata?.orderDetail?.['1']
        ?.restaurant?.foodList?.a,
    ).toEqual({ foodName: 'A', foodPrice: 40000 });
    expect(plan.attributes?.metadata?.orderDetail).toBe(orderDetail);
  });
});

describe('quotation', () => {
  const foodOrders = [
    {
      date: '1',
      restaurantId: 'r1',
      restaurantName: 'R1',
      foodDataList: [
        {
          foodId: 'a',
          foodName: 'A',
          frequency: 2,
          foodPrice: 50000,
          foodPartnerPrice: 40000,
        },
        { foodId: 'legacy', foodName: 'L', frequency: 1, foodPrice: 30000 },
      ],
    },
  ];

  it('stores client prices on the client side without the partner price', () => {
    expect(calculateClientQuotation(foodOrders).quotation['1']).toEqual([
      { foodId: 'a', foodName: 'A', frequency: 2, foodPrice: 50000 },
      { foodId: 'legacy', foodName: 'L', frequency: 1, foodPrice: 30000 },
    ]);
  });

  it('stores partner prices on the partner side', () => {
    expect(calculatePartnerQuotation({ r1: foodOrders })).toEqual({
      r1: {
        name: 'R1',
        quotation: {
          '1': [
            { foodId: 'a', foodName: 'A', frequency: 2, foodPrice: 40000 },
            { foodId: 'legacy', foodName: 'L', frequency: 1, foodPrice: 30000 },
          ],
        },
      },
    });
  });
});

describe('repriceSubOrder', () => {
  const subOrder = {
    restaurant: {
      menuId: 'm1',
      foodList: {
        a: {
          foodName: 'A',
          foodPrice: 50000,
          foodPartnerPrice: 40000,
          numberOfMainDishes: '2',
        },
        legacy: { foodName: 'L', foodPrice: 30000 },
      },
    },
    lineItems: [
      {
        id: 'a',
        name: 'A',
        unitPrice: 50000,
        price: 100000,
        quantity: 2,
        unitPartnerPrice: 40000,
      },
    ],
  };

  it('applies a new fee on top of the unchanged partner price', () => {
    const { subOrder: repriced, hasChange } = repriceSubOrder(subOrder, {
      extraFeeByFoodId: { a: 5000 },
    });

    expect(hasChange).toBe(true);
    expect(repriced.restaurant?.foodList?.a).toEqual(
      expect.objectContaining({ foodPrice: 45000, foodPartnerPrice: 40000 }),
    );
    expect(repriced.restaurant?.foodList?.legacy).toEqual(
      expect.objectContaining({ foodPrice: 30000, foodPartnerPrice: 30000 }),
    );
    expect(repriced.lineItems?.[0]).toEqual(
      expect.objectContaining({
        unitPrice: 45000,
        price: 90000,
        unitPartnerPrice: 40000,
      }),
    );
  });

  it('keeps the snapshot fee when the partner price changes', () => {
    const { subOrder: repriced } = repriceSubOrder(subOrder, {
      basePriceByFoodId: { a: 42000 },
    });

    expect(repriced.restaurant?.foodList?.a).toEqual(
      expect.objectContaining({ foodPrice: 52000, foodPartnerPrice: 42000 }),
    );
  });

  it('halves the new partner price and fee for dual-selection companies', () => {
    const { subOrder: repriced } = repriceSubOrder(subOrder, {
      basePriceByFoodId: { a: 42000 },
      extraFeeByFoodId: { a: 8000 },
      isSecondaryFoodAllowed: true,
    });

    expect(repriced.restaurant?.foodList?.a).toEqual(
      expect.objectContaining({ foodPrice: 25000, foodPartnerPrice: 21000 }),
    );
  });

  it('reports no change when nothing moves', () => {
    const { legacy: _legacy, ...foodList } = subOrder.restaurant.foodList;
    const { hasChange } = repriceSubOrder(
      { ...subOrder, restaurant: { ...subOrder.restaurant, foodList } },
      { extraFeeByFoodId: { a: 10000 } },
    );

    expect(hasChange).toBe(false);
  });

  it('backfills the partner price of a pre-surcharge snapshot', () => {
    const { subOrder: repriced, hasChange } = repriceSubOrder(subOrder, {
      extraFeeByFoodId: { a: 10000 },
    });

    expect(hasChange).toBe(true);
    expect(repriced.restaurant?.foodList?.legacy).toEqual(
      expect.objectContaining({ foodPrice: 30000, foodPartnerPrice: 30000 }),
    );
  });
});

describe('admin fee input', () => {
  it('groups dishes by served weekday, Monday first, cheapest first', () => {
    expect(
      buildExtraFeeDayGroups({
        wed: { a: { title: 'A', price: 45000, foodType: 'savory' } },
        mon: {
          a: { title: 'A', price: 45000, foodType: 'savory' },
          b: { title: 'B', price: 40000 },
        },
        tue: {},
      }),
    ).toEqual([
      {
        day: 'mon',
        rows: [
          { foodId: 'b', title: 'B', foodType: undefined, partnerPrice: 40000 },
          { foodId: 'a', title: 'A', foodType: 'savory', partnerPrice: 45000 },
        ],
      },
      {
        day: 'wed',
        rows: [
          { foodId: 'a', title: 'A', foodType: 'savory', partnerPrice: 45000 },
        ],
      },
    ]);
  });

  it('keeps only digits in the fee input', () => {
    expect(toFeeInputValue('-1.500đ')).toBe('1500');
  });

  it('turns inputs into the stored map: empty means no fee, 0 is kept', () => {
    expect(
      toExtraFeeMap({ a: '5000', b: '', c: '0', d: '-1', e: '1.5' }),
    ).toEqual({ extraFees: { a: 5000, c: 0 }, invalidFoodIds: ['d', 'e'] });
  });

  it('rejects fees that are not whole non-negative numbers or not in the menu', () => {
    expect(
      findInvalidExtraFees(
        { a: 5000, b: 0, c: -1, d: '5000', e: 1.5, other: 1000 },
        ['a', 'b', 'c', 'd', 'e'],
      ),
    ).toEqual(['c', 'd', 'e', 'other']);
  });
});
