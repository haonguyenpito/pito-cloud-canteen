import isEmpty from 'lodash/isEmpty';

import type { TPlanOrderDetail } from '@helpers/order/partnerPriceHelper';
import type {
  TFoodOrderOfDate,
  TQuotationFoodRow,
} from '@helpers/order/quotationHelper';
import { getFoodDataMap } from '@helpers/orderHelper';
import { generateScannerBarCode } from '@pages/api/admin/scanner/[planId]/toggle-mode.api';
import type { TCartItem } from '@src/types/order';
import { Listing, User } from '@src/utils/data';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import type { ETransition } from '@src/utils/transaction';
import { TRANSITIONS_TO_STATE_CANCELED } from '@src/utils/transaction';
import type { TListing, TObject, TUser } from '@src/utils/types';
import { EParticipantOrderStatus, ESubOrderStatus } from '@utils/enums';

const groupFoodForGroupOrder = (
  orderDetail: TObject,
  date?: number | string,
) => {
  return Object.entries(orderDetail).reduce(
    (result, currentOrderDetailEntry, index) => {
      const [d, rawOrderDetailOfDate] = currentOrderDetailEntry;

      const {
        memberOrders,
        restaurant = {},
        status: subOrderStatus,
        lastTransition,
      } = rawOrderDetailOfDate as TObject;
      const { id, restaurantName, foodList: foodListOfDate = {} } = restaurant;
      if (
        subOrderStatus === ESubOrderStatus.canceled ||
        TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition) ||
        (date && d !== date.toString())
      ) {
        return result;
      }

      const foodDataMap = getFoodDataMap({ foodListOfDate, memberOrders });
      const foodDataList = Object.values(foodDataMap);
      const summary = foodDataList.reduce(
        (previousResult: TObject, current: TObject) => {
          const { totalPrice, totalDishes } = previousResult;
          const { frequency, foodPrice } = current;

          return {
            ...previousResult,
            totalDishes: totalDishes + frequency,
            totalPrice: totalPrice + foodPrice * frequency,
          };
        },
        {
          totalDishes: 0,
          totalPrice: 0,
          restaurantName,
        } as TObject,
      );

      return [
        ...result,
        {
          date: d,
          index,
          ...summary,
          foodDataList,
          restaurantId: id,
        },
      ];
    },
    [] as TObject[],
  );
};

/**
 * Groups a normal order's line items per delivery date, with totals.
 * @param orderDetail - `plan.metadata.orderDetail`.
 * @param date - Only this delivery date when given.
 * @returns One entry per non-canceled date; each food row carries the client
 *   price (`foodPrice`) and the partner price (`foodPartnerPrice`).
 */
const groupFoodForNormal = (
  orderDetail: TPlanOrderDetail,
  date?: number | string,
) => {
  return Object.entries(orderDetail).reduce<TFoodOrderOfDate[]>(
    (result, [d, subOrder], index) => {
      const {
        lineItems = [],
        restaurant = {},
        status: subOrderStatus,
        lastTransition,
      } = subOrder || {};
      const { id = '', restaurantName = '', foodList = {} } = restaurant;

      if (
        subOrderStatus === ESubOrderStatus.canceled ||
        TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition as ETransition) ||
        (date && d !== date.toString())
      ) {
        return result;
      }

      const foodDataList = lineItems.map((lineItem) => {
        const {
          id: foodId = '',
          name: foodName = '',
          quantity = 1,
          unitPrice: foodPrice = 0,
          unitPartnerPrice: foodPartnerPrice,
        } = lineItem || {};
        const { foodUnit = '' } = foodList[foodId] || {};

        return {
          foodId,
          foodName,
          foodUnit,
          foodPrice,
          foodPartnerPrice,
          frequency: quantity,
        };
      });

      const summary = lineItems.reduce(
        (previousResult, lineItem) => ({
          totalDishes: previousResult.totalDishes + (lineItem?.quantity ?? 1),
          totalPrice: previousResult.totalPrice + (lineItem?.price ?? 0),
        }),
        { totalDishes: 0, totalPrice: 0 },
      );

      return [
        ...result,
        {
          date: d,
          index,
          restaurantName,
          ...summary,
          foodDataList,
          restaurantId: id,
        },
      ];
    },
    [],
  );
};

