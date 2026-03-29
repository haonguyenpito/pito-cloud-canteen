import omit from 'lodash/omit';

import logger from '@helpers/logger';
import { fetchListing, fetchUser } from '@services/integrationHelper';
import { createSlackNotification } from '@services/slackNotification';
import { Listing, User } from '@src/utils/data';
import { ESlackNotificationType } from '@src/utils/enums';
import type { TPlan } from '@src/utils/orderTypes';

import { buildFullName } from './emailTemplate/participantOrderPicking';

// Utility types for better type safety
export type OrderStatus = 'joined' | 'empty' | 'notJoined';
export type UserActionType =
  | 'addFood'
  | 'removeFood'
  | 'changeFood'
  | 'changeRequirement'
  | 'statusChanged';

export interface OrderEntry {
  status?: OrderStatus;
  foodId?: string;
  requirement?: string;
}

export interface UserPlanData {
  [day: string]: OrderEntry;
}

export interface UserAction {
  type: UserActionType;
  date: string;
  foodId?: string;
  requirement?: string;
  time: string;
  foodName?: string;
  fromFoodId?: string;
  fromFoodName?: string;
  toFoodId?: string;
  toFoodName?: string;
}

export interface VerifyPersistenceParams {
  orderId: string;
  planId: string;
  currentUserId: string;
  jobId: string;
  jobStartTime: number;
  orderDay?: string;
  orderDays?: string[];
  expectedUserPlan: Record<string, any>;
  actualUserPlan: Record<string, any>;
  userActions: UserAction[];
}

export interface DiffTableRow {
  date: string;
  expected: {
    foodId?: string;
    foodName?: string;
    status?: string;
    requirement?: string;
  };
  actual: {
    foodId?: string;
    foodName?: string;
    status?: string;
    requirement?: string;
  };
}

export interface MissingOrderSlackNotificationBody {
  orderId?: string;
  orderLink: string;
  orderCode: string;
  orderName: string;
  planId: string;
  userId: string;
  userName?: string;
  actions: UserAction[];
  expected: Record<string, any>;
  actual: Record<string, any>;
  diffTable: DiffTableRow[];
  failedAt: string;
  service: string;
  jobId: string;
  orderDays: string[];
  isSingleDay: boolean;
  totalJobDurationMs: number;
  error?: string;
  threadTs?: string;
  metrics?: {
    waiting: number;
    active: number;
  };
}

/**
 * Verify order persistence after lock release
 * Compares expected vs actual data and sends Slack notification if mismatch
 */
export async function verifyOrderPersistence({
  orderId,
  planId,
  currentUserId,
  jobId,
  jobStartTime,
  orderDay,
  orderDays,
  expectedUserPlan,
  actualUserPlan,
  userActions,
}: VerifyPersistenceParams): Promise<void> {
  try {
    logger.info('[TRACK] verifyOrderPersistence@CheckingOrderPersistence', {
      orderId,
      planId,
      currentUserId,
      jobId,
      jobStartTime,
      orderDay,
      orderDays,
      expectedUserPlan,
      actualUserPlan,
      userActions,
    });
    // Find mismatch days
    const daysToCheck = orderDay ? [orderDay] : orderDays || [];
    const mismatchDays = daysToCheck.filter((day) => {
      const expected = expectedUserPlan[day] || {};
      const actual = actualUserPlan[day] || {};

      return (
        (expected.foodId || '') !== (actual.foodId || '') ||
        (expected.status || '') !== (actual.status || '') ||
        (expected.requirement || '') !== (actual.requirement || '')
      );
    });

    if (mismatchDays.length === 0) {
      logger.info(
        '[TRACK] verifyOrderPersistence@processOrder.job: ',
        'step=verify_after_release success - no mismatches',
      );

      return;
    }

    logger.info(
      '[TRACK] verifyOrderPersistence@processOrder.job: step=verify_after_release mismatch',
      {
        mismatchDays,
        expected: expectedUserPlan,
        actual: actualUserPlan,
      },
    );

    // Fetch user name
    let userName: string | undefined;
    try {
      const user = await fetchUser(currentUserId);
      const {
        lastName = '',
        firstName = '',
        displayName,
      } = User(user).getProfile();
      userName = buildFullName(firstName, lastName, {
        compareToGetLongerWith: displayName,
      });
    } catch (userErr) {
      userName = undefined;
    }

    // Collect and resolve food names from diffs and actions
    const collectFoodIds = new Set<string>();
    mismatchDays.forEach((day) => {
      const exp = expectedUserPlan[day] || {};
      const act = actualUserPlan[day] || {};
      if (exp?.foodId) collectFoodIds.add(exp.foodId as string);
      if (act?.foodId) collectFoodIds.add(act.foodId as string);
    });
    userActions.forEach((a) => {
      if (a.foodId) collectFoodIds.add(a.foodId as string);
      if (a.fromFoodId) collectFoodIds.add(a.fromFoodId as string);
      if (a.toFoodId) collectFoodIds.add(a.toFoodId as string);
    });

    // Fetch food names
    const foodNameMap = new Map<string, string>();
    try {
      const foodListings = await Promise.all(
        Array.from(collectFoodIds).map(async (foodId) => {
          try {
            const listing = await fetchListing(foodId);

            return { foodId, foodName: Listing(listing).getAttributes().title };
          } catch {
            return { foodId, foodName: foodId };
          }
        }),
      );
      foodListings.forEach(({ foodId, foodName }) => {
        foodNameMap.set(foodId, foodName);
      });
    } catch (foodErr) {
      logger.warn(
        '[TRACK] verifyOrderPersistence@processOrder.job: Failed to fetch food names:',
        foodErr as unknown as string,
      );
    }

    // Enrich user actions with food names
    const enrichedActions = userActions.map((action) => ({
      ...action,
      foodName: action.foodId ? foodNameMap.get(action.foodId) : undefined,
      fromFoodName: action.fromFoodId
        ? foodNameMap.get(action.fromFoodId)
        : undefined,
      toFoodName: action.toFoodId
        ? foodNameMap.get(action.toFoodId)
        : undefined,
    }));

    // Build diff table
    const diffTable: DiffTableRow[] = mismatchDays.map((day) => {
      const expected = expectedUserPlan[day] || {};
      const actual = actualUserPlan[day] || {};

      return {
        date: day,
        expected: {
          foodId: expected.foodId,
          foodName: expected.foodId
            ? foodNameMap.get(expected.foodId)
            : undefined,
          status: expected.status,
          requirement: expected.requirement,
        },
        actual: {
          foodId: actual.foodId,
          foodName: actual.foodId ? foodNameMap.get(actual.foodId) : undefined,
          status: actual.status,
          requirement: actual.requirement,
        },
      };
    });

    // Build order link
    const orderLink = `${
      process.env.NEXT_PUBLIC_APP_URL || ''
    }/participant/orders/${orderId}`;
    const orderCode = orderId;
    const orderName = `Order #${orderCode}`;

    const slackBody: MissingOrderSlackNotificationBody = {
      orderId,
      orderLink,
      orderCode,
      orderName,
      planId,
      userId: currentUserId,
      userName,
      actions: enrichedActions,
      expected: expectedUserPlan,
      actual: actualUserPlan,
      diffTable,
      failedAt: 'post-verify-after-release',
      service: 'processOrder.job',
      jobId,
      orderDays: daysToCheck,
      isSingleDay: Boolean(orderDay),
      totalJobDurationMs: Date.now() - jobStartTime,
    };

    await createSlackNotification(
      ESlackNotificationType.PARTICIPANT_ORDER_PERSISTENCE_FAILED,
      slackBody as any,
    );

    logger.info(
      '[TRACK] verifyOrderPersistence@processOrder.job: ',
      'step=verify_after_release success - notification sent',
    );
  } catch (verifyAfterReleaseError) {
    console.error(
      '[RACE_DEBUG] Verification after release failed:',
      verifyAfterReleaseError,
    );
    throw verifyAfterReleaseError;
  }
}

