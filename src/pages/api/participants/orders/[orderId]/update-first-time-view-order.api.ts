import { uniq } from 'lodash';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { withPlanLock } from '@services/distributedLock';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { getSdk, handleError } from '@services/sdk';
import type { PlanListing } from '@src/types';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@src/utils/data';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;

    switch (apiMethod) {
      case HttpMethod.PUT:
        {
          const { orderId } = req.query;
          const sdk = getSdk(req, res);
          const integrationSdk = getIntegrationSdk();
          const [currentUser] = denormalisedResponseEntities(
            await sdk.currentUser.show(),
          );

          const currentUserGetter = CurrentUser(currentUser);
          const currentUserId = currentUserGetter.getId();

          const order = await fetchListing(orderId as string);
          const orderGetter = Listing(order);
          const orderMetadata = orderGetter.getMetadata();
          const isParticipantViewedOrderFirstTime =
            orderMetadata?.[`hideFirstTimeOrderModal_${currentUserId}`];

          if (!isParticipantViewedOrderFirstTime) {
            await integrationSdk.listings.update({
              id: orderId,
              metadata: {
                [`hideFirstTimeOrderModal_${currentUserId}`]: true,
                participants: uniq(
                  (order.attributes?.metadata?.participants || []).concat(
                    currentUserId,
                  ),
                ),
              },
            });

            const planId = order.attributes?.metadata?.plans?.[0];
            if (planId) {
              await withPlanLock(planId, async () => {
                const plan: PlanListing = await fetchListing(planId);

                const orderDetail = Object.entries(
                  plan.attributes?.metadata?.orderDetail || {},
                )
                  .map(([subOrderDate, subOrderDateValue]) => {
                    return {
                      [subOrderDate]: {
                        ...subOrderDateValue,
                        memberOrders: {
                          ...subOrderDateValue?.memberOrders,
                          [currentUserId]: {
                            foodId: '',
                            requirement: '',
                            status: 'empty',
                            ...subOrderDateValue?.memberOrders?.[currentUserId],
                          },
                        },
                      },
                    };
                  })
                  .reduce((_newOrderDetail, subOrderDateData) => {
                    return {
                      ..._newOrderDetail,
                      ...subOrderDateData,
                    };
                  }, {});

                await integrationSdk.listings.update({
                  id: planId,
                  metadata: { orderDetail },
                });
              });
            }
          }

          res.status(200).json({
            message: 'Update first time view order successfully',
          });
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

export default cookies(handler);
