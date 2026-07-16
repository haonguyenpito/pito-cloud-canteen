import type { NextApiResponse } from 'next';

import { EHttpStatusCode } from '@apis/errors';
import { User } from '@utils/data';
import { ECompanyStates, EErrorCode } from '@utils/enums';
import type { TCompany, TCurrentUser, TUser } from '@utils/types';

type TAnyUser = TUser | TCurrentUser | TCompany | null | undefined;

/**
 * Sharetribe has no API to ban a user (Console only, and it deletes their
 * listings), so account locking lives entirely in the app layer as a
 * `metadata.isDisabled` flag. This module is the single source of truth for
 * reading it — both the API permission checkers and the client guards.
 */
export const isUserDisabled = (user: TAnyUser): boolean => {
  if (!user) return false;

  const { isDisabled = false } = User(user as TUser).getMetadata() || {};

  return isDisabled === true;
};

/**
 * A company account is also blocked while it sits in the `unactive` state —
 * that is the pre-existing activation lifecycle, kept separate from isDisabled.
 */
export const isBlockedAccount = (user: TAnyUser): boolean => {
  if (!user) return false;

  const { isCompany = false, userState } =
    User(user as TUser).getMetadata() || {};

  return (
    isUserDisabled(user) || (isCompany && userState === ECompanyStates.unactive)
  );
};

/**
 * Returns false and writes a 403 when the account is blocked. Callers must
 * return immediately when it returns false.
 */
export const assertAccountEnabled = (
  user: TAnyUser,
  res: NextApiResponse,
): boolean => {
  if (!isBlockedAccount(user)) return true;

  res.status(EHttpStatusCode.Forbidden).json({
    errorCode: EErrorCode.accountDisabled,
    message: 'Tài khoản của bạn đã bị khóa!',
  });

  return false;
};
