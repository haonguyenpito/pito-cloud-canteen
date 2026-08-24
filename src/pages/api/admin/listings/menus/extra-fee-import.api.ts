import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import importMenuExtraFees from '@pages/api/apiServices/menu/importMenuExtraFees.service';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    switch (req.method) {
      case HttpMethod.POST: {
        const { rows = [], dryRun = false } = req.body || {};

        if (!Array.isArray(rows)) {
          return res.status(400).json({ message: 'rows must be an array' });
        }

        // `dryRun` powers the preview: rows are matched and reported without
        // anything being written, so bad names surface before any fee changes.
        const results = await importMenuExtraFees(rows, { dryRun });

        return res.status(200).json({ results });
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
