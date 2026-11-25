/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { getMenuExtraFeeMap } from '@helpers/menuExtraFee';
import cookies from '@services/cookie';
import { getIntegrationSdk, getSdk, handleError } from '@services/sdk';
import type { MenuListing } from '@src/types';
import type { TOrderDetail, TOrderDetailRestaurant } from '@src/types/order';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@utils/data';

/**
 * Loads what the participant plan page shows for each delivery date: the
 * restaurant, the food listings, the menu's extra fees and the user's own pick.
 * @param orderDetail - `plan.metadata.orderDetail`.
 * @param currentUserId - The participant.
 * @returns The plan data keyed by delivery date.
 */
const fetchSubOrder = async (
  orderDetail: TOrderDetail,
  currentUserId: string,
) => {
  let orderDetailResult = {};
  const integrationSdk = getIntegrationSdk();
  const planKeys = Object.keys(orderDetail);
  const extraFeesByMenuId = new Map<string, Record<string, number>>();

  for (const planKey of planKeys) {
    const { restaurant = {}, memberOrders = {} } = orderDetail[planKey] || {};
    const {
      foodList = {},
      id: restaurantId,
      menuId,
    } = restaurant as TOrderDetailRestaurant;

    if (menuId && !extraFeesByMenuId.has(menuId)) {
      // A menu that cannot be read only loses the fee in the budget filter;
      // it must not break the whole plan page.
      const menu: MenuListing | null = await integrationSdk.listings
        .show({ id: menuId })
        .then((response: unknown) => denormalisedResponseEntities(response)[0])
        .catch(() => null);
      extraFeesByMenuId.set(menuId, getMenuExtraFeeMap(menu));
    }

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
        foodExtraFees: extraFeesByMenuId.get(menuId) || {},
        memberOrder: { [currentUserId]: memberOrders[currentUserId] },
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
          const mealPlan = await fetchSubOrder(orderDetail, currentUserId);

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
