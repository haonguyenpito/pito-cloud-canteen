/**
 * withPlanLock serializes every read-modify-write of plan.metadata.orderDetail
 * with processOrder.job (same `lock:plan:{planId}` key).
 *
 * Source: src/services/distributedLock.ts
 */
import { withPlanLock } from '@services/distributedLock';

// In-memory stand-in for the acquire/release Lua scripts (token-owned key).
const store = new Map<string, string>();

jest.mock('@services/redis', () => ({
  // Lock and pending picks use their own fail-fast connection; same fake here.
  get lockRedisConnection() {
    return this.redisConnection;
  },
  redisConnection: {
    eval: jest.fn(
      async (script: string, _keys: number, key: string, token: string) => {
        const current = store.get(key);
        if (script.includes("'DEL'")) {
          if (current !== token) return 0;
          store.delete(key);

          return 1;
        }
        if (current === undefined || current === token) {
          store.set(key, token);

          return 1;
        }

        return 0;
      },
    ),
  },
}));

jest.spyOn(console, 'log').mockImplementation(() => undefined);
jest.spyOn(console, 'warn').mockImplementation(() => undefined);
jest.spyOn(console, 'error').mockImplementation(() => undefined);

describe('withPlanLock', () => {
  beforeEach(() => store.clear());

  it('holds lock:plan:{planId} during the critical section and releases it after', async () => {
    const result = await withPlanLock('plan-1', async () => {
      expect(store.has('lock:plan:plan-1')).toBe(true);

      return 'done';
    });

    expect(result).toBe('done');
    expect(store.size).toBe(0);
  });

  it('releases the lock when the critical section throws', async () => {
    await expect(
      withPlanLock('plan-1', async () => {
        throw new Error('sharetribe down');
      }),
    ).rejects.toThrow('sharetribe down');

    expect(store.size).toBe(0);
  });

  it('fails fast on a nested lock of the same plan instead of stalling until TTL', async () => {
    await expect(
      withPlanLock('plan-1', () => withPlanLock('plan-1', async () => 'inner')),
    ).rejects.toThrow('Nested plan lock for planId: plan-1');

    expect(store.size).toBe(0);
  });

  it('serializes concurrent writers of the same plan', async () => {
    const events: string[] = [];
    const writer = (name: string) =>
      withPlanLock('plan-1', async () => {
        events.push(`${name}:start`);
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
        events.push(`${name}:end`);
      });

    await Promise.all([writer('a'), writer('b')]);

    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('gives up instead of hanging when another holder keeps the lock', async () => {
    store.set('lock:plan:plan-1', 'other-holder');
    jest.useFakeTimers();

    const pending = withPlanLock('plan-1', async () => 'never');
    const assertion = expect(pending).rejects.toThrow(
      'Failed to acquire lock for planId: plan-1',
    );
    await jest.runAllTimersAsync();
    await assertion;

    jest.useRealTimers();
    expect(store.get('lock:plan:plan-1')).toBe('other-holder');
  });
});
