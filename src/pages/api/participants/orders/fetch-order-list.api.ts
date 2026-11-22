import flatten from 'lodash/flatten';
import uniq from 'lodash/uniq';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { fetchListingsByChunkedIds } from '@helpers/apiHelpers';
import { getParticipantOrdersQueries } from '@helpers/listingSearchQuery';
import {
  confirmFirstTimeParticipant,
  sortCreateAtListing,
} from '@helpers/orderHelper';
import cookies from '@services/cookie';
import { fetchUser } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import participantChecker from '@services/permissionChecker/participant';
import { getSdk, handleError } from '@services/sdk';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@src/utils/data';
import { EImageVariants } from '@src/utils/enums';
import type { TListing } from '@src/utils/types';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;
    const sdk = getSdk(req, res);
    const integrationSdk = getIntegrationSdk();

    switch (apiMethod) {
      case HttpMethod.GET: {
        const { JSONParams } = req.query;
        const currentUser = denormalisedResponseEntities(
          await sdk.currentUser.show(),
        )[0];

        const { startDate, endDate } = JSON.parse(JSONParams as string);
        const startDateMs = new Date(startDate).getTime();
        const endDateMsRaw =
          endDate !== undefined ? new Date(endDate).getTime() : undefined;
        const endDateMs =
          endDateMsRaw !== undefined && endDateMsRaw < startDateMs
            ? startDateMs
            : endDateMsRaw;

        const ordersQueries = getParticipantOrdersQueries({
          userId: currentUser.id.uuid,
          startDate: startDateMs,
          endDate: endDateMs,
        });
        const orderPaticipants = integrationSdk.listings.query(
          ordersQueries.queryParticipants,
        );
        const orderAnonymous = integrationSdk.listings.query(
          ordersQueries.queryAnonymous,
        );

        const ordersQueriesOutOfScopeDate = getParticipantOrdersQueries({
          userId: currentUser.id.uuid,
          startDate: new Date(endDate).getTime() + 1,
        });
        const orderOutOfScopeDatePaticipants = integrationSdk.listings.query(
          ordersQueriesOutOfScopeDate.queryParticipants,
        );
        const orderOutOfScopeDateorderAnonymous = integrationSdk.listings.query(
          ordersQueriesOutOfScopeDate.queryAnonymous,
        );

        const responses = await Promise.all([
          orderPaticipants,
          orderAnonymous,
          orderOutOfScopeDatePaticipants,
          orderOutOfScopeDateorderAnonymous,
        ]).then((result) => result.map((r) => denormalisedResponseEntities(r)));

        const orders = [...responses[0], ...responses[1]];

        const allPlansIdList: any[] = [];
        const ordersNotConfirmFirstTime: TListing[] = [];
        orders.forEach(async (order: TListing) => {
          const { plans = [] } = Listing(order).getMetadata();

          if (!confirmFirstTimeParticipant(order, currentUser.id.uuid)) {
            ordersNotConfirmFirstTime.push(order);
          }
          allPlansIdList.push(plans[0]);
        });

        [...responses[2], ...responses[3]].forEach(async (order: TListing) => {
          if (!confirmFirstTimeParticipant(order, currentUser.id.uuid)) {
            ordersNotConfirmFirstTime.push(order);
          }
        });
        const allPlanListings = await fetchListingsByChunkedIds(
          allPlansIdList,
          integrationSdk,
        );

        const allRelatedRestaurantsIdList = uniq(
          allPlanListings.map((plan: TListing) => {
            const planListing = Listing(plan);
            const { orderDetail = {} } = planListing.getMetadata();

            return Object.values(orderDetail).map(
              (subOrder: any) => subOrder?.restaurant?.id,
            );
          }),
        );

        const allRelatedRestaurants = await fetchListingsByChunkedIds(
          flatten(allRelatedRestaurantsIdList),
          integrationSdk,
        );

        const mappingSubOrderToOrder = orders.reduce(
          (result: any, order: TListing) => {
            const orderListing = Listing(order);
            const orderId = orderListing.getId();
            const { plans = [] } = orderListing.getMetadata();
            const planIdWithOrderId = plans.reduce(
              (mapping: any[], planId: string) => {
                return {
                  ...mapping,
                  [planId]: orderId,
                };
              },
              {},
            );

            return {
              ...result,
              ...planIdWithOrderId,
            };
          },
          {},
        );

        const currentUserGetter = CurrentUser(currentUser);
        const { companyList = [] } = currentUserGetter.getMetadata();
        const companyId = companyList[0];
        let company;

        if (companyId) {
          company = await fetchUser(companyId);
        }
        const allPlans = flatten(allPlanListings);

        const foodsInPlans = await Promise.all(
          allPlans.map(async (plan: TListing) => {
            const planListing = Listing(plan);
            const { orderDetail: subOrders } = planListing.getMetadata();

            const pickedFoodIds: any[] = [];
            Object.keys(subOrders).forEach((key) => {
              const { memberOrders } = subOrders[key];
              if (memberOrders) {
                const foodId = memberOrders[currentUser.id.uuid]?.foodId;
                if (foodId) {
                  pickedFoodIds.push(foodId);
                }
                const secondaryFoodId =
                  memberOrders[currentUser.id.uuid]?.secondaryFoodId;
                if (secondaryFoodId) {
                  pickedFoodIds.push(secondaryFoodId);
                }
              }
            });

            const pickedFoods: any[] = denormalisedResponseEntities(
              await sdk.listings.query({
                ids: pickedFoodIds,
                include: ['images'],
                'fields.image': [`variants.${EImageVariants.default}`],
              }),
            );

            const mapedFoodIds = pickedFoods.reduce((acc, foodListing) => {
              const id = Listing(foodListing).getId();
              if (!acc[id]) {
                acc[id] = foodListing;
              }

              return acc;
            }, {});

            return {
              planId: planListing.getId(),
              foodListings: mapedFoodIds,
            };
          }),
        );

        return res.status(200).json({
          orders,
          allPlans,
          restaurants: allRelatedRestaurants,
          mappingSubOrderToOrder,
          company,
          ordersNotConfirmFirstTime: sortCreateAtListing(
            ordersNotConfirmFirstTime,
            'desc',
          ),
          foodsInPlans,
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

export default cookies(participantChecker(handler));
