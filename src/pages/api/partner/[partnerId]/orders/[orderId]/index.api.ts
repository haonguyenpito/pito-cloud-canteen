import chunk from 'lodash/chunk';
import isEmpty from 'lodash/isEmpty';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { EHttpStatusCode } from '@apis/errors';
import cookies from '@services/cookie';
import { fetchListing, fetchUser } from '@services/integrationHelper';
import partnerChecker from '@services/permissionChecker/partner';
import { getIntegrationSdk, handleError } from '@services/sdk';
import { denormalisedResponseEntities, Listing } from '@src/utils/data';
import { EOrderType } from '@src/utils/enums';

const CHUNK_SIZE = 100;

/**
 * Fetch users by chunked IDs
 * @param sdk - SDK instance
 * @param ids - User IDs
 * @returns User data
 */
const fetchUsersByIds = async (sdk: any, ids: string[]) => {
  const chunks = chunk(ids, CHUNK_SIZE);

  const results = await Promise.all(
    chunks.map((idsChunk) =>
      sdk.users.query({ meta_id: idsChunk }).then(denormalisedResponseEntities),
    ),
  );

  return results.flat();
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { orderId, JSONParams } = req.query;
    const { date } = JSONParams ? JSON.parse(JSONParams as string) : {};
    const apiMethod = req.method;
    const { date: dateFromBody } = req.body;
    const subOrderDate = dateFromBody || date;

    const integrationSdk = getIntegrationSdk();

    if (isEmpty(subOrderDate) || isEmpty(orderId)) {
      return res
        .status(EHttpStatusCode.BadRequest)
        .json({ error: 'Missing order date or order ID' });
    }

    switch (apiMethod) {
      case HttpMethod.GET:
      case HttpMethod.POST: {
        const order = await fetchListing(orderId as string);
        const {
          plans = [],
          companyId,
          participants = [],
          anonymous = [],
          orderType = EOrderType.group,
        } = Listing(order).getMetadata();
        const planId = plans[0];
        const isGroupOrder = EOrderType.group === orderType;
        let orderWithPlanDataMaybe = { ...order };

        if (isGroupOrder) {
          if (!isEmpty(participants)) {
            const participantData = await fetchUsersByIds(
              integrationSdk,
              participants,
            );
            orderWithPlanDataMaybe = {
              ...orderWithPlanDataMaybe,
              participants: participantData,
            };
          }
          if (!isEmpty(anonymous)) {
            const anonymousParticipantData = await fetchUsersByIds(
              integrationSdk,
              anonymous,
            );

            orderWithPlanDataMaybe = {
              ...orderWithPlanDataMaybe,
              anonymous: anonymousParticipantData,
            };
          }
        }

        // TODO: query company info
        const company = await fetchUser(companyId);

        if (!isEmpty(company)) {
          orderWithPlanDataMaybe = { ...orderWithPlanDataMaybe, company };
        }

        if (planId) {
          // TODO: query plan info
          const planListing = await fetchListing(planId);

          if (isEmpty(planListing)) {
            return res
              .status(EHttpStatusCode.NotFound)
              .json({ error: 'Order detail was not found' });
          }

          orderWithPlanDataMaybe = {
            ...orderWithPlanDataMaybe,
            plan: planListing,
          };
        }

        return res.status(200).json(orderWithPlanDataMaybe);
      }

      default:
        return res
          .status(EHttpStatusCode.MethodNotAllowed)
          .json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(partnerChecker(handler));
