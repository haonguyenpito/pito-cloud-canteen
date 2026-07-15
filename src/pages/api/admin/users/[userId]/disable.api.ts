import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { EHttpStatusCode } from '@apis/errors';
import toggleUserDisabled from '@pages/api/apiServices/user/toggleUserDisabled.service';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';
import { CurrentUser } from '@src/utils/data';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { userId } = req.query;
    const { isDisabled } = req.body;

    if (req.method !== HttpMethod.POST) {
      return res.status(EHttpStatusCode.MethodNotAllowed).json({
        message: 'Method not allowed',
      });
    }

    if (typeof isDisabled !== 'boolean') {
      return res.status(EHttpStatusCode.BadRequest).json({
        message: 'Missing or invalid `isDisabled`',
      });
    }

    const { currentUser } = req.previewData as any;

    const response = await toggleUserDisabled({
      userId: userId as string,
      isDisabled,
      adminId: CurrentUser(currentUser).getId(),
    });

    return res.status(EHttpStatusCode.Ok).json(response);
  } catch (error) {
    return handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
