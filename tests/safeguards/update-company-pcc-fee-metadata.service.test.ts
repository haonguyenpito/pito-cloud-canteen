/**
 * UPDATE COMPANY — PCC FEE METADATA SAFEGUARDS
 *
 * Protects the metadata-building logic in updateCompany() that writes a
 * company's PCC (PITO service) fee override.
 *
 * WHY THIS MATTERS:
 * - hasSpecificPCCFee is only present in dataParams when the admin's "Other
 *   Settings" tab was submitted; every other company-edit tab omits it
 *   entirely (undefined). If this collapses to a plain truthy check, saving
 *   an unrelated tab (e.g. company info) would silently wipe out a real,
 *   active fee override for that company.
 * - A 0-price tier must survive the numeric coercion intact.
 * - Explicitly reverting to the default fee schedule must write
 *   hasSpecificPCCFee: false and clear both specificPCCFeeTiers and
 *   specificPCCFee via `null` (Sharetribe's documented convention for
 *   removing a top-level extended-data key).
 *
 * Source: src/pages/api/apiServices/company/updateCompany.service.ts
 */

import updateCompany from '@pages/api/apiServices/company/updateCompany.service';
import { getIntegrationSdk } from '@services/integrationSdk';

jest.mock('@services/integrationSdk');

const makeSdk = () => ({
  users: {
    updateProfile: jest.fn().mockResolvedValue({ data: {} }),
  },
});

const baseParams = {
  id: 'company-1',
} as any;

describe('updateCompany — PCC fee metadata', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('leaves PCC fee metadata untouched when hasSpecificPCCFee is not submitted (a different tab was saved)', async () => {
    const sdk = makeSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateCompany({ ...baseParams, firstName: 'Jane' } as any, {});

    const [updateParams] = (sdk.users.updateProfile as jest.Mock).mock.calls[0];
    expect(updateParams.metadata).toEqual({});
  });

  it('writes a 0-price tier through intact and sets hasSpecificPCCFee true', async () => {
    const sdk = makeSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateCompany(
      {
        ...baseParams,
        hasSpecificPCCFee: true,
        specificPCCFeeTiers: [{ maxQuantity: null as any, price: 0 as any }],
      } as any,
      {},
    );

    const [updateParams] = (sdk.users.updateProfile as jest.Mock).mock.calls[0];
    expect(updateParams.metadata).toEqual({
      hasSpecificPCCFee: true,
      specificPCCFeeTiers: [{ maxQuantity: null, price: 0 }],
      specificPCCFee: null,
    });
  });

  it('coerces the last tier maxQuantity to null (unbounded) on a multi-tier save', async () => {
    const sdk = makeSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateCompany(
      {
        ...baseParams,
        hasSpecificPCCFee: true,
        specificPCCFeeTiers: [
          { maxQuantity: '10' as any, price: '100000' as any },
          { maxQuantity: '999' as any, price: '200000' as any },
        ],
      } as any,
      {},
    );

    const [updateParams] = (sdk.users.updateProfile as jest.Mock).mock.calls[0];
    expect(updateParams.metadata.specificPCCFeeTiers).toEqual([
      { maxQuantity: 10, price: 100_000 },
      { maxQuantity: null, price: 200_000 },
    ]);
  });

  it('clears the override and reverts to the default schedule when hasSpecificPCCFee is explicitly false', async () => {
    const sdk = makeSdk();
    (getIntegrationSdk as jest.Mock).mockReturnValue(sdk);

    await updateCompany(
      {
        ...baseParams,
        hasSpecificPCCFee: false,
      } as any,
      {},
    );

    const [updateParams] = (sdk.users.updateProfile as jest.Mock).mock.calls[0];
    expect(updateParams.metadata).toEqual({
      hasSpecificPCCFee: false,
      specificPCCFeeTiers: null,
      specificPCCFee: null,
    });
  });
});
