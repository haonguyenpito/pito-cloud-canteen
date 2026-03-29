import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';

import { convertHHmmStringToTimeParts } from '@helpers/dateHelpers';
import { isJoinedPlan } from '@helpers/order/orderPickingHelper';
import type { TPlan } from '@src/utils/orderTypes';
import { ETransition } from '@src/utils/transaction';
import type { TObject } from '@src/utils/types';

type TPlanOrderDetail = TPlan['orderDetail'];
type TOrderOfDate = TPlanOrderDetail[keyof TPlanOrderDetail];

export type TNormalizedOrderDetail = {
  params: {
    listingId: string;
    transactionId?: string;
    extendedData: {
      metadata: {
        lineItems?: TObject[];
        participantIds?: string[];
        bookingInfo?: {
          foodId: string;
          foodName: string;
          foodPrice: number;
          requirement?: string;
          participantId: string;
          secondaryFoodId?: string;
          secondaryFoodName?: string;
          secondaryFoodPrice?: number;
          secondaryRequirement?: string;
        }[];
      };
    };
    bookingStart: Date;
    bookingEnd: Date;
    bookingDisplayStart: Date;
    bookingDisplayEnd: Date;
  };

  date: string;
};

export const normalizeOrderDetail = ({
  orderId,
  planId,
  planOrderDetail,
  deliveryHour = '06:30 - 06:45',
  isGroupOrder = true,
}: {
  orderId: string;
  planId: string;
  planOrderDetail: TPlanOrderDetail;
  deliveryHour: string;
  isGroupOrder?: boolean;
}) => {
  return Object.entries(planOrderDetail).reduce<TNormalizedOrderDetail[]>(
    (prev, [date, orderOfDate]: [string, TOrderOfDate]) => {
      const {
        restaurant = {},
        memberOrders: memberOrdersMap,
        lineItems = [],
        transactionId,
        lastTransition,
      } = orderOfDate;

      const { id: restaurantId, foodList = {} } = restaurant;

      if (lastTransition || !restaurantId) {
        return prev;
      }

      const startDate = DateTime.fromMillis(Number(date));
      const bookingStart = startDate.toJSDate();
      const bookingEnd = startDate.plus({ days: 1 }).toJSDate();
      const bookingDisplayStart = startDate
        .plus({
          ...convertHHmmStringToTimeParts(deliveryHour.split(' - ')[0]),
        })
        .toJSDate();
      const bookingDisplayEnd = bookingEnd;

      if (isGroupOrder) {
        const { participantIds, bookingInfo } = Object.entries(
          memberOrdersMap,
        ).reduce<TNormalizedOrderDetail['params']['extendedData']['metadata']>(
          (
            prevResult,
            [
              participantId,
              {
                foodId,
                status,
                requirement,
                secondaryFoodId,
                secondaryRequirement,
              },
            ],
          ) => {
            const {
              participantIds: prevParticipantList = [],
              bookingInfo: prevBookingInfo = [],
            } = prevResult;
            const currFoodInfo = foodList[foodId];
            const currSecondaryFoodInfo = secondaryFoodId
              ? foodList[secondaryFoodId]
              : null;
            if (currFoodInfo && isJoinedPlan(foodId, status)) {
              return {
                ...prevResult,
                participantIds: prevParticipantList.concat(participantId),
                bookingInfo: prevBookingInfo.concat({
                  foodId,
                  ...currFoodInfo,
                  participantId,
                  requirement,
                  ...(currSecondaryFoodInfo && {
                    secondaryFoodId,
                    secondaryFoodName: currSecondaryFoodInfo?.foodName,
                    secondaryFoodPrice: currSecondaryFoodInfo?.foodPrice,
                    secondaryRequirement,
                  }),
                }),
              };
            }

            return prevResult;
          },
          { participantIds: [], bookingInfo: [] },
        );

        const extendedData = {
          metadata: {
            participantIds,
            bookingInfo,
            orderId,
            planId,
          },
        };

        return isEmpty(participantIds)
          ? prev
          : prev.concat({
              params: {
                listingId: restaurantId as string,
                extendedData,
                bookingStart,
                bookingEnd,
                bookingDisplayStart,
                bookingDisplayEnd,
                transactionId,
              },
              date,
            });
      }

      const extendedData = {
        metadata: {
          lineItems,
          orderId,
          planId,
        },
      };

      return isEmpty(lineItems)
        ? prev
        : prev.concat({
            params: {
              listingId: restaurantId as string,
              extendedData,
              bookingStart,
              bookingEnd,
              bookingDisplayStart,
              bookingDisplayEnd,
              transactionId,
            },
            date,
          });
    },
    [],
  );
};

export const prepareNewPlanOrderDetail = (
  planOrderDetail: TPlanOrderDetail,
  transactionIdMap: TObject,
) => {
  if (isEmpty(transactionIdMap)) {
    return planOrderDetail;
  }

  return Object.entries(planOrderDetail).reduce<TPlanOrderDetail>(
    (prev, [date, orderOfDate]: [string, TOrderOfDate]) => {
      return {
        ...prev,
        [date]: {
          ...orderOfDate,
          transactionId: transactionIdMap[date],
          lastTransition: ETransition.INITIATE_TRANSACTION,
        },
      };
    },
    {},
  );
};

export const getSubOrdersWithNoTxId = (planOrderDetail: TPlanOrderDetail) => {
  return Object.entries(planOrderDetail).reduce<TObject>(
    (prev, [date, orderOfDate]: [string, TOrderOfDate]) => {
      const { transactionId } = orderOfDate;

      if (!transactionId) {
        return {
          ...prev,
          [date]: orderOfDate,
        };
      }

      return prev;
    },
    {},
  );
};
