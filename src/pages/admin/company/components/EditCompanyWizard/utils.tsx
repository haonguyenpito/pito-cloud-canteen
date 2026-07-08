import type { TObject } from '@utils/types';

import type { TEditCompanyBankAccountsFormValues } from '../EditCompanyBankAccountsForm/EditCompanyBankAccountsForm';
import type { TEditCompanyInformationFormValues } from '../EditCompanyInformationForm/EditCompanyInformationForm';
import type { TEditCompanyOtherSettingsFormValues } from '../EditCompanyOtherSettingsForm/EditCompanyOtherSettingsForm';
import type { TEditCompanySettingsInformationFormValues } from '../EditCompanySettingsInformationForm/EditCompanySettingsInformationForm';

export const COMPANY_INFORMATION_TAB = 'information';
export const COMPANY_SETTINGS_TAB = 'settings';

export const EDIT_COMPANY_WIZARD_TABS = [
  COMPANY_INFORMATION_TAB,
  COMPANY_SETTINGS_TAB,
];

export const COMPANY_SETTING_INFORMATION_TAB_ID = 'companySettingsInformation';
export const COMPANY_SETTING_PAYMENT_TAB_ID = 'companySettingsPayment';
export const COMPANY_SETTING_SUBSCRIPTION_TAB_ID =
  'companySettingsSubscription';
export const COMPANY_SETTING_OTHER_TAB_ID = 'companySettingsOther';

export const createSubmitCreateCompanyValues = (
  values: TEditCompanyInformationFormValues &
    TEditCompanySettingsInformationFormValues,
) => {
  const {
    firstName,
    lastName,
    companyName,
    companyEmail,
    companyLocation,
    email,
    password,
    phoneNumber,
    location,
    note,
    tax,
  } = values;

  return {
    firstName,
    lastName,
    companyName,
    companyEmail,
    companyLocation,
    email,
    password,
    phoneNumber,
    location,
    note,
    tax,
  };
};

export const createSubmitUpdateCompanyValues = (
  values: TEditCompanyInformationFormValues &
    TEditCompanySettingsInformationFormValues &
    TEditCompanyBankAccountsFormValues &
    TEditCompanyOtherSettingsFormValues,
  tab: string,
) => {
  switch (tab) {
    case COMPANY_INFORMATION_TAB: {
      const {
        firstName,
        lastName,
        companyEmail,
        companyLocation,
        companyName,
        phoneNumber,
        location,
        note,
        tax,
      } = values;

      return {
        firstName,
        lastName,
        companyEmail,
        companyLocation,
        companyName,
        phoneNumber,
        location,
        note,
        tax,
      };
    }
    case COMPANY_SETTINGS_TAB: {
      const {
        companyLogo = {},
        nutritions = [],
        tabValue,
        bankAccounts = [],
        paymentDueDays,
        specificPCCFee,
        specificPCCFeeTiers,
      } = values;

      switch (tabValue) {
        case COMPANY_SETTING_INFORMATION_TAB_ID: {
          const { imageId } = companyLogo || {};

          return {
            profileImageId: imageId?.uuid,
            nutritions,
          };
        }

        case COMPANY_SETTING_PAYMENT_TAB_ID: {
          return {
            bankAccounts,
            paymentDueDays,
          };
        }
        case COMPANY_SETTING_SUBSCRIPTION_TAB_ID: {
          return {};
        }
        case COMPANY_SETTING_OTHER_TAB_ID: {
          return { specificPCCFee, specificPCCFeeTiers };
        }
        default:
          return {};
      }
    }
    default:
      return {};
  }
};

export const createSubmitAddMembersToCompanyValues = (values: TObject) => {
  const { userIdList = [], noAccountEmailList = [] } = values;

  return {
    userIdList,
    noAccountEmailList,
  };
};
