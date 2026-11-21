import React, { useEffect, useMemo } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import { useRouter } from 'next/router';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import ConfirmationModal from '@components/ConfirmationModal/ConfirmationModal';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { adminRoutes } from '@src/paths';
import { EListingStates } from '@src/utils/enums';

import MenuApprovalDetail from '../components/MenuApprovalDetail/MenuApprovalDetail';
import RejectMenuModal from '../components/RejectMenuModal/RejectMenuModal';
import {
  ManagePartnersMenusActions,
  ManagePartnersMenusThunks,
} from '../ManagePartnersMenus.slice';

const ManagePartnerMenuPage = () => {
  const router = useRouter();
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { menuId } = router.query;

  const [isRejectModalOpen, setIsRejectModalOpen] = React.useState(false);
  // Approval freezes the menu's extra fees for good (there is no edit path
  // afterwards), so the admin must acknowledge that before approving.
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = React.useState(false);

  const {
    currentMenu,
    fetchMenuDetailInProgress,
    approveMenuInProgress,
    rejectMenuInProgress,
  } = useAppSelector((state) => state.adminManagePartnersMenus, shallowEqual);

  const isLoading = fetchMenuDetailInProgress;

  const anchorDate = useMemo(() => {
    const publicData = currentMenu?.attributes?.publicData;
    if (publicData?.startDate) {
      return new Date(publicData.startDate);
    }

    return new Date();
  }, [currentMenu]);

  useEffect(() => {
    if (menuId) {
      dispatch(
        ManagePartnersMenusThunks.fetchMenuDetail({ menuId: menuId as string }),
      );
    }

    return () => {
      dispatch(ManagePartnersMenusActions.clearCurrentMenu());
    };
  }, [dispatch, menuId]);

  const handleGoBack = () => {
    router.push(adminRoutes.ManagePartnersMenus.path);
  };

  const handleOpenApproveConfirm = () => {
    setIsApproveConfirmOpen(true);
  };

  const handleCloseApproveConfirm = () => {
    if (approveMenuInProgress) return;

    setIsApproveConfirmOpen(false);
  };

  const handleApprove = async () => {
    if (!menuId) return;

    try {
      const result = await dispatch(
        ManagePartnersMenusThunks.approveMenu({ menuId: menuId as string }),
      ).unwrap();

      if (result.status === EListingStates.published) {
        toast.success('Menu đã được duyệt thành công');
        router.push(adminRoutes.ManagePartnersMenus.path);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      toast.error(errorMessage);
    } finally {
      setIsApproveConfirmOpen(false);
    }
  };

  const handleOpenRejectModal = () => {
    setIsRejectModalOpen(true);
  };

  const handleCloseRejectModal = () => {
    setIsRejectModalOpen(false);
  };

  const handleReject = async (reason: string) => {
    if (!menuId) return;

    try {
      const result = await dispatch(
        ManagePartnersMenusThunks.rejectMenu({
          menuId: menuId as string,
          reason,
        }),
      ).unwrap();

      if (result.status === EListingStates.rejected) {
        toast.success('Menu đã được từ chối thành công');
        setIsRejectModalOpen(false);
        router.push(adminRoutes.ManagePartnersMenus.path);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return <LoadingContainer />;
  }

  if (!currentMenu) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-10 h-10 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-gray-500 mb-4">Menu không tồn tại hoặc đã bị xóa</p>
        <Button variant="secondary" onClick={handleGoBack}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const menuTitle = currentMenu?.attributes?.title || '';
  const status = currentMenu.attributes?.metadata?.listingState;
  const statusMap: Record<string, { type: EBadgeType; label: string }> = {
    [EListingStates.published]: {
      type: EBadgeType.success,
      label: 'Đã duyệt',
    },
    [EListingStates.pendingApproval]: {
      type: EBadgeType.warning,
      label: 'Chờ duyệt',
    },
    [EListingStates.rejected]: {
      type: EBadgeType.danger,
      label: 'Từ chối',
    },
  };
  const badgeProps = statusMap[status ?? ''] ?? {
    type: EBadgeType.warning,
    label: status || '',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleGoBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <IconArrow direction="left" className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            <FormattedMessage id="ManagePartnerMenuApproval.pageTitle" />
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{menuTitle}</p>
          <Badge
            type={badgeProps.type}
            label={badgeProps.label}
            className="mt-2"
          />
        </div>
      </div>

      {/* Menu Detail Content */}
      <MenuApprovalDetail menu={currentMenu} anchorDate={anchorDate} />
      {/* Action Buttons - Sticky Footer */}
      <div className="sticky bottom-4 mt-6">
        <div className="flex justify-between gap-4 py-4 px-6 bg-white rounded-xl">
          <Button
            variant="secondary"
            onClick={handleGoBack}
            disabled={approveMenuInProgress || rejectMenuInProgress}>
            <FormattedMessage id="ManagePartnerMenuApproval.cancel" />
          </Button>
          {currentMenu.attributes?.metadata?.listingState ===
            EListingStates.pendingApproval && (
            <div className="flex gap-4">
              <Button
                variant="secondary"
                className="!border-red-300 !text-red-600 hover:!bg-red-50"
                onClick={handleOpenRejectModal}
                disabled={approveMenuInProgress || rejectMenuInProgress}>
                <FormattedMessage id="ManagePartnerMenuApproval.reject" />
              </Button>
              <Button
                onClick={handleOpenApproveConfirm}
                inProgress={approveMenuInProgress}
                disabled={rejectMenuInProgress}>
                <FormattedMessage id="ManagePartnerMenuApproval.approve" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Approve Confirmation */}
      <ConfirmationModal
        id="ApproveMenuConfirmationModal"
        isOpen={isApproveConfirmOpen}
        onClose={handleCloseApproveConfirm}
        onCancel={handleCloseApproveConfirm}
        onConfirm={handleApprove}
        isConfirmButtonLoading={approveMenuInProgress}
        title={intl.formatMessage({
          id: 'ManagePartnerMenuApproval.approveConfirm.title',
        })}
        description={intl.formatMessage({
          id: 'ManagePartnerMenuApproval.approveConfirm.description',
        })}
        confirmText={intl.formatMessage({
          id: 'ManagePartnerMenuApproval.approveConfirm.confirm',
        })}
        cancelText={intl.formatMessage({
          id: 'ManagePartnerMenuApproval.approveConfirm.cancel',
        })}
      />

      {/* Reject Modal */}
      <RejectMenuModal
        isOpen={isRejectModalOpen}
        menuTitle={menuTitle}
        onClose={handleCloseRejectModal}
        onReject={handleReject}
        isRejecting={rejectMenuInProgress}
      />
    </div>
  );
};

export default ManagePartnerMenuPage;
