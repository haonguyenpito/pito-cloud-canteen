/**
 * CONFIRM CLIENT PAYMENT — INTEGRATION SMOKE TESTS
 *
 * Covers the PUT handler for admin client payment confirmation. Tests guard
 * against double-confirmation, correct invocation of the payment service and
 * listing update, correct response shape on success, and error delegation.
 *
 * Source file: src/pages/api/admin/payment/confirm-client-payment.api.ts
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// ── Imports ───────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';

import handler from '@pages/api/admin/payment/confirm-client-payment.api';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/integrationSdk';
import { handleError } from '@services/sdk';
import { ensureListing, Listing } from '@src/utils/data';

import { updateClientRootPaymentRecord } from '../../src/pages/api/admin/payment/payment.service';

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

jest.mock('@services/integrationSdk', () => ({
  getIntegrationSdk: jest.fn(),
}));

jest.mock('@services/data', () => ({
  denormalisedResponseEntities: jest.fn(),
}));

jest.mock('../../src/pages/api/admin/payment/payment.service', () => ({
  updateClientRootPaymentRecord: jest.fn(),
}));

jest.mock('@services/sdk', () => ({
  handleError: jest.fn(),
}));

jest.mock('@src/utils/data', () => {
  const actual = jest.requireActual('@src/utils/data');

  return {
    ...actual,
    Listing: jest.fn(),
  };
});

// ── Typed aliases ──────────────────────────────────────────────────────────────

const mockGetIntegrationSdk = getIntegrationSdk as jest.Mock;
const mockDenormalisedResponseEntities =
  denormalisedResponseEntities as jest.Mock;
const mockUpdateClientRootPaymentRecord =
  updateClientRootPaymentRecord as jest.Mock;
const mockHandleError = handleError as jest.Mock;
const mockListing = Listing as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(body: object): NextApiRequest {
  return { method: 'PUT', body } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
}

const ORDER_ID = 'order-confirm-1';

const makeOrderFixture = (isAdminConfirmedClientPayment: boolean) =>
  ensureListing({
    id: { uuid: ORDER_ID },
    type: 'listing',
    attributes: {
      metadata: { isAdminConfirmedClientPayment },
    },
  });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/payment/confirm-client-payment', () => {
  let mockIntegrationSdk: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIntegrationSdk = {
      listings: {
        show: jest.fn(),
        update: jest.fn(),
      },
    };
    mockGetIntegrationSdk.mockReturnValue(mockIntegrationSdk);
    mockUpdateClientRootPaymentRecord.mockResolvedValue(undefined);
  });

  it('returns 400 if payment already confirmed', async () => {
    const orderFixture = makeOrderFixture(true);
    mockDenormalisedResponseEntities.mockReturnValue([orderFixture]);
    mockIntegrationSdk.listings.show.mockResolvedValue({ data: {} });
    mockListing.mockReturnValue({
      getMetadata: () => ({ isAdminConfirmedClientPayment: true }),
    });

    const req = makeReq({ orderId: ORDER_ID });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('calls updateClientRootPaymentRecord with isAdminConfirmed: true', async () => {
    const orderFixture = makeOrderFixture(false);
    const updatedFixture = makeOrderFixture(true);

    mockDenormalisedResponseEntities
      .mockReturnValueOnce([orderFixture])
      .mockReturnValueOnce([updatedFixture]);

    mockIntegrationSdk.listings.show.mockResolvedValue({ data: {} });
    mockIntegrationSdk.listings.update.mockResolvedValue({ data: {} });

    mockListing.mockReturnValue({
      getMetadata: () => ({ isAdminConfirmedClientPayment: false }),
    });

    const req = makeReq({ orderId: ORDER_ID });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockUpdateClientRootPaymentRecord).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      updateData: { isAdminConfirmed: true },
    });
  });

  it('updates the order listing to set isAdminConfirmedClientPayment: true', async () => {
    const orderFixture = makeOrderFixture(false);
    const updatedFixture = makeOrderFixture(true);

    mockDenormalisedResponseEntities
      .mockReturnValueOnce([orderFixture])
      .mockReturnValueOnce([updatedFixture]);

    mockIntegrationSdk.listings.show.mockResolvedValue({ data: {} });
    mockIntegrationSdk.listings.update.mockResolvedValue({ data: {} });

    mockListing.mockReturnValue({
      getMetadata: () => ({ isAdminConfirmedClientPayment: false }),
    });

    const req = makeReq({ orderId: ORDER_ID });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockIntegrationSdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ORDER_ID,
        metadata: expect.objectContaining({
          isAdminConfirmedClientPayment: true,
        }),
      }),
      expect.objectContaining({ expand: true }),
    );
  });

  it('returns 200 with updated order on success', async () => {
    const orderFixture = makeOrderFixture(false);
    const updatedFixture = makeOrderFixture(true);

    mockDenormalisedResponseEntities
      .mockReturnValueOnce([orderFixture])
      .mockReturnValueOnce([updatedFixture]);

    mockIntegrationSdk.listings.show.mockResolvedValue({ data: {} });
    mockIntegrationSdk.listings.update.mockResolvedValue({ data: {} });

    mockListing.mockReturnValue({
      getMetadata: () => ({ isAdminConfirmedClientPayment: false }),
    });

    const req = makeReq({ orderId: ORDER_ID });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Successfully confirm client payment',
      }),
    );
  });

  it('calls handleError on Sharetribe SDK failure', async () => {
    mockIntegrationSdk.listings.show.mockRejectedValue(new Error('SDK error'));

    const req = makeReq({ orderId: ORDER_ID });
    const res = makeRes();

    await handler(req, res as NextApiResponse);

    expect(mockHandleError).toHaveBeenCalledWith(res, expect.any(Error));
  });
});
