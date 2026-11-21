import type { TCheckUnConflictedParams } from '@helpers/apiHelpers';
import type {
  TCreateMenuApiParams,
  TDuplicateMenuApiParams,
  TObject,
} from '@utils/types';

import type { TBodyParams } from './configs';
import { getApi, postApi, putApi } from './configs';

export const createPartnerMenuApi = (
  dataParams: TCreateMenuApiParams,
  queryParams: TObject,
) => {
  return postApi(`/admin/listings/menus`, {
    dataParams,
    queryParams,
  });
};

export const duplicatePartnerMenuApi = (
  id: string,
  dataParams: TDuplicateMenuApiParams,
  queryParams: TObject,
) => {
  return postApi(`/admin/listings/menus/${id}/duplicate`, {
    dataParams,
    queryParams,
  });
};

export const publishPartnerMenuApi = (
  id: string,
  dataParams?: TDuplicateMenuApiParams,
  queryParams?: TObject,
) => {
  return postApi(`/admin/listings/menus/${id}/publish`, {
    dataParams,
    queryParams,
  });
};

export const closePartnerMenuApi = (
  id: string,
  dataParams?: TDuplicateMenuApiParams,
  queryParams?: TObject,
) => {
  return postApi(`/admin/listings/menus/${id}/close`, {
    dataParams,
    queryParams,
  });
};

export const updatePartnerMenuApi = (id: string, body: TBodyParams) => {
  return putApi(`/admin/listings/menus/${id}`, body);
};

/** Menu-scoped extra fee (phí phụ thu) — never writes to food listings. */
export const updateMenuExtraFeesApi = (
  id: string,
  body: { extraFees: Record<string, number>; mode?: 'replace' | 'merge' },
) => {
  return putApi(`/admin/listings/menus/${id}/extra-fee`, body);
};

export const deletePartnerMenuApi = (body: TBodyParams) => {
  return postApi(`/admin/listings/menus/delete`, body);
};

export const showPartnerMenuApi = (id: string, body: TObject) => {
  return getApi(`/admin/listings/menus/${id}`, body);
};

export const queryAllMenusApi = ({
  restaurantId,
}: {
  restaurantId: string;
}) => {
  return postApi(`/admin/listings/menus/queryAll`, { restaurantId });
};

export const checkMenuInTransactionProgressApi = (id: string) => {
  return getApi(`/admin/listings/menus/${id}/isInTransactionProgress`);
};

export const checkMenuUnConflictedApi = (body: TCheckUnConflictedParams) =>
  postApi(`/admin/listings/menus/isUnConflicted`, body);
