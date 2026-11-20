import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { getIsAllowAddSecondaryFood } from '@helpers/orderHelper';
import cookies from '@services/cookie';
import { denormalisedResponseEntities } from '@services/data';
import { enqueueParticipantOrder } from '@services/jobs/processOrder.job';
import participantChecker from '@services/permissionChecker/participant';
import { getSdk } from '@services/sdk';
import type { TCartItem, TUpdateParticipantOrderBody } from '@src/types/order';
import {
  FailedResponse,
  HttpStatus,
  SuccessResponse,
} from '@src/utils/response';
import { Listing } from '@utils/data';
import type { TPlan } from '@utils/orderTypes';

/**
 * Validate cart item
 * @param dayId - Day id
 * @param cartItem - Cart item
 * @param isAllowedSecondaryFood - Is allowed secondary food
 * @param orderDetail - Order detail
 * @returns Error message if validation fails, null otherwise
 */
const validateCartItem = (
  dayId: string,
  cartItem: TCartItem,
  isAllowedSecondaryFood: boolean,
  orderDetail: TPlan['orderDetail'],
) => {
  const { foodId, secondaryFoodId } = cartItem;

  if (secondaryFoodId && !isAllowedSecondaryFood) {
    return 'Secondary food is not allowed for this order';
  }

  if (isAllowedSecondaryFood) {
    const dayOrderDetail = orderDetail[dayId];
    if (dayOrderDetail) {
      const { foodList = {} } = dayOrderDetail.restaurant || {};
      const selectedFood = foodList[foodId];
      if (selectedFood) {
        const { numberOfMainDishes } = selectedFood;
        const isSingleSelectionFood =
          numberOfMainDishes !== undefined &&
          numberOfMainDishes !== null &&
          Number(numberOfMainDishes) === 1;
        if (isSingleSelectionFood) {
          if (secondaryFoodId) {
            return `Cannot choose secondary food for single selection food for ${dayId}`;
          }
        } else if (!secondaryFoodId) {
          return `Please choose secondary food for ${dayId}`;
        }
      }
    }
  }

  return null;
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiMethod = req.method;
  const sdk = getSdk(req, res);
  switch (apiMethod) {
    case HttpMethod.POST: {
      try {
        const { orderId } = req.query;
        const { planId, orderDays, planData } =
          req.body as TUpdateParticipantOrderBody;
        const currentUser = await sdk.currentUser.show();
        const [user] = denormalisedResponseEntities(currentUser);
        const participantId = user?.id?.uuid;
        if (!participantId) {
          return new FailedResponse({
            status: HttpStatus.UNAUTHORIZED,
            message: 'Unauthorized',
          }).send(res);
        }
        const order = await sdk.listings.show({ id: orderId as string });
        const [orderListing] = denormalisedResponseEntities(order);
        if (!orderListing) {
          return new FailedResponse({
            status: HttpStatus.NOT_FOUND,
            message: 'Order not found',
          }).send(res);
        }
        const plan = await sdk.listings.show({ id: planId });
        const [planListing] = denormalisedResponseEntities(plan);
        if (!planListing) {
          return new FailedResponse({
            status: HttpStatus.NOT_FOUND,
            message: 'Plan not found',
          }).send(res);
        }
        // check if order is valid with case allowed secondary food
        const isAllowedSecondaryFood = getIsAllowAddSecondaryFood(orderListing);

        const planMetadata = Listing(planListing).getMetadata();
        const orderDetail = planMetadata.orderDetail || {};

        if (planData) {
          const entries = Object.entries(planData);
          for (let i = 0; i < entries.length; i += 1) {
            const [dayId, members] = entries[i];
            const memberEntries = Object.entries(members);
            for (let j = 0; j < memberEntries.length; j += 1) {
              const error = validateCartItem(
                dayId,
                memberEntries[j][1],
                isAllowedSecondaryFood,
                orderDetail,
              );
              if (error) {
                return new FailedResponse({
                  status: HttpStatus.BAD_REQUEST,
                  message: error,
                }).send(res);
              }
            }
          }
        }

        const queued = await enqueueParticipantOrder({
          orderId,
          planId,
          orderDays,
          planData,
          currentUserId: participantId,
        });
        if (!queued) {
          return new FailedResponse({
            status: HttpStatus.CONFLICT,
            message: 'Previous order of this participant is still processing',
          }).send(res);
        }

        return new SuccessResponse({
          data: queued,
          message: 'Order queued',
        }).send(res);
      } catch (error) {
        return new FailedResponse({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to place order',
          error: error as string,
        }).send(res);
      }
    }
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
};

export default cookies(participantChecker(handler));
