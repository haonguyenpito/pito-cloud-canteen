import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/sdk';
import { User } from '@src/utils/data';

export type TBookerQuizData = {
  packagePerMember?: number;
  memberAmount?: number;
  daySession?: string;
  deliveryHour?: string;
  mealStyles?: string[];
  nutritions?: string[];
  mealType?: string[];
};

// Derived from TBookerQuizData so a new field can't be added to the type
// without also being added to the merge allowlist.
const QUIZ_DATA_FIELDS: (keyof TBookerQuizData)[] = [
  'packagePerMember',
  'memberAmount',
  'daySession',
  'deliveryHour',
  'mealStyles',
  'nutritions',
  'mealType',
];

export const mergeQuizData = (
  current: TBookerQuizData,
  patch: TBookerQuizData,
): TBookerQuizData =>
  QUIZ_DATA_FIELDS.reduce<TBookerQuizData>(
    (result, field) =>
      patch[field] === undefined
        ? result
        : { ...result, [field]: patch[field] },
    { ...current },
  );

const showUser = async (userId: string) => {
  const integrationSdk = getIntegrationSdk();
  const response = await integrationSdk.users.show({ id: userId });
  const [user] = denormalisedResponseEntities(response);

  return user;
};

export const getUserQuizData = async (
  userId: string,
): Promise<TBookerQuizData> => {
  const user = await showUser(userId);
  const { quizData = {} } = User(user).getPrivateData();

  return quizData;
};

export const updateUserQuizData = async ({
  userId,
  patch,
}: {
  userId: string;
  patch: TBookerQuizData;
}): Promise<TBookerQuizData> => {
  const currentQuizData = await getUserQuizData(userId);
  const quizData = mergeQuizData(currentQuizData, patch);

  const integrationSdk = getIntegrationSdk();
  await integrationSdk.users.updateProfile({
    id: userId,
    privateData: { quizData },
  });

  return quizData;
};
