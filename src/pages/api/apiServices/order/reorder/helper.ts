import { isEmpty, omit } from 'lodash';

import type { TDaySession } from '@components/CalendarDashboard/helpers/types';
import { prepareDaySession } from '@helpers/order/prepareDataHelper';
import { isOrderDetailDatePickedFood } from '@helpers/orderHelper';
import { denormalisedResponseEntities } from '@services/data';
import { fetchListing } from '@services/integrationHelper';
import { Listing } from '@src/utils/data';
import { getDaySessionFromDeliveryTime } from '@src/utils/dates';
import { EListingStates } from '@src/utils/enums';
import { INITIAL_DELIVERY_TIME_BASE_ON_DAY_SESSION } from '@src/utils/options';
import type { TObject } from '@src/utils/types';

import { checkRestaurantAvailableStatus } from '../checkRestaurantAvailableStatus';
import {
  recommendRestaurantForSpecificDay,
  recommendRestaurants,
} from '../recommendRestaurants/index.services';
import { prepareMenuFoodList } from '../recommendRestaurants/prepareData';

async function removeUnavailabelFoods(newOrderDetail: TObject) {
  const foodIds: string[] = Object.values(newOrderDetail).reduce(
    (acc, { restaurant }) => {
      const { foodList } = restaurant || {};
      const foodIdsInRestaurant = Object.keys(foodList || {});

      return [...acc, ...foodIdsInRestaurant];
    },
    [],
  );

  const foodIdList = Array.from(new Set(foodIds));
  const notAvailableFoodIdList: string[] = [];

  await Promise.all(
    foodIdList.map(async (foodId: string) => {
      const foodListing = await fetchListing(foodId);

      const { isAvailable } = Listing(foodListing).getMetadata();

      if (!isAvailable) {
        notAvailableFoodIdList.push(foodId);
      }
    }),
  );

  // remove not available food from order detail
  if (notAvailableFoodIdList.length !== 0) {
    Object.keys(newOrderDetail).forEach((timestamp) => {
      const { restaurant } = newOrderDetail[timestamp] || {};
      const { foodList } = restaurant || {};

      if (foodList) {
        notAvailableFoodIdList.forEach((foodId) => {
          delete foodList[foodId];
        });
      }
    });
  }
}

export const normalizeOrderMetadata = (metadata: TObject, newData: TObject) => {
  const {
    companyId,
    vatSettings = {},
    serviceFees = {},
    listingType,
    dayInWeek,
    deliveryAddress,
    detailAddress,
    displayedDurationTime,
    durationTimeMode,
    memberAmount,
    notes,
    nutritions,
    orderType,
    orderVATPercentage,
    packagePerMember,
    participants,
    pickAllow,
    selectedGroups,
    shipperName,
    staffName,
    vatAllow,
    deliveryHour,
    daySession,
    mealType,
    deadlineHour,
  } = metadata || {};
  const { daySession: newDaySession } = newData || {};

  const oldDaySession =
    daySession ||
    getDaySessionFromDeliveryTime(
      isEmpty(deliveryHour)
        ? undefined
        : deliveryHour.includes('-')
        ? deliveryHour.split('-')[0]
        : deliveryHour,
    );
  const newDeliveryHour =
    newDaySession === oldDaySession
      ? deliveryHour
      : INITIAL_DELIVERY_TIME_BASE_ON_DAY_SESSION[newDaySession as TDaySession];

  const newOrderMetadata = {
    companyId,
    vatSettings,
    serviceFees,
    listingType,
    dayInWeek,
    deliveryAddress,
    detailAddress,
    displayedDurationTime,
    durationTimeMode,
    memberAmount,
    notes,
    nutritions,
    orderType,
    orderVATPercentage,
    packagePerMember,
    participants,
    pickAllow,
    selectedGroups,
    shipperName,
    staffName,
    vatAllow,
    deliveryHour: newDeliveryHour,
    daySession: prepareDaySession(daySession, deliveryHour),
    deadlineHour,
    mealType,
  };

  return newOrderMetadata;
};

const ORDER_DETAIL_KEYS_TO_REMOVE = [
  'isPaid',
  'lastTransition',
  'transactionId',
];

