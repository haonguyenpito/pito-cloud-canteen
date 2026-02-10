import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { getOrderItems } from '@services/personalization';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== HttpMethod.GET) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { page, company, search, hitsPerPage } = req.query;

    const data = await getOrderItems({
      page: page ? parseInt(page as string, 10) : 0,
      hitsPerPage: hitsPerPage ? parseInt(hitsPerPage as string, 10) : 50,
      company: (company as string) || undefined,
      search: (search as string) || undefined,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('Personalization Order Items API error:', error);

    return res.status(500).json({
      message: (error as Error).message || 'Internal server error',
    });
  }
}

export default cookies(adminChecker(handler));
