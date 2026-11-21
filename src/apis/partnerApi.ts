import type { TObject } from '@src/utils/types';

import type { TBodyParams } from './configs';
import { deleteApi, getApi, postApi, putApi } from './configs';

const BASE_URL = '/partner';

export const queryPartnerOrdersApi = (partnerId: string, params?: TObject) => {
  return getApi(`${BASE_URL}/${partnerId}/orders`, params);
};

/**
 * Query partner order detail by order ID
 * @param orderId - Order ID
 * @param date - sub order date
 * @returns Order detail
 */
export const queryPartnerOrderDetailApi = ({
  partnerId,
  orderId,
  date,
}: {
  partnerId: string;
  orderId: string;
  date: string;
}) => {
  return postApi(`${BASE_URL}/${partnerId}/orders/${orderId}`, { date });
};

export const queryAllPartnerPaymentRecordsApi = ({ partnerId }: TObject) => {
  return getApi(`${BASE_URL}/${partnerId}/payments`);
};

export const toggleAppStatusApi = ({ partnerId }: TObject, body: TObject) => {
  return putApi(`${BASE_URL}/${partnerId}/toggle-app-status`, body);
};

export type TQueryPartnerFoodApiParams = {
  restaurantId: string;
  keywords?: string;
  foodType?: string;
  createAtStart?: string;
  createAtEnd?: string;
};
export const queryPartnerFoodsApi = (params: TObject) =>
  getApi(`${BASE_URL}/food`, params);

export const fetchPartnerFoodApi = (foodId: string) =>
  getApi(`${BASE_URL}/food/${foodId}`);

export const createPartnerFoodApi = (data: TObject) =>
  postApi(`${BASE_URL}/food`, data);

export const updatePartnerFoodApi = (foodId: string, data: TObject) =>
  putApi(`${BASE_URL}/food/${foodId}`, data);

export const removePartnerFoodApi = (foodId: string) =>
  deleteApi(`${BASE_URL}/food/${foodId}`);
export const removePartnerMultipleFoodApi = (body: TBodyParams) =>
  deleteApi(`${BASE_URL}/food/delete-by-ids`, body);

export const fetchFoodEditableApi = (foodId: string) =>
  getApi(`${BASE_URL}/food/${foodId}/fetch-editable`);

export const fetchFoodEditableBatchApi = (foodIds: string[]) =>
  postApi(`${BASE_URL}/food/fetch-editables`, { foodIds });

export const fetchFoodDeletableApi = (foodId: string) =>
  getApi(`${BASE_URL}/food/${foodId}/fetch-deletable`);

export const updatePartnerMenuApi = (
  { menuId, partnerId }: { menuId: string; partnerId: string },
  body: TBodyParams,
) => putApi(`${BASE_URL}/${partnerId}/menus/${menuId}`, body);
export const sendSlackNotificationToAdminApi = (
  foodId: string,
  body: TBodyParams,
) =>
  postApi(`${BASE_URL}/food/${foodId}/send-slack-notification-to-admin`, body);
export const toggleFoodEnableApi = (foodId: string, body: TBodyParams) =>
  putApi(`${BASE_URL}/food/${foodId}/toggle-food-enable`, body);
export const reApprovalFoodApi = (foodId: string) =>
  putApi(`${BASE_URL}/food/${foodId}/re-approval`);
export const deleteMenusApi = (body: TObject) => {
  return deleteApi(`${BASE_URL}/menus/delete`, body);
};

export const createDraftMenuApi = (body: TObject) => {
  return postApi(`${BASE_URL}/menus`, body);
};
export const updateMenuApi = (body: TObject) => {
  return putApi(`${BASE_URL}/menus`, body);
};
export const publishDraftMenuApi = (body: TObject) => {
  return putApi(`${BASE_URL}/menus/publish-draft`, body);
};
export const getMenuApi = (menuId: string) => {
  return getApi(`${BASE_URL}/menus`, { menuId });
};

export const transitSubOrderTransactionApi = ({
  orderId,
  subOrderDate,
  transactionId,
  newTransition,
  partnerId,
}: TObject) => {
  return putApi(`${BASE_URL}/${partnerId}/orders/${orderId}/transit`, {
    subOrderDate,
    transactionId,
    newTransition,
  });
};

export const fetchReviewApi = () => {
  return getApi(`${BASE_URL}/reviews`);
};

export const fetchReviewDetailApi = (
  page: number = 1,
  pageSize: number = 4,
  rating?: number[],
) => {
  return getApi(`${BASE_URL}/reviews/detail`, { page, pageSize, rating });
};
