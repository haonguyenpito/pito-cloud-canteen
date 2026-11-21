/**
 * PARTICIPANT FOOD SELECTION — INTEGRATION SMOKE TESTS
 *
 * Covers the POST case of the participant orders API handler, which enqueues
 * the pick for processOrder.job. The key concern is that
 * enqueueParticipantOrder receives the correct payload (including the resolved
 * currentUserId) and that the response echoes the resulting job ID.
 *
 * Source file: src/pages/api/participants/orders/[orderId]/index.api.ts
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// ── Imports ───────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';

import { getParticipantPickClosedReason } from '@helpers/orderHelper';
import handler from '@pages/api/participants/orders/[orderId]/index.api';
import { enqueueParticipantOrder } from '@services/jobs/processOrder.job';
import { getSdk, handleError } from '@services/sdk';
import { CurrentUser, denormalisedResponseEntities } from '@utils/data';

jest.mock('@services/jobs/processOrder.job', () => ({
  enqueueParticipantOrder: jest.fn(),
}));

jest.mock('@services/sdk', () => ({
  getSdk: jest.fn(),
  getIntegrationSdk: jest.fn(),
  handleError: jest.fn(),
}));

jest.mock('@services/integrationHelper', () => ({
  fetchListing: jest.fn(),
  fetchUserListing: jest.fn(),
}));

jest.mock('@services/cookie', () => ({
  __esModule: true,
  default: jest.fn((fn: unknown) => fn),
}));

jest.mock('@services/slackNotification', () => ({
  createSlackNotification: jest.fn(),
}));

jest.mock('@services/data', () => ({
  denormalisedResponseEntities: jest.fn(),
}));

jest.mock('@utils/data', () => ({
  denormalisedResponseEntities: jest.fn(),
  CurrentUser: jest.fn(),
  Listing: jest.fn(),
}));

jest.mock('@helpers/orderHelper', () => ({
  getParticipantPickClosedReason: jest.fn(),
}));

// ── Typed aliases ──────────────────────────────────────────────────────────────

const mockEnqueueParticipantOrder = enqueueParticipantOrder as jest.Mock;
const mockGetSdk = getSdk as jest.Mock;
const mockHandleError = handleError as jest.Mock;
const mockDenormalisedResponseEntities =
  denormalisedResponseEntities as jest.Mock;
const mockCurrentUser = CurrentUser as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(query: object, body: object): NextApiRequest {
  return { method: 'POST', query, body } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
}

const FAKE_USER_ENTITY = {
  id: { uuid: 'user-123' },
  type: 'currentUser',
  attributes: {},
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/participants/orders/[orderId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock sdk.currentUser.show() returning a fake SDK response
    const mockSdk = {
      currentUser: {
        show: jest.fn().mockResolvedValue({ data: {} }),
      },
    };
    mockGetSdk.mockReturnValue(mockSdk);

    // denormalisedResponseEntities unwraps the SDK response to entity array
    mockDenormalisedResponseEntities.mockReturnValue([FAKE_USER_ENTITY]);

    // CurrentUser().getId() reads user.id?.uuid
    mockCurrentUser.mockReturnValue({
      getId: () => 'user-123',
    });

    // Order open for picking unless a test says otherwise.
    (getParticipantPickClosedReason as jest.Mock).mockReturnValue(null);
  });

  it('queues the pick with the resolved currentUserId', async () => {
    mockEnqueueParticipantOrder.mockResolvedValue({
      jobId: 'job-123',
      submissionId: 'sub-123',
    });

    const req = makeReq(
      { orderId: 'order-abc' },
      {
        planId: 'plan-xyz',
        memberOrders: { 'user-1': 'food-1' },
        orderDay: 1,
        orderDays: [1],
        planData: {},
      },
    );
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockEnqueueParticipantOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-abc',
        planId: 'plan-xyz',
        currentUserId: 'user-123',
      }),
    );
  });

  it('responds with the jobId and submissionId the UI waits on', async () => {
    mockEnqueueParticipantOrder.mockResolvedValue({
      jobId: 'job-123',
      submissionId: 'sub-123',
    });

    const req = makeReq(
      { orderId: 'order-abc' },
      {
        planId: 'plan-xyz',
        memberOrders: {},
        orderDay: 1,
        orderDays: [],
        planData: {},
      },
    );
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Job queued',
      jobId: 'job-123',
      submissionId: 'sub-123',
    });
  });

  it('calls handleError when enqueueParticipantOrder throws', async () => {
    mockEnqueueParticipantOrder.mockRejectedValue(new Error('queue full'));

    const req = makeReq(
      { orderId: 'order-abc' },
      {
        planId: 'plan-xyz',
        memberOrders: {},
        orderDay: 1,
        orderDays: [],
        planData: {},
      },
    );
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockHandleError).toHaveBeenCalledWith(res, expect.any(Error));
  });

  it('refuses with 400 and queues nothing once picking is closed', async () => {
    (getParticipantPickClosedReason as jest.Mock).mockReturnValue(
      'Food selection deadline has passed',
    );
    const req = makeReq(
      { orderId: 'order-abc' },
      { planId: 'plan-xyz', orderDays: [1], planData: {} },
    );
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Food selection deadline has passed',
    });
    expect(mockEnqueueParticipantOrder).not.toHaveBeenCalled();
  });
});
