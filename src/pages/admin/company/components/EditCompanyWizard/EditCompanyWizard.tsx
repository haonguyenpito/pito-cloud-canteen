/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-shadow */
import type { MutableRefObject } from 'react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import type { FormApi } from 'final-form';
import { useRouter } from 'next/router';

import type {
  CreateGroupApiBody,
  TAdminTransferCompanyOwnerParams,
} from '@apis/companyApi';
import Button from '@components/Button/Button';
import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import type { TFormTabChildrenProps } from '@components/FormWizard/FormTabs/FormTabs';
import FormWizard from '@components/FormWizard/FormWizard';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import { getInitialLocationValues } from '@helpers/mapHelpers';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useRedirectTabWizard from '@hooks/useRedirectTabWizard';
import {
  clearStates,
  clearTransferOwnerError,
  companySlice,
  companyThunks,
} from '@redux/slices/company.slice';
import {
  companyMemberActions,
  companyMemberThunks,
} from '@redux/slices/companyMember.slice';
import { adminRoutes } from '@src/paths';
import { User } from '@utils/data';
import { isSignUpEmailTakenError } from '@utils/errors';
import type {
  TCompany,
  TCompanyMemberWithDetails,
  TCreateCompanyApiParams,
  TImage,
  TObject,
  TUpdateCompanyApiParams,
} from '@utils/types';

import type { TAddCompanyGroupsFormValues } from '../AddCompanyGroupsForm/AddCompanyGroupsForm';
import type { TEditCompanyBankAccountsFormValues } from '../EditCompanyBankAccountsForm/EditCompanyBankAccountsForm';
import type { TEditCompanyInformationFormValues } from '../EditCompanyInformationForm/EditCompanyInformationForm';
import EditInformationCompanyForm from '../EditCompanyInformationForm/EditCompanyInformationForm';
import type { TEditCompanyOtherSettingsFormValues } from '../EditCompanyOtherSettingsForm/EditCompanyOtherSettingsForm';
import type { TEditCompanySettingsInformationFormValues } from '../EditCompanySettingsInformationForm/EditCompanySettingsInformationForm';
import EditCompanySettingsTabs from '../EditCompanySettingsTabs/EditCompanySettingsTabs';
import type { TUpdateCompanyGroupFormValues } from '../UpdateCompanyGroupForm/UpdateCompanyGroupForm';

import {
  COMPANY_INFORMATION_TAB,
  COMPANY_SETTINGS_TAB,
  createSubmitAddMembersToCompanyValues,
  createSubmitCreateCompanyValues,
  createSubmitUpdateCompanyValues,
  EDIT_COMPANY_WIZARD_TABS,
} from './utils';

import css from './EditCompanyWizard.module.scss';

type TEditCompanyWizardTab = {
  tab: string;
  onCompleteEditCompanyWizardTab: (
    values: TEditCompanyInformationFormValues &
      TEditCompanySettingsInformationFormValues,
  ) => void;
  formRef: MutableRefObject<
    FormApi<
      TEditCompanyInformationFormValues,
      Partial<TEditCompanySettingsInformationFormValues>
    >
  >;
  isEditting: boolean;
  company: TCompany;
  onCompanyLogoUpload: (params: { id: string; file: File }) => any;
  onRemoveCompanyLogo: () => void;
  uploadCompanyLogoError: any;
  uploadedCompanyLogo: TImage | null | { id: string; file: File };
  uploadingCompanyLogo: boolean;
  companyMembers: TCompanyMemberWithDetails[];
  onAddMembersToCompany: (values: TObject) => void;
  onAddGroupToCompany: (values: TAddCompanyGroupsFormValues) => void;
  addMembersInProgress: boolean;
  addMembersError: any;
  createGroupInProgress: boolean;
  createGroupError: any;
  onUpdateGroup: (values: TUpdateCompanyGroupFormValues) => void;
  updateGroupInProgress: boolean;
  updateGroupError: any;
  deleteMemberInProgress: boolean;
  deleteMemberError: any;
  onRemoveMember: (email: string) => void;
  deleteGroupInProgress: boolean;
  deleteGroupError: any;
  onRemoveGroup: (groupId: string) => void;
  onUpdateMemberPermission: (params: {
    memberEmail: string;
    permission: string;
  }) => void;
  updatingMemberPermissionEmail: string | null;
  updateMemberPermissionError: any;
  onTransferCompanyOwner: (params: TAdminTransferCompanyOwnerParams) => void;
  transferCompanyOwnerInProgress: boolean;
  transferCompanyOwnerError: any;
  queryMembersInProgress: boolean;
  queryMembersError: any;
  companyId: string;
  resetCompanyMemberSliceError: () => void;
  resetTransferError: () => void;
} & TFormTabChildrenProps;

