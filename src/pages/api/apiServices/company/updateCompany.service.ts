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
    specificPCCFee,
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

    metadata: {
      ...(specificPCCFee &&
      specificPCCFee !== '' &&
      specificPCCFee !== null &&
      specificPCCFee !== undefined
        ? {
            specificPCCFee: Number(removeNonNumeric(specificPCCFee)),
            hasSpecificPCCFee: true,
          }
        : {}),
    },
  };

  const response = await integrationSdk.users.updateProfile(
    updateParams,
    queryParams,
  );

  return response;
};

export default updateCompany;
