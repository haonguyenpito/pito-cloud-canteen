/**
 * ⚠️ BEHAVIORAL CONTRACT — processMemberOrder.job.ts
 *
 * PURPOSE: Persists participant food selections to Sharetribe plan listings
 * via a BullMQ queue. Without the distributed lock, concurrent food picks for
 * the same plan would race and silently overwrite each other.
 *
 * WHY THE LOCK EXISTS:
 *   - Sharetribe's listings.update is not atomic: read-modify-write in the job
 *     handler has a data-loss window if two jobs run simultaneously for the same
 *     planId. The Redis lock (DistributedLock) serializes writes per plan.
 *   - Lock key: `lock:plan:<planId>` — per plan, not per order, because a plan
 *     holds the orderDetail object that all members write into.
 *   - TTL = 30 000 ms. The job extends the lock mid-flight (after fetchListing)
 *     to prevent expiry during a slow Sharetribe API call.
 *   - DO NOT remove or shorten the lock without profiling concurrent job latency.
 *
 * WHY 3 RETRIES (attempts: 3) + EXPONENTIAL BACKOFF:
 *   - BullMQ retries the entire job (including re-acquiring the lock) on failure.
 *   - Exponential backoff (base 2 000 ms) avoids thundering-herd under Redis
 *     pressure. Do not reduce attempts below 3 or remove backoff.
 *
 * WHY maxRetries = 100 FOR LOCK ACQUISITION (not job retries):
 *   - Lock retry loop inside the job gives up after 100 * ~100 ms ≈ 10 s.
 *   - After 100 attempts, the job throws, triggering a BullMQ job retry.
 *   - Raising maxRetries beyond 100 risks a single job stalling the queue for
 *     a long time; lowering it risks premature failures under burst load.
 *
 * JOB ID COLLISION (deduplication):
 *   - jobId = `${orderId}-${planId}-${currentUserId}`.
 *   - A new job for the same user+plan removes the previous pending job before
 *     enqueuing. This means only the LATEST pick for a user is persisted if
 *     they update rapidly. This is intentional — last write wins per user.
 *
 * ADDING ANONYMOUS PARTICIPANTS:
 *   - If currentUserId is not in participants or anonymous arrays on the order
 *     listing, the job appends them to anonymous. This must remain atomic with
 *     the plan write; separating the two updates would create an inconsistency
 *     window.
 */
import type { Job } from 'bullmq';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { Redis } from 'ioredis';

import { fetchListing } from '@services/integrationHelper';
import { defaultQueueConfig } from '@services/queues/config';
import { redisConnection } from '@services/redis';
import { getIntegrationSdk } from '@services/sdk';
import { denormalisedResponseEntities, Listing } from '@src/utils/data';

const QUEUE_NAME = 'processOrder' as const;

export interface QueueInterface {
  orderId: any;
  title: any;
  amount: number;
}

interface ProcessOrderJobData {
  orderId: string;
  planId: string;
  memberOrders?: Record<string, any>;
  orderDay?: string; // epoch string
  orderDays?: string[]; // epoch strings
  planData?: Record<string, Record<string, any>>;
  currentUserId: string;
}

type AddToQueueData = Pick<ProcessOrderJobData, 'orderId' | 'currentUserId'> &
  Partial<ProcessOrderJobData>;

const ACQUIRE_LOCK_SCRIPT = `
  local key = KEYS[1]
  local token = ARGV[1]
  local ttl = tonumber(ARGV[2])
  local current = redis.call('GET', key)
  if current == false then
    redis.call('SET', key, token, 'PX', ttl)
    return 1
  elseif current == token then
    redis.call('PEXPIRE', key, ttl)
    return 1
  else
    return 0
  end
`;

const RELEASE_LOCK_SCRIPT = `
  local key = KEYS[1]
  local token = ARGV[1]
  local current = redis.call('GET', key)
  if current == token then
    return redis.call('DEL', key)
  else
    return 0
  end
`;

class DistributedLock {
  constructor(
    private readonly redis: Redis,
    resource: string,
    private readonly options: {
      ttl?: number;
      retryDelay?: number;
      maxRetries?: number;
    } = {},
  ) {
    this.lockKey = `lock:${resource}`;
    this.token =
      typeof (global as any).crypto?.randomUUID === 'function'
        ? (global as any).crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    this.ttl = options.ttl ?? 30_000;
    this.retryDelay = options.retryDelay ?? 100;
    this.maxRetries = options.maxRetries ?? 50;
  }

  private readonly lockKey: string;

  private readonly token: string;

  private readonly ttl: number;

  private readonly retryDelay: number;

  private readonly maxRetries: number;

  private async tryAcquire(attempt = 0): Promise<boolean> {
    const result = (await this.redis.eval(
      ACQUIRE_LOCK_SCRIPT,
      1,
      this.lockKey,
      this.token,
      this.ttl,
    )) as number;

    if (result === 1) return true;
    if (attempt >= this.maxRetries) return false;

    const delay = this.retryDelay * 1.5 ** Math.min(attempt, 10);
    await new Promise((res) => {
      setTimeout(res, delay);
    });

    return this.tryAcquire(attempt + 1);
  }

  acquire(): Promise<boolean> {
    return this.tryAcquire(0);
  }

  async release(): Promise<boolean> {
    const result = (await this.redis.eval(
      RELEASE_LOCK_SCRIPT,
      1,
      this.lockKey,
      this.token,
    )) as number;

    return result === 1;
  }

