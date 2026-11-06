import type { TObject } from '@utils/types';

import type { TBodyParams } from './configs';
import { deleteApi, getApi, postApi, putApi } from './configs';

const baseUrl = '/admin/listings/foods';

const showFood = (id: string, queryParams: TObject) => {
  return getApi(`${baseUrl}/${id}`, queryParams);
};

const createFood = (body: TBodyParams) => {
  return postApi(`${baseUrl}`, body);
};

const updateFood = (foodId: string, body: TBodyParams) => {
  return putApi(`${baseUrl}/${foodId}`, body);
};

const updateFoodPrices = (foodPrices: { id: string; price: number }[]) => {
  return putApi(`${baseUrl}/update-prices`, { foodPrices });
};

const deleteFood = (foodId: string, body: TBodyParams) => {
  return deleteApi(`${baseUrl}/${foodId}`, body);
};

const deleteFoodByIds = (body: TBodyParams) => {
  return deleteApi(`${baseUrl}/delete-by-ids`, body);
};

const publishFoodApi = (foodId: string, body: TBodyParams) => {
  return postApi(`${baseUrl}/${foodId}/publish`, body);
};

const closeFoodApi = (foodId: string, body: TBodyParams) => {
  return postApi(`${baseUrl}/${foodId}/close`, body);
};

export const partnerFoodApi = {
  showFood,
  createFood,
  updateFood,
  updateFoodPrices,
  deleteFood,
  deleteFoodByIds,
  publishFoodApi,
  closeFoodApi,
};
