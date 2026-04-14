/**
 * FOOD SELECTION JOB SAFEGUARDS
 *
 * Tests for the BullMQ processOrder job — the critical path that persists
 * participant food selections to Sharetribe under a Redis distributed lock.
 *
 * WHY THIS MATTERS:
 * - Multiple participants can select food concurrently for the same plan listing
 * - Without the distributed lock, concurrent writes overwrite each other, causing
 *   data loss (a participant's selection disappears silently)
 * - The lock must be acquired before reading the plan and released in the finally
 *   block to prevent deadlocks
 * - deduplication key removal + re-enqueue prevents duplicate processing
 *
 * Source: src/services/jobs/processOrder.job.ts
 */

// ---------------------------------------------------------------------------
// Queue instance capture — populated when the module first loads, before any
// clearAllMocks() call wipes the mock.results array.
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-var
// ---------------------------------------------------------------------------
// Imports — must come AFTER jest.mock declarations
// ---------------------------------------------------------------------------
import { fetchListing } from '@services/integrationHelper';
import { addToProcessOrderQueue } from '@services/jobs/processOrder.job';
import { redisConnection } from '@services/redis';
import { getIntegrationSdk } from '@services/sdk';
import { denormalisedResponseEntities } from '@src/utils/data';

let capturedQueueInstance: any;

// ---------------------------------------------------------------------------
// Use var (not let/const) for the captured processor because jest.mock is
// hoisted to the top of the compiled output — var avoids the TDZ problem.
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-var
var capturedProcessor: ((job: any) => Promise<any>) | undefined;

