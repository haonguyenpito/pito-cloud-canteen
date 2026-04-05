/**
 * COMPANY PERMISSION CHECKER SAFEGUARDS
 *
 * Guards the role-based access control in src/services/permissionChecker/company.ts.
 *
 * Permission matrix enforced by companyChecker middleware:
 *
 * Write methods (POST / PUT / DELETE):
 *   - Missing companyId (query + body)       → 403
 *   - Permission not in CompanyPermissions   → 403
 *   - Permission in CompanyPermissions
 *     (booker / owner)                       → 200 (handler called)
 *   - No permission set for companyId        → 403
 *
 * Read methods (GET / PATCH — not in needCheckingRequestBodyMethod):
 *   - companyId resolved from companyList[0] → proceeds to permission check
 *   - Valid permission                       → 200
 *   - Invalid permission                     → 403
 *
 * Source: src/services/permissionChecker/company.ts
 */

import type { NextApiRequest, NextApiResponse } from 'next';

import companyChecker from '@services/permissionChecker/company';
import { getSdk } from '@services/sdk';
import { denormalisedResponseEntities } from '@utils/data';
import { ECompanyPermission } from '@utils/enums';

jest.mock('@services/sdk', () => ({
  getSdk: jest.fn(),
  handleError: jest.fn(),
}));
jest.mock('@utils/data', () => ({
  denormalisedResponseEntities: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockReq = (
  method: string,
  {
    body = {},
    query = {},
  }: { body?: Record<string, any>; query?: Record<string, any> } = {},
): NextApiRequest => ({ method, body, query } as unknown as NextApiRequest);

const mockRes = (): NextApiResponse => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse;

  return res;
};

const mockHandler = jest.fn().mockResolvedValue(undefined);

const setupCurrentUser = ({
  companyId,
  permission,
  companyList = [],
}: {
  companyId?: string;
  permission?: ECompanyPermission;
  companyList?: string[];
}) => {
  const mockSdk = {
    currentUser: { show: jest.fn().mockResolvedValue({}) },
  };
  (getSdk as jest.Mock).mockReturnValue(mockSdk);

  const company: Record<string, { permission: ECompanyPermission }> = {};
  if (companyId && permission) {
    company[companyId] = { permission };
  }

  (denormalisedResponseEntities as jest.Mock).mockReturnValue([
    {
      attributes: {
        profile: {
          metadata: { company, companyList },
        },
      },
    },
  ]);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHandler.mockClear();
});

// ---------------------------------------------------------------------------
// Write methods — missing companyId
// ---------------------------------------------------------------------------

describe('POST/PUT/DELETE — missing companyId returns 403', () => {
  ['POST', 'PUT', 'DELETE'].forEach((method) => {
    it(`${method} with no companyId in body or query → 403`, async () => {
      setupCurrentUser({ companyList: [] });

      const req = mockReq(method, { body: {}, query: {} });
      const res = mockRes();
      await companyChecker(mockHandler)(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Write methods — valid permission (booker / owner)
// ---------------------------------------------------------------------------

describe('POST/PUT/DELETE — booker and owner are allowed', () => {
  const allowedRoles = [ECompanyPermission.booker, ECompanyPermission.owner];

  ['POST', 'PUT', 'DELETE'].forEach((method) => {
    allowedRoles.forEach((role) => {
      it(`${method} with role ${role} → handler called`, async () => {
        setupCurrentUser({ companyId: 'co-1', permission: role });

        const req = mockReq(method, { body: { companyId: 'co-1' } });
        const res = mockRes();
        await companyChecker(mockHandler)(req, res);

        expect(mockHandler).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalledWith(403);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Write methods — invalid permission (participant / accountant)
// ---------------------------------------------------------------------------

describe('POST/PUT/DELETE — participant and accountant are blocked', () => {
  const blockedRoles = [
    ECompanyPermission.participant,
    ECompanyPermission.accountant,
  ];

  ['POST', 'PUT', 'DELETE'].forEach((method) => {
    blockedRoles.forEach((role) => {
      it(`${method} with role ${role} → 403`, async () => {
        setupCurrentUser({ companyId: 'co-1', permission: role });

        const req = mockReq(method, { body: { companyId: 'co-1' } });
        const res = mockRes();
        await companyChecker(mockHandler)(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Write methods — no permission entry for the companyId
// ---------------------------------------------------------------------------

describe('POST/PUT/DELETE — no permission set → 403', () => {
  it('blocks POST when user has no permission entry for the given companyId', async () => {
    // company map is empty — no entry for 'co-unknown'
    setupCurrentUser({ companyList: [] });

    const req = mockReq('POST', { body: { companyId: 'co-unknown' } });
    const res = mockRes();
    await companyChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// companyId resolution — query takes precedence over body
// ---------------------------------------------------------------------------

describe('companyId resolution — query.companyId takes precedence', () => {
  it('resolves companyId from query when both query and body are present', async () => {
    // Permission only set for 'co-query', not 'co-body'
    setupCurrentUser({
      companyId: 'co-query',
      permission: ECompanyPermission.booker,
    });

    const req = mockReq('POST', {
      body: { companyId: 'co-body' },
      query: { companyId: 'co-query' },
    });
    const res = mockRes();
    await companyChecker(mockHandler)(req, res);

    // co-query has valid permission → handler is called
    expect(mockHandler).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET — no companyId check required, falls through to permission check
// ---------------------------------------------------------------------------

describe('GET — not a write method, companyId from companyList fallback', () => {
  it('allows GET when companyList[0] has a valid permission', async () => {
    setupCurrentUser({
      companyId: 'co-from-list',
      permission: ECompanyPermission.owner,
      companyList: ['co-from-list'],
    });

    const req = mockReq('GET');
    const res = mockRes();
    await companyChecker(mockHandler)(req, res);

    expect(mockHandler).toHaveBeenCalled();
  });

  it('blocks GET when companyList[0] has no valid permission', async () => {
    setupCurrentUser({
      companyId: 'co-from-list',
      permission: ECompanyPermission.participant,
      companyList: ['co-from-list'],
    });

    const req = mockReq('GET');
    const res = mockRes();
    await companyChecker(mockHandler)(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
