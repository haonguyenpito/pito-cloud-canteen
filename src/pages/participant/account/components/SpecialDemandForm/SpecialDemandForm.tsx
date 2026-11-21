import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import { useIntl } from 'react-intl';
import isEqual from 'lodash/isEqual';

import Button from '@components/Button/Button';
import Form from '@components/Form/Form';
import FieldCheckbox from '@components/FormFields/FieldCheckbox/FieldCheckbox';
import { useAllergiesOptionsByLocale } from '@src/utils/options';

import css from './SpecialDemandForm.module.scss';

export type TSpecialDemandFormValues = {
  allergies: string[];
  nutritions: string[];
};

type TExtraProps = {
  nutritionOptions?: { key: string; label: string }[];
  inProgress: boolean;
  view: string;
  // The default layout fills a full page; callers embedding the form (e.g. in a
  // modal) pass these to drop the viewport-height floors.
  rootClassName?: string;
  formContainerClassName?: string;
};
type TSpecialDemandFormComponentProps =
  FormRenderProps<TSpecialDemandFormValues> & Partial<TExtraProps>;
type TSpecialDemandFormProps = FormProps<TSpecialDemandFormValues> &
  TExtraProps;

const SpecialDemandFormComponent: React.FC<TSpecialDemandFormComponentProps> = (
  props,
) => {
  const {
    handleSubmit,
    nutritionOptions = [],
    initialValues,
    values,
    invalid,
    submitting,
    inProgress,
    view,
    rootClassName,
    formContainerClassName,
  } = props;
  const intl = useIntl();
  const ALLERGIES_OPTIONS = useAllergiesOptionsByLocale();
  const isFormNotChanged = isEqual(initialValues, values);
  const disabledSubmit =
    isFormNotChanged || submitting || invalid || inProgress;

  return (
    <Form onSubmit={handleSubmit} className={rootClassName || css.root}>
      <div className={css.header}>
        {intl.formatMessage({
          id: 'ParticipantSpecialDemandRoute.description',
        })}
      </div>
      <div className={formContainerClassName || css.formContainer}>
        <div className={css.fieldsContainer}>
          <div className={css.fieldWrapper}>
            <div className={css.title}>
              {intl.formatMessage({ id: 'GroupDetail.columnLabel.allergy' })}
            </div>
            <div className={css.fieldGroup}>
              {ALLERGIES_OPTIONS.map(({ key, label }) => (
                <FieldCheckbox
                  key={key}
                  id={`${view}-allergies-${key}`}
                  name="allergies"
                  value={key}
                  label={label}
                  className={css.field}
                />
              ))}
            </div>
          </div>
          <div className={css.fieldWrapper}>
            <div className={css.title}>
              {intl.formatMessage({
                id: 'AdminAttributesSettingPage.attribute.nutritions',
              })}
            </div>
            <div className={css.fieldGroup}>
              {nutritionOptions.map(({ key, label }) => (
                <FieldCheckbox
                  key={key}
                  id={`${view}-nutritions-${key}`}
                  name="nutritions"
                  value={key}
                  label={label}
                  className={css.field}
                />
              ))}
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={disabledSubmit}
          inProgress={inProgress}
          className={css.submitBtn}>
          {intl.formatMessage({ id: 'AddOrderForm.moibleSubmitButtonText' })}
        </Button>
      </div>
    </Form>
  );
};

const SpecialDemandForm: React.FC<TSpecialDemandFormProps> = (props) => {
  return <FinalForm {...props} component={SpecialDemandFormComponent} />;
};

export default SpecialDemandForm;
