import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { withPlanLock } from '@services/distributedLock';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import participantChecker from '@services/permissionChecker/participant';
import { getSdk, handleError } from '@services/sdk';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@utils/data';
import type { TObject } from '@utils/types';

export type TRecommendedMemberOrders = {
  [planId: string]: { [subOrderDate: string]: TObject };
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;
    const integrationSdk = getIntegrationSdk();

    switch (apiMethod) {
      case HttpMethod.PUT:
        {
          const { recommendedMemberOrders = {} } = req.body as {
            recommendedMemberOrders: TRecommendedMemberOrders;
          };
          const [currentUser] = denormalisedResponseEntities(
            await getSdk(req, res).currentUser.show(),
          );
          const currentUserId = CurrentUser(currentUser).getId();

          await Promise.all(
            Object.entries(recommendedMemberOrders).map(
              ([planId, memberOrderByDate]) =>
                withPlanLock(planId, async () => {
                  const { orderDetail = {} } = Listing(
                    await fetchListing(planId),
                  ).getMetadata();

                  const newOrderDetail = Object.entries(
                    memberOrderByDate,
                  ).reduce<TObject>(
                    (result, [subOrderDate, memberOrder]) =>
                      result[subOrderDate]
                        ? {
                            ...result,
                            [subOrderDate]: {
                              ...result[subOrderDate],
                              memberOrders: {
                                ...result[subOrderDate].memberOrders,
                                [currentUserId]: memberOrder,
                              },
                            },
                          }
                        : result,
                    orderDetail,
                  );

                  await integrationSdk.listings.update({
                    id: planId,
                    metadata: { orderDetail: newOrderDetail },
                  });
                }),
            ),
          );

          res.status(200).json({ success: true });
        }
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(participantChecker(handler));
