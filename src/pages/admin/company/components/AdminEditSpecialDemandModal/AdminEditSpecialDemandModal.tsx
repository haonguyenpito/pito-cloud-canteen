import { shallowEqual } from 'react-redux';

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
};

const AdminEditSpecialDemandModal: React.FC<
  TAdminEditSpecialDemandModalProps
> = ({ member, isOpen, onClose, onSubmit, inProgress }) => {
  const nutritionOptions = useAppSelector(
    (state) => state.SystemAttributes.nutritions,
    shallowEqual,
  );

  const publicData = member?.attributes?.profile?.publicData || {};
  const initialValues = {
    allergies: publicData.allergies || [],
    nutritions: publicData.nutritions || [],
  };

  return (
    <Modal
      id="AdminEditSpecialDemandModal"
      isOpen={isOpen}
      handleClose={onClose}
      title="Dị ứng & chế độ dinh dưỡng">
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
