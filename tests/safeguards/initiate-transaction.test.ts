/**
 * INITIATE TRANSACTION SERVICE SAFEGUARDS
 *
 * Guards the Sharetribe transaction creation logic in initiate-transaction.service.ts.
 *
 * WHY THIS MATTERS:
 * - This is the POINT OF NO RETURN: once transactions are created in Sharetribe,
 *   they can only be cancelled via operator transitions — not deleted.
 * - `transactions.initiate` is `privileged? true`, so it must use the trusted
 *   sub-account SDK, not the integration SDK. Using the wrong SDK throws a 403.
 * - Idempotency: getSubOrdersWithNoTxId() filters already-initiated sub-orders.
 *   Tests here guard that this filter cannot be silently removed.
 * - Partial failure: if one date fails, the plan listing update is skipped for
 *   that date. Re-running re-attempts only the missing dates.
 * - bookingProcessAlias must match the deployed Sharetribe process alias.
 *
 * Source: src/pages/api/orders/[orderId]/plan/[planId]/initiate-transaction.service.ts
 */

import { initiateTransaction } from '@pages/api/orders/[orderId]/plan/[planId]/initiate-transaction.service';
import { denormalisedResponseEntities } from '@services/data';
import { fetchUser } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/sdk';
import { getSubAccountTrustedSdk } from '@services/subAccountSdk';
import { Listing, Transaction, User } from '@src/utils/data';
import { EOrderType } from '@src/utils/enums';
import { ETransition } from '@src/utils/transaction';

