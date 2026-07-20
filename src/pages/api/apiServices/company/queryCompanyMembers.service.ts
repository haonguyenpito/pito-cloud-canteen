import { queryAllUsers } from '@helpers/apiHelpers';
import { isUserDisabled } from '@helpers/userDisabledHelper';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/sdk';
import { User } from '@src/utils/data';
import { EImageVariants, EMemberAccountStatus } from '@src/utils/enums';
import type { TUser } from '@src/utils/types';

const sortByEmail = <T extends { email?: string }>(list: T[]) =>
  [...list].sort((a, b) => (a.email || '').localeCompare(b.email || ''));

const queryCompanyMembers = async (
  companyId: string,
  status: EMemberAccountStatus = EMemberAccountStatus.all,
) => {
  const integrationSdk = getIntegrationSdk();
  const response = await integrationSdk.users.show({
    id: companyId,
  });

  const [company] = denormalisedResponseEntities(response);
  const { members = {} } = User(company).getMetadata();

  const nonExistedUsers = Object.keys(members)
    .filter((key: string) => !members[key].id)
    .map((key: string) => members[key]);

  if (status === EMemberAccountStatus.noAccount) {
    return sortByEmail(nonExistedUsers);
  }

  const existedUsers = await queryAllUsers({
    query: {
      meta_companyList: companyId,
      ...(status === EMemberAccountStatus.disabled
        ? { meta_isDisabled: true }
        : {}),
      'fields.image': [
        `variants.${EImageVariants.squareSmall}`,
        `variants.${EImageVariants.squareSmall2x}`,
        `variants.${EImageVariants.scaledLarge}`,
      ],
    },
    include: ['profileImage'],
  });

  const filteredUsers =
    status === EMemberAccountStatus.active
      ? existedUsers.filter((user: TUser) => !isUserDisabled(user))
      : existedUsers;

  const membersWithDetails = filteredUsers.map((user: TUser) => {
    const key = Object.keys(members).find(
      (email) => email === user.attributes.email,
    );

    return { ...user, ...(key ? { ...members[key] } : {}) };
  });

  // `active` and `disabled` are both account states, so a member without an
  // account belongs to neither result.
  const result =
    status === EMemberAccountStatus.all
      ? [...membersWithDetails, ...nonExistedUsers]
      : membersWithDetails;

  return sortByEmail(result);
};

export default queryCompanyMembers;
