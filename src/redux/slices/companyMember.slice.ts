/* eslint-disable import/no-cycle */
import { createSlice } from '@reduxjs/toolkit';

import type { TUpdateMemberPermissionApiParams } from '@apis/companyApi';
import {
  addMembersApi,
  adminAddMembersToCompanyApi,
  adminDeleteMemberApi,
  adminUpdateMemberPermissionApi,
  deleteMemberApi,
} from '@apis/companyApi';
import {
  adminToggleUserDisabledApi,
  getCompanyMembersDetailsApi,
  queryCompanyMembersApi,
} from '@apis/index';
import { checkUserExistedApi, checkUsersExistedApi } from '@apis/userApi';
import type { POSTAddMembersBody } from '@pages/api/company/members/add-members.api';
import { createAsyncThunk } from '@redux/redux.helper';
import { storableAxiosError } from '@utils/errors';
import type { TObject, TUser } from '@utils/types';

import { companySlice, companyThunks } from './company.slice';

export type TCompanyMembersByCompanyId = Record<string, TUser[]>;

export type TAddMembersToCompanyParams = {
  companyId: string;
  userIdList: string[];
  noAccountEmailList: string[];
};
interface TCompanyMemberState {
  company: TUser | null;
  companyMembers: any[];
  addMembersInProgress: boolean;
  addMembersError: any;

  deleteMemberInProgress: boolean;
  deleteMemberError: any;

  checkedEmailInputChunk: any[];
  checkEmailExistedInProgress: boolean;
  checkEmailMultipleExistedInProgress: boolean;

  queryMembersInProgress: boolean;
  queryMembersError: any;

  updatingMemberPermissionEmail: string | null;
  updateMemberPermissionError: any;

  companyMembersByCompanyId: TCompanyMembersByCompanyId | null;
  getCompanyMembersByCompanyIdInProgress: boolean;
  getCompanyMembersByCompanyIdError: any;

  togglingDisabledMemberId: string | null;
  toggleMemberDisabledError: any;
}

const initialState: TCompanyMemberState = {
  company: null,
  companyMembers: [],
  addMembersInProgress: false,
  addMembersError: null,

  deleteMemberInProgress: false,
  deleteMemberError: null,

  checkedEmailInputChunk: [],
  checkEmailExistedInProgress: false,
  checkEmailMultipleExistedInProgress: false,

  queryMembersInProgress: false,
  queryMembersError: null,

  updatingMemberPermissionEmail: null,
  updateMemberPermissionError: null,

  companyMembersByCompanyId: null,
  getCompanyMembersByCompanyIdInProgress: false,
  getCompanyMembersByCompanyIdError: null,

  togglingDisabledMemberId: null,
  toggleMemberDisabledError: null,
};

const CHECK_EMAILS_EXISTED = 'app/companyMember/CHECK_EMAILS_EXISTED';
const CHECK_MULTIPLE_EMAILS_EXISTED =
  'app/companyMember/CHECK_MULTIPLE_EMAILS_EXISTED';
const ADD_MEMBERS = 'app/companyMember/ADD_MEMBERS';
const DELETE_MEMBER = 'app/companyMember/DELETE_MEMBER';
const QUERY_COMPANY_MEMBERS = 'app/companyMember/QUERY_COMPANY_MEMBERS';

const ADMIN_DELETE_MEMBER = 'app/companyMember/ADMIN_DELETE_MEMBER';
const ADMIN_ADD_MEMBERS = 'app/companyMember/ADMIN_ADD_MEMBERS';
const ADMIN_UPDATE_MEMBER_PERMISSION =
  'app/companyMember/ADMIN_UPDATE_MEMBER_PERMISSION';

const ADMIN_TOGGLE_MEMBER_DISABLED =
  'app/companyMember/ADMIN_TOGGLE_MEMBER_DISABLED';

const GET_COMPANY_MEMBERS_BY_COMPANY_IDS =
  'app/companyMember/GET_COMPANY_MEMBERS_BY_COMPANY_IDS';

const queryCompanyMembers = createAsyncThunk(
  QUERY_COMPANY_MEMBERS,
  async (id: string) => {
    const { data } = await queryCompanyMembersApi(id);

    return data;
  },
  {
    serializeError: storableAxiosError,
  },
);

const checkEmailExisted = createAsyncThunk(
  CHECK_EMAILS_EXISTED,
  async (emailList: string[]) => {
    const response = await Promise.all(
      emailList.map(async (email) => {
        const { data: queryResponse } = await checkUserExistedApi({ email });

        return { email, response: queryResponse };
      }),
    );

    return response;
  },
);

