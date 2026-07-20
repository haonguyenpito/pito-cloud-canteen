import chunk from 'lodash/chunk';
import flatten from 'lodash/flatten';

import { getIntegrationSdk } from '@services/sdk';
import type { TListing, TObject } from '@src/utils/types';
import { denormalisedResponseEntities, Listing } from '@utils/data';
import {
  type EMenuMealType,
  EImageVariants,
  EParticipantOrderStatus,
} from '@utils/enums';

// query all page
const calculateRemainPages = (meta: any) => {
  const { totalPages = 1 } = meta;
  if (totalPages <= 1) return [];

  return new Array(totalPages - 1).fill(0).map((_v, i) => i + 2);
};

export const queryAllPages = async ({
  sdkModel,
  query,
  include,
  pagesPerRequest = 100,
  fields = {},
}: any) => {
  const resultsByPage: Record<number, any[]> = {};
  const queryPage = async ({ page }: any) => {
    const response = await sdkModel.query({
      include,
      pagesPerRequest,
      ...fields,
      ...query,
      page,
    });
    resultsByPage[page] = denormalisedResponseEntities(response);

    return response;
  };
  // query first page to get meta
  const firstResponse = await queryPage({ page: 1 });
  const { meta } = firstResponse.data;
  const remainPages = calculateRemainPages(meta);
  if (remainPages.length) {
    await Promise.all(remainPages.map((page) => queryPage({ page })));
  }

  return [1, ...remainPages].flatMap((page) => resultsByPage[page]);
};

export const queryAllUsers = async ({ query, include = [] }: any = {}) => {
  return queryAllPages({
    sdkModel: getIntegrationSdk().users,
    include,
    query,
  });
};

export const queryAllListings = async ({ query, include = [] }: any = {}) => {
  return queryAllPages({
    sdkModel: getIntegrationSdk().listings,
    include,
    query,
  });
};

export const queryAllTransactions = async ({
  query,
  include = [],
}: any = {}) => {
  return queryAllPages({
    sdkModel: getIntegrationSdk().transactions,
    include,
    query,
  });
};

export type TCheckUnConflictedParams = {
  mealType: EMenuMealType;
  mealTypes?: EMenuMealType[];
  daysOfWeek: string[];
  restaurantId: string;
  id?: string;
  startDate: number;
  endDate: number;
};

export const prepareNewOrderDetailPlan = ({
  newMemberIds,
  planListing,
}: {
  newMemberIds: string[];
  planListing: TListing;
}) => {
  const { orderDetail = {} } = Listing(planListing).getMetadata();
  const newOrderDetail = Object.entries(orderDetail).reduce<TObject>(
    (result, [date, orderDetailByDate]) => {
      const { memberOrders = {} } = (orderDetailByDate as TObject) || {};

      result[date].memberOrders = newMemberIds.reduce((res, memberId) => {
        res[memberId] = {
          foodId: '',
          status: EParticipantOrderStatus.empty,
          ...res[memberId],
        };

        return res;
      }, memberOrders);

      return result;
    },
    orderDetail,
  );

  return newOrderDetail;
};

export const fetchListingsByChunkedIds = async (ids: string[], sdk: any) => {
  const listingsResponse = await Promise.all(
    chunk<string>(ids, 100).map(async (_ids) => {
      const response = await sdk.listings.query({
        ids: _ids,
      });

      return denormalisedResponseEntities(response);
    }),
  );

  return flatten(listingsResponse);
};

export const fetchUserByChunkedIds = async (ids: string[], sdk: any) => {
  const usersResponse = await Promise.all(
    chunk<string>(ids, 100).map(async (_ids) => {
      const response = await sdk.users.query({
        meta_id: _ids,
      });

      return denormalisedResponseEntities(response);
    }),
  );

  return flatten(usersResponse);
};

export const queryAllFoodIdList = (foodIdList: [] | any, nutritions: []) => {
  return {
    ids: foodIdList,
    ...(nutritions.length > 0
      ? { pub_specialDiets: `has_any:${nutritions.join(',')}` }
      : {}),
    meta_isFoodEnable: true,
    meta_isFoodDeleted: false,
    include: ['images'],
    'fields.image': [`variants.${EImageVariants.default}`],
  };
};
