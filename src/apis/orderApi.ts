import type { AxiosResponse } from 'axios';

import type {
  POSTUpdateStateBody,
  UpdateStateParams,
} from '@pages/api/admin/listings/order/[orderId]/update-state.api';
import type { PUTMemberOrderBody } from '@pages/api/orders/[orderId]/member-order/index.api';
import type { POSTRemindMemberBody } from '@pages/api/orders/[orderId]/remind-member/index.api';
import type { GETRestaurantsRecommendationJSONParams } from '@pages/api/orders/[orderId]/restaurants-recommendation/index.api';
import type { PUTUpdateOrderDetailFromDraftBody } from '@pages/api/orders/[orderId]/update-order-detail-from-draft.api';
import type { ChecklistListing } from '@src/types';
import type { ApiResponse } from '@src/utils/response';
import type { TCreateChecklistApiBody, TObject } from '@utils/types';

import type { TBodyParams } from './configs';
import { deleteApi, getApi, postApi, putApi } from './configs';

type TCreateBookerOrderApiBody = {
  companyId: string;
  bookerId: string;
  isCreatedByAdmin?: boolean;
};

export type TUpdateOrderApiBody = {
  orderId?: string;
  generalInfo?: {
    deliveryAddress?: {
      address: string;
      origin: {
        lat: number;
        lng: number;
      };
    };
    startDate?: number;
    endDate?: number;
    deliveryHour?: string;
    selectedGroups?: string[];
    packagePerMember?: number;
    deadlineDate?: number;
    deadlineHour?: string;
    period?: number;
    nutritions?: string[];
    staffName?: string;
    shipperName?: string;
  };
};

export const createBookerOrderApi = (body: TCreateBookerOrderApiBody) =>
  postApi('/orders', body);

export const reorderApi = (orderId: string, body: TObject) =>
  postApi(`/orders/${orderId}/reorder`, body);

export const getBookerOrderDataApi = (orderId: string) =>
  getApi(`/orders/${orderId}`);

export const getParticipantsByOrderApi = (orderId: string) =>
  getApi(`/orders/${orderId}/participants`);

export const updateOrderApi = (orderId: string, body: TUpdateOrderApiBody) =>
  putApi(`/orders/${orderId}`, body);
// ------------------------- //

// Manage Order - Plan detail
export const createPlanDetailsApi = (orderId: string, body: TObject) =>
  postApi(`/orders/${orderId}/plan`, body);

export const updatePlanDetailsApi = (orderId: string, body: TObject) =>
  putApi(`/orders/${orderId}/plan`, body);
// ------------------------- //

// Manage participants
export const addParticipantToOrderApi = (orderId: string, body: TObject) =>
  postApi(`/orders/${orderId}/participant`, body);

export const deleteParticipantFromOrderApi = (orderId: string, body: TObject) =>
  deleteApi(`/orders/${orderId}/participant`, body);
// ------------------------- //

export const addUpdateMemberOrder = (
  orderId: string,
  body: PUTMemberOrderBody,
) => putApi(`/orders/${orderId}/member-order`, body);

export const sendRemindEmailToMemberApi = (
  orderId: string,
  body: POSTRemindMemberBody,
) => postApi(`/orders/${orderId}/remind-member`, body);

export const queryOrdersApi = (body: TBodyParams) => {
  return getApi(`/admin/listings/order`, body);
};

// Delete draft own draft order
export const bookerDeleteDraftOrderApi = ({
  companyId,
  orderId,
}: {
  companyId: string;
  orderId: string;
}) => {
  return deleteApi(`/company/${companyId}/orders/${orderId}`);
};
// Request approval order
export const requestApprovalOrderApi = (orderId: string) => {
  return putApi(`/orders/${orderId}/request-approval-order`);
};

// Cancel pending approval order
export const bookerCancelPendingApprovalOrderApi = (orderId: string) => {
  return putApi(`/orders/${orderId}/cancel-pending-approval-order`);
};

// Start order process (inProgress)
export const bookerStartOrderApi = ({
  orderId,
  planId,
}: {
  orderId: string;
  planId: string;
}) => {
  return putApi(`/orders/${orderId}/plan/${planId}/start-order`);
};

// Allow picking for order
export const publishOrderApi = (orderId: string) => {
  return postApi(`/orders/${orderId}/publish-order`);
};

// Cancel picking order
export const cancelPickingOrderApi = (orderId: string) => {
  return putApi(`/orders/${orderId}/cancel-picking-order`);
};

