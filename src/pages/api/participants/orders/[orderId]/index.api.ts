/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { fetchListing, fetchUser } from '@services/integrationHelper';
import { addToProcessOrderQueue } from '@services/jobs/processOrder.job';
import { getIntegrationSdk, getSdk, handleError } from '@services/sdk';
import type { TUpdateParticipantOrderBody } from '@src/types/order';
import { EListingType } from '@src/utils/enums';
import type { TListing } from '@src/utils/types';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@utils/data';

const fetchSubOrder = async (orderDetail: any) => {
  let orderDetailResult = {};
  const integrationSdk = getIntegrationSdk();
  const planKeys = Object.keys(orderDetail);
  for (const planKey of planKeys) {
    const planItem = orderDetail[planKey];
    const { restaurant = {}, transactionId } = planItem;
    const { foodList = {}, id: restaurantId } = restaurant;

    // Fetch restaurant data
    const restaurantData = denormalisedResponseEntities(
      await integrationSdk.listings.show({ id: restaurantId }),
    )[0];

    // Fetch food listings data
    const foodListIds = Object.keys(foodList);
    const foodListData = denormalisedResponseEntities(
      await integrationSdk.listings.query({
        ids: foodListIds.slice(0, 50),
        meta_listingType: EListingType.food,
      }),
    );
    orderDetailResult = {
      ...orderDetailResult,
      [planKey]: {
        foodList: foodListData,
        restaurant: restaurantData,
        // Menu-scoped fee, taken from the snapshot rather than the dish.
        foodExtraFees: Object.entries(foodList).reduce<Record<string, number>>(
          (result, [foodId, food]: [string, any]) => ({
            ...result,
            [foodId]: food?.foodExtraFee ?? 0,
          }),
          {},
        ),
        transactionId,
      },
    };
  }

  return orderDetailResult;
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiMethod = req.method;
  const integrationSdk = getIntegrationSdk();
  const sdk = getSdk(req, res);

  switch (apiMethod) {
    case HttpMethod.GET: {
      const { orderId } = req.query;

      if (!orderId) {
        return res.status(400).json({
          message: 'Missing required keys',
        });
      }

      try {
        // Get order data
        const order = await fetchListing(orderId as string);

        // Get company data (user)
        const companyId = order?.attributes.metadata?.companyId || '';
        const companyRes = await fetchUser(companyId);

        // Remove username and password from privateData
        const privateData = { ...companyRes?.attributes?.profile?.privateData };
        delete privateData?.username;
        delete privateData?.password;

        const companyProfile = {
          ...companyRes?.attributes?.profile,
          privateData,
        };

        const company = {
          ...companyRes,
          attributes: {
            ...companyRes?.attributes,
            profile: companyProfile,
          },
        };

        // Get list sub-order (plan)
        const planIds = order?.attributes.metadata?.plans || [];
        const plans = denormalisedResponseEntities(
          await integrationSdk.listings.query({
            ids: planIds.slice(0, 50),
            meta_listingType: EListingType.subOrder,
          }),
        );

        const subOrderPromises = plans.map(async (plan: TListing) => {
          const { orderDetail = {} } = Listing(plan).getMetadata();
          const planId = Listing(plan).getId();

          return {
            [planId]: await fetchSubOrder(orderDetail),
          };
        });

        const subOrderData = await Promise.all(subOrderPromises);

        return res.json({
          statusCode: 200,
          meta: {},
          data: {
            company,
            order,
            plans,
            subOrders: subOrderData,
          },
        });
      } catch (error) {
        handleError(res, error);
        console.error(error);
      }
      break;
    }

    case HttpMethod.POST: {
      const { orderId } = req.query;
      const { planId, memberOrders, orderDay, orderDays, planData } =
        req.body as TUpdateParticipantOrderBody;
      try {
        console.info('[TRACK] step=api_receive start', {
          orderId,
          planId,
          hasMemberOrders: Boolean(memberOrders),
          hasOrderDays: Boolean(orderDays?.length),
        });
        const currentUser = denormalisedResponseEntities(
          await sdk.currentUser.show(),
        )[0];
        const currentUserId = CurrentUser(currentUser).getId();

        console.info('[TRACK] step=enqueue_job start', {
          orderId,
          planId,
          currentUserId,
        });
        const job = await addToProcessOrderQueue({
          orderId,
          planId,
          memberOrders,
          orderDay,
          orderDays,
          planData,
          currentUserId,
        });
        console.info('[TRACK] step=enqueue_job success', { jobId: job?.id });
        console.info('[TRACK] step=api_receive success');

        return res.json({
          message: 'Job queued',
          jobId: job?.id,
        });
      } catch (error) {
        handleError(res, error);
        console.error(error);
      }
      break;
    }
    default:
      break;
  }
};

export default cookies(handler);
