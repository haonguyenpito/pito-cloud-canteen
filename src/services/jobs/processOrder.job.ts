import type { Job } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import groupBy from 'lodash/groupBy';
import uniq from 'lodash/uniq';

import { mergeParticipantOrder } from '@helpers/order/orderDetailHelper';
import { getParticipantPickClosedReason } from '@helpers/orderHelper';
import { setOrderJobStatus } from '@helpers/orderJobStatus';
import { DistributedLock } from '@services/distributedLock';
import { fetchListing } from '@services/integrationHelper';
import { defaultQueueConfig } from '@services/queues/config';
import { lockRedisConnection, redisConnection } from '@services/redis';
import { getIntegrationSdk } from '@services/sdk';
import { createSlackNotification } from '@services/slackNotification';
import { Listing } from '@src/utils/data';
import { ESlackNotificationType } from '@src/utils/enums';
import {
  buildActualUserPlan,
  buildExpectedUserPlan,
  buildUserActions,
  verifyOrderPersistence,
} from '@src/utils/order';

const queueName = 'processOrder';

/** One participant pick, as sent by the participant UI. */
export type TParticipantPick = {
  orderId: any;
  planId: any;
  currentUserId: string;
  /** Per-click id; the participant UI waits for this id's status in Firestore. */
  submissionId: string;
  orderDay?: string;
  memberOrders?: Record<string, any>;
  orderDays?: string[];
  planData?: Record<string, Record<string, any>>;
};

type TPendingPick = TParticipantPick & { seq: number };

/**
 * The pick is written from `pending:plan:{planId}` (`pending: true`). The job
 * still carries the pick so a pre-batching worker, alive during a rolling
 * deploy, writes it the old way; a job without `pending` was queued by such a
 * worker and its pick is not in the hash yet.
 */
type ProcessOrderJobData = Pick<
  TParticipantPick,
  'orderId' | 'planId' | 'currentUserId'
> &
  Partial<TParticipantPick> & { pending?: boolean };

// Picks are written in batches: whoever holds the plan lock writes every pick
// queued for the plan in one Sharetribe update, so N simultaneous picks cost a
// few writes instead of N serialized ones.
const PENDING_TTL_SECONDS = 24 * 60 * 60;
const MAX_BATCH_SIZE = 200;
// Pending picks and the plan lock fail fast while Redis is down; the queue
// itself keeps BullMQ's own connection.
const redis = lockRedisConnection as Redis;
const pendingKey = (planId: string) => `pending:plan:${planId}`;
const seqKey = (planId: string) => `pending:seq:${planId}`;

const isLegacyJob = ({ pending }: ProcessOrderJobData) => !pending;

const addPendingPick = async (
  pick: TParticipantPick,
  { onlyIfAbsent = false } = {},
) => {
  // A Redis counter, not a clock: ECS tasks may disagree on the time, and a
  // later pick of the same user must always be applied last.
  const seq = await redis.incr(seqKey(pick.planId));
  const value = JSON.stringify({ ...pick, seq });
  if (onlyIfAbsent) {
    await redis.hsetnx(pendingKey(pick.planId), pick.submissionId, value);
  } else {
    await redis.hset(pendingKey(pick.planId), pick.submissionId, value);
  }
  await Promise.all([
    redis.expire(pendingKey(pick.planId), PENDING_TTL_SECONDS),
    redis.expire(seqKey(pick.planId), PENDING_TTL_SECONDS),
  ]);
};

const readPendingPicks = async (planId: string, onlySubmissionId?: string) => {
  const raw: Record<string, string> = onlySubmissionId
    ? Object.fromEntries(
        [
          [
            onlySubmissionId,
            await redis.hget(pendingKey(planId), onlySubmissionId),
          ],
        ].filter(([, value]) => value !== null),
      )
    : (await redis.hgetall(pendingKey(planId))) ?? {};

  return Object.entries(raw).reduce<{
    picks: TPendingPick[];
    malformedIds: string[];
  }>(
    (result, [submissionId, value]) => {
      try {
        return {
          ...result,
          picks: [...result.picks, JSON.parse(value) as TPendingPick],
        };
      } catch {
        return {
          ...result,
          malformedIds: [...result.malformedIds, submissionId],
        };
      }
    },
    { picks: [], malformedIds: [] },
  );
};

