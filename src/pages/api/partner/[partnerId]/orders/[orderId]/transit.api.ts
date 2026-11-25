import type { NextApiRequest, NextApiResponse } from 'next';

import { composeApiCheckers, HttpMethod } from '@apis/configs';
import { convertDateToVNTimezone } from '@helpers/dateHelpers';
import { toPartnerPlanListing } from '@helpers/order/partnerPriceHelper';
import { withPlanLock } from '@services/distributedLock';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import partnerChecker from '@services/permissionChecker/partner';
import { handleError } from '@services/sdk';
import { createSlackNotification } from '@services/slackNotification';
import type { OrderListing, PlanListing } from '@src/types';
import { denormalisedResponseEntities, Listing } from '@src/utils/data';
import { ESlackNotificationType } from '@src/utils/enums';
import { ETransition } from '@src/utils/transaction';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const {
      query: { orderId },
      body: { subOrderDate, transactionId, newTransition },
      method: apiMethod,
    } = req;
    const integrationSdk = getIntegrationSdk();

    switch (apiMethod) {
      case HttpMethod.PUT: {
        const txResponse = await integrationSdk.transactions.transition(
          {
            id: transactionId,
            transition: newTransition,
            params: {},
          },
          { expand: true, include: ['booking', 'listing', 'provider'] },
        );
        const transaction = denormalisedResponseEntities(txResponse)[0];

        const order: OrderListing = await fetchListing(orderId as string);
        const { plans = [] } = Listing(order as any).getMetadata();
        const planId = plans[0];
        const { plan, updatePlanListing } = await withPlanLock(
          planId,
          async () => {
            const freshPlan: PlanListing = await fetchListing(planId);
            const { orderDetail = {} } = Listing(
              freshPlan as any,
            ).getMetadata();

            const [updatedPlan] = denormalisedResponseEntities(
              await integrationSdk.listings.update(
                {
                  id: planId,
                  metadata: {
                    orderDetail: {
                      ...orderDetail,
                      [subOrderDate]: {
                        ...orderDetail[subOrderDate],
                        lastTransition: newTransition,
                      },
                    },
                  },
                },
                { expand: true },
              ),
            );

            return { plan: freshPlan, updatePlanListing: updatedPlan };
          },
        );

        if (newTransition === ETransition.PARTNER_CONFIRM_SUB_ORDER) {
          createSlackNotification(
            ESlackNotificationType.PARTNER_CONFIRMS_SUB_ORDER,
            {
              partnerConfirmsSubOrderData: {
                threadTs: plan.attributes?.metadata?.slackThreadTs!,
                orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderId}`,
                orderName: order.attributes?.publicData?.orderName!,
                orderCode: order.attributes?.title!,
                date: convertDateToVNTimezone(new Date(+subOrderDate)).split(
                  'T',
                )[0],
                partnerName:
                  plan.attributes?.metadata?.orderDetail?.[subOrderDate]
                    ?.restaurant?.restaurantName!,
              },
            },
          );
        }

        if (newTransition === ETransition.PARTNER_REJECT_SUB_ORDER) {
          createSlackNotification(
            ESlackNotificationType.PARTNER_REJECTS_SUB_ORDER,
            {
              partnerRejectsSubOrderData: {
                threadTs: plan.attributes?.metadata?.slackThreadTs!,
                orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderId}`,
                orderName: order.attributes?.publicData?.orderName!,
                orderCode: order.attributes?.title!,
                date: convertDateToVNTimezone(new Date(+subOrderDate)).split(
                  'T',
                )[0],
                partnerName:
                  plan.attributes?.metadata?.orderDetail?.[subOrderDate]
                    ?.restaurant?.restaurantName!,
              },
            },
          );
        }

        return res.json({
          transaction,
          plan: toPartnerPlanListing(updatePlanListing),
        });
      }
      default:
        break;
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default composeApiCheckers(partnerChecker)(handler);
