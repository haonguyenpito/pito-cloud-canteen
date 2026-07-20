import { useEffect, useMemo, useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import isEmpty from 'lodash/isEmpty';
import { useRouter } from 'next/router';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import FieldSelect from '@components/FormFields/FieldSelect/FieldSelect';
import IconLock from '@components/Icons/IconLock/IconLock';
import IconSpinner from '@components/Icons/IconSpinner/IconSpinner';
import IconUnlock from '@components/Icons/IconUnlock/IconUnlock';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import AlertModal from '@components/Modal/AlertModal';
import type { TColumn, TRowData } from '@components/Table/Table';
import { TableForm } from '@components/Table/Table';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import {
  companyMemberActions,
  companyMemberThunks,
} from '@redux/slices/companyMember.slice';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import { EMemberAccountStatus } from '@src/utils/enums';
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

const isMemberDisabled = (member: TObject) =>
  member?.attributes?.profile?.metadata?.isDisabled === true;

enum EBulkAction {
  lock = 'lock',
  unlock = 'unlock',
}

const STATUS_FILTER_OPTIONS = [
  {
    key: EMemberAccountStatus.all,
    labelId: 'ManageCompanyParticipants.filter.all',
  },
  {
    key: EMemberAccountStatus.active,
    labelId: 'ManageCompanyParticipants.status.active',
  },
  {
    key: EMemberAccountStatus.disabled,
    labelId: 'ManageCompanyParticipants.status.disabled',
  },
  {
    key: EMemberAccountStatus.noAccount,
    labelId: 'ManageCompanyParticipants.status.noAccount',
  },
];

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

const PAGE_SIZE = 10;

const ManageCompanyParticipantsPage = () => {
  const intl = useIntl();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { companyId, page = 1 } = router.query;
  const [memberToToggle, setMemberToToggle] = useState<TObject | null>(null);
  const [statusFilter, setStatusFilter] = useState<EMemberAccountStatus>(
    EMemberAccountStatus.all,
  );
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<EBulkAction | null>(null);
  const [lastBulkAction, setLastBulkAction] = useState<EBulkAction>(
    EBulkAction.lock,
  );
  const [tableResetKey, setTableResetKey] = useState<number>(0);

  const {
    companyMembers = [],
    queryMembersInProgress,
    queryMembersError,
    togglingDisabledMemberId,
    toggleMemberDisabledError,
    toggleMembersDisabledInProgress,
    toggleMembersDisabledError,
    toggleMembersDisabledFailedEmails,
  } = useAppSelector((state) => state.companyMember, shallowEqual);

  useEffect(() => {
    if (companyId) {
      dispatch(
        companyMemberThunks.queryCompanyMembers({
          companyId: companyId as string,
          status: statusFilter,
        }),
      );
    }
  }, [companyId, dispatch, statusFilter]);

  // Only rows backed by a real account can be locked; the rest are invites.
  const selectedLockableMembers = useMemo(
    () =>
      companyMembers
        .filter(
          (member: TObject) =>
            hasAccount(member) && selectedEmails.includes(member.email),
        )
        .map((member: TObject) => ({
          userId: member.id as string,
          email: member.email as string,
          isDisabled: isMemberDisabled(member),
        })),
    [companyMembers, selectedEmails],
  );

  const selectedToLock = selectedLockableMembers.filter((m) => !m.isDisabled);
  const selectedToUnlock = selectedLockableMembers.filter((m) => m.isDisabled);
  const isBulkUnlock = bulkAction === EBulkAction.unlock;
  const bulkMembers = isBulkUnlock ? selectedToUnlock : selectedToLock;

  const isTogglingSelectedMember =
    !!memberToToggle && togglingDisabledMemberId === memberToToggle.id;

  const handleCloseModal = () => {
    if (isTogglingSelectedMember) return;
    setMemberToToggle(null);
  };

  const handleConfirmToggle = async () => {
    if (!memberToToggle) return;

    const response = (await dispatch(
      companyMemberThunks.adminToggleMemberDisabled({
        companyId: companyId as string,
        userId: memberToToggle.id,
        isDisabled: !isMemberDisabled(memberToToggle),
        status: statusFilter,
      }),
    )) as TObject;

    if (!response?.error) {
      setMemberToToggle(null);
    }
  };

  const openBulkConfirm = (action: EBulkAction) => {
    setBulkAction(action);
    setLastBulkAction(action);
  };

  const handleConfirmBulk = async () => {
    if (!bulkAction) return;

    const response = (await dispatch(
      companyMemberThunks.adminToggleMembersDisabled({
        companyId: companyId as string,
        members: bulkMembers.map(({ userId, email }) => ({
          userId,
          email,
        })),
        isDisabled: bulkAction === EBulkAction.lock,
        status: statusFilter,
      }),
    )) as TObject;

    if (!response?.error) {
      setBulkAction(null);
      setSelectedEmails([]);
      setTableResetKey((k) => k + 1);
    }
  };

  const getExposeValues = ({ values }: TObject) => {
    // Wait for FormSpy to render first, otherwise React warns about a state
    // update during render.
    setTimeout(() => {
      setSelectedEmails(values?.rowCheckbox || []);
    }, 0);
  };

  const tableData: TRowData[] = useMemo(
    () =>
      companyMembers.map((member: TObject) => {
        const flexAccount = hasAccount(member);
        const userId = member?.id;
        const { firstName, lastName, displayName } =
          member?.attributes?.profile || {};

        return {
          key: member?.email,
          data: {
            member,
            intl,
            email: member?.email,
            permission: member?.permission,
            hasFlexAccount: flexAccount,
            isDisabled: isMemberDisabled(member),
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

  const isSelectedMemberDisabled = isMemberDisabled(memberToToggle || {});

  const currentPage = Number(page) || 1;
  const pagedTableData = useMemo(
    () =>
      tableData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [tableData, currentPage],
  );

  const pagination = {
    page: currentPage,
    perPage: PAGE_SIZE,
    totalPages: Math.ceil(tableData.length / PAGE_SIZE),
    totalItems: tableData.length,
  };

  const handleStatusFilterChange = (value: EMemberAccountStatus) => {
    // Drop the selection: keeping it would let a bulk lock hit rows the admin
    // can no longer see, and the refetch replaces the rows anyway.
    setStatusFilter(value);
    setSelectedEmails([]);
    setTableResetKey((k) => k + 1);
    router.push({
      pathname: router.pathname,
      query: { ...router.query, page: 1 },
    });
  };

  return (
    <div className={css.root}>
      <div className={css.top}>
        <h1 className={css.title}>
          {intl.formatMessage({ id: 'ManageCompanyParticipants.title' })}
        </h1>
      </div>

      <div className={css.toolbar}>
        <div className={css.filterGroup}>
          {/* FieldSelect is a react-final-form Field, so it needs a Form around
              it even though this filter never submits — the value is applied
              through onChange. */}
          <FinalForm
            onSubmit={() => {}}
            initialValues={{ status: EMemberAccountStatus.all }}
            render={() => (
              <FieldSelect
                id="statusFilter"
                name="status"
                label={intl.formatMessage({
                  id: 'ManageCompanyParticipants.filter.label',
                })}
                className={css.filterField}
                onChange={handleStatusFilterChange}>
                {STATUS_FILTER_OPTIONS.map(({ key, labelId }) => (
                  <option key={key} value={key}>
                    {intl.formatMessage({ id: labelId })}
                  </option>
                ))}
              </FieldSelect>
            )}
          />
          <span className={css.resultCount}>
            {intl.formatMessage(
              { id: 'ManageCompanyParticipants.filter.count' },
              { count: companyMembers.length },
            )}
          </span>
        </div>

        {/* Both stay visible: a mixed selection can have people to lock and
            people to unlock, and each count says how many it would touch. */}
        <div className={css.bulkActions}>
          <Button
            variant="secondary"
            className={css.bulkButton}
            disabled={
              isEmpty(selectedToUnlock) || toggleMembersDisabledInProgress
            }
            inProgress={
              toggleMembersDisabledInProgress &&
              bulkAction === EBulkAction.unlock
            }
            onClick={() => openBulkConfirm(EBulkAction.unlock)}>
            {intl.formatMessage(
              { id: 'ManageCompanyParticipants.bulkUnlock' },
              { count: selectedToUnlock.length },
            )}
          </Button>

          <Button
            variant="secondary"
            className={css.bulkButton}
            disabled={
              isEmpty(selectedToLock) || toggleMembersDisabledInProgress
            }
            inProgress={
              toggleMembersDisabledInProgress && bulkAction === EBulkAction.lock
            }
            onClick={() => openBulkConfirm(EBulkAction.lock)}>
            {intl.formatMessage(
              { id: 'ManageCompanyParticipants.bulkLock' },
              { count: selectedToLock.length },
            )}
          </Button>
        </div>
      </div>

      {queryMembersInProgress ? (
        <LoadingContainer />
      ) : (
        <TableForm
          key={tableResetKey}
          columns={TABLE_COLUMN}
          data={pagedTableData}
          hasCheckbox
          exposeValues={getExposeValues}
          pagination={pagination}
          pageSearchParams={router.query}
          paginationPath={router.pathname.replace(
            '[companyId]',
            companyId as string,
          )}
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

      <AlertModal
        isOpen={!!bulkAction}
        handleClose={() => setBulkAction(null)}
        onCancel={() => setBulkAction(null)}
        onConfirm={handleConfirmBulk}
        confirmInProgress={toggleMembersDisabledInProgress}
        confirmDisabled={toggleMembersDisabledInProgress}
        cancelDisabled={toggleMembersDisabledInProgress}
        title={intl.formatMessage({
          id: isBulkUnlock
            ? 'ManageCompanyParticipants.bulkUnlockConfirmTitle'
            : 'ManageCompanyParticipants.bulkLockConfirmTitle',
        })}
        confirmLabel={intl.formatMessage({
          id: isBulkUnlock
            ? 'ManageCompanyParticipants.enableAccount'
            : 'ManageCompanyParticipants.disableAccount',
        })}
        cancelLabel={intl.formatMessage({
          id: 'ManageCompanyParticipants.cancel',
        })}>
        <div className={css.confirmContent}>
          {intl.formatMessage(
            {
              id: isBulkUnlock
                ? 'ManageCompanyParticipants.bulkUnlockConfirmContent'
                : 'ManageCompanyParticipants.bulkLockConfirmContent',
            },
            { count: <b>{bulkMembers.length}</b> },
          )}
          {toggleMembersDisabledError && (
            <ErrorMessage message={toggleMembersDisabledError.message} />
          )}
        </div>
      </AlertModal>

      {!isEmpty(toggleMembersDisabledFailedEmails) && (
        <AlertModal
          isOpen
          handleClose={() =>
            dispatch(companyMemberActions.clearToggleMembersDisabledResult())
          }
          title={intl.formatMessage({
            id:
              lastBulkAction === EBulkAction.unlock
                ? 'ManageCompanyParticipants.bulkUnlockPartialTitle'
                : 'ManageCompanyParticipants.bulkLockPartialTitle',
          })}>
          <div className={css.confirmContent}>
            {intl.formatMessage(
              {
                id:
                  lastBulkAction === EBulkAction.unlock
                    ? 'ManageCompanyParticipants.bulkUnlockPartialContent'
                    : 'ManageCompanyParticipants.bulkLockPartialContent',
              },
              { emails: toggleMembersDisabledFailedEmails.join(', ') },
            )}
          </div>
        </AlertModal>
      )}
    </div>
  );
};

export default ManageCompanyParticipantsPage;
