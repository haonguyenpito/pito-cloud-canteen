import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import { shallowEqual } from 'react-redux';

import Button from '@components/Button/Button';
import Form from '@components/Form/Form';
import FieldCheckbox from '@components/FormFields/FieldCheckbox/FieldCheckbox';
import FieldSelect from '@components/FormFields/FieldSelect/FieldSelect';
import FieldTextInput from '@components/FormFields/FieldTextInput/FieldTextInput';
import { useAppSelector } from '@hooks/reduxHooks';
import { useOptionLabelsByLocale } from '@src/marketplaceConfig';
import type { TKeyValue } from '@src/utils/types';

import css from './EditBookerQuizTab.module.scss';

export type TBookerQuizFormValues = {
  packagePerMember?: string;
  memberAmount?: string;
  daySession?: string;
  deliveryHour?: string;
  mealStyles?: string[];
  nutritions?: string[];
  mealType?: string[];
};

type TExtraProps = { inProgress: boolean };
type TBookerQuizFormComponentProps = FormRenderProps<TBookerQuizFormValues> &
  Partial<TExtraProps>;
type TBookerQuizFormProps = FormProps<TBookerQuizFormValues> & TExtraProps;

const BookerQuizFormComponent: React.FC<TBookerQuizFormComponentProps> = (
  props,
) => {
  const { handleSubmit, submitting, inProgress } = props;
  const mealStyleOptions = useAppSelector(
    (state) => state.SystemAttributes.categories,
    shallowEqual,
  );
  const nutritionOptions = useAppSelector(
    (state) => state.SystemAttributes.nutritions,
    shallowEqual,
  );
  const daySessionOptions = useAppSelector(
    (state) => state.SystemAttributes.daySessions,
    shallowEqual,
  );
  const { mealTypeOptions } = useOptionLabelsByLocale();

  return (
    <Form onSubmit={handleSubmit} className={css.form}>
      <div className={css.warning}>
        Giá trị này là mặc định cho mọi đơn hàng booker tạo về sau, gồm cả ngân
        sách mỗi người. Đơn đã tạo không bị ảnh hưởng.
      </div>

      <FieldTextInput
        id="packagePerMember"
        name="packagePerMember"
        type="number"
        label="Ngân sách mỗi người (VND)"
      />
      <FieldTextInput
        id="memberAmount"
        name="memberAmount"
        type="number"
        label="Số lượng người ăn"
      />
      <FieldSelect id="daySession" name="daySession" label="Buổi">
        <option value="">Chọn buổi</option>
        {daySessionOptions.map(({ key, label }: TKeyValue) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </FieldSelect>
      <FieldTextInput
        id="deliveryHour"
        name="deliveryHour"
        label="Giờ giao (ví dụ 11:30)"
      />

      <div className={css.fieldGroupTitle}>Phong cách món</div>
      <div className={css.fieldGroup}>
        {mealStyleOptions.map(({ key, label }: TKeyValue) => (
          <FieldCheckbox
            key={key}
            id={`quiz-mealStyles-${key}`}
            name="mealStyles"
            value={key}
            label={label}
          />
        ))}
      </div>

      <div className={css.fieldGroupTitle}>Chế độ dinh dưỡng</div>
      <div className={css.fieldGroup}>
        {nutritionOptions.map(({ key, label }: TKeyValue) => (
          <FieldCheckbox
            key={key}
            id={`quiz-nutritions-${key}`}
            name="nutritions"
            value={key}
            label={label}
          />
        ))}
      </div>

      <div className={css.fieldGroupTitle}>Loại bữa</div>
      <div className={css.fieldGroup}>
        {mealTypeOptions.map(({ key, label }) => (
          <FieldCheckbox
            key={key}
            id={`quiz-mealType-${key}`}
            name="mealType"
            value={key}
            label={label}
          />
        ))}
      </div>

      <Button
        type="submit"
        disabled={submitting || inProgress}
        inProgress={inProgress}>
        Lưu
      </Button>
    </Form>
  );
};

const BookerQuizForm: React.FC<TBookerQuizFormProps> = (props) => (
  <FinalForm {...props} component={BookerQuizFormComponent} />
);

export default BookerQuizForm;
