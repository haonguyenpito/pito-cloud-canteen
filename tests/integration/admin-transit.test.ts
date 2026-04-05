/**
 * ADMIN TRANSIT — INTEGRATION SMOKE TESTS
 *
 * Covers the POST handler for the admin sub-order state machine transit hub.
 * Tests focus on input validation guards (missing txId, missing transition,
 * invalid transition value) and one happy-path scenario verifying that the SDK
 * transition call is made with the correct params and that the plan listing is
 * always updated at the end.
 *
 * Source file: src/pages/api/admin/plan/transit.api.ts
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// ── Imports ───────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';

import handler from '@pages/api/admin/plan/transit.api';
import { fetchListing, fetchUser } from '@services/integrationHelper';
import { getIntegrationSdk, handleError } from '@services/sdk';
import {
  denormalisedResponseEntities,
  Listing,
  Transaction,
} from '@src/utils/data';

jest.mock('@apis/configs', () => ({
  composeApiCheckers: jest.fn(
    (..._checkers: any[]) =>
      (h: any) =>
        h,
  ),
  HttpMethod: { PUT: 'PUT', POST: 'POST', GET: 'GET' },
}));

jest.mock('@services/permissionChecker/admin', () =>
  jest.fn().mockReturnValue((h: any) => h),
);

jest.mock('@services/integrationHelper', () => ({
  fetchListing: jest.fn(),
  fetchUser: jest.fn(),
}));

jest.mock('@services/sdk', () => ({
  getIntegrationSdk: jest.fn(),
  handleError: jest.fn(),
}));

jest.mock('@services/notifications', () => ({
  createFirebaseDocNotification: jest.fn(),
}));

jest.mock('@services/nativeNotification', () => ({
  createNativeNotification: jest.fn(),
  createNativeNotificationToBooker: jest.fn(),
}));

jest.mock('@services/email', () => ({
  emailSendingFactory: jest.fn(),
  EmailTemplateTypes: {
    BOOKER: { BOOKER_SUB_ORDER_CANCELED: 'b_cancel' },
    PARTICIPANT: { PARTICIPANT_SUB_ORDER_CANCELED: 'p_cancel' },
    PARTNER: { PARTNER_SUB_ORDER_CANCELED: 'partner_cancel' },
  },
}));

jest.mock('@services/slackNotification', () => ({
  createSlackNotification: jest.fn(),
}));

jest.mock('@services/awsEventBrigdeScheduler', () => ({
  createFoodRatingNotificationScheduler: jest.fn(),
}));

jest.mock(
  '../../src/pages/api/admin/plan/transition-order-status.service',
  () => ({
    transitionOrderStatus: jest.fn().mockResolvedValue(undefined),
  }),
);

jest.mock(
  '../../src/pages/api/admin/payment/modify-payment-when-cancel-sub-order.service',
  () => ({
    modifyPaymentWhenCancelSubOrderService: jest
      .fn()
      .mockResolvedValue(undefined),
  }),
);

jest.mock(
  '@pages/api/orders/[orderId]/quotation/create-quotation.service',
  () => jest.fn().mockResolvedValue(undefined),
);

jest.mock('@helpers/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@helpers/dateHelpers', () => ({
  convertDateToVNTimezone: jest.fn().mockReturnValue('2024-03-15T00:00:00'),
}));

jest.mock('@pages/api/helpers/pushNotificationOrderDetailHelper', () => ({
  pushNativeNotificationSubOrderDate: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@src/utils/data', () => {
  const actual = jest.requireActual('@src/utils/data');

  return {
    ...actual,
    Transaction: jest.fn().mockReturnValue({
      getMetadata: () => ({
        participantIds: ['user-1'],
        orderId: 'order-1',
        anonymous: [],
      }),
      getFullData: () => ({
        booking: {
          // 2024-03-14T17:00:00Z = 2024-03-15T00:00:00+07:00 (VN midnight)
          // DateTime.fromMillis(ts).setZone(VN).startOf('day').toMillis() = 1710435600000
          attributes: { displayStart: new Date('2024-03-14T17:00:00.000Z') },
        },
        listing: {
          id: { uuid: 'restaurant-1' },
          attributes: { metadata: {}, publicData: {} },
        },
      }),
      getId: () => 'tx-123',
    }),
    denormalisedResponseEntities: jest.fn().mockReturnValue([{}]),
    Listing: jest.fn().mockReturnValue({
      getId: () => 'listing-id',
      getMetadata: () => ({
        plans: ['plan-1'],
        quotationId: 'quotation-1',
        companyId: 'company-1',
        bookerId: 'booker-1',
        orderDetail: {
          // 2024-03-15 VN midnight in millis
          1710435600000: {
            memberOrders: {},
            restaurant: { foodList: {} },
            lastTransition: 'transition/initiate-transaction',
          },
        },
        slackThreadTs: 'ts-001',
        client: { quotation: {} },
        partner: { 'restaurant-1': { quotation: {} } },
      }),
      getAttributes: () => ({
        title: 'Test Order',
        publicData: { orderName: 'Test Order Name' },
      }),
      getPublicData: () => ({ orderName: 'Test Order Name' }),
    }),
  };
});

// ── Typed aliases ──────────────────────────────────────────────────────────────

const mockGetIntegrationSdk = getIntegrationSdk as jest.Mock;
const mockHandleError = handleError as jest.Mock;
const mockFetchListing = fetchListing as jest.Mock;
const mockFetchUser = fetchUser as jest.Mock;
const mockTransaction = Transaction as jest.Mock;
const mockListing = Listing as jest.Mock;
const mockDenormalisedResponseEntities =
  denormalisedResponseEntities as jest.Mock;

const LISTING_MOCK_RETURN = {
  getId: () => 'listing-id',
  getMetadata: () => ({
    plans: ['plan-1'],
    quotationId: 'quotation-1',
    companyId: 'company-1',
    bookerId: 'booker-1',
    orderDetail: {
      // 2024-03-15 VN midnight in millis
      1710435600000: {
        memberOrders: {},
        restaurant: { foodList: {} },
        lastTransition: 'transition/initiate-transaction',
      },
    },
    slackThreadTs: 'ts-001',
    client: { quotation: {} },
    partner: { 'restaurant-1': { quotation: {} } },
  }),
  getAttributes: () => ({
    title: 'Test Order',
    publicData: { orderName: 'Test Order Name' },
  }),
  getPublicData: () => ({ orderName: 'Test Order Name' }),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(body: object): NextApiRequest {
  return { method: 'POST', body } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/plan/transit', () => {
  let mockIntegrationSdk: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Restore mock implementations cleared by clearAllMocks
    mockDenormalisedResponseEntities.mockReturnValue([{}]);
    mockTransaction.mockReturnValue({
      getMetadata: () => ({
        participantIds: ['user-1'],
        orderId: 'order-1',
        anonymous: [],
      }),
      getFullData: () => ({
        booking: {
          // 2024-03-14T17:00:00Z = 2024-03-15T00:00:00+07:00 (VN midnight)
          attributes: { displayStart: new Date('2024-03-14T17:00:00.000Z') },
        },
        listing: {
          id: { uuid: 'restaurant-1' },
          attributes: { metadata: {}, publicData: {} },
        },
      }),
      getId: () => 'tx-123',
    });
    mockListing.mockReturnValue(LISTING_MOCK_RETURN);

    mockIntegrationSdk = {
      transactions: {
        transition: jest.fn(),
      },
      listings: {
        query: jest.fn().mockResolvedValue({ data: { data: [] } }),
        update: jest.fn().mockResolvedValue({ data: {} }),
      },
    };
    mockGetIntegrationSdk.mockReturnValue(mockIntegrationSdk);

    // fetchListing returns a minimal order/plan object
    mockFetchListing.mockResolvedValue({
      id: { uuid: 'listing-id' },
      type: 'listing',
      attributes: {
        title: 'Test Order',
        metadata: {
          plans: ['plan-1'],
          quotationId: 'quotation-1',
          companyId: 'company-1',
          bookerId: 'booker-1',
          orderDetail: {
            // 2024-03-15 VN midnight in millis (matches Transaction mock)
            1710435600000: {
              memberOrders: {},
              restaurant: { foodList: {} },
              lastTransition: 'transition/initiate-transaction',
            },
          },
          slackThreadTs: 'ts-001',
          client: { quotation: {} },
          partner: { 'restaurant-1': { quotation: {} } },
        },
        publicData: { orderName: 'Test Order Name' },
      },
    });

    mockFetchUser.mockResolvedValue({
      id: { uuid: 'booker-1' },
      type: 'user',
      attributes: { profile: {} },
    });

    // handleError does not throw by default so handler can return normally
    mockHandleError.mockImplementation(() => undefined);
  });

  it('calls handleError with 400 when txId is missing', async () => {
    const req = makeReq({ transition: 'transition/complete-delivery' });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockHandleError).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ status: 400 }),
    );
  });

  it('calls handleError with 400 when transition is missing', async () => {
    const req = makeReq({ txId: 'tx-123' });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockHandleError).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ status: 400 }),
    );
  });

  it('calls handleError with 400 when transition is not a valid ETransition value', async () => {
    const req = makeReq({ txId: 'tx-123', transition: 'invalid/transition' });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockHandleError).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ status: 400 }),
    );
  });

  it('calls integrationSdk.transactions.transition with correct txId and transition', async () => {
    mockIntegrationSdk.transactions.transition.mockResolvedValue({
      data: {
        data: {
          id: { uuid: 'tx-123' },
          type: 'transaction',
          attributes: {
            metadata: {},
            lastTransition: 'transition/start-delivery',
          },
          relationships: {
            booking: { data: { id: { uuid: 'booking-1' }, type: 'booking' } },
            listing: {
              data: { id: { uuid: 'restaurant-1' }, type: 'listing' },
            },
            provider: { data: { id: { uuid: 'provider-1' }, type: 'user' } },
          },
        },
        included: [
          {
            id: { uuid: 'booking-1' },
            type: 'booking',
            attributes: { displayStart: new Date('2024-03-15T00:00:00.000Z') },
          },
          {
            id: { uuid: 'restaurant-1' },
            type: 'listing',
            attributes: { metadata: {}, publicData: {} },
          },
          {
            id: { uuid: 'provider-1' },
            type: 'user',
            attributes: {},
          },
        ],
      },
    });

    const req = makeReq({
      txId: 'tx-123',
      transition: 'transition/start-delivery',
    });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockIntegrationSdk.transactions.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-123',
        transition: 'transition/start-delivery',
      }),
      expect.objectContaining({ expand: true }),
    );
  });

  it('always calls listings.update (updatePlanListing) after successful transition', async () => {
    mockIntegrationSdk.transactions.transition.mockResolvedValue({
      data: {
        data: {
          id: { uuid: 'tx-123' },
          type: 'transaction',
          attributes: {
            metadata: {},
            lastTransition: 'transition/start-delivery',
          },
          relationships: {
            booking: { data: { id: { uuid: 'booking-1' }, type: 'booking' } },
            listing: {
              data: { id: { uuid: 'restaurant-1' }, type: 'listing' },
            },
            provider: { data: { id: { uuid: 'provider-1' }, type: 'user' } },
          },
        },
        included: [
          {
            id: { uuid: 'booking-1' },
            type: 'booking',
            attributes: { displayStart: new Date('2024-03-15T00:00:00.000Z') },
          },
          {
            id: { uuid: 'restaurant-1' },
            type: 'listing',
            attributes: { metadata: {}, publicData: {} },
          },
          {
            id: { uuid: 'provider-1' },
            type: 'user',
            attributes: {},
          },
        ],
      },
    });

    const req = makeReq({
      txId: 'tx-123',
      transition: 'transition/start-delivery',
    });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    // updatePlanListing always calls integrationSdk.listings.update at the end
    expect(mockIntegrationSdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ orderDetail: expect.any(Object) }),
      }),
    );
  });
});
