import type { NextApiRequest, NextApiResponse } from 'next';

import cookies from '@services/cookie';
import { denormalisedResponseEntities } from '@services/data';
import { fetchListing } from '@services/integrationHelper';
import { createNativeNotificationToPartner } from '@services/nativeNotification';
import { createFirebaseDocNotification } from '@services/notifications';
import adminChecker from '@services/permissionChecker/admin';
import { getIntegrationSdk, handleError } from '@services/sdk';
import { ENativeNotificationType, ENotificationType } from '@src/utils/enums';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { dataParams, queryParams = {} } = req.body;
    const newRestaurantName = dataParams.title;
    const restaurantId = dataParams.id;
    const integrationSdk = getIntegrationSdk();
    const response = await integrationSdk.listings.update(
      dataParams,
      queryParams,
    );
    if (dataParams.title && dataParams.id) {
      // sync restaurant name to restaurant owner
      const restaurantOwnerResponse = await integrationSdk.users.query({
        meta_restaurantListingId: restaurantId,
        meta_isPartner: true,
        perPage: 1,
      });
      const [restaurantOwner] = denormalisedResponseEntities(
        restaurantOwnerResponse,
      );
      const restaurantOwnerId = restaurantOwner?.id?.uuid;
      if (restaurantOwnerId) {
        await integrationSdk.users.updateProfile({
          id: restaurantOwnerId,
          displayName: newRestaurantName,
          lastName: newRestaurantName.split(' ')[0],
          firstName: newRestaurantName.split(' ').slice(1).join(' '),
        });
      }
    }

    const restaurant = await fetchListing(dataParams?.id, ['author']);
    createFirebaseDocNotification(
      ENotificationType.PARTNER_PROFILE_UPDATED_BY_ADMIN,
      {
        userId: restaurant?.author?.id.uuid,
        partnerName: dataParams.title,
      },
    );
    const author = restaurant?.author;
    const { title: partnerName } = restaurant.attributes || {};
    createNativeNotificationToPartner(
      ENativeNotificationType.AdminChangePartnerInformation,
      {
        partner: author,
        partnerName,
      },
    );
    res.json(response);
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(adminChecker(handler));
