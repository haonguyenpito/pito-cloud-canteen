import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import { useRouter } from 'next/router';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import IconEye from '@components/Icons/IconEye/IconEye';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import type { TColumn, TRowData } from '@components/Table/Table';
import { TableForm } from '@components/Table/Table';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import type { MenuListing } from '@src/types';
import { formatTimestamp } from '@utils/dates';
import { EListingStates, EMenuMealType, EMenuType } from '@utils/enums';
import { parsePrice } from '@utils/validators';

import ApplyExtraFeeModal from './components/ApplyExtraFeeModal/ApplyExtraFeeModal';
import ImportExtraFeeModal from './components/ImportExtraFeeModal/ImportExtraFeeModal';
import MenuExtraFeePanel from './components/MenuExtraFeePanel/MenuExtraFeePanel';
import {
  buildExtraFeeRows,
  hasUnsavedExtraFeeChanges,
  toAmount,
} from './components/MenuExtraFeePanel/utils';
import { ManagePartnersMenusThunks } from './ManagePartnersMenus.slice';

const getMealTypeLabel = (mealType: string) => {
  const labels: Record<string, string> = {
    [EMenuMealType.breakfast]: 'Ăn sáng',
    [EMenuMealType.lunch]: 'Ăn trưa',
    [EMenuMealType.dinner]: 'Ăn tối',
    [EMenuMealType.snack]: 'Ăn xế',
  };

  return labels[mealType] || mealType;
};

const getMenuTypeLabel = (menuType: string) => {
  const labels: Record<string, string> = {
    [EMenuType.fixedMenu]: 'Menu cố định',
    [EMenuType.cycleMenu]: 'Menu chu kỳ',
  };

  return labels[menuType] || menuType;
};

/** Menu states in which the fee may still be edited — mirrors the API guard. */
const EDITABLE_MENU_STATES: string[] = [
  EListingStates.draft,
  EListingStates.pendingApproval,
];

