/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { queryCollectionData } from '@services/firebase';
import { getIntegrationSdk, getSdk, handleError } from '@services/sdk';
import type {
  TFirebaseMemberOrder,
  TOrderDetail,
  TOrderDetailRestaurant,
  TShoppingCartMemberPlan,
} from '@src/types/order';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@utils/data';

const { NEXT_PUBLIC_FIREBASE_MEMBER_ORDERS_COLLECTION_NAME } = process.env;

/**
 * Get sub order from firestore
 * @param planId - plan id
 * @returns { TShoppingCartMemberPlan } - sub order
 */
export const getSubOrderFromFirestore = async ({
  planId,
  participantId,
}: {
  planId: string;
  participantId: string;
}): Promise<TShoppingCartMemberPlan | undefined> => {
  try {
    const memberOrdersFromFirestore: TFirebaseMemberOrder[] =
      await queryCollectionData({
        collectionName: NEXT_PUBLIC_FIREBASE_MEMBER_ORDERS_COLLECTION_NAME!,
        queryParams: {
          planId: {
            operator: '==',
            value: planId,
          },
          participantId: {
            operator: '==',
            value: participantId,
          },
          status: {
            operator: '==',
            value: 'pending',
          },
        },
        limitRecords: 1,
      });
    if (memberOrdersFromFirestore.length > 0) {
      return memberOrdersFromFirestore[0].planData ?? undefined;
    }
  } catch (error) {
    console.error(error);

    return undefined;
  }
};

const fetchSubOrder = async (
  orderDetail: TOrderDetail,
  currentUserId: string,
  planId: string,
) => {
  let orderDetailResult = {};
  const integrationSdk = getIntegrationSdk();
  const planKeys = Object.keys(orderDetail);

  for (const planKey of planKeys) {
    const { restaurant = {}, memberOrders = {} } = orderDetail[planKey] || {};
    const { foodList = {}, id: restaurantId } =
      restaurant as TOrderDetailRestaurant;

    // Fetch restaurant data
    const restaurantData = denormalisedResponseEntities(
      await integrationSdk.listings.show({
        id: restaurantId,
        include: ['images'],
        'fields.image': [
          'variants.landscape-crop',
          'variants.landscape-crop2x',
          'variants.landscape-crop4x',
          'variants.landscape-crop6x',
        ],
        expand: true,
      }),
    )[0];

    // Fetch food listings data
    const foodListIds = Object.keys(foodList);
    const foodListData = denormalisedResponseEntities(
      await integrationSdk.listings.query({
        ids: foodListIds.slice(0, 50),
        meta_listingType: 'food',
        include: ['images'],
        'fields.image': [
          'variants.landscape-crop',
          'variants.landscape-crop2x',
          'variants.landscape-crop4x',
          'variants.landscape-crop6x',
        ],
      }),
    );

    orderDetailResult = {
      ...orderDetailResult,
      [planKey]: {
        foodList: foodListData,
        restaurant: restaurantData,
        // Live food listings carry no fee — the fee is menu-scoped. Ship the
        // snapshot's value so the participant sees exactly what gets billed.
        foodExtraFees: Object.entries(foodList).reduce<Record<string, number>>(
          (result, [foodId, food]: [string, any]) => ({
            ...result,
            [foodId]: food?.foodExtraFee ?? 0,
          }),
          {},
        ),
        memberOrder: { [currentUserId]: memberOrders[currentUserId] },
      },
    };
  }
  // fetch mealPlan from firestore
  const subOrderFromFirestore = await getSubOrderFromFirestore({
    planId: planId as string,
    participantId: currentUserId,
  });
  if (subOrderFromFirestore) {
    orderDetailResult = Object.entries(orderDetailResult).reduce(
      (acc, [dayId, memberOrder]) => {
        return {
          ...acc,
          [dayId]: {
            ...(memberOrder as object),
            memberOrder: {
              [currentUserId]: subOrderFromFirestore[dayId]?.[currentUserId],
            },
          },
        };
      },
      {},
    );
  }

  return orderDetailResult;
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiMethod = req.method;
  const integrationSdk = getIntegrationSdk();
  const sdk = getSdk(req, res);

  switch (apiMethod) {
    case HttpMethod.GET:
      {
        const { planId } = req.query;

        if (!planId) {
          return res.status(400).json({
            message: 'Missing required keys',
          });
        }

        try {
          const currentUser = denormalisedResponseEntities(
            await sdk.currentUser.show(),
          )[0];

          const plan = denormalisedResponseEntities(
            await integrationSdk.listings.show({
              id: planId,
            }),
          )[0];
          const { orderId, orderDetail } = Listing(plan).getMetadata() as {
            orderId: string;
            orderDetail: TOrderDetail;
          };
          const order = denormalisedResponseEntities(
            await integrationSdk.listings.show({
              id: orderId,
            }),
          )[0];

          const currentUserId = CurrentUser(currentUser).getId();
          const mealPlan = await fetchSubOrder(
            orderDetail,
            currentUserId,
            planId as string,
          );

          res.json({
            statusCode: 200,
            meta: {},
            data: {
              plan: mealPlan,
              order,
            },
          });
        } catch (error: any) {
          console.error(error?.data?.errors);
          handleError(res, error);
        }
      }
      break;
    default:
      break;
  }
};

export default cookies(handler);
