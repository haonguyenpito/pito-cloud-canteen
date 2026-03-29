import difference from 'lodash/difference';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import logger from '@helpers/logger';
import cookies from '@services/cookie';
import { emailSendingFactory, EmailTemplateTypes } from '@services/email';
import { getIntegrationSdk, handleError } from '@services/sdk';
import type { TPlan } from '@src/utils/orderTypes';
import type { TObject } from '@src/utils/types';
import { denormalisedResponseEntities, Listing } from '@utils/data';
import { EParticipantOrderStatus } from '@utils/enums';
import { removeParticipantFromOrderDetail } from '@utils/order';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const integrationSdk = getIntegrationSdk();

  const apiMethod = req.method;
  switch (apiMethod) {
    case HttpMethod.POST:
      try {
        const {
          query: { orderId = '' },
          body: {
            email = '',
            planId = '',
            nonAccountEmails,
            userIds: userIdsFromBody = [],
          },
        } = req;

        const [orderListing] = denormalisedResponseEntities(
          await integrationSdk.listings.show({
            id: orderId,
          }),
        );
        const {
          participants = [],
          anonymous = [],
          removedParticipants = [],
        } = Listing(orderListing).getMetadata();

        const needUpdateNoAccountEmails =
          typeof nonAccountEmails !== 'undefined';

        let userIds: string[] = [];

        if (isEmpty(userIdsFromBody) && !isEmpty(email)) {
          let user;

          try {
            [user] = denormalisedResponseEntities(
              await integrationSdk.users.show({
                email,
              }),
            );
          } catch (errorFetchUser: any) {
            logger.error(
              'Fetch user error in path: /api/orders/[orderId]/participant',
              String(errorFetchUser),
            );
          }

          if (!user) {
            if (needUpdateNoAccountEmails) {
              // TODO: update participant list
              await integrationSdk.listings.update({
                id: orderId,
                metadata: {
                  nonAccountEmails,
                },
              });
            }

            res.json({
              errorCode: 'user_not_found',
              message: `Email ${email} chưa có tài khoản`,
            });

            return;
          }

          userIds.push(user?.id?.uuid);

          if (participants.includes(user?.id?.uuid)) {
            res.json({
              errorCode: 'user_already_in_list',
              message: `Đã tồn tại trong danh sách thành viên`,
            });

            return;
          }
        } else {
          userIds = userIdsFromBody;
        }

        // TODO: update participant list
        if (!isEmpty(userIds) || needUpdateNoAccountEmails) {
          await integrationSdk.listings.update({
            id: orderId,
            metadata: {
              ...(!isEmpty(userIds)
                ? {
                    participants: uniq(participants.concat(userIds)),
                    ...(isEmpty(anonymous)
                      ? {}
                      : { anonymous: difference(anonymous, userIds) }),
                  }
                : {}),
              ...(needUpdateNoAccountEmails ? { nonAccountEmails } : {}),
              ...(removedParticipants.length > 0
                ? {
                    removedParticipants: difference(
                      removedParticipants,
                      userIds,
                    ),
                  }
                : {}),
            },
          });
        }

        if (!isEmpty(planId)) {
          const [planListing] = denormalisedResponseEntities(
            await integrationSdk.listings.show({
              id: planId,
            }),
          );
          const { orderDetail } = Listing(planListing).getMetadata();

          const newOrderDetail = Object.entries(orderDetail).reduce(
            (result, current) => {
              const [date, orderDetailOnDate] = current;
              const { memberOrders } = orderDetailOnDate as TObject;

              const newMemberOrders = userIds.reduce(
                (memberOrderRes, userId) => {
                  return {
                    [userId]: {
                      foodId: '',
                      status: EParticipantOrderStatus.empty,
                    },
                    ...memberOrderRes,
                  };
                },
                memberOrders,
              );

              return {
                ...result,
                [date]: {
                  ...(orderDetailOnDate as TObject),
                  memberOrders: newMemberOrders,
                },
              };
            },
            {},
          );

          await integrationSdk.listings.update({
            id: planId,
            metadata: {
              orderDetail: newOrderDetail,
            },
          });

          userIds.forEach(async (userId: string) =>
            emailSendingFactory(
              EmailTemplateTypes.PARTICIPANT.PARTICIPANT_ORDER_PICKING,
              {
                orderId,
                participantId: userId,
              },
            ),
          );
        }

        res.status(200).json({
          message: `Successfully add participant, email: ${email} and ids: ${userIds}`,
        });
      } catch (error) {
        logger.error(
          'Error in path: /api/orders/[orderId]/participant',
          String(error),
        );
        handleError(res, error);
      }
      break;
    case HttpMethod.DELETE:
      try {
        const {
          query: { orderId = '' },
          body: { planId, participantId = '' },
        } = req;

        if (isEmpty(participantId)) {
          res.status(400).json({ message: 'Missing participantId' });

          return;
        }

        const [orderListing] = denormalisedResponseEntities(
          await integrationSdk.listings.show({
            id: orderId as string,
          }),
        );
        const { participants = [], removedParticipants = [] } =
          Listing(orderListing).getMetadata();

        const newParticipants = participants.filter(
          (pId: string) => pId !== participantId,
        );

        await integrationSdk.listings.update({
          id: orderId as string,
          metadata: {
            participants: newParticipants,
            removedParticipants: uniq([...removedParticipants, participantId]),
          },
        });

        if (!isEmpty(planId)) {
          const [planListing] = denormalisedResponseEntities(
            await integrationSdk.listings.show({
              id: planId as string,
            }),
          );
          const { orderDetail = {} } = Listing(planListing).getMetadata();
          const newOrderDetail = removeParticipantFromOrderDetail(
            orderDetail as TPlan['orderDetail'],
            participantId,
          );

          await integrationSdk.listings.update({
            id: planId as string,
            metadata: {
              orderDetail: newOrderDetail,
            },
          });
        }

        res.json({
          statusCode: 200,
          message: `Successfully delete participant, participantId: ${participantId}`,
        });
      } catch (error) {
        handleError(res, error);
      }
      break;
    default:
      break;
  }
}

export default cookies(handler);
