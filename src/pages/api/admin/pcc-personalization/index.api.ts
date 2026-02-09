import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { getPersonalizationData } from '@services/pccPersonalization';
import adminChecker from '@services/permissionChecker/admin';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== HttpMethod.GET) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { top, company, search, page } = req.query;

    const data = await getPersonalizationData({
      top: top ? parseInt(top as string, 10) : 50,
      company: (company as string) || undefined,
      search: (search as string) || undefined,
      page: page ? parseInt(page as string, 10) : 0,
    });

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('PCC Personalization API error:', error);

    return res
      .status(500)
      .json({ message: error.message || 'Internal server error' });
  }
}

export default cookies(adminChecker(handler));
