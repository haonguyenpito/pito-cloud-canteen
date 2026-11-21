import { useIntl } from 'react-intl';

import Modal from '@components/Modal/Modal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import SlideModal from '@components/SlideModal/SlideModal';
import { parseThousandNumber } from '@helpers/format';
import { useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import type { TObject } from '@utils/types';

import type { TEditOrderRowFormValues } from './EditOrderRowForm';
import EditOrderRowForm from './EditOrderRowForm';

import css from './EditOrderRowModal.module.scss';

type TEditOrderRowModalProps = {
  isOpen: boolean;
  onClose: () => void;
  foodOptions: any[];
  onSubmit: (values: TEditOrderRowFormValues) => void | Promise<unknown>;
  currentMemberOrderData?: TObject;
  packagePerMember: number;
};

const EditOrderRowModal: React.FC<TEditOrderRowModalProps> = (props) => {
  const {
    onClose,
    isOpen,
    onSubmit,
    foodOptions,
    currentMemberOrderData = {},
    packagePerMember,
  } = props;
  const intl = useIntl();
  const { isMobileLayout } = useViewport();

  const { memberData = {}, foodData = {} } = currentMemberOrderData;

  const isAllowAddSecondaryFood = useAppSelector(
    (state) => state.OrderManagement.isAllowAddSecondaryFood,
  );

  const primaryFoodId = foodData.foodId || '';
  const primaryFoodData = foodOptions.find(
    (food) => food.foodId === primaryFoodId,
  );
  const isSingleSelectionFood = primaryFoodData?.numberOfMainDishes === 1;

  const initialValues = {
    foodId: primaryFoodId,
    requirement: foodData.requirement || '',
    memberName: memberData.name || '',
    secondaryFoodId: isSingleSelectionFood
      ? undefined
      : foodData.secondaryFoodId,
    secondaryRequirement: isSingleSelectionFood
      ? undefined
      : foodData.secondaryRequirement,
  };

  const handleSubmit = (values: TEditOrderRowFormValues) => {
    const selectedFoodId = values.foodId;
    const selectedFoodData = foodOptions.find(
      (food) => food.foodId === selectedFoodId,
    );
    if (isAllowAddSecondaryFood && selectedFoodData?.numberOfMainDishes === 1) {
      values.secondaryFoodId = '';
      values.secondaryRequirement = '';
    }

    // Returned so the form stays `submitting` (button spinner, submit
    // disabled) until the save, which may wait for the plan lock, is done.
    return onSubmit(values);
  };

  const modalTitle = intl.formatMessage({
    id: 'EditOrderRowModal.title',
  });
  const content = (
    <>
      <div className={css.subTitle}>
        {intl.formatMessage(
          { id: 'EditOrderRowModal.subtitle' },
          {
            packagePerMember: (
              <b>{parseThousandNumber(packagePerMember.toString())}đ</b>
            ),
          },
        )}
      </div>
      <EditOrderRowForm
        onSubmit={handleSubmit}
        foodOptions={foodOptions}
        initialValues={initialValues}
      />
    </>
  );

  return (
    <RenderWhen condition={isMobileLayout}>
      {isOpen && (
        <SlideModal
          id="EditOrderRowMobileModal"
          contentClassName={css.mobileModalContent}
          modalTitle={modalTitle}
          onClose={onClose}
          isOpen={isOpen}>
          {content}
        </SlideModal>
      )}

      <RenderWhen.False>
        <Modal
          className={css.root}
          containerClassName={css.modalContainer}
          handleClose={onClose}
          isOpen={isOpen}
          title={modalTitle}>
          {content}
        </Modal>
      </RenderWhen.False>
    </RenderWhen>
  );
};

export default EditOrderRowModal;