  async extend(additionalTtl: number = this.ttl): Promise<boolean> {
    const result = (await this.redis.eval(
      ACQUIRE_LOCK_SCRIPT,
      1,
      this.lockKey,
      this.token,
      additionalTtl,
    )) as number;

    return result === 1;
  }
}

const processOrderQueue = new Queue<AddToQueueData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultQueueConfig,
    delay: 500,
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

let processOrderEvents: QueueEvents | null = null;
function getQueueEvents(): QueueEvents {
  if (!processOrderEvents) {
    processOrderEvents = new QueueEvents(QUEUE_NAME, {
      connection: redisConnection,
    });
    processOrderEvents
      .waitUntilReady()
      .catch((err) => console.error('[QueueEvents] failed to be ready:', err));
  }

  return processOrderEvents;
}

function upsertMemberOrders(params: {
  orderDetail: Record<string, any>;
  currentUserId: string;
  orderDay?: string;
  memberOrders?: Record<string, any>;
  orderDays?: string[];
  planData?: Record<string, Record<string, any>>;
}) {
  const { orderDetail, currentUserId, orderDay, memberOrders } = params;

  // Single day payload
  if (orderDay && memberOrders) {
    orderDetail[orderDay] ??= { memberOrders: {} };
    orderDetail[orderDay].memberOrders ??= {};
    if (memberOrders[currentUserId] !== undefined) {
      orderDetail[orderDay].memberOrders[currentUserId] =
        memberOrders[currentUserId];
    }
  }
}

function buildJobId(data: AddToQueueData): string {
  return `${data.orderId}-${data.planId}-${data.currentUserId}`;
}

const worker = new Worker<ProcessOrderJobData>(
  QUEUE_NAME,
  async (job: Job<ProcessOrderJobData>) => {
    const {
      orderId,
      planId,
      memberOrders,
      orderDay,
      orderDays,
      planData,
      currentUserId,
    } = job.data;

    const sdk = getIntegrationSdk();
    const lock = new DistributedLock(
      redisConnection as Redis,
      `plan:${planId}`,
      {
        ttl: 30_000,
        retryDelay: 100,
        maxRetries: 100,
      },
    );

    try {
      const acquired = await lock.acquire();
      if (!acquired) {
        const msg = `Failed to acquire lock for planId: ${planId}`;
        console.error(msg);
        throw new Error(msg);
      }

      console.log(
        `Lock acquired for planId: ${planId}, user: ${currentUserId}`,
      );
      await job.updateProgress(25);

      const orderListing = await fetchListing(orderId);
      await job.updateProgress(50);

      // Fresh plan
      const updatingPlan = await fetchListing(planId);
      const { participants = [], anonymous = [] } =
        Listing(orderListing).getMetadata() ?? {};
      const currentMetadata = Listing(updatingPlan).getMetadata() ?? {};
      const orderDetail: Record<string, any> =
        currentMetadata.orderDetail ?? {};

      // Merge
      upsertMemberOrders({
        orderDetail,
        currentUserId,
        orderDay,
        memberOrders,
        orderDays,
        planData,
      });

      await job.updateProgress(75);
      await lock.extend();

      // Persist
      const planResponse = await sdk.listings.update(
        { id: planId, metadata: { orderDetail } },
        { expand: true },
      );

      // Track anonymous contributor if needed
      if (
        !participants.includes(currentUserId) &&
        !anonymous.includes(currentUserId)
      ) {
        await sdk.listings.update({
          id: orderId,
          metadata: { anonymous: [...anonymous, currentUserId] },
        });
      }

      await job.updateProgress(100);

      // Ensure plain serializable data
      const result = denormalisedResponseEntities(planResponse)[0];

      return JSON.parse(JSON.stringify(result));
    } catch (error: any) {
      console.error('Process order error:', {
        planId,
        currentUserId,
        error: error?.message ?? error,
      });
      throw error;
    } finally {
      try {
        const released = await lock.release();
        if (!released) {
          console.warn(`Failed to release lock for planId: ${planId}`);
        } else {
          console.log(`Lock released for planId: ${planId}`);
        }
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    maxStalledCount: 1,
    stalledInterval: 30_000,
  },
);

worker.on('error', (error) => {
  console.error('[Worker] error:', error);
});

worker.on('stalled', (jobId) => {
  console.warn('[Worker] job stalled:', jobId);
});

worker.on('failed', (job, error) => {
  console.error('[Worker] job failed:', {
    jobId: job?.id,
    data: job?.data,
    error: error.message,
  });
});

export const addToProcessMemberOrderQueue = async (data: AddToQueueData) => {
  const jobId = buildJobId(data);

  try {
    await processOrderQueue.remove(jobId).catch(() => undefined);

    const job = await processOrderQueue.add(QUEUE_NAME, data, {
      jobId,
      delay: 500,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 10,
      removeOnFail: 5,
      priority: data.orderDays?.length || 1,
    });

    const result = await job.waitUntilFinished(getQueueEvents());

    return result;
  } catch (error: any) {
    if (
      typeof error?.message === 'string' &&
      error.message.includes('duplicate')
    ) {
      console.log(`Duplicate job ignored for ${jobId}`);

      return null;
    }
    throw error;
  }
};

async function shutdown() {
  console.log('Shutting down worker/queue...');
  try {
    await worker.close();
  } catch (e) {
    console.error('Error closing worker:', e);
  }
  try {
    await processOrderQueue.close();
  } catch (e) {
    console.error('Error closing queue:', e);
  }
  try {
    await processOrderEvents?.close();
  } catch (e) {
    console.error('Error closing queue events:', e);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { processOrderQueue, worker };
