import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

import { EHttpStatusCode } from '@apis/errors';
import { assertAccountEnabled } from '@helpers/userDisabledHelper';
import { getSdk, handleError } from '@services/sdk';
import { denormalisedResponseEntities } from '@src/utils/data';

const participantChecker =
  (handler: NextApiHandler) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const sdk = getSdk(req, res);
      const [currentUser] = denormalisedResponseEntities(
        await sdk.currentUser.show(),
      );

      if (!currentUser) {
        return res.status(EHttpStatusCode.Unauthorized).json({
          message: "You don't have permission to access this api!",
        });
      }

      if (!assertAccountEnabled(currentUser, res)) return;

      return handler(req, res);
    } catch (error) {
      handleError(res, error);
    }
  };

export default participantChecker;