const checkMultipleEmailExisted = createAsyncThunk(
  CHECK_MULTIPLE_EMAILS_EXISTED,
  async (emailList: string[]) => {
    const response = await checkUsersExistedApi({
      emails: emailList,
    });

    return response.data.map((item: TObject) => {
      return {
        email: item?.email,
        response: {
          status: item?.status,
          ...(item?.status === 200 && { user: item?.user }),
          ...(item?.status === 404 && { message: item?.message }),
        },
      };
    });
  },
);

const addMembers = createAsyncThunk(
  ADD_MEMBERS,
  async (
    params: Omit<POSTAddMembersBody, 'companyId'>,
    { getState, dispatch },
  ) => {
    const { workspaceCompanyId } = getState().company;
    const { data: addMembersResponse } = await addMembersApi({
      ...params,
      companyId: workspaceCompanyId,
    });
    await dispatch(companyThunks.companyInfo());

    return addMembersResponse;
  },
);

const adminAddMembers = createAsyncThunk(
  ADMIN_ADD_MEMBERS,
  async (
    { companyId, userIdList, noAccountEmailList }: TAddMembersToCompanyParams,
    { dispatch },
  ) => {
    const { data } = await adminAddMembersToCompanyApi(companyId, {
      userIdList,
      noAccountEmailList,
    });
    await dispatch(queryCompanyMembers(companyId));
    dispatch(companySlice.actions.renewCompanyState(data));

    return data;
  },
  {
    serializeError: storableAxiosError,
  },
);

const deleteMember = createAsyncThunk(
  DELETE_MEMBER,
  async (email: string, { getState }) => {
    const { workspaceCompanyId } = getState().company;
    const { data: deleteMemberData } = await deleteMemberApi({
      memberEmail: email,
      companyId: workspaceCompanyId,
    });

    return deleteMemberData;
  },
  {
    serializeError: storableAxiosError,
  },
);

const adminDeleteMember = createAsyncThunk(
  ADMIN_DELETE_MEMBER,
  async (
    { companyId, email }: { companyId: string; email: string },
    { dispatch },
  ) => {
    const { data } = await adminDeleteMemberApi({
      memberEmail: email,
      companyId,
    });
    await dispatch(queryCompanyMembers(companyId));
    dispatch(companySlice.actions.renewCompanyState(data));

    return data;
  },
  { serializeError: storableAxiosError },
);

const adminUpdateMemberPermission = createAsyncThunk(
  ADMIN_UPDATE_MEMBER_PERMISSION,
  async (params: TUpdateMemberPermissionApiParams, { dispatch }) => {
    const { data } = await adminUpdateMemberPermissionApi(params);
    await dispatch(queryCompanyMembers(params.companyId));
    dispatch(companySlice.actions.renewCompanyState(data));

    return data;
  },
  { serializeError: storableAxiosError },
);

const adminToggleMemberDisabled = createAsyncThunk(
  ADMIN_TOGGLE_MEMBER_DISABLED,
  async (
    {
      companyId,
      userId,
      isDisabled,
    }: { companyId: string; userId: string; isDisabled: boolean },
    { dispatch },
  ) => {
    const { data } = await adminToggleUserDisabledApi(userId, isDisabled);
    await dispatch(queryCompanyMembers(companyId));

    return data;
  },
  { serializeError: storableAxiosError },
);

const getCompanyMemberByCompanyIds = createAsyncThunk(
  GET_COMPANY_MEMBERS_BY_COMPANY_IDS,
  async (ids: string[], { fulfillWithValue }) => {
    let allMembers: TCompanyMembersByCompanyId = {};
    await Promise.all(
      ids.map(async (id: string) => {
        if (!allMembers[id]) {
          allMembers[id] = [];
        }
        const { data: members = [] } = await getCompanyMembersDetailsApi(id);
        allMembers = {
          ...allMembers,
          [id]: [...allMembers[id], ...members],
        };

        return allMembers;
      }),
    );

    return fulfillWithValue(allMembers);
  },
  {
    serializeError: storableAxiosError,
  },
);

export const companyMemberThunks = {
  addMembers,
  deleteMember,
  checkEmailExisted,
  checkMultipleEmailExisted,
  queryCompanyMembers,
  adminAddMembers,
  adminDeleteMember,
  adminUpdateMemberPermission,
  adminToggleMemberDisabled,
  getCompanyMemberByCompanyIds,
};

