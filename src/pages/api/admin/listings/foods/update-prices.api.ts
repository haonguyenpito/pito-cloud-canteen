import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { types as sdkTypes } from '@helpers/sdkLoader';
import { updateMenuAfterFoodUpdated } from '@pages/api/helpers/foodHelpers';
import cookies from '@services/cookie';
import adminChecker from '@services/permissionChecker/admin';
import { getIntegrationSdk, handleError } from '@services/sdk';

const { Money } = sdkTypes;

type TFoodPrice = { id: string; price: number };

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    if (req.method !== HttpMethod.PUT)
      return res.status(400).json({ message: 'Bad request' });

    const { foodPrices = [] } = req.body as { foodPrices: TFoodPrice[] };
    const isValid =
      foodPrices.length > 0 &&
      foodPrices.every(
        ({ id, price }) =>
          typeof id === 'string' && Number.isInteger(price) && price > 0,
      );
    if (!isValid) return res.status(400).json({ message: 'Invalid prices' });

    const integrationSdk = getIntegrationSdk();
    await Promise.all(
      foodPrices.map(({ id, price }) =>
        integrationSdk.listings.update({ id, price: new Money(price, 'VND') }),
      ),
    );

    // Sequential: each call fans out to every menu and draft plan of the food; running all at once floods Sharetribe.
    await foodPrices.reduce(
      (chain, { id }) => chain.then(() => updateMenuAfterFoodUpdated(id)),
      Promise.resolve() as Promise<unknown>,
    );

    return res.status(200).json({ updatedIds: foodPrices.map(({ id }) => id) });
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
