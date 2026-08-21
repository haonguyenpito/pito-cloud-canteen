import { getApi, putApi } from './configs';

export const checkUserExistedApi = ({
  email,
  id,
}: {
  email?: string;
  id?: string;
}) => getApi(`/users/check-user-existed/`, { email, id });

export const checkUsersExistedApi = ({ emails }: { emails?: string[] }) =>
  getApi(`/users/check-users-existed/`, { emails });

export const queryMyCompaniesApi = () => getApi('/users/my-companies');

export const disableWalkthroughApi = (userId: string) =>
  getApi(`/users/disable-walkthrough/${userId}`);

export const postSignUpApi = () => putApi(`/users/post-sign-up/`);

export type TAdminUpdateUserSpecialDemandParams = {
  userId: string;
  allergies: string[];
  nutritions: string[];
};

export const adminUpdateUserSpecialDemandApi = ({
  userId,
  ...rest
}: TAdminUpdateUserSpecialDemandParams) =>
  putApi(`/admin/users/${userId}/special-demand`, rest);
