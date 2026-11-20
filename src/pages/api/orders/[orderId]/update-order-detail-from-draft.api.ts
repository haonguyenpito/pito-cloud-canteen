import omit from 'lodash/omit';
import { DateTime } from 'luxon';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { convertDateToVNTimezone } from '@helpers/dateHelpers';
import logger from '@helpers/logger';
import { keepServerOwnedSubOrderFields } from '@helpers/order/orderDetailHelper';
import { pushNotificationOrderDetailChanged } from '@pages/api/helpers/orderDetailHelper';
import cookies from '@services/cookie';
import { denormalisedResponseEntities } from '@services/data';
import { withPlanLock } from '@services/distributedLock';
import { emailSendingFactory, EmailTemplateTypes } from '@services/email';
import { fetchUserListing } from '@services/integrationHelper';
import orderEditorChecker from '@services/permissionChecker/orderEditor';
import { getIntegrationSdk, handleError } from '@services/sdk';
import { createSlackNotification } from '@services/slackNotification';
import type {
  FoodListing,
  OrderDetail,
  OrderListing,
  PlanListing,
  WithFlexSDKData,
} from '@src/types';
import { Listing } from '@src/utils/data';
import { VNTimezone, weekDayFormatFromDateTime } from '@src/utils/dates';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import {
  EOrderStates,
  EOrderType,
  ESlackNotificationType,
} from '@src/utils/enums';

import { normalizeOrderDetail } from '../utils';

type DifferentOrderDetailMember = {
  oldFoodId?: string;
  oldSecondaryFoodId?: string;
  oldFoodName?: string;
  oldSecondaryFoodName?: string;
  newFoodId?: string;
  newSecondaryFoodId?: string;
  newFoodName?: string;
  newSecondaryFoodName?: string;
  memberName: string;
  restaurantName: string;
};

type DifferentOrderDetailLineItem = {
  foodId?: string;
  foodName?: string;
  oldQuantity?: number;
  newQuantity?: number;
};

type DifferentOrderDetailValue = {
  memberOrders?: {
    [memberId: string]: DifferentOrderDetailMember;
  };
  lineItems?: DifferentOrderDetailLineItem[];
};

export type DifferentOrderDetail = {
  [date: string]: DifferentOrderDetailValue;
};

