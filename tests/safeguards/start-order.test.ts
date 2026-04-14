/**
 * START ORDER GUARD SAFEGUARDS
 *
 * Protects the critical guard in startOrder() that prevents starting an order
 * that is not in the 'picking' state.
 *
 * WHY THIS MATTERS:
 * - startOrder() triggers initiateTransaction(), which creates Sharetribe transactions
 * - Once transactions are created, the order is irreversible
 * - Starting an order in the wrong state corrupts the lifecycle
 *
 * Guard: if (orderState !== 'picking') throw Error
 *
 * Source: src/pages/api/orders/[orderId]/start-order.service.ts
 */

import { getPickFoodParticipants } from '@helpers/orderHelper';
import { pushNativeNotificationOrderDetail } from '@pages/api/helpers/pushNotificationOrderDetailHelper';
import { sendBookerNativeNotification } from '@pages/api/orders/[orderId]/send-booker-native-notification.service';
import { startOrder } from '@pages/api/orders/[orderId]/start-order.service';
import { denormalisedResponseEntities } from '@services/data';
import { emailSendingFactory } from '@services/email';
import getSystemAttributes from '@services/getSystemAttributes';
import { fetchUser } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { createNativeNotification } from '@services/nativeNotification';
import { createSlackNotification } from '@services/slackNotification';
import { EOrderStates } from '@utils/enums';

// ---------------------------------------------------------------------------
// Mock all side-effect dependencies — we test the guard, not the notifications
// ---------------------------------------------------------------------------

jest.mock('@services/integrationSdk');
jest.mock('@services/data');
jest.mock('@services/integrationHelper');
jest.mock('@services/getSystemAttributes');
// Explicit factory to avoid ESM parse error from 'marked' (via email template)
jest.mock('@services/email', () => ({
  emailSendingFactory: jest.fn(),
  EmailTemplateTypes: {
    BOOKER: { BOOKER_ORDER_SUCCESS: 'booker-order-success' },
  },
}));
jest.mock('@services/nativeNotification');
jest.mock('@services/slackNotification');
jest.mock('@pages/api/helpers/pushNotificationOrderDetailHelper');
jest.mock(
  '@pages/api/orders/[orderId]/send-booker-native-notification.service',
  () => ({ sendBookerNativeNotification: jest.fn() }),
);
jest.mock('@helpers/orderHelper');
jest.mock('@helpers/dateHelpers', () => ({
  convertDateToVNTimezone: jest.fn().mockReturnValue('2024-04-01T00:00:00.000'),
}));

// ---------------------------------------------------------------------------
// Helpers to build mock SDK and listing shapes
// ---------------------------------------------------------------------------

const makeOrderListing = (orderState: EOrderStates, extras = {}) => ({
  id: { uuid: 'order-id-1' },
  type: 'listing',
  attributes: {
    title: 'ORD-001',
    publicData: { orderName: 'Test Order' },
    metadata: {
      orderState,
      companyId: 'company-1',
      bookerId: 'booker-1',
      partnerIds: ['partner-1'],
      companyName: 'ACME Corp',
      startDate: '2024-04-01',
      endDate: '2024-04-05',
      deliveryHour: '11:30',
      deliveryAddress: { address: '123 Test St' },
      orderStateHistory: [],
      ...extras,
    },
  },
});

// Shape returned by integrationSdk.listings.show for the plan (used directly, not via denormalise)
const makePlanShowResponse = (planStarted = true) => ({
  data: {
    data: {
      attributes: {
        metadata: { planStarted, orderDetail: {}, partnerIds: [] },
      },
    },
  },
});

// Shape returned after denormalising a plan update response
const makeDenormalisedPlan = () => ({
  id: { uuid: 'plan-id-1' },
  type: 'listing',
  attributes: {
    publicData: {},
    metadata: { orderDetail: {}, partnerIds: [] },
  },
});

const makeBootstrapSdk = () => ({
  listings: {
    // First call: order show; second call: plan show
    show: jest
      .fn()
      .mockResolvedValueOnce({
        data: { data: makeOrderListing(EOrderStates.picking) },
      })
      .mockResolvedValue(makePlanShowResponse()),
    update: jest.fn().mockResolvedValue({}),
  },
});

