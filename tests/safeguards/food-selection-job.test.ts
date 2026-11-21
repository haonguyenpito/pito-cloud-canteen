/**
 * FOOD SELECTION JOB SAFEGUARDS
 *
 * Tests for the BullMQ processOrder job — the critical path that persists
 * participant food selections to Sharetribe.
 *
 * WHY THIS MATTERS:
 * - Many participants pick food for the same plan at once; every write of
 *   plan.metadata.orderDetail must run under the `lock:plan:{planId}` lock or
 *   concurrent writes silently drop picks
 * - Picks wait in the Redis hash `pending:plan:{planId}` and the lock holder
 *   writes all of them in one Sharetribe update (batching), so a burst of N
 *   picks costs a few writes instead of N serialized ones
 * - A failed write must leave picks pending, and a pick Sharetribe rejects
 *   must not fail everyone else's pick
 *
 * Source: src/services/jobs/processOrder.job.ts
 */
import { setOrderJobStatus } from '@helpers/orderJobStatus';
import { fetchListing } from '@services/integrationHelper';
import {
  enqueueParticipantOrder,
  processOrderQueue,
} from '@services/jobs/processOrder.job';
import { getIntegrationSdk } from '@services/sdk';
import { createSlackNotification } from '@services/slackNotification';

// ---------------------------------------------------------------------------
// var (not let/const): jest.mock factories are hoisted above declarations.
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-var
var capturedProcessor: ((job: any) => Promise<any>) | undefined;
// eslint-disable-next-line no-var
var workerHandlers: Record<string, (...args: any[]) => any>;

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation((_name: string, processor: any) => {
    capturedProcessor = processor;
    workerHandlers = {};

    return {
      on: jest.fn((event: string, handler: any) => {
        workerHandlers[event] = handler;
      }),
      close: jest.fn(),
    };
  }),
}));

// In-memory Redis: the lock's Lua scripts plus the hash/counter commands the
// job uses. `eval` mirrors ACQUIRE/RELEASE_LOCK_SCRIPT (token-owned key).
jest.mock('@services/redis', () => {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const hash = (key: string) => {
    if (!hashes.has(key)) hashes.set(key, new Map());

    return hashes.get(key)!;
  };

  return {
    __store: { strings, hashes },
    redisConnection: {
      on: jest.fn(),
      eval: jest.fn(
        async (script: string, _n: number, key: string, token: string) => {
          const current = strings.get(key);
          if (script.includes("'DEL'")) {
            if (current !== token) return 0;
            strings.delete(key);

            return 1;
          }
          if (current === undefined || current === token) {
            strings.set(key, token);

            return 1;
          }

          return 0;
        },
      ),
      incr: jest.fn(async (key: string) => {
        const next = Number(strings.get(key) ?? 0) + 1;
        strings.set(key, String(next));

        return next;
      }),
      expire: jest.fn(async () => 1),
      hset: jest.fn(async (key: string, field: string, value: string) => {
        hash(key).set(field, value);

        return 1;
      }),
      hsetnx: jest.fn(async (key: string, field: string, value: string) => {
        if (hash(key).has(field)) return 0;
        hash(key).set(field, value);

        return 1;
      }),
      hget: jest.fn(async (key: string, field: string) =>
        hash(key).has(field) ? hash(key).get(field)! : null,
      ),
      hgetall: jest.fn(async (key: string) => Object.fromEntries(hash(key))),
      hexists: jest.fn(async (key: string, field: string) =>
        hash(key).has(field) ? 1 : 0,
      ),
      hdel: jest.fn(async (key: string, ...fields: string[]) =>
        fields.reduce((count, field) => count + +hash(key).delete(field), 0),
      ),
    },
  };
});

jest.mock('@services/integrationHelper', () => ({
  fetchListing: jest.fn(),
}));

jest.mock('@helpers/orderJobStatus', () => ({
  setOrderJobStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@services/sdk', () => ({
  getIntegrationSdk: jest.fn(),
}));

jest.mock('@services/slackNotification', () => ({
  createSlackNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@src/utils/order', () => ({
  buildActualUserPlan: jest.fn().mockReturnValue({}),
  buildExpectedUserPlan: jest.fn().mockReturnValue({}),
  buildUserActions: jest.fn().mockReturnValue([]),
  verifyOrderPersistence: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@services/queues/config', () => ({
  defaultQueueConfig: {},
}));

