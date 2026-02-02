const {
  queryAllCollectionData,
  updateCollectionDoc,
} = require('./services/firebase/helper');
const { denormalisedResponseEntities, Listing } = require('./utils/data');
const { getIntegrationSdk } = require('./utils/sdk');
require('dotenv').config();

const { FIREBASE_MEMBER_ORDERS_COLLECTION_NAME } = process.env;

const EOrderStates = {
  canceled: 'canceled',
  canceledByBooker: 'canceledByBooker',
  picking: 'picking',
  inProgress: 'inProgress',
  pendingPayment: 'pendingPayment',
  completed: 'completed',
  reviewed: 'reviewed',
  expiredStart: 'expiredStart',
};

exports.handler = async () => {
  const integrationSdk = getIntegrationSdk();
  try {
    const orderMembers = await queryAllCollectionData({
      collectionName: FIREBASE_MEMBER_ORDERS_COLLECTION_NAME,
      queryParams: {
        status: {
          operator: '==',
          value: 'pending',
        },
      },
      order: {
        field: 'createdAt',
        direction: 'asc', // get all order members with ascending createdAt
      },
    });
    console.log('pendingOrderMembers', orderMembers);
    // group order members by planId
    const groupOrders = orderMembers.reduce((acc, orderMember) => {
      acc[orderMember.planId] = {
        ...acc[orderMember.planId],
        [orderMember.participantId]: orderMember.planData, // get the latest plan data
      };

      return acc;
    }, {});
    console.log('groupOrders', groupOrders);
    console.log('Update member orders started');
    const updateOrderDetails = await Promise.allSettled(
      // restructure memberOrders to plan listing order detail
      Object.entries(groupOrders).map(async ([planId, memberOrders]) => {
        const planListingResponse = await integrationSdk.listings.show({
          id: planId,
        });
        const [planListing] = denormalisedResponseEntities(planListingResponse);
        if (!planListing) {
          console.error(
            'Update member orders failed',
            'Plan listing not found',
          );

          return;
        }
        const { orderDetail, orderId } = Listing(planListing).getMetadata();
        if (!orderId) {
          console.error('Update member orders failed', 'Order ID is required');

          return;
        }
        if (!orderDetail || typeof orderDetail !== 'object') {
          console.error(
            'Update member orders failed',
            'Order detail is required',
          );

          return;
        }
        const orderListingResponse = await integrationSdk.listings.show({
          id: orderId,
        });
        const [orderListing] =
          denormalisedResponseEntities(orderListingResponse);
        if (!orderListing) {
          console.error(
            'Update member orders failed',
            'Order listing not found',
          );

          return;
        }

        const { orderState } = Listing(orderListing).getMetadata();
        // if order state is not in progress or picking, cancel all pending member orders
        if (
          orderState !== EOrderStates.inProgress &&
          orderState !== EOrderStates.picking
        ) {
          const memberOrdersWithPendingStatus = orderMembers.filter(
            (orderMember) =>
              orderMember.planId === planId && orderMember.orderId === orderId,
          );

          // cancel all pending member orders
          await Promise.allSettled(
            memberOrdersWithPendingStatus.map(async (orderMember) => {
              await updateCollectionDoc(
                orderMember.id,
                { status: 'canceled', updatedAt: new Date().toISOString() },
                FIREBASE_MEMBER_ORDERS_COLLECTION_NAME,
              );
            }),
          );
          console.error(
            'Update member orders failed',
            'Order state is not in progress or picking',
          );

          return;
        }

        const orderDays = Object.keys(orderDetail);
        const newOrderDetail = orderDays.reduce((acc, orderDay) => {
          acc[orderDay] = {
            ...orderDetail[orderDay],
            memberOrders: {
              ...orderDetail[orderDay].memberOrders,
              ...Object.values(memberOrders).reduce(
                (newMemberOrders, memberOrder) => {
                  const memberOrderData = memberOrder[orderDay];
                  if (!memberOrderData || typeof memberOrderData !== 'object') {
                    console.error(
                      `${orderDay}@@memberOrderData`,
                      memberOrderData,
                      'Member order data is not an object',
                    );

                    return newMemberOrders;
                  }
                  const participantId = Object.keys(memberOrderData);
                  newMemberOrders[participantId] =
                    memberOrderData[participantId];
                  console.log(
                    `${orderDay}@@newMemberOrders@@${participantId}`,
                    newMemberOrders,
                  );

                  return newMemberOrders;
                },
                {},
              ),
            },
          };

          return acc;
        }, {});
        if (orderDays.length > 0) {
          console.log(
            `newOrderDetail@${planId}@${orderId}@${orderDays[0]}`,
            newOrderDetail[orderDays[0]],
          );
        }
        // update plan listing order detail
        await integrationSdk.listings.update({
          id: planId,
          metadata: { orderDetail: newOrderDetail },
        });
        const orderMemberRecordsInPlan = orderMembers.filter(
          (orderMember) =>
            orderMember.planId === planId && orderMember.orderId === orderId,
        );
        // update order member status to completed
        await Promise.allSettled(
          orderMemberRecordsInPlan.map(async (orderMember) => {
            const documentId = orderMember.id;
            await updateCollectionDoc(
              documentId,
              {
                status: 'completed',
                updatedAt: new Date().toISOString(),
              },
              FIREBASE_MEMBER_ORDERS_COLLECTION_NAME,
            );
          }),
        );
      }),
    );

    console.info('Update member orders successfully', updateOrderDetails);
  } catch (error) {
    console.error('Update member orders failed', error);
    throw error;
  }
};
