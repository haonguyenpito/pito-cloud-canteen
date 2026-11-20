import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';

import { convertDateToVNTimezone } from '@helpers/dateHelpers';
import {
  keepServerOwnedSubOrderFields,
  patchSubOrders,
} from '@helpers/order/orderDetailHelper';
import { isEnableUpdateBookingInfo } from '@helpers/orderHelper';
import { withPlanLock } from '@services/distributedLock';
import { fetchListing, fetchUser } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { createSlackNotification } from '@services/slackNotification';
import type { OrderDetail, OrderListing, PlanListing } from '@src/types';
import {
  EApiUpdateMode,
  EOrderType,
  ESlackNotificationType,
} from '@src/utils/enums';
import type { TPlan } from '@src/utils/orderTypes';
import { denormalisedResponseEntities, Listing } from '@utils/data';
import type { TObject } from '@utils/types';

import { getInitMemberOrder } from './memberOrder.helper';

const sendRestaurantChangedSlackNotification = async (
  orderListing: OrderListing,
  planListing: PlanListing,
  newOrderDetail: OrderDetail,
) => {
  const differentOrderDetail = Object.keys(newOrderDetail).reduce(
    (acc, date) => {
      const newRestaurantName =
        newOrderDetail[date]?.restaurant?.restaurantName;
      const oldRestaurantName =
        newOrderDetail[date]?.oldValues?.[0]?.restaurant?.restaurantName;

      if (
        oldRestaurantName &&
        newRestaurantName &&
        newRestaurantName !== oldRestaurantName
      ) {
        return [
          ...acc,
          {
            oldRestaurantName,
            newRestaurantName,
            date: convertDateToVNTimezone(new Date(+date)).split('T')[0],
          },
        ];
      }

      return acc;
    },
    [] as {
      oldRestaurantName?: string;
      newRestaurantName?: string;
      date: string;
    }[],
  );

  const changes = Object.values(differentOrderDetail);

  createSlackNotification(ESlackNotificationType.RESTAURANT_CHANGED, {
    restaurantChangedData: {
      threadTs: planListing.attributes?.metadata?.slackThreadTs!,
      orderName: orderListing.attributes?.publicData?.orderName!,
      orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderListing.id?.uuid}`,
      orderCode: orderListing.attributes?.title!,
      changes,
    },
  });
};

const getMenuListFromOrderDetail = (orderDetail: TPlan['orderDetail']) => {
  const menuIds = Object.values(orderDetail).reduce<string[]>(
    (prev, current) => {
      const { restaurant } = current || {};
      const { menuId } = restaurant || {};

      if (isEmpty(menuId)) {
        return prev;
      }

      return prev.concat(menuId as string);
    },
    [],
  );

  return uniq(menuIds);
};

const getNormalizeDetail = ({
  orderDetail,
  initialMemberOrder,
  isNormalOrder = false,
}: {
  orderDetail: any;
  initialMemberOrder: any;
  isNormalOrder: boolean;
}) => {
  return Object.keys(orderDetail).reduce((acc: TObject, curr: string) => {
    if (orderDetail[curr]) {
      return {
        ...acc,
        [curr]: {
          ...(isNormalOrder && { lineItems: [] }),
          memberOrders: isNormalOrder ? {} : initialMemberOrder,
          ...orderDetail[curr],
        },
      };
    }

    return acc;
  }, {});
};

const updatePlan = async ({
  orderId,
  planId,
  orderDetail,
  updateMode,
}: {
  orderId: string;
  planId: string;
  orderDetail: any;
  updateMode: EApiUpdateMode;
}) => {
  const integrationSdk = getIntegrationSdk();

  const orderListing: OrderListing = await fetchListing(orderId as string);

  const {
    companyId,
    selectedGroups = [],
    orderState,
    orderType = EOrderType.group,
    partnerIds = [],
  } = Listing(orderListing as any).getMetadata();
  const enabledToUpdateRelatedBookingInfo =
    isEnableUpdateBookingInfo(orderState);
  const companyAccount = await fetchUser(companyId);
  const isNormalOrder = orderType === EOrderType.normal;

  const initialMemberOrder = await getInitMemberOrder({
    companyAccount,
    selectedGroups,
  });

  const normalizeDetail = getNormalizeDetail({
    orderDetail,
    initialMemberOrder,
    isNormalOrder,
  });

  if (enabledToUpdateRelatedBookingInfo) {
    const { planListing, updateMenuIds } = await withPlanLock(
      planId,
      async () => {
        const currPlan: PlanListing = await fetchListing(planId as string);
        const { orderDetail: oldOrderDetail = {}, menuIds = [] } = Listing(
          currPlan as any,
        ).getMetadata();

        let updatedOrderDetail = normalizeDetail;
        if (updateMode === EApiUpdateMode.MERGE) {
          updatedOrderDetail = getNormalizeDetail({
            orderDetail: { ...oldOrderDetail, ...orderDetail },
            initialMemberOrder,
            isNormalOrder,
          });
        }
        if (updateMode === EApiUpdateMode.DIRECT_UPDATE) {
          updatedOrderDetail = {
            ...oldOrderDetail,
            ...orderDetail,
          };
        }
        if (updateMode === EApiUpdateMode.PATCH_SUB_ORDER) {
          updatedOrderDetail = patchSubOrders(oldOrderDetail, orderDetail);
        }
        updatedOrderDetail = keepServerOwnedSubOrderFields(
          updatedOrderDetail,
          oldOrderDetail,
        );

        const nextMenuIds: string[] = uniq(
          menuIds.concat(getMenuListFromOrderDetail(updatedOrderDetail)),
        );
        const planListingResponse = await integrationSdk.listings.update(
          {
            id: planId,
            metadata: {
              orderDetail: updatedOrderDetail,
              menuIds: nextMenuIds,
              partnerIds,
            },
          },
          { expand: true },
        );

        return {
          planListing: denormalisedResponseEntities(
            planListingResponse,
          )[0] as PlanListing,
          updateMenuIds: nextMenuIds,
        };
      },
    );

    integrationSdk.listings.update({
      id: orderId,
      metadata: {
        menuIds: updateMenuIds,
      },
    });

    sendRestaurantChangedSlackNotification(
      orderListing,
      planListing,
      normalizeDetail,
    );

    return planListing;
  }

  return {};
};

export default updatePlan;
