import { type ReactNode, useEffect, useState } from 'react';
import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import Button from '@components/Button/Button';
import Form from '@components/Form/Form';
import FieldCheckbox from '@components/FormFields/FieldCheckbox/FieldCheckbox';
import FieldPasswordInput from '@components/FormFields/FieldPasswordInput/FieldPasswordInput';
import FieldSelect from '@components/FormFields/FieldSelect/FieldSelect';
import FieldTextInput from '@components/FormFields/FieldTextInput/FieldTextInput';
import { generalPaths } from '@src/paths';
import type { TDefaultProps } from '@utils/types';
import {
  composeValidators,
  composeValidatorsWithAllValues,
  emailFormatValid,
  passwordFormatValid,
  passwordMatchConfirmPassword,
  phoneNumberFormatValid,
  required,
} from '@utils/validators';

import css from './SignUpForm.module.scss';

export type TSignUpFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  gender: string;
  phoneNumber?: string;
  privacyAndPolicy: boolean;
};

type TExtraProps = TDefaultProps & {
  formId?: string;
  errorMessage?: ReactNode;
  inProgress?: boolean;
};
type TSignUpFormProps = FormProps<TSignUpFormValues> & Partial<TExtraProps>;
type TSignUpFormComponentProps = FormRenderProps<TSignUpFormValues> &
  TExtraProps;

