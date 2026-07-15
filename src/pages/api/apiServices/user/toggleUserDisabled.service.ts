import { CustomError, errorMessages } from '@apis/errors';
import { denormalisedResponseEntities } from '@services/data';
import { fetchUser, updateUserMetadata } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { CompanyPermissions } from '@src/types/UserPermission';
import { User } from '@src/utils/data';
import {
  EBookerOrderDraftStates,
  EOrderDraftStates,
  EOrderStates,
} from '@src/utils/enums';
import type { TObject } from '@src/utils/types';

const IN_PROGRESS_ORDER_STATES = [
  EBookerOrderDraftStates.bookerDraft,
  EOrderStates.inProgress,
  EOrderStates.picking,
  EOrderDraftStates.draft,
  EOrderDraftStates.pendingApproval,
].join(',');

/**
 * Locking a booker who still owns a live order would strand that order — the
 * same reason `deleteMemberFromCompanyFn` refuses to remove them.
 */
const assertNotBookerInOrderProgress = async (
  userId: string,
  metadata: TObject,
) => {
  const { company = {} } = metadata;
  const isBooker = Object.values(company).some((companyData: any) =>
    CompanyPermissions.includes(companyData?.permission),
  );

  if (!isBooker) return;

  const integrationSdk = getIntegrationSdk();
  const response = await integrationSdk.listings.query({
    meta_bookerId: userId,
    page: 1,
    perPage: 1,
    meta_orderState: IN_PROGRESS_ORDER_STATES,
  });

  if (denormalisedResponseEntities(response).length === 0) return;

  throw new CustomError(
    errorMessages.BOOKER_IN_ORDER_PROGRESS.message,
    errorMessages.BOOKER_IN_ORDER_PROGRESS.code,
    {
      errors: [
        {
          id: new Date().getTime(),
          status: errorMessages.BOOKER_IN_ORDER_PROGRESS.code,
          code: errorMessages.BOOKER_IN_ORDER_PROGRESS.id,
          title: errorMessages.BOOKER_IN_ORDER_PROGRESS.message,
        },
      ],
    },
  );
};

const toggleUserDisabled = async ({
  userId,
  isDisabled,
  adminId,
}: {
  userId: string;
  isDisabled: boolean;
  adminId: string;
}) => {
  const userAccount = await fetchUser(userId);

  if (!userAccount) {
    throw new CustomError(
      'Không tìm thấy người dùng',
      errorMessages.BAD_REQUEST.code,
    );
  }

  const metadata = User(userAccount).getMetadata();

  if (metadata.isAdmin) {
    throw new CustomError(
      'Không thể khóa tài khoản quản trị viên',
      errorMessages.BAD_REQUEST.code,
    );
  }

  if (isDisabled) {
    await assertNotBookerInOrderProgress(userId, metadata);
  }

  return updateUserMetadata(userId, {
    isDisabled,
    disabledAt: isDisabled ? new Date().getTime() : null,
    disabledBy: isDisabled ? adminId : null,
  });
};

export default toggleUserDisabled;
