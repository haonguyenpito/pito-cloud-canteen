import { denormalisedResponseEntities } from '@services/data';
import { getIntegrationSdk } from '@services/sdk';
import { User } from '@src/utils/data';
import type { TObject } from '@src/utils/types';

// Only these fields belong to quizData; any other body key is dropped so it
// can never spill into unrelated privateData (e.g. hasOrderBefore).
const QUIZ_DATA_FIELDS = [
  'packagePerMember',
  'memberAmount',
  'daySession',
  'deliveryHour',
  'mealStyles',
  'nutritions',
  'mealType',
] as const;

export const mergeQuizData = (current: TObject, patch: TObject): TObject =>
  QUIZ_DATA_FIELDS.reduce<TObject>(
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

export const getUserQuizData = async (userId: string): Promise<TObject> => {
  const user = await showUser(userId);
  const { quizData = {} } = User(user).getPrivateData();

  return quizData;
};

export const updateUserQuizData = async ({
  userId,
  patch,
}: {
  userId: string;
  patch: TObject;
}): Promise<TObject> => {
  const currentQuizData = await getUserQuizData(userId);
  const quizData = mergeQuizData(currentQuizData, patch);

  const integrationSdk = getIntegrationSdk();
  await integrationSdk.users.updateProfile({
    id: userId,
    privateData: { quizData },
  });

  return quizData;
};
