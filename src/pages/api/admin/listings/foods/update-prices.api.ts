import { mapLimit } from 'async';
import range from 'lodash/range';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import type { TFoodFilter, TUpdateFoodPricesBody } from '@apis/foodApi';
import { types as sdkTypes } from '@helpers/sdkLoader';
import {
  buildFoodFilterQuery,
  updateMenuAfterFoodsUpdated,
} from '@pages/api/helpers/foodHelpers';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { getIntegrationSdk, handleError } from '@services/sdk';

const { Money } = sdkTypes;

const MAX_CONCURRENT_PRICE_UPDATES = 10;

type TFoodPrice = { id: string; price: number };

const isValidPrice = (price: unknown) =>
  Number.isInteger(price) && (price as number) > 0;

// Same query as the admin food table, so "all filtered foods" is exactly what the admin sees.
const queryFilteredFoodIds = async (
  restaurantId: string,
  filter: TFoodFilter,
): Promise<string[]> => {
  const integrationSdk = getIntegrationSdk();
  const query = {
    ...buildFoodFilterQuery(restaurantId, filter),
    perPage: 100,
    'fields.listing': ['title'],
  };
  const firstPage = await integrationSdk.listings.query({ ...query, page: 1 });
  const { totalPages = 1 } = firstPage.data.meta;
  const otherPages = await Promise.all(
    range(2, totalPages + 1).map((page) =>
      integrationSdk.listings.query({ ...query, page }),
    ),
  );

  return [firstPage, ...otherPages].flatMap((response) =>
    response.data.data.map((listing: any) => listing.id.uuid),
  );
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    if (req.method !== HttpMethod.PUT)
      return res.status(400).json({ message: 'Bad request' });

    const body = req.body as TUpdateFoodPricesBody;
    let foodPrices: TFoodPrice[] = [];

    if ('filter' in body) {
      const { restaurantId, filter, price } = body;
      if (typeof restaurantId !== 'string' || !filter || !isValidPrice(price))
        return res.status(400).json({ message: 'Invalid prices' });

      const foodIds = await queryFilteredFoodIds(restaurantId, filter);
      foodPrices = foodIds.map((id) => ({ id, price }));
    } else {
      foodPrices = body.foodPrices || [];
      const isValid = foodPrices.every(
        ({ id, price }) => typeof id === 'string' && isValidPrice(price),
      );
      if (!isValid) return res.status(400).json({ message: 'Invalid prices' });
    }

    if (!foodPrices.length)
      return res.status(400).json({ message: 'No foods to update' });

    const integrationSdk = getIntegrationSdk();
    await mapLimit(
      foodPrices,
      MAX_CONCURRENT_PRICE_UPDATES,
      async ({ id, price }: TFoodPrice) =>
        integrationSdk.listings.update({ id, price: new Money(price, 'VND') }),
    );

    const updatedIds = foodPrices.map(({ id }) => id);
    // Not awaited: syncing menus and draft orders of many foods outlasts the gateway timeout.
    updateMenuAfterFoodsUpdated(updatedIds);

    return res.status(200).json({ updatedIds });
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
