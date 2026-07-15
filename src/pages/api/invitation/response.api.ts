import isEmpty from 'lodash/isEmpty';
import type { NextApiRequest, NextApiResponse } from 'next';

import { EHttpStatusCode } from '@apis/errors';
import logger from '@helpers/logger';
import cookies from '@services/cookie';
import { fetchUserListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { createFirebaseDocNotification } from '@services/notifications';
import { getSdk, handleError } from '@services/sdk';
import type { UserListing, WithFlexSDKData } from '@src/types';
import { ECompanyPermission, ENotificationType } from '@src/utils/enums';

type InviteResponse = 'accept' | 'decline';
type InviteSource = 'invitation-link';
export interface POSTResponseBody {
  response?: InviteResponse;
  companyId: string;
  source?: InviteSource;
  type: 'check' | 'response';
}

export interface ResponseApiResponse {
  message: string;
  statusCode: EHttpStatusCode;
  nextAction?: 'keep' | 'redirect';
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApiResponse>,
) {
  const sdk = getSdk(req, res);
  const integrationSdk = getIntegrationSdk();
  try {
    const { companyId, source, response, type } = req.body as POSTResponseBody;

    const currentUser: WithFlexSDKData<UserListing> =
      await sdk.currentUser.show();

    const userEmail = currentUser.data.data.attributes?.email;
    const companyOfCurrentUser =
      currentUser.data.data.attributes?.profile?.metadata?.company;
    const companyListOfCurrentUser =
      currentUser.data.data.attributes?.profile?.metadata?.companyList;
    const userId = currentUser.data.data.id?.uuid;

    if (response === 'decline') {
      return res.status(EHttpStatusCode.BadRequest).json({
        statusCode: EHttpStatusCode.BadRequest,
        message: 'Từ chối tham gia công ty',
      });
    }

    if (currentUser.data.data.attributes?.profile?.metadata?.isPartner) {
      return res.status(EHttpStatusCode.BadRequest).json({
        statusCode: EHttpStatusCode.BadRequest,
        message: 'Tài khoản này là đối tác, không thể tham gia công ty',
      });
    }

    // A locked account must not be able to walk back into a company through an
    // invitation link. Guards both the `check` and the `response` branches.
    if (currentUser.data.data.attributes?.profile?.metadata?.isDisabled) {
      return res.status(EHttpStatusCode.Forbidden).json({
        statusCode: EHttpStatusCode.Forbidden,
        message: 'Tài khoản của bạn đã bị khóa!',
      });
    }

    const companyAccount = await fetchUserListing(companyId);

    if (!companyAccount) {
      return res.status(EHttpStatusCode.BadRequest).json({
        statusCode: EHttpStatusCode.BadRequest,
        message: 'Không tìm thấy công ty',
      });
    }

    if (!userEmail) {
      return res.status(EHttpStatusCode.BadRequest).json({
        statusCode: EHttpStatusCode.BadRequest,
        message: 'Không tìm thấy email người dùng',
      });
    }

    if (!userId) {
      return res.status(EHttpStatusCode.BadRequest).json({
        statusCode: EHttpStatusCode.BadRequest,
        message: 'Không tìm thấy id người dùng',
      });
    }

    const companyName =
      companyAccount?.attributes?.profile?.publicData?.companyName;
    const membersOfCompany =
      companyAccount?.attributes?.profile?.metadata?.members;
    let memberOfCompany = membersOfCompany?.[userEmail];

    if (source === 'invitation-link' && isEmpty(memberOfCompany)) {
      memberOfCompany = {
        email: userEmail,
        groups: [],
        id: userId,
        inviteStatus: 'accepted',
        permission: ECompanyPermission.participant,
      };
    }

    if (type === 'check') {
      if (companyListOfCurrentUser?.includes(companyId)) {
        const isUserABookerOrOwner =
          !!companyOfCurrentUser &&
          !!Object.values(companyOfCurrentUser).find(
            (companyOfCurrentUserData) =>
              companyOfCurrentUserData?.permission === 'booker' ||
              companyOfCurrentUserData?.permission === 'owner',
          );

        return res.status(EHttpStatusCode.Ok).json({
          statusCode: EHttpStatusCode.Ok,
          message: 'Người dùng đã tham gia công ty này',
          nextAction: isUserABookerOrOwner ? 'keep' : 'redirect',
        });
      }

      return res.status(EHttpStatusCode.Ok).json({
        statusCode: EHttpStatusCode.Ok,
        message: 'Có thể tham gia công ty',
      });
    }

    await integrationSdk.users.updateProfile({
      id: companyId,
      metadata: {
        members: {
          ...membersOfCompany,
          [userEmail]: {
            ...memberOfCompany,
            id: userId,
          },
        },
      },
    });

    if (!companyListOfCurrentUser?.includes(companyId)) {
      await integrationSdk.users.updateProfile({
        id: userId,
        metadata: {
          companyList: [...(companyListOfCurrentUser || []), companyId],
          company: {
            ...companyOfCurrentUser,
            [companyId]: {
              permission:
                memberOfCompany?.permission || ECompanyPermission.participant,
            },
          },
        },
      });
    }

    createFirebaseDocNotification(ENotificationType.COMPANY_JOINED, {
      userId,
      companyName,
    });

    return res.status(EHttpStatusCode.Ok).json({
      statusCode: EHttpStatusCode.Ok,
      message: 'Tham gia công ty thành công',
    });
  } catch (error) {
    logger.info('Error responseToInvitation', String(error));
    handleError(res, error);
  }
}

export default cookies(handler);
