import { difference, isEmpty } from 'lodash';
import { DateTime } from 'luxon';

import { parseThousandNumber } from '@helpers/format';
import {
  getPCCFeeByMemberAmount,
  getPCCFeeByTiers,
} from '@helpers/orderHelper';
import { Listing } from '@src/utils/data';
import { weekDayFormatFromDateTime } from '@src/utils/dates';
import {
  EEditOrderHistoryType,
  EParticipantOrderStatus,
} from '@src/utils/enums';
import type { TPlan } from '@src/utils/orderTypes';
import type {
  TListing,
  TObject,
  TOrderChangeHistoryItem,
} from '@src/utils/types';

export const preparePickingOrderChangeNotificationData = ({
  oldOrderDetail,
  newOrderDetail,
  order,
  updateOrderData,
}: {
  oldOrderDetail: TPlan['orderDetail'];
  newOrderDetail: TPlan['orderDetail'];
  order: TListing;
  updateOrderData: TObject;
}) => {
  const createdAt = new Date().getTime();

  const orderGetter = Listing(order);
  const orderId = orderGetter.getId();
  const {
    staffName,
    shipperName,
    specificPCCFee = 0,
    specificPCCFeeTiers,
    hasSpecificPCCFee = false,
    memberAmount = 0,
    deliveryAddress,
    detailAddress,
    deliveryHour,
  } = orderGetter.getMetadata();
  const PCCFeeByMemberAmount = getPCCFeeByMemberAmount(memberAmount);
  const PCCFeePerDate = (() => {
    if (!hasSpecificPCCFee) return PCCFeeByMemberAmount;
    if (specificPCCFeeTiers?.length)
      return getPCCFeeByTiers(memberAmount, specificPCCFeeTiers);

    return specificPCCFee;
  })();

  const changeHistoryToNotifyBooker: TObject[] = [];
  const changeHistoryToNotifyBookerByMeal: TObject = {};
  const emailParamsForParticipantNotification: TObject[] = [];
  const firebaseChangeHistory: Partial<TOrderChangeHistoryItem>[] = [];
  const normalizedOrderDetail: TObject = {};

  const sortedNewOrderDetailKeys = Object.keys(newOrderDetail).sort(
    (t1, t2) => Number(t1) - Number(t2),
  );

  sortedNewOrderDetailKeys.forEach((timestamp) => {
    const orderDetailData = newOrderDetail[timestamp] || {};
    const oldOrderDetailData = oldOrderDetail[timestamp] || {};
    changeHistoryToNotifyBookerByMeal[timestamp] = [];
    const formattedWeekDay = `${weekDayFormatFromDateTime(
      DateTime.fromMillis(Number(timestamp)),
    )}:`;

    const { restaurant = {}, memberOrders = {} } = orderDetailData;
    const { id: restaurantId, restaurantName, foodList = {} } = restaurant;
    const foodIds = Object.keys(foodList);
    const { restaurant: oldRestaurant = {} } = oldOrderDetailData;
    const {
      id: oldRestaurantId,
      restaurantName: oldRestaurantName,
      foodList: oldFoodList = {},
    } = oldRestaurant;
    const oldFoodIds = Object.keys(oldFoodList);
    const addedFoodList = difference(foodIds, oldFoodIds);
    const removedFoodList = difference(oldFoodIds, foodIds);

    changeHistoryToNotifyBookerByMeal[timestamp] = [];

    if (restaurantId && oldRestaurantId) {
      if (restaurantId !== oldRestaurantId) {
        changeHistoryToNotifyBookerByMeal[timestamp] = [
          {
            oldData: {
              title: formattedWeekDay,
              content: `Đối tác - ${oldRestaurantName}`,
            },
            newData: {
              title: formattedWeekDay,
              content: `Đối tác - ${restaurantName}`,
            },
          },
        ];
        firebaseChangeHistory.push({
          orderId,
          type: EEditOrderHistoryType.changeRestaurant,
          createdAt,
          newValue: restaurant,
          oldValue: oldRestaurant,
          subOrderDate: timestamp,
        });
      } else {
        if (!isEmpty(removedFoodList)) {
          removedFoodList.forEach((removedFoodId) => {
            const { foodName } = oldFoodList[removedFoodId] || {};

            changeHistoryToNotifyBookerByMeal[timestamp] =
              changeHistoryToNotifyBookerByMeal[timestamp].concat({
                oldData: {},
                newData: {
                  title: formattedWeekDay,
                  content: `Xoá món "${foodName}"`,
                },
              });

            firebaseChangeHistory.push({
              orderId,
              type: EEditOrderHistoryType.deleteFood,
              createdAt,
              newValue: {},
              oldValue: { ...oldFoodList[removedFoodId] },
              subOrderDate: timestamp,
            });
          });
        }

        if (!isEmpty(addedFoodList)) {
          addedFoodList.forEach((addedFoodId) => {
            const { foodName } = foodList[addedFoodId] || {};

            changeHistoryToNotifyBookerByMeal[timestamp] =
              changeHistoryToNotifyBookerByMeal[timestamp].concat({
                oldData: {},
                newData: {
                  title: formattedWeekDay,
                  content: `Thêm món "${foodName}"`,
                },
              });

            firebaseChangeHistory.push({
              orderId,
              type: EEditOrderHistoryType.addFood,
              createdAt,
              newValue: { ...foodList[addedFoodId] },
              oldValue: {},
              subOrderDate: timestamp,
            });
          });
        }
      }
    }

    const normalizedMemberOrders = { ...memberOrders };
    Object.entries(memberOrders).forEach(([memberId, pickingFoodData]) => {
      const { foodId = '', ...restPickingData } = pickingFoodData || {};

      if (foodId !== '' && isEmpty(foodList[foodId])) {
        normalizedMemberOrders[memberId] = {
          ...restPickingData,
          foodId: '',
          status: EParticipantOrderStatus.empty,
        };
        emailParamsForParticipantNotification.push({
          orderId,
          participantId: memberId,
          timestamp,
        });
      }
    });

    if (!isEmpty(changeHistoryToNotifyBookerByMeal[timestamp])) {
      changeHistoryToNotifyBooker.push(
        ...changeHistoryToNotifyBookerByMeal[timestamp],
      );
    }

    normalizedOrderDetail[timestamp] = {
      ...newOrderDetail[timestamp],
      memberOrders: normalizedMemberOrders,
    };
  });

  const {
    staffName: updateStaffName,
    shipperName: updateShipperName,
    specificPCCFee: updateSpecificPCCFee,
    deliveryAddress: updateDeliveryAddress,
    detailAddress: updateDetailAddress,
    deliveryHour: updateDeliveryHour,
  } = updateOrderData || {};

  if (updateStaffName !== undefined && updateStaffName !== staffName) {
    changeHistoryToNotifyBooker.push({
      oldData: {
        title: 'Nhân viên phụ trách:',
        content: staffName,
      },
      newData: {
        title: 'Nhân viên phụ trách:',
        content: updateStaffName,
      },
    });
  }
  if (updateShipperName !== undefined && updateShipperName !== shipperName) {
    changeHistoryToNotifyBooker.push({
      oldData: {
        title: 'Nhân viên giao hàng:',
        content: shipperName,
      },
      newData: {
        title: 'Nhân viên giao hàng:',
        content: updateShipperName,
      },
    });
  }
  if (
    updateSpecificPCCFee !== undefined &&
    PCCFeePerDate !== updateSpecificPCCFee
  ) {
    changeHistoryToNotifyBooker.push({
      oldData: {
        title: 'Phí PITO Cloud Canteen:',
        content: `${parseThousandNumber(PCCFeePerDate)}đ`,
      },
      newData: {
        title: 'Phí PITO Cloud Canteen:',
        content: `${parseThousandNumber(updateSpecificPCCFee)}đ`,
      },
    });
  }
  if (
    updateDeliveryAddress !== undefined &&
    updateDeliveryAddress.address !== deliveryAddress.address
  ) {
    changeHistoryToNotifyBooker.push({
      oldData: {
        title: 'Địa chỉ giao hàng:',
        content: deliveryAddress.address,
      },
      newData: {
        title: 'Địa chỉ giao hàng:',
        content: updateDeliveryAddress.address,
      },
    });
  }

  if (
    updateDetailAddress !== undefined &&
    updateDetailAddress !== detailAddress
  ) {
    changeHistoryToNotifyBooker.push({
      oldData: {
        title: 'Địa chỉ chi tiết:',
        content: detailAddress,
      },
      newData: {
        title: 'Địa chỉ chi tiết:',
        content: updateDetailAddress,
      },
    });
  }

  if (updateDeliveryHour !== undefined && updateDeliveryHour !== deliveryHour) {
    changeHistoryToNotifyBooker.push({
      oldData: {
        title: 'Thời gian giao hàng:',
        content: deliveryHour,
      },
      newData: {
        title: 'Thời gian giao hàng:',
        content: updateDeliveryHour,
      },
    });
  }

  return {
    emailParamsForBookerNotification: {
      changeHistory: changeHistoryToNotifyBooker,
      orderId,
    },
    emailParamsForParticipantNotification,
    firebaseChangeHistory,
    normalizedOrderDetail,
  };
};
