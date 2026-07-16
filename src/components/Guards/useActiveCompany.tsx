import { isUserDisabled } from '@helpers/userDisabledHelper';
import { useAppSelector } from '@hooks/reduxHooks';
import { User } from '@utils/data';
import { ECompanyStates, EUserSystemPermission } from '@utils/enums';
import type { TUser } from '@utils/types';

const useActiveCompany = () => {
  const { userPermission, currentUser } = useAppSelector((state) => state.user);
  const { userState } = User(currentUser as unknown as TUser).getMetadata();

  const isInactiveCompany =
    userPermission === EUserSystemPermission.company &&
    userState === ECompanyStates.unactive;

  // Unlike the company activation lifecycle above, the account lock applies to
  // every role — partner, participant and company alike.
  const isDisabledUser = isUserDisabled(currentUser as unknown as TUser);

  return { isInactiveCompany, isDisabledUser };
};

export default useActiveCompany;
