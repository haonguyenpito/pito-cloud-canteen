/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-shadow */
import type { ChangeEvent, ReactNode } from 'react';
import React, { useMemo, useState } from 'react';
import type { IntlShape } from 'react-intl';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';

import type { TAdminTransferCompanyOwnerParams } from '@apis/companyApi';
import { InlineTextButton } from '@components/Button/Button';
import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import IconDelete from '@components/Icons/IconDelete/IconDelete';
import IconSpinner from '@components/Icons/IconSpinner/IconSpinner';
import AlertModal from '@components/Modal/AlertModal';
import Pagination from '@components/Pagination/Pagination';
import type { TColumn } from '@components/Table/Table';
import Table from '@components/Table/Table';
import {
  getAllergyLabels,
  getNutritionLabels,
} from '@helpers/specialDemandHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import AdminEditSpecialDemandModal from '@pages/admin/company/components/AdminEditSpecialDemandModal/AdminEditSpecialDemandModal';
import { companyMemberThunks } from '@redux/slices/companyMember.slice';
import { UserInviteStatus } from '@src/types/UserPermission';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import { ECompanyPermission } from '@src/utils/enums';
import {
  isBookerInOrderProgress,
  isNewOwnerAlreadyACompanyUser,
} from '@src/utils/errors';
import type { TCompanyGroup, TCompanyMemberWithDetails } from '@utils/types';

import css from './ManageCompanyMembersTable.module.scss';

type ManageCompaniesMemberTableEntity = {
  permission: string;
  name: string;
  email: string;
  groupName: string;
};

type TManageCompanyMembersTable = {
  className?: string;
  companyMembers: TCompanyMemberWithDetails[];
  companyGroups: TCompanyGroup[];
  onRemoveMember: (email: string) => void;
  deleteMemberInProgress?: boolean;
  deleteMemberError?: any;
  hideRemoveConfirmModal?: boolean;
  onUpdateMemberPermission?: (params: {
    memberEmail: string;
    permission: string;
  }) => void;
  updatingMemberPermissionEmail?: string | null;
  updateMemberPermissionError?: any;
  onTransferCompanyOwner?: (params: TAdminTransferCompanyOwnerParams) => void;
  transferCompanyOwnerInProgress?: boolean;
  transferCompanyOwnerError?: any;
  queryMembersInProgress?: boolean;
  queryMembersError?: any;
  companyId?: string;
  hiddenColumnNames?: string[];
  canRemoveOwner?: boolean;
  resetCompanyMemberSliceError?: () => void;
  resetTransferError?: () => void;
};

const TABLE_COLUMN: TColumn[] &
  Partial<{
    render: (
      data: ManageCompaniesMemberTableEntity,
      isChecked: boolean,
    ) => ReactNode;
  }> = [
  {
    key: 'name',
    label: 'Tên',
    render: (data) => {
      const { name } = data;
      if (!name) return <span className={css.boldText}>Chưa xác nhận</span>;

      return <span className={css.boldText}>{name}</span>;
    },
  },
  {
    key: 'email',
    label: 'Email',
    render: ({ email }) => {
      return <span>{email}</span>;
    },
  },
  {
    key: 'role',
    label: 'Vai trò',
    render: ({
      inviteStatus,
      permission,
      handleToUpdateMemberPermission,
      intl,
      updatingPermission,
    }) => {
      if (updatingPermission) {
        return <IconSpinner className={css.iconSpinner} />;
      }

      if (!handleToUpdateMemberPermission) {
        return (
          <span>
            {intl.formatMessage({
              id: `UserPermission.${
                permission in Object.values(ECompanyPermission)
                  ? permission
                  : ECompanyPermission.participant
              }`,
            })}
          </span>
        );
      }

      const permissionList =
        inviteStatus === UserInviteStatus.ACCEPTED
          ? Object.keys(ECompanyPermission)
          : Object.keys(ECompanyPermission).filter(
              (key) =>
                ECompanyPermission[key as keyof typeof ECompanyPermission] !==
                ECompanyPermission.owner,
            );

      const selectedPermission = Object.values(ECompanyPermission).includes(
        permission,
      )
        ? permission
        : ECompanyPermission.participant;

      return (
        <select
          onChange={handleToUpdateMemberPermission}
          value={selectedPermission}
          className={css.fieldSelect}>
          {permissionList.map((key) => (
            <option
              key={ECompanyPermission[key as keyof typeof ECompanyPermission]}
              value={
                ECompanyPermission[key as keyof typeof ECompanyPermission]
              }>
              {intl.formatMessage({
                id: `UserPermission.${
                  ECompanyPermission[key as keyof typeof ECompanyPermission]
                }`,
              })}
            </option>
          ))}
        </select>
      );
    },
  },
  {
    key: 'groupName',
    label: 'Nhóm',
    render: ({ groups = [] }) => {
      const groupNames = groups.reduce((prev: string, cur: TCompanyGroup) => {
        if (!prev) {
          return cur.name;
        }

        return `${prev}, ${cur.name}`;
      }, '');

      return <span>{groupNames}</span>;
    },
  },
  {
    key: 'allergy',
    label: 'Dị ứng',
    render: ({ allergies = [] }: any) => {
      const labels = getAllergyLabels(allergies);

      return <span>{labels.length > 0 ? labels.join(', ') : '-'}</span>;
    },
  },
  {
    key: 'nutritions',
    label: 'Chế độ dịnh dưỡng',
    render: ({ nutritions = [], nutritionOptions = [] }: any) => {
      const labels = getNutritionLabels(nutritions, nutritionOptions);

      return <span>{labels.length > 0 ? labels.join(', ') : '-'}</span>;
    },
  },
  {
    key: 'action',
    label: '',
    render: ({
      handleToRemoveMember,
      handleToEditSpecialDemand,
      permission,
      canRemoveOwner,
    }) => {
      const isOwner =
        !canRemoveOwner && permission === ECompanyPermission.owner;

      return (
        <div
          className={classNames(css.actionButtons, { [css.hidden]: isOwner })}>
          {handleToEditSpecialDemand && (
            <InlineTextButton type="button" onClick={handleToEditSpecialDemand}>
              Sửa
            </InlineTextButton>
          )}
          <InlineTextButton type="button" onClick={handleToRemoveMember}>
            <IconDelete />
          </InlineTextButton>
        </div>
      );
    },
  },
];