export const groupFoodOrderByDate = ({
  orderDetail = {},
  isGroupOrder = true,
  date,
}: {
  orderDetail: TObject;
  isGroupOrder: boolean;
  date?: number | string;
}) => {
  return isGroupOrder
    ? groupFoodForGroupOrder(orderDetail, date)
    : groupFoodForNormal(orderDetail, date);
};

type TQuotationRowsByDate = Record<string, TQuotationFoodRow[]>;
type TQuotationMetadata = {
  client?: { quotation: TQuotationRowsByDate };
  partner?: Record<string, { name: string; quotation: TQuotationRowsByDate }>;
};

/**
 * Groups a finalised quotation's food rows per delivery date, with totals.
 * @param params.quotation - The quotation listing.
 * @param params.date - Only this delivery date when given.
 * @param params.isPartner - Read the partner's rows (partner prices) instead of
 *   the client's.
 * @returns One entry per delivery date.
 */
export const groupFoodOrderByDateFromQuotation = ({
  quotation,
  date: dateFromParams,
  isPartner = false,
}: {
  quotation: TListing;
  date?: string | number;
  isPartner?: boolean;
}): TFoodOrderOfDate[] => {
  const { client, partner } = Listing(
    quotation,
  ).getMetadata() as TQuotationMetadata;
  if (!client || !partner || isEmpty(client) || isEmpty(partner)) {
    return [];
  }

  return Object.keys(client.quotation).reduce<TFoodOrderOfDate[]>(
    (res, subOrderDate, index) => {
      if (dateFromParams && dateFromParams !== subOrderDate) {
        return res;
      }
      const restaurantKey =
        Object.keys(partner).find((restaurantId) =>
          Object.keys(partner[restaurantId].quotation).some(
            (date) => date === subOrderDate,
          ),
        ) || '';
      const foodDataList = isPartner
        ? partner[restaurantKey]?.quotation[subOrderDate] || []
        : client.quotation[subOrderDate];

      return res.concat([
        {
          date: subOrderDate,
          restaurantId: Object.keys(partner[restaurantKey] || {})[0],
          restaurantName: partner[restaurantKey]?.name || '',
          index: dateFromParams ? 0 : index,
          totalDishes: foodDataList.reduce(
            (total, { frequency }) => total + frequency,
            0,
          ),
          foodDataList,
          totalPrice: foodDataList.reduce(
            (total, { foodPrice, frequency }) => total + foodPrice * frequency,
            0,
          ),
        },
      ]);
    },
    [],
  );
};

