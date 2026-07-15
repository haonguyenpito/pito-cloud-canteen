import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import publishCompany from '@pages/api/apiServices/company/publishCompany.service';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { companyId } = req.query;
    const { queryParams = {} } = req.body;
    const apiMethod = req.method;

    switch (apiMethod) {
      case HttpMethod.GET:
        break;
      case HttpMethod.POST: {
        const response = await publishCompany(companyId as string, queryParams);

        return res.status(200).json(response);
      }
      case HttpMethod.DELETE:
        break;
      case HttpMethod.PUT:
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
