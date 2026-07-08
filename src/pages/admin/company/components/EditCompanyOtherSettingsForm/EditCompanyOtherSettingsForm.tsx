import { useImperativeHandle } from 'react';
import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';

import Form from '@components/Form/Form';
import type { TPccFeeTier } from '@utils/types';

import { COMPANY_SETTING_OTHER_TAB_ID } from '../EditCompanyWizard/utils';

import FieldPccFeeTiers from './FieldPccFeeTiers';

export type TEditCompanyOtherSettingsFormValues = {
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
  const { handleSubmit, form, formRef } = props;
  useImperativeHandle(formRef, () => form);

  return (
    <Form onSubmit={handleSubmit}>
      <FieldPccFeeTiers
        id="EditCompanyOtherSettingsForm.specificPCCFeeTiers"
        name="specificPCCFeeTiers"
      />
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
