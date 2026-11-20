import AlertModal from '@components/Modal/AlertModal';

import ConfirmNotifyUserForm from './ConfirmNotifyUserForm';

import css from './ConfirmNotifyUserModal.module.scss';

type TConfirmNotifyUserModalProps = {
  isOpen: boolean;
  confirmDisabled: boolean;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  shouldHideParticipantOption: boolean;
  setUserRoles: (value: string[]) => void;
  initialValues: any;
  clearedPicks?: {
    key: string;
    dateLabel: string;
    memberName: string;
    foodName: string;
  }[];
};

const ConfirmNotifyUserModal: React.FC<TConfirmNotifyUserModalProps> = (
  props,
) => {
  const {
    shouldHideParticipantOption,
    isOpen,
    onCancel,
    confirmDisabled,
    onConfirm,
    onClose,
    setUserRoles,
    initialValues,
    clearedPicks = [],
  } = props;

  return (
    <div className={css.root}>
      <AlertModal
        containerClassName={css.modalContainer}
        title="Thông báo thay đổi"
        isOpen={isOpen}
        handleClose={onClose}
        onCancel={onCancel}
        cancelLabel="Bỏ qua"
        onConfirm={onConfirm}
        confirmLabel="Gửi thông báo"
        confirmDisabled={confirmDisabled}
        childrenClassName={css.modalChildrenContainer}>
        {clearedPicks.length > 0 && (
          <div className={css.clearedPicks} role="alert">
            <div className={css.clearedPicksTitle}>
              {clearedPicks.length} lựa chọn của thành viên sẽ bị huỷ vì món
              không còn trong thực đơn:
            </div>
            <ul className={css.clearedPicksList}>
              {clearedPicks.map(({ key, dateLabel, memberName, foodName }) => (
                <li key={key}>
                  {dateLabel} – {memberName} – {foodName}
                </li>
              ))}
            </ul>
            <div className={css.clearedPicksHint}>
              Đóng hộp thoại này để quay lại chỉnh sửa, đơn hàng chưa được lưu.
            </div>
          </div>
        )}
        <div>Chọn đối tượng để gửi thông báo thay đổi về đơn hàng</div>
        <ConfirmNotifyUserForm
          initialValues={initialValues}
          setUserRoles={setUserRoles}
          shouldHideParticipantOption={shouldHideParticipantOption}
          onSubmit={() => {}}
        />
      </AlertModal>
    </div>
  );
};

export default ConfirmNotifyUserModal;
