/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * ⚠️ BEHAVIORAL CONTRACT — transit.api.ts (Admin Sub-Order State Machine Hub)
 *
 * PURPOSE: All Sharetribe sub-order state transitions (START_DELIVERY,
 * COMPLETE_DELIVERY, OPERATOR_CANCEL_*) route through this single endpoint.
 * It is the exclusive control point for sub-order delivery lifecycle.
 *
 * WHY ALL TRANSITIONS ARE OPERATOR-ONLY:
 *   - The Sharetribe transaction process uses `operator` actor for every
 *     post-initiation transition. Partners cannot self-confirm or self-reject.
 *   - This ensures PITO controls the entire delivery lifecycle and can intervene
 *     at any stage without partner or customer action.
 *   - Changing any transition to `customer` or `provider` actor requires a
 *     Sharetribe CLI deploy of process.edn — it cannot be done via API.
 *
 * WHY START_DELIVERY vs COMPLETE_DELIVERY FIRE DIFFERENT SIDE EFFECTS:
 *   - START_DELIVERY: notifies participants + booker that food is on the way.
 *     No scheduler created (delivery is already in progress).
 *   - COMPLETE_DELIVERY: notifies participants + booker of completion, THEN:
 *     1. Creates an EventBridge scheduler to send food rating notifications
 *        after TIME_TO_SEND_FOOD_RATING_NOTIFICATION minutes.
 *     2. Calls transitionOrderStatus to check if all sub-orders are complete
 *        and advance the parent order state if so.
 *   - The rating scheduler must be created AFTER delivery completion, not before.
 *     Creating it at START_DELIVERY would fire before food is received.
 *
 * WHY OPERATOR_CANCEL_* VARIANTS ALL SHARE THE SAME HANDLER:
 *   - OPERATOR_CANCEL_PLAN, OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED, and
 *     OPERATOR_CANCEL_AFTER_PARTNER_REJECTED differ only in which Sharetribe
 *     state they are valid from. The side effects (email, Firebase, payment
 *     modification, quotation update) are identical for all cancel paths.
 *   - modifyPaymentWhenCancelSubOrderService is called with Promise.allSettled
 *     (not Promise.all) to ensure payment modification failures do not prevent
 *     the order status transition from completing.
 *
 * INVARIANT: updatePlanListing(transition) is ALWAYS called at the end of every
 * successful transition to persist the lastTransition on the plan's orderDetail.
 * If you add a new transition case, ensure it also calls updatePlanListing.
 *
 * ADMIN-ONLY: This endpoint is wrapped with adminChecker — non-admin callers
 * receive 403. Do not remove the permission checker.
 */
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import { DateTime } from 'luxon';
import type { NextApiRequest, NextApiResponse } from 'next';

import { composeApiCheckers, HttpMethod } from '@apis/configs';
import { CustomError, EHttpStatusCode } from '@apis/errors';
import { convertDateToVNTimezone } from '@helpers/dateHelpers';
import logger from '@helpers/logger';
import { pushNativeNotificationSubOrderDate } from '@pages/api/helpers/pushNotificationOrderDetailHelper';
import createQuotation from '@pages/api/orders/[orderId]/quotation/create-quotation.service';
import { createFoodRatingNotificationScheduler } from '@services/awsEventBrigdeScheduler';
import { emailSendingFactory, EmailTemplateTypes } from '@services/email';
import { fetchListing, fetchUser } from '@services/integrationHelper';
import {
  createNativeNotification,
  createNativeNotificationToBooker,
} from '@services/nativeNotification';
import { createFirebaseDocNotification } from '@services/notifications';
import adminChecker from '@services/permissionChecker/admin';
import { getIntegrationSdk, handleError } from '@services/sdk';
import { createSlackNotification } from '@services/slackNotification';
import type { RatingListing } from '@src/types';
import {
  denormalisedResponseEntities,
  Listing,
  Transaction,
} from '@src/utils/data';
import { VNTimezone } from '@src/utils/dates';
import {
  EBookerNativeNotificationType,
  EListingType,
  ENativeNotificationType,
  ENotificationType,
  EQuotationStatus,
  ESlackNotificationType,
} from '@src/utils/enums';
import { isTransactionsTransitionInvalidTransition } from '@src/utils/errors';
import { ETransition } from '@src/utils/transaction';
import type { TError } from '@src/utils/types';

import { modifyPaymentWhenCancelSubOrderService } from '../payment/modify-payment-when-cancel-sub-order.service';

import { transitionOrderStatus } from './transition-order-status.service';

const { TIME_TO_SEND_FOOD_RATING_NOTIFICATION } = process.env;

