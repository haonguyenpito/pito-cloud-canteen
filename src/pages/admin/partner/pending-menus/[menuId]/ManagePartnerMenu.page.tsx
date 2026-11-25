import React, { useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import { useRouter } from 'next/router';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import Button from '@components/Button/Button';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import AlertModal from '@components/Modal/AlertModal';
import Stepper from '@components/Stepper/Stepper';
import { sanitizeExtraFeeMap } from '@helpers/menuExtraFee';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { adminRoutes } from '@src/paths';
import { EListingStates } from '@src/utils/enums';

import MenuApprovalDetail from '../components/MenuApprovalDetail/MenuApprovalDetail';
import MenuExtraFeeStep from '../components/MenuExtraFeeStep/MenuExtraFeeStep';
import {
  buildExtraFeeDayGroups,
  toExtraFeeMap,
} from '../components/MenuExtraFeeStep/utils';
import RejectMenuModal from '../components/RejectMenuModal/RejectMenuModal';
import {
  ManagePartnersMenusActions,
  ManagePartnersMenusThunks,
} from '../ManagePartnersMenus.slice';

enum EMenuReviewStep {
  extraFee = 1,
  detail = 2,
}

const EDITABLE_FEE_MENU_STATES: string[] = [
  EListingStates.draft,
  EListingStates.pendingApproval,
];

/**
 * Two-step review of a partner menu: the admin sets PITO's markup per dish
 * ("Phụ phí"), then reviews the menu and approves or rejects it. Approval
 * freezes the markup.
 */
const ManagePartnerMenuPage = () => {
  const router = useRouter();
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { menuId } = router.query;

  const [isRejectModalOpen, setIsRejectModalOpen] = React.useState(false);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(EMenuReviewStep.extraFee);
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});

  const {
    currentMenu,
    fetchMenuDetailInProgress,
    approveMenuInProgress,
    rejectMenuInProgress,
    saveExtraFeesInProgress,
  } = useAppSelector((state) => state.adminManagePartnersMenus, shallowEqual);

  const isLoading = fetchMenuDetailInProgress;
  const foodsByDate = currentMenu?.attributes?.publicData?.foodsByDate;
  const rawExtraFees = currentMenu?.attributes?.publicData?.foodExtraFees;
  const savedExtraFees = useMemo(
    () => sanitizeExtraFeeMap(rawExtraFees),
    [rawExtraFees],
  );
  const isFeeEditable = EDITABLE_FEE_MENU_STATES.includes(
    currentMenu?.attributes?.metadata?.listingState || '',
  );
  const feeDayGroups = useMemo(
    () => buildExtraFeeDayGroups(foodsByDate),
    [foodsByDate],
  );

  // Keyed on content: a refetch returns a new object with the same fees and
  // must not wipe what the admin is typing.
  const savedExtraFeesKey = JSON.stringify(savedExtraFees);
  useEffect(() => {
    setFeeDrafts(
      Object.fromEntries(
        Object.entries(savedExtraFees).map(([foodId, fee]) => [
          foodId,
          `${fee}`,
        ]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedExtraFeesKey]);

  const reviewSteps = [
    {
      label: intl.formatMessage({ id: 'ManagePartnerMenuApproval.stepFee' }),
      onClick: () => setCurrentStep(EMenuReviewStep.extraFee),
    },
    {
      label: intl.formatMessage({ id: 'ManagePartnerMenuApproval.stepDetail' }),
    },
  ];

  /**
   * Updates one dish's markup input.
   * @param foodId - The dish.
   * @param value - The raw input.
   */
  const handleFeeDraftChange = (foodId: string, value: string) => {
    setFeeDrafts((drafts) => ({ ...drafts, [foodId]: value }));
  };

  /** Saves the markup (when it can still change) and opens the review step. */
  const handleSaveFeesAndContinue = async () => {
    if (!isFeeEditable) {
      setCurrentStep(EMenuReviewStep.detail);

      return;
    }

    const { extraFees, invalidFoodIds } = toExtraFeeMap(feeDrafts);

    if (invalidFoodIds.length > 0) {
      toast.error(intl.formatMessage({ id: 'MenuExtraFeeStep.invalidFee' }));

      return;
    }

    try {
      await dispatch(
        ManagePartnersMenusThunks.saveMenuExtraFees({
          menuId: menuId as string,
          extraFees,
        }),
      ).unwrap();
      setCurrentStep(EMenuReviewStep.detail);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

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

  /** Approves the menu after the admin confirmed the markup is final. */
  const handleApprove = async () => {
    if (!menuId) return;

    setIsApproveConfirmOpen(false);
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

      <Stepper
        // isolate: the connector line sits at z-index -1 and would otherwise
        // render behind the admin content's white background.
        className="mx-auto max-w-[480px] isolate"
        steps={reviewSteps}
        currentStep={currentStep}
      />

      {currentStep === EMenuReviewStep.extraFee ? (
        <MenuExtraFeeStep
          dayGroups={feeDayGroups}
          drafts={feeDrafts}
          onDraftChange={handleFeeDraftChange}
          disabled={!isFeeEditable || saveExtraFeesInProgress}
        />
      ) : (
        <MenuApprovalDetail
          menu={currentMenu}
          anchorDate={anchorDate}
          extraFeeByFoodId={savedExtraFees}
        />
      )}

      {/* Action Buttons - Sticky Footer */}
      <div className="sticky bottom-4 mt-6">
        <div className="flex justify-between gap-4 py-4 px-6 bg-white rounded-xl">
          {currentStep === EMenuReviewStep.extraFee ? (
            <>
              <Button
                variant="secondary"
                onClick={handleGoBack}
                disabled={saveExtraFeesInProgress}>
                <FormattedMessage id="ManagePartnerMenuApproval.cancel" />
              </Button>
              <Button
                onClick={handleSaveFeesAndContinue}
                inProgress={saveExtraFeesInProgress}>
                <FormattedMessage
                  id={
                    isFeeEditable
                      ? 'ManagePartnerMenuApproval.saveFeeAndContinue'
                      : 'ManagePartnerMenuApproval.continue'
                  }
                />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setCurrentStep(EMenuReviewStep.extraFee)}
                disabled={approveMenuInProgress || rejectMenuInProgress}>
                <FormattedMessage id="ManagePartnerMenuApproval.backToFee" />
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
                    onClick={() => setIsApproveConfirmOpen(true)}
                    inProgress={approveMenuInProgress}
                    disabled={rejectMenuInProgress}>
                    <FormattedMessage id="ManagePartnerMenuApproval.approve" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={isApproveConfirmOpen}
        handleClose={() => setIsApproveConfirmOpen(false)}
        onCancel={() => setIsApproveConfirmOpen(false)}
        onConfirm={handleApprove}
        confirmInProgress={approveMenuInProgress}
        title={intl.formatMessage({
          id: 'ManagePartnerMenuApproval.approveConfirmTitle',
        })}
        confirmLabel={intl.formatMessage({
          id: 'ManagePartnerMenuApproval.approve',
        })}
        cancelLabel={intl.formatMessage({
          id: 'ManagePartnerMenuApproval.cancel',
        })}>
        <FormattedMessage id="ManagePartnerMenuApproval.approveConfirmContent" />
      </AlertModal>

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
