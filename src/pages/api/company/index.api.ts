import pick from 'lodash/pick';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { EHttpStatusCode } from '@apis/errors';
import cookies from '@services/cookie';
import { getIntegrationSdk } from '@services/integrationSdk';
import companyChecker from '@services/permissionChecker/company';
import { handleError } from '@services/sdk';
import { denormalisedResponseEntities } from '@utils/data';

/**
 * Only these fields may be written through this endpoint. `metadata` is
 * deliberately absent: it carries `isAdmin`, `isDisabled`, `userState` and the
 * `company` permission map, so forwarding it would let any booker escalate
 * themselves to admin or lift their own account lock.
 */
const ALLOWED_DATA_PARAMS = ['id', 'publicData', 'profileImageId'];

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const apiMethod = req.method;
  switch (apiMethod) {
    case HttpMethod.PUT:
      try {
        const { companyId, dataParams, queryParams } = req.body;

        if (!dataParams?.id || dataParams.id !== companyId) {
          return res.status(EHttpStatusCode.Forbidden).json({
            message: "You don't have permission to update this account!",
          });
        }

        const integrationSdk = getIntegrationSdk();
        const companyAccountResponse = await integrationSdk.users.updateProfile(
          pick(dataParams, ALLOWED_DATA_PARAMS),
          queryParams,
        );
        const [companyAccount] = denormalisedResponseEntities(
          companyAccountResponse,
        );
        res.status(200).json(companyAccount);
      } catch (error) {
        handleError(res, error);
      }

      break;

    default:
      break;
  }
}

export default cookies(companyChecker(handler));
