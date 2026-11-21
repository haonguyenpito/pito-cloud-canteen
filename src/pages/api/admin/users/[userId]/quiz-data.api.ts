import type { TBookerQuizData } from '@apiServices/user/quizData.service';
import {
  getUserQuizData,
  updateUserQuizData,
} from '@apiServices/user/quizData.service';
import type { NextApiRequest, NextApiResponse } from 'next';

import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { handleError } from '@services/sdk';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { userId } = req.query;

    switch (req.method) {
      case 'GET': {
        const quizData = await getUserQuizData(userId as string);

        return res.status(200).json({ quizData });
      }
      case 'PUT': {
        const patch: TBookerQuizData = req.body || {};
        const quizData = await updateUserQuizData({
          userId: userId as string,
          patch,
        });

        return res.status(200).json({ quizData });
      }
      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[API-ERROR]: quiz-data.api.ts', error);

    return handleError(res, error);
  }
};

export default cookies(adminChecker(handler));