jest.mock('@services/sdk', () => ({
  getIntegrationSdk: jest.fn(),
  handleError: jest.fn(),
}));
jest.mock('@services/subAccountSdk', () => ({
  getSubAccountTrustedSdk: jest.fn(),
}));
jest.mock('@services/integrationHelper', () => ({
  fetchUser: jest.fn(),
}));
jest.mock('@services/data', () => ({
  denormalisedResponseEntities: jest.fn(),
}));
jest.mock('@services/notifications', () => ({
  createFirebaseDocNotification: jest.fn(),
}));
jest.mock('@src/utils/data', () => ({
  Listing: jest.fn(),
  Transaction: jest.fn(),
  User: jest.fn(),
}));
// __esModule: true is required — ts-jest compiles `import config from '@src/configs'`
// to access the .default property of the CJS module object.
jest.mock('@src/configs', () => ({
  __esModule: true,
  default: { bookingProcessAlias: 'sub-order-transaction-process/release-2' },
}));
jest.mock('@src/utils/dates', () => ({
  formatTimestamp: jest.fn().mockReturnValue('2024-01-15'),
}));
jest.mock('@helpers/orderHelper', () => ({
  checkIsOrderHasInProgressState: jest.fn().mockReturnValue(false),
  getEditedSubOrders: jest.fn().mockReturnValue({}),
}));
jest.mock('@pages/api/orders/utils', () => ({
  getSubOrdersWithNoTxId: jest.fn(),
  normalizeOrderDetail: jest.fn(),
  prepareNewPlanOrderDetail: jest
    .fn()
    .mockReturnValue({ '2024-01-15': { txId: 'tx-new' } }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORDER_ID = 'order-111';
const PLAN_ID = 'plan-222';
const PARTNER_ID = 'partner-xyz';
const TX_ID = 'tx-abc';

const makeNormalizedItem = (date: string) => ({
  date,
  params: {
    listingId: PARTNER_ID,
    bookingStart: new Date('2024-01-15T05:00:00.000Z'),
    bookingEnd: new Date('2024-01-15T06:00:00.000Z'),
    bookingDisplayStart: new Date('2024-01-15T11:30:00.000Z'),
    bookingDisplayEnd: new Date('2024-01-15T12:30:00.000Z'),
    extendedData: {
      metadata: {},
    },
  },
});

const makeIntegrationSdk = (overrides: Record<string, any> = {}) => ({
  listings: {
    show: jest.fn().mockResolvedValue({ data: { data: { id: ORDER_ID } } }),
    query: jest.fn().mockResolvedValue({ data: { data: [] } }),
    update: jest.fn().mockResolvedValue({}),
    ...overrides.listings,
  },
  transactions: {
    transition: jest.fn().mockResolvedValue({}),
    ...overrides.transactions,
  },
});

const makeTrustedSdk = (initiateMock?: jest.Mock) => ({
  transactions: {
    initiate:
      initiateMock ??
      jest.fn().mockResolvedValue({
        data: { data: { id: TX_ID, type: 'transaction' } },
      }),
  },
});

/**
 * Sets up all mocks for a standard initiateTransaction call.
 *
 * normalizeOrderDetail is mocked with mockReturnValueOnce(normalizedItems) then
 * mockReturnValueOnce([]) — the service calls normalizeOrderDetail twice:
 *   1st call: subOrdersWithNoTxId → normalizedItems
 *   2nd call: editedSubOrders (always empty in these tests) → []
 */
const setupDefaultMocks = ({
  subOrdersWithNoTxId = {
    '2024-01-15': { restaurant: { id: PARTNER_ID } },
  } as Record<string, any>,
  normalizedItems = [makeNormalizedItem('2024-01-15')],
} = {}) => {
  const { getSubOrdersWithNoTxId, normalizeOrderDetail } = jest.requireMock(
    '@pages/api/orders/utils',
  );

  getSubOrdersWithNoTxId.mockReturnValue(subOrdersWithNoTxId);
  // First call uses normalizedItems (the real sub-orders), second call (editedSubOrders) returns [].
  normalizeOrderDetail
    .mockReturnValueOnce(normalizedItems)
    .mockReturnValueOnce([]);

  const integrationSdk = makeIntegrationSdk();
  (getIntegrationSdk as jest.Mock).mockReturnValue(integrationSdk);

  const trustedSdk = makeTrustedSdk();
  (getSubAccountTrustedSdk as jest.Mock).mockResolvedValue(trustedSdk);

  (fetchUser as jest.Mock)
    .mockResolvedValueOnce({
      // companyAccount
      attributes: { profile: { privateData: { subAccountId: 'sub-1' } } },
    })
    .mockResolvedValueOnce({
      // companySubAccount
      attributes: { profile: {} },
    });

  let callCount = 0;
  (denormalisedResponseEntities as jest.Mock).mockImplementation(() => {
    callCount++;
    if (callCount === 1) return [{ id: ORDER_ID, type: 'listing' }]; // order listing
    if (callCount === 2) return [{ id: PLAN_ID, type: 'listing' }]; // plan listing

    return [{ id: TX_ID, type: 'transaction' }]; // created tx
  });

  (Listing as jest.Mock).mockImplementation((listing: any) => ({
    getId: () => listing?.id ?? ORDER_ID,
    getAttributes: () => ({ title: 'Test Order' }),
    getMetadata: () => ({
      companyId: 'company-1',
      deliveryHour: '11:30 - 12:00',
      plans: [PLAN_ID],
      orderType: EOrderType.group,
      companyName: 'Acme',
      orderVATPercentage: 10,
      serviceFees: {},
      hasSpecificPCCFee: false,
      specificPCCFee: 0,
      orderStateHistory: [],
      partnerIds: [PARTNER_ID],
      orderDetail: subOrdersWithNoTxId,
    }),
    getPublicData: () => ({ vat: 'vat' }),
  }));

  (Transaction as jest.Mock).mockReturnValue({
    getId: () => TX_ID,
    getFullData: () => ({ provider: { id: PARTNER_ID } }),
  });

  (User as jest.Mock).mockReturnValue({
    getId: () => PARTNER_ID,
  });

  return { integrationSdk, trustedSdk };
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// SDK call count — one initiate per sub-order date
// ---------------------------------------------------------------------------

describe('transaction initiation — one call per sub-order date', () => {
  it('calls trustedSdk.transactions.initiate exactly once for a single-date plan', async () => {
    const { trustedSdk } = setupDefaultMocks();

    await initiateTransaction({ orderId: ORDER_ID, planId: PLAN_ID });

    expect(trustedSdk.transactions.initiate).toHaveBeenCalledTimes(1);
    expect(trustedSdk.transactions.initiate).toHaveBeenCalledWith(
      expect.objectContaining({
        processAlias: 'sub-order-transaction-process/release-2',
        transition: ETransition.INITIATE_TRANSACTION,
      }),
      expect.anything(),
    );
  });

  it('calls initiate N times for a plan with N sub-order dates', async () => {
    const dates = ['2024-01-15', '2024-01-16', '2024-01-17'];
    const subOrdersWithNoTxId = Object.fromEntries(
      dates.map((d) => [d, { restaurant: { id: PARTNER_ID } }]),
    );
    const normalizedItems = dates.map(makeNormalizedItem);

    const { trustedSdk } = setupDefaultMocks({
      subOrdersWithNoTxId,
      normalizedItems,
    });

    await initiateTransaction({ orderId: ORDER_ID, planId: PLAN_ID });

    expect(trustedSdk.transactions.initiate).toHaveBeenCalledTimes(
      dates.length,
    );
  });
});

// ---------------------------------------------------------------------------
// Idempotency — already-initiated sub-orders are skipped
// ---------------------------------------------------------------------------

describe('idempotency — sub-orders with existing txId are not re-initiated', () => {
  it('does not initiate transactions when getSubOrdersWithNoTxId returns empty', async () => {
    // getSubOrdersWithNoTxId returns {} → normalizeOrderDetail for main sub-orders gets []
    // Both normalizeOrderDetail calls return [] → no items to initiate
    const { normalizeOrderDetail } = jest.requireMock(
      '@pages/api/orders/utils',
    );
    const { getSubOrdersWithNoTxId } = jest.requireMock(
      '@pages/api/orders/utils',
    );

    getSubOrdersWithNoTxId.mockReturnValue({});
    // Both calls return [] — no sub-orders to process
    normalizeOrderDetail.mockReturnValue([]);

    const integrationSdk = makeIntegrationSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(integrationSdk);

    const trustedSdk = makeTrustedSdk();
    (getSubAccountTrustedSdk as jest.Mock).mockResolvedValue(trustedSdk);

    (fetchUser as jest.Mock)
      .mockResolvedValueOnce({
        attributes: { profile: { privateData: { subAccountId: 'sub-1' } } },
      })
      .mockResolvedValueOnce({ attributes: { profile: {} } });

    let callCount = 0;
    (denormalisedResponseEntities as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return [{ id: ORDER_ID, type: 'listing' }];
      if (callCount === 2) return [{ id: PLAN_ID, type: 'listing' }];

      return [{ id: TX_ID, type: 'transaction' }];
    });

    (Listing as jest.Mock).mockImplementation(() => ({
      getId: () => ORDER_ID,
      getAttributes: () => ({ title: 'Test Order' }),
      getMetadata: () => ({
        companyId: 'company-1',
        deliveryHour: '11:30 - 12:00',
        plans: [PLAN_ID],
        orderType: EOrderType.group,
        companyName: 'Acme',
        orderVATPercentage: 10,
        serviceFees: {},
        hasSpecificPCCFee: false,
        specificPCCFee: 0,
        orderStateHistory: [],
        partnerIds: [],
        orderDetail: {},
      }),
      getPublicData: () => ({}),
    }));

    await initiateTransaction({ orderId: ORDER_ID, planId: PLAN_ID });

    expect(trustedSdk.transactions.initiate).not.toHaveBeenCalled();
  });

  it('invokes getSubOrdersWithNoTxId to filter the plan orderDetail before initiating', async () => {
    const { getSubOrdersWithNoTxId } = jest.requireMock(
      '@pages/api/orders/utils',
    );
    setupDefaultMocks();

    await initiateTransaction({ orderId: ORDER_ID, planId: PLAN_ID });

    expect(getSubOrdersWithNoTxId).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Error handling — invalid planId throws
// ---------------------------------------------------------------------------

describe('validation — invalid planId is rejected before any SDK call', () => {
  it('throws when planId is not in the order plans array', async () => {
    const { getSubOrdersWithNoTxId, normalizeOrderDetail } = jest.requireMock(
      '@pages/api/orders/utils',
    );
    getSubOrdersWithNoTxId.mockReturnValue({});
    normalizeOrderDetail.mockReturnValue([]);

    const integrationSdk = makeIntegrationSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(integrationSdk);

    let callCount = 0;
    (denormalisedResponseEntities as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return [{ id: ORDER_ID, type: 'listing' }];
      if (callCount === 2) return [{ id: PLAN_ID, type: 'listing' }];

      return [];
    });

    // plans array does NOT include PLAN_ID
    (Listing as jest.Mock).mockImplementation(() => ({
      getId: () => ORDER_ID,
      getAttributes: () => ({ title: 'Test Order' }),
      getMetadata: () => ({
        companyId: 'company-1',
        deliveryHour: '11:30',
        plans: ['other-plan'], // PLAN_ID is absent
        orderType: EOrderType.group,
        companyName: 'Acme',
        orderVATPercentage: 10,
        serviceFees: {},
        hasSpecificPCCFee: false,
        specificPCCFee: 0,
        orderStateHistory: [],
        partnerIds: [],
        orderDetail: {},
      }),
      getPublicData: () => ({}),
    }));

    await expect(
      initiateTransaction({ orderId: ORDER_ID, planId: PLAN_ID }),
    ).rejects.toThrow(/Invalid planId/);
  });
});

// ---------------------------------------------------------------------------
// processAlias invariant — must match deployed process
// ---------------------------------------------------------------------------

describe('process alias — must match deployed Sharetribe process', () => {
  it('uses bookingProcessAlias from configs when initiating transactions', async () => {
    const { trustedSdk } = setupDefaultMocks();

    await initiateTransaction({ orderId: ORDER_ID, planId: PLAN_ID });

    const [firstCall] = trustedSdk.transactions.initiate.mock.calls;
    expect(firstCall[0].processAlias).toBe(
      'sub-order-transaction-process/release-2',
    );
  });
});
