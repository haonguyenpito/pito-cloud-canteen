import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { useRouter } from 'next/router';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import IconLock from '@components/Icons/IconLock/IconLock';
import IconSpinner from '@components/Icons/IconSpinner/IconSpinner';
import IconUnlock from '@components/Icons/IconUnlock/IconUnlock';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import AlertModal from '@components/Modal/AlertModal';
import type { TColumn, TRowData } from '@components/Table/Table';
import Table from '@components/Table/Table';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { companyMemberThunks } from '@redux/slices/companyMember.slice';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import type { TObject } from '@utils/types';

import css from './ManageCompanyParticipants.module.scss';

/**
 * A member row is `{ ...sharetribeUser, ...company.metadata.members[email] }`,
 * so `id` is the plain user id string from the members map (it overwrites the
 * user's uuid object) and `attributes` only exists for people who actually
 * signed up. Invited-but-never-registered members have neither — there is no
 * account to lock. Same detection the existing members table uses.
 */
const hasAccount = (member: TObject) => !!member?.attributes && !!member?.id;

const TABLE_COLUMN: TColumn[] = [
  {
    key: 'name',
    label: 'Tên người dùng',
    render: ({ displayName, email }: any) => (
      <div>
        <div className={css.boldTextRow}>{displayName}</div>
        <div className={css.subTextRow}>{email}</div>
      </div>
    ),
  },
  {
    key: 'permission',
    label: 'Vai trò',
    render: ({ permission }: any) => <div>{permission}</div>,
  },
  {
    key: 'status',
    label: 'Trạng thái',
    render: ({ hasFlexAccount, isDisabled, intl }: any) => {
      if (!hasFlexAccount) {
        return (
          <Badge
            label={intl.formatMessage({
              id: 'ManageCompanyParticipants.status.noAccount',
            })}
            type={EBadgeType.default}
          />
        );
      }

      return isDisabled ? (
        <Badge
          label={intl.formatMessage({
            id: 'ManageCompanyParticipants.status.disabled',
          })}
          type={EBadgeType.warning}
        />
      ) : (
        <Badge
          label={intl.formatMessage({
            id: 'ManageCompanyParticipants.status.active',
          })}
          type={EBadgeType.success}
        />
      );
    },
  },
  {
    key: 'action',
    label: '',
    render: ({
      hasFlexAccount,
      isDisabled,
      inProgress,
      openConfirmModal,
      member,
      intl,
    }: any) => {
      if (!hasFlexAccount) return null;

      if (inProgress) return <IconSpinner className={css.loadingIcon} />;

      const label = intl.formatMessage({
        id: isDisabled
          ? 'ManageCompanyParticipants.enableAccount'
          : 'ManageCompanyParticipants.disableAccount',
      });

      return (
        <Button
          variant="inline"
          title={label}
          aria-label={label}
          className={css.actionButton}
          onClick={() => openConfirmModal(member)}>
          {isDisabled ? (
            <IconUnlock className={css.icon} />
          ) : (
            <IconLock className={css.icon} />
          )}
        </Button>
      );
    },
  },
];

const ManageCompanyParticipantsPage = () => {
  const intl = useIntl();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { companyId } = router.query;
  const [memberToToggle, setMemberToToggle] = useState<TObject | null>(null);

  const {
    companyMembers = [],
    queryMembersInProgress,
    queryMembersError,
    togglingDisabledMemberId,
    toggleMemberDisabledError,
  } = useAppSelector((state) => state.companyMember, shallowEqual);

  useEffect(() => {
    if (companyId) {
      dispatch(companyMemberThunks.queryCompanyMembers(companyId as string));
    }
  }, [companyId, dispatch]);

  const isTogglingSelectedMember =
    !!memberToToggle && togglingDisabledMemberId === memberToToggle.id;

  const handleCloseModal = () => {
    if (isTogglingSelectedMember) return;
    setMemberToToggle(null);
  };

  const handleConfirmToggle = async () => {
    if (!memberToToggle) return;

    const willDisable =
      !memberToToggle.attributes?.profile?.metadata?.isDisabled;

    const response = (await dispatch(
      companyMemberThunks.adminToggleMemberDisabled({
        companyId: companyId as string,
        userId: memberToToggle.id,
        isDisabled: willDisable,
      }),
    )) as any;

    if (!response?.error) {
      setMemberToToggle(null);
    }
  };

  const tableData: TRowData[] = useMemo(
    () =>
      companyMembers.map((member: TObject) => {
        const flexAccount = hasAccount(member);
        const userId = member?.id;
        const { firstName, lastName, displayName } =
          member?.attributes?.profile || {};
        const { isDisabled = false } =
          member?.attributes?.profile?.metadata || {};

        return {
          key: member?.email || userId,
          data: {
            member,
            intl,
            email: member?.email,
            permission: member?.permission,
            hasFlexAccount: flexAccount,
            isDisabled,
            displayName:
              buildFullName(firstName, lastName, {
                compareToGetLongerWith: displayName,
              }) || 'Chưa xác nhận',
            inProgress: flexAccount && togglingDisabledMemberId === userId,
            openConfirmModal: setMemberToToggle,
          },
        };
      }),
    [companyMembers, togglingDisabledMemberId, intl],
  );

  const isSelectedMemberDisabled =
    !!memberToToggle?.attributes?.profile?.metadata?.isDisabled;

  return (
    <div className={css.root}>
      <div className={css.top}>
        <h1 className={css.title}>
          {intl.formatMessage({ id: 'ManageCompanyParticipants.title' })}
        </h1>
      </div>

      {queryMembersInProgress ? (
        <LoadingContainer />
      ) : (
        <Table
          columns={TABLE_COLUMN}
          data={tableData}
          tableWrapperClassName={css.tableWrapper}
          tableClassName={css.table}
        />
      )}

      {queryMembersError && (
        <ErrorMessage message={queryMembersError.message} />
      )}

      <AlertModal
        isOpen={!!memberToToggle}
        handleClose={handleCloseModal}
        onCancel={handleCloseModal}
        onConfirm={handleConfirmToggle}
        confirmInProgress={isTogglingSelectedMember}
        confirmDisabled={isTogglingSelectedMember}
        cancelDisabled={isTogglingSelectedMember}
        title={intl.formatMessage({
          id: isSelectedMemberDisabled
            ? 'ManageCompanyParticipants.enableConfirmTitle'
            : 'ManageCompanyParticipants.disableConfirmTitle',
        })}
        confirmLabel={intl.formatMessage({
          id: isSelectedMemberDisabled
            ? 'ManageCompanyParticipants.enableAccount'
            : 'ManageCompanyParticipants.disableAccount',
        })}
        cancelLabel={intl.formatMessage({
          id: 'ManageCompanyParticipants.cancel',
        })}>
        <div className={css.confirmContent}>
          {intl.formatMessage(
            {
              id: isSelectedMemberDisabled
                ? 'ManageCompanyParticipants.enableConfirmContent'
                : 'ManageCompanyParticipants.disableConfirmContent',
            },
            {
              email: (
                <span className={css.boldTextRow}>
                  {memberToToggle?.email || memberToToggle?.attributes?.email}
                </span>
              ),
            },
          )}
          {toggleMemberDisabledError && (
            <ErrorMessage message={toggleMemberDisabledError.message} />
          )}
        </div>
      </AlertModal>
    </div>
  );
};

export default ManageCompanyParticipantsPage;