const defaultBankAccounts = [
  {
    bankId: '',
    bankAgency: '',
    bankAccountNumber: '',
    bankOwnerName: '',
    isDefault: true,
  },
];

const redirectAfterDraftUpdate = (
  companyId: string,
  tab: string,
  tabs: string[],
  router: any,
) => {
  const tabIndex = tabs.findIndex((cur) => cur === tab);
  const nextTab = tabs[tabIndex + 1];
  if (!nextTab) return;

  return router.push({
    pathname: `/admin/company/${companyId}/edit`,
    query: {
      tab: nextTab,
    },
  });
};

const tabCompleted = (tab: string, company: TCompany | null): boolean => {
  const { profileImage } = company || {};
  const { profile } = company?.attributes || {};
  const {
    displayName,
    publicData = {},
    privateData = {},
    metadata = {},
  } = profile || {};
  const { companyLocation, phoneNumber, companyName } = publicData;
  const { bankAccounts = [] } = privateData;
  const { members = {}, groups = [] } = metadata;

  const isCompanyInformationTabCompleted = !!(
    displayName &&
    companyLocation &&
    phoneNumber &&
    companyName
  );

  const isCompanySettingsTabCompleted = !!(
    profileImage &&
    Object.keys(members).length > 0 &&
    groups.length > 0 &&
    bankAccounts.length > 0
  );

  switch (tab) {
    case COMPANY_INFORMATION_TAB:
      return isCompanyInformationTabCompleted;
    case COMPANY_SETTINGS_TAB:
      return isCompanySettingsTabCompleted;
    default:
      return true;
  }
};

const EditCompanyWizardTab: React.FC<TEditCompanyWizardTab> = (props) => {
  const {
    tab,
    onCompleteEditCompanyWizardTab,
    formRef,
    isEditting,
    company,
    onCompanyLogoUpload,
    uploadedCompanyLogo,
    uploadCompanyLogoError,
    onRemoveCompanyLogo,
    uploadingCompanyLogo,
    companyMembers,
    onAddMembersToCompany,
    onAddGroupToCompany,
    addMembersInProgress,
    addMembersError,
    createGroupInProgress,
    createGroupError,
    onUpdateGroup,
    updateGroupInProgress,
    updateGroupError,
    deleteMemberInProgress,
    deleteMemberError,
    onRemoveMember,
    deleteGroupInProgress,
    deleteGroupError,
    onRemoveGroup,
    onUpdateMemberPermission,
    updateMemberPermissionError,
    updatingMemberPermissionEmail,
    onTransferCompanyOwner,
    transferCompanyOwnerInProgress,
    transferCompanyOwnerError,
    queryMembersInProgress,
    queryMembersError,
    companyId,
    resetCompanyMemberSliceError,
    resetTransferError,
  } = props;

  const initialValues = useMemo(() => {
    switch (tab) {
      case COMPANY_INFORMATION_TAB: {
        return company
          ? {
              firstName: User(company).getProfile().firstName,
              lastName: User(company).getProfile().lastName,
              email: User(company).getProfile().email,
              phoneNumber: User(company).getPublicData().phoneNumber,
              companyName: User(company).getPublicData().companyName,
              companyEmail: User(company).getPublicData().companyEmail,
              companyLocation: getInitialLocationValues(
                User(company).getPublicData().companyLocation,
              ),
              tax: User(company).getPrivateData().tax,
              note: User(company).getPublicData().note,
              location: getInitialLocationValues(
                User(company).getPublicData().location,
              ),
            }
          : {};
      }
      case COMPANY_SETTINGS_TAB: {
        return company
          ? ({
              companyLogo: company?.profileImage,
              nutritions: User(company).getPublicData().nutritions || [],
              bankAccounts:
                (User(company).getPrivateData().bankAccounts?.length > 0 &&
                  User(company).getPrivateData().bankAccounts) ||
                defaultBankAccounts,
              paymentDueDays: User(company).getPrivateData().paymentDueDays,
              specificPCCFee: User(company).getMetadata().specificPCCFee,
              specificPCCFeeTiers:
                User(company).getMetadata().specificPCCFeeTiers ??
                (User(company).getMetadata().hasSpecificPCCFee &&
                User(company).getMetadata().specificPCCFee
                  ? [
                      {
                        maxQuantity: null,
                        price: User(company).getMetadata().specificPCCFee,
                      },
                    ]
                  : []),
            } as TEditCompanySettingsInformationFormValues &
              TEditCompanyBankAccountsFormValues &
              TEditCompanyOtherSettingsFormValues)
          : {};
      }

      default:
        return {};
    }
  }, [JSON.stringify(company)]);

  switch (tab) {
    case COMPANY_INFORMATION_TAB:
      return (
        <EditInformationCompanyForm
          formRef={
            formRef as MutableRefObject<
              FormApi<TEditCompanyInformationFormValues>
            >
          }
          onSubmit={onCompleteEditCompanyWizardTab as any}
          isEditting={isEditting}
          initialValues={initialValues as TEditCompanyInformationFormValues}
        />
      );
    case COMPANY_SETTINGS_TAB:
      return (
        <EditCompanySettingsTabs
          initialValues={
            initialValues as TEditCompanySettingsInformationFormValues &
              TEditCompanyBankAccountsFormValues &
              TEditCompanyOtherSettingsFormValues
          }
          onCompanyLogoUpload={onCompanyLogoUpload}
          uploadedCompanyLogo={uploadedCompanyLogo}
          uploadCompanyLogoError={uploadCompanyLogoError}
          onRemoveCompanyLogo={onRemoveCompanyLogo}
          uploadingCompanyLogo={uploadingCompanyLogo}
          formRef={formRef}
          onSubmit={onCompleteEditCompanyWizardTab as any}
          companyMembers={companyMembers}
          company={company}
          onAddMembersToCompany={onAddMembersToCompany}
          onAddGroupToCompany={onAddGroupToCompany}
          addMembersInProgress={addMembersInProgress}
          addMembersError={addMembersError}
          createGroupInProgress={createGroupInProgress}
          createGroupError={createGroupError}
          onUpdateGroup={onUpdateGroup}
          updateGroupInProgress={updateGroupInProgress}
          updateGroupError={updateGroupError}
          deleteMemberInProgress={deleteMemberInProgress}
          deleteMemberError={deleteMemberError}
          onRemoveMember={onRemoveMember}
          deleteGroupInProgress={deleteGroupInProgress}
          deleteGroupError={deleteGroupError}
          onRemoveGroup={onRemoveGroup}
          onUpdateMemberPermission={onUpdateMemberPermission}
          updatingMemberPermissionEmail={updatingMemberPermissionEmail}
          updateMemberPermissionError={updateMemberPermissionError}
          onTransferCompanyOwner={onTransferCompanyOwner}
          transferCompanyOwnerInProgress={transferCompanyOwnerInProgress}
          transferCompanyOwnerError={transferCompanyOwnerError}
          queryMembersInProgress={queryMembersInProgress}
          queryMembersError={queryMembersError}
          companyId={companyId}
          resetCompanyMemberSliceError={resetCompanyMemberSliceError}
          resetTransferError={resetTransferError}
        />
      );
    default:
      return <></>;
  }
};

