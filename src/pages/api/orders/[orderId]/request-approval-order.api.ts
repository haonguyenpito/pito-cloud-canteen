import isEmpty from 'lodash/isEmpty';
import type { NextApiRequest, NextApiResponse } from 'next';

import { composeApiCheckers, HttpMethod } from '@apis/configs';
import { denormalisedResponseEntities } from '@services/data';
import { withPlanLock } from '@services/distributedLock';
import { emailSendingFactory, EmailTemplateTypes } from '@services/email';
import { getIntegrationSdk } from '@services/integrationSdk';
import { createFirebaseDocNotification } from '@services/notifications';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';
import type { OrderListing, PlanListing, WithFlexSDKData } from '@src/types';
import { Listing } from '@utils/data';
import {
  EBookerNativeNotificationType,
  ENotificationType,
  EOrderDraftStates,
} from '@utils/enums';

import { sendBookerNativeNotification } from './send-booker-native-notification.service';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;
    const integrationSdk = getIntegrationSdk();

    switch (apiMethod) {
      case HttpMethod.PUT:
        {
          const orderId = req.query.orderId as string;
          const [orderListing]: [OrderListing] = denormalisedResponseEntities(
            await integrationSdk.listings.show({
              id: orderId,
            }),
          );
          const {
            orderState,
            orderStateHistory = [],
            bookerId,
            startDate,
            endDate,
          } = Listing(orderListing as any).getMetadata();

          if (orderState !== EOrderDraftStates.draft) {
            throw new Error(
              'You can publish draft order (with orderState "draft") only',
            );
          }

          const updatedAt = new Date().getTime();

          const initOrderStateHistory = isEmpty(orderStateHistory)
            ? [
                {
                  state: EOrderDraftStates.draft,
                  updatedAt,
                },
              ]
            : orderStateHistory;
          const updateOrderStateHistory = initOrderStateHistory.concat([
            {
              state: EOrderDraftStates.pendingApproval,
              updatedAt,
            },
          ]);

          const [updatedOrderListing] = denormalisedResponseEntities(
            await integrationSdk.listings.update(
              {
                id: orderId,
                metadata: {
                  orderState: EOrderDraftStates.pendingApproval,
                  orderStateHistory: updateOrderStateHistory,
                },
              },
              { expand: true },
            ),
          );

          const planId = orderListing.attributes?.metadata?.plans?.[0];
          if (!planId) {
            throw new Error(`Order ${orderId} has no plan`);
          }
          // Not awaited, as before: the response does not depend on it.
          withPlanLock(planId, async () => {
            const planListingResponse: WithFlexSDKData<PlanListing> =
              await integrationSdk.listings.show({
                id: planId,
              });

            const oldOrderDetail =
              planListingResponse.data.data.attributes?.metadata?.orderDetail;
            const orderDetailHasFoodList = Object.keys(
              oldOrderDetail || {},
            ).reduce((_orderDetailHasFoodList, date) => {
              if (!oldOrderDetail?.[date]?.restaurant?.foodList) {
                return _orderDetailHasFoodList;
              }

              return {
                ..._orderDetailHasFoodList,
                [date]: oldOrderDetail?.[date],
              };
            }, {});

            await integrationSdk.listings.update({
              id: planId,
              metadata: {
                orderDetail: orderDetailHasFoodList,
              },
            });
          }).catch((error) =>
            console.error('request-approval-order: plan update failed', error),
          );

          await Promise.allSettled([
            emailSendingFactory(
              EmailTemplateTypes.BOOKER.BOOKER_ORDER_CREATED,
              { orderId },
            ),
            sendBookerNativeNotification(
              updatedOrderListing,
              EBookerNativeNotificationType.AdminCreateNewOrder,
            ),
          ]);

          createFirebaseDocNotification(
            ENotificationType.BOOKER_NEW_ORDER_CREATED,
            {
              userId: bookerId,
              orderId,
              startDate,
              endDate,
            },
          );

          res.status(200).json(updatedOrderListing);
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

export default composeApiCheckers(adminChecker)(handler);
