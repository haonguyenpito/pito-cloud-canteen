/**
 * Server-side merges that keep a stale client orderDetail from rolling back
 * concurrent writes (participant picks, transit, payment).
 *
 * Source: src/helpers/order/orderDetailHelper.ts
 */
import {
  applyParticipantOrderToPlan,
  clearPicksOutsideFoodList,
  getPicksClearedByEdit,
  keepServerOwnedSubOrderFields,
  mergeParticipantOrder,
  patchSubOrders,
} from '@helpers/order/orderDetailHelper';
import { prepareNewPlanOrderDetail } from '@pages/api/orders/utils';
import { ETransition } from '@src/utils/transaction';

const fresh = {
  '1000': {
    restaurant: {
      id: 'r1',
      foodList: { f1: { foodName: 'Com ga' }, f2: { foodName: 'Bun bo' } },
    },
    memberOrders: {
      alice: { foodId: 'f1', status: 'joined' },
      bob: { foodId: 'f2', status: 'joined' }, // picked after the client loaded
    },
    transactionId: 'tx-1',
    lastTransition: 'transition/partner-confirm',
    isPaid: true,
    note: 'old note',
  },
  '2000': {
    restaurant: { id: 'r2', foodList: { f3: { foodName: 'Pho' } } },
    memberOrders: {},
    status: 'canceled',
  },
};

describe('keepServerOwnedSubOrderFields', () => {
  it('takes transactionId/lastTransition/isPaid from the fresh plan', () => {
    const stale = {
      '1000': {
        ...fresh['1000'],
        lastTransition: 'transition/initiate-transaction',
        isPaid: false,
        note: 'new note',
      },
    };

    const result = keepServerOwnedSubOrderFields(stale, fresh);

    expect(result['1000']).toMatchObject({
      lastTransition: 'transition/partner-confirm',
      isPaid: true,
      transactionId: 'tx-1',
      note: 'new note',
    });
  });

  it('drops a server-owned key the fresh plan no longer has', () => {
    const { transactionId: _tx, ...freshWithoutTx } = fresh['1000'];
    const result = keepServerOwnedSubOrderFields(
      { '1000': fresh['1000'] },
      { '1000': freshWithoutTx },
    );

    expect(result['1000']).not.toHaveProperty('transactionId');
  });

  it('never un-cancels a date and keeps the client date set', () => {
    const result = keepServerOwnedSubOrderFields(
      {
        '2000': { ...fresh['2000'], status: undefined },
        '3000': { note: 'x' },
      },
      fresh,
    );

    expect(result['2000'].status).toBe('canceled');
    expect(result['3000']).toEqual({ note: 'x' });
    expect(result).not.toHaveProperty('1000');
  });
});

describe('patchSubOrders', () => {
  it('merges only the patched fields and keeps fresh member picks', () => {
    const result = patchSubOrders(fresh, {
      '1000': { note: 'patched', memberOrders: {} },
    });

    expect(result['1000'].note).toBe('patched');
    expect(result['1000'].memberOrders).toEqual(fresh['1000'].memberOrders);
    expect(result['2000']).toEqual(fresh['2000']);
  });

  it('clears fresh picks the new foodList no longer offers', () => {
    const result = patchSubOrders(fresh, {
      '1000': {
        restaurant: { id: 'r1', foodList: { f1: { foodName: 'Com ga' } } },
      },
    });

    expect(result['1000'].memberOrders).toEqual({
      alice: { foodId: 'f1', status: 'joined' },
      bob: { foodId: '', status: 'empty' },
    });
  });

  it('ignores dates that do not exist on the fresh plan', () => {
    const result = patchSubOrders(fresh, { '9999': { note: 'ghost' } });

    expect(result).not.toHaveProperty('9999');
  });
});