const notifyParticipantChangedGroupOrderFoods = async (
  orderListing: OrderListing,
  planListing: PlanListing,
  newOrderDetail: OrderDetail,
  oldOrderDetail: OrderDetail,
  by: 'admin' | 'booker',
) => {
  const diffentOrderDetail = await Object.keys(newOrderDetail).reduce(
    async (accPromise, date) => {
      const acc = await accPromise;
      const newMemberOrders = newOrderDetail[date]?.memberOrders;
      const oldMemberOrders = oldOrderDetail[date]?.memberOrders;
      const restaurantName =
        newOrderDetail[date]?.restaurant?.restaurantName || '';

      const differentMemberOrders = await Object.keys(
        newMemberOrders || {},
      ).reduce(
        async (_memberAcc, memberId) => {
          const memberAcc = await _memberAcc;

          const member = await fetchUserListing(memberId);

          if (
            newMemberOrders?.[memberId]?.foodId !==
            oldMemberOrders?.[memberId]?.foodId
          ) {
            return {
              ...memberAcc,
              [memberId]: {
                oldFoodId: oldMemberOrders?.[memberId]?.foodId,
                oldSecondaryFoodId:
                  oldMemberOrders?.[memberId]?.secondaryFoodId,
                newFoodId: newMemberOrders?.[memberId]?.foodId,
                newSecondaryFoodId:
                  newMemberOrders?.[memberId]?.secondaryFoodId,
                restaurantName,
                memberName: buildFullName(
                  member?.attributes?.profile?.firstName,
                  member?.attributes?.profile?.lastName,
                  {
                    compareToGetLongerWith:
                      member?.attributes?.profile?.displayName,
                  },
                ),
              },
            };
          }

          if (
            newMemberOrders?.[memberId]?.status === 'notAllowed' &&
            oldMemberOrders?.[memberId]?.status !== 'notAllowed'
          ) {
            return {
              ...memberAcc,
              [memberId]: {
                oldFoodId: oldMemberOrders?.[memberId]?.foodId,
                oldSecondaryFoodId:
                  oldMemberOrders?.[memberId]?.secondaryFoodId,
                newFoodId: undefined,
                newSecondaryFoodId: undefined,
                restaurantName,
                memberName: buildFullName(
                  member?.attributes?.profile?.firstName,
                  member?.attributes?.profile?.lastName,
                  {
                    compareToGetLongerWith:
                      member?.attributes?.profile?.displayName,
                  },
                ),
              },
            };
          }

          if (
            oldMemberOrders?.[memberId]?.status === 'notAllowed' &&
            newMemberOrders?.[memberId]?.status !== 'notAllowed'
          ) {
            return {
              ...memberAcc,
              [memberId]: {
                oldFoodId: undefined,
                oldSecondaryFoodId: undefined,
                newFoodId: newMemberOrders?.[memberId]?.foodId,
                newSecondaryFoodId:
                  newMemberOrders?.[memberId]?.secondaryFoodId,
                restaurantName,
                memberName: buildFullName(
                  member?.attributes?.profile?.firstName,
                  member?.attributes?.profile?.lastName,
                  {
                    compareToGetLongerWith:
                      member?.attributes?.profile?.displayName,
                  },
                ),
              },
            };
          }

          return memberAcc;
        },
        Promise.resolve({}) as Promise<{
          [memberId: string]: DifferentOrderDetailMember;
        }>,
      );

      if (Object.keys(differentMemberOrders).length) {
        const distinctFoodIds = Object.values(differentMemberOrders).reduce(
          (
            foodIds,
            { oldFoodId, newFoodId, oldSecondaryFoodId, newSecondaryFoodId },
          ) => {
            if (oldFoodId && !foodIds.includes(oldFoodId)) {
              foodIds = [...foodIds, oldFoodId];
            }
            if (oldSecondaryFoodId && !foodIds.includes(oldSecondaryFoodId)) {
              foodIds = [...foodIds, oldSecondaryFoodId];
            }

            if (newFoodId && !foodIds.includes(newFoodId)) {
              foodIds = [...foodIds, newFoodId];
            }
            if (newSecondaryFoodId && !foodIds.includes(newSecondaryFoodId)) {
              foodIds = [...foodIds, newSecondaryFoodId];
            }

            return foodIds;
          },
          [] as string[],
        );

        const integrationSdk = getIntegrationSdk();
        const foodListings: WithFlexSDKData<FoodListing[]> =
          await integrationSdk.listings.query({
            ids: distinctFoodIds,
          });

        const foodNameMap = foodListings.data.data.reduce(
          (accFoodNameMap, foodListing) =>
            foodListing.id?.uuid
              ? {
                  ...accFoodNameMap,
                  [foodListing.id.uuid]: foodListing.attributes?.title || '',
                }
              : accFoodNameMap,
          {} as {
            [foodId: string]: string;
          },
        );

        const memberOrders = Object.keys(differentMemberOrders).reduce(
          (memberAcc, memberId) => {
            const {
              oldFoodId,
              newFoodId,
              oldSecondaryFoodId,
              newSecondaryFoodId,
              memberName,
            } = differentMemberOrders[memberId];

            return {
              ...memberAcc,
              [memberId]: {
                oldFoodId,
                oldSecondaryFoodId,
                oldFoodName: oldFoodId ? foodNameMap[oldFoodId] : undefined,
                oldSecondaryFoodName: oldSecondaryFoodId
                  ? foodNameMap[oldSecondaryFoodId]
                  : undefined,
                newFoodId,
                newSecondaryFoodId,
                newFoodName: newFoodId ? foodNameMap[newFoodId] : undefined,
                newSecondaryFoodName: newSecondaryFoodId
                  ? foodNameMap[newSecondaryFoodId]
                  : undefined,
                memberName,
                restaurantName,
              },
            };
          },
          {} as {
            [memberId: string]: DifferentOrderDetailMember;
          },
        );

        return {
          ...acc,
          [date]: {
            memberOrders,
          },
        };
      }

      return acc;
    },
    Promise.resolve({}) as Promise<DifferentOrderDetail>,
  );

  const emailParamsForBookerNotification: {
    orderId: string;
    changeHistory: {
      oldData?: { title?: string; content?: string };
      newData?: { title?: string; content?: string };
    }[];
  } = {
    orderId: orderListing.id?.uuid!,
    changeHistory: Object.keys(diffentOrderDetail)
      .map((date) => {
        const { memberOrders } = diffentOrderDetail[date];

        if (!memberOrders) {
          return [];
        }

        return Object.keys(memberOrders).map((memberId) => {
          const {
            oldFoodName,
            newFoodName,
            oldSecondaryFoodName,
            newSecondaryFoodName,
            memberName,
          } = memberOrders[memberId];
          const type =
            (!oldFoodName && newFoodName && ('add' as const)) ||
            (!newFoodName && oldFoodName && ('remove' as const)) ||
            ('update' as const);

          const weekDay = `${weekDayFormatFromDateTime(
            DateTime.fromMillis(Number(+date)).setZone(VNTimezone),
          )}:`;

          if (type === 'add') {
            return {
              oldData: {
                title: weekDay,
                content: `${memberName}: Chưa chọn món`,
              },
              newData: {
                title: weekDay,
                content: `${memberName}: Thêm món "${newFoodName}${
                  newSecondaryFoodName ? ` + ${newSecondaryFoodName}` : ''
                }"`,
              },
            };
          }
          if (type === 'remove') {
            return {
              oldData: {
                title: weekDay,
                content: `${memberName}: "${oldFoodName}"`,
              },
              newData: {
                title: weekDay,
                content: `${memberName}: Xoá ngày ăn`,
              },
            };
          }
          if (type === 'update') {
            return {
              oldData: {
                title: weekDay,
                content: `${memberName}: "${oldFoodName}${
                  oldSecondaryFoodName ? ` + ${oldSecondaryFoodName}` : ''
                }"`,
              },
              newData: {
                title: weekDay,
                content: `${memberName}: đổi món "${newFoodName}${
                  newSecondaryFoodName ? ` + ${newSecondaryFoodName}` : ''
                }"`,
              },
            };
          }

          return {
            oldData: {},
            newData: { title: '', content: '' },
          };
        });
      })
      .reduce((acc, memberOrders) => [...acc, ...memberOrders], []),
  };

  emailSendingFactory(
    EmailTemplateTypes.BOOKER.BOOKER_PICKING_ORDER_CHANGED,
    emailParamsForBookerNotification,
  );
  createSlackNotification(
    ESlackNotificationType.PARTICIPANT_GROUP_ORDER_FOOD_CHANGED,
    {
      participantGroupOrderFoodChangedData: {
        by,
        threadTs: planListing.attributes?.metadata?.slackThreadTs!,
        orderCode: orderListing.attributes?.title!,
        orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderListing.id?.uuid}`,
        orderName: orderListing.attributes?.publicData?.orderName!,
        changes: Object.keys(diffentOrderDetail)
          .map((date) => {
            const { memberOrders } = diffentOrderDetail[date];

            if (!memberOrders) {
              return [];
            }

            return Object.keys(memberOrders).map((memberId) => {
              const {
                oldFoodName,
                newFoodName,
                oldSecondaryFoodName,
                newSecondaryFoodName,
                memberName,
                restaurantName,
              } = memberOrders[memberId];
              const type =
                (!oldFoodName && newFoodName && ('add' as const)) ||
                (!newFoodName && oldFoodName && ('remove' as const)) ||
                ('update' as const);

              return {
                participantName: memberName,
                date: convertDateToVNTimezone(new Date(+date)).split('T')[0],
                type,
                fromFoodName: `${oldFoodName}${
                  oldSecondaryFoodName ? ` + ${oldSecondaryFoodName}` : ''
                }`,
                toFoodName: `${newFoodName}${
                  newSecondaryFoodName ? ` + ${newSecondaryFoodName}` : ''
                }`,
                addFoodName: `${newFoodName}${
                  newSecondaryFoodName ? ` + ${newSecondaryFoodName}` : ''
                }`,
                removeFoodName: `${oldFoodName}${
                  oldSecondaryFoodName ? ` + ${oldSecondaryFoodName}` : ''
                }`,
                restaurantName,
              };
            });
          })
          .reduce((acc, memberOrders) => [...acc, ...memberOrders], []),
      },
    },
  );
};

const sendParticipantChangedNormalOrderFoodsSlackNotification = async (
  orderListing: OrderListing,
  planListing: PlanListing,
  newOrderDetail: OrderDetail,
  oldOrderDetail: OrderDetail,
  by: 'admin' | 'booker',
) => {
  const diffentOrderDetail = Object.keys(newOrderDetail).reduce((acc, date) => {
    const newLineItems = newOrderDetail[date]?.lineItems;
    const oldLineItems = oldOrderDetail[date]?.lineItems;

    const removedLineItems = oldLineItems?.filter(
      (_lineItem) =>
        !newLineItems?.some((newLineItem) => newLineItem?.id === _lineItem?.id),
    );

    const addedLineItems = newLineItems?.filter(
      (_lineItem) =>
        !oldLineItems?.some((oldLineItem) => oldLineItem?.id === _lineItem?.id),
    );

    const updatedLineItems = newLineItems?.filter((_lineItem) =>
      oldLineItems?.some(
        (oldLineItem) =>
          oldLineItem?.id === _lineItem?.id &&
          oldLineItem?.quantity !== _lineItem?.quantity,
      ),
    );

    const changes = [
      ...(removedLineItems || []).map((lineItem) => ({
        foodId: lineItem?.id,
        foodName: lineItem?.name,
        oldQuantity: lineItem?.quantity,
        newQuantity: 0,
      })),
      ...(addedLineItems || []).map((lineItem) => ({
        foodId: lineItem?.id,
        foodName: lineItem?.name,
        oldQuantity: 0,
        newQuantity: lineItem?.quantity,
      })),
      ...(updatedLineItems || []).map((lineItem) => ({
        foodId: lineItem?.id,
        foodName: lineItem?.name,
        oldQuantity: oldLineItems?.find(
          (oldLineItem) => oldLineItem?.id === lineItem?.id,
        )?.quantity,
        newQuantity: lineItem?.quantity,
      })),
    ];

    return {
      ...acc,
      [date]: {
        lineItems: changes,
      },
    };
  }, {} as DifferentOrderDetail);

  createSlackNotification(
    ESlackNotificationType.PARTICIPANT_NORMAL_ORDER_FOOD_CHANGED,
    {
      participantNormalOrderFoodChangedData: {
        by,
        threadTs: planListing.attributes?.metadata?.slackThreadTs!,
        orderCode: orderListing.attributes?.title!,
        orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderListing.id?.uuid}`,
        orderName: orderListing.attributes?.publicData?.orderName!,
        changes: Object.keys(diffentOrderDetail)
          .map((date) => {
            const { lineItems } = diffentOrderDetail[date];

            if (!lineItems) {
              return [];
            }

            return lineItems.map((lineItem) => {
              const { foodName, oldQuantity, newQuantity } = lineItem;
              const type =
                (!oldQuantity && newQuantity && ('add' as const)) ||
                (!newQuantity && oldQuantity && ('remove' as const)) ||
                ('update' as const);

              return {
                foodName,
                type,
                fromQuantity: oldQuantity,
                toQuantity: newQuantity,
                date: convertDateToVNTimezone(new Date(+date)).split('T')[0],
              };
            });
          })
          .reduce((acc, lineItems) => [...acc, ...lineItems], []),
      },
    },
  );
};

