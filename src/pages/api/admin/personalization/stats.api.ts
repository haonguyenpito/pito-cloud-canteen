import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { getAlgoliaStats } from '@services/personalization';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== HttpMethod.GET) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const stats = await getAlgoliaStats();

    return res.status(200).json(stats);
  } catch (error: any) {
    console.error('Personalization Stats API error:', error);

    return res
      .status(500)
      .json({ message: error.message || 'Internal server error' });
  }
}

export default cookies(adminChecker(handler));