const setPickStatus = (
  pick: TParticipantPick,
  status: 'processing' | 'completed' | 'failed',
  error?: string,
) =>
  setOrderJobStatus({
    planId: pick.planId,
    userId: pick.currentUserId,
    submissionId: pick.submissionId,
    status,
    error,
  }).catch((statusError) =>
    console.error('[RACE_DEBUG] Order job status write failed:', statusError),
  );

/** Adds users who are neither participants nor anonymous yet, once per order. */
const addNewUsersToAnonymous = async (picks: TPendingPick[]) => {
  const sdk = getIntegrationSdk();

  await Promise.all(
    Object.entries(groupBy(picks, 'orderId')).map(
      async ([orderId, orderPicks]) => {
        const { participants = [], anonymous = [] } =
          Listing(await fetchListing(orderId)).getMetadata() ?? {};
        const newUserIds = uniq(
          orderPicks.map(({ currentUserId }) => currentUserId),
        ).filter(
          (userId) =>
            !participants.includes(userId) && !anonymous.includes(userId),
        );
        if (newUserIds.length > 0) {
          await sdk.listings.update({
            id: orderId,
            metadata: { anonymous: [...anonymous, ...newUserIds] },
          });
        }
      },
    ),
  );
};

const verifyWrittenPicks = async (
  planId: string,
  picks: TPendingPick[],
  orderDetailBefore: Record<string, any>,
  { jobId, jobStartTime }: { jobId: string; jobStartTime: number },
) => {
  const freshPlan = await fetchListing(planId);

  await Promise.all(
    picks.map(
      ({ orderId, currentUserId, orderDay, orderDays, planData = {} }) => {
        const daysToCheck = orderDay ? [String(orderDay)] : orderDays ?? [];

        return verifyOrderPersistence({
          orderId,
          planId,
          currentUserId,
          jobId,
          jobStartTime,
          orderDay,
          orderDays: daysToCheck,
          expectedUserPlan: buildExpectedUserPlan(
            daysToCheck,
            planData,
            currentUserId,
          ),
          actualUserPlan: buildActualUserPlan(
            freshPlan,
            currentUserId,
            daysToCheck,
          ),
          userActions: buildUserActions(
            daysToCheck,
            planData,
            currentUserId,
            orderDetailBefore,
          ),
        });
      },
    ),
  );
};

