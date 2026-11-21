import { useMemo } from 'react';
import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import { shallowEqual } from 'react-redux';

import Button from '@components/Button/Button';
import type { EDaySession } from '@components/CalendarDashboard/helpers/types';
import Form from '@components/Form/Form';
import FieldCheckbox from '@components/FormFields/FieldCheckbox/FieldCheckbox';
import FieldSelect from '@components/FormFields/FieldSelect/FieldSelect';
import FieldTextInput from '@components/FormFields/FieldTextInput/FieldTextInput';
import { useAppSelector } from '@hooks/reduxHooks';
import { useOptionLabelsByLocale } from '@src/marketplaceConfig';
import type { TKeyValue } from '@src/utils/types';
import { filterValidDeliveryHours } from '@utils/dates';
import {
  greaterThanOneThousand,
  greaterThanZero,
  required,
} from '@utils/validators';

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

const validate = (values: TBookerQuizFormValues) => {
  const errors: Partial<Record<keyof TBookerQuizFormValues, string>> = {};

  const packagePerMemberError =
    required('Vui lòng nhập ngân sách mỗi người')(
      values.packagePerMember ?? '',
    ) ||
    greaterThanOneThousand('Ngân sách mỗi người phải lớn hơn 1,000đ')(
      +(values.packagePerMember || 0),
    );
  if (packagePerMemberError) {
    errors.packagePerMember = packagePerMemberError;
  }

  const memberAmountError =
    required('Vui lòng nhập số lượng người ăn')(values.memberAmount ?? '') ||
    greaterThanZero('Số lượng người ăn phải lớn hơn 0')(
      +(values.memberAmount || 0),
    );
  if (memberAmountError) {
    errors.memberAmount = memberAmountError;
  }

  return errors;
};

type TExtraProps = { inProgress: boolean };
type TBookerQuizFormComponentProps = FormRenderProps<TBookerQuizFormValues> &
  Partial<TExtraProps>;
type TBookerQuizFormProps = FormProps<TBookerQuizFormValues> & TExtraProps;

const BookerQuizFormComponent: React.FC<TBookerQuizFormComponentProps> = (
  props,
) => {
  const { handleSubmit, submitting, inProgress, values } = props;
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

  const { daySession, deliveryHour } = values;
  const deliveryHourOptions = useMemo(() => {
    // No start date here: this is the booker's default, not a concrete order.
    const options = filterValidDeliveryHours({
      startDate: '',
      daySession: daySession as EDaySession,
    });

    return deliveryHour && !options.some(({ key }) => key === deliveryHour)
      ? [{ key: deliveryHour, label: deliveryHour }, ...options]
      : options;
  }, [daySession, deliveryHour]);

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
      <FieldSelect id="deliveryHour" name="deliveryHour" label="Giờ giao">
        <option value="">Chọn giờ giao</option>
        {deliveryHourOptions.map(({ key, label }) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </FieldSelect>

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
  <FinalForm
    {...props}
    validate={validate}
    component={BookerQuizFormComponent}
  />
);

export default BookerQuizForm;
