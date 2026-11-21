import isEmpty from 'lodash/isEmpty';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import logger from '@helpers/logger';
import promoteNonAccountEmailToOrders from '@pages/api/apiServices/order/promoteNonAccountEmailToOrders.service';
import cookies from '@services/cookie';
import { getIntegrationSdk } from '@services/integrationSdk';
import { getSdk, handleError } from '@services/sdk';
import { CurrentUser, denormalisedResponseEntities } from '@utils/data';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const apiMethod = req.method;
    const sdk = getSdk(req, res);
    const integrationSdk = getIntegrationSdk();

    switch (apiMethod) {
      case HttpMethod.PUT: {
        try {
          const currentUserRes = await sdk.currentUser.show();
          const [currentUser] = denormalisedResponseEntities(currentUserRes);

          if (currentUser !== null && !isEmpty(currentUser)) {
            const currentUserGetter = CurrentUser(currentUser);
            const currentUserId = currentUserGetter.getId();
            const { email } = currentUserGetter.getAttributes();

            await integrationSdk.users.updateProfile({
              id: currentUserId,
              metadata: {
                id: currentUserId,
              },
            });

            if (email) {
              try {
                await promoteNonAccountEmailToOrders({
                  userId: currentUserId,
                  email,
                });
              } catch (promoteError) {
                logger.error(
                  'post-sign-up: promoteNonAccountEmailToOrders failed',
                  String(promoteError),
                );
              }
            }

            return res.status(200).json('Successfully update user id');
          }

          return res.status(400).json('Invalid token');
        } catch (error) {
          handleError(res, error);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('error: ', error);
  }
};
export default cookies(handler);
