import { map } from 'lodash';
import isEmpty from 'lodash/isEmpty';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import {
  fetchListingsByChunkedIds,
  queryAllListings,
} from '@helpers/apiHelpers';
import { toPartnerPlanListing } from '@helpers/order/partnerPriceHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { handleError } from '@services/sdk';
import { Listing } from '@src/utils/data';
import { EListingStates, EListingType } from '@src/utils/enums';
import type { TListing, TObject } from '@src/utils/types';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const {
      method: apiMethod,
      query: { partnerId, JSONParams },
    } = req;
    const { startDate, endDate, orderStates } =
      JSON.parse(JSONParams as string) || {};

    switch (apiMethod) {
      case HttpMethod.GET: {
        const integrationSdk = getIntegrationSdk();
        const orders = await queryAllListings({
          query: {
            states: [EListingStates.published],
            meta_partnerIds: `has_any:${partnerId}`,
            meta_listingType: EListingType.order,
            ...(startDate &&
              endDate && {
                meta_startDate: `${startDate},${endDate + 1}`,
              }),
            ...(orderStates && {
              meta_orderState: `${orderStates.join(',')}`,
            }),
          },
        });

        const { planIds, quotationIds } = orders.reduce(
          (acc: any, order: TListing) => {
            const { planIds: accPlanIds, quotationIds: accQuotationIds } = acc;
            const { plans = [], quotationId } = Listing(order).getMetadata();

            return {
              planIds: [...accPlanIds, plans[0]],
              quotationIds: [...accQuotationIds, quotationId],
            };
          },
          {
            planIds: [],
            quotationIds: [],
          },
        );
        const allPlans = await fetchListingsByChunkedIds(
          planIds,
          integrationSdk,
        );
        const allQuotations = await fetchListingsByChunkedIds(
          quotationIds,
          integrationSdk,
        );

        const orderWithPlanDataMaybe = map(orders, (order: TListing) => {
          const { plans = [], quotationId } = Listing(order).getMetadata();

          const planId = plans[0];
          let resultValue = order as TObject;

          if (planId) {
            const planListing = allPlans.find(
              (plan: TListing) => Listing(plan).getId() === planId,
            );

            if (!isEmpty(planListing)) {
              resultValue = {
                ...resultValue,
                plan: toPartnerPlanListing(planListing),
              };
            }
          }

          if (quotationId) {
            const quotationListing = allQuotations.find(
              (quotation: TListing) =>
                Listing(quotation).getId() === quotationId,
            );

            if (!isEmpty(quotationListing)) {
              const { partner = {} } = Listing(quotationListing).getMetadata();
              resultValue = { ...resultValue, quotation: partner };
            }
          }

          return resultValue;
        });

        return res.status(200).json({ orders: orderWithPlanDataMaybe });
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