export const groupPickingOrderByFood = ({
  orderDetail,
  date,
  participants = [],
  anonymous = [],
  planId,
}: {
  orderDetail: TObject;
  date?: number | string;
  participants: TObject[];
  anonymous: TObject[];
  isGetBarcode?: boolean;
  planId?: string;
}) => {
  return Object.entries(orderDetail).reduce(
    (result, currentOrderDetailEntry, index) => {
      const [d, rawOrderDetailOfDate] = currentOrderDetailEntry;

      const {
        memberOrders = {},
        restaurant = {},
        status: subOrderStatus,
      } = rawOrderDetailOfDate as TObject;
      const { id, foodList: foodListOfDate = {} } = restaurant;
      if (
        subOrderStatus === ESubOrderStatus.canceled ||
        (date && d !== date.toString())
      ) {
        return result;
      }

      const foodDataMap = Object.entries(memberOrders).reduce(
        (foodFrequencyResult, currentMemberOrderEntry) => {
          const [memberId, memberOrderData] = currentMemberOrderEntry;
          const {
            foodId,
            status,
            requirement = '',
            secondaryFoodId,
            secondaryRequirement = '',
          } = memberOrderData as TObject;

          const participantMaybe = participants.find(
            (p) => p?.id?.uuid === memberId,
          );
          const anonymousUserMaybe = anonymous.find(
            (p) => p?.id?.uuid === memberId,
          );
          const { firstName, lastName, displayName } = User(
            (participantMaybe || anonymousUserMaybe) as TUser,
          ).getProfile();

          const participantName = buildFullName(firstName, lastName, {
            compareToGetLongerWith: displayName,
          });

          // Helper function to add food to foodDataMap
          const addFoodToMap = (
            currentMap: TObject,
            targetFoodId: string,
            foodRequirement: string,
          ) => {
            if (!targetFoodId || targetFoodId === '') {
              return currentMap;
            }

            const foodInfo = foodListOfDate[targetFoodId] || {};
            const { foodName, foodPrice, foodUnit = '' } = foodInfo;
            const data = currentMap[targetFoodId] as TObject;
            const { frequency, notes = [] } = data || {};
            const newNote = {
              note: foodRequirement,
              name: participantName,
              memberId,
              ...(planId && {
                barcode: generateScannerBarCode(planId, memberId, `${date}`),
              }),
            };

            const updatedNotes = [...notes];
            if (!isEmpty(foodRequirement)) {
              updatedNotes.splice(0, 0, newNote);
            } else {
              updatedNotes.push(newNote);
            }

            return {
              ...currentMap,
              [targetFoodId]: data
                ? { ...data, frequency: frequency + 1, notes: updatedNotes }
                : {
                    foodId: targetFoodId,
                    foodName,
                    foodUnit,
                    foodPrice,
                    notes: updatedNotes,
                    frequency: 1,
                  },
            };
          };

          if (status === EParticipantOrderStatus.joined) {
            // Add primary food
            let updatedMap = addFoodToMap(
              foodFrequencyResult,
              foodId,
              requirement,
            );

            // Add secondary food if exists
            if (secondaryFoodId) {
              updatedMap = addFoodToMap(
                updatedMap,
                secondaryFoodId,
                secondaryRequirement,
              );
            }

            return updatedMap;
          }

          return foodFrequencyResult;
        },
        {} as TObject,
      );
      const foodDataList = Object.values(foodDataMap);

      return [
        ...result,
        {
          date: d,
          index,
          foodDataList,
          restaurantId: id,
        },
      ];
    },
    [] as TObject[],
  );
};

