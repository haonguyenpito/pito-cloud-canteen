import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { getDashboardData } from '@services/pccDashboard';
import adminChecker from '@services/permissionChecker/admin';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== HttpMethod.GET) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const data = await getDashboardData();

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('PCC Dashboard API error:', error);

    return res
      .status(500)
      .json({ message: error.message || 'Internal server error' });
  }
}

export default cookies(adminChecker(handler));
