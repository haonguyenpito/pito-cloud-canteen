import IORedis from 'ioredis';

export const redisConnection = new IORedis(process.env.NEXT_PUBLIC_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * For the plan lock and the pending-pick hash. BullMQ needs
 * `maxRetriesPerRequest: null` (a command waits for Redis forever), which would
 * hang every orderDetail write while Redis is down; these commands fail within
 * ~2s instead so the request returns an error.
 */
export const lockRedisConnection = new IORedis(
  process.env.NEXT_PUBLIC_REDIS_URL,
  {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    commandTimeout: 2000,
    connectTimeout: 3000,
  },
);
