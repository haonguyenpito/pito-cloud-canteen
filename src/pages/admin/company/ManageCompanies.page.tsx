import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';

import Badge, { EBadgeType } from '@components/Badge/Badge';
/* eslint-disable react-hooks/exhaustive-deps */
import Button from '@components/Button/Button';
import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import IconEdit from '@components/Icons/IconEdit/IconEdit';
import IconGroup from '@components/Icons/IconGroup/IconGroup';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import NamedLink from '@components/NamedLink/NamedLink';
import type { TColumn } from '@components/Table/Table';
import { TableForm } from '@components/Table/Table';
import ToggleButton from '@components/ToggleButton/ToggleButton';
import Tooltip from '@components/Tooltip/Tooltip';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { companyThunks } from '@redux/slices/company.slice';
import { adminRoutes } from '@src/paths';
import { ECompanyStates } from '@utils/enums';

import KeywordSearchForm from '../partner/components/KeywordSearchForm/KeywordSearchForm';

import type { TUpdateStatus } from './helpers';
import {
  filterCompanies,
  parseEntitiesToTableData,
  sliceCompanies,
} from './helpers';

import css from './ManageCompanies.module.scss';

const TABLE_COLUMN: TColumn[] = [
  {
    key: 'name',
    label: 'Tên công ty',
    render: ({ id, companyName, isDraft }: any) => {
      return (
        <NamedLink
          path={`${adminRoutes.ManageCompanies.path}/${id}`}
          className={css.boldTextRow}>
          {companyName}
          {isDraft && (
            <div className={css.draftBox}>
              <FormattedMessage id="ManagePartnersPage.draftState" />
            </div>
          )}
        </NamedLink>
      );
    },
  },
  {
    key: 'representatives',
    label: 'Người đại diện',
    render: ({ displayName, email, phoneNumber }: any) => {
      return (
        <div>
          <div>
            <div className={css.memberName}>{displayName}</div>
            <div className={css.memberEmail}>{email}</div>
            <div className={css.memberPhoneNumber}>{phoneNumber}</div>
          </div>
        </div>
      );
    },
  },
  {
    key: 'address',
    label: 'Địa chỉ',
    render: (data: any) => {
      return <div className={css.row}>{data.address}</div>;
    },
  },
  {
    key: 'status',
    label: 'Trạng thái',
    render: ({ userState }: any) => {
      const isActive = userState === ECompanyStates.published;
      const label = isActive ? 'Đã active' : 'Chưa active';
      const badgeType = isActive ? EBadgeType.success : EBadgeType.default;

      return (
        <Badge
          label={label}
          type={badgeType}
          labelClassName={css.badgeLabel}
          className={classNames(css.badgeContainer, {
            [css.badgeContainerActive]: isActive,
          })}
        />
      );
    },
  },
  {
    key: 'action',
    label: '',
    render: ({ updateStatus, id, userState, isDraft }: any) => {
      const onClick = (checked: boolean) => {
        const newUserState = checked
          ? ECompanyStates.published
          : ECompanyStates.unactive;

        const updateData = {
          id,
          userState: newUserState,
        };

        return updateStatus(updateData);
      };

      return (
        <div className={css.tableActions}>
          <Tooltip
            placement="top"
            tooltipContent={
              <FormattedMessage id="ManageCompanies.manageParticipantsTooltip" />
            }>
            <Link href={`/admin/company/${id}/participants`}>
              <Button variant="inline" className={css.actionButton}>
                <IconGroup className={css.icon} />
              </Button>
            </Link>
          </Tooltip>
          <Tooltip
            placement="top"
            tooltipContent={
              <FormattedMessage id="ManageCompanies.editTooltip" />
            }>
            <Link href={`/admin/company/${id}/edit`}>
              <Button
                variant="inline"
                className={classNames(css.actionButton, css.editButton)}>
                <IconEdit className={css.icon} />
              </Button>
            </Link>
          </Tooltip>
          {!isDraft && (
            <ToggleButton
              name={id}
              className={css.toggleButton}
              id={id}
              onClick={onClick}
              defaultValue={userState === ECompanyStates.published}
            />
          )}
        </div>
      );
    },
  },
];

export default function ManageCompanies() {
  const intl = useIntl();
  const router = useRouter();
  const { value: mounted, setValue: setMounted } = useBoolean(false);
  const [pageSize] = useState<number>(10);

  const { query, pathname } = router;
  const { page = 1, ...queryParams } = query;

  const title = intl.formatMessage({
    id: 'ManageCompanies.title',
  });

  const { companyRefs, queryCompaniesInProgress, queryCompaniesError } =
    useAppSelector((state) => state.company, shallowEqual);

  const { companyMembersByCompanyId } = useAppSelector(
    (state) => state.companyMember,
    shallowEqual,
  );

  const dispatch = useAppDispatch();
  const { keywords } = queryParams;
  const filteredCompanies = useMemo(
    () => filterCompanies(companyRefs, queryParams),
    [queryParams, companyRefs],
  );

  const slicesCompanies = useMemo(
    () => sliceCompanies(filteredCompanies, page, pageSize),
    [filteredCompanies, page, pageSize],
  );

  const pagination = {
    page: Number(page),
    perPage: pageSize,
    totalPages: Math.ceil(filteredCompanies.length / pageSize),
    totalItems: filteredCompanies.length,
  };

  const updateStatus = useCallback((updateData: TUpdateStatus) => {
    dispatch(companyThunks.adminUpdateCompanyState(updateData));
  }, []);

  const companiesTableData = useMemo(
    () =>
      parseEntitiesToTableData(
        slicesCompanies,
        {
          updateStatus,
        },
        companyMembersByCompanyId,
      ),
    [slicesCompanies, updateStatus, JSON.stringify(companyMembersByCompanyId)],
  );

  useEffect(() => {
    if (!!page && !mounted) {
      dispatch(
        companyThunks.adminQueryCompanies({
          page: parseInt(page as string, 10),
        }),
      );
      setMounted(true);
    }
  }, [page, mounted]);

  const onSearchKeyword = (values: any) => {
    router.push({
      pathname,
      query: {
        ...values,
        page: 1,
      },
    });
  };

  return (
    <div className={css.root}>
      <div className={css.top}>
        <h1 className={css.title}>{title}</h1>
        <Link href={`${pathname}/create`}>
          <Button className={css.addButton}>
            <FormattedMessage id="ManageCompanies.addCompany" />
          </Button>
        </Link>
      </div>
      <div className={css.filterWrapper}>
        <KeywordSearchForm
          initialValues={{ keywords: keywords as string }}
          onSubmit={onSearchKeyword}
          placeholder={intl.formatMessage({
            id: 'ManageCompanies.keywordsPlaceholder',
          })}
        />
      </div>
      {queryCompaniesInProgress ? (
        <LoadingContainer />
      ) : (
        <TableForm
          onSubmit={onSearchKeyword}
          columns={TABLE_COLUMN}
          data={companiesTableData}
          pagination={pagination}
          pageSearchParams={query}
          paginationPath="/admin/company"
          tableWrapperClassName={css.tableWrapper}
          tableClassName={css.table}
        />
      )}
      {queryCompaniesError && (
        <ErrorMessage message={queryCompaniesError.message} />
      )}
    </div>
  );
}
