import { isUserDisabled } from '@helpers/userDisabledHelper';
import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/sdk';
import { User } from '@src/utils/data';
import { EImageVariants, EMemberAccountStatus } from '@src/utils/enums';
import type { TUser } from '@src/utils/types';

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

  // Invited-but-never-registered members live only in the company metadata —
  // there is no Sharetribe user to query for them.
  if (status === EMemberAccountStatus.noAccount) {
    return nonExistedUsers;
  }

  const existedUserQueryResponse = await integrationSdk.users.query({
    meta_companyList: companyId,
    // `meta_isDisabled: true` is a real server-side filter. The negative case
    // is not: a meta_ filter only matches users that actually have the key, and
    // members who were never locked have no `isDisabled` at all — querying
    // `meta_isDisabled: false` would silently drop them. So `active` is
    // computed as the complement below.
    ...(status === EMemberAccountStatus.disabled
      ? { meta_isDisabled: true }
      : {}),
    include: 'profileImage',
    'fields.image': [
      `variants.${EImageVariants.squareSmall}`,
      `variants.${EImageVariants.squareSmall2x}`,
      `variants.${EImageVariants.scaledLarge}`,
    ],
  });

  const existedUsers = denormalisedResponseEntities(existedUserQueryResponse);

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
  return status === EMemberAccountStatus.all
    ? [...membersWithDetails, ...nonExistedUsers]
    : membersWithDetails;
};

export default queryCompanyMembers;
