import type { ReactNode } from 'react';
import { useIntl } from 'react-intl';

import AlertModal from '@components/Modal/AlertModal';

import css from './AlertConfirmDeleteParticipant.module.scss';

type TAlertConfirmDeleteParticipantProps = {
  cancelDisabled?: boolean;
  confirmDisabled?: boolean;
  confirmInProgress?: boolean;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  question?: ReactNode;
  title?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const AlertConfirmDeleteParticipant: React.FC<
  TAlertConfirmDeleteParticipantProps
> = ({
  isOpen,
  title,
  confirmDisabled,
  confirmInProgress,
  cancelDisabled,
  question,
  confirmText,
  cancelText,
  onCancel,
  onClose,
  onConfirm,
}) => {
  const intl = useIntl();

  const deleteParticipantPopupTitle = intl.formatMessage({
    id: 'ManageParticipantsSection.deleteParticipantPopup.title',
  });
  const deleteParticipantPopupQuestion = intl.formatMessage({
    id: 'ManageParticipantsSection.deleteParticipantPopup.confirmQuestion',
  });
  const cancelDeleteParticipantText = intl.formatMessage({
    id: 'ManageParticipantsSection.deleteParticipantPopup.cancel',
  });
  const confirmDeleteParticipantText = intl.formatMessage({
    id: 'ManageParticipantsSection.deleteParticipantPopup.confirm',
  });

  return (
    <AlertModal
      id="AlertConfirmDeleteParticipant.Modal"
      containerClassName={css.confirmDeleteContainer}
      shouldFullScreenInMobile={false}
      cancelDisabled={cancelDisabled}
      confirmDisabled={confirmDisabled}
      confirmInProgress={confirmInProgress}
      title={title || deleteParticipantPopupTitle}
      isOpen={isOpen}
      handleClose={onClose}
      confirmLabel={confirmText || confirmDeleteParticipantText}
      cancelLabel={cancelText || cancelDeleteParticipantText}
      onConfirm={onConfirm}
      onCancel={onCancel}>
      {question || <div>{deleteParticipantPopupQuestion}</div>}
    </AlertModal>
  );
};

export default AlertConfirmDeleteParticipant;
