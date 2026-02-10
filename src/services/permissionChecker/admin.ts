import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

import { EHttpStatusCode } from '@apis/errors';
import { getSdk, handleError } from '@services/sdk';
import { CurrentUser, denormalisedResponseEntities } from '@utils/data';

const adminChecker =
  (handler: NextApiHandler) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const sdk = getSdk(req, res);

      console.time('adminChecker currentUser.show');
      const currentUserResponse = await sdk.currentUser.show();
      console.timeEnd('adminChecker currentUser.show');

      const [currentUser] = denormalisedResponseEntities(currentUserResponse);

      if (!currentUser) {
        return res.status(EHttpStatusCode.Unauthorized).json({
          message: 'Unauthenticated!',
        });
      }

      const { isAdmin = false } = CurrentUser(currentUser).getMetadata();

      if (!isAdmin) {
        return res.status(EHttpStatusCode.Forbidden).json({
          message: 'Forbidden',
        });
      }

      req.previewData = {
        currentUser,
      };

      return handler(req, res);
    } catch (error) {
      console.error('error', error);
      handleError(res, error);
    }
  };

export default adminChecker;
