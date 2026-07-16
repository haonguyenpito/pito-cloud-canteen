// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';

import queryCompanyMembers from '@pages/api/apiServices/company/queryCompanyMembers.service';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';
import { EMemberAccountStatus } from '@src/utils/enums';

const parseStatus = (status: unknown): EMemberAccountStatus =>
  Object.values(EMemberAccountStatus).includes(status as EMemberAccountStatus)
    ? (status as EMemberAccountStatus)
    : EMemberAccountStatus.all;

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { companyId, status } = req.query;
    const members = await queryCompanyMembers(
      companyId as string,
      parseStatus(status),
    );

    return res.json(members);
  } catch (error) {
    return handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
