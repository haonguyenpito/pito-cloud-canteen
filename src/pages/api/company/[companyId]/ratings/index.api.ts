import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { sleep } from '@helpers/index';
import cookies from '@services/cookie';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/sdk';
import type {
  OrderListing,
  RatingListing,
  UserListing,
  WithFlexSDKData,
} from '@src/types';
import {
  EImageVariants,
  EListingType,
  EPartnerReply,
  EUserRole,
} from '@src/utils/enums';

export const retrieveAll = async <T extends Array<any>>(
  queryFunction: (params: any) => Promise<WithFlexSDKData<T>>,
  params: any,
  options?: {
    denormalizeResponseEntities?: boolean;
  },
): Promise<T> => {
  const allPages: T = [] as any;
  let page = 1;
  let responses: WithFlexSDKData<T[]> = {} as any;

  do {
    // eslint-disable-next-line no-await-in-loop
    responses = await queryFunction({ ...params, page });
    if (options?.denormalizeResponseEntities) {
      allPages.push(...denormalisedResponseEntities(responses));
    } else {
      allPages.push(...responses.data.data);
    }

    page += 1;
  } while (
    responses.data.meta?.totalPages &&
    page <= responses.data.meta?.totalPages
  );

  return allPages;
};

export const retrieveAllByIdChunks = async <T extends Array<any>>(
  queryFunction: (params: any) => Promise<WithFlexSDKData<T>>,
  generateParamsFromId: (ids: string[]) => any,
  ids: string[],
  params: any,
  options?: { chunkSize?: number; denormalizeResponseEntities?: boolean },
): Promise<T> => {
  const chunkSize = options?.chunkSize || 100;
  const denormalizeResponseEntities =
    options?.denormalizeResponseEntities || false;

  if (ids.length === 0) {
    return [] as any;
  }

  const uniqueIds = Array.from(new Set(ids));

  const allIds = uniqueIds.reduce(
    (acc: string[][], id: string, index: number) => {
      const chunkIndex = Math.floor(index / chunkSize);
      if (!acc[chunkIndex]) {
        acc[chunkIndex] = [];
      }
      acc[chunkIndex].push(id);

      return acc;
    },
    [] as string[][],
  );

  const allPages: T = [] as any;

  const chunkPromises = allIds.map((chunk) => {
    const chunkParams = {
      ...(params || {}),
      ...(generateParamsFromId(chunk) || {}),
    };

    return queryFunction(chunkParams);
  });

  const settledResponses = await Promise.allSettled(chunkPromises);
  settledResponses.forEach((settled) => {
    if (settled.status === 'fulfilled') {
      if (denormalizeResponseEntities) {
        allPages.push(...denormalisedResponseEntities(settled.value));
      } else if (settled.value.data.data) {
        allPages.push(...settled.value.data.data);
      }
    } else {
      console.error('Error fetching chunk:', settled.reason);
    }
  });

  return allPages;
};

export interface GETCompanyRaitingsQuery {
  page?: number;
  perPage?: number;