const TABLE_COLUMNS: TColumn[] = [
  {
    key: 'expand',
    label: '',
    render: (data: any) => (
      <button
        type="button"
        aria-label="Xem phụ phí theo món"
        className="p-1 rounded hover:bg-gray-100 transition-colors"
        onClick={() => data?.onToggleExpand(data?.id)}>
        <IconArrow
          direction={data?.isExpanded ? 'down' : 'right'}
          className="w-4 h-4"
        />
      </button>
    ),
  },
  {
    key: 'order',
    label: 'STT',
    render: (data: any) => (
      <div className="text-gray-500 font-medium">{data?.order}</div>
    ),
  },
  {
    key: 'title',
    label: 'Tên menu',
    render: (data: any) => (
      <div className="min-w-[180px]">
        <div className="font-semibold text-gray-900 line-clamp-2 mb-1">
          {data?.title}
        </div>
        <Badge
          label={getMealTypeLabel(data?.mealType)}
          type={EBadgeType.info}
        />
      </div>
    ),
  },
  {
    key: 'restaurantName',
    label: 'Đối tác',
    render: (data: any) => (
      <div className="text-gray-700 line-clamp-2 min-w-[100px] max-w-[160px]">
        {data?.restaurantName}
      </div>
    ),
  },
  {
    key: 'menuType',
    label: 'Loại menu',
    render: (data: any) => (
      <div className="text-gray-700">{getMenuTypeLabel(data?.menuType)}</div>
    ),
  },
  {
    key: 'applyDates',
    label: 'Thời gian áp dụng',
    render: (data: any) => (
      <div className="flex items-center gap-1.5 text-gray-600 text-sm min-w-[180px]">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          {formatTimestamp(data?.startDate)} - {formatTimestamp(data?.endDate)}
        </span>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Trạng thái',
    render: (data: any) => {
      const statusConfig: Record<string, { label: string; type: EBadgeType }> =
        {
          [EListingStates.pendingApproval]: {
            label: 'Chờ duyệt',
            type: EBadgeType.warning,
          },
          [EListingStates.published]: {
            label: 'Đã duyệt',
            type: EBadgeType.success,
          },
          [EListingStates.rejected]: {
            label: 'Không duyệt',
            type: EBadgeType.danger,
          },
        };
      const config =
        statusConfig[data?.status] ||
        statusConfig[EListingStates.pendingApproval];

      return <Badge label={config.label} type={config.type} hasDotIcon />;
    },
  },
  {
    key: 'appliedExtraFee',
    label: 'Phụ phí',
    render: (data: any) =>
      data?.appliedExtraFee ? (
        <span className="text-amber-600 font-semibold text-sm whitespace-nowrap">
          +{data.appliedExtraFee}
        </span>
      ) : (
        <span className="text-gray-400 text-sm">—</span>
      ),
  },
  {
    key: 'actions',
    label: '',
    render: (data: any) => (
      <Button
        variant="secondary"
        size="small"
        className="flex items-center gap-1.5 whitespace-nowrap text-sm"
        onClick={() => data?.onViewDetail(data?.id)}>
        <IconEye className="w-4 h-4" />
        <span>Xem chi tiết</span>
      </Button>
    ),
  },
];

const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

/**
 * Dishes within one menu may now carry different fees, so show the single value
 * when they agree and a range when they do not.
 */
const buildExtraFeeLabel = (
  foodExtraFees: Record<string, number | undefined> = {},
): string => {
  const fees = Object.values(foodExtraFees).filter(
    (fee): fee is number => typeof fee === 'number' && fee > 0,
  );

  if (fees.length === 0) {
    return '';
  }

  const min = Math.min(...fees);
  const max = Math.max(...fees);

  return min === max ? formatVnd(min) : `${formatVnd(min)} – ${formatVnd(max)}`;
};

const parseMenusToTableData = (
  menus: (MenuListing & { restaurantName: string })[],
  {
    onViewDetail,
    onToggleExpand,
    expandedMenuId,
  }: {
    onViewDetail: (menuId: string) => void;
    onToggleExpand: (menuId: string) => void;
    expandedMenuId: string | null;
  },
) => {
  return menus.map((menu, index) => {
    const menuId = menu?.id?.uuid || '';
    const attributes = menu?.attributes;
    const publicData = attributes?.publicData;
    const metadata = attributes?.metadata;
    const title = attributes?.title || '';
    const menuType = publicData?.menuType || metadata?.menuType || '';
    const mealType = publicData?.mealType || '';
    const startDate = publicData?.startDate;
    const endDate = publicData?.endDate;
    const status = metadata?.listingState || '';

    return {
      key: menuId,
      data: {
        order: index + 1,
        id: menuId,
        title,
        restaurantName: menu.restaurantName,
        menuType,
        mealType,
        startDate,
        endDate,
        status,
        appliedExtraFee: buildExtraFeeLabel(publicData?.foodExtraFees),
        isExpanded: expandedMenuId === menuId,
        onViewDetail,
        onToggleExpand,
      },
    };
  });
};

const ManagePartnersMenusPage = () => {
  const intl = useIntl();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [isExtraFeeModalOpen, setIsExtraFeeModalOpen] = useState(false);
  const [isImportFeeModalOpen, setIsImportFeeModalOpen] = useState(false);
  // Only one panel is open at a time, so at most one can hold unsaved edits.
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);
  // Drafts live here (not in the panel) so collapsing does not discard them.
  const [feeDrafts, setFeeDrafts] = useState<
    Record<string, Record<string, string>>
  >({});

  const {
    pendingMenus,
    pagination,
    fetchPendingMenusInProgress,
    fetchPendingMenusError,
    applyExtraFeeInProgress,
    saveMenuExtraFeesInProgress,
  } = useAppSelector((state) => state.adminManagePartnersMenus, shallowEqual);

  useEffect(() => {
    dispatch(
      ManagePartnersMenusThunks.fetchPendingMenus({ page: 1, perPage: 20 }),
    );
  }, [dispatch]);

  const handleViewDetail = (menuId: string) => {
    router.push(`/admin/partner/pending-menus/${menuId}`);
  };

  const handlePageChange = (page: number, pageSize?: number) => {
    setExpandedMenuId(null);
    setFeeDrafts({});
    dispatch(
      ManagePartnersMenusThunks.fetchPendingMenus({
        page,
        perPage: pageSize || 20,
      }),
    );
  };

  const handleExposeValues = ({ values }: { values: any; valid: boolean }) => {
    setSelectedMenuIds(values?.rowCheckbox || []);
  };

  const handleApplyExtraFee = async (extraFee: number) => {
    await dispatch(
      ManagePartnersMenusThunks.applyExtraFeeToMenus({
        selectedMenuIds,
        menus: pendingMenus,
        extraFee,
      }),
    );
    setIsExtraFeeModalOpen(false);
    toast.success(
      `Đã áp dụng phụ phí ${extraFee.toLocaleString('vi-VN')}đ cho ${
        selectedMenuIds.length
      } menu`,
    );
  };

  const getMenuById = (menuId: string) =>
    pendingMenus.find((menu) => menu.id?.uuid === menuId);

  const getSavedExtraFees = (menuId: string) =>
    getMenuById(menuId)?.attributes?.publicData?.foodExtraFees || {};

  /** Seeds the draft from what is stored, so an untouched panel is not dirty. */
  const getDraftForMenu = (menuId: string, rows: { foodId: string }[]) => {
    if (feeDrafts[menuId]) {
      return feeDrafts[menuId];
    }

    const saved = getSavedExtraFees(menuId);

    return rows.reduce<Record<string, string>>((result, row) => {
      const fee = saved[row.foodId];

      return {
        ...result,
        [row.foodId]: fee ? parsePrice(String(fee)) : '',
      };
    }, {});
  };

  const handleToggleExpand = (menuId: string) => {
    setExpandedMenuId((current) => (current === menuId ? null : menuId));
  };

  const handleFeeChange = (
    menuId: string,
    rows: { foodId: string }[],
    foodId: string,
    value: string,
  ) => {
    const current = getDraftForMenu(menuId, rows);

    setFeeDrafts((drafts) => ({
      ...drafts,
      [menuId]: { ...current, [foodId]: value },
    }));
  };

  const handleSaveMenuExtraFees = async (
    menuId: string,
    rows: { foodId: string }[],
  ) => {
    const draft = getDraftForMenu(menuId, rows);
    const extraFees = rows.reduce<Record<string, number>>(
      (result, row) => ({
        ...result,
        [row.foodId]: toAmount(draft[row.foodId] || ''),
      }),
      {},
    );

    try {
      await dispatch(
        ManagePartnersMenusThunks.saveMenuExtraFees({ menuId, extraFees }),
      ).unwrap();

      // The store now matches the draft; drop it so the panel reads from state.
      setFeeDrafts((drafts) => {
        const { [menuId]: _saved, ...rest } = drafts;

        return rest;
      });
      toast.success('Đã lưu phụ phí cho menu');
    } catch (error) {
      toast.error((error as Error).message || 'Lưu phụ phí thất bại');
    }
  };

  const renderExpandedContent = (row: TRowData) => {
    const menuId = String(row.key);
    const menu = getMenuById(menuId);

    if (!menu) {
      return null;
    }

    const rows = buildExtraFeeRows(menu.attributes?.publicData?.foodsByDate);
    const draft = getDraftForMenu(menuId, rows);
    const listingState = menu.attributes?.metadata?.listingState ?? '';

    return (
      <MenuExtraFeePanel
        rows={rows}
        draft={draft}
        isDirty={hasUnsavedExtraFeeChanges(
          draft,
          getSavedExtraFees(menuId),
          rows.map((item) => item.foodId),
        )}
        isEditable={EDITABLE_MENU_STATES.includes(listingState)}
        inProgress={saveMenuExtraFeesInProgress}
        onChange={(foodId, value) =>
          handleFeeChange(menuId, rows, foodId, value)
        }
        onSave={() => handleSaveMenuExtraFees(menuId, rows)}
      />
    );
  };

  const tableData = parseMenusToTableData(pendingMenus, {
    onViewDetail: handleViewDetail,
    onToggleExpand: handleToggleExpand,
    expandedMenuId,
  });

  const title = intl.formatMessage({
    id: 'ManagePartnersMenusApproval.title',
  });

  if (fetchPendingMenusInProgress) {
    return <LoadingContainer />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-3">
          {selectedMenuIds.length > 0 && (
            <Button
              variant="primary"
              className="flex items-center gap-2"
              onClick={() => setIsExtraFeeModalOpen(true)}>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Thêm phụ phí ({selectedMenuIds.length})
            </Button>
          )}
          <Button
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => setIsImportFeeModalOpen(true)}>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Import phụ phí
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-lg">
            <span className="text-xl font-bold text-amber-600">
              {pagination.totalItems}
            </span>
            <span className="text-gray-700">
              <FormattedMessage id="ManagePartnersMenusApproval.pendingCount" />
            </span>
          </div>
        </div>
      </div>

      {/* Error message */}
      {fetchPendingMenusError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">
            <FormattedMessage id="ManagePartnersMenusApproval.fetchError" />
          </p>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {pagination.totalItems > 0 ? (
          <TableForm
            columns={TABLE_COLUMNS}
            data={tableData}
            pagination={pagination}
            onCustomPageChange={handlePageChange}
            hasCheckbox
            exposeValues={handleExposeValues}
            expandedRowKey={expandedMenuId}
            renderExpandedContent={renderExpandedContent}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-full mb-6">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              <FormattedMessage id="ManagePartnersMenusApproval.emptyTitle" />
            </h3>
            <p className="text-gray-500 max-w-sm">
              <FormattedMessage id="ManagePartnersMenusApproval.emptyDescription" />
            </p>
          </div>
        )}
      </div>

      <ImportExtraFeeModal
        isOpen={isImportFeeModalOpen}
        onClose={() => setIsImportFeeModalOpen(false)}
        onImported={() =>
          dispatch(
            ManagePartnersMenusThunks.fetchPendingMenus({
              page: pagination.page,
              perPage: pagination.perPage,
            }),
          )
        }
      />

      <ApplyExtraFeeModal
        isOpen={isExtraFeeModalOpen}
        selectedCount={selectedMenuIds.length}
        onClose={() => setIsExtraFeeModalOpen(false)}
        onApply={handleApplyExtraFee}
        isApplying={applyExtraFeeInProgress}
      />
    </div>
  );
};

export default ManagePartnersMenusPage;