export const createNewPlanFromOldPlans = async ({
  newOrderId,
  newOrder,
  generatedOrderTitle,
  subAccountId,
  isCreatedByAdmin,
  oldPlans,
  integrationSdk,
  orderDatesInTimestamp,
  orderDatesWeekdayList,
  oldOrderDatesInTimestamp,
  oldOrderDatesWeekdayList,
  isGroupOrder,
  initialMemberOrder,
  oldOrderMetadata,
}: TObject) => {
  return Promise.all(
    oldPlans.map(async (id: string, index: number) => {
      const [oldPlan] = denormalisedResponseEntities(
        await integrationSdk.listings.show({ id }),
      );
      const oldPlanMetadata = Listing(oldPlan).getMetadata();
      const { orderDetail: oldOrderDetail = {} } = oldPlanMetadata;

      // * find has restaurant & food from old order detail
      const hasRestaurantDateListFormOldPlan = Object.keys(
        oldOrderDetail,
      ).filter((date) => isOrderDetailDatePickedFood(oldOrderDetail[date]));
      const hasRestaurantDatesCount = hasRestaurantDateListFormOldPlan.length;

      let newOrderDetail: TObject = {};

      orderDatesInTimestamp.forEach((currentDate: number, dateIdx: number) => {
        const weekDayOfDate = orderDatesWeekdayList[dateIdx];
        let dateToCopy: string | number =
          oldOrderDatesInTimestamp[
            oldOrderDatesWeekdayList.indexOf(weekDayOfDate)
          ];

        // * if week day not include in old week day list or empty order detail on date
        if (!dateToCopy || isEmpty(oldOrderDetail[dateToCopy])) {
          if (hasRestaurantDatesCount === 0) {
            return;
          }

          dateToCopy =
            hasRestaurantDateListFormOldPlan[
              Math.floor(Math.random() * (hasRestaurantDatesCount - 1))
            ];
        }

        // * remove unnecessary info from old order detail on date
        const subOrderNeededData = omit(
          oldOrderDetail[dateToCopy],
          ORDER_DETAIL_KEYS_TO_REMOVE,
        );

        newOrderDetail[`${currentDate}`] = {
          ...subOrderNeededData,
          memberOrders: isGroupOrder ? {} : initialMemberOrder,
        };
      });

      // check and remove unavailable foods by modifying new order detail directly
      await removeUnavailabelFoods(newOrderDetail);

      // * check available status
      const restaurantAvailableMap = await checkRestaurantAvailableStatus(
        newOrder,
        newOrderDetail,
      );
      const timestampList = Object.keys(restaurantAvailableMap);

      const unAvailableTimestampList = Object.keys(
        restaurantAvailableMap,
      ).filter((item) => !restaurantAvailableMap[item]);

      const isAllDayUnavailable =
        unAvailableTimestampList.length === timestampList.length;

      if (isAllDayUnavailable) {
        newOrderDetail = await recommendRestaurants({
          orderId: newOrderId,
          shouldCalculateDistance: !isCreatedByAdmin,
        });
      } else if (unAvailableTimestampList.length !== 0) {
        await Promise.all(
          timestampList.map(async (timestamp) => {
            const isAvailable = restaurantAvailableMap[timestamp];
            const { restaurant } = newOrderDetail[timestamp] || {};
            const { id: currentRestaurantId, menuId } = restaurant || {};

            if (isAvailable) {
              if (restaurant && currentRestaurantId && menuId) {
                const menuListing = await fetchListing(menuId);

                const newFoodList = await prepareMenuFoodList({
                  menu: menuListing,
                  timestamp,
                  ...oldOrderMetadata,
                  order: newOrder,
                });

                newOrderDetail[timestamp].restaurant = {
                  ...newOrderDetail[timestamp].restaurant,
                  foodList: newFoodList,
                };
              }
            } else {
              const recommendOrderDetail =
                await recommendRestaurantForSpecificDay({
                  orderId: newOrderId,
                  shouldCalculateDistance: !isCreatedByAdmin,
                  timestamp: Number(timestamp),
                  favoriteRestaurantIdList: [currentRestaurantId!],
                });

              const { hasNoRestaurants = false } =
                recommendOrderDetail[timestamp] || {};

              if (!hasNoRestaurants) {
                newOrderDetail[timestamp] = recommendOrderDetail[timestamp];
              }
            }

            return null;
          }),
        );
      }

      const newPlanResponse = await integrationSdk.listings.create({
        title: `${generatedOrderTitle} - Plan week ${index + 1}`,
        authorId: subAccountId,
        state: EListingStates.published,
        metadata: {
          ...omit(oldPlanMetadata, [
            'deliveryAgentsMeals',
            'deliveryInfo',
            'planStarted',
            'slackThreadTs',
          ]),
          viewed: false,
          orderId: newOrderId,
          orderDetail: newOrderDetail,
        },
      });
      const [newPlan] = denormalisedResponseEntities(newPlanResponse);

      return newPlan?.id?.uuid;
    }),
  );
};
