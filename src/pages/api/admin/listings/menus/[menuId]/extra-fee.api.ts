import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import updateMenuExtraFees from '@pages/api/apiServices/menu/updateMenuExtraFees.service';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { menuId } = req.query;

    switch (req.method) {
      case HttpMethod.PUT: {
        const { extraFees = {}, mode = 'replace' } = req.body || {};

        const response = await updateMenuExtraFees(menuId as string, {
          extraFees,
          mode,
        });

        return res.status(200).json(response);
      }

      default:
        return res.status(405).json({ message: 'Method is not allowed' });
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
