import type { Job } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';

import { mergeParticipantOrder } from '@helpers/order/orderDetailHelper';
import { setOrderJobStatus } from '@helpers/orderJobStatus';
import { DistributedLock } from '@services/distributedLock';
import { fetchListing } from '@services/integrationHelper';
import { defaultQueueConfig } from '@services/queues/config';
import { redisConnection } from '@services/redis';
import { getIntegrationSdk } from '@services/sdk';
import { createSlackNotification } from '@services/slackNotification';
import { denormalisedResponseEntities, Listing } from '@src/utils/data';
import { ESlackNotificationType } from '@src/utils/enums';
import {
  buildActualUserPlan,
  buildExpectedUserPlan,
  buildUserActions,
  verifyOrderPersistence,
} from '@src/utils/order';

const queueName = 'processOrder';

export interface QueueInterface {
  orderId: any;
  title: any;
  amount: number;
}

interface ProcessOrderJobData {
  orderId: any;
  planId: any;
  memberOrders?: Record<string, any>;
  orderDay?: string;
  orderDays?: string[];
  planData?: Record<string, Record<string, any>>;
  currentUserId: string;
  /** Per-click id; the participant UI waits for this id's status in Firestore. */
  submissionId?: string;
}

type AddToQueueData = Pick<ProcessOrderJobData, 'orderId' | 'currentUserId'> &
  Partial<ProcessOrderJobData>;