export function createFoodRatingNotificationSchedulerWhenOrderComplete({
  orderId,
  participantIds,
  subOrderDate,
  planId,
}: {
  orderId: string;
  participantIds: string[];
  subOrderDate: number;
  planId: string;
}) {
  const startTimestamp = DateTime.fromMillis(subOrderDate)
    .setZone(VNTimezone)
    .startOf('day')
    .toMillis();

  const now = new Date();
  const numberOfMinutesDeferToSentFoodRatingNotification = Number(
    TIME_TO_SEND_FOOD_RATING_NOTIFICATION,
  );

  const _timeExpression = convertDateToVNTimezone(
    new Date(
      now.setMinutes(
        now.getMinutes() + numberOfMinutesDeferToSentFoodRatingNotification,
      ),
    ),
  );

  createFoodRatingNotificationScheduler({
    customName: `sendFRN_${orderId}_${startTimestamp}`,
    timeExpression: _timeExpression,
    params: {
      orderId,
      participantIds,
      subOrderDate: startTimestamp,
      planId,
    },
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;
    const integrationSdk = getIntegrationSdk();
    const { txId, transition } = req.body;

    if (isEmpty(txId) || isEmpty(transition)) {
      return handleError(
        res,
        new CustomError(
          'Missing transaction ID or transition',
          EHttpStatusCode.BadRequest,
        ),
      );
    }

    if (!Object.values(ETransition).includes(transition)) {
      return handleError(
        res,
        new CustomError(
          `Invalid transition: ${transition}`,
          EHttpStatusCode.BadRequest,
        ),
      );
    }

    switch (apiMethod) {
      case HttpMethod.POST: {
        const txResponse = await integrationSdk.transactions.transition(
          {
            id: txId,
            transition,
            params: {},
          },
          { expand: true, include: ['booking', 'listing', 'provider'] },
        );

        const tx = denormalisedResponseEntities(txResponse)[0];
        const txGetter = Transaction(tx);
        const {
          participantIds = [],
          orderId,
          anonymous = [],
        } = txGetter.getMetadata();

        const { booking, listing } = txGetter.getFullData();
        const listingGetter = Listing(listing);
        const restaurantId = listingGetter.getId();
        const { displayStart } = booking.attributes;
        const timestamp = new Date(displayStart).getTime();
        const startTimestamp = DateTime.fromMillis(timestamp)
          .setZone(VNTimezone)
          .startOf('day')
          .toMillis();
        const order = await fetchListing(orderId);
        const orderListing = Listing(order);
        const {
          plans = [],
          quotationId,
          companyId,
          bookerId,
        } = orderListing.getMetadata();
        const { title: orderTitle } = orderListing.getAttributes();
        const { orderName } = orderListing.getPublicData();
        const generalNotificationData = {
          orderId,
          orderTitle,
          planId: plans[0],
          subOrderDate: startTimestamp,
        };
        const plan = await fetchListing(plans[0]);
        const planListing = Listing(plan);
        const planId = planListing.getId();

        const reviews: RatingListing[] = denormalisedResponseEntities(
          await integrationSdk.listings.query({
            meta_listingType: EListingType.rating,
            meta_orderId: orderId,
            meta_timestamp: timestamp,
          }),
        );

        const reviewerIds = new Set(
          reviews.map((review) => review.attributes?.metadata?.reviewerId),
        );

        const participantNotReviewIds = participantIds.filter(
          (participant: string) => !reviewerIds.has(participant),
        );

        const booker = await fetchUser(bookerId);

        const { orderDetail = {}, slackThreadTs } = planListing.getMetadata();
        const { memberOrders = {}, restaurant = {} } =
          orderDetail[startTimestamp];
        const { foodList = {} } = restaurant;

        const updatePlanListing = async (lastTransition: string) => {
          const newOrderDetail = {
            ...orderDetail,
            [startTimestamp]: {
              ...orderDetail[startTimestamp],
              lastTransition,
            },
          };

          await integrationSdk.listings.update({
            id: planId,
            metadata: {
              orderDetail: newOrderDetail,
            },
          });
        };

        logger.info('Transition', transition);

        switch (transition) {
          case ETransition.START_DELIVERY: {
            [...participantIds, ...anonymous].forEach(
              (participantId: string) => {
                createFirebaseDocNotification(
                  ENotificationType.ORDER_DELIVERING,
                  {
                    ...generalNotificationData,
                    userId: participantId,
                  },
                );
              },
            );
            createNativeNotificationToBooker(
              EBookerNativeNotificationType.SubOrderDelivering,
              {
                booker,
                order,
                subOrderDate: `${startTimestamp}`,
              },
            );
            break;
          }
          case ETransition.COMPLETE_DELIVERY: {
            [...participantIds, ...anonymous].forEach(
              (participantId: string) => {
                createFirebaseDocNotification(ENotificationType.ORDER_SUCCESS, {
                  ...generalNotificationData,
                  userId: participantId,
                });
                const { foodId } = memberOrders[participantId] || {};

                if (foodId) {
                  const { foodName = '' } = foodList[foodId];
                  createNativeNotification(
                    ENativeNotificationType.AdminTransitSubOrderToDelivered,
                    {
                      participantId,
                      planId,
                      subOrderDate: startTimestamp.toString(),
                      foodName,
                    },
                  );
                }
              },
            );

            createFoodRatingNotificationSchedulerWhenOrderComplete({
              orderId,
              participantIds: participantNotReviewIds,
              subOrderDate: timestamp,
              planId,
            });

            createFirebaseDocNotification(
              ENotificationType.BOOKER_SUB_ORDER_COMPLETED,
              {
                userId: bookerId,
                orderId,
                subOrderDate: startTimestamp,
              },
            );
            createNativeNotificationToBooker(
              EBookerNativeNotificationType.SubOrderDelivered,
              {
                booker,
                order,
                subOrderDate: `${startTimestamp}`,
              },
            );

            await transitionOrderStatus(order, plan, integrationSdk);
            break;
          }
          case ETransition.OPERATOR_CANCEL_PLAN:
          case ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED:
          case ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED: {
            logger.info('Operator cancel plan', String(participantIds));

            emailSendingFactory(
              EmailTemplateTypes.BOOKER.BOOKER_SUB_ORDER_CANCELED,
              {
                orderId,
                timestamp,
              },
            );

            [...participantIds, ...anonymous].forEach(
              (participantId: string) => {
                const { foodId } = memberOrders[participantId] || {};
                if (foodId) {
                  emailSendingFactory(
                    EmailTemplateTypes.PARTICIPANT
                      .PARTICIPANT_SUB_ORDER_CANCELED,
                    {
                      orderId,
                      timestamp,
                      participantId,
                    },
                  );
                  createNativeNotification(
                    ENativeNotificationType.AdminTransitSubOrderToCanceled,
                    {
                      participantId,
                      planId,
                      subOrderDate: startTimestamp.toString(),
                    },
                  );
                }
              },
            );

            await pushNativeNotificationSubOrderDate(
              restaurantId,
              String(startTimestamp),
              order,
              ENativeNotificationType.AdminTransitSubOrderToCanceled,
              integrationSdk,
            );

            emailSendingFactory(
              EmailTemplateTypes.PARTNER.PARTNER_SUB_ORDER_CANCELED,
              {
                orderId,
                timestamp,
                restaurantId,
              },
            );

            [...participantIds, ...anonymous].map(
              async (participantId: string) => {
                createFirebaseDocNotification(ENotificationType.ORDER_CANCEL, {
                  ...generalNotificationData,
                  userId: participantId,
                });
              },
            );

            const quotation = await fetchListing(quotationId);
            const quotationListing = Listing(quotation);
            const { client, partner } = quotationListing.getMetadata();
            const newClient = {
              ...client,
              quotation: omit(client.quotation, [`${startTimestamp}`]),
            };

            const newPartner = {
              ...partner,
              [restaurantId]: {
                ...partner[restaurantId],
                quotation: omit(partner[restaurantId].quotation, [
                  `${startTimestamp}`,
                ]),
              },
            };
            integrationSdk.listings.update({
              id: quotationId,
              metadata: {
                status: EQuotationStatus.INACTIVE,
              },
            });
            createQuotation({
              orderId,
              companyId,
              client: newClient,
              partner: newPartner,
            });

            createFirebaseDocNotification(
              ENotificationType.BOOKER_SUB_ORDER_CANCELLED,
              {
                userId: bookerId,
                orderId,
                subOrderDate: startTimestamp,
              },
            );

            await Promise.allSettled([
              modifyPaymentWhenCancelSubOrderService({
                order,
                subOrderDate: startTimestamp,
                clientQuotation: newClient,
                partnerQuotation: newPartner,
              }),
              transitionOrderStatus(order, plan, integrationSdk),
              createNativeNotificationToBooker(
                EBookerNativeNotificationType.SubOrderCancelled,
                {
                  booker,
                  order,
                  subOrderDate: `${startTimestamp}`,
                },
              ),
            ]);

            createSlackNotification(ESlackNotificationType.SUB_ORDER_CANCELED, {
              subOrderCanceledData: {
                threadTs: slackThreadTs,
                orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderId}`,
                orderCode: orderTitle,
                orderName,
                date: convertDateToVNTimezone(new Date(startTimestamp)).split(
                  'T',
                )[0],
              },
            });
            break;
          }

          default:
            break;
        }

        await updatePlanListing(transition);

        return res.status(200).json({
          message: 'Successfully transit transaction',
          tx,
        });
      }
      default:
        break;
    }
  } catch (error) {
    logger.error('Error in admin/plan/transit.api.ts', String(error));

    if (isTransactionsTransitionInvalidTransition(error as TError)) {
      handleError(
        res,
        new CustomError('Invalid transition', EHttpStatusCode.Conflict),
      );
    } else {
      handleError(res, error);
    }
  }
}

export default composeApiCheckers(adminChecker)(handler);