jest.spyOn(console, 'log').mockImplementation(() => undefined);
jest.spyOn(console, 'warn').mockImplementation(() => undefined);
jest.spyOn(console, 'error').mockImplementation(() => undefined);

// ---------------------------------------------------------------------------
// Fake Sharetribe: one plan and one order listing, read and written with a
// delay so concurrent jobs genuinely overlap.
// ---------------------------------------------------------------------------
const PLAN_ID = 'plan-1';
const ORDER_ID = 'order-1';
const DAY_1 = '1711929600000';
const DAY_2 = '1712016000000';

const { __store: store } = jest.requireMock('@services/redis');
const mockFetchListing = fetchListing as jest.Mock;
const mockSetOrderJobStatus = setOrderJobStatus as jest.Mock;
const mockSlack = createSlackNotification as jest.Mock;
const mockQueueAdd = processOrderQueue.add as jest.Mock;

let planOrderDetail: Record<string, any>;
let orderMetadata: Record<string, any>;
let planUpdates: number;
let failNextPlanUpdates: number;
let mockSdk: any;
const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const listing = (id: string, metadata: Record<string, any>) => ({
  id: { uuid: id },
  type: 'listing',
  attributes: { metadata: JSON.parse(JSON.stringify(metadata)) },
});

beforeEach(() => {
  store.strings.clear();
  store.hashes.clear();
  planOrderDetail = {
    [DAY_1]: { memberOrders: { 'real-user': { foodId: 'food-R' } } },
    [DAY_2]: { memberOrders: {} },
  };
  orderMetadata = {
    orderState: 'picking',
    deadlineDate: Date.now() + 60 * 60 * 1000,
    participants: [],
    anonymous: [],
  };
  planUpdates = 0;
  failNextPlanUpdates = 0;

  mockFetchListing.mockImplementation(async (id: string) => {
    await delay(5);

    return id === PLAN_ID
      ? listing(PLAN_ID, { orderDetail: planOrderDetail })
      : listing(ORDER_ID, orderMetadata);
  });
  mockSdk = {
    listings: {
      update: jest.fn(async ({ id, metadata }: any) => {
        await delay(20);
        if (id === PLAN_ID) {
          if (failNextPlanUpdates > 0) {
            failNextPlanUpdates -= 1;
            throw new Error('Sharetribe unavailable');
          }
          planUpdates += 1;
          planOrderDetail = metadata.orderDetail;
        } else {
          orderMetadata = { ...orderMetadata, ...metadata };
        }

        return { data: {} };
      }),
    },
  };
  (getIntegrationSdk as jest.Mock).mockReturnValue(mockSdk);
  mockQueueAdd.mockImplementation(
    async (_name: string, data: any, opts: any) => ({ id: opts.jobId, data }),
  );
  mockSetOrderJobStatus.mockClear();
  mockSlack.mockClear();
  mockQueueAdd.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const pick = (userId: string, days: Record<string, string>) => ({
  orderId: ORDER_ID,
  planId: PLAN_ID,
  currentUserId: userId,
  orderDays: Object.keys(days),
  planData: Object.fromEntries(
    Object.entries(days).map(([day, foodId]) => [
      day,
      { [userId]: { foodId, status: 'joined' } },
    ]),
  ),
});

/** Enqueues a pick and returns the BullMQ job its enqueue created. */
const enqueue = async (data: ReturnType<typeof pick>) => {
  const { submissionId } = await enqueueParticipantOrder(data);
  const call = mockQueueAdd.mock.calls.find(
    ([, jobData]) => jobData.submissionId === submissionId,
  )!;

  return {
    id: submissionId,
    data: call[1],
    attemptsMade: 0,
    opts: { attempts: 3 },
  };
};

const run = (job: any) => capturedProcessor!(job);

const statusesOf = (status: string) =>
  mockSetOrderJobStatus.mock.calls
    .map(([args]) => args)
    .filter((args) => args.status === status);

const pendingCount = () =>
  store.hashes.get(`pending:plan:${PLAN_ID}`)?.size ?? 0;

// ---------------------------------------------------------------------------
// enqueueParticipantOrder
// ---------------------------------------------------------------------------
describe('enqueueParticipantOrder', () => {
  it('marks the pick queued, stores it pending, then adds a job pointing at it', async () => {
    const result = await enqueueParticipantOrder(
      pick('user-1', { [DAY_1]: 'food-A' }),
    );

    expect(statusesOf('queued')).toEqual([
      expect.objectContaining({
        planId: PLAN_ID,
        userId: 'user-1',
        submissionId: result.submissionId,
      }),
    ]);
    const pending = JSON.parse(
      store.hashes.get(`pending:plan:${PLAN_ID}`).get(result.submissionId),
    );
    expect(pending).toMatchObject({ currentUserId: 'user-1', seq: 1 });
    // The pick rides along so a pre-batching worker (rolling deploy) still
    // writes it; `pending` tells the new worker it is already in the hash.
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'processOrder',
      {
        ...pick('user-1', { [DAY_1]: 'food-A' }),
        submissionId: result.submissionId,
        pending: true,
      },
      { jobId: result.submissionId },
    );
    expect(result.jobId).toBe(result.submissionId);
  });
});

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------
describe('processOrder worker', () => {
  it('writes one pick and keeps the other members picks', async () => {
    const job = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));

    await run(job);

    expect(planOrderDetail[DAY_1].memberOrders).toEqual({
      'real-user': { foodId: 'food-R' },
      'user-1': { foodId: 'food-A', status: 'joined' },
    });
    expect(pendingCount()).toBe(0);
    expect(statusesOf('completed')).toEqual([
      expect.objectContaining({ userId: 'user-1', submissionId: job.id }),
    ]);
    expect(store.strings.has(`lock:plan:${PLAN_ID}`)).toBe(false);
  });

  it('writes 100 simultaneous picks in a few batches without losing any', async () => {
    const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);
    const jobs = await Promise.all(
      userIds.map((userId) =>
        enqueue(pick(userId, { [DAY_1]: 'food-A', [DAY_2]: 'food-B' })),
      ),
    );

    await Promise.all(jobs.map(run));

    userIds.forEach((userId) => {
      expect(planOrderDetail[DAY_1].memberOrders[userId]?.foodId).toBe(
        'food-A',
      );
      expect(planOrderDetail[DAY_2].memberOrders[userId]?.foodId).toBe(
        'food-B',
      );
    });
    expect(planOrderDetail[DAY_1].memberOrders['real-user']).toBeDefined();
    expect(planUpdates).toBeLessThanOrEqual(5);
    expect(new Set(statusesOf('completed').map((s) => s.userId)).size).toBe(
      100,
    );
    expect(pendingCount()).toBe(0);
  });

  it('applies two picks of one user in order: both days kept, later pick wins a shared day', async () => {
    const first = await enqueue(
      pick('user-1', { [DAY_1]: 'food-A', [DAY_2]: 'food-B' }),
    );
    const second = await enqueue(pick('user-1', { [DAY_1]: 'food-C' }));

    await Promise.all([run(second), run(first)]);

    expect(planOrderDetail[DAY_1].memberOrders['user-1'].foodId).toBe('food-C');
    expect(planOrderDetail[DAY_2].memberOrders['user-1'].foodId).toBe('food-B');
  });

  it('exits without taking the lock when another batch already wrote the pick', async () => {
    const job = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));
    await run(job);
    mockFetchListing.mockClear();

    await expect(run(job)).resolves.toBeNull();

    expect(mockFetchListing).not.toHaveBeenCalled();
    expect(planUpdates).toBe(1);
  });

  it('keeps picks pending and releases the lock when the plan write fails', async () => {
    const job = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));
    failNextPlanUpdates = 1;

    await expect(run(job)).rejects.toThrow('Sharetribe unavailable');

    expect(pendingCount()).toBe(1);
    expect(store.strings.has(`lock:plan:${PLAN_ID}`)).toBe(false);
    expect(statusesOf('completed')).toHaveLength(0);

    // The retry writes it.
    await run({ ...job, attemptsMade: 1 });
    expect(planOrderDetail[DAY_1].memberOrders['user-1'].foodId).toBe('food-A');
    expect(pendingCount()).toBe(0);
  });

  it('on retry writes only its own pick, so a rejected batch cannot block others', async () => {
    const own = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));
    await enqueue(pick('user-2', { [DAY_1]: 'food-B' }));

    await run({ ...own, attemptsMade: 1 });

    expect(planOrderDetail[DAY_1].memberOrders['user-1'].foodId).toBe('food-A');
    expect(planOrderDetail[DAY_1].memberOrders['user-2']).toBeUndefined();
    expect(pendingCount()).toBe(1);
  });

  it('fails a pick that cannot be merged alone and writes the rest of the batch', async () => {
    const good = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));
    const bad = await enqueue(pick('user-2', { [DAY_1]: 'food-B' }));
    // orderDays that is not an array makes mergeParticipantOrder throw.
    const pending = store.hashes.get(`pending:plan:${PLAN_ID}`);
    pending.set(
      bad.id,
      JSON.stringify({ ...JSON.parse(pending.get(bad.id)), orderDays: {} }),
    );

    await run(good);

    expect(planOrderDetail[DAY_1].memberOrders['user-1'].foodId).toBe('food-A');
    expect(statusesOf('completed').map((s) => s.userId)).toEqual(['user-1']);
    expect(statusesOf('failed')).toEqual([
      expect.objectContaining({ userId: 'user-2', submissionId: bad.id }),
    ]);
    expect(pendingCount()).toBe(0);
  });

  it('drops a malformed pending entry and still writes the batch', async () => {
    const job = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));
    store.hashes.get(`pending:plan:${PLAN_ID}`).set('broken', '{not json');

    await run(job);

    expect(planOrderDetail[DAY_1].memberOrders['user-1'].foodId).toBe('food-A');
    expect(pendingCount()).toBe(0);
  });

  it('adds new pickers to the order anonymous list once per batch', async () => {
    orderMetadata = { ...orderMetadata, participants: ['user-1'] };
    const jobs = await Promise.all(
      ['user-1', 'user-2', 'user-3'].map((userId) =>
        enqueue(pick(userId, { [DAY_1]: 'food-A' })),
      ),
    );

    await Promise.all(jobs.map(run));

    expect(orderMetadata.anonymous.sort()).toEqual(['user-2', 'user-3']);
  });

  it('processes a job queued before batching (pick inside the job data)', async () => {
    const legacyJob = {
      id: 'legacy-1',
      data: { ...pick('user-1', { [DAY_1]: 'food-A' }), submissionId: 'sub-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    await run(legacyJob);

    expect(planOrderDetail[DAY_1].memberOrders['user-1'].foodId).toBe('food-A');
    expect(pendingCount()).toBe(0);
  });

  it.each([
    ['the order already started', { orderState: 'inProgress' }],
    ['the deadline passed', { deadlineDate: Date.now() - 1000 }],
  ])(
    'refuses the whole batch when %s, without writing the plan or alerting',
    async (_case, change) => {
      const jobs = await Promise.all(
        ['user-1', 'user-2'].map((userId) =>
          enqueue(pick(userId, { [DAY_1]: 'food-A' })),
        ),
      );
      orderMetadata = { ...orderMetadata, ...change };

      await Promise.all(jobs.map(run));

      expect(planUpdates).toBe(0);
      expect(planOrderDetail[DAY_1].memberOrders['user-1']).toBeUndefined();
      expect(
        statusesOf('failed')
          .map((s) => s.userId)
          .sort(),
      ).toEqual(['user-1', 'user-2']);
      expect(statusesOf('completed')).toHaveLength(0);
      expect(pendingCount()).toBe(0);
      expect(mockSlack).not.toHaveBeenCalled();
    },
  );
});