/**
 * Build expected user plan from order data
 */
export function buildExpectedUserPlan(
  orderDays: string[],
  planData: Record<string, Record<string, any>>,
  currentUserId: string,
): Record<string, any> {
  const expectedUserPlan: Record<string, any> = {};
  orderDays.forEach((day) => {
    const newEntry = planData?.[day]?.[currentUserId] || {};
    expectedUserPlan[day] = newEntry;
  });

  return expectedUserPlan;
}

/**
 * Build user actions by comparing old vs new data
 */
export function buildUserActions(
  orderDays: string[],
  planData: Record<string, Record<string, any>>,
  currentUserId: string,
  originalOrderDetailBefore: Record<string, any>,
): UserAction[] {
  const userActions: UserAction[] = [];
  const nowIso = new Date().toISOString();

  orderDays.forEach((day) => {
    const newEntry = planData?.[day]?.[currentUserId] || {};
    const oldEntry =
      originalOrderDetailBefore?.[day]?.memberOrders?.[currentUserId] || {};

    if ((oldEntry?.status || '') !== (newEntry?.status || '')) {
      userActions.push({
        type: 'statusChanged',
        date: day,
        foodId: newEntry?.foodId,
        requirement: newEntry?.requirement,
        time: nowIso,
      });
    }
    if ((oldEntry?.foodId || '') !== (newEntry?.foodId || '')) {
      userActions.push({
        type: newEntry?.foodId
          ? oldEntry?.foodId
            ? 'changeFood'
            : 'addFood'
          : 'removeFood',
        date: day,
        foodId: newEntry?.foodId,
        fromFoodId: oldEntry?.foodId,
        toFoodId: newEntry?.foodId,
        requirement: newEntry?.requirement,
        time: nowIso,
      });
    }
    if ((oldEntry?.requirement || '') !== (newEntry?.requirement || '')) {
      userActions.push({
        type: 'changeRequirement',
        date: day,
        foodId: newEntry?.foodId,
        requirement: newEntry?.requirement,
        time: nowIso,
      });
    }
  });

  return userActions;
}

/**
 * Build actual user plan from fresh plan data
 */
export function buildActualUserPlan(
  freshPlan: any,
  currentUserId: string,
  orderDays: string[],
): Record<string, any> {
  const actualUserPlan: Record<string, any> = {};
  const updatedMetadata = Listing(freshPlan).getMetadata() || {};
  const updatedOrderDetail = updatedMetadata.orderDetail || {};

  orderDays.forEach((day) => {
    const actualEntry =
      updatedOrderDetail?.[day]?.memberOrders?.[currentUserId] || {};
    actualUserPlan[day] = actualEntry;
  });

  return actualUserPlan;
}

export type TOrderDetail = TPlan['orderDetail'];

export function removeParticipantFromOrderDetail(
  orderDetail: TOrderDetail,
  participantId: string,
): TOrderDetail {
  return (
    Object.entries(orderDetail) as [string, TOrderDetail[string]][]
  ).reduce<TOrderDetail>((result, [date, dayDetail]) => {
    const memberOrders = dayDetail.memberOrders ?? {};

    return {
      ...result,
      [date]: {
        ...dayDetail,
        memberOrders: omit(memberOrders, participantId),
      },
    };
  }, {});
}
