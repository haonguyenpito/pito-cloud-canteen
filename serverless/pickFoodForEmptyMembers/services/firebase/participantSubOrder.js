/* eslint-disable prettier/prettier */
const get = require('lodash/get');
const config = require('../../utils/config');
const { EParticipantOrderStatus } = require('../../utils/enums');
const { setCollectionDocWithCustomId } = require('./helper');

const addParticipantSubOrder = async ({
  participantId,
  order,
  plan,
  food,
  restaurant,
  subOrderDate,
}) => {
  try {
    const orderId = get(order, 'id.uuid', '');
    const planId = get(plan, 'id.uuid', '');

    const deliveryHour = get(order, 'attributes.metadata.deliveryHour', '');

    const restaurantId = get(restaurant, 'id.uuid', '');
    const restaurantName = get(restaurant, 'attributes.title', '');
    const avatarImageId = get(
      restaurant,
      'attributes.publicData.avatarImageId',
      '',
    );
    const restaurantImages = get(restaurant, 'images', []);

    const restaurantAvatarImage = restaurantImages.find(
      (image) => image.id.uuid === avatarImageId,
    );
    const newRestaurantAvatarImage = restaurantAvatarImage && {
      ...restaurantAvatarImage,
      id: {
        uuid: restaurantAvatarImage.id.uuid,
      },
    };

    const foodId = get(food, 'id.uuid', '');
    const foodImages = get(food, 'images', []);

    const newFoodImage =
      foodImages.length > 0
        ? {
            ...foodImages[0],
            id: {
              uuid: foodImages[0].id.uuid,
            },
          }
        : null;

    const subOrderDocumentParams = {
      participantId,
      orderId,
      planId,
      restaurantId,
      restaurantName,
      ...(newRestaurantAvatarImage && {
        restaurantAvatarImage: newRestaurantAvatarImage,
      }),
      status: EParticipantOrderStatus.joined,
      txStatus: 'pending',
      deliveryHour,
      createdAt: new Date(),
      foodId,
      ...(newFoodImage && { foodImage: newFoodImage }),
    };

    await setCollectionDocWithCustomId(
      `${participantId} - ${planId} - ${subOrderDate}`,
      subOrderDocumentParams,
      config.firebase.participantSubOrderCollectionName,
    );
  } catch (error) {
    console.error('addParticipantSubOrder error: ', error);
  }
};

module.exports = {
  addParticipantSubOrder,
};
