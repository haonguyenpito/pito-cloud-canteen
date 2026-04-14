/**
 * PARTNER PERMISSION CHECKER SAFEGUARDS
 *
 * Guards the role-based access control in src/services/permissionChecker/partner.ts.
 *
 * Permission matrix enforced by partnerChecker middleware:
 *
 *   - No currentUser returned by SDK   → 401
 *   - currentUser.metadata.isPartner missing / false → 403
 *   - currentUser.metadata.isPartner === true         → 200 (handler called)
 *
 * Source: src/services/permissionChecker/partner.ts
 */

import type { NextApiRequest, NextApiResponse } from 'next';

import partnerChecker from '@services/permissionChecker/partner';
import { getSdk } from '@services/sdk';
import { CurrentUser, denormalisedResponseEntities } from '@src/utils/data';

jest.mock('@services/sdk', () => ({
  getSdk: jest.fn(),
  handleError: jest.fn(),
}));
jest.mock('@src/utils/data', () => ({
  denormalisedResponseEntities: jest.fn(),
  CurrentUser: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockReq = (method = 'GET'): NextApiRequest =>
  ({ method, body: {}, query: {} } as unknown as NextApiRequest);

const mockRes = (): NextApiResponse => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse;

  return res;
};

const mockHandler = jest.fn().mockResolvedValue(undefined);

const setupMocks = ({
  currentUser,
  isPartner,
}: {
  currentUser: any;
  isPartner: boolean;
}) => {
  const mockSdk = {
    currentUser: { show: jest.fn().mockResolvedValue({}) },
  };
  (getSdk as jest.Mock).mockReturnValue(mockSdk);
  (denormalisedResponseEntities as jest.Mock).mockReturnValue(
    currentUser ? [currentUser] : [undefined],
  );
  (CurrentUser as jest.Mock).mockReturnValue({
    getMetadata: () => ({ isPartner }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHandler.mockClear();
});

// ---------------------------------------------------------------------------
// No currentUser → 401
// ---------------------------------------------------------------------------

describe('unauthenticated — no currentUser returns 401', () => {
  it('returns 401 when denormalisedResponseEntities returns [undefined]', async () => {
    const mockSdk = {
      currentUser: { show: jest.fn().mockResolvedValue({}) },
    };
    (getSdk as jest.Mock).mockReturnValue(mockSdk);
    (denormalisedResponseEntities as jest.Mock).mockReturnValue([undefined]);
    (CurrentUser as jest.Mock).mockReturnValue({
      getMetadata: () => ({ isPartner: false }),
    });

    const req = mockReq();
    const res = mockRes();
    await partnerChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// isPartner === false → 403
// ---------------------------------------------------------------------------

describe('non-partner user — isPartner false returns 403', () => {
  it('returns 403 when isPartner is false', async () => {
    setupMocks({ currentUser: { id: 'user-1' }, isPartner: false });

    const req = mockReq();
    const res = mockRes();
    await partnerChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('returns 403 when isPartner metadata key is missing (defaults to false)', async () => {
    const mockSdk = {
      currentUser: { show: jest.fn().mockResolvedValue({}) },
    };
    (getSdk as jest.Mock).mockReturnValue(mockSdk);
    (denormalisedResponseEntities as jest.Mock).mockReturnValue([
      { id: 'user-1' },
    ]);
    (CurrentUser as jest.Mock).mockReturnValue({
      getMetadata: () => ({}), // isPartner not set
    });

    const req = mockReq();
    const res = mockRes();
    await partnerChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// isPartner === true → handler called
// ---------------------------------------------------------------------------

describe('partner user — isPartner true passes through', () => {
  it('calls the handler when isPartner is true', async () => {
    setupMocks({ currentUser: { id: 'partner-1' }, isPartner: true });

    const req = mockReq();
    const res = mockRes();
    await partnerChecker(mockHandler)(req, res);

    expect(mockHandler).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through for all HTTP methods when isPartner is true', async () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    await Promise.all(
      methods.map(async (method) => {
        jest.clearAllMocks();
        mockHandler.mockClear();
        setupMocks({ currentUser: { id: 'partner-1' }, isPartner: true });

        const req = mockReq(method);
        const res = mockRes();
        await partnerChecker(mockHandler)(req, res);

        expect(mockHandler).toHaveBeenCalled();
      }),
    );
  });
});