  orderCode?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Response structure for GET /company/[companyId]/ratings
 * Includes paginated ratings data with reviewer and order information
 */
export interface GETCompanyRatingsResponse {
  data: Array<
    RatingListing & {
      reviewer?: UserListing;
      order?: OrderListing;
    }
  >;
  pagination: {
    totalItems: number;
    totalPages: number;
    page: number;
    perPage: number;
  };
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<GETCompanyRatingsResponse | { message: string }>,
) => {
  const integrationSdk = getIntegrationSdk();
  const { method } = req;
  const { companyId, JSONParams } = req.query as unknown as {
    companyId: string;
    JSONParams: string;
  };

  // format Json PArams like GETCompanyRaitingsQuery
  const { page, perPage, endDate, orderCode, startDate } = JSONParams
    ? (JSON.parse(JSONParams) as GETCompanyRaitingsQuery)
    : ({} as GETCompanyRaitingsQuery);

  if (orderCode === 'MIGRATE') {
    const allRatings = await retrieveAll<RatingListing[]>(
      integrationSdk.listings.query,
      {
        meta_listingType: EListingType.rating,
      },
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const rating of allRatings) {
      const metadata = rating.attributes?.metadata;
      const orderId = metadata?.orderId;

      if (
        rating.attributes?.metadata?.companyId &&
        rating.attributes?.metadata?.orderCode &&
        typeof rating.attributes?.metadata?.timestamp === 'number'
      ) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(50);
      const orderListing: WithFlexSDKData<OrderListing> | undefined =
        // eslint-disable-next-line no-await-in-loop
        await integrationSdk.listings
          .show({
            id: orderId,
            meta_listingType: EListingType.order,
          })
          .catch((error: any) => {
            console.error('Error fetching order listing:', {
              orderId,
              error: String(error),
            });
          });

      if (!orderListing) {
        console.error('Order listing not found:', orderId);
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(50);
      // eslint-disable-next-line no-await-in-loop
      await integrationSdk.listings
        .update({
          id: rating.id?.uuid,
          metadata: {
            companyId: orderListing.data.data.attributes?.metadata?.companyId,
            orderCode: orderListing.data.data.attributes?.title,
            timestamp: rating.attributes?.metadata?.timestamp
              ? +(rating.attributes?.metadata?.timestamp || 0)
              : 0,
          },
        })
        .then(() => {
          console.log(
            'Updated rating listing:',
            rating.id,
            'with companyId',
            orderListing.data.data.attributes?.metadata?.companyId,
          );
        })
        .catch((error: any) => {
          console.error('Error updating rating listing:', String(error));
        });
    }

    return res.status(200).json({
      data: allRatings,
      pagination: {
        totalItems: allRatings.length,
        totalPages: 1,
        page: 1,
        perPage: allRatings.length,
      },
    });
  }

  const _page = Math.max(1, Number(page) || 1);
  const _perPage = Math.min(100, Number(perPage) || 10);

  if (method !== HttpMethod.GET) {
    return res.json({ message: 'Method not allowed' });
  }

  if (!companyId) {
    return res.status(400).json({ message: 'Missing companyId' });
  }

  try {
    const ratingListingsResponse = await integrationSdk.listings.query({
      meta_listingType: EListingType.rating,
      meta_companyId: companyId as string,
      ...(orderCode ? { meta_orderCode: orderCode } : {}),
      ...(startDate && endDate
        ? {
            // Fix: Set end date to end of day (23:59:59.999) to include same-day ranges
            // startDate: 2025-01-01 -> range: 2024-12-31T23:59:59.999Z to 2025-01-01T23:59:59.999Z
            meta_timestamp: `${new Date(startDate).valueOf() - 1},${new Date(
              endDate,
            ).setHours(23, 59, 59, 999)}`,
          }
        : {}),
      page: _page,
      perPage: _perPage,
      include: ['images'],
      'fields.image': [`variants.${EImageVariants.squareSmall2x}`],
    });

    const ratingListingsData: RatingListing[] = denormalisedResponseEntities(
      ratingListingsResponse,
    );

    // Extract pagination metadata
    const paginationMeta = ratingListingsResponse.data.meta;

    const reviewerIds = ratingListingsData.reduce((acc: string[], rating) => {
      const metadata = rating.attributes?.metadata;
      const reviewerId = metadata?.reviewerId;
      if (reviewerId) {
        acc.push(reviewerId);
      }

      return acc;
    }, []);

    const orderIds = ratingListingsData.reduce((acc: string[], rating) => {
      const metadata = rating.attributes?.metadata;
      const orderId = metadata?.orderId;
      if (orderId) {
        acc.push(orderId);
      }

      return acc;
    }, []);
    const ordersData = await retrieveAllByIdChunks<OrderListing[]>(
      integrationSdk.listings.query,
      (ids) => ({
        meta_id: ids,
      }),
      orderIds,
      {
        meta_listingType: EListingType.order,
      },
    );

    const reviewersData = await retrieveAllByIdChunks<UserListing[]>(
      integrationSdk.users.query,
      (ids) => ({
        meta_id: ids,
      }),
      reviewerIds,
      {
        include: ['profileImage'],
      },
      {
        denormalizeResponseEntities: true,
      },
    );

    const ratingsWithReviewersAndOrder = ratingListingsData.map((rating) => {
      const metadata = rating.attributes?.metadata;
      const reviewerId = metadata?.reviewerId;
      const reviewerData = reviewersData.find(
        (user) => user.id?.uuid === reviewerId,
      );
      const orderId = metadata?.orderId;
      const orderData = ordersData.find((order) => order.id?.uuid === orderId);

      const replies = metadata?.replies;
      const validReplies = replies?.filter(
        (reply) =>
          !(
            reply?.replyRole === EUserRole.partner &&
            (reply?.status === EPartnerReply.rejected ||
              reply?.status === EPartnerReply.pending)
          ),
      );
      rating.attributes!.metadata!.replies = validReplies;

      return {
        ...rating,
        reviewer: reviewerData,
        order: orderData,
      };
    });

    // Return data with pagination metadata
    res.status(200).json({
      data: ratingsWithReviewersAndOrder,
      pagination: {
        totalItems: paginationMeta?.totalItems || 0,
        totalPages: paginationMeta?.totalPages || 0,
        page: paginationMeta?.page || _page,
        perPage: paginationMeta?.perPage || _perPage,
      },
    });
  } catch (error) {
    console.error('Error fetching rating listing:', error);
    res.status(500).json({ message: 'Error fetching rating listing' });
  }
};

export default cookies(handler);