const EditCompanyWizard = () => {
  const dispatch = useAppDispatch();
  const intl = useIntl();
  const formRef = useRef() as MutableRefObject<
    FormApi<
      TEditCompanyInformationFormValues,
      Partial<TEditCompanySettingsInformationFormValues>
    >
  >;
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const router = useRouter();
  const { tab: selectedTab = COMPANY_INFORMATION_TAB, companyId } =
    router.query;

  const {
    createCompanyInProgress,
    createCompanyError,
    updateCompanyInProgress,
    updateCompanyError,
    company,
    showCompanyInProgress,
    uploadedCompanyLogo,
    uploadingCompanyLogo,
    uploadCompanyLogoError,
    createGroupInProgress,
    createGroupError,
    updateGroupInProgress,
    updateGroupError,
    deleteGroupInProgress,
    deleteGroupError,
    transferCompanyOwnerInProgress,
    transferCompanyOwnerError,
  } = useAppSelector((state) => state.company, shallowEqual);

  const {
    companyMembers,
    queryMembersInProgress,
    queryMembersError,
    addMembersInProgress,
    addMembersError,
    deleteMemberInProgress,
    deleteMemberError,
    updatingMemberPermissionEmail,
    updateMemberPermissionError,
  } = useAppSelector((state) => state.companyMember, shallowEqual);

  const onTransferCompanyOwner = async (
    params: TAdminTransferCompanyOwnerParams,
  ) => {
    const { profileImage } = company || {};

    const { error, payload } = (await dispatch(
      companyThunks.adminTransferCompanyOwner({ ...params, profileImage }),
    )) as any;

    if (!error) {
      const newCompanyId = User(payload).getId();

      return router.push(`/admin/company/${newCompanyId}/edit/?tab=settings`);
    }
  };

  const onCompleteEditCompanyWizardTab = async (
    values: TEditCompanyInformationFormValues &
      TEditCompanySettingsInformationFormValues,
  ) => {
    const submitValues = companyId
      ? createSubmitUpdateCompanyValues(values as any, selectedTab as string)
      : createSubmitCreateCompanyValues(values);

    const { payload, error } = (
      companyId
        ? await dispatch(
            companyThunks.adminUpdateCompany({
              id: companyId,
              ...submitValues,
            } as unknown as TUpdateCompanyApiParams),
          )
        : await dispatch(
            companyThunks.adminCreateCompany(
              submitValues as TCreateCompanyApiParams,
            ),
          )
    ) as any;

    const id = User(payload).getId();

    if (!error) {
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    }

    if (!error) {
      return redirectAfterDraftUpdate(
        id,
        selectedTab as string,
        EDIT_COMPANY_WIZARD_TABS,
        router,
      );
    }
  };

  const formErrorMessage = createCompanyError
    ? isSignUpEmailTakenError(createCompanyError)
      ? intl.formatMessage({
          id: 'CreateCompanyPage.createCompanyEmailAlreadyTaken',
        })
      : intl.formatMessage({
          id: 'CreateCompanyPage.createCompanyFailed',
        })
    : null;

  useEffect(() => {
    dispatch(companySlice.actions.clearError());

    return () => {
      dispatch(companySlice.actions.clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (!companyId) return;
    dispatch(companyThunks.showCompany(companyId as string));
  }, [companyId]);

  useEffect(() => {
    return () => {
      dispatch(clearStates());
    };
  }, []);

  const tabLink = (tab: string) => {
    return {
      path: !companyId
        ? `/admin/company/create`
        : `/admin/company/${companyId}/edit`,
      to: {
        search: `tab=${tab}`,
      },
    };
  };

  const isNewUserFlow = !company;

  const handleRedirectOnSwitchTab = (nearestActiveTab: string) => {
    router.push(
      {
        pathname: !company
          ? adminRoutes.CreateCompany.path
          : adminRoutes.EditCompany.path,
      },
      {
        search: `tab=${nearestActiveTab}`,
      },
    );
  };

  useRedirectTabWizard({
    isNew: isNewUserFlow,
    entity: company as TCompany,
    selectedTab: selectedTab as string,
    tabs: EDIT_COMPANY_WIZARD_TABS,
    tabCompleted: tabCompleted as any,
    handleRedirect: handleRedirectOnSwitchTab,
  });

  const inProgress = createCompanyInProgress || updateCompanyInProgress;

  const errorMessage =
    formErrorMessage ||
    (updateCompanyError && updateCompanyError.message) ||
    (createCompanyError && createCompanyError.message);

  const onSubmitOutsideForm = () => {
    formRef.current.submit();
  };

  const uploadCompanyLogo = (params: { id: string; file: File }) => {
    return dispatch(companyThunks.requestUploadCompanyLogo(params));
  };

  const removeCompanyLogo = () => {
    dispatch(companySlice.actions.removeCompanyLogo());
  };

  const onAddGroupToCompany = (values: TAddCompanyGroupsFormValues) => {
    const { groupName, members = [] } = values;
    const params = {
      companyId: companyId as string,
      groupInfo: {
        name: groupName,
      },
      groupMembers: members.map((memberEmail) => ({
        email: memberEmail,
        id: companyMembers?.find((member) => member.email === memberEmail)?.id,
      })),
    };

    return dispatch(
      companyThunks.adminCreateGroup(params as unknown as CreateGroupApiBody),
    );
  };

  const onAddMembersToCompany = (values: TObject) => {
    const submitValues = createSubmitAddMembersToCompanyValues(values);

    return dispatch(
      companyMemberThunks.adminAddMembers({
        ...submitValues,
        companyId: companyId as string,
      }),
    );
  };

  const parseMemberEmail = (memberEmails: string[] = []) => {
    return memberEmails.map((email) => {
      const id = companyMembers.find((member) => member.email === email)?.id;

      return { email, id };
    });
  };

  const onUpdateGroup = (values: TUpdateCompanyGroupFormValues) => {
    const { deletedMemberEmails, groupName, groupId, addedMemberEmails } =
      values;

    return dispatch(
      companyThunks.adminUpdateGroup({
        deletedMembers: parseMemberEmail(deletedMemberEmails) as any,
        companyId: companyId as string,
        groupInfo: {
          name: groupName,
        },
        groupId,
        addedMembers: parseMemberEmail(addedMemberEmails) as any,
      }),
    );
  };

  const onRemoveMember = (email: string) => {
    return dispatch(
      companyMemberThunks.adminDeleteMember({
        companyId: companyId as string,
        email,
      }),
    );
  };

  const onRemoveGroup = (groupId: string) => {
    return dispatch(
      companyThunks.adminDeleteGroup({
        groupId,
        companyId: companyId as string,
      }),
    );
  };

  const onUpdateMemberPermission = (params: {
    memberEmail: string;
    permission: string;
  }) => {
    return dispatch(
      companyMemberThunks.adminUpdateMemberPermission({
        ...params,
        companyId: companyId as string,
      }),
    );
  };

  const goBack = () => {
    router.push({
      pathname: adminRoutes.EditCompany.path,
      query: {
        tab: COMPANY_INFORMATION_TAB,
        companyId,
      },
    });
  };

  const resetCompanyMemberSliceError = () => {
    dispatch(companyMemberActions.resetError());
  };

  const resetTransferError = () => {
    dispatch(clearTransferOwnerError());
  };

  useEffect(() => {
    if (selectedTab === COMPANY_SETTINGS_TAB && companyId) {
      dispatch(companyMemberThunks.queryCompanyMembers(companyId as string));
    }
  }, [selectedTab, companyId, dispatch]);

  if (showCompanyInProgress) {
    return <LoadingContainer />;
  }

  return (
    <>
      <FormWizard>
        {EDIT_COMPANY_WIZARD_TABS.map((tab, index) => {
          const completed = tabCompleted(
            EDIT_COMPANY_WIZARD_TABS[index - 1],
            company as TCompany,
          );

          return (
            <EditCompanyWizardTab
              key={tab}
              tab={tab}
              tabId={tab}
              selected={selectedTab === tab}
              tabLabel={intl.formatMessage({
                id: `EditPartnerMenuWizard.${tab}TabLabel`,
              })}
              tabLinkProps={tabLink(tab)}
              onCompleteEditCompanyWizardTab={onCompleteEditCompanyWizardTab}
              formRef={formRef}
              isEditting={!!companyId}
              company={company as TCompany}
              onCompanyLogoUpload={uploadCompanyLogo}
              uploadedCompanyLogo={uploadedCompanyLogo}
              uploadingCompanyLogo={uploadingCompanyLogo}
              uploadCompanyLogoError={uploadCompanyLogoError}
              onRemoveCompanyLogo={removeCompanyLogo}
              companyMembers={companyMembers}
              onAddMembersToCompany={onAddMembersToCompany}
              onAddGroupToCompany={onAddGroupToCompany}
              addMembersInProgress={addMembersInProgress}
              addMembersError={addMembersError}
              createGroupInProgress={createGroupInProgress}
              createGroupError={createGroupError}
              onUpdateGroup={onUpdateGroup}
              updateGroupInProgress={updateGroupInProgress}
              updateGroupError={updateGroupError}
              deleteMemberInProgress={deleteMemberInProgress}
              deleteMemberError={deleteMemberError}
              onRemoveMember={onRemoveMember}
              onRemoveGroup={onRemoveGroup}
              deleteGroupInProgress={deleteGroupInProgress}
              deleteGroupError={deleteGroupError}
              disabled={!completed}
              onUpdateMemberPermission={onUpdateMemberPermission}
              updatingMemberPermissionEmail={updatingMemberPermissionEmail}
              updateMemberPermissionError={updateMemberPermissionError}
              transferCompanyOwnerInProgress={transferCompanyOwnerInProgress}
              transferCompanyOwnerError={transferCompanyOwnerError}
              onTransferCompanyOwner={onTransferCompanyOwner}
              queryMembersInProgress={queryMembersInProgress}
              queryMembersError={queryMembersError}
              companyId={companyId as string}
              resetCompanyMemberSliceError={resetCompanyMemberSliceError}
              resetTransferError={resetTransferError}
            />
          );
        })}
      </FormWizard>
      <div className={css.buttons}>
        <Button
          variant="secondary"
          onClick={goBack}
          className={classNames(css.goBack, {
            [css.hidden]: selectedTab === COMPANY_INFORMATION_TAB,
          })}>
          <FormattedMessage id="EditCompanyWizard.goBack" />
        </Button>
        <Button
          inProgress={inProgress}
          ready={submitSuccess}
          disabled={inProgress}
          onClick={onSubmitOutsideForm}
          type="button">
          {selectedTab === COMPANY_INFORMATION_TAB ? (
            <FormattedMessage id="EditCompanyWizard.nextStep" />
          ) : (
            <FormattedMessage id="EditCompanyWizard.save" />
          )}
        </Button>
      </div>
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </>
  );
};

export default EditCompanyWizard;
