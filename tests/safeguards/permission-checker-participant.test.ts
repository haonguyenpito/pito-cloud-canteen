/**
 * PARTICIPANT PERMISSION CHECKER SAFEGUARDS
 *
 * Guards the access control in src/services/permissionChecker/participant.ts.
 *
 * The participantChecker is a lightweight authentication guard:
 *   - SDK fails / throws                          → error propagated via handleError
 *   - denormalisedResponseEntities returns falsy  → 401
 *   - Any authenticated user (array returned)     → 200 (handler called)
 *
 * NOTE: Unlike partnerChecker, participantChecker has no role-specific check
 * beyond "user is authenticated". Any logged-in user passes through.
 * This is intentional — participant endpoints are open to all authenticated
 * Sharetribe users.
 *
 * Source: src/services/permissionChecker/participant.ts
 */

import type { NextApiRequest, NextApiResponse } from 'next';

import participantChecker from '@services/permissionChecker/participant';
import { getSdk, handleError } from '@services/sdk';
import { denormalisedResponseEntities } from '@src/utils/data';

jest.mock('@services/sdk', () => ({
  getSdk: jest.fn(),
  handleError: jest.fn(),
}));
jest.mock('@src/utils/data', () => ({
  denormalisedResponseEntities: jest.fn(),
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

const setupSdk = (currentUserResult: any) => {
  const mockSdk = {
    currentUser: { show: jest.fn().mockResolvedValue({}) },
  };
  (getSdk as jest.Mock).mockReturnValue(mockSdk);
  (denormalisedResponseEntities as jest.Mock).mockReturnValue(
    currentUserResult,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHandler.mockClear();
});

// ---------------------------------------------------------------------------
// Unauthenticated — falsy result returns 401
// ---------------------------------------------------------------------------

describe('unauthenticated — falsy currentUser returns 401', () => {
  it('returns 401 when denormalisedResponseEntities returns null', async () => {
    setupSdk(null);

    const req = mockReq();
    const res = mockRes();
    await participantChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('returns 401 when denormalisedResponseEntities returns undefined', async () => {
    setupSdk(undefined);

    const req = mockReq();
    const res = mockRes();
    await participantChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Authenticated — any non-falsy user passes through
// ---------------------------------------------------------------------------

describe('authenticated user — passes through regardless of role', () => {
  it('calls the handler when an array with a user is returned', async () => {
    setupSdk([{ id: 'user-1', attributes: { profile: {} } }]);

    const req = mockReq();
    const res = mockRes();
    await participantChecker(mockHandler)(req, res);

    expect(mockHandler).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through for all HTTP methods when authenticated', async () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    await Promise.all(
      methods.map(async (method) => {
        jest.clearAllMocks();
        mockHandler.mockClear();
        setupSdk([{ id: 'user-1' }]);

        const req = mockReq(method);
        const res = mockRes();
        await participantChecker(mockHandler)(req, res);

        expect(mockHandler).toHaveBeenCalled();
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling — SDK errors are forwarded via handleError
// ---------------------------------------------------------------------------

describe('SDK error — propagated via handleError', () => {
  it('calls handleError when sdk.currentUser.show throws', async () => {
    const sdkError = new Error('SDK unavailable');
    const mockSdk = {
      currentUser: { show: jest.fn().mockRejectedValue(sdkError) },
    };
    (getSdk as jest.Mock).mockReturnValue(mockSdk);

    const req = mockReq();
    const res = mockRes();
    await participantChecker(mockHandler)(req, res);

    expect(handleError).toHaveBeenCalledWith(res, sdkError);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
