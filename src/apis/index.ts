import type { OrderListing } from '@src/types';
import type { TPlanData, TUpdateParticipantOrderBody } from '@src/types/order';
import type { EMemberAccountStatus } from '@src/utils/enums';
import type {
  TCreateCompanyApiParams,
  TObject,
  TUpdateCompanyApiParams,
} from '@utils/types';

import { getApi, postApi, putApi } from './configs';

export const getCompaniesApi = () => getApi('/users/my-companies');
export const getCompaniesAdminApi = (queryParams?: TObject) =>
  getApi('/admin/users/company', { queryParams });

export const getCompanyMembersDetailsApi = (
  id: string,
  roles: string[] = [],
) => {
  const rolesAsString = roles.join(',');

  return getApi(`/admin/users/company/${id}/members?roles=${rolesAsString}`);
};

export const adminUpdateCompanyApi = ({
  dataParams,
  queryParams,
}: {
  dataParams: TUpdateCompanyApiParams;
  queryParams: TObject;
}) =>
  putApi(`/admin/users/company/${dataParams.id}`, { dataParams, queryParams });

export const createCompanyApi = ({
  dataParams,
  queryParams,
}: {
  dataParams: TCreateCompanyApiParams;
  queryParams: TObject;
}) => postApi('/admin/users/company/create', { dataParams, queryParams });

export const queryCompanyMembersApi = (
  companyId: string,
  status?: EMemberAccountStatus,
) => {
  return getApi(
    `/admin/users/company/${companyId}/members${
      status ? `?status=${status}` : ''
    }`,
  );
};

export const showCompanyApi = (id: string) =>
  getApi(`/admin/users/company/${id}`);

export const updateCompanyStatusApi = (body: TObject) =>
  putApi(`/admin/users/company/status`, body);

export const publishCompanyApi = (companyId: string, queryParams?: TObject) =>
  postApi(`/admin/users/company/${companyId}/publish`, { queryParams });

export const unActiveCompanyApi = (companyId: string, queryParams?: TObject) =>
  postApi(`/admin/users/company/${companyId}/unactive`, { queryParams });

export const adminToggleUserDisabledApi = (
  userId: string,
  isDisabled: boolean,
) => postApi(`/admin/users/${userId}/disable`, { isDisabled });

export const createDraftPartnerApi = (body: TObject) =>
  postApi('/admin/users/partner/create-draft', body);

export const updateRestaurantApi = (body: TObject) =>
  postApi('/admin/listings/restaurant/update', body);

export const publishDraftPartnerApi = (body: TObject) =>
  postApi('/admin/users/partner/publish-draft', body);

export const deletePartnerApi = (body: TObject) =>
  postApi('/admin/users/partner/delete-partner', body);

export const showRestaurantApi = ({ id, ...rest }: TObject) =>
  postApi(`/admin/listings/restaurant/${id}`, rest);

export const queryRestaurantListingsApi = (body: TObject) =>
  postApi('/admin/listings/restaurant/query', body);

export const updateRestaurantStatusApi = (body: TObject) =>
  postApi('/admin/listings/restaurant/status', body);

export const loadOrderDataApi = (orderId: string) =>
  getApi(`/participants/orders/${orderId}`);

export const loadPlanDataApi = (planId: string) =>
  getApi<{
    data: {
      plan: TPlanData;
      order: OrderListing;
    };
  }>(`/participants/plans/${planId}`);

export const updateParticipantOrderApi = (
  orderId: string,
  body: TUpdateParticipantOrderBody,
) => postApi(`/participants/orders/${orderId}`, body);

export const fetchUserApi = (userId: string) =>
  getApi(`/users/fetch-user/${userId}`);

export const queryDeliveryInfoApi = ({ orderId, date }: TObject) => {
  return getApi(`/tracking`, { orderId, date });
};