export const groupPickingOrderByFoodLevels = ({
  orderDetail,
  date,
  participants = [],
  anonymous = [],
  groups = [],
  planId,
}: {
  orderDetail: TObject;
  date?: number | string;
  participants: TObject[];
  anonymous: TObject[];
  groups: TObject[];
  planId?: string;
}) => {
  return Object.entries(orderDetail).reduce(
    (result, currentOrderDetailEntry, index) => {
      const [d, rawOrderDetailOfDate] = currentOrderDetailEntry;

      const {
        memberOrders = {},
        restaurant = {},
        status: subOrderStatus,
      } = rawOrderDetailOfDate as TObject;
      const { id, foodList: foodListOfDate = {} } = restaurant;
      if (
        subOrderStatus === ESubOrderStatus.canceled ||
        (date && d !== date.toString())
      ) {
        return result;
      }

      // Giảm thiểu memberOrders chỉ lấy các thành viên có trong các nhóm (group)
      const dataOfGroups = groups.reduce((groupResult: TObject[], group) => {
        const { id: groupId, name: groupName, members = [] } = group;

        // Lọc các memberOrders chỉ thuộc các thành viên của group này
        const validMemberOrders = Object.entries(memberOrders).filter(
          ([memberId]) =>
            members.some((member: { id: string }) => member.id === memberId),
        );

        // Chuyển đổi các memberOrders hợp lệ sang dạng foodDataList
        const foodDataList = validMemberOrders.reduce(
          (foodDataResult, [memberId, memberOrderData]) => {
            const {
              foodId,
              status,
              requirement = '',
              secondaryFoodId,
              secondaryRequirement = '',
            } = memberOrderData as TObject;
            const primaryFoodInfo = foodListOfDate[foodId] || {};
            const secondaryFoodInfo = secondaryFoodId
              ? foodListOfDate[secondaryFoodId]
              : {};

            const participantMaybe = participants.find(
              (p) => p?.id?.uuid === memberId,
            );
            const anonymousUserMaybe = anonymous.find(
              (p) => p?.id?.uuid === memberId,
            );
            const { firstName, lastName, displayName } = User(
              (participantMaybe || anonymousUserMaybe) as TUser,
            ).getProfile();
            const participantName = buildFullName(firstName, lastName, {
              compareToGetLongerWith: displayName,
            });

            const addFoodToResult = (
              targetMap: TObject,
              targetFoodId: string,
              foodInfo: TObject,
              foodRequirement: string,
            ) => {
              if (!targetFoodId) {
                return targetMap;
              }

              const { foodName, foodPrice, foodUnit = '' } = foodInfo || {};
              const data = targetMap[targetFoodId] as TObject;
              const { frequency = 0, notes = [] } = data || {};
              const newNote = {
                note: foodRequirement,
                name: participantName,
                memberId,
                ...(planId && {
                  barcode: generateScannerBarCode(planId, memberId, `${date}`),
                }),
              };

              const updatedNotes = [...notes];
              if (!isEmpty(foodRequirement)) {
                updatedNotes.splice(0, 0, newNote);
              } else {
                updatedNotes.push(newNote);
              }

              return {
                ...targetMap,
                [targetFoodId]: data
                  ? {
                      ...data,
                      frequency: frequency + 1,
                      notes: updatedNotes,
                    }
                  : {
                      foodId: targetFoodId,
                      foodName,
                      foodUnit,
                      foodPrice,
                      notes: updatedNotes,
                      frequency: 1,
                    },
              };
            };

            if (status === EParticipantOrderStatus.joined && foodId !== '') {
              const updatedMap = addFoodToResult(
                foodDataResult,
                foodId,
                primaryFoodInfo,
                requirement,
              );

              if (secondaryFoodId) {
                return addFoodToResult(
                  updatedMap,
                  secondaryFoodId,
                  secondaryFoodInfo,
                  secondaryRequirement,
                );
              }

              return updatedMap;
            }

            return foodDataResult;
          },
          {} as TObject,
        );
        const totalParticipantOrdered = validMemberOrders.filter(
          ([_, memberOrderData]) =>
            (memberOrderData as TCartItem).status ===
            EParticipantOrderStatus.joined,
        ).length;

        return [
          ...groupResult,
          {
            id: groupId,
            name: groupName,
            foodDataList: Object.values(foodDataList), // Chuyển foodDataList thành array
            totalParticipantOrdered,
          },
        ];
      }, []);
      let totalParticipantOrdered = 0;
      // Xử lý các member không có trong nhóm
      const foodDataListForOthers = Object.entries(memberOrders).reduce(
        (foodDataResult, [memberId, memberOrderData]) => {
          // Kiểm tra xem memberId có trong các group không
          const isMemberInAnyGroup = groups.some((group) =>
            group.members.some(
              (member: { id: string }) => member.id === memberId,
            ),
          );

          if (!isMemberInAnyGroup) {
            const {
              foodId,
              status,
              requirement = '',
              secondaryFoodId,
              secondaryRequirement = '',
            } = memberOrderData as TObject;
            const primaryFoodInfo = foodListOfDate[foodId] || {};
            const secondaryFoodInfo = secondaryFoodId
              ? foodListOfDate[secondaryFoodId]
              : {};

            const participantMaybe = participants.find(
              (p) => p?.id?.uuid === memberId,
            );
            const anonymousUserMaybe = anonymous.find(
              (p) => p?.id?.uuid === memberId,
            );
            const { firstName, lastName, displayName } = User(
              (participantMaybe || anonymousUserMaybe) as TUser,
            ).getProfile();
            const participantName = buildFullName(firstName, lastName, {
              compareToGetLongerWith: displayName,
            });

            const addFoodToResult = (
              targetMap: TObject,
              targetFoodId: string,
              foodInfo: TObject,
              foodRequirement: string,
            ) => {
              if (!targetFoodId) {
                return targetMap;
              }

              const { foodName, foodPrice, foodUnit = '' } = foodInfo || {};
              const data = targetMap[targetFoodId] as TObject;
              const { frequency = 0, notes = [] } = data || {};
              const newNote = {
                note: foodRequirement,
                name: participantName,
                memberId,
              };

              const updatedNotes = [...notes];
              if (!isEmpty(foodRequirement)) {
                updatedNotes.splice(0, 0, newNote);
              } else {
                updatedNotes.push(newNote);
              }

              return {
                ...targetMap,
                [targetFoodId]: data
                  ? {
                      ...data,
                      frequency: frequency + 1,
                      notes: updatedNotes,
                    }
                  : {
                      foodId: targetFoodId,
                      foodName,
                      foodUnit,
                      foodPrice,
                      notes: updatedNotes,
                      frequency: 1,
                    },
              };
            };

            if (status === EParticipantOrderStatus.joined && foodId !== '') {
              const updatedMap = addFoodToResult(
                foodDataResult,
                foodId,
                primaryFoodInfo,
                requirement,
              );

              if (secondaryFoodId) {
                return addFoodToResult(
                  updatedMap,
                  secondaryFoodId,
                  secondaryFoodInfo,
                  secondaryRequirement,
                );
              }

              return updatedMap;
            }
            totalParticipantOrdered += 1;
          }

          return foodDataResult;
        },
        {} as TObject,
      );

      return [
        ...result,
        {
          date: d,
          index,
          foodDataList: Object.values(foodDataListForOthers),
          dataOfGroups,
          restaurantId: id,
          totalParticipantOrdered,
        },
      ];
    },
    [] as TObject[],
  );
};

