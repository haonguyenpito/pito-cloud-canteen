import chunk from 'lodash/chunk';
import flatten from 'lodash/flatten';
import isEmpty from 'lodash/isEmpty';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { EHttpStatusCode } from '@apis/errors';
import { getHighlightedMembersAfterDeadline } from '@helpers/order/subOrderHighlightHelper';
import orderServices from '@pages/api/apiServices/order/index.service';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk, handleError } from '@services/sdk';
import type { PlanListing } from '@src/types';
import { Listing } from '@src/utils/data';
import { EOrderType } from '@src/utils/enums';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { JSONParams } = req.query;
    const { date, orderId } = JSON.parse(JSONParams as string);
    const apiMethod = req.method;

    const integrationSdk = getIntegrationSdk();

    if (isEmpty(date) || isEmpty(orderId)) {
      return res
        .status(EHttpStatusCode.BadRequest)
        .json({ error: 'Missing order date or order ID' });
    }

    switch (apiMethod) {
      case HttpMethod.GET: {
        const [order] = denormalisedResponseEntities(
          (await integrationSdk.listings.show({ id: orderId })) || [{}],
        );
        const {
          plans = [],
          companyId,
          participants: participantIds = [],
          anonymous: anonymousIds = [],
          orderType = EOrderType.group,
          bookerId,
          deadlineDate,
        } = Listing(order).getMetadata();
        const planId = plans[0];
        const isGroupOrder = EOrderType.group === orderType;
        let orderWithOtherDataMaybe = { ...order };

        if (isGroupOrder) {
          if (!isEmpty(participantIds)) {
            const participants = flatten(
              await Promise.all(
                chunk(participantIds, 100).map(async (ids) => {
                  return denormalisedResponseEntities(
                    await integrationSdk.users.query({
                      meta_id: ids,
                    }),
                  );
                }),
              ),
            );

            orderWithOtherDataMaybe = {
              ...orderWithOtherDataMaybe,
              participants,
            };
          }
          if (!isEmpty(anonymousIds)) {
            const anonymous = flatten(
              await Promise.all(
                chunk(anonymousIds, 100).map(async (ids) => {
                  return denormalisedResponseEntities(
                    await integrationSdk.users.query({
                      meta_id: ids,
                    }),
                  );
                }),
              ),
            );
            orderWithOtherDataMaybe = {
              ...orderWithOtherDataMaybe,
              anonymous,
            };
          }
        }

        // TODO: query booker info
        const bookerResponse = await integrationSdk.users.show({
          id: bookerId,
        });
        const [booker] = denormalisedResponseEntities(bookerResponse);
        if (!isEmpty(booker)) {
          orderWithOtherDataMaybe = { ...orderWithOtherDataMaybe, booker };
        }

        // TODO: query company info
        if (companyId !== bookerId) {
          const companyResponse = await integrationSdk.users.show({
            id: companyId,
          });
          const [company] = denormalisedResponseEntities(companyResponse);

          if (!isEmpty(company)) {
            orderWithOtherDataMaybe = { ...orderWithOtherDataMaybe, company };
          }
        } else {
          orderWithOtherDataMaybe = {
            ...orderWithOtherDataMaybe,
            company: booker,
          };
        }

        if (planId) {
          const [planListing] = denormalisedResponseEntities(
            (await integrationSdk.listings.show({ id: planId })) || [{}],
          ) as [PlanListing];

          if (isEmpty(planListing)) {
            return res
              .status(EHttpStatusCode.NotFound)
              .json({ error: 'Order detail was not found' });
          }

          const { orderDetail = {}, deliveryInfo } = Listing(
            planListing as any,
          ).getMetadata();
          const orderDetailOfDate = orderDetail[date] || {};
          const deliveryInfoOfDate = deliveryInfo?.[date] || {};
          const deliveryAgentsMealsOfDate =
            planListing.attributes?.metadata?.deliveryAgentsMeals?.[date] || {};

          const { restaurant: restaurantObj = {} } = orderDetailOfDate;
          const { id: restaurantId } = restaurantObj;

          const [restaurant] = denormalisedResponseEntities(
            (await integrationSdk.listings.show({ id: restaurantId })) || [{}],
          );

          orderWithOtherDataMaybe = {
            ...orderWithOtherDataMaybe,
            orderDetailOfDate,
            deliveryInfoOfDate,
            deliveryAgentsMealsOfDate,
            restaurant,
          };

          const planOrderDate = Number(date);
          const historyItems =
            await orderServices.querySubOrderHistoryFromFirebase({
              planId,
              planOrderDate,
              limitRecords: 200,
            });

          orderWithOtherDataMaybe = {
            ...orderWithOtherDataMaybe,
            highlightedMembers: getHighlightedMembersAfterDeadline({
              historyItems,
              deadlineDate,
            }),
          };
        }

        return res.status(200).json(orderWithOtherDataMaybe);
      }

      default:
        break;
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default handler;