describe('clearPicksOutsideFoodList', () => {
  it('reports which members were cleared and keeps empty picks untouched', () => {
    const { memberOrders, clearedMemberIds } = clearPicksOutsideFoodList(
      {
        alice: { foodId: 'gone', requirement: 'no chili', status: 'joined' },
        bob: { foodId: '', status: 'empty' },
      },
      { f1: { foodName: 'Com ga' } },
    );

    expect(clearedMemberIds).toEqual(['alice']);
    expect(memberOrders.alice).toEqual({
      foodId: '',
      requirement: 'no chili',
      status: 'empty',
    });
    expect(memberOrders.bob).toEqual({ foodId: '', status: 'empty' });
  });
});

describe('getPicksClearedByEdit', () => {
  it('lists fresh picks the edited foodList drops, named from the fresh menu', () => {
    const edited = {
      '1000': {
        restaurant: { id: 'r1', foodList: { f1: { foodName: 'Com ga' } } },
      },
      '2000': { note: 'menu untouched' },
      '3000': { restaurant: { foodList: {} } },
    };

    expect(getPicksClearedByEdit(fresh, edited)).toEqual([
      { date: '1000', memberId: 'bob', foodName: 'Bun bo' },
    ]);
  });
});

describe('prepareNewPlanOrderDetail', () => {
  it('links new transactions and leaves dates that already have one untouched', () => {
    const result = prepareNewPlanOrderDetail(
      {
        '1000': {
          transactionId: 'tx-old',
          lastTransition: 'transition/start-delivery',
        },
        '2000': { memberOrders: { alice: { foodId: 'f1' } } },
      } as any,
      { '2000': 'tx-new' },
    );

    expect(result['1000']).toEqual({
      transactionId: 'tx-old',
      lastTransition: 'transition/start-delivery',
    });
    expect(result['2000']).toEqual({
      memberOrders: { alice: { foodId: 'f1' } },
      transactionId: 'tx-new',
      lastTransition: ETransition.INITIATE_TRANSACTION,
    });
  });
});

describe('mergeParticipantOrder', () => {
  it('sets only this participant pick per given day and keeps everyone else', () => {
    const result = mergeParticipantOrder(fresh, {
      currentUserId: 'alice',
      orderDays: ['1000', '2000'],
      planData: {
        '1000': { alice: { foodId: 'f2', status: 'joined' } },
        '2000': {},
      },
    });

    expect(result['1000'].memberOrders).toEqual({
      alice: { foodId: 'f2', status: 'joined' },
      bob: fresh['1000'].memberOrders.bob,
    });
    expect(result['2000']).toEqual(fresh['2000']);
    expect(fresh['1000'].memberOrders.alice.foodId).toBe('f1');
  });

  it('applies a single-day memberOrders update', () => {
    const result = mergeParticipantOrder(fresh, {
      currentUserId: 'bob',
      orderDay: '1000',
      memberOrders: { bob: { foodId: '', status: 'notJoined' } },
    });

    expect(result['1000'].memberOrders.bob).toEqual({
      foodId: '',
      status: 'notJoined',
    });
  });
});

describe('applyParticipantOrderToPlan', () => {
  it('updates only the matching plan', () => {
    const plan = {
      id: { uuid: 'plan-1' },
      attributes: { metadata: { orderDetail: fresh, orderId: 'o1' } },
    } as any;
    const update = {
      planId: 'plan-1',
      orderDay: '1000',
      memberOrders: { alice: { foodId: 'f2' } },
    };

    const result = applyParticipantOrderToPlan(plan, update, 'alice');

    expect(result.attributes.metadata.orderId).toBe('o1');
    expect(
      result.attributes.metadata.orderDetail['1000'].memberOrders.alice,
    ).toEqual({ foodId: 'f2' });
    expect(
      applyParticipantOrderToPlan(
        { ...plan, id: { uuid: 'other' } },
        update,
        'alice',
      ),
    ).toEqual({ ...plan, id: { uuid: 'other' } });
  });
});
