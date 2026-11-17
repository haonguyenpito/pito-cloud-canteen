import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import { useIntl } from 'react-intl';

import Button from '@components/Button/Button';
import Form from '@components/Form/Form';
import FieldMultipleSelect from '@components/FormFields/FieldMultipleSelect/FieldMultipleSelect';
import FieldSelect from '@components/FormFields/FieldSelect/FieldSelect';
import FieldTextInput from '@components/FormFields/FieldTextInput/FieldTextInput';
import { parseThousandNumber, removeNonNumeric } from '@helpers/format';
import { FOOD_TYPE_OPTIONS } from '@src/utils/options';

import css from './FilterForm.module.scss';

export type TFilterFormValues = {
  keywords?: string;
  pub_category?: string[];
  pub_foodType?: string;
  priceFrom?: string;
  priceTo?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
};

type TExtraProps = {
  categoryOptions: any;
};
type TFilterFormComponentProps = FormRenderProps<TFilterFormValues> &
  Partial<TExtraProps>;
type TFilterFormProps = FormProps<TFilterFormValues> & TExtraProps;

const priceFieldProps = {
  inputMode: 'numeric',
  parse: removeNonNumeric,
  format: (value?: string) => (value ? parseThousandNumber(value) : ''),
};

const FilterFormComponent: React.FC<TFilterFormComponentProps> = (props) => {
  const { handleSubmit, categoryOptions } = props;
  const intl = useIntl();
  const submitDisabled = false;

  return (
    <Form onSubmit={handleSubmit}>
      <FieldTextInput
        name="keywords"
        id="keywords"
        label="Tên món"
        placeholder="Nhập tên món"
        className={css.input}
      />
      <FieldMultipleSelect
        className={css.input}
        name="pub_category"
        id="pub_category"
        label="Phong cách ẩm thực"
        placeholder="Phong cách ẩm thực"
        options={categoryOptions}
      />
      <FieldSelect
        className={css.input}
        name="pub_foodType"
        id="pub_foodType"
        label="Loại thức ăn">
        <option value="">Tất cả loại</option>
        {FOOD_TYPE_OPTIONS.map(({ key, label }) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </FieldSelect>
      <div className={css.label}>Đơn giá (VND)</div>
      <div className={css.range}>
        <FieldTextInput
          name="priceFrom"
          id="priceFrom"
          placeholder="Từ"
          {...priceFieldProps}
        />
        <span>–</span>
        <FieldTextInput
          name="priceTo"
          id="priceTo"
          placeholder="Đến"
          {...priceFieldProps}
        />
      </div>
      <div className={css.label}>Ngày tạo món</div>
      <div className={css.range}>
        <FieldTextInput name="createdAtFrom" id="createdAtFrom" type="date" />
        <span>–</span>
        <FieldTextInput name="createdAtTo" id="createdAtTo" type="date" />
      </div>
      <Button
        type="submit"
        className={css.filterBtn}
        size="medium"
        disabled={submitDisabled}>
        {intl.formatMessage({ id: 'ManagePartnerFoods.filterModal.title' })}
      </Button>
    </Form>
  );
};

const FilterForm: React.FC<TFilterFormProps> = (props) => {
  return <FinalForm {...props} component={FilterFormComponent} />;
};

export default FilterForm;