// Queue setup
const processOrderQueue = new Queue<ProcessOrderJobData>(queueName, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultQueueConfig,
    // Also the window in which a burst of picks gathers into one batch.
    delay: 500,
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Worker definition
const worker = new Worker<ProcessOrderJobData>(
  queueName,
  async (job: Job<ProcessOrderJobData>) => {
    const jobStartTime = Date.now();
    const { orderId, planId, currentUserId } = job.data;
    const submissionId = job.data.submissionId ?? String(job.id);

    if (isLegacyJob(job.data) && job.attemptsMade === 0) {
      await addPendingPick({ ...job.data, submissionId } as TParticipantPick, {
        onlyIfAbsent: true,
      });
    }

    // Already written by another job's batch: nothing left to do.
    if (!(await redis.hexists(pendingKey(planId), submissionId))) {
      console.log(
        `[RACE_DEBUG] Pick already written by a batch - planId: ${planId}, userId: ${currentUserId}, jobId: ${job.id}`,
      );

      return null;
    }

    await setPickStatus(
      { orderId, planId, currentUserId, submissionId },
      'processing',
    );

    // A retry writes only its own pick, so a pick Sharetribe rejects cannot
    // keep failing every batch it lands in.
    const ownPickOnly = job.attemptsMade > 0;
    // ~90s of 300ms-capped retries while earlier batches are written.
    const lock = new DistributedLock(redis, `plan:${planId}`, {
      ttl: 30000,
      retryDelay: 100,
      maxRetries: 300,
    });
    let writtenPicks: TPendingPick[] = [];
    let rejectedPicks: { pick: TPendingPick; error: string }[] = [];
    let pickClosedReason: string | null = null;
    let orderDetailBefore: Record<string, any> = {};

    try {
      if (!(await lock.acquire())) {
        throw new Error(`Failed to acquire lock for planId: ${planId}`);
      }

      try {
        const { picks, malformedIds } = await readPendingPicks(
          planId,
          ownPickOnly ? submissionId : undefined,
        );
        if (malformedIds.length > 0) {
          console.error(
            `[RACE_DEBUG] Dropping malformed pending picks - planId: ${planId}, submissionIds: ${malformedIds.join(
              ', ',
            )}`,
          );
          await redis.hdel(pendingKey(planId), ...malformedIds);
        }
        const batch = picks
          .sort((a, b) => a.seq - b.seq)
          .slice(0, MAX_BATCH_SIZE);
        if (batch.length === 0) {
          return null;
        }

        const [orderListing, planListing] = await Promise.all([
          fetchListing(orderId as string),
          fetchListing(planId),
        ]);
        const {
          participants: knownParticipants = [],
          anonymous: knownAnonymous = [],
        } = Listing(orderListing).getMetadata() ?? {};
        orderDetailBefore =
          Listing(planListing).getMetadata()?.orderDetail ?? {};
        // Checked under the lock: start-order moves the order out of picking
        // before initiate-transaction takes this lock, so a batch written
        // after the order started is always refused here.
        pickClosedReason = getParticipantPickClosedReason(orderListing);
        if (pickClosedReason) {
          const reason = pickClosedReason;
          rejectedPicks = batch.map((pick) => ({ pick, error: reason }));
        }
        // A pick that cannot be merged is failed alone, not with its batch.
        const orderDetail = (pickClosedReason ? [] : batch).reduce<
          Record<string, any>
        >((result, pick) => {
          try {
            const merged = mergeParticipantOrder(result, pick);
            writtenPicks = [...writtenPicks, pick];

            return merged;
          } catch (error) {
            rejectedPicks = [
              ...rejectedPicks,
              { pick, error: (error as Error).message },
            ];

            return result;
          }
        }, orderDetailBefore);

        if (writtenPicks.length > 0) {
          await lock.extend();
          await getIntegrationSdk().listings.update({
            id: planId,
            metadata: { orderDetail },
          });

          const unknownPickers = writtenPicks.filter(
            ({ currentUserId: userId }) =>
              !knownParticipants.includes(userId) &&
              !knownAnonymous.includes(userId),
          );
          if (unknownPickers.length > 0) {
            await addNewUsersToAnonymous(unknownPickers);
          }
        }

        // Removed right after the write: a crash in between only makes the
        // next batch re-apply these same picks (later picks keep a higher seq).
        await redis.hdel(
          pendingKey(planId),
          ...batch.map((pick) => pick.submissionId),
        );
      } finally {
        await lock.release();
      }
    } catch (error) {
      // Picks stay pending: this job retries, and any other job on the plan
      // writes them in its own batch meanwhile.
      console.error(
        `[RACE_DEBUG] Batch write failed after ${Date.now() - jobStartTime}ms:`,
        {
          planId,
          currentUserId,
          orderId,
          jobId: job.id,
          attemptsMade: job.attemptsMade,
          ownPickOnly,
          error: error instanceof Error ? error.message : error,
        },
      );
      throw error;
    }

    await Promise.all([
      ...writtenPicks.map((pick) => setPickStatus(pick, 'completed')),
      ...rejectedPicks.map(({ pick, error }) =>
        setPickStatus(pick, 'failed', error),
      ),
    ]);
    console.log(
      `[RACE_DEBUG] Batch written - planId: ${planId}, jobId: ${
        job.id
      }, written: ${writtenPicks.length}, rejected: ${
        rejectedPicks.length
      }, duration: ${Date.now() - jobStartTime}ms`,
    );

    // A closed order is an expected refusal, not lost data: no alert.
    if (rejectedPicks.length > 0 && !pickClosedReason) {
      await createSlackNotification(
        ESlackNotificationType.PARTICIPANT_ORDER_PERSISTENCE_FAILED,
        {
          service: 'processOrder.job',
          failedAt: 'merge-rejected',
          orderId,
          planId,
          userId: rejectedPicks.map(({ pick }) => pick.currentUserId).join(','),
          error: rejectedPicks.map(({ error }) => error).join('; '),
          jobId: job.id,
        } as any,
      ).catch((notifyError) =>
        console.error('[RACE_DEBUG] Slack notify failed:', notifyError),
      );
    }

    try {
      await verifyWrittenPicks(planId, writtenPicks, orderDetailBefore, {
        jobId: job.id as string,
        jobStartTime,
      });
    } catch (verifyError) {
      console.error(
        '[RACE_DEBUG] Verification after release failed:',
        verifyError,
      );
    }

    return { written: writtenPicks.length, rejected: rejectedPicks.length };
  },
  {
    connection: redisConnection,
    concurrency: 5,
    maxStalledCount: 1,
    stalledInterval: 30000,
  },
);

// Job events
worker.on('error', (error) => {
  console.error('[RACE_DEBUG] Worker error:', error);
});

worker.on('stalled', (jobId) => {
  console.warn(
    `[RACE_DEBUG] Job stalled - this may indicate a race condition or deadlock: ${jobId}`,
  );
});

worker.on('failed', async (job, error) => {
  console.error('[RACE_DEBUG] Job failed:', {
    jobId: job?.id,
    planId: job?.data?.planId,
    userId: job?.data?.currentUserId,
    orderId: job?.data?.orderId,
    error: error.message,
    attemptsMade: job?.attemptsMade,
  });

  // Earlier attempts are retried; only the final failure gives the pick up.
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) {
    return;
  }
  const { orderId, planId, currentUserId } = job.data;
  const submissionId = job.data.submissionId ?? String(job.id);
  try {
    // 0 means another job's batch already wrote this pick: it did not fail.
    const removed = await redis.hdel(pendingKey(planId), submissionId);
    if (!removed) {
      return;
    }
    if (job.data.submissionId) {
      await setPickStatus(
        { orderId, planId, currentUserId, submissionId },
        'failed',
        error.message,
      );
    }
    await createSlackNotification(
      ESlackNotificationType.PARTICIPANT_ORDER_PERSISTENCE_FAILED,
      {
        orderLink: `${
          process.env.NEXT_PUBLIC_APP_URL || ''
        }/participant/orders/${orderId}`,
        orderCode: '',
        orderName: '',
        planId,
        userId: currentUserId,
        actions: [],
        expected: {},
        actual: {},
        failedAt: 'job-exception',
        service: 'processOrder.job',
        jobId: job.id,
        error: error.message,
      } as any,
    );
  } catch (handlerError) {
    console.error('[RACE_DEBUG] Final failure handling failed:', handlerError);
  }
});

/**
 * Queues a participant pick and returns at once; the participant UI follows
 * it through its Firestore status doc.
 */
export const enqueueParticipantOrder = async (
  data: Omit<TParticipantPick, 'submissionId'>,
) => {
  const submissionId = randomUUID();
  // Written before queueing so a fast worker's later status is never
  // overwritten by `queued`.
  await setOrderJobStatus({
    planId: data.planId,
    userId: data.currentUserId,
    submissionId,
    status: 'queued',
  });
  // Pending before the job exists, so the job always finds its pick.
  await addPendingPick({ ...data, submissionId });

  const job = await processOrderQueue.add(
    queueName,
    { ...data, submissionId, pending: true },
    { jobId: submissionId },
  );

  return { jobId: job.id as string, submissionId };
};

// Shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await processOrderQueue.close();
  process.exit(0);
});

export { processOrderQueue, worker };
