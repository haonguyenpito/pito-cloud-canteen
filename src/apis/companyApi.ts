import type { GETCompanyRaitingsQuery } from '@pages/api/company/[companyId]/ratings/index.api';
import type { POSTAddMembersBody } from '@pages/api/company/members/add-members.api';
import type { POSTCompanyRatingsBody } from '@pages/api/company/ratings/index.api';
import type { BookerViewerRatingData } from '@pages/company/[companyId]/ratings/index.route';
import type { TObject } from '@utils/types';

import { deleteApi, getApi, getDedupApi, postApi, putApi } from './configs';

export const addMembersApi = (body: POSTAddMembersBody) =>
  postApi('/company/members/add-members', body);

export type DeleteMemberApiBody = {
  memberEmail: string;
  companyId: string;
};
export const deleteMemberApi = (body: DeleteMemberApiBody) =>
  deleteApi('/company/members/delete-member', body);

export const adminDeleteMemberApi = ({
  memberEmail,
  companyId,
}: DeleteMemberApiBody) =>
  deleteApi(`/admin/users/company/${companyId}/members/delete`, {
    memberEmail,
  });

export type UpdateCompanyApiBody = {
  companyId: string;
  // The API only forwards `id`, `publicData` and `profileImageId`. `metadata`
  // is not settable here — it holds `isAdmin` / `isDisabled` / `userState`.
  dataParams: {
    id: string;
    publicData?: {
      [key: string]: any;
    };
    profileImageId?: string;
  };
  queryParams: {
    expand: boolean;
    include?: string[];
    [key: string]: any;
  };
};
export const updateCompany = (body: UpdateCompanyApiBody) =>
  putApi(`/company`, body);

export type GetGroupDetailApiParams = {
  memberIds: string[];
  page: number;
  perPage: number;
};
export const getGroupDetailApi = ({
  memberIds,
  page,
  perPage,
}: GetGroupDetailApiParams) =>
  getApi(`/company/group/all-member?perPage=${perPage}&page=${page}`, {
    memberIds,
  });

export type CreateGroupApiBody = {
  companyId: string;
  groupInfo: {
    name: string;
  };
  groupMembers: {
    id: string;
    email: string;
  }[];
};
export const createGroupApi = (body: CreateGroupApiBody) =>
  postApi('/company/group', body);

export type UpdateGroupApiBody = {
  companyId: string;
  groupId: string;
  groupInfo?: {
    name?: string;
    description?: string;
  };
  addedMembers?: {
    id: string;
    email: string;
  }[];
  deletedMembers?: {
    id: string;
    email: string;
  }[];
};
export const updateGroupApi = (body: UpdateGroupApiBody) =>
  putApi('/company/group', body);

export type DeleteGroupApiData = {
  companyId: string;
  groupId: string;
};
export const deleteGroupApi = (data: DeleteGroupApiData) =>
  deleteApi('/company/group', data);

export const queryOrdersApi = (companyId: string, params: TObject = {}) => {
  return getDedupApi(`/company/${companyId}/orders/`, params);
};

const queryCompanyPlansByOrderIdsApi = (
  companyId: string,
  params: TObject = {},
) => {
  return getDedupApi(`/company/${companyId}/plans/`, params);
};

export const getCompanyNotificationsApi = (companyId: string) => {
  return getDedupApi(`/company/${companyId}/orders/notifications/`);
};

export const getCompanyOrderSummaryApi = (companyId: string) => {
  return getDedupApi(`/company/${companyId}/orders/summary/`);
};

export const companyApi = {
  queryOrdersApi,
  queryCompanyPlansByOrderIdsApi,
};

export const getAllCompanyMembersApi = (companyId: string) =>
  getApi(`/company/all-employees?companyId=${companyId}`);

export const queryMembersByEmailAdminApi = ({
  emails,
  companyId,
  queryParams,
}: {
  emails: string[];
  companyId: string;
  queryParams?: TObject;
}) => {
  return getApi(
    `/admin/users/company/${companyId}/query-new-members-by-email`,
    {
      dataParams: { emails },
      queryParams,
    },
  );
};

export const adminAddMembersToCompanyApi = (
  companyId: string,
  dataParams?: {
    userIdList: string[];
    noAccountEmailList: string[];
  },
) => {
  return postApi(`/admin/users/company/${companyId}/members/add`, dataParams);
};

export const adminDeleteGroupApi = ({
  companyId,
  groupId,
}: DeleteGroupApiData) =>
  deleteApi(`/admin/users/company/${companyId}/groups/delete`, {
    companyId,
    groupId,
  });

export const adminCreateGroupApi = ({
  companyId,
  ...rest
}: CreateGroupApiBody) =>
  postApi(`/admin/users/company/${companyId}/groups/create`, rest);

export const adminUpdateGroupApi = ({
  companyId,
  ...rest
}: UpdateGroupApiBody) =>
  postApi(`/admin/users/company/${companyId}/groups/update`, rest);

export type TUpdateMemberPermissionApiParams = {
  companyId: string;
  memberEmail: string;
  permission: string;
};

export const adminUpdateMemberPermissionApi = ({
  companyId,
  ...rest
}: TUpdateMemberPermissionApiParams) =>
  putApi(`/admin/users/company/${companyId}/members/update-permission`, rest);

export const favoriteRestaurantApi = (
  companyId: string,
  restaurantId: string,
) =>
  postApi(`/company/${companyId}/favorite-restaurant/${restaurantId}`, {
    companyId,
    restaurantId,
  });

export const fetchCompanyInfo = (companyId: string) =>
  getApi(`/company/${companyId}`);

export type TAdminTransferCompanyOwnerParams = {
  companyId: string;
  newOwnerEmail: string;
  permissionForOldOwner?: string;
  newOwnerProfileImageId?: string;
};

export const adminTransferCompanyOwnerApi = ({
  companyId,
  newOwnerEmail,
  permissionForOldOwner,
  newOwnerProfileImageId,
}: TAdminTransferCompanyOwnerParams) =>
  postApi(`/admin/users/company/${companyId}/transfer-owner`, {
    newOwnerEmail,
    newOwnerProfileImageId,
    permissionForOldOwner,
  });

export const bookerPostRatingApi = (body: POSTCompanyRatingsBody) =>
  postApi('/company/ratings', body);

export const queryAllClientPaymentRecordsApi = (
  companyId: string,
  params: any,
) => getApi(`/company/${companyId}/payment/payment-client`, params);

export const adminQueryAllClientPaymentsApi = (lastPaymentRecord: number) => {
  return getApi(`/admin/payment/client`, { lastPaymentRecord });
};

export const fetchBookerNotificationsApi = () =>
  getDedupApi(`/company/notifications/`);

export const getCompanyRatingsApi = (
  companyId: string,
  payload: GETCompanyRaitingsQuery,
) =>
  getDedupApi<BookerViewerRatingData>(
    `/company/${companyId}/ratings/`,
    payload,
  );
