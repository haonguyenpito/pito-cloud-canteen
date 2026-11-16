import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import {
  updateMenuAfterFoodDeleted,
  updateMenuAfterFoodsUpdated,
} from '@pages/api/helpers/foodHelpers';
import cookies from '@services/cookie';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import partnerChecker from '@services/permissionChecker/partner';
import { handleError } from '@services/sdk';
import { denormalisedResponseEntities } from '@src/utils/data';
import { EImageVariants } from '@src/utils/enums';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;
    const integrationSdk = getIntegrationSdk();
    const { foodId } = req.query;
    switch (apiMethod) {
      case HttpMethod.GET: {
        const food = await fetchListing(
          foodId as string,
          ['images'],
          [`variants.${EImageVariants.squareSmall2x}`],
        );

        return res.status(200).json(food);
      }
      case HttpMethod.PUT: {
        const { dataParams = {}, queryParams = {} } = req.body;
        const response = await integrationSdk.listings.update(
          dataParams,
          queryParams,
        );

        updateMenuAfterFoodsUpdated([foodId as string]);

        return res.status(200).json(denormalisedResponseEntities(response)[0]);
      }
      case HttpMethod.DELETE: {
        const response = await integrationSdk.listings.update({
          id: foodId,
          metadata: {
            isDeleted: true,
          },
        });

        updateMenuAfterFoodDeleted(foodId as string);

        return res.status(200).json(response);
      }

      default:
        break;
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(partnerChecker(handler));