// Written only by server flows (initiate-transaction, transit, payment). Client
// payloads carry them from a loaded copy that may be minutes old.
const SERVER_OWNED_SUB_ORDER_KEYS = [
  'transactionId',
  'lastTransition',
  'isPaid',
] as const;

/**
 * Applies a client-built orderDetail on top of the fresh plan without letting
 * the stale copy roll back server-owned sub-order state. The set of dates and
 * every other field still come from `nextOrderDetail`.
 */
export const keepServerOwnedSubOrderFields = (
  nextOrderDetail: TObject,
  freshOrderDetail: TObject,
): TObject =>
  Object.entries(nextOrderDetail).reduce<TObject>(
    (result, [date, nextSubOrder]) => {
      const freshSubOrder = freshOrderDetail[date];
      if (!nextSubOrder || !freshSubOrder) {
        return { ...result, [date]: nextSubOrder };
      }

      const subOrder: TObject = { ...nextSubOrder };
      SERVER_OWNED_SUB_ORDER_KEYS.forEach((key) => {
        if (key in freshSubOrder) {
          subOrder[key] = freshSubOrder[key];
        } else {
          delete subOrder[key];
        }
      });
      // Cancellation is terminal; a stale copy must not resurrect the date.
      if (freshSubOrder.status === ESubOrderStatus.canceled) {
        subOrder.status = ESubOrderStatus.canceled;
      }

      return { ...result, [date]: subOrder };
    },
    {},
  );

/** Empties every pick whose dish is no longer offered in `foodList`. */
export const clearPicksOutsideFoodList = (
  memberOrders: TObject = {},
  foodList: TObject = {},
) =>
  Object.entries(memberOrders).reduce<{
    memberOrders: TObject;
    clearedMemberIds: string[];
  }>(
    (result, [memberId, pickingFoodData]) => {
      const { foodId = '', ...restPickingData } = pickingFoodData || {};
      if (foodId === '' || !isEmpty(foodList[foodId])) {
        return result;
      }

      return {
        memberOrders: {
          ...result.memberOrders,
          [memberId]: {
            ...restPickingData,
            foodId: '',
            status: EParticipantOrderStatus.empty,
          },
        },
        clearedMemberIds: [...result.clearedMemberIds, memberId],
      };
    },
    { memberOrders: { ...memberOrders }, clearedMemberIds: [] },
  );

/**
 * Merges per-date field patches into the fresh orderDetail. memberOrders are
 * never taken from a patch (participants own them); a restaurant change only
 * clears the fresh picks the new foodList no longer offers. Dates missing from
 * the fresh plan are ignored rather than created.
 */
