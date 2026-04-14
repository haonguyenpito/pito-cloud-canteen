/**
 * START ORDER — INTEGRATION SMOKE TESTS
 *
 * Covers the PUT handler for starting an order, which calls startOrder then
 * initiateTransaction in sequence. Guards against missing query params returning
 * 400, correct sequencing of service calls, and error delegation to handleError.
 *
 * Source file: src/pages/api/orders/[orderId]/plan/[planId]/start-order.api.ts
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// ── Imports ───────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';

import handler from '@pages/api/orders/[orderId]/plan/[planId]/start-order.api';
import { handleError } from '@services/sdk';

import { initiateTransaction } from '../../src/pages/api/orders/[orderId]/plan/[planId]/initiate-transaction.service';
import { startOrder } from '../../src/pages/api/orders/[orderId]/start-order.service';

jest.mock('../../src/pages/api/orders/[orderId]/start-order.service', () => ({
  startOrder: jest.fn(),
}));

jest.mock(
  '../../src/pages/api/orders/[orderId]/plan/[planId]/initiate-transaction.service',
  () => ({
    initiateTransaction: jest.fn(),
  }),
);

jest.mock('@services/sdk', () => ({
  handleError: jest.fn(),
}));

jest.mock('@helpers/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// ── Typed aliases ──────────────────────────────────────────────────────────────

const mockStartOrder = startOrder as jest.Mock;
const mockInitiateTransaction = initiateTransaction as jest.Mock;
const mockHandleError = handleError as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(query: object): NextApiRequest {
  return { method: 'PUT', query } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PUT /api/orders/[orderId]/plan/[planId]/start-order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartOrder.mockResolvedValue(undefined);
    mockInitiateTransaction.mockResolvedValue(undefined);
  });

  it('returns 400 when orderId is missing', async () => {
    const req = makeReq({ orderId: '', planId: 'plan-1' });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('returns 400 when planId is missing', async () => {
    const req = makeReq({ orderId: 'order-1', planId: '' });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('calls startOrder then initiateTransaction in sequence and returns 200', async () => {
    const callOrder: string[] = [];
    mockStartOrder.mockImplementation(async () => {
      callOrder.push('startOrder');
    });
    mockInitiateTransaction.mockImplementation(async () => {
      callOrder.push('initiateTransaction');
    });

    const req = makeReq({ orderId: 'order-1', planId: 'plan-1' });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(callOrder).toEqual(['startOrder', 'initiateTransaction']);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Successfully finish picking order' }),
    );
  });

  it('calls handleError when startOrder throws', async () => {
    mockStartOrder.mockRejectedValue(new Error('not picking'));

    const req = makeReq({ orderId: 'order-1', planId: 'plan-1' });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockHandleError).toHaveBeenCalledWith(res, expect.any(Error));
    expect(mockInitiateTransaction).not.toHaveBeenCalled();
  });

  it('calls handleError when initiateTransaction throws', async () => {
    mockInitiateTransaction.mockRejectedValue(new Error('tx failed'));

    const req = makeReq({ orderId: 'order-1', planId: 'plan-1' });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockHandleError).toHaveBeenCalledWith(res, expect.any(Error));
  });
});