export type PUTUpdateOrderDetailFromDraftBody = {
  planId: string;
  isAdminFlow: boolean;
} & (
  | { orderDetail: OrderDetail }
  // Member removal is applied to the fresh plan, so picks made since the
  // caller loaded the page are kept.
  | { subOrderDate: number | string; removedMemberIds: string[] }
);

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiMethod = req.method;
  const integrationSdk = getIntegrationSdk();

  switch (apiMethod) {
    case HttpMethod.PUT:
      try {
        const body = req.body as PUTUpdateOrderDetailFromDraftBody;
        const { planId, isAdminFlow } = body;
        const { orderId } = req.query;

        const orderListingResponse: WithFlexSDKData<OrderListing> =
          await integrationSdk.listings.show({
            id: orderId,
          });

        const {
          oldPlanListing,
          oldOrderDetail,
          orderDetail,
          planListingResponse,
        } = await withPlanLock(planId, async () => {
          const freshPlanListing: WithFlexSDKData<PlanListing> =
            await integrationSdk.listings.show({
              id: planId,
            });
          const freshOrderDetail =
            freshPlanListing.data.data.attributes?.metadata?.orderDetail;

          if (!freshOrderDetail) {
            throw new Error('Old order detail is not found');
          }

          let nextOrderDetail: OrderDetail;
          if ('removedMemberIds' in body) {
            const { subOrderDate, removedMemberIds } = body;
            const subOrder = freshOrderDetail[subOrderDate];
            if (!subOrder) {
              throw new Error(`Sub order ${subOrderDate} is not found`);
            }
            nextOrderDetail = {
              ...freshOrderDetail,
              [subOrderDate]: {
                ...subOrder,
                memberOrders: omit(subOrder.memberOrders, removedMemberIds),
              },
            };
          } else {
            nextOrderDetail = keepServerOwnedSubOrderFields(
              body.orderDetail,
              freshOrderDetail,
            ) as OrderDetail;
          }

          return {
            oldPlanListing: freshPlanListing,
            oldOrderDetail: freshOrderDetail,
            orderDetail: nextOrderDetail,
            planListingResponse: (await integrationSdk.listings.update({
              id: planId,
              metadata: {
                orderDetail: nextOrderDetail,
              },
            })) as WithFlexSDKData<PlanListing>,
          };
        });

        const orderListing =
          denormalisedResponseEntities(orderListingResponse)[0];

        const { deliveryHour, orderState } =
          Listing(orderListing).getMetadata();

        const normalizedOrderDetail = normalizeOrderDetail({
          orderId: orderId as string,
          planId,
          planOrderDetail: orderDetail as any,
          deliveryHour,
        });

        if (orderState === EOrderStates.inProgress) {
          const orderType =
            orderListingResponse.data.data.attributes?.metadata?.orderType;

          if (orderType === EOrderType.group) {
            notifyParticipantChangedGroupOrderFoods(
              orderListingResponse.data.data,
              oldPlanListing.data.data,
              orderDetail,
              oldOrderDetail,
              isAdminFlow ? 'admin' : 'booker',
            );
          }

          if (orderType === EOrderType.normal) {
            sendParticipantChangedNormalOrderFoodsSlackNotification(
              orderListingResponse.data.data,
              oldPlanListing.data.data,
              orderDetail,
              oldOrderDetail,
              isAdminFlow ? 'admin' : 'booker',
            );
          }
        }

        await Promise.all(
          normalizedOrderDetail.map(async (order, index) => {
            const { params } = order;
            const {
              transactionId,
              extendedData: { metadata },
            } = params;

            if (transactionId) {
              await integrationSdk.transactions.updateMetadata({
                id: transactionId,
                metadata: {
                  ...metadata,
                  isLastTxOfPlan: index === normalizedOrderDetail.length - 1,
                },
              });
            }
          }),
        );

        await pushNotificationOrderDetailChanged(
          orderDetail,
          oldOrderDetail,
          orderListing,
          integrationSdk,
        );

        res.json({
          statusCode: 200,
          message: `Successfully update plan from draft plan, planId: ${planId}`,
          planListing: denormalisedResponseEntities(planListingResponse)[0],
        });
      } catch (error) {
        logger.error(
          'Error when update order detail from draft:',
          String(error),
        );
        handleError(res, error);
      }
      break;

    default:
      break;
  }
};

export default cookies(orderEditorChecker(handler));
