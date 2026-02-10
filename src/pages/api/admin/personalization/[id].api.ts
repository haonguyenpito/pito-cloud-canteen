import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { getParticipantProfileById } from '@services/personalization';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== HttpMethod.GET) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    const profile = await getParticipantProfileById(id);

    if (!profile) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    return res.status(200).json(profile);
  } catch (error) {
    console.error('Personalization Participant API error:', error);

    return res.status(500).json({
      message: (error as Error).message || 'Internal server error',
    });
  }
}

export default cookies(adminChecker(handler));
