import { useImperativeHandle } from 'react';
import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import { useIntl } from 'react-intl';
import arrayMutators from 'final-form-arrays';

import Form from '@components/Form/Form';
import FieldCheckbox from '@components/FormFields/FieldCheckbox/FieldCheckbox';
import type { TPccFeeTier } from '@utils/types';

import { COMPANY_SETTING_OTHER_TAB_ID } from '../EditCompanyWizard/utils';

import FieldPccFeeTiers from './FieldPccFeeTiers';

export type TEditCompanyOtherSettingsFormValues = {
  hasSpecificPCCFee?: boolean;
  specificPCCFee?: any;
  specificPCCFeeTiers?: TPccFeeTier[];
  tabValue?: string;
};

type TExtraProps = {
  formRef: any;
};
type TEditCompanyOtherSettingsFormComponentProps =
  FormRenderProps<TEditCompanyOtherSettingsFormValues> & Partial<TExtraProps>;
type TEditCompanyOtherSettingsFormProps =
  FormProps<TEditCompanyOtherSettingsFormValues> & TExtraProps;

const EditCompanyOtherSettingsFormComponent: React.FC<
  TEditCompanyOtherSettingsFormComponentProps
> = (props) => {
  const { handleSubmit, form, formRef, values } = props;
  const intl = useIntl();
  useImperativeHandle(formRef, () => form);

  const handleHasSpecificPCCFeeChange = (event: any) => {
    const { checked } = event.target;
    form.change('hasSpecificPCCFee', checked);
    if (checked && !values.specificPCCFeeTiers?.length) {
      (form.mutators as any).push('specificPCCFeeTiers', {
        maxQuantity: '',
        price: '',
      });
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <FieldCheckbox
        id="EditCompanyOtherSettingsForm.hasSpecificPCCFee"
        name="hasSpecificPCCFee"
        label={intl.formatMessage({
          id: 'EditCompanyOtherSettingsForm.hasSpecificPCCFee.label',
        })}
        customOnChange={handleHasSpecificPCCFeeChange}
      />
      {values.hasSpecificPCCFee && (
        <FieldPccFeeTiers
          id="EditCompanyOtherSettingsForm.specificPCCFeeTiers"
          name="specificPCCFeeTiers"
        />
      )}
    </Form>
  );
};

const EditCompanyOtherSettingsForm: React.FC<
  TEditCompanyOtherSettingsFormProps
> = (props) => {
  return (
    <FinalForm
      mutators={{ ...arrayMutators }}
      {...props}
      initialValues={{
        ...props.initialValues,
        tabValue: COMPANY_SETTING_OTHER_TAB_ID,
      }}
      component={EditCompanyOtherSettingsFormComponent}
    />
  );
};

export default EditCompanyOtherSettingsForm;
