import type { MemberOrderValue } from '@src/types';
import {
  EEditSubOrderHistoryType,
  EParticipantOrderStatus,
} from '@src/utils/enums';
import type {
  TSubOrderChangeHistoryItem,
  TSubOrderChangeHistoryValue,
} from '@src/utils/types';
import { isOver } from '@utils/dates';

type FoodListEntry = {
  foodName?: string;
  foodPrice?: number;
};

export function resolveMemberFoodHistoryType(
  oldMemberOrder?: Partial<MemberOrderValue>,
  newMemberOrder?: Partial<MemberOrderValue>,
): EEditSubOrderHistoryType | null {
  const oldFoodId = oldMemberOrder?.foodId || '';
  const newFoodId = newMemberOrder?.foodId || '';
  const oldSecondaryFoodId = oldMemberOrder?.secondaryFoodId || '';
  const newSecondaryFoodId = newMemberOrder?.secondaryFoodId || '';

  const hadJoinedFood =
    !!oldFoodId &&
    (oldMemberOrder?.status === EParticipantOrderStatus.joined ||
      oldMemberOrder?.status === EParticipantOrderStatus.notAllowed);

  const hasJoinedFood =
    !!newFoodId && newMemberOrder?.status === EParticipantOrderStatus.joined;

  if (!hasJoinedFood) {
    return null;
  }

  if (!hadJoinedFood || !oldFoodId) {
    return EEditSubOrderHistoryType.MEMBER_FOOD_ADDED;
  }

  if (oldFoodId !== newFoodId || oldSecondaryFoodId !== newSecondaryFoodId) {
    return EEditSubOrderHistoryType.MEMBER_FOOD_CHANGED;
  }

  return null;
}

function buildFoodHistoryValue(
  foodId: string | undefined,
  foodList: Record<string, FoodListEntry>,
): TSubOrderChangeHistoryValue | null {
  if (!foodId) {
    return null;
  }

  const { foodName, foodPrice } = foodList[foodId] || {};

  return {
    foodId,
    foodName,
    foodPrice,
  };
}

export function buildSubOrderHistoryEntryFromMemberOrderDiff({
  memberId,
  planId,
  planOrderDate,
  authorRole,
  oldMemberOrder,
  newMemberOrder,
  foodList = {},
}: {
  memberId: string;
  planId: string;
  planOrderDate: number;
  authorRole: 'admin' | 'booker';
  oldMemberOrder?: Partial<MemberOrderValue>;
  newMemberOrder?: Partial<MemberOrderValue>;
  foodList?: Record<string, FoodListEntry>;
}): TSubOrderChangeHistoryItem | null {
  const type = resolveMemberFoodHistoryType(oldMemberOrder, newMemberOrder);

  if (!type) {
    return null;
  }

  const oldFoodId = oldMemberOrder?.foodId || '';
  const newFoodId = newMemberOrder?.foodId || '';
  const oldSecondaryFoodId = oldMemberOrder?.secondaryFoodId;
  const newSecondaryFoodId = newMemberOrder?.secondaryFoodId;

  const oldPrimaryValue = buildFoodHistoryValue(oldFoodId, foodList);
  const oldValue: TSubOrderChangeHistoryValue | null =
    type === EEditSubOrderHistoryType.MEMBER_FOOD_CHANGED && oldPrimaryValue
      ? {
          ...oldPrimaryValue,
          ...(oldSecondaryFoodId && {
            secondaryFoodId: oldSecondaryFoodId,
            secondaryFoodName: foodList[oldSecondaryFoodId]?.foodName,
            secondaryFoodPrice: foodList[oldSecondaryFoodId]?.foodPrice,
          }),
        }
      : null;

  const newPrimaryValue = buildFoodHistoryValue(newFoodId, foodList);
  const newValue: TSubOrderChangeHistoryValue = {
    ...(newPrimaryValue || { foodId: newFoodId }),
    ...(newSecondaryFoodId && {
      secondaryFoodId: newSecondaryFoodId,
      secondaryFoodName: foodList[newSecondaryFoodId]?.foodName,
      secondaryFoodPrice: foodList[newSecondaryFoodId]?.foodPrice,
    }),
  };

  return {
    planId,
    memberId,
    planOrderDate: planOrderDate as unknown as Date,
    type,
    authorRole,
    oldValue: oldValue ?? undefined,
    newValue,
    createdAt: new Date(),
  };
}

export async function persistMemberOrderHistoryAfterDeadline({
  deadlineDate,
  planId,
  planOrderDate,
  authorRole,
  oldMemberOrders,
  newMemberOrders,
  foodList,
  memberIdsFilter,
  createRecord,
}: {
  deadlineDate?: number;
  planId: string;
  planOrderDate: number;
  authorRole: 'admin' | 'booker';
  oldMemberOrders: Record<string, Partial<MemberOrderValue>>;
  newMemberOrders: Record<string, Partial<MemberOrderValue>>;
  foodList?: Record<string, FoodListEntry>;
  /** When set, only these members are checked for history (this request's updates). */
  memberIdsFilter?: string[];
  createRecord: (entry: TSubOrderChangeHistoryItem) => Promise<unknown>;
}) {
  if (!deadlineDate || !isOver(deadlineDate)) {
    return;
  }

  const memberIds =
    memberIdsFilter && memberIdsFilter.length > 0
      ? memberIdsFilter
      : Array.from(
          new Set([
            ...Object.keys(oldMemberOrders),
            ...Object.keys(newMemberOrders),
          ]),
        );

  await Promise.all(
    memberIds.map(async (memberId) => {
      const entry = buildSubOrderHistoryEntryFromMemberOrderDiff({
        memberId,
        planId,
        planOrderDate,
        authorRole,
        oldMemberOrder: oldMemberOrders[memberId],
        newMemberOrder: newMemberOrders[memberId],
        foodList,
      });

      if (entry) {
        await createRecord(entry);
      }
    }),
  );
}
