import { uniq } from 'lodash';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { getOrderAndPlan } from '@pages/api/orders/[orderId]/get.service';
import cookies from '@services/cookie';
import partnerChecker from '@services/permissionChecker/partner';
import { getIntegrationSdk, getSdk, handleError } from '@services/sdk';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
  User,
} from '@src/utils/data';
import { formatTimestamp } from '@src/utils/dates';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import { ECompanyPermission, EImageVariants } from '@src/utils/enums';
import type { TListing } from '@src/utils/types';

import getReviews from './get.service';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;
    const { JSONParams = '' } = req.query;
    const sdk = getSdk(req, res);
    const integrationSdk = getIntegrationSdk();

    switch (apiMethod) {
      case HttpMethod.GET: {
        const {
          rating: ratings = [],
          page,
          pageSize: perPage,
        } = JSON.parse(JSONParams as string);

        const currentUserRes = await sdk.currentUser.show();
        const [companyAccount] = denormalisedResponseEntities(currentUserRes);
        const { restaurantListingId: restaurantId } =
          CurrentUser(companyAccount).getMetadata();
        const response = await getReviews(restaurantId, page, perPage, ratings);
        const { pagination, data: reviews } = response;

        const userIds: string[] = [];
        const orderIds: string[] = [];

        const rawDetailData = reviews.map((review: TListing) => {
          const reviewListing = Listing(review);
          const id = reviewListing.getId();
          const {
            generalRating: rating,
            detailRating,
            reviewerId,
            timestamp,
            orderId,
            detailTextRating,
            foodName,
            reviewRole,
            replies,
          } = reviewListing.getMetadata();

          userIds.push(reviewerId);
          if (reviewRole === ECompanyPermission.booker) orderIds.push(orderId);

          const { rating: foodRating } = detailRating.food;
          const { rating: packagingRating } = detailRating.packaging;

          return {
            id,
            rating,
            foodRating,
            packagingRating,
            timestamp,
            orderId,
            reviewerId,
            detailTextRating,
            foodName,
            reviewRole,
            replies,
          };
        });

        const fetchData = await Promise.all([
          integrationSdk.users.query({
            meta_id: userIds,
            include: ['profileImage'],
            'fields.image': [
              `variants.${EImageVariants.squareSmall}`,
              `variants.${EImageVariants.squareSmall2x}`,
            ],
          }),
          getOrderAndPlan(uniq(orderIds)),
        ]);
        const [fetchUsers, fetchOrders] = fetchData;
        const users: [] = denormalisedResponseEntities(fetchUsers);

        const mapUserById = users.reduce((acc, user) => {
          const id = User(user).getId();
          if (!acc.has(id)) {
            acc.set(id, user);
          }

          return acc;
        }, new Map<string, any>());

        const mapOrderById = fetchOrders.reduce((acc, order) => {
          const id = order.orderListing.id.uuid;
          if (!acc.has(id)) {
            acc.set(id, order);
          }

          return acc;
        }, new Map<string, any>());

        const reviewDetailData = rawDetailData.map((rawData) => {
          const {
            id,
            rating,
            foodRating,
            packagingRating,
            timestamp,
            orderId,
            reviewerId,
            detailTextRating,
            foodName,
            replies,
            reviewRole,
          } = rawData;

          let name = '';
          const user = mapUserById.get(reviewerId);
          if (user) {
            const { firstName, lastName, displayName } =
              User(user).getAttributes().profile;
            name = buildFullName(firstName, lastName, {
              compareToGetLongerWith: displayName,
            });
          }

          let description: string = '';
          let foodNameValue: string = '';
          if (
            reviewRole === ECompanyPermission.booker &&
            mapOrderById.has(orderId)
          ) {
            const order = mapOrderById.get(orderId) ?? {};
            description = Listing(order.orderListing).getMetadata()
              .detailTextRating;
            const { orderDetail } = Listing(order.planListing).getMetadata();
            const { lineItems = [] } = orderDetail[String(timestamp)];
            foodNameValue = lineItems.length ? lineItems[0].name : '';
          } else if (reviewRole === ECompanyPermission.participant) {
            description = detailTextRating;
            foodNameValue = foodName;
          }

          return {
            id,
            rating,
            foodRating,
            packagingRating,
            orderAt: formatTimestamp(timestamp),
            description,
            name,
            foodName: foodNameValue,
            user,
            replies,
          };
        });

        return res.status(200).json({
          reviewDetailData,
          pagination,
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

export default cookies(partnerChecker(handler));