export const companyMemberSlice = createSlice({
  name: 'companyMember',
  initialState,
  reducers: {
    resetCheckedEmailInputChunk: (state) => {
      state.checkedEmailInputChunk = [];
    },
    resetError: (state) => {
      state.addMembersError = null;
      state.deleteMemberError = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(adminToggleMemberDisabled.pending, (state, { meta }) => ({
        ...state,
        togglingDisabledMemberId: meta.arg.userId,
        toggleMemberDisabledError: null,
      }))
      .addCase(adminToggleMemberDisabled.fulfilled, (state) => ({
        ...state,
        togglingDisabledMemberId: null,
      }))
      .addCase(adminToggleMemberDisabled.rejected, (state, { error }) => ({
        ...state,
        togglingDisabledMemberId: null,
        toggleMemberDisabledError: error,
      }))

      .addCase(checkEmailExisted.pending, (state) => ({
        ...state,
        checkEmailExistedInProgress: true,
      }))
      .addCase(checkEmailExisted.fulfilled, (state, { payload }) => ({
        ...state,
        checkEmailExistedInProgress: false,
        checkedEmailInputChunk: payload,
      }))
      .addCase(checkEmailExisted.rejected, (state) => ({
        ...state,
        checkEmailExistedInProgress: false,
      }))

      .addCase(checkMultipleEmailExisted.pending, (state) => ({
        ...state,
        checkEmailMultipleExistedInProgress: true,
      }))
      .addCase(checkMultipleEmailExisted.fulfilled, (state) => ({
        ...state,
        checkEmailMultipleExistedInProgress: false,
      }))
      .addCase(checkMultipleEmailExisted.rejected, (state) => ({
        ...state,
        checkEmailMultipleExistedInProgress: false,
      }))

      .addCase(addMembers.pending, (state) => ({
        ...state,
        addMembersInProgress: true,
        addMembersError: null,
      }))
      .addCase(addMembers.fulfilled, (state) => ({
        ...state,
        addMembersInProgress: false,
      }))
      .addCase(addMembers.rejected, (state, { error }) => ({
        ...state,
        addMembersInProgress: false,
        addMembersError: error.message,
      }))

      .addCase(deleteMember.pending, (state) => ({
        ...state,
        deleteMemberInProgress: true,
        deleteMemberError: null,
      }))
      .addCase(deleteMember.fulfilled, (state) => ({
        ...state,
        deleteMemberInProgress: false,
      }))
      .addCase(deleteMember.rejected, (state, { payload }) => ({
        ...state,
        deleteMemberInProgress: false,
        deleteMemberError: (payload as TObject)?.message,
      }))
      .addCase(queryCompanyMembers.pending, (state) => ({
        ...state,
        queryMembersInProgress: true,
        queryMembersError: null,
      }))
      .addCase(queryCompanyMembers.fulfilled, (state, { payload }) => ({
        ...state,
        queryMembersInProgress: false,
        companyMembers: payload,
      }))
      .addCase(queryCompanyMembers.rejected, (state, { error }) => ({
        ...state,
        queryMembersError: error,
        queryMembersInProgress: false,
      }))
      .addCase(adminAddMembers.pending, (state) => ({
        ...state,
        addMembersInProgress: true,
        addMembersError: null,
      }))
      .addCase(adminAddMembers.fulfilled, (state) => ({
        ...state,
        addMembersInProgress: false,
      }))
      .addCase(adminAddMembers.rejected, (state, { error }) => ({
        ...state,
        addMembersInProgress: false,
        addMembersError: error.message,
      }))
      .addCase(adminDeleteMember.pending, (state) => ({
        ...state,
        deleteMemberInProgress: true,
        deleteMemberError: null,
      }))
      .addCase(adminDeleteMember.fulfilled, (state) => ({
        ...state,
        deleteMemberInProgress: false,
      }))
      .addCase(adminDeleteMember.rejected, (state, { error }) => ({
        ...state,
        deleteMemberInProgress: false,
        deleteMemberError: error,
      }))
      .addCase(adminUpdateMemberPermission.pending, (state, { meta }) => ({
        ...state,
        updatingMemberPermissionEmail: meta?.arg?.memberEmail,
        updateMemberPermissionError: null,
      }))
      .addCase(adminUpdateMemberPermission.fulfilled, (state) => ({
        ...state,
        updatingMemberPermissionEmail: null,
      }))
      .addCase(adminUpdateMemberPermission.rejected, (state, { error }) => ({
        ...state,
        updatingMemberPermissionEmail: null,
        updateMemberPermissionError: error,
      }))
      .addCase(getCompanyMemberByCompanyIds.pending, (state) => ({
        ...state,
        getCompanyMembersByCompanyIdInProgress: true,
        getCompanyMembersByCompanyIdError: null,
      }))
      .addCase(
        getCompanyMemberByCompanyIds.fulfilled,
        (state, { payload }) => ({
          ...state,
          companyMembersByCompanyId: payload,
          getCompanyMembersByCompanyIdInProgress: false,
        }),
      )
      .addCase(getCompanyMemberByCompanyIds.rejected, (state, { error }) => ({
        ...state,
        getCompanyMembersByCompanyIdInProgress: false,
        getCompanyMembersByCompanyIdError: error,
      }));
  },
});
export const companyMemberActions = companyMemberSlice.actions;
export default companyMemberSlice.reducer;