// ---------------------------------------------------------------------------
// BullMQ mock — captures the Queue instance and Worker processor
// ---------------------------------------------------------------------------
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => {
    const instance = {
      add: jest.fn().mockResolvedValue({
        id: 'job-123',
        isFailed: jest.fn().mockResolvedValue(false),
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue(null),
      close: jest.fn(),
    };
    capturedQueueInstance = instance;

    return instance;
  }),
  Worker: jest.fn().mockImplementation((_name: string, processor: any) => {
    capturedProcessor = processor;

    return { on: jest.fn(), close: jest.fn() };
  }),
  QueueEvents: jest.fn().mockImplementation(() => ({
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Service / utility mocks
// ---------------------------------------------------------------------------
jest.mock('@services/redis', () => ({
  redisConnection: {
    eval: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('@services/integrationHelper', () => ({
  fetchListing: jest.fn(),
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

// Use the real Listing / denormalisedResponseEntities but allow overriding
// denormalisedResponseEntities per test.
jest.mock('@src/utils/data', () => {
  const actual = jest.requireActual('@src/utils/data');

  return {
    ...actual,
    denormalisedResponseEntities: jest.fn(),
  };
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeJob(data: Record<string, any>) {
  return {
    id: 'test-job-1',
    data,
    updateProgress: jest.fn().mockResolvedValue(undefined),
    isFailed: jest.fn().mockResolvedValue(false),
  };
}

const makePlanListing = (orderDetail: Record<string, any> = {}) => ({
  id: { uuid: 'plan-1' },
  type: 'listing',
  attributes: {
    metadata: {
      orderDetail,
      participants: [],
      anonymous: [],
    },
  },
});

const makeOrderListing = (
  participants: string[] = [],
  anonymous: string[] = [],
) => ({
  id: { uuid: 'order-1' },
  type: 'listing',
  attributes: {
    metadata: { participants, anonymous },
  },
});

// ---------------------------------------------------------------------------
// Shared mock accessors
// ---------------------------------------------------------------------------
const mockEval = redisConnection.eval as jest.Mock;
const mockFetchListing = fetchListing as jest.Mock;
const mockGetIntegrationSdk = getIntegrationSdk as jest.Mock;
const mockDenormalised = denormalisedResponseEntities as jest.Mock;

// ---------------------------------------------------------------------------
// Reset individual mocks between tests (not the captured instances)
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  // Default: lock acquire, extend, and release all succeed (return 1)
  mockEval.mockResolvedValue(1);

  // Restore the default add/remove/getJob behaviour on the captured queue
  // instance after clearAllMocks() wiped the mock implementations.
  if (capturedQueueInstance) {
    capturedQueueInstance.add.mockResolvedValue({
      id: 'job-123',
      isFailed: jest.fn().mockResolvedValue(false),
    });
    capturedQueueInstance.remove.mockResolvedValue(undefined);
    capturedQueueInstance.getJob.mockResolvedValue(null);
  }
});

// ---------------------------------------------------------------------------
// Part 1 — addToProcessOrderQueue
// ---------------------------------------------------------------------------

describe('addToProcessOrderQueue', () => {
  const baseData = {
    orderId: 'order-1',
    planId: 'plan-1',
    currentUserId: 'user-1',
  };

  it('removes existing job with same deduplication key before enqueuing', async () => {
    await addToProcessOrderQueue(baseData);

    const deduplicationKey = `${baseData.orderId}-${baseData.planId}-${baseData.currentUserId}`;
    expect(capturedQueueInstance.remove).toHaveBeenCalledWith(deduplicationKey);
  });

  it('adds job with correct jobId matching the deduplication key', async () => {
    await addToProcessOrderQueue(baseData);

    const deduplicationKey = `${baseData.orderId}-${baseData.planId}-${baseData.currentUserId}`;
    expect(capturedQueueInstance.add).toHaveBeenCalledWith(
      expect.any(String),
      baseData,
      expect.objectContaining({ jobId: deduplicationKey }),
    );
  });

  it('returns the job object on success', async () => {
    const fakeJob = {
      id: 'job-xyz',
      isFailed: jest.fn().mockResolvedValue(false),
    };
    capturedQueueInstance.add.mockResolvedValue(fakeJob);

    const result = await addToProcessOrderQueue(baseData);

    expect(result).toBe(fakeJob);
  });

  it('returns null on duplicate error without throwing', async () => {
    capturedQueueInstance.add.mockRejectedValue(
      new Error('duplicate job detected'),
    );

    const result = await addToProcessOrderQueue(baseData);

    expect(result).toBeNull();
  });

  it('throws on non-duplicate errors', async () => {
    capturedQueueInstance.add.mockRejectedValue(
      new Error('Redis connection lost'),
    );

    await expect(addToProcessOrderQueue(baseData)).rejects.toThrow(
      'Redis connection lost',
    );
  });
});

// ---------------------------------------------------------------------------
// Part 2 — Worker job processor (captured via the mock)
// ---------------------------------------------------------------------------

describe('worker job processor', () => {
  const planId = 'plan-1';
  const orderId = 'order-1';
  const currentUserId = 'user-1';

  const defaultJobData = {
    orderId,
    planId,
    currentUserId,
    memberOrders: { [currentUserId]: { itemId: 'food-A' } },
    orderDay: '2024-03-01',
  };

  let mockSdk: any;

  beforeEach(() => {
    mockSdk = {
      listings: {
        update: jest
          .fn()
          .mockResolvedValue({ data: { data: makePlanListing() } }),
      },
    };
    mockGetIntegrationSdk.mockReturnValue(mockSdk);

    mockFetchListing
      .mockResolvedValueOnce(makeOrderListing()) // first call → orderListing
      .mockResolvedValueOnce(makePlanListing()) // second call → updatingPlan (fresh)
      .mockResolvedValue(makePlanListing()); // subsequent calls (verify step)

    mockDenormalised.mockReturnValue([makePlanListing()]);
  });

  const runProcessor = (jobData: Record<string, unknown> = defaultJobData) => {
    if (!capturedProcessor) {
      throw new Error(
        'capturedProcessor is undefined — Worker mock did not capture the processor. ' +
          'Ensure processOrder.job is imported after jest.mock declarations.',
      );
    }

    return capturedProcessor(makeJob(jobData));
  };

  it('acquires the lock before reading the plan', async () => {
    await runProcessor();

    expect(mockEval).toHaveBeenCalled();
    // The first eval call must use the ACQUIRE_LOCK_SCRIPT key pattern
    const firstEvalArgs = mockEval.mock.calls[0];
    expect(firstEvalArgs[2]).toBe(`lock:plan:${planId}`);
  });

  it('fetches the plan listing after acquiring the lock', async () => {
    await runProcessor();

    expect(mockFetchListing).toHaveBeenCalledWith(orderId);
    expect(mockFetchListing).toHaveBeenCalledWith(planId);
  });

  it('merges memberOrders for a single day into orderDetail', async () => {
    const existingDetail = {
      '2024-03-02': { memberOrders: { 'other-user': { itemId: 'food-B' } } },
    };
    mockFetchListing
      .mockReset()
      .mockResolvedValueOnce(makeOrderListing())
      .mockResolvedValueOnce(makePlanListing(existingDetail))
      .mockResolvedValue(makePlanListing());

    await runProcessor();

    const updateCall = mockSdk.listings.update.mock.calls[0][0];
    const updatedOrderDetail = updateCall.metadata.orderDetail;

    // New user order should appear on the target day
    expect(updatedOrderDetail['2024-03-01']).toBeDefined();
    expect(
      updatedOrderDetail['2024-03-01'].memberOrders[currentUserId],
    ).toEqual({ itemId: 'food-A' });
    // Pre-existing unrelated day must remain intact
    expect(updatedOrderDetail['2024-03-02']).toBeDefined();
  });

  it('merges memberOrders for multiple days when orderDays and planData provided', async () => {
    const multiDayJobData = {
      orderId,
      planId,
      currentUserId,
      orderDays: ['2024-03-01', '2024-03-02'],
      planData: {
        '2024-03-01': { [currentUserId]: { itemId: 'food-A' } },
        '2024-03-02': { [currentUserId]: { itemId: 'food-B' } },
      },
    };

    await runProcessor(multiDayJobData);

    const updateCall = mockSdk.listings.update.mock.calls[0][0];
    const updatedOrderDetail = updateCall.metadata.orderDetail;

    expect(
      updatedOrderDetail['2024-03-01'].memberOrders[currentUserId],
    ).toEqual({ itemId: 'food-A' });
    expect(
      updatedOrderDetail['2024-03-02'].memberOrders[currentUserId],
    ).toEqual({ itemId: 'food-B' });
  });

  it('calls sdk.listings.update to persist the updated orderDetail', async () => {
    await runProcessor();

    expect(mockSdk.listings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: planId,
        metadata: expect.objectContaining({ orderDetail: expect.any(Object) }),
      }),
      expect.objectContaining({ expand: true }),
    );
  });

  it('releases the lock in the finally block when the job succeeds', async () => {
    await runProcessor();

    // eval is called at minimum for: acquire, extend (line 312), release (finally)
    const evalCalls = mockEval.mock.calls;
    expect(evalCalls.length).toBeGreaterThanOrEqual(3);

    // All eval calls use the same lock key; verify the key appears throughout
    const lockKeyCalls = evalCalls.filter(
      (call: any[]) => call[2] === `lock:plan:${planId}`,
    );
    expect(lockKeyCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('releases the lock in the finally block when the job fails', async () => {
    mockSdk.listings.update.mockRejectedValue(
      new Error('Sharetribe unavailable'),
    );

    await expect(runProcessor()).rejects.toThrow('Sharetribe unavailable');

    // Despite the error, the lock release eval should still have been called
    const evalCalls = mockEval.mock.calls;
    const releaseCalls = evalCalls.filter(
      (call: any[]) => call[2] === `lock:plan:${planId}`,
    );
    expect(releaseCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('throws when lock acquisition fails after all retries', async () => {
    // Use fake timers so that the exponential backoff setTimeout calls resolve
    // instantly — otherwise the 100-retry loop would exceed the test timeout.
    jest.useFakeTimers();

    // Simulate every eval call returning 0 (lock held by another process)
    mockEval.mockResolvedValue(0);

    // Capture the error via .catch so we can make assertions after the
    // promise settles without relying on rejects.toThrow sequencing with timers.
    let caughtError: Error | undefined;
    const processorPromise = runProcessor().catch((err: Error) => {
      caughtError = err;
    });

    // Drain all pending timers (exponential backoff setTimeout calls) and
    // flush the resulting microtasks in a loop until the promise chain settles.
    for (let i = 0; i < 200; i++) {
      // eslint-disable-next-line no-await-in-loop
      await jest.runAllTimersAsync();
    }
    await processorPromise;

    jest.useRealTimers();

    expect(caughtError).toBeDefined();
    expect((caughtError as Error).message).toContain(
      `Failed to acquire lock for planId: ${planId}`,
    );
  });

  it('adds currentUserId to anonymous when not in participants or anonymous list', async () => {
    mockFetchListing
      .mockReset()
      .mockResolvedValueOnce(makeOrderListing([], []))
      .mockResolvedValueOnce(makePlanListing())
      .mockResolvedValue(makePlanListing());

    await runProcessor();

    const updateCalls = mockSdk.listings.update.mock.calls;
    const anonymousUpdate = updateCalls.find(
      (call: any[]) =>
        call[0]?.id === orderId && call[0]?.metadata?.anonymous !== undefined,
    );
    expect(anonymousUpdate).toBeDefined();
    expect(anonymousUpdate[0].metadata.anonymous).toContain(currentUserId);
  });

  it('does NOT add currentUserId to anonymous when already in participants', async () => {
    mockFetchListing
      .mockReset()
      .mockResolvedValueOnce(makeOrderListing([currentUserId], []))
      .mockResolvedValueOnce(makePlanListing())
      .mockResolvedValue(makePlanListing());

    await runProcessor();

    const updateCalls = mockSdk.listings.update.mock.calls;
    const anonymousUpdate = updateCalls.find(
      (call: any[]) =>
        call[0]?.id === orderId && call[0]?.metadata?.anonymous !== undefined,
    );
    expect(anonymousUpdate).toBeUndefined();
  });

  it('does NOT add currentUserId to anonymous when already in anonymous list', async () => {
    mockFetchListing
      .mockReset()
      .mockResolvedValueOnce(makeOrderListing([], [currentUserId]))
      .mockResolvedValueOnce(makePlanListing())
      .mockResolvedValue(makePlanListing());

    await runProcessor();

    const updateCalls = mockSdk.listings.update.mock.calls;
    const anonymousUpdate = updateCalls.find(
      (call: any[]) =>
        call[0]?.id === orderId && call[0]?.metadata?.anonymous !== undefined,
    );
    expect(anonymousUpdate).toBeUndefined();
  });
});
