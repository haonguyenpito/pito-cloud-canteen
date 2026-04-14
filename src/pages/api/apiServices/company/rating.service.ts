import round from 'lodash/round';
import uniq from 'lodash/uniq';

import { isHiddenReviewUser } from '@helpers/review/visibility';
import { denormalisedResponseEntities } from '@services/data';
import { fetchListing } from '@services/integrationHelper';
import { createFirebaseDocNotification } from '@services/notifications';
import { getIntegrationSdk } from '@services/sdk';
import { createSlackNotification } from '@services/slackNotification';
import { Listing, User } from '@src/utils/data';
import {
  ECompanyPermission,
  EListingStates,
  EListingType,
  ENotificationType,
  EOrderStates,
  ESlackNotificationType,
} from '@src/utils/enums';
import type { TRestaurantRating } from '@src/utils/types';

export const postRatingFn = async ({
  companyName,
  ratings,
  generalRating,
  detailTextRating,
  imageUrlList,
  ratingUserName,
  orderCode,
  orderId,
}: {
  companyName: string;
  ratings: TRestaurantRating[];
  generalRating: number;
  detailTextRating: string;
  imageUrlList: string[];
  ratingUserName: string;
  orderCode: string;
  orderId: string;
}) => {
  const integrationSdk = getIntegrationSdk();

  const restaurantNames: string[] = [];

  await Promise.all(
    ratings.map(async (rating: any) => {
      const { restaurantId, ...rest } = rating;
      const { orderId: rOrderId, timestamp, reviewerId } = rest;
      const restaurantListing = await fetchListing(restaurantId, ['author']);
      const listingAuthorUser = User(restaurantListing.author);
      const authorId = listingAuthorUser.getId();
      const response = await integrationSdk.listings.create({
        title: `Review for ${restaurantListing.attributes.title} - ${rOrderId} - ${timestamp}`,
        authorId,
        state: EListingStates.published,
        metadata: {
          ...rating,
          listingType: EListingType.rating,
          reviewRole: ECompanyPermission.booker,
        },
      });

      restaurantNames.push(restaurantListing.attributes.title);

      createFirebaseDocNotification(
        ENotificationType.SUB_ORDER_REVIEWED_BY_BOOKER,
        {
          userId: authorId,
          orderId: rOrderId,
          subOrderDate: timestamp,
          companyName,
          reviewerId,
        },
      );

      return denormalisedResponseEntities(response)[0];
    }),
  );

  createSlackNotification(ESlackNotificationType.PARTICIPANT_RATING, {
    participantRatingData: {
      ratingScore: generalRating,
      content: detailTextRating,
      images: imageUrlList,
      partnerName: uniq(restaurantNames).join(', '),
      ratingUserName,
      ratingUserType: 'booker',
      orderCode,
      companyName,
      orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderId}`,
    },
  });
};

export const postParticipantRatingFn = async ({
  companyName,
  companyId,
  rating,
  detailTextRating,
  imageIdList,
  foodName,
  foodId,
  imageUrlList,
  orderCode,
  ratingUserName,
  secondaryFoodName,
  secondaryFoodId,
}: {
  companyName: string;
  companyId: string;
  rating: any;
  detailTextRating: string;
  imageIdList: string[];
  foodName: string;
  foodId: string;
  imageUrlList: string[];
  orderCode: string;
  ratingUserName: string;
  secondaryFoodName?: string;
  secondaryFoodId?: string;
}) => {
  const integrationSdk = getIntegrationSdk();
  const { restaurantId, ...rest } = rating;
  const { orderId, timestamp, reviewerId, generalRating } = rest;
  const shouldNotifyPartnerChannels = !isHiddenReviewUser(reviewerId);
  const restaurantListing = await fetchListing(restaurantId, ['author']);

  const listingAuthorUser = User(restaurantListing.author);
  const authorId = listingAuthorUser.getId();
  const response = await integrationSdk.listings.create({
    title: `Review for ${restaurantListing.attributes.title} - ${orderId} - ${timestamp}`,
    authorId,
    state: EListingStates.published,
    images: imageIdList,
    metadata: {
      ...rating,
      timestamp: +timestamp,
      detailTextRating,
      listingType: EListingType.rating,
      reviewRole: ECompanyPermission.participant,
      companyId,
      orderCode,
      foodName,
      foodId,
      generalRatingValue: [generalRating.toString()],
      ...(secondaryFoodName && { secondaryFoodName }),
      ...(secondaryFoodId && { secondaryFoodId }),
    },
  });

  createSlackNotification(ESlackNotificationType.PARTICIPANT_RATING, {
    participantRatingData: {
      ratingId: response.data.data.id.uuid,
      ratingScore: generalRating,
      content: detailTextRating,
      images: imageUrlList,
      partnerName: restaurantListing.attributes.title,
      ratingUserName,
      ratingUserType: 'participant',
      orderCode,
      companyName,
      orderLink: `${process.env.NEXT_PUBLIC_CANONICAL_URL}/admin/order/${orderId}`,
      subDate: timestamp,
    },
  });

  if (shouldNotifyPartnerChannels) {
    createFirebaseDocNotification(
      ENotificationType.SUB_ORDER_REVIEWED_BY_PARTICIPANT,
      {
        userId: authorId,
        orderId,
        subOrderDate: timestamp,
        companyName,
        reviewerId,
      },
    );
  }

  return denormalisedResponseEntities(response)[0];
};

export const updateRatingForRestaurantFn = async (ratings: any) => {
  const integrationSdk = getIntegrationSdk();
  const pointOfRatings = ratings.reduce((result: any, rating: any) => {
    const { restaurantId, generalRating, detailRating } = rating;
    if (result?.[restaurantId]) {
      return {
        ...result,
        [restaurantId]: {
          general: result[restaurantId].general + generalRating,
          detail: {
            food: result[restaurantId].detail.food + detailRating.food.rating,
            packaging:
              result[restaurantId].detail.packaging +
              detailRating.packaging.rating,
          },
          totalNumber: result[restaurantId].totalNumber + 1,
        },
      };
    }

    return {
      ...result,
      [restaurantId]: {
        general: generalRating,
        detail: {
          food: detailRating.food.rating,
          packaging: detailRating.packaging.rating,
        },
        totalNumber: 1,
      },
    };
  }, {});

  const restaurantIdList: string[] = uniq(
    ratings.map((rating: any) => rating.restaurantId),
  );
  await Promise.all(
    restaurantIdList.map(async (restaurantId: string) => {
      const restaurant = await fetchListing(restaurantId);
      const restaurantListing = Listing(restaurant);
      const {
        totalRating = 0,
        totalRatingNumber = 0,
        detailRating,
      } = restaurantListing.getMetadata();
      const newTotalRatingNumber =
        totalRatingNumber + pointOfRatings[restaurantId].totalNumber;
      const newTotalRating = round(
        (totalRating * totalRatingNumber +
          pointOfRatings[restaurantId].general) /
          newTotalRatingNumber,
        1,
      );
      const newDetailRating = {
        food: round(
          ((detailRating?.food || 0) * totalRatingNumber +
            pointOfRatings[restaurantId].detail.food) /
            newTotalRatingNumber,
          1,
        ),
        packaging: round(
          ((detailRating?.packaging || 0) * totalRatingNumber +
            pointOfRatings[restaurantId].detail.packaging) /
            newTotalRatingNumber,
          1,
        ),
      };

      await integrationSdk.listings.update({
        id: restaurantId,
        metadata: {
          totalRating: newTotalRating,
          totalRatingNumber: newTotalRatingNumber,
          detailRating: newDetailRating,
        },
      });
    }),
  );
};

export const updateRatingForOrderFn = async ({
  ratings,
  detailTextRating,
  images,
  staff,
  service,
}: {
  ratings: any;
  detailTextRating?: string;
  images: any;
  staff: any;
  service: any;
}) => {
  const integrationSdk = getIntegrationSdk();
  const { orderId } = ratings[0] || {};
  const order = await fetchListing(orderId);
  const orderListing = Listing(order);
  const { orderState, orderStateHistory = [] } = orderListing.getMetadata();
  const ratingStateHistory = {
    state: EOrderStates.reviewed,
    updatedAt: new Date().getTime(),
  };
  await integrationSdk.listings.update({
    id: orderId,
    images,
    metadata: {
      ratings,
      detailTextRating,
      ...(orderState === EOrderStates.completed
        ? {
            orderState: EOrderStates.reviewed,
            orderStateHistory: [...orderStateHistory, ratingStateHistory],
          }
        : {}),

      pitoRating: {
        staff,
        service,
      },
    },
  });
};
