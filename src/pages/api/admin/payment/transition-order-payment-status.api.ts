import groupBy from 'lodash/groupBy';
import type { NextApiRequest, NextApiResponse } from 'next';

import { calculatePaidAmountBySubOrderDate } from '@pages/admin/order/[orderId]/helpers/AdminOrderDetail';
import cookies from '@services/cookie';
import { withPlanLock } from '@services/distributedLock';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { queryPaymentRecordOnFirebase } from '@services/payment';
import { handleError } from '@services/sdk';
import { Listing } from '@src/utils/data';
import { EOrderStates, EPaymentType, ESubOrderStatus } from '@src/utils/enums';
import { TRANSITIONS_TO_STATE_CANCELED } from '@src/utils/transaction';
import type { TObject } from '@src/utils/types';

import { calculateClientTotalPriceAndPaidAmount } from './check-valid-payment.service';

const isOrderDetailOnDateInActive = (orderDetailOnDate: TObject) => {
  const { transactionId, status, lastTransition } = orderDetailOnDate || {};

  return (
    !transactionId ||
    (transactionId && status === ESubOrderStatus.canceled) ||
    TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition)
  );
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const integrationSdk = getIntegrationSdk();
  try {
    const { orderId, planId: planIdFromBody } = req.body;

    const order = await fetchListing(orderId);
    const {
      orderStateHistory,
      orderState,
      isAdminConfirmedClientPayment = false,
      plans = [],
    } = Listing(order).getMetadata();

    const planId = planIdFromBody || plans[0];

    // get all client payment records
    const clientPaymentRecords = await queryPaymentRecordOnFirebase({
      paymentType: EPaymentType.CLIENT,
      orderId,
    });

    const { clientTotalPrice, clientPaidAmount } =
      await calculateClientTotalPriceAndPaidAmount(
        orderId,
        clientPaymentRecords!,
      );

    const isClientPaidAmountEnough = clientTotalPrice - clientPaidAmount === 0;

    // get all partner payment records
    const partnerPaymentRecords = await queryPaymentRecordOnFirebase({
      paymentType: EPaymentType.PARTNER,
      orderId,
    });
    const groupPaymentRecordsBySubOrderDate = groupBy(
      partnerPaymentRecords || [],
      'subOrderDate',
    );

    // The payment records are read above, outside the lock; everything that
    // reads orderDetail is computed from the plan re-read under it.
    const { subOrderDatePaymentStatus, activeOrderDetail } = await withPlanLock(
      planId,
      async () => {
        const plan = await fetchListing(planId);
        const { orderDetail = {} } = Listing(plan).getMetadata();

        const paymentStatusBySubOrderDate = Object.keys(
          groupPaymentRecordsBySubOrderDate,
        ).reduce((result: any, subOrderDate: string) => {
          if (isOrderDetailOnDateInActive(orderDetail[subOrderDate] || {})) {
            return result;
          }
          const paymentRecords =
            groupPaymentRecordsBySubOrderDate[subOrderDate];
          const totalPrice = paymentRecords?.[0]?.totalPrice || 0;
          const paidAmount = calculatePaidAmountBySubOrderDate(paymentRecords);

          return {
            ...result,
            [subOrderDate]: totalPrice - paidAmount === 0,
          };
        }, {});

        const { newOrderDetail, activeOrderDetail: activeDetail } = Object.keys(
          orderDetail,
        ).reduce(
          (result: any, subOrderDate: string) => {
            const { isAdminPaymentConfirmed = false } =
              orderDetail[subOrderDate] || {};

            const isInActiveDate = isOrderDetailOnDateInActive(
              orderDetail[subOrderDate],
            );
            const isPaid =
              Boolean(paymentStatusBySubOrderDate[subOrderDate]) ||
              isAdminPaymentConfirmed;

            return {
              newOrderDetail: {
                ...result.newOrderDetail,
                [subOrderDate]: {
                  ...orderDetail[subOrderDate],
                  isPaid,
                },
              },
              activeOrderDetail: {
                ...result.activeOrderDetail,
                ...(!isInActiveDate && {
                  [subOrderDate]: orderDetail[subOrderDate],
                }),
              },
            };
          },
          {
            newOrderDetail: {},
            activeOrderDetail: {},
          },
        );

        // Update payment status for sub order date
        await integrationSdk.listings.update({
          id: planId,
          metadata: {
            orderDetail: newOrderDetail,
          },
        });

        return {
          subOrderDatePaymentStatus: paymentStatusBySubOrderDate,
          activeOrderDetail: activeDetail,
        };
      },
    );

    const isPaymentNumberEqualToSubOrderDateNumber =
      Object.keys(activeOrderDetail).length ===
      Object.keys(subOrderDatePaymentStatus).length;

    const isPartnerPaidAmountEnough = Object.keys(
      subOrderDatePaymentStatus,
    ).every((date: any) => {
      const status = subOrderDatePaymentStatus[date];
      const { isAdminPaymentConfirmed = false } = activeOrderDetail[date] || {};

      return isAdminPaymentConfirmed || Boolean(status);
    });

    const isOrderPendingPayment = orderState === EOrderStates.pendingPayment;
    const isOrderStateIncludePendingPaymentOrComplete = orderStateHistory.some(
      (state: any) =>
        state.state === EOrderStates.pendingPayment ||
        state.state === EOrderStates.completed,
    );

    const updateIsClientSufficientPaid =
      isClientPaidAmountEnough || isAdminConfirmedClientPayment;
    const updateIsPartnerSufficientPaid =
      isPartnerPaidAmountEnough && isPaymentNumberEqualToSubOrderDateNumber;

    await integrationSdk.listings.update({
      id: orderId,
      metadata: {
        isClientSufficientPaid: updateIsClientSufficientPaid,
        isPartnerSufficientPaid: updateIsPartnerSufficientPaid,
        ...(isOrderPendingPayment &&
        updateIsClientSufficientPaid &&
        updateIsPartnerSufficientPaid
          ? {
              orderState: EOrderStates.completed,
              orderStateHistory: orderStateHistory.concat({
                state: EOrderStates.completed,
                updatedAt: new Date().getTime(),
              }),
            }
          : !isOrderPendingPayment &&
            isOrderStateIncludePendingPaymentOrComplete
          ? {
              orderState: EOrderStates.pendingPayment,
              orderStateHistory: orderStateHistory.concat({
                state: EOrderStates.pendingPayment,
                updatedAt: new Date().getTime(),
              }),
            }
          : {}),
      },
    });

    res.json({
      message: 'Transition order payment status successfully',
    });
  } catch (error) {
    handleError(res, error);
  }
}

export default cookies(handler);