const setupHappyPathMocks = (sdk: ReturnType<typeof makeBootstrapSdk>) => {
  (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);
  // First call: order show → [orderListing]; second call: plan update → [plan]
  (denormalisedResponseEntities as jest.Mock)
    .mockReturnValueOnce([makeOrderListing(EOrderStates.picking)])
    .mockReturnValue([makeDenormalisedPlan()]);
  (fetchUser as jest.Mock).mockResolvedValue({
    id: { uuid: 'user-1' },
    type: 'user',
    attributes: {
      profile: { displayName: 'Test User' },
      publicData: { isAutoPickFood: false },
      metadata: { hasSpecificPCCFee: false, specificPCCFee: 0 },
    },
  });
  (getSystemAttributes as jest.Mock).mockResolvedValue({
    systemVATPercentage: 0.1,
  });
  (emailSendingFactory as jest.Mock).mockResolvedValue(undefined);
  (createNativeNotification as jest.Mock).mockResolvedValue(undefined);
  (createSlackNotification as jest.Mock).mockResolvedValue(undefined);
  (pushNativeNotificationOrderDetail as jest.Mock).mockResolvedValue(undefined);
  (sendBookerNativeNotification as jest.Mock).mockResolvedValue(undefined);
  (getPickFoodParticipants as jest.Mock).mockReturnValue([]);
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Critical guard: throws when orderState is NOT 'picking'
// ---------------------------------------------------------------------------

describe('startOrder guard — throws when orderState is not picking', () => {
  const nonPickingStates = [
    EOrderStates.inProgress,
    EOrderStates.pendingPayment,
    EOrderStates.completed,
    EOrderStates.canceled,
    EOrderStates.canceledByBooker,
    EOrderStates.reviewed,
  ];

  nonPickingStates.forEach((state) => {
    it(`throws for orderState = "${state}"`, async () => {
      const sdk = makeBootstrapSdk();
      (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);
      // Override the once mock so all calls return the non-picking listing
      (denormalisedResponseEntities as jest.Mock)
        .mockReset()
        .mockReturnValue([makeOrderListing(state)]);

      await expect(startOrder('order-id-1', 'plan-id-1')).rejects.toThrow(
        'picking',
      );
    });
  });

  it('throws with descriptive error message', async () => {
    const sdk = makeBootstrapSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);
    (denormalisedResponseEntities as jest.Mock)
      .mockReset()
      .mockReturnValue([makeOrderListing(EOrderStates.inProgress)]);

    await expect(startOrder('order-id-1', 'plan-id-1')).rejects.toThrow(
      /You can start picking order/,
    );
  });
});

// ---------------------------------------------------------------------------
// Happy path: picking state → updates order to inProgress
// ---------------------------------------------------------------------------

describe('startOrder — picking state proceeds correctly', () => {
  it('does NOT throw when orderState is picking', async () => {
    const sdk = makeBootstrapSdk();
    setupHappyPathMocks(sdk);

    await expect(startOrder('order-id-1', 'plan-id-1')).resolves.not.toThrow();
  });

  it('calls integrationSdk.listings.update with orderState = inProgress', async () => {
    const sdk = makeBootstrapSdk();
    setupHappyPathMocks(sdk);

    await startOrder('order-id-1', 'plan-id-1');

    const updateCalls = (sdk.listings.update as jest.Mock).mock.calls;
    const orderUpdateCall = updateCalls.find(
      ([args]: any) =>
        args.id === 'order-id-1' &&
        args.metadata?.orderState === EOrderStates.inProgress,
    );
    expect(orderUpdateCall).toBeDefined();
  });

  it('appends inProgress to orderStateHistory', async () => {
    const sdk = makeBootstrapSdk();
    setupHappyPathMocks(sdk);
    // Override the first mockReturnValueOnce to include history
    (denormalisedResponseEntities as jest.Mock)
      .mockReset()
      .mockReturnValueOnce([
        makeOrderListing(EOrderStates.picking, {
          orderStateHistory: [{ state: 'picking', updatedAt: 1000 }],
        }),
      ])
      .mockReturnValue([makeDenormalisedPlan()]);

    await startOrder('order-id-1', 'plan-id-1');

    const updateCalls = (sdk.listings.update as jest.Mock).mock.calls;
    const orderUpdateCall = updateCalls.find(
      ([args]: any) =>
        args.id === 'order-id-1' &&
        args.metadata?.orderState === EOrderStates.inProgress,
    );
    expect(orderUpdateCall).toBeDefined();
    const history = orderUpdateCall[0].metadata.orderStateHistory;
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ state: EOrderStates.inProgress }),
      ]),
    );
  });
});