export const adminUpdateOrderStateApi = ({
  orderId,
  orderState,
  options,
}: POSTUpdateStateBody & UpdateStateParams) =>
  putApi(`/admin/listings/order/${orderId}/update-state`, {
    orderState,
    options,
  });

export type TCreateQuotationApiBody = {
  orderId: string;
  companyId: string;
  partner: {
    [restaurantId: string]: {
      name: string;
      quotation: {
        [timestamp: string]: {
          foodId: string;
          foodName: string;
          foodPrice: number;
          frequency: number;
        }[];
      };
    };
  };
  client: {
    quotation: {
      [timestamp: string]: {
        foodId: string;
        foodName: string;
        foodPrice: number;
        frequency: number;
      }[];
    };
  };
};

export const createQuotationApi = (
  orderId: string,
  body: TCreateQuotationApiBody,
) => postApi(`/orders/${orderId}/quotation`, body);

export const sendPartnerNewOrderAppearEmailApi = (
  orderId: string,
  body: { orderId: string; partner: any },
) => postApi(`/orders/${orderId}/send-partner-new-order-appear-email`, body);

export const sendOrderDetailUpdatedEmailApi = ({
  orderId,
  restaurantId,
  timestamp,
}: {
  orderId: string;
  restaurantId: string;
  timestamp: string;
}) =>
  postApi(`/orders/${orderId}/send-order-details-updated-email`, {
    restaurantId,
    timestamp,
  });

export const initializePaymentApi = (orderId: string, planId: string) =>
  postApi(`/orders/${orderId}/plan/${planId}/initialize-payment`);
export const updateOrderStateToDraftApi = (orderId: string) =>
  putApi(`/orders/${orderId}/update-order-state-to-draft`);

export const recommendRestaurantApi = ({
  orderId,
  timestamp,
  recommendParams,
}: GETRestaurantsRecommendationJSONParams & {
  orderId: string;
}) => {
  return getApi(`/orders/${orderId}/restaurants-recommendation/`, {
    timestamp,
    recommendParams,
  });
};
export const updateOrderDetailFromDraftApi = (
  orderId: string,
  body: PUTUpdateOrderDetailFromDraftBody,
) => putApi(`/orders/${orderId}/update-order-detail-from-draft`, body);

export const updatePaymentApi = (orderId: string, planId: string) =>
  putApi(`/orders/${orderId}/plan/${planId}/update-payment`);

export const adminNotifyUserPickingOrderChangesApi = (
  orderId: string,
  params: TObject,
) => postApi(`/orders/${orderId}/notify-user-picking-order-changes`, params);

export const createAutoPickFoodSchedulerApi = (orderId: string) =>
  putApi(`/orders/${orderId}/create-auto-pick-food-scheduler`);

export const removeAutoPickFoodSchedulerApi = (orderId: string) =>
  putApi(`/orders/${orderId}/remove-auto-pick-food-scheduler`);

export const sendOrderChangeFirebaseNotificationToBokerApi = (
  orderId: string,
) =>
  postApi(
    `/orders/${orderId}/send-order-change-firebase-notification-to-booker`,
  );

export const sendOrderChangeFirebaseNotificationToPartnerApi = (
  orderId: string,
  params: TObject,
) =>
  postApi(
    `/orders/${orderId}/send-order-change-firebase-notification-to-partner`,
    params,
  );

/**
 * Get order data for participant
 * @param orderId - Order ID
 * @returns Order data
 */
export const getOrderApi = (orderId: string) => getApi(`/orders/${orderId}`);

/**
 * Create checklist
 * @param orderId - Order ID
 * @param subOrderDate - Sub order date
 * @param body - Checklist body
 * @returns Checklist data
 */
export const createChecklistApi = (
  orderId: string,
  subOrderDate: string,
  body: TCreateChecklistApiBody,
): Promise<AxiosResponse<ApiResponse<ChecklistListing>>> =>
  postApi(`/orders/${orderId}/checklist/${subOrderDate}`, body);

/**
 * Get checklist
 * @param orderId - Order ID
 * @param subOrderDate - Sub order date
 * @returns Checklist data
 */
export const getChecklistApi = (orderId: string, subOrderDate: string) =>
  getApi<ApiResponse<ChecklistListing>>(
    `/orders/${orderId}/checklist/${subOrderDate}`,
  );