export const patchSubOrders = (
  freshOrderDetail: TObject,
  patches: TObject,
): TObject =>
  Object.entries(patches).reduce<TObject>(
    (result, [date, patch]) => {
      const freshSubOrder = result[date];
      if (!freshSubOrder || !patch) {
        return result;
      }

      const { memberOrders: _ignored, ...fields } = patch;
      const memberOrders = fields.restaurant
        ? clearPicksOutsideFoodList(
            freshSubOrder.memberOrders,
            fields.restaurant.foodList,
          ).memberOrders
        : freshSubOrder.memberOrders;

      return {
        ...result,
        [date]: {
          ...freshSubOrder,
          ...fields,
          ...(memberOrders && { memberOrders }),
        },
      };
    },
    { ...freshOrderDetail },
  );

export type TParticipantOrderUpdate = {
  currentUserId: string;
  orderDay?: string;
  memberOrders?: TObject;
  orderDays?: string[];
  planData?: TObject;
};

/**
 * Applies one participant's pick to an orderDetail. Shared by processOrder.job
 * (the write) and the participant UI (to show the pick once the job is done).
 */
export const mergeParticipantOrder = (
  orderDetail: TObject,
  {
    currentUserId,
    orderDay,
    memberOrders,
    orderDays,
    planData,
  }: TParticipantOrderUpdate,
): TObject => {
  const setPick = (result: TObject, day: string, pick: unknown) => ({
    ...result,
    [day]: {
      ...result[day],
      memberOrders: { ...result[day]?.memberOrders, [currentUserId]: pick },
    },
  });

  if (orderDay && memberOrders) {
    return setPick(orderDetail, orderDay, memberOrders[currentUserId]);
  }
  if (orderDays && planData) {
    return orderDays.reduce<TObject>((result, day) => {
      const pick = planData[day]?.[currentUserId];

      return pick === undefined ? result : setPick(result, day, pick);
    }, orderDetail);
  }

  return orderDetail;
};

export const getParticipantOrderDays = ({
  orderDay,
  orderDays,
}: Pick<TParticipantOrderUpdate, 'orderDay' | 'orderDays'>): string[] =>
  orderDay ? [orderDay] : orderDays ?? [];

/** The plan as processOrder.job wrote it, without refetching it. */
export const applyParticipantOrderToPlan = (
  plan: TListing,
  update: Omit<TParticipantOrderUpdate, 'currentUserId'> & { planId: string },
  currentUserId: string,
): TListing => {
  if (plan?.id?.uuid !== update.planId) {
    return plan;
  }

  const metadata = Listing(plan).getMetadata();

  return {
    ...plan,
    attributes: {
      ...plan.attributes,
      metadata: {
        ...metadata,
        orderDetail: mergeParticipantOrder(metadata.orderDetail || {}, {
          ...update,
          currentUserId,
        }),
      },
    },
  };
};

export type TClearedPick = {
  date: string;
  memberId: string;
  foodName: string;
};

/**
 * The picks a sub-order edit will clear on save: same rule as patchSubOrders,
 * applied to the fresh plan so picks made after the editor opened are listed.
 */
export const getPicksClearedByEdit = (
  freshOrderDetail: TObject,
  editedOrderDetail: TObject,
): TClearedPick[] =>
  Object.entries(editedOrderDetail).flatMap(([date, editedSubOrder]) => {
    const freshSubOrder = freshOrderDetail[date];
    const editedFoodList = editedSubOrder?.restaurant?.foodList;
    if (!freshSubOrder || !editedFoodList) {
      return [];
    }

    const freshFoodList = freshSubOrder.restaurant?.foodList || {};

    return clearPicksOutsideFoodList(
      freshSubOrder.memberOrders,
      editedFoodList,
    ).clearedMemberIds.map((memberId) => {
      const { foodId } = freshSubOrder.memberOrders[memberId];

      return {
        date,
        memberId,
        foodName: freshFoodList[foodId]?.foodName || foodId,
      };
    });
  });
