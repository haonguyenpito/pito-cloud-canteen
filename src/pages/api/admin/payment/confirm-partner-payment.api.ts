import type { NextApiRequest, NextApiResponse } from 'next';

import { composeApiCheckers, HttpMethod } from '@apis/configs';
import { EHttpStatusCode } from '@apis/errors';
import { denormalisedResponseEntities } from '@services/data';
import { withPlanLock } from '@services/distributedLock';
import { getIntegrationSdk } from '@services/integrationSdk';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';
import { Listing } from '@src/utils/data';

import { updatePartnerRootPaymentRecord } from './payment.service';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const apiMethod = req.method;
  const { planId, subOrderDate } = req.body;
  const integrationSdk = getIntegrationSdk();

  try {
    switch (apiMethod) {
      case HttpMethod.PUT: {
        // The whole check-confirm-write runs under the plan lock: the plan
        // write must not drop a concurrent pick, and the check must not race
        // a second confirm of the same date.
        const result = await withPlanLock(planId, async () => {
          const [plan] = denormalisedResponseEntities(
            await integrationSdk.listings.show({
              id: planId,
            }),
          );

          const { orderDetail = {}, orderId } = Listing(plan).getMetadata();

          const { isAdminPaymentConfirmed = false } =
            orderDetail[subOrderDate] || {};

          if (isAdminPaymentConfirmed) {
            return { error: 'Cannot confirm partner payment confirmed order' };
          }
          // TODO: update firebase payment status
          await updatePartnerRootPaymentRecord({
            orderId,
            subOrderDate,
            updateData: {
              isAdminConfirmed: true,
            },
          });

          const updateOrderDetail = {
            ...orderDetail,
            [subOrderDate]: {
              ...orderDetail[subOrderDate],
              isAdminPaymentConfirmed: true,
            },
          };

          await integrationSdk.listings.update({
            id: planId,
            metadata: {
              orderDetail: updateOrderDetail,
            },
          });

          return { orderDetail: updateOrderDetail };
        });

        if ('error' in result) {
          return res
            .status(EHttpStatusCode.BadRequest)
            .json({ error: result.error });
        }

        return res.status(EHttpStatusCode.Ok).json({
          message: 'Successfully confirm partner payment',
          orderDetail: result.orderDetail,
        });
      }
      default:
        break;
    }
  } catch (error) {
    handleError(res, error);
  }
}

export default composeApiCheckers(adminChecker)(handler);