const parseEntitiesToTableData = ({
  intl,
  companyGroups,
  companyMembers = [],
  openRemoveModal,
  onUpdateMemberPermission,
  updatingMemberPermissionEmail,
  openTransferOwnerModal,
  openUpgradeToOwnerModal,
  canRemoveOwner,
  nutritionOptions,
  openSpecialDemandModal,
}: {
  intl: IntlShape;
  companyGroups: TCompanyGroup[];
  openRemoveModal: (member: TCompanyMemberWithDetails) => void;
  onUpdateMemberPermission?: (params: {
    memberEmail: string;
    permission: string;
  }) => void;
  companyMembers: TCompanyMemberWithDetails[];
  updatingMemberPermissionEmail?: string | null;
  openTransferOwnerModal: (
    member: TCompanyMemberWithDetails,
    permission: ECompanyPermission,
  ) => void;
  openUpgradeToOwnerModal: (member: TCompanyMemberWithDetails) => void;
  canRemoveOwner?: boolean;
  nutritionOptions: { key: string; label: string }[];
  openSpecialDemandModal?: (member: TCompanyMemberWithDetails) => void;
}) => {
  return companyMembers.map((companyMember) => {
    const groups = companyGroups.filter((group: TCompanyGroup) =>
      (companyMember.groups || []).includes(group.id),
    );
    const hasAttributes = companyMember?.attributes;

    const handleToRemove = () => {
      openRemoveModal(companyMember);
    };

    const handleToUpdateMemberPermission = (
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const { value } = e.target;

      if (
        companyMember.permission !== ECompanyPermission.owner &&
        value === ECompanyPermission.owner
      ) {
        return openUpgradeToOwnerModal(companyMember);
      }

      if (companyMember.permission === ECompanyPermission.owner) {
        return openTransferOwnerModal(
          companyMember,
          value as ECompanyPermission,
        );
      }

      if (!onUpdateMemberPermission) return;

      return onUpdateMemberPermission({
        memberEmail: companyMember.email,
        permission: value,
      });
    };
    if (!hasAttributes) {
      return {
        key: companyMember.email,
        data: {
          permission: companyMember.permission,
          email: companyMember.email,
          groups,
          handleToRemoveMember: handleToRemove,
          ...(typeof onUpdateMemberPermission !== 'undefined'
            ? { handleToUpdateMemberPermission }
            : {}),
          intl,
          updatingPermission:
            updatingMemberPermissionEmail === companyMember.email,
        },
      };
    }

    return {
      key: companyMember.email,
      data: {
        inviteStatus: companyMember.inviteStatus,
        canRemoveOwner,
        permission: companyMember.permission,
        name: buildFullName(
          companyMember?.attributes?.profile?.firstName,
          companyMember?.attributes?.profile?.lastName,
          {
            compareToGetLongerWith:
              companyMember?.attributes?.profile?.displayName,
          },
        ),
        email: companyMember.attributes.email,
        groups,
        allergies:
          companyMember?.attributes?.profile?.publicData?.allergies || [],
        nutritions:
          companyMember?.attributes?.profile?.publicData?.nutritions || [],
        nutritionOptions,
        ...(openSpecialDemandModal
          ? {
              handleToEditSpecialDemand: () =>
                openSpecialDemandModal(companyMember),
            }
          : {}),
        handleToRemoveMember: handleToRemove,
        ...(typeof onUpdateMemberPermission !== 'undefined'
          ? { handleToUpdateMemberPermission }
          : {}),
        intl,
        updatingPermission:
          updatingMemberPermissionEmail === companyMember.email,
      },
    };
  });
};

