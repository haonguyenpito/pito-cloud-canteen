import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import type { TQueryFoodsParams } from '@apis/foodApi';
import { buildFoodFilterQuery } from '@pages/api/helpers/foodHelpers';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { getIntegrationSdk, handleError } from '@services/sdk';
import { denormalisedResponseEntities } from '@src/utils/data';
import { EImageVariants } from '@src/utils/enums';

// Integration API, because the Marketplace API cannot filter by creation date.
async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    if (req.method !== HttpMethod.GET)
      return res.status(400).json({ message: 'Bad request' });

    const {
      restaurantId,
      page = 1,
      perPage,
      filter,
    }: TQueryFoodsParams = JSON.parse(req.query.JSONParams as string);

    const response = await getIntegrationSdk().listings.query({
      ...buildFoodFilterQuery(restaurantId, filter),
      page,
      perPage,
      include: ['images'],
      'fields.image': [`variants.${EImageVariants.squareSmall2x}`],
    });

    return res.status(200).json({
      foods: denormalisedResponseEntities(response),
      pagination: response.data.meta,
    });
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
