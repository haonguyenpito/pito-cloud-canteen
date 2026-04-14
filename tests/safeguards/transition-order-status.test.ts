/**
 * TRANSITION ORDER STATUS SAFEGUARDS
 *
 * Protects the logic that decides when an order moves from inProgress/pendingPayment
 * to completed or pendingPayment based on sub-order transaction states.
 *
 * Decision tree (all cases):
 *
 *   isAllTransactionCompleted = every tx is COMPLETE_DELIVERY or in TRANSITIONS_TO_STATE_CANCELED
 *
 *   shouldTransitToOrderCompleted     = paid + (inProgress | pendingPayment) + allDone
 *   shouldTransitToOrderPendingPayment = allDone + NOT already pendingPayment
 *
 * Critical: TRANSITIONS_TO_STATE_CANCELED must include all cancel paths or
 * canceled sub-orders will block the order from ever completing.
 *
 * Source: src/pages/api/admin/plan/transition-order-status.service.ts
 */

import { transitionOrderStatus } from '@pages/api/admin/plan/transition-order-status.service';
import { fetchTransaction, fetchUser } from '@services/integrationHelper';
import { createNativeNotificationToBooker } from '@services/nativeNotification';
import { createFirebaseDocNotification } from '@services/notifications';
import { EOrderStates } from '@src/utils/enums';
import { ETransition } from '@utils/transaction';

jest.mock('@services/integrationHelper');
jest.mock('@services/nativeNotification');
jest.mock('@services/notifications');

// ---------------------------------------------------------------------------
// Helpers: build minimal Sharetribe-shaped objects
// (Listing/Transaction wrappers from @utils/data are pure functions — no mock needed)
// ---------------------------------------------------------------------------

const makeOrder = (metadata: Record<string, any>) => ({
  id: { uuid: 'order-id-1' },
  type: 'listing',
  attributes: { publicData: {}, metadata },
});

const makePlan = (orderDetail: Record<string, any>) => ({
  id: { uuid: 'plan-id-1' },
  type: 'listing',
  attributes: {
    publicData: {},
    metadata: { orderDetail },
  },
});

const makeTx = (lastTransition: ETransition | string) => ({
  id: { uuid: 'tx-1' },
  type: 'transaction',
  attributes: { lastTransition },
});

const makeSdk = () => ({
  listings: {
    update: jest.fn().mockResolvedValue({}),
  },
});

// Plan with two sub-order dates, each having a transactionId
const planWithTxs = makePlan({
  '2024-04-01': { transactionId: 'tx-a' },
  '2024-04-02': { transactionId: 'tx-b' },
});

// Plan with no transactionIds (pre-started, empty orderDetail)
const emptyPlan = makePlan({});

beforeEach(() => {
  jest.clearAllMocks();
  (fetchUser as jest.Mock).mockResolvedValue({
    id: { uuid: 'booker-1' },
    type: 'user',
    attributes: { profile: {} },
  });
});

// ---------------------------------------------------------------------------
// All transactions completed + sufficient payment → order completes
// ---------------------------------------------------------------------------

describe('transitions to completed', () => {
  it('moves inProgress order to completed when all txs are COMPLETE_DELIVERY and both paid', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.COMPLETE_DELIVERY),
    );
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: true,
      isPartnerSufficientPaid: true,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(sdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderState: EOrderStates.completed,
        }),
      }),
    );
  });

  it('moves pendingPayment order to completed when paid and all txs done', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.COMPLETE_DELIVERY),
    );
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.pendingPayment,
      isClientSufficientPaid: true,
      isPartnerSufficientPaid: true,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(sdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderState: EOrderStates.completed,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// All transactions done but NOT yet paid → pendingPayment
// ---------------------------------------------------------------------------

describe('transitions to pendingPayment', () => {
  it('moves inProgress order to pendingPayment when all txs complete but not paid', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.COMPLETE_DELIVERY),
    );
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(sdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderState: EOrderStates.pendingPayment,
        }),
      }),
    );
  });

  it('sends Firebase notification and native notification when transitioning to pendingPayment', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.COMPLETE_DELIVERY),
    );
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(createFirebaseDocNotification).toHaveBeenCalled();
    expect(createNativeNotificationToBooker).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// No state change scenarios
// ---------------------------------------------------------------------------

describe('no state change', () => {
  it('does NOT update when at least one tx is still in delivering state', async () => {
    // First tx done, second still delivering
    (fetchTransaction as jest.Mock)
      .mockResolvedValueOnce(makeTx(ETransition.COMPLETE_DELIVERY))
      .mockResolvedValueOnce(makeTx(ETransition.START_DELIVERY));
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(sdk.listings.update).not.toHaveBeenCalled();
  });

  it('does NOT update when already pendingPayment and not yet paid', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.COMPLETE_DELIVERY),
    );
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.pendingPayment,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(sdk.listings.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Canceled sub-orders count as "done" (critical for multi-date orders)
// ---------------------------------------------------------------------------

describe('canceled transactions count as completed', () => {
  it('treats OPERATOR_CANCEL_PLAN as done when checking completion', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.OPERATOR_CANCEL_PLAN),
    );
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    // All dates canceled → all "done" → transitions to pendingPayment
    expect(sdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderState: EOrderStates.pendingPayment,
        }),
      }),
    );
  });

  it('treats OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED as done', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED),
    );
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(sdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderState: EOrderStates.pendingPayment,
        }),
      }),
    );
  });

  it('treats OPERATOR_CANCEL_AFTER_PARTNER_REJECTED as done', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED),
    );
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(sdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderState: EOrderStates.pendingPayment,
        }),
      }),
    );
  });

  it('handles mix of COMPLETE_DELIVERY and canceled txs — counts as all done', async () => {
    (fetchTransaction as jest.Mock)
      .mockResolvedValueOnce(makeTx(ETransition.COMPLETE_DELIVERY))
      .mockResolvedValueOnce(makeTx(ETransition.OPERATOR_CANCEL_PLAN));
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    expect(sdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderState: EOrderStates.pendingPayment,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Edge case: plan has no transactionIds (vacuous truth)
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('treats plan with no transactionIds as all-done (vacuous truth)', async () => {
    const sdk = makeSdk();
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
    });

    await transitionOrderStatus(order as any, emptyPlan as any, sdk);

    // No txs to check → isAllTransactionCompleted = true → pendingPayment
    expect(sdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderState: EOrderStates.pendingPayment,
        }),
      }),
    );
  });

  it('preserves existing orderStateHistory when updating', async () => {
    (fetchTransaction as jest.Mock).mockResolvedValue(
      makeTx(ETransition.COMPLETE_DELIVERY),
    );
    const sdk = makeSdk();
    const existingHistory = [{ state: 'picking', updatedAt: 1000 }];
    const order = makeOrder({
      orderState: EOrderStates.inProgress,
      isClientSufficientPaid: false,
      isPartnerSufficientPaid: false,
      bookerId: 'booker-1',
      orderStateHistory: existingHistory,
    });

    await transitionOrderStatus(order as any, planWithTxs as any, sdk);

    const updateCall = (sdk.listings.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.metadata.orderStateHistory).toEqual(
      expect.arrayContaining([{ state: 'picking', updatedAt: 1000 }]),
    );
  });
});
