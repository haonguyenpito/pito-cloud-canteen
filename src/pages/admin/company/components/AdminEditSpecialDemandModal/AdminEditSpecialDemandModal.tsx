import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { shallowEqual } from 'react-redux';

import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import Modal from '@components/Modal/Modal';
import { getCompanyMemberUserId } from '@helpers/companyMemberHelper';
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

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const memberId = getCompanyMemberUserId(member);
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

  if (!isMounted) return null;

  // `Modal` does not portal, and this modal is rendered inside the company
  // wizard's <form>. A nested <form> is dropped by the HTML parser, so
  // SpecialDemandForm's submit would submit the wizard and reload the app.
  return createPortal(
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
    </Modal>,
    document.body,
  );
};

export default AdminEditSpecialDemandModal;
