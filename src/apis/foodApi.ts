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

export type TFoodFilter = {
  keywords?: string;
  pub_category?: string[];
  pub_foodType?: string;
  priceFrom?: number;
  priceTo?: number;
  // yyyy-MM-dd, Vietnam calendar day
  createdAtFrom?: string;
  createdAtTo?: string;
};

export type TQueryFoodsParams = {
  restaurantId: string;
  page?: number;
  perPage?: number;
  filter?: TFoodFilter;
};

const queryFoods = (params: TQueryFoodsParams) => {
  return getApi(`${baseUrl}/query`, params);
};

export type TUpdateFoodPricesBody =
  | { foodPrices: { id: string; price: number }[] }
  | { restaurantId: string; filter: TFoodFilter; price: number };

const updateFoodPrices = (body: TUpdateFoodPricesBody) => {
  return putApi(`${baseUrl}/update-prices`, body);
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
  queryFoods,
  createFood,
  updateFood,
  updateFoodPrices,
  deleteFood,
  deleteFoodByIds,
  publishFoodApi,
  closeFoodApi,
};
