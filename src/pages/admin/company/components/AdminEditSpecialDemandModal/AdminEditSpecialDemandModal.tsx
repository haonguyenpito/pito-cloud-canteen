import { useMemo } from 'react';
import { shallowEqual } from 'react-redux';

import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import Modal from '@components/Modal/Modal';
import { useAppSelector } from '@hooks/reduxHooks';
import type { TSpecialDemandFormValues } from '@pages/participant/account/components/SpecialDemandForm/SpecialDemandForm';
import SpecialDemandForm from '@pages/participant/account/components/SpecialDemandForm/SpecialDemandForm';
import type { TCompanyMemberWithDetails } from '@utils/types';

type TAdminEditSpecialDemandModalProps = {
  member: TCompanyMemberWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: TSpecialDemandFormValues) => void;
  inProgress: boolean;
  errorMessage?: string | null;
};

const AdminEditSpecialDemandModal: React.FC<
  TAdminEditSpecialDemandModalProps
> = ({ member, isOpen, onClose, onSubmit, inProgress, errorMessage }) => {
  const nutritionOptions = useAppSelector(
    (state) => state.SystemAttributes.nutritions,
    shallowEqual,
  );

  const memberId = member?.id?.uuid;
  // Keyed on the member id so react-final-form is not re-initialised (and
  // in-progress checkbox edits dropped) on every parent re-render.
  const initialValues = useMemo(() => {
    const publicData = member?.attributes?.profile?.publicData || {};

    return {
      allergies: publicData.allergies || [],
      nutritions: publicData.nutritions || [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  return (
    <Modal
      id="AdminEditSpecialDemandModal"
      isOpen={isOpen}
      handleClose={onClose}
      title="Dị ứng & chế độ dinh dưỡng">
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <SpecialDemandForm
        onSubmit={onSubmit}
        initialValues={initialValues}
        nutritionOptions={nutritionOptions}
        inProgress={inProgress}
        view="admin"
      />
    </Modal>
  );
};

export default AdminEditSpecialDemandModal;
