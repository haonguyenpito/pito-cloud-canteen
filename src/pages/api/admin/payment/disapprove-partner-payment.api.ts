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
        // Same lock scope as confirm-partner-payment: check and write together.
        const result = await withPlanLock(planId, async () => {
          const [plan] = denormalisedResponseEntities(
            await integrationSdk.listings.show({
              id: planId,
            }),
          );

          const { orderDetail = {}, orderId } = Listing(plan).getMetadata();

          const { isAdminPaymentConfirmed = false } =
            orderDetail[subOrderDate] || {};

          if (!isAdminPaymentConfirmed) {
            return {
              error: 'Cannot disapprove partner payment unconfirmed order',
            };
          }
          // TODO: update firebase payment status
          await updatePartnerRootPaymentRecord({
            orderId,
            subOrderDate,
            updateData: {
              isAdminConfirmed: false,
            },
          });

          const updateOrderDetail = {
            ...orderDetail,
            [subOrderDate]: {
              ...orderDetail[subOrderDate],
              isAdminPaymentConfirmed: false,
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
          message: 'Successfully disapprove partner payment',
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
