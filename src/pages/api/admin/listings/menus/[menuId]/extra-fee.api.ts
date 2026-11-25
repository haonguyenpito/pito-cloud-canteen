import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import updateMenuExtraFees, {
  MenuExtraFeeError,
} from '@pages/api/apiServices/menu/updateMenuExtraFees.service';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';

/**
 * Replaces a menu's extra fees (admin only).
 * @param req - `PUT` with body `{ extraFees: { [foodId]: fee } }`.
 * @param res - The updated menu; 400 with `invalidFoodIds` for invalid fees,
 *   409 when the menu is already approved.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { menuId } = req.query;

    switch (req.method) {
      case HttpMethod.PUT: {
        const { extraFees = {} } = req.body || {};
        const response = await updateMenuExtraFees(menuId as string, extraFees);

        return res.status(200).json(response);
      }

      default:
        return res.status(405).json({ message: 'Method is not allowed' });
    }
  } catch (error) {
    if (error instanceof MenuExtraFeeError) {
      return res.status(error.status).json({
        message: error.message,
        invalidFoodIds: error.invalidFoodIds,
      });
    }

    console.error(error);
    handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
