import { DateTime } from 'luxon';
import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import { queryAllFoodIdList } from '@helpers/apiHelpers';
import { getMenuExtraFeeMap } from '@helpers/menuExtraFee';
import cookies from '@services/cookie';
import { fetchListing } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { handleError } from '@services/sdk';
import { denormalisedResponseEntities, Listing } from '@src/utils/data';
import { convertWeekDay, VNTimezone } from '@src/utils/dates';

/**
 * Lists the dishes a menu serves on one delivery date, with that menu's extra
 * fees so the client can price each dish as the company will be billed.
 * @param req - `GET` with `JSONParams` = `{ menuId, subOrderDate, nutritions? }`.
 * @param res - `{ foodList, foodExtraFees }`.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const apiMethod = req.method;
    const integrationSdk = getIntegrationSdk();

    switch (apiMethod) {
      case HttpMethod.GET: {
        const {
          menuId,
          subOrderDate,
          nutritions = [],
        } = JSON.parse(req.query.JSONParams as string);

        const dateTime = DateTime.fromMillis(+subOrderDate).setZone(VNTimezone);
        const dayOfWeek = convertWeekDay(dateTime.weekday).key;

        const menu = await fetchListing(menuId as string);
        const menuListing = Listing(menu);
        const foodIdList = menuListing.getMetadata()[`${dayOfWeek}FoodIdList`];
        const queryFood = queryAllFoodIdList(foodIdList, nutritions);
        const foodList = await integrationSdk.listings.query(queryFood);

        return res.status(200).json({
          foodList: denormalisedResponseEntities(foodList),
          foodExtraFees: getMenuExtraFeeMap(menu),
        });
      }

      default:
        break;
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(handler);
