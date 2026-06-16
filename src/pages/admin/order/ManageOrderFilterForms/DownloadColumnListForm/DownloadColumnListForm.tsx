import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import Button from '@components/Button/Button';
import Form from '@components/Form/Form';
import FieldCheckbox from '@components/FormFields/FieldCheckbox/FieldCheckbox';
import RenderWhen from '@components/RenderWhen/RenderWhen';

import css from './DownloadColumnListForm.module.scss';

export type TDownloadColumnListFormValues = {
  downloadColumnListName: string[];
  downloadColumnListNameCheckAll?: string[];
};

type TExtraProps = {
  inProgress?: boolean;
};
type TDownloadColumnListFormComponentProps =
  FormRenderProps<TDownloadColumnListFormValues> & Partial<TExtraProps>;
type TDownloadColumnListFormProps = FormProps<TDownloadColumnListFormValues> &
  TExtraProps;

const DOWNLOAD_COLUMN_LIST_OPTIONS = [
  {
    key: 'title',
    label: 'Mã đơn hàng',
  },
  {
    key: 'orderCreatedAt',
    label: 'Ngày tạo đơn',
  },
  {
    key: 'orderState',
    label: 'Trạng thái đơn',
  },
  {
    key: 'companyName',
    label: 'Tên công ty',
  },
  {
    key: 'bookerName',
    label: 'Người đại diện',
  },
  {
    key: 'bookerPhoneNumber',
    label: 'SĐT người đại diện',
  },
  {
    key: 'address',
    label: 'Địa chỉ công ty',
  },
  {
    key: 'deliveryDate',
    label: 'Ngày giao hàng',
  },
  {
    key: 'totalDishes',
    label: 'Số phần ăn',
  },
  {
    key: 'foodList',
    label: 'Danh sách món',
  },
  {
    key: 'numberPerFood',
    label: 'Số lượng từng món',
  },
  {
    key: 'pccFee',
    label: 'Phí dịch vụ',
  },
  {
    key: 'price',
    label: 'Thành tiền',
  },
  {
    key: 'orderNotes',
    label: 'Ghi chú đơn hàng',
  },
  {
    key: 'restaurants',
    label: 'Đối tác',
  },
  {
    key: 'partnerPhoneNumber',
    label: 'SĐT đối tác',
  },
  {
    key: 'partnerAddress',
    label: 'Địa chỉ đối tác',
  },
  {
    key: 'billingOfLading',
    label: 'Phiếu vận đơn',
  },
];

const ORDER_TYPE_OPTIONS = [
  {
    key: 'group',
    label: 'Đơn nhóm',
  },
  {
    key: 'normal',
    label: 'Đơn lẻ',
  },
];

const DownloadColumnListFormComponent: React.FC<
  TDownloadColumnListFormComponentProps
> = (props) => {
  const { handleSubmit, values, inProgress, form } = props;
  const { downloadColumnListName } = values;
  const isOrderTitleSelected = downloadColumnListName?.includes('title');
  const submitDisabled = !downloadColumnListName?.length || inProgress;

  const onCheckboxChange = (event: any) => {
    const { checked, value, name } = event.target;
    const newValues = [...downloadColumnListName];
    if (!checked) {
      const index = newValues.indexOf(value);
      if (index > -1) {
        newValues.splice(index, 1);
      }
      form.change('downloadColumnListNameCheckAll', []);
    } else {
      newValues.push(value);
    }
    if (
      newValues.length ===
      DOWNLOAD_COLUMN_LIST_OPTIONS.length + ORDER_TYPE_OPTIONS.length
    ) {
      form.change('downloadColumnListNameCheckAll', ['all']);
    }

    form.change(name, newValues);
  };

  const onCheckAllChange = (event: any) => {
    const { checked, value, name } = event.target;

    let newValues = [...downloadColumnListName];
    if (!checked) {
      newValues = [];
      form.change(name, []);
    } else {
      form.change(name, [value]);
      newValues = [
        ...DOWNLOAD_COLUMN_LIST_OPTIONS.map((option) => option.key),
        ...ORDER_TYPE_OPTIONS.map((option) => option.key),
      ];
    }
    form.change('downloadColumnListName', newValues);
  };

  return (
    <Form onSubmit={handleSubmit} className={css.formContainer}>
      <div className={css.formTitle}>Tải danh sách</div>
      <div className={css.formDesc}>Chọn thông tin để tải xuống danh sách</div>
      <FieldCheckbox
        id={`downloadColumnList-all`}
        name="downloadColumnListNameCheckAll"
        value="all"
        label="Tất cả"
        className={css.fieldInput}
        customOnChange={onCheckAllChange}
      />
      {DOWNLOAD_COLUMN_LIST_OPTIONS.map((options) => {
        return (
          <>
            <FieldCheckbox
              key={options.key}
              id={`downloadColumnList-${options.key}`}
              name="downloadColumnListName"
              value={options.key}
              label={options.label}
              className={css.fieldInput}
              customOnChange={onCheckboxChange}
            />
            <RenderWhen
              condition={isOrderTitleSelected && options.key === 'title'}>
              {ORDER_TYPE_OPTIONS.map((orderOption) => (
                <FieldCheckbox
                  key={orderOption.key}
                  id={`downloadColumnList-${orderOption.key}`}
                  name="downloadColumnListName"
                  value={orderOption.key}
                  label={orderOption.label}
                  className={classNames(css.fieldInput, css.childFieldInput)}
                  customOnChange={onCheckboxChange}
                />
              ))}
            </RenderWhen>
          </>
        );
      })}
      <Button
        type="submit"
        className={css.filterBtn}
        size="medium"
        inProgress={inProgress}
        disabled={submitDisabled}>
        Tải danh sách
      </Button>
    </Form>
  );
};

const DownloadColumnListForm: React.FC<TDownloadColumnListFormProps> = (
  props,
) => {
  return <FinalForm {...props} component={DownloadColumnListFormComponent} />;
};

export default DownloadColumnListForm;
