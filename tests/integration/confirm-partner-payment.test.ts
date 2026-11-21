/**
 * CONFIRM PARTNER PAYMENT — PLAN LOCK
 *
 * The handler writes plan.metadata.orderDetail, so the read-check-write must
 * run under `lock:plan:{planId}` like every other orderDetail writer: a write
 * outside it can drop a participant pick, and a check outside it can let two
 * admins confirm the same date.
 *
 * Source file: src/pages/api/admin/payment/confirm-partner-payment.api.ts
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import handler from '@pages/api/admin/payment/confirm-partner-payment.api';
import { getIntegrationSdk } from '@services/integrationSdk';

import { updatePartnerRootPaymentRecord } from '../../src/pages/api/admin/payment/payment.service';

jest.mock('@apis/configs', () => ({
  composeApiCheckers: jest.fn(
    (..._checkers: any[]) =>
      (h: any) =>
        h,
  ),
  HttpMethod: { PUT: 'PUT', POST: 'POST', GET: 'GET' },
}));

jest.mock('@services/permissionChecker/admin', () =>
  jest.fn().mockReturnValue((h: any) => h),
);

jest.mock('@services/integrationSdk', () => ({
  getIntegrationSdk: jest.fn(),
}));

jest.mock('../../src/pages/api/admin/payment/payment.service', () => ({
  updatePartnerRootPaymentRecord: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@services/sdk', () => ({
  handleError: jest.fn(),
}));

// In-memory stand-in for the lock's acquire/release Lua scripts.
jest.mock('@services/redis', () => {
  const store = new Map<string, string>();

  return {
    __store: store,
    // Lock and pending picks use their own fail-fast connection; same fake here.
    get lockRedisConnection() {
      return this.redisConnection;
    },
    redisConnection: {
      eval: jest.fn(
        async (script: string, _n: number, key: string, token: string) => {
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
  };
});

jest.spyOn(console, 'log').mockImplementation(() => undefined);
jest.spyOn(console, 'warn').mockImplementation(() => undefined);

const PLAN_ID = 'plan-1';
const DATE = '1711929600000';
const { __store: lockStore } = jest.requireMock('@services/redis');

let orderDetail: Record<string, any>;
let lockHeldDuringWrite: boolean[];

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res as NextApiResponse & { status: jest.Mock; json: jest.Mock };
};

const confirm = async () => {
  const res = makeRes();
  await handler(
    {
      method: 'PUT',
      body: { planId: PLAN_ID, subOrderDate: DATE },
    } as NextApiRequest,
    res,
  );

  return res;
};

beforeEach(() => {
  lockStore.clear();
  lockHeldDuringWrite = [];
  orderDetail = {
    [DATE]: { memberOrders: { 'user-1': { foodId: 'food-A' } } },
  };
  (getIntegrationSdk as jest.Mock).mockReturnValue({
    listings: {
      show: jest.fn(async () => ({
        data: {
          data: {
            id: { uuid: PLAN_ID },
            type: 'listing',
            attributes: {
              metadata: {
                orderId: 'order-1',
                orderDetail: JSON.parse(JSON.stringify(orderDetail)),
              },
            },
          },
        },
      })),
      update: jest.fn(async ({ metadata }: any) => {
        lockHeldDuringWrite.push(lockStore.has(`lock:plan:${PLAN_ID}`));
        orderDetail = metadata.orderDetail;

        return { data: {} };
      }),
    },
  });
  (updatePartnerRootPaymentRecord as jest.Mock).mockClear();
});

describe('PUT /api/admin/payment/confirm-partner-payment', () => {
  it('writes the confirmation under the plan lock and keeps the other fields', async () => {
    const res = await confirm();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(lockHeldDuringWrite).toEqual([true]);
    expect(lockStore.size).toBe(0);
    expect(orderDetail[DATE]).toEqual({
      memberOrders: { 'user-1': { foodId: 'food-A' } },
      isAdminPaymentConfirmed: true,
    });
  });

  it('lets only one of two simultaneous confirms through', async () => {
    const [first, second] = await Promise.all([confirm(), confirm()]);

    const statuses = [first, second].map((r) => r.status.mock.calls[0][0]);
    expect(statuses.sort()).toEqual([200, 400]);
    expect(updatePartnerRootPaymentRecord).toHaveBeenCalledTimes(1);
  });
});