// Queue setup
const processOrderQueue = new Queue<AddToQueueData>(queueName, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultQueueConfig,
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
    const {
      orderId,
      planId,
      memberOrders,
      orderDay,
      orderDays,
      planData,
      currentUserId,
      submissionId,
    } = job.data;

    console.log('worker@@planData:', {
      planData: JSON.stringify(planData),
    });

    console.log(
      `[RACE_DEBUG] Job started - planId: ${planId}, userId: ${currentUserId}, orderId: ${orderId}, jobId: ${
        job.id
      }, timestamp: ${new Date().toISOString()}`,
    );

    const sdk = getIntegrationSdk();
    let originalOrderDetailBefore: Record<string, any> = {};
    let isPersisted = false;
    // ~90s of 300ms-capped retries: a burst of picks on one plan queues here
    // rather than exhausting the job's attempts.
    const lock = new DistributedLock(
      redisConnection as Redis,
      `plan:${planId}`,
      {
        ttl: 30000,
        retryDelay: 100,
        maxRetries: 300,
      },
    );

    if (submissionId) {
      await setOrderJobStatus({
        planId,
        userId: currentUserId,
        submissionId,
        status: 'processing',
      }).catch((error) =>
        console.error('[RACE_DEBUG] Order job status write failed:', error),
      );
    }

    try {
      // Read outside the lock only to decide whether `anonymous` needs an
      // update; the update itself re-reads the order under the lock.
      const {
        participants: knownParticipants = [],
        anonymous: knownAnonymous = [],
      } = Listing(await fetchListing(orderId as string)).getMetadata() ?? {};
      const shouldAddToAnonymous =
        !knownParticipants.includes(currentUserId) &&
        !knownAnonymous.includes(currentUserId);

      console.log(
        `[RACE_DEBUG] Attempting to acquire lock for planId: ${planId}, userId: ${currentUserId}`,
      );

      const lockAcquired = await lock.acquire();
      if (!lockAcquired) {
        console.error(
          `[RACE_DEBUG] CRITICAL: Failed to acquire lock for planId: ${planId}, userId: ${currentUserId} after all retries`,
        );
        throw new Error(`Failed to acquire lock for planId: ${planId}`);
      }

      const lockAcquiredTime = Date.now();
      console.log(
        `[RACE_DEBUG] Lock acquired for planId: ${planId}, user: ${currentUserId}, lock acquisition took: ${
          lockAcquiredTime - jobStartTime
        }ms`,
      );
      await job.updateProgress(50);

      console.log(
        `[RACE_DEBUG] Fetching fresh plan data for planId: ${planId}, userId: ${currentUserId}`,
      );

      // Re-fetch fresh plan before mutation
      const updatingPlan = await fetchListing(planId as string);
      const currentMetadata = Listing(updatingPlan).getMetadata() ?? {};
      const currentOrderDetail = currentMetadata.orderDetail ?? {};

      // Log the current state before modification
      console.log(
        `[RACE_DEBUG] Current orderDetail state for planId: ${planId}, userId: ${currentUserId}:`,
        JSON.stringify(currentOrderDetail, null, 2),
      );

      const originalOrderDetail = JSON.parse(
        JSON.stringify(currentOrderDetail),
      );
      originalOrderDetailBefore = originalOrderDetail;

      const orderDetail = mergeParticipantOrder(originalOrderDetail, {
        currentUserId,
        orderDay,
        memberOrders,
        orderDays,
        planData,
      });

      // Log what changed
      console.log(
        `[RACE_DEBUG] OrderDetail changes for planId: ${planId}, userId: ${currentUserId}:`,
        {
          before: originalOrderDetail,
          after: orderDetail,
          timestamp: new Date().toISOString(),
        },
      );

      await job.updateProgress(75);
      await lock.extend();

      console.log(
        `[RACE_DEBUG] Updating plan listing for planId: ${planId}, userId: ${currentUserId}`,
      );

      const planResponse = await sdk.listings.update(
        {
          id: planId,
          metadata: { orderDetail },
        },
        { expand: true },
      );

      if (shouldAddToAnonymous) {
        const { participants = [], anonymous = [] } =
          Listing(await fetchListing(orderId as string)).getMetadata() ?? {};
        if (
          !participants.includes(currentUserId) &&
          !anonymous.includes(currentUserId)
        ) {
          console.log(
            `[RACE_DEBUG] Adding user ${currentUserId} to anonymous participants for orderId: ${orderId}`,
          );
          await sdk.listings.update({
            id: orderId,
            metadata: {
              anonymous: [...anonymous, currentUserId],
            },
          });
        }
      }

      await job.updateProgress(100);
      const totalDuration = Date.now() - jobStartTime;
      console.log(
        `[RACE_DEBUG] Job completed successfully - planId: ${planId}, userId: ${currentUserId}, total duration: ${totalDuration}ms, memberOrders: ${JSON.stringify(
          memberOrders,
        )}, orderDay: ${orderDay}, orderDays: ${orderDays?.join(
          ', ',
        )}, planData keys: ${
          planData ? Object.keys(planData).join(', ') : 'none'
        }`,
      );

      isPersisted = true;

      return denormalisedResponseEntities(planResponse)[0];
    } catch (error) {
      const totalDuration = Date.now() - jobStartTime;
      console.error(
        `[RACE_DEBUG] Process order error after ${totalDuration}ms:`,
        {
          planId,
          currentUserId,
          orderId,
          jobId: job.id,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        },
      );
      try {
        const orderLink = `${
          process.env.NEXT_PUBLIC_APP_URL || ''
        }/participant/orders/${orderId}`;
        await createSlackNotification(
          ESlackNotificationType.PARTICIPANT_ORDER_PERSISTENCE_FAILED,
          {
            orderLink,
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
            error: error instanceof Error ? error.message : String(error),
            totalJobDurationMs: Date.now() - jobStartTime,
          } as any,
        );
      } catch (notifyErr) {
        console.error('[RACE_DEBUG] Slack notify failed:', notifyErr);
      }
      throw error;
    } finally {
      try {
        console.log(
          `[RACE_DEBUG] Attempting to release lock for planId: ${planId}, userId: ${currentUserId}`,
        );
        const released = await lock.release();
        if (isPersisted && submissionId) {
          await setOrderJobStatus({
            planId,
            userId: currentUserId,
            submissionId,
            status: 'completed',
          }).catch((error) =>
            console.error('[RACE_DEBUG] Order job status write failed:', error),
          );
        }
        if (!released) {
          console.warn(
            `[RACE_DEBUG] WARNING: Failed to release lock for planId: ${planId}, userId: ${currentUserId} - lock may have been stolen or expired`,
          );
        } else {
          console.log(
            `[RACE_DEBUG] Lock released successfully for planId: ${planId}, userId: ${currentUserId}`,
          );
          // Verify persistence AFTER releasing lock
          try {
            const freshPlan = await fetchListing(planId as string);
            const daysToCheck: string[] = orderDay
              ? [String(orderDay)]
              : (orderDays as string[]) || [];

            // Build expected user plan
            const expectedUserPlan = buildExpectedUserPlan(
              daysToCheck,
              planData || {},
              currentUserId,
            );

            // Build user actions
            const userActions = buildUserActions(
              daysToCheck,
              planData || {},
              currentUserId,
              originalOrderDetailBefore,
            );

            // Build actual user plan
            const actualUserPlan = buildActualUserPlan(
              freshPlan,
              currentUserId,
              daysToCheck,
            );

            // Verify persistence using utils
            await verifyOrderPersistence({
              orderId,
              planId,
              currentUserId,
              jobId: job.id as string,
              jobStartTime,
              orderDay,
              orderDays: daysToCheck,
              expectedUserPlan,
              actualUserPlan,
              userActions,
            });
          } catch (verifyAfterReleaseError) {
            console.error(
              '[RACE_DEBUG] Verification after release failed:',
              verifyAfterReleaseError,
            );
            try {
              await createSlackNotification(
                ESlackNotificationType.PARTICIPANT_ORDER_PERSISTENCE_FAILED,
                {
                  service: 'processOrder.job',
                  failedAt: 'verify-after-release-failed',
                  orderId,
                  planId,
                  userId: currentUserId,
                  error:
                    verifyAfterReleaseError instanceof Error
                      ? verifyAfterReleaseError.message
                      : String(verifyAfterReleaseError),
                  jobId: job.id,
                  totalJobDurationMs: Date.now() - jobStartTime,
                } as any,
              );
            } catch (_notifyErr) {
              // ignore
            }
          }
        }
      } catch (releaseError) {
        console.error(
          `[RACE_DEBUG] Error releasing lock for planId: ${planId}, userId: ${currentUserId}:`,
          releaseError,
        );
      }
    }
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

worker.on('failed', (job, error) => {
  console.error('[RACE_DEBUG] Job failed:', {
    jobId: job?.id,
    planId: job?.data?.planId,
    userId: job?.data?.currentUserId,
    orderId: job?.data?.orderId,
    data: job?.data,
    error: error.message,
    stack: error.stack,
    attemptsMade: job?.attemptsMade,
    timestamp: new Date().toISOString(),
  });

  // Earlier attempts are retried; only the final failure reaches the UI.
  if (job?.data.submissionId && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    setOrderJobStatus({
      planId: job.data.planId,
      userId: job.data.currentUserId,
      submissionId: job.data.submissionId,
      status: 'failed',
      error: error.message,
    }).catch((statusError) =>
      console.error('[RACE_DEBUG] Order job status write failed:', statusError),
    );
  }
});

// Add to queue
export const addToProcessOrderQueue = async (data: AddToQueueData) => {
  const deduplicationKey = `${data.orderId}-${data.planId}-${data.currentUserId}`;
  const startTime = Date.now();

  try {
    console.log(
      `[RACE_DEBUG] Attempting to add job to queue - userId: ${
        data.currentUserId
      }, planId: ${data.planId}, orderId: ${
        data.orderId
      }, deduplicationKey: ${deduplicationKey}, timestamp: ${new Date().toISOString()}`,
    );

    // Check if job already exists
    const existingJob = await processOrderQueue.getJob(deduplicationKey);
    if (existingJob) {
      console.log(
        `[RACE_DEBUG] Existing job found for deduplicationKey: ${deduplicationKey}, jobId: ${
          existingJob.id
        }, state: ${await existingJob.getState()}, removing it first`,
      );
    }

    await processOrderQueue.remove(deduplicationKey);

    const job = await processOrderQueue.add(queueName, data, {
      jobId: deduplicationKey,
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      priority: data.orderDays?.length || 1,
    });

    // An active job cannot be removed, and add() then hands back that job
    // instead of queueing this pick.
    if (data.submissionId && job.data.submissionId !== data.submissionId) {
      return null;
    }

    const duration = Date.now() - startTime;
    console.log(
      `[RACE_DEBUG] Job added successfully to queue - userId: ${
        data.currentUserId
      }, planId: ${data.planId}, jobId: ${job.id}, priority: ${
        data.orderDays?.length || 1
      }, duration: ${duration}ms`,
    );

    if (await job.isFailed()) {
      await createSlackNotification(
        ESlackNotificationType.PARTICIPANT_ORDER_PERSISTENCE_FAILED,
        {
          service: 'processOrder.queue',
          failedAt: 'queue-overloaded',
          orderId: data.orderId,
          planId: data.planId,
          userId: data.currentUserId,
          error: `Queue job failed with reason: ${job.failedReason}`,
        } as any,
      );
    }

    return job;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error instanceof Error && error.message.includes('duplicate')) {
      console.log(
        `[RACE_DEBUG] Duplicate job ignored for ${deduplicationKey}, userId: ${data.currentUserId}, duration: ${duration}ms - this indicates potential race condition`,
      );

      return null;
    }

    console.error(
      `[RACE_DEBUG] Error adding job to queue for userId: ${data.currentUserId}, planId: ${data.planId}, duration: ${duration}ms:`,
      error,
    );
    throw error;
  }
};

/**
 * Queues a participant pick and returns at once; the participant UI follows
 * the job through its Firestore status doc. Returns null while a previous pick
 * of the same user is still running.
 */
export const enqueueParticipantOrder = async (
  data: Omit<AddToQueueData, 'submissionId'>,
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

  const job = await addToProcessOrderQueue({ ...data, submissionId });

  return job ? { jobId: job.id as string, submissionId } : null;
};

// Shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await processOrderQueue.close();
  process.exit(0);
});

export { processOrderQueue, worker };
