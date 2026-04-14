/**
 * ORDER PERMISSION CHECKER SAFEGUARDS
 *
 * Protects the role-based access control for order-related API endpoints.
 *
 * Permission matrix enforced by orderChecker middleware:
 *
 * POST (create order):
 *   - Missing companyId         → 403
 *   - booker/owner + not admin  → 403   (CompanyPermissions blocks creation)
 *   - participant/accountant    → 200   (allowed to create)
 *   - no permission set         → 200   (no restriction)
 *   - admin overrides all       → 200
 *
 * PUT (update order):
 *   - Missing orderId           → 403
 *   - participant/accountant + not admin → 403  (not in CompanyPermissions)
 *   - booker/owner              → 200   (in CompanyPermissions)
 *   - no permission set         → 200   (no restriction)
 *   - admin overrides all       → 200
 *
 * Source: src/services/permissionChecker/order.ts
 */

import type { NextApiRequest, NextApiResponse } from 'next';

import { fetchListing } from '@services/integrationHelper';
import orderChecker from '@services/permissionChecker/order';
import { getSdk } from '@services/sdk';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@utils/data';
import { ECompanyPermission } from '@utils/enums';

// Explicit factories — avoids transitive import issues and makes test intent clear
jest.mock('@services/sdk', () => ({
  getSdk: jest.fn(),
  handleError: jest.fn(),
}));
jest.mock('@services/integrationHelper', () => ({
  fetchListing: jest.fn(),
}));
jest.mock('@utils/data', () => ({
  denormalisedResponseEntities: jest.fn(),
  CurrentUser: jest.fn(),
  Listing: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockReq = (
  method: string,
  body: Record<string, any> = {},
): NextApiRequest => ({ method, body } as NextApiRequest);

const mockRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse;

  return res;
};

const mockHandler = jest.fn().mockResolvedValue(undefined);

const setupMocks = ({
  isAdmin,
  companyPermissions,
  clientId,
}: {
  isAdmin: boolean;
  companyPermissions: Record<string, { permission: ECompanyPermission }>;
  clientId?: string;
}) => {
  const mockSdk = {
    currentUser: { show: jest.fn().mockResolvedValue({}) },
  };
  (getSdk as jest.Mock).mockReturnValue(mockSdk);
  // denormalisedResponseEntities returns a dummy object — CurrentUser mock reads it
  (denormalisedResponseEntities as jest.Mock).mockReturnValue([{}]);
  (CurrentUser as jest.Mock).mockReturnValue({
    getMetadata: () => ({
      isAdmin,
      company: companyPermissions,
    }),
  });
  if (clientId !== undefined) {
    (fetchListing as jest.Mock).mockResolvedValue({});
    (Listing as jest.Mock).mockReturnValue({
      getMetadata: () => ({ clientId }),
    });
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHandler.mockClear();
});

// ---------------------------------------------------------------------------
// POST — missing companyId always returns 403
// ---------------------------------------------------------------------------

describe('POST — missing companyId', () => {
  it('returns 403 when companyId is missing from body', async () => {
    setupMocks({ isAdmin: false, companyPermissions: {} });

    const req = mockReq('POST', {}); // no companyId
    const res = mockRes();
    await orderChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST — booker and owner are blocked (CompanyPermissions)
// ---------------------------------------------------------------------------

describe('POST — booker and owner are blocked without admin', () => {
  const blockedRoles = [ECompanyPermission.booker, ECompanyPermission.owner];

  blockedRoles.forEach((role) => {
    it(`blocks ${role} from creating an order`, async () => {
      setupMocks({
        isAdmin: false,
        companyPermissions: { 'company-1': { permission: role } },
      });

      const req = mockReq('POST', { companyId: 'company-1' });
      const res = mockRes();
      await orderChecker(mockHandler)(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it(`admin overrides ${role} block on POST`, async () => {
      setupMocks({
        isAdmin: true,
        companyPermissions: { 'company-1': { permission: role } },
      });

      const req = mockReq('POST', { companyId: 'company-1' });
      const res = mockRes();
      await orderChecker(mockHandler)(req, res);

      expect(mockHandler).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// POST — participant and accountant are allowed
// ---------------------------------------------------------------------------

describe('POST — participant and accountant can create orders', () => {
  const allowedRoles = [
    ECompanyPermission.participant,
    ECompanyPermission.accountant,
  ];

  allowedRoles.forEach((role) => {
    it(`allows ${role} to create an order`, async () => {
      setupMocks({
        isAdmin: false,
        companyPermissions: { 'company-1': { permission: role } },
      });

      const req = mockReq('POST', { companyId: 'company-1' });
      const res = mockRes();
      await orderChecker(mockHandler)(req, res);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  it('allows user with no company permission to create an order', async () => {
    setupMocks({ isAdmin: false, companyPermissions: {} });

    const req = mockReq('POST', { companyId: 'company-1' });
    const res = mockRes();
    await orderChecker(mockHandler)(req, res);

    expect(mockHandler).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PUT — missing orderId always returns 403
// ---------------------------------------------------------------------------

describe('PUT — missing orderId', () => {
  it('returns 403 when orderId is missing from body', async () => {
    setupMocks({ isAdmin: false, companyPermissions: {} });

    const req = mockReq('PUT', {}); // no orderId
    const res = mockRes();
    await orderChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PUT — participant and accountant are blocked (not in CompanyPermissions)
// ---------------------------------------------------------------------------

describe('PUT — participant and accountant cannot update orders', () => {
  const blockedRoles = [
    ECompanyPermission.participant,
    ECompanyPermission.accountant,
  ];

  blockedRoles.forEach((role) => {
    it(`blocks ${role} from updating an order`, async () => {
      setupMocks({
        isAdmin: false,
        companyPermissions: { 'company-1': { permission: role } },
        clientId: 'company-1',
      });

      const req = mockReq('PUT', { orderId: 'order-1' });
      const res = mockRes();
      await orderChecker(mockHandler)(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it(`admin overrides ${role} block on PUT`, async () => {
      setupMocks({
        isAdmin: true,
        companyPermissions: { 'company-1': { permission: role } },
        clientId: 'company-1',
      });

      const req = mockReq('PUT', { orderId: 'order-1' });
      const res = mockRes();
      await orderChecker(mockHandler)(req, res);

      expect(mockHandler).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// PUT — booker and owner are allowed to update
// ---------------------------------------------------------------------------

describe('PUT — booker and owner can update orders', () => {
  const allowedRoles = [ECompanyPermission.booker, ECompanyPermission.owner];

  allowedRoles.forEach((role) => {
    it(`allows ${role} to update an order`, async () => {
      setupMocks({
        isAdmin: false,
        companyPermissions: { 'company-1': { permission: role } },
        clientId: 'company-1',
      });

      const req = mockReq('PUT', { orderId: 'order-1' });
      const res = mockRes();
      await orderChecker(mockHandler)(req, res);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  it('allows user with no permission entry to update (no restriction when no permission set)', async () => {
    setupMocks({
      isAdmin: false,
      companyPermissions: {}, // no company entry
      clientId: 'company-1',
    });

    const req = mockReq('PUT', { orderId: 'order-1' });
    const res = mockRes();
    await orderChecker(mockHandler)(req, res);

    expect(mockHandler).toHaveBeenCalled();
  });
});
