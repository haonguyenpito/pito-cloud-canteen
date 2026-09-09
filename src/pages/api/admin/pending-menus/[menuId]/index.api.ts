import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { denormalisedResponseEntities } from '@services/data';
import {
  emailSendingFactory,
  EmailTemplateForPartnerTypes,
} from '@services/email';
import { getIntegrationSdk } from '@services/integrationSdk';
import { createNativeNotificationToPartner } from '@services/nativeNotification';
import { createFirebaseDocNotification } from '@services/notifications';
import adminChecker from '@services/permissionChecker/admin';
import { Listing } from '@src/utils/data';
import { buildFullNameFromProfile } from '@src/utils/emailTemplate/participantOrderPicking';
import {
  EListingStates,
  ENativeNotificationType,
  ENotificationType,
} from '@src/utils/enums';
import { FailedResponse, SuccessResponse } from '@src/utils/response';
import type { TListing } from '@src/utils/types';

type TMenuFoodEntry = {
  id: string;
  title: string;
  price?: number;
  sideDishes?: string[];
  foodNote?: string;
  foodType?: string;
};
type TFoodsByDate = Record<string, Record<string, TMenuFoodEntry>>;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiMethod = req.method;
  switch (apiMethod) {
    case HttpMethod.GET:
      try {
        const { menuId } = req.query;
        const sdk = getIntegrationSdk();
        const menuResponse = await sdk.listings.show({
          id: menuId as string,
          meta_listingState: EListingStates.pendingApproval,
          include: ['author'],
        });
        const [menu] = denormalisedResponseEntities(menuResponse);
        const foodsByDate: TFoodsByDate =
          menu.attributes?.publicData?.foodsByDate || {};
        const foodIds = Array.from(
          new Set(
            Object.values(foodsByDate).flatMap((foodByDate) =>
              Object.keys(foodByDate || {}),
            ),
          ),
        );

        const foodTypeById: Record<string, string> = {};
        if (foodIds.length > 0) {
          const foodsResponse = await sdk.listings.query({ ids: foodIds });
          const foods = denormalisedResponseEntities(
            foodsResponse,
          ) as TListing[];
          foods.forEach((food) => {
            const foodType = food.attributes?.publicData?.foodType;
            if (foodType) {
              foodTypeById[food.id.uuid] = foodType;
            }
          });
        }

        const enrichedFoodsByDate = Object.fromEntries(
          Object.entries(foodsByDate).map(([day, foodByDate]) => [
            day,
            Object.fromEntries(
              Object.entries(foodByDate || {}).map(([foodId, food]) => [
                foodId,
                { ...food, foodType: foodTypeById[foodId] },
              ]),
            ),
          ]),
        );

        const formattedMenu = {
          ...menu,
          restaurantName: buildFullNameFromProfile(
            menu.author?.attributes?.profile,
          ),
          attributes: {
            ...menu.attributes,
            publicData: {
              ...menu.attributes?.publicData,
              foodsByDate: enrichedFoodsByDate,
            },
          },
        };

        return new SuccessResponse({
          data: formattedMenu,
          message: 'Get pending menu successfully',
        }).send(res);
      } catch (error) {
        console.error(error);

        return new FailedResponse({
          message: 'Get pending menu failed',
        }).send(res);
      }
    case HttpMethod.PUT:
      try {
        const { menuId } = req.query;
        const { menuStatus, rejectedReason } = req.body as {
          menuStatus: EListingStates;
          rejectedReason?: string;
        };
        const sdk = getIntegrationSdk();
        const menuResponse = await sdk.listings.show({
          id: menuId as string,
          include: ['author'],
        });
        const [menu] = denormalisedResponseEntities(menuResponse);
        const menuMeta = Listing(menu).getMetadata();
        if (menuMeta?.listingState !== EListingStates.pendingApproval) {
          return new FailedResponse({
            message: 'Menu is not in pending approval state',
          }).send(res);
        }
        const menuStateHistory = menuMeta?.menuStateHistory || [];
        const menuName =
          menu?.attributes?.title || menu?.attributes?.name || 'Menu';
        const partner = menu?.author;
        const partnerName = buildFullNameFromProfile(
          partner?.attributes?.profile,
        );
        const menuLink = `${process.env.NEXT_PUBLIC_CANONICAL_URL}/partner/products/menu/${menuId}`;
        const updatedAt = new Date().getTime();
        await sdk.listings.update(
          {
            id: menuId as string,
            metadata: {
              listingState: menuStatus,
              menuStateHistory: [
                ...menuStateHistory,
                {
                  state: menuStatus,
                  ...(menuStatus === EListingStates.rejected && {
                    rejectedReason,
                  }),
                  updatedAt,
                },
              ],
            },
          },
          { expand: true },
        );
        const partnerEmail = partner?.attributes?.email;

        if (menuStatus === EListingStates.published) {
          await Promise.allSettled(
            [
              partnerEmail
                ? emailSendingFactory(
                    EmailTemplateForPartnerTypes.PARTNER_MENU_APPROVED,
                    {
                      partnerEmail,
                      partnerName,
                      menuName,
                      menuLink,
                    },
                  )
                : null,
              partner
                ? createNativeNotificationToPartner(
                    ENativeNotificationType.AdminApprovePartnerMenu,
                    {
                      partner,
                      partnerName,
                      menuId: menuId as string,
                      menuName,
                    },
                  )
                : null,
              partner?.id?.uuid
                ? createFirebaseDocNotification(
                    ENotificationType.PARTNER_MENU_APPROVED_BY_ADMIN,
                    {
                      userId: partner?.id?.uuid,
                      menuId: menuId as string,
                      menuName,
                    },
                  )
                : null,
            ].filter(Boolean) as Promise<any>[],
          );
        }
        if (menuStatus === EListingStates.rejected) {
          await Promise.allSettled(
            [
              partnerEmail
                ? emailSendingFactory(
                    EmailTemplateForPartnerTypes.PARTNER_MENU_REJECTED,
                    {
                      partnerEmail,
                      partnerName,
                      menuName,
                      menuLink,
                      rejectedReason,
                    },
                  )
                : null,
              partner
                ? createNativeNotificationToPartner(
                    ENativeNotificationType.AdminRejectPartnerMenu,
                    {
                      partner,
                      partnerName,
                      menuId: menuId as string,
                      menuName,
                      rejectedReason,
                    },
                  )
                : null,
              partner?.id?.uuid
                ? createFirebaseDocNotification(
                    ENotificationType.PARTNER_MENU_REJECTED_BY_ADMIN,
                    {
                      userId: partner?.id?.uuid,
                      menuId: menuId as string,
                      menuName,
                    },
                  )
                : null,
            ].filter(Boolean) as Promise<any>[],
          );
        }

        return new SuccessResponse({
          data: {
            id: menuId as string,
            status: menuStatus,
          },
          message: 'Update pending menu successfully',
        }).send(res);
      } catch (error) {
        console.error(error);

        return new FailedResponse({
          error: (error as Error).message,
          message: 'Update pending menu failed',
        }).send(res);
      }

    default:
      return new FailedResponse({
        message: 'Invalid method',
      }).send(res);
  }
};

export default cookies(adminChecker(handler));