const sliceMembers = (
  members: TCompanyMemberWithDetails[],
  page: any,
  perPage: number,
) => {
  const pageAsNum = Number(page);

  return [...members].slice((pageAsNum - 1) * perPage, pageAsNum * perPage);
};

const MEMBER_PAGE_SIZE = 10;

const ManageCompanyMembersTable: React.FC<TManageCompanyMembersTable> = (
  props,
) => {
  const {
    companyMembers,
    companyGroups,
    onRemoveMember,
    deleteMemberInProgress,
    hideRemoveConfirmModal,
    onUpdateMemberPermission,
    updatingMemberPermissionEmail,
    onTransferCompanyOwner,
    transferCompanyOwnerInProgress,
    queryMembersInProgress,
    companyId,
    hiddenColumnNames = [],
    canRemoveOwner,
    updateMemberPermissionError,
    deleteMemberError,
    resetCompanyMemberSliceError,
    transferCompanyOwnerError,
    resetTransferError,
  } = props;

  const intl = useIntl();
  const [memberToRemove, setMemberToRemove] =
    useState<TCompanyMemberWithDetails | null>(null);

  const [memberToTransferOwner, setMemberToTransferOwner] =
    useState<TCompanyMemberWithDetails | null>(null);

  const [memberToUpgradeToOwner, setMemberToUpgradeToOwner] =
    useState<TCompanyMemberWithDetails | null>(null);

  const [newOwnerEmail, setNewOwnerEmail] = useState<string | null>(null);

  const [permissionForOldOwner, setPermissionForOldOwner] =
    useState<ECompanyPermission | null>(null);

  const [page, setPage] = useState<number>(1);

  const [memberToEditSpecialDemand, setMemberToEditSpecialDemand] =
    useState<TCompanyMemberWithDetails | null>(null);

  const nutritionOptions = useAppSelector(
    (state) => state.SystemAttributes.nutritions,
    shallowEqual,
  );
  const updatingSpecialDemandUserId = useAppSelector(
    (state) => state.companyMember.updatingSpecialDemandUserId,
  );
  const updateSpecialDemandError = useAppSelector(
    (state) => state.companyMember.updateSpecialDemandError,
  );
  const dispatch = useAppDispatch();

  const onChangeNewOwner = (e: ChangeEvent<HTMLSelectElement>) => {
    setNewOwnerEmail(e.target.value);
  };

  const openRemoveModal = (member: TCompanyMemberWithDetails) => {
    if (!hideRemoveConfirmModal) {
      setMemberToRemove(member);
    } else {
      onRemoveMember(member.email);
    }
  };

  const openTransferOwnerModal = (
    member: TCompanyMemberWithDetails,
    permission: ECompanyPermission,
  ) => {
    setMemberToTransferOwner(member);
    setPermissionForOldOwner(permission);
  };

  const openUpgradeToOwnerModal = (member: TCompanyMemberWithDetails) => {
    setMemberToUpgradeToOwner(member);
  };

  const closeTransferOwnerModal = () => {
    if (resetTransferError) resetTransferError();
    setMemberToTransferOwner(null);
    setPermissionForOldOwner(null);
  };

  const closeUpgradeOwnerModal = () => {
    if (resetTransferError) resetTransferError();
    setMemberToUpgradeToOwner(null);
  };

  const transferCompanyOwner = () => {
    if (
      newOwnerEmail &&
      memberToTransferOwner &&
      permissionForOldOwner &&
      onTransferCompanyOwner
    ) {
      return onTransferCompanyOwner({
        companyId: memberToTransferOwner.id,
        newOwnerEmail,
        permissionForOldOwner,
      });
    }
  };

  const upgradeCompanyOwner = () => {
    if (memberToUpgradeToOwner && onTransferCompanyOwner && companyId) {
      return onTransferCompanyOwner({
        companyId,
        newOwnerEmail: memberToUpgradeToOwner.email,
      });
    }
  };

  const openSpecialDemandModal = (member: TCompanyMemberWithDetails) => {
    setMemberToEditSpecialDemand(member);
  };

  const handleSubmitSpecialDemand = async (values: {
    allergies: string[];
    nutritions: string[];
  }) => {
    if (!memberToEditSpecialDemand?.id?.uuid || !companyId) return;

    const { meta } = await dispatch(
      companyMemberThunks.adminUpdateMemberSpecialDemand({
        companyId,
        userId: memberToEditSpecialDemand.id.uuid,
        allergies: values.allergies || [],
        nutritions: values.nutritions || [],
      }),
    );

    if (meta.requestStatus === 'fulfilled') {
      setMemberToEditSpecialDemand(null);
    }
  };

  const handleCloseModal = () => {
    if (resetCompanyMemberSliceError) resetCompanyMemberSliceError();
    setMemberToRemove(null);
  };

  const handleRemoveMember = async () => {
    const email = memberToRemove?.email || memberToRemove?.attributes?.email;
    if (email) {
      const { error } = (await onRemoveMember(email)) as any;
      if (!error) handleCloseModal();
    }
  };

  const tableColumn = TABLE_COLUMN.filter(
    (col) => !hiddenColumnNames?.includes(col.key),
  );
  // Screens that hide the special-demand columns must not offer editing them.
  const canEditSpecialDemand = !hiddenColumnNames?.includes('allergy');

  const members = useMemo(
    () => sliceMembers(companyMembers, page, MEMBER_PAGE_SIZE),
    [companyMembers, page],
  );

  const tableData = parseEntitiesToTableData({
    intl,
    companyGroups,
    openRemoveModal,
    onUpdateMemberPermission,
    companyMembers: members,
    updatingMemberPermissionEmail,
    openTransferOwnerModal,
    canRemoveOwner,
    openUpgradeToOwnerModal,
    nutritionOptions,
    openSpecialDemandModal: canEditSpecialDemand
      ? openSpecialDemandModal
      : undefined,
  });

  const pagination = useMemo(
    () => ({
      page: Number(page),
      perPage: MEMBER_PAGE_SIZE,
      totalPages: Math.ceil(companyMembers.length / MEMBER_PAGE_SIZE),
      totalItems: companyMembers.length,
    }),
    [page, companyMembers.length],
  );

  const onPageChange = (page: number) => {
    setPage(page);
  };

  const transferErrorMessage =
    !transferCompanyOwnerError ? null : isNewOwnerAlreadyACompanyUser(
        transferCompanyOwnerError,
      ) ? (
      <ErrorMessage
        message={intl.formatMessage({
          id: 'ManageCompanyMembersTable.newOwnerAlreadyCompanyUser',
        })}
      />
    ) : isBookerInOrderProgress(transferCompanyOwnerError) ? (
      <ErrorMessage
        message={intl.formatMessage({
          id: 'ManageCompanyMembersTable.newOwnerIsBookerInOrderProgress',
        })}
      />
    ) : (
      <ErrorMessage
        message={intl.formatMessage({
          id: 'ManageCompanyMembersTable.updateMemberPermissionError',
        })}
      />
    );

  return (
    <div className={css.root}>
      <Table
        columns={tableColumn}
        data={tableData}
        tableBodyCellClassName={css.tableBodyCell}
        isLoading={queryMembersInProgress}
      />
      <Pagination
        total={pagination.totalItems}
        pageSize={pagination.perPage}
        current={pagination.page}
        onChange={onPageChange}
      />
      {updateMemberPermissionError &&
        (isBookerInOrderProgress(updateMemberPermissionError) ? (
          <ErrorMessage
            message={intl.formatMessage({
              id: 'ManageCompanyMembersTable.bookerIsBookerInOrderProgress',
            })}
          />
        ) : (
          <ErrorMessage
            message={intl.formatMessage({
              id: 'ManageCompanyMembersTable.updateMemberPermissionError',
            })}
          />
        ))}

      <AlertModal
        isOpen={!!memberToRemove}
        handleClose={handleCloseModal}
        confirmDisabled={deleteMemberInProgress}
        cancelDisabled={deleteMemberInProgress}
        onCancel={handleCloseModal}
        onConfirm={handleRemoveMember}
        confirmInProgress={deleteMemberInProgress}
        confirmLabel={intl.formatMessage({
          id: 'ManageCompanyMembersTable.memberRemoveConfirm',
        })}
        cancelLabel={intl.formatMessage({
          id: 'ManageCompanyMembersTable.memberRemoveCancel',
        })}
        title={intl.formatMessage({
          id: 'ManageCompanyMembersTable.memberRemoveTitle',
        })}>
        <div className={css.removeContent}>
          {intl.formatMessage(
            {
              id: 'ManageCompanyMembersTable.memberRemoveContent',
            },
            {
              email: (
                <span className={css.boldText}>
                  {memberToRemove?.email || memberToRemove?.attributes?.email}
                </span>
              ),
            },
          )}
          {deleteMemberError && (
            <ErrorMessage
              message={intl.formatMessage({
                id: 'ManageCompanyMembersTable.deleteMemberError',
              })}
            />
          )}
        </div>
      </AlertModal>
      <AlertModal
        onConfirm={transferCompanyOwner}
        confirmInProgress={transferCompanyOwnerInProgress}
        cancelDisabled={transferCompanyOwnerInProgress}
        onCancel={closeTransferOwnerModal}
        isOpen={!!memberToTransferOwner && !!permissionForOldOwner}
        title={intl.formatMessage({
          id: 'ManageCompanyMembersTable.updateOwnerTitle',
        })}
        handleClose={closeTransferOwnerModal}
        cancelLabel={intl.formatMessage({
          id: 'ManageCompanyMembersTable.memberRemoveCancel',
        })}
        confirmLabel={intl.formatMessage({
          id: 'ManageCompanyMembersTable.tranferOwner',
        })}>
        <p className={css.removeContent}>
          {intl.formatMessage(
            {
              id: 'ManageCompanyMembersTable.updateOwnerContent',
            },
            {
              email: (
                <span className={css.boldText}>
                  {memberToTransferOwner?.email}
                </span>
              ),
            },
          )}
        </p>
        <select
          defaultValue=""
          onChange={onChangeNewOwner}
          className={css.fieldSelectMember}>
          <option disabled value="">
            <option>Chọn thành viên thay thế</option>
          </option>
          {companyMembers
            .filter(
              (member) =>
                member.permission !== ECompanyPermission.owner && member.id,
            )
            .map((member) => {
              const {
                lastName = '',
                firstName = '',
                displayName,
              } = member.attributes.profile;
              const fullName =
                lastName && firstName
                  ? buildFullName(firstName, lastName, {
                      compareToGetLongerWith: displayName,
                    })
                  : member.email;

              return (
                <option key={member.email} value={member.email}>
                  {fullName}
                </option>
              );
            })}
        </select>
        {transferErrorMessage}
      </AlertModal>
      <AlertModal
        onConfirm={upgradeCompanyOwner}
        confirmInProgress={transferCompanyOwnerInProgress}
        cancelDisabled={transferCompanyOwnerInProgress}
        onCancel={closeUpgradeOwnerModal}
        isOpen={!!memberToUpgradeToOwner}
        title={intl.formatMessage({
          id: 'ManageCompanyMembersTable.upgradeToOwnerTitle',
        })}
        handleClose={closeUpgradeOwnerModal}
        cancelLabel={intl.formatMessage({
          id: 'ManageCompanyMembersTable.memberRemoveCancel',
        })}
        confirmLabel={intl.formatMessage({
          id: 'ManageCompanyMembersTable.tranferOwner',
        })}>
        <div className={css.removeContent}>
          {intl.formatMessage(
            {
              id: 'ManageCompanyMembersTable.upgradeToOwnerContent',
            },
            {
              email: (
                <span className={css.boldText}>
                  {memberToUpgradeToOwner?.email}
                </span>
              ),
            },
          )}
          {transferErrorMessage}
        </div>
      </AlertModal>
      <AdminEditSpecialDemandModal
        member={memberToEditSpecialDemand}
        isOpen={!!memberToEditSpecialDemand}
        onClose={() => setMemberToEditSpecialDemand(null)}
        onSubmit={handleSubmitSpecialDemand}
        inProgress={
          !!memberToEditSpecialDemand?.id?.uuid &&
          updatingSpecialDemandUserId === memberToEditSpecialDemand.id.uuid
        }
        errorMessage={
          updateSpecialDemandError
            ? 'Cập nhật dị ứng & chế độ dinh dưỡng thất bại. Vui lòng thử lại.'
            : null
        }
      />
    </div>
  );
};

export default ManageCompanyMembersTable;
