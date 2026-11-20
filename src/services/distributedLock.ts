import type { Redis } from 'ioredis';
import { AsyncLocalStorage } from 'node:async_hooks';

import { redisConnection } from '@services/redis';

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

const MAX_RETRY_DELAY_MS = 300;

export class DistributedLock {
  private redis: Redis;

  private lockKey: string;

  private token: string;

  private ttl: number;

  private retryDelay: number;

  private maxRetries: number;

  constructor(
    redis: Redis,
    resource: string,
    options: { ttl?: number; retryDelay?: number; maxRetries?: number } = {},
  ) {
    this.redis = redis;
    this.lockKey = `lock:${resource}`;
    this.token = `${Date.now()}-${Math.random()}`;
    this.ttl = options.ttl || 30000;
    this.retryDelay = options.retryDelay || 100;
    this.maxRetries = options.maxRetries || 50;
  }

  private async tryAcquireLock(attempts = 0): Promise<boolean> {
    const startTime = Date.now();
    console.log(
      `[RACE_DEBUG] Lock acquisition attempt ${attempts + 1}/${
        this.maxRetries
      } for ${this.lockKey}, token: ${this.token}`,
    );

    const result = (await this.redis.eval(
      ACQUIRE_LOCK_SCRIPT,
      1,
      this.lockKey,
      this.token,
      this.ttl,
    )) as number;

    const duration = Date.now() - startTime;

    if (result === 1) {
      console.log(
        `[RACE_DEBUG] Lock acquired successfully for ${this.lockKey} after ${
          attempts + 1
        } attempts, duration: ${duration}ms, token: ${this.token}`,
      );

      return true;
    }

    if (attempts >= this.maxRetries) {
      console.error(
        `[RACE_DEBUG] Lock acquisition failed after ${
          attempts + 1
        } attempts for ${this.lockKey}, total duration: ${duration}ms, token: ${
          this.token
        }`,
      );

      return false;
    }

    // Capped so a waiter notices a released lock within ~300ms; an uncapped
    // backoff left the lock idle for seconds between queued writers.
    const delay = Math.min(
      this.retryDelay * 1.5 ** Math.min(attempts, 10),
      MAX_RETRY_DELAY_MS,
    );
    console.warn(
      `[RACE_DEBUG] Lock busy for ${
        this.lockKey
      }, retrying in ${delay}ms (attempt ${attempts + 1}/${
        this.maxRetries
      }), token: ${this.token}`,
    );

    await new Promise((res) => {
      setTimeout(res, delay);
    });

    return this.tryAcquireLock(attempts + 1);
  }

  async acquire(): Promise<boolean> {
    return this.tryAcquireLock();
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

const heldPlanLocks = new AsyncLocalStorage<Set<string>>();

/**
 * Serializes every read-modify-write of `plan.metadata.orderDetail` with
 * processOrder.job (same key). Keep `criticalSection` to fetch + merge + update
 * only: it must finish well within the 30s TTL, and must never await a job or
 * another plan lock.
 */
export const withPlanLock = async <T>(
  planId: string,
  criticalSection: () => Promise<T>,
): Promise<T> => {
  const heldPlanIds = heldPlanLocks.getStore() ?? new Set<string>();
  // The lock is not re-entrant: nesting would stall until the outer TTL expires.
  if (heldPlanIds.has(planId)) {
    throw new Error(`Nested plan lock for planId: ${planId}`);
  }

  // ~11s of backoff, so an API request fails fast instead of hanging.
  const lock = new DistributedLock(redisConnection as Redis, `plan:${planId}`, {
    ttl: 30000,
    retryDelay: 100,
    maxRetries: 40,
  });
  if (!(await lock.acquire())) {
    throw new Error(`Failed to acquire lock for planId: ${planId}`);
  }

  try {
    return await heldPlanLocks.run(
      new Set(heldPlanIds).add(planId),
      criticalSection,
    );
  } finally {
    await lock.release();
  }
};