const SignUpFormComponent: React.FC<TSignUpFormComponentProps> = (props) => {
  const intl = useIntl();
  const router = useRouter();
  const {
    inProgress,
    errorMessage,
    rootClassName,
    className,
    formId,
    handleSubmit,
    invalid,
    values: { privacyAndPolicy },
    initialValues,
  } = props;
  const classes = classNames(rootClassName || css.root, className);
  const haveAgreed = privacyAndPolicy === true;
  const submitDisable = !haveAgreed || invalid || inProgress;

  const [email, setEmail] = useState<string>(initialValues.email || '');

  const [isEmailEditable, setIsEmailEditable] = useState<boolean>(
    !initialValues.email,
  );

  useEffect(() => {
    setIsEmailEditable(!initialValues?.email);
  }, [initialValues?.email]);

  const formTitle = intl.formatMessage({
    id: 'SignUpForm.title',
  });

  const namePlaceholder = intl.formatMessage({
    id: 'SignUpForm.name.placeholder',
  });
  const nameLabel = intl.formatMessage({
    id: 'SignUpForm.name.label',
  });
  const emailPlaceholder = intl.formatMessage({
    id: 'SignUpForm.email.placeholder',
  });
  const emailLabel = intl.formatMessage({
    id: 'SignUpForm.email.label',
  });
  const passwordPlaceholder = intl.formatMessage({
    id: 'SignUpForm.password.placeholder',
  });
  const passwordLabel = intl.formatMessage({
    id: 'SignUpForm.password.label',
  });

  const confirmPasswordPlaceholder = intl.formatMessage({
    id: 'SignUpForm.confirmPassword.placeholder',
  });
  const confirmPasswordLabel = intl.formatMessage({
    id: 'SignUpForm.confirmPassword.label',
  });

  const phoneNumberPlaceholder = intl.formatMessage({
    id: 'SignUpForm.phoneNumber.placeholder',
  });
  const phoneNumberLabel = intl.formatMessage({
    id: 'SignUpForm.phoneNumber.label',
  });
  const genderPlaceholder = intl.formatMessage({
    id: 'SignUpForm.gender.placeholder',
  });
  const genderLabel = intl.formatMessage({
    id: 'SignUpForm.gender.label',
  });
  const genderMale = intl.formatMessage({
    id: 'SignUpForm.gender.male',
  });
  const genderFemale = intl.formatMessage({
    id: 'SignUpForm.gender.female',
  });

  const privacyPolicyPartA = intl.formatMessage({
    id: 'SignUpForm.privacyPolicy.partA',
  });
  const privacyPolicyPartB = intl.formatMessage({
    id: 'SignUpForm.privacyPolicy.partB',
  });

  const submitButtonText = intl.formatMessage({
    id: 'SignUpForm.submitButtonText',
  });

  const haveAnAccountText = intl.formatMessage({
    id: 'SignUpForm.haveAnAccount',
  });
  const toSignIn = intl.formatMessage({
    id: 'SignUpForm.toSignIn',
  });

  const nameValidators = composeValidators(
    required(intl.formatMessage({ id: 'SignUpForm.name.required' })),
  );
  const emailValidators = composeValidators(
    required(intl.formatMessage({ id: 'SignUpForm.email.required' })),
    emailFormatValid(intl.formatMessage({ id: 'SignUpForm.email.invalid' })),
  );
  const passwordValidators = composeValidators(
    required(intl.formatMessage({ id: 'SignUpForm.password.required' })),
    passwordFormatValid(
      intl.formatMessage({ id: 'SignUpForm.password.invalid' }),
    ),
  );
  const confirmPasswordValidators = composeValidatorsWithAllValues(
    required(intl.formatMessage({ id: 'SignUpForm.confirmPassword.required' })),
    passwordFormatValid(
      intl.formatMessage({ id: 'SignUpForm.confirmPassword.invalid' }),
    ),
    passwordMatchConfirmPassword(
      intl.formatMessage({
        id: 'SignUpForm.confirmPasswordMatchPassword.invalid',
      }),
    ),
  );
  const phoneNumberValidators = phoneNumberFormatValid(
    intl.formatMessage({ id: 'SignUpForm.phoneNumber.invalid' }),
  );
  const genderValidators = composeValidators(
    required(intl.formatMessage({ id: 'SignUpForm.gender.required' })),
  );

  const navigateToSignInPage = () => {
    router.push({ query: router.query, pathname: generalPaths.SignIn });
  };

  const handleUseDifferentEmail = () => {
    setEmail('');
    setIsEmailEditable(true);
  };

  return (
    <Form className={classes} onSubmit={handleSubmit}>
      <div className={css.formContainer}>
        <div className="">
          <div className={css.formTitle}>{formTitle}</div>
          <div className={css.haveAccountContainer}>
            <div>
              {haveAnAccountText}{' '}
              <span className={css.toSignIn} onClick={navigateToSignInPage}>
                {' '}
                {toSignIn}
              </span>
            </div>
          </div>
        </div>

        <FieldTextInput
          id={formId ? `${formId}.name` : 'name'}
          name="name"
          placeholder={namePlaceholder}
          validate={nameValidators}
          label={nameLabel}
          errorClass={css.errorClass}
        />

        <FieldSelect
          id={formId ? `${formId}.gender` : 'gender'}
          name="gender"
          label={genderLabel}
          placeholder={genderPlaceholder}
          validate={genderValidators}>
          <option value="" disabled hidden>
            {genderPlaceholder}
          </option>
          <option className="text-black" value="MALE">
            {genderMale}
          </option>
          <option className="text-black" value="FEMALE">
            {genderFemale}
          </option>
        </FieldSelect>

        <FieldTextInput
          id={formId ? `${formId}.email` : 'email'}
          name="email"
          placeholder={emailPlaceholder}
          validate={emailValidators}
          label={emailLabel}
          errorClass={css.errorClass}
          disabled={!isEmailEditable}
          initialValue={email}
        />

        {initialValues.email && !isEmailEditable && (
          <div className={css.invitationText}>
            Email này được mời bởi người tạo đơn nhóm.{' '}
            <span
              className={css.changeEmailLink}
              onClick={handleUseDifferentEmail}>
              Thay đổi email
            </span>
          </div>
        )}

        <FieldPasswordInput
          id={formId ? `${formId}.password` : 'password'}
          name="password"
          placeholder={passwordPlaceholder}
          validate={passwordValidators}
          label={passwordLabel}
          errorClass={css.errorClass}
        />

        <FieldPasswordInput
          id={formId ? `${formId}.confirmPassword` : 'confirmPassword'}
          name="confirmPassword"
          placeholder={confirmPasswordPlaceholder}
          validate={confirmPasswordValidators}
          label={confirmPasswordLabel}
          errorClass={css.errorClass}
        />

        <FieldTextInput
          id={formId ? `${formId}.phoneNumber` : 'phoneNumber'}
          name="phoneNumber"
          placeholder={phoneNumberPlaceholder}
          validate={phoneNumberValidators}
          label={phoneNumberLabel}
          errorClass={css.errorClass}
        />

        <div
          style={{
            marginTop: '-8px',
          }}>
          <FieldCheckbox
            id={formId ? `${formId}.privacyAndPolicy` : 'privacyAndPolicy'}
            name="privacyAndPolicy"
            label={
              <div className={css.policyText}>
                {privacyPolicyPartA}
                <a
                  href="https://pito.vn/cam-nang/dieu-khoan-chinh-sach/"
                  target="_blank"
                  rel="noreferrer"
                  className={css.privacyPolicyText}>
                  {privacyPolicyPartB}
                </a>
              </div>
            }
          />

          {errorMessage && (
            <div className={css.errorSignUp}>{errorMessage}</div>
          )}

          <Button
            variant="primary"
            inProgress={inProgress}
            className={css.submitButton}
            type="submit"
            disabled={submitDisable}>
            {submitButtonText}
          </Button>
        </div>
      </div>
    </Form>
  );
};

const SignUpForm: React.FC<TSignUpFormProps> = (props) => {
  return <FinalForm {...props} component={SignUpFormComponent} />;
};

export default SignUpForm;
