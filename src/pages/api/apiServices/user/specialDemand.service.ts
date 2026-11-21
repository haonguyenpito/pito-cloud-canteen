import { denormalisedResponseEntities } from '@services/data';
import getSystemAttributes from '@services/getSystemAttributes';
import { getIntegrationSdk } from '@services/sdk';
import { ALLERGIES_OPTIONS } from '@src/utils/options';
import type { TUser } from '@src/utils/types';

type TOptionKey = { key: string };

const pickValidKeys = (value: unknown, options: TOptionKey[]): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const validKeys = options.map((option) => option.key);

  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === 'string' && validKeys.includes(item),
      ),
    ),
  );
};

export const sanitizeSpecialDemand = (
  body: { allergies?: unknown; nutritions?: unknown },
  nutritionOptions: TOptionKey[],
) => ({
  allergies: pickValidKeys(body.allergies, ALLERGIES_OPTIONS),
  nutritions: pickValidKeys(body.nutritions, nutritionOptions),
});

export const updateUserSpecialDemand = async ({
  userId,
  allergies,
  nutritions,
}: {
  userId: string;
  allergies: unknown;
  nutritions: unknown;
}): Promise<TUser> => {
  const { nutritions: nutritionOptions = [] } = await getSystemAttributes();
  const sanitized = sanitizeSpecialDemand(
    { allergies, nutritions },
    nutritionOptions,
  );

  const integrationSdk = getIntegrationSdk();
  const response = await integrationSdk.users.updateProfile(
    {
      id: userId,
      publicData: sanitized,
    },
    { expand: true },
  );

  const [updatedUser] = denormalisedResponseEntities(response);

  return updatedUser;
};
