import { updateUserSpecialDemand } from '@apiServices/user/specialDemand.service';
import type { NextApiRequest, NextApiResponse } from 'next';

import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    console.log('[API-REQUEST]: special-demand.api.ts');

    if (req.method !== 'PUT') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { userId } = req.query;
    const { allergies, nutritions } = req.body;

    const updatedUser = await updateUserSpecialDemand({
      userId: userId as string,
      allergies,
      nutritions,
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('[API-ERROR]: special-demand.api.ts', error);

    return handleError(res, error);
  }
};

export default cookies(adminChecker(handler));
