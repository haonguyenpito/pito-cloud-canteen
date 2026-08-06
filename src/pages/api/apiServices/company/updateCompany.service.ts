import { removeNonNumeric } from '@helpers/format';
import { getIntegrationSdk } from '@services/integrationSdk';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import type { TObject, TUpdateCompanyApiParams } from '@src/utils/types';

const updateCompany = async (
  dataParams: TUpdateCompanyApiParams,
  queryParams: TObject,
) => {
  const integrationSdk = getIntegrationSdk();
  const {
    id,
    firstName,
    lastName,
    companyEmail,
    companyLocation,
    companyName,
    phoneNumber,
    location,
    note,
    tax,
    profileImageId,
    nutritions,
    bankAccounts,
    paymentDueDays,
    hasSpecificPCCFee,
    specificPCCFeeTiers,
  } = dataParams;

  const { selectedPlace } = location || {};

  const address = selectedPlace?.address;
  const origin = selectedPlace?.origin || {};

  const { selectedPlace: companySelectedPlace } = companyLocation || {};
  const companyAddress = companySelectedPlace?.address;
  const companyOrigin = companySelectedPlace?.origin || {};
  const updateParams = {
    id,
    ...(profileImageId ? { profileImageId } : {}),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(firstName || lastName
      ? {
          displayName: buildFullName(firstName, lastName),
        }
      : {}),
    publicData: {
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(companyEmail ? { companyEmail } : {}),
      ...(companyName ? { companyName } : {}),
      ...(note ? { note } : {}),
      ...(nutritions ? { nutritions } : {}),
      ...(location
        ? {
            location: {
              address,
              origin: {
                lat: origin.lat,
                lng: origin.lng,
              },
            },
          }
        : {}),
      ...(companyLocation
        ? {
            companyLocation: {
              address: companyAddress,
              origin: {
                lat: companyOrigin.lat,
                lng: companyOrigin.lng,
              },
            },
          }
        : {}),
    },

    privateData: {
      ...(tax ? { tax } : {}),
      ...(bankAccounts ? { bankAccounts } : {}),
      ...(paymentDueDays ? { paymentDueDays } : {}),
    },

    // hasSpecificPCCFee is only present in dataParams when the "Other
    // Settings" tab was the one submitted (see createSubmitUpdateCompanyValues,
    // COMPANY_SETTING_OTHER_TAB_ID case). It is `undefined` — not `false` —
    // when any other tab (info, payment, subscription) is saved, so this must
    // stay a three-way check: leave PCC fee metadata untouched when the field
    // wasn't submitted at all, otherwise honor the admin's explicit true/false
    // choice (true = custom tiers, false = revert to the default schedule).
    metadata:
      hasSpecificPCCFee === undefined
        ? {}
        : hasSpecificPCCFee
        ? {
            hasSpecificPCCFee: true,
            specificPCCFeeTiers: (specificPCCFeeTiers ?? []).map(
              (tier, idx, arr) => ({
                maxQuantity:
                  idx === arr.length - 1
                    ? null
                    : Number(removeNonNumeric(String(tier.maxQuantity ?? ''))),
                price: Number(removeNonNumeric(String(tier.price ?? ''))),
              }),
            ),
            specificPCCFee: null,
          }
        : {
            hasSpecificPCCFee: false,
            specificPCCFeeTiers: null,
            specificPCCFee: null,
          },
  };

  const response = await integrationSdk.users.updateProfile(
    updateParams,
    queryParams,
  );

  return response;
};

export default updateCompany;
