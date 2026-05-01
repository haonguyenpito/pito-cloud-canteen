import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import { useRouter } from 'next/router';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import IconEye from '@components/Icons/IconEye/IconEye';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import type { TColumn } from '@components/Table/Table';
import { TableForm } from '@components/Table/Table';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import type { MenuListing } from '@src/types';
import { formatTimestamp } from '@utils/dates';
import { EListingStates, EMenuMealType, EMenuType } from '@utils/enums';

import ApplyExtraFeeModal from './components/ApplyExtraFeeModal/ApplyExtraFeeModal';
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

const TABLE_COLUMNS: TColumn[] = [
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

const parseMenusToTableData = (
  menus: (MenuListing & { restaurantName: string })[],
  { onViewDetail }: { onViewDetail: (menuId: string) => void },
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
        onViewDetail,
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

  const {
    pendingMenus,
    pagination,
    fetchPendingMenusInProgress,
    fetchPendingMenusError,
    applyExtraFeeInProgress,
  } = useAppSelector((state) => state.adminManagePartnersMenus, shallowEqual);

  useEffect(() => {
    dispatch(
      ManagePartnersMenusThunks.fetchPendingMenus({
        page: 1,
        perPage: 20,
      }),
    );
  }, [dispatch]);

  const handleViewDetail = (menuId: string) => {
    router.push(`/admin/partner/pending-menus/${menuId}`);
  };

  const handlePageChange = (page: number, pageSize?: number) => {
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
    setSelectedMenuIds([]);
    toast.success(
      `Đã áp dụng phụ phí ${extraFee.toLocaleString('vi-VN')}đ cho ${selectedMenuIds.length} menu`,
    );
  };

  const tableData = parseMenusToTableData(pendingMenus, {
    onViewDetail: handleViewDetail,
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
