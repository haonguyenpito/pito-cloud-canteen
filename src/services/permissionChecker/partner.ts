import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

import { EHttpStatusCode } from '@apis/errors';
import { assertAccountEnabled } from '@helpers/userDisabledHelper';
import { getSdk, handleError } from '@services/sdk';
import { CurrentUser, denormalisedResponseEntities } from '@src/utils/data';

const partnerChecker =
  (handler: NextApiHandler) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const sdk = getSdk(req, res);
      const [currentUser] = denormalisedResponseEntities(
        await sdk.currentUser.show(),
      );

      if (!currentUser) {
        return res.status(EHttpStatusCode.Unauthorized).json({
          message: 'Unauthenticated!',
        });
      }

      if (!assertAccountEnabled(currentUser, res)) return;

      const { isPartner = false } = CurrentUser(currentUser).getMetadata();

      if (!isPartner) {
        return res.status(EHttpStatusCode.Forbidden).json({
          message: "You don't have permission to access this api!",
        });
      }

      return handler(req, res);
    } catch (error) {
      handleError(res, error);
    }
  };

export default partnerChecker;
