import { getListingImageById } from '@pages/company/booker/orders/draft/[orderId]/restaurants/helpers';
import {
  deleteDocument,
  getDocumentById,
  setCollectionDocWithCustomId,
  updateCollectionDoc,
} from '@services/firebase';
import { fetchListing } from '@services/integrationHelper';
import { Listing } from '@src/utils/data';
import { EImageVariants, EParticipantOrderStatus } from '@src/utils/enums';

const { FIREBASE_PARTICIPANT_SUB_ORDER_COLLECTION_NAME } = process.env;

export const buildParticipantSubOrderDocumentId = (
  participantId: string,
  planId: string,
  timestamp: number,
) => {
  return `${participantId} - ${planId} - ${timestamp}`;
};

export const addFirebaseDocument = async ({
  participantId,
  planId,
  timestamp,
  extraParams,
}: {
  participantId: string;
  planId: string;
  timestamp: number;
  extraParams?: Record<string, any>;
}) => {
  const plan = await fetchListing(planId);
  const planListing = Listing(plan);
  const { orderId, orderDetail = {} } = planListing.getMetadata();
  const order = await fetchListing(orderId);
  const orderListing = Listing(order);
  const { deliveryHour } = orderListing.getMetadata();
  const subOrder = orderDetail[timestamp] || {};
  const { memberOrders = {}, transactionId, restaurant = {} } = subOrder;
  const { id: restaurantId, restaurantName, foodList } = restaurant;
  const { foodId, status, secondaryFoodId } = memberOrders[participantId] || {};
  const restaurantResponse = await fetchListing(
    restaurantId,
    ['images'],
    [`variants.${EImageVariants.squareSmall2x}`],
  );
  const restaurantListing = Listing(restaurantResponse);
  const { avatarImageId } = restaurantListing.getPublicData();

  const restaurantImages = restaurantListing.getImages();

  const restaurantAvatarImage =
    restaurantImages.length > 0
      ? getListingImageById(avatarImageId, restaurantImages)
      : null;
  const newRestaurantAvatarImage = restaurantAvatarImage && {
    ...restaurantAvatarImage,
    id: {
      uuid: restaurantAvatarImage.id.uuid,
    },
  };

  let subOrderDocument = {
    participantId,
    orderId,
    planId,
    restaurantId,
    ...(transactionId && { transactionId }),
    restaurantName,
    ...(newRestaurantAvatarImage && {
      restaurantAvatarImage: newRestaurantAvatarImage,
    }),
    status,
    txStatus: 'pending',
    deliveryHour,
    createdAt: new Date(),
    foodId,
  };

  if (status !== EParticipantOrderStatus.notJoined && foodId) {
    const { foodName } = foodList[foodId] || {};
    const foodResponse = await fetchListing(
      foodId,
      ['images'],
      [`variants.${EImageVariants.squareSmall2x}`],
    );
    const foodListing = Listing(foodResponse);
    const foodImages = foodListing.getImages();

    const newFoodImage =
      foodImages.length > 0
        ? {
            ...foodImages[0],
            id: {
              uuid: foodImages[0].id.uuid,
            },
          }
        : null;
    subOrderDocument = {
      ...subOrderDocument,
      foodName,
      ...(newFoodImage && { foodImage: newFoodImage }),
      ...(extraParams || {}),
    };
  }
  if (status !== EParticipantOrderStatus.notJoined && secondaryFoodId) {
    const { foodName } = foodList[secondaryFoodId] || {};
    const foodResponse = await fetchListing(
      secondaryFoodId,
      ['images'],
      [`variants.${EImageVariants.squareSmall2x}`],
    );
    const foodListing = Listing(foodResponse);
    const foodImages = foodListing.getImages();

    const newSecondFoodImage =
      foodImages.length > 0
        ? {
            ...foodImages[0],
            id: {
              uuid: foodImages[0].id.uuid,
            },
          }
        : null;
    subOrderDocument = {
      ...subOrderDocument,
      secondaryFoodName: foodName,
      ...(newSecondFoodImage && { secondaryFoodImage: newSecondFoodImage }),
    };
  }

  if (status !== EParticipantOrderStatus.notJoined && secondaryFoodId) {
    const { foodName } = foodList[secondaryFoodId] || {};
    const foodResponse = await fetchListing(
      secondaryFoodId,
      ['images'],
      [`variants.${EImageVariants.squareSmall2x}`],
    );
    const foodListing = Listing(foodResponse);
    const foodImages = foodListing.getImages();

    const newSecondFoodImage =
      foodImages.length > 0
        ? {
            ...foodImages[0],
            id: {
              uuid: foodImages[0].id.uuid,
            },
          }
        : null;
    subOrderDocument = {
      ...subOrderDocument,
      secondaryFoodId,
      secondaryFoodName: foodName,
      ...(newSecondFoodImage && { secondaryFoodImage: newSecondFoodImage }),
    };
  }

  if (status !== EParticipantOrderStatus.notJoined && secondaryFoodId) {
    const { foodName } = foodList[secondaryFoodId] || {};
    const foodResponse = await fetchListing(
      secondaryFoodId,
      ['images'],
      [`variants.${EImageVariants.squareSmall2x}`],
    );
    const foodListing = Listing(foodResponse);
    const foodImages = foodListing.getImages();

    const newSecondFoodImage =
      foodImages.length > 0
        ? {
            ...foodImages[0],
            id: {
              uuid: foodImages[0].id.uuid,
            },
          }
        : null;
    subOrderDocument = {
      ...subOrderDocument,
      secondaryFoodId,
      secondaryFoodName: foodName,
      ...(newSecondFoodImage && { secondaryFoodImage: newSecondFoodImage }),
    };
  }

  if (status !== EParticipantOrderStatus.notJoined && secondaryFoodId) {
    const { foodName } = foodList[secondaryFoodId] || {};
    const foodResponse = await fetchListing(
      secondaryFoodId,
      ['images'],
      [`variants.${EImageVariants.squareSmall2x}`],
    );
    const foodListing = Listing(foodResponse);
    const foodImages = foodListing.getImages();

    const newSecondFoodImage =
      foodImages.length > 0
        ? {
            ...foodImages[0],
            id: {
              uuid: foodImages[0].id.uuid,
            },
          }
        : null;
    subOrderDocument = {
      ...subOrderDocument,
      secondaryFoodId,
      secondaryFoodName: foodName,
      ...(newSecondFoodImage && { secondaryFoodImage: newSecondFoodImage }),
    };
  }

  await setCollectionDocWithCustomId(
    buildParticipantSubOrderDocumentId(participantId, planId, timestamp),
    subOrderDocument,
    FIREBASE_PARTICIPANT_SUB_ORDER_COLLECTION_NAME!,
  );
};
export const updateFirebaseDocument = async (
  subOrderId: string,
  params: any,
) => {
  const { txStatus, reviewId, status, foodId, foodImage, foodName } = params;

  const allowedParams = {
    ...(txStatus && { txStatus }),
    ...(reviewId && { reviewId }),
    ...(status && { status }),
    ...(foodId && { foodId }),
    ...(foodName && { foodName }),
    ...(foodImage && { foodImage }),
  };
  await updateCollectionDoc(
    subOrderId,
    allowedParams,
    FIREBASE_PARTICIPANT_SUB_ORDER_COLLECTION_NAME!,
  );
};

export const getFirebaseDocumentById = async (subOrderId: string) => {
  const response = await getDocumentById(
    subOrderId,
    FIREBASE_PARTICIPANT_SUB_ORDER_COLLECTION_NAME!,
  );

  return response;
};

export const deleteFirebaseDocumentById = async (subOrderId: string) => {
  await deleteDocument(
    subOrderId,
    FIREBASE_PARTICIPANT_SUB_ORDER_COLLECTION_NAME!,
  );
};