// ---------------------------------------------------------------------------
// Final failure
// ---------------------------------------------------------------------------
describe('processOrder worker final failure', () => {
  const finalFailure = (job: any) =>
    workerHandlers.failed(
      { ...job, attemptsMade: 3, opts: { attempts: 3 } },
      new Error('Sharetribe unavailable'),
    );

  it('gives up a still-pending pick: removes it, marks it failed, notifies Slack', async () => {
    const job = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));

    await finalFailure(job);

    expect(pendingCount()).toBe(0);
    expect(statusesOf('failed')).toEqual([
      expect.objectContaining({ userId: 'user-1', submissionId: job.id }),
    ]);
    expect(mockSlack).toHaveBeenCalledTimes(1);
  });

  it('does not mark failed a pick another batch already wrote', async () => {
    const job = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));
    await run(job);

    await finalFailure(job);

    expect(statusesOf('failed')).toHaveLength(0);
    expect(mockSlack).not.toHaveBeenCalled();
  });

  it('leaves an earlier attempt to be retried', async () => {
    const job = await enqueue(pick('user-1', { [DAY_1]: 'food-A' }));

    await workerHandlers.failed(
      { ...job, attemptsMade: 1, opts: { attempts: 3 } },
      new Error('Sharetribe unavailable'),
    );

    expect(pendingCount()).toBe(1);
    expect(statusesOf('failed')).toHaveLength(0);
  });
});
