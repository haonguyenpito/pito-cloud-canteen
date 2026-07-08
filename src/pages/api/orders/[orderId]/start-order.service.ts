import { convertDateToVNTimezone } from '@helpers/dateHelpers';
import { getPickFoodParticipants } from '@helpers/orderHelper';
import { pushNativeNotificationOrderDetail } from '@pages/api/helpers/pushNotificationOrderDetailHelper';
import { denormalisedResponseEntities } from '@services/data';
import { emailSendingFactory, EmailTemplateTypes } from '@services/email';
import getSystemAttributes from '@services/getSystemAttributes';
import { fetchUser } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { createNativeNotification } from '@services/nativeNotification';
import { createSlackNotification } from '@services/slackNotification';
import type { OrderListing, PlanListing, WithFlexSDKData } from '@src/types';
import { Listing, User } from '@utils/data';
import {
  EBookerNativeNotificationType,
  ENativeNotificationType,
  EOrderStates,
  ESlackNotificationType,
} from '@utils/enums';

import { sendBookerNativeNotification } from './send-booker-native-notification.service';

export const startOrder = async (orderId: string, planId: string) => {
  const integrationSdk = getIntegrationSdk();

  const [orderListing]: [OrderListing] = denormalisedResponseEntities(
    await integrationSdk.listings.show({
      id: orderId,
    }),
  );
  const {
    companyId,
    bookerId,
    orderState,
    orderStateHistory = [],
    partnerIds = [],
    hasSpecificPCCFee: orderHasSpecificPCCFee,
    specificPCCFee: orderSpecificPCCFee,
    specificPCCFeeTiers: orderSpecificPCCFeeTiers,
  } = Listing(orderListing as any).getMetadata();

  if (orderState !== EOrderStates.picking) {
    throw new Error(
      'You can start picking order (with orderState is "picking") only',
    );
  }
  const booker = await fetchUser(bookerId);
  const bookerUser = User(booker);
  const { isAutoPickFood } = bookerUser.getPublicData();

  const updateOrderStateHistory = orderStateHistory.concat([
    {
      state: EOrderStates.inProgress,
      updatedAt: new Date().getTime(),
    },
  ]);
  const { systemVATPercentage = 0 } = await getSystemAttributes();
  const companyUser = await fetchUser(companyId);
  const {
    hasSpecificPCCFee = false,
    specificPCCFee = 0,
    specificPCCFeeTiers,
  } = User(companyUser).getMetadata();

  const oldPlan: WithFlexSDKData<PlanListing> =
    await integrationSdk.listings.show({
      id: planId,
    });

  await integrationSdk.listings.update({
    id: orderId,
    metadata: {
      orderState: EOrderStates.inProgress,
      orderStateHistory: updateOrderStateHistory,
      orderVATPercentage: systemVATPercentage,
      isAutoPickFood,
      ...(orderHasSpecificPCCFee === undefined &&
        orderSpecificPCCFee === undefined && {
          hasSpecificPCCFee,
          specificPCCFee,
          ...(orderSpecificPCCFeeTiers === undefined &&
            specificPCCFeeTiers && { specificPCCFeeTiers }),
        }),
    },
  });

  const [plan] = denormalisedResponseEntities(
    await integrationSdk.listings.update(
      {
        id: planId,
        metadata: {
          partnerIds,
        },
      },
      {
        expand: true,
      },
    ),
  );
  const planListing = Listing(plan);
  const { orderDetail = {} } = planListing.getMetadata();

  const shouldSendNativeNotificationParticipantIdList =
    getPickFoodParticipants(orderDetail);

  // TODO: send noti email
  emailSendingFactory(EmailTemplateTypes.BOOKER.BOOKER_ORDER_SUCCESS, {
    orderId,
  });

  shouldSendNativeNotificationParticipantIdList.map(
    async (participantId: string) => {
      createNativeNotification(
        ENativeNotificationType.BookerTransitOrderStateToInProgress,
        {
          participantId,
          order: orderListing as any,
        },
      );
    },
  );

  if (!oldPlan.data.data.attributes?.metadata?.planStarted) {
    createSlackNotification(
      ESlackNotificationType.ORDER_STATUS_CHANGES_TO_IN_PROGRESS,
      {
        orderStatusChangesToInProgressData: {
          orderCode: orderListing.attributes?.title!,
          orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderId}`,
          orderName: orderListing.attributes?.publicData?.orderName!,
          companyName: orderListing.attributes?.metadata?.companyName!,
          startDate: convertDateToVNTimezone(
            new Date(orderListing.attributes?.metadata?.startDate!),
          ).split('T')[0],
          deliveryHour: orderListing.attributes?.metadata?.deliveryHour!,
          deliveryAddress:
            orderListing.attributes?.metadata?.deliveryAddress?.address!,
          planId,
        },
      },
    );

    integrationSdk.listings.update({
      id: planId,
      metadata: {
        planStarted: true,
      },
    });
  }

  await pushNativeNotificationOrderDetail(
    orderDetail,
    orderListing as any,
    ENativeNotificationType.BookerTransitOrderStateToInProgress,
    integrationSdk,
  );

  sendBookerNativeNotification(
    orderListing as any,
    EBookerNativeNotificationType.AdminStartOrder,
  );
};
