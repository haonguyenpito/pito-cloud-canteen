/**
 * SCHEDULER TIME CALCULATION SAFEGUARDS
 *
 * EventBridge schedulers fire AWS Lambdas at specific times for order automation.
 * A wrong calculation causes orders to auto-start too early/late, or sends reminder
 * notifications at the wrong time — both directly affect restaurant preparation and
 * participant experience.
 *
 * Key invariants:
 * - All scheduler times are expressed in Asia/Ho_Chi_Minh timezone
 * - upsertAutomaticStartOrderScheduler fires OFFSET hours BEFORE the delivery hour
 * - sendRemindPickingNativeNotificationToBookerScheduler fires REMIND_OFFSET minutes BEFORE deadline
 * - upsertPickFoodForEmptyMembersScheduler fires exactly AT the deadline (no offset)
 * - deliveryHour in "HH:mm-HH:mm" range format → only the start time is used
 * - Missing required params (orderId/startDate/deliveryHour) → exits early, no scheduler created
 *
 * Source file: src/services/awsEventBrigdeScheduler.ts
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Factories use only inline jest.fn() — no external variable references.
// jest.mock() is hoisted before imports, so external const refs would be in TDZ.
// Instance-level mocks (createSchedule / getSchedule / updateSchedule) are wired
// via MockScheduler.mockImplementation() in each beforeEach.

// ── Imports ───────────────────────────────────────────────────────────────────

import AWS from 'aws-sdk';
import { DateTime } from 'luxon';

import { convertHHmmStringToTimeParts } from '@helpers/dateHelpers';
import {
  sendRemindPickingNativeNotificationToBookerScheduler,
  upsertAutomaticStartOrderScheduler,
  upsertPickFoodForEmptyMembersScheduler,
} from '@services/awsEventBrigdeScheduler';

jest.mock('aws-sdk', () => {
  // Mock fns are created inside the factory so they are available when the
  // service module calls `new AWS.Scheduler(...)` at load time (before beforeEach).
  // Exposed via __schedulerMocks so tests can reference and re-configure them.
  const _createSchedule = jest
    .fn()
    .mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
  const _getSchedule = jest.fn().mockReturnValue({
    promise: jest
      .fn()
      .mockRejectedValue(new Error('ResourceNotFoundException')),
  });
  const _updateSchedule = jest
    .fn()
    .mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });

  return {
    Scheduler: jest.fn().mockImplementation(() => ({
      createSchedule: _createSchedule,
      getSchedule: _getSchedule,
      updateSchedule: _updateSchedule,
    })),
    __schedulerMocks: {
      createSchedule: _createSchedule,
      getSchedule: _getSchedule,
      updateSchedule: _updateSchedule,
    },
  };
});

jest.mock('@src/translations/TranslationProvider', () => ({
  __esModule: true,
  getCurrentLocaleFromLocalStorage: () => 'vi',
  getLocaleTimeProvider: () => null,
}));

// __esModule: true is required — TypeScript compiles `import logger from '...'` with
// __importDefault(), which wraps non-ESM modules as { default: module }. Without this
// flag the mock becomes { default: { default: {...} } } and logger.error is undefined.
jest.mock('@helpers/logger', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Access the mock fns created inside the factory via __schedulerMocks.
// Using (AWS as any) because __schedulerMocks is not part of the aws-sdk type.
// These are const (not let) — the factory creates them once and they persist across tests.
// jest.clearAllMocks() clears call counts and return values but NOT the references,
// so resetSchedulerMocks() just re-applies the default return values.
const {
  createSchedule: mockCreateSchedule,
  getSchedule: mockGetSchedule,
  updateSchedule: mockUpdateSchedule,
} = (AWS as any).__schedulerMocks as {
  createSchedule: jest.Mock;
  getSchedule: jest.Mock;
  updateSchedule: jest.Mock;
};

/** Clears all mock state and re-applies default return values. Call in beforeEach. */
const resetSchedulerMocks = () => {
  jest.clearAllMocks();
  mockCreateSchedule.mockReturnValue({
    promise: jest.fn().mockResolvedValue({}),
  });
  mockGetSchedule.mockReturnValue({
    promise: jest
      .fn()
      .mockRejectedValue(new Error('ResourceNotFoundException')),
  });
  mockUpdateSchedule.mockReturnValue({
    promise: jest.fn().mockResolvedValue({}),
  });
};

const VNTimezone = 'Asia/Ho_Chi_Minh';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a Unix ms timestamp for a datetime string expressed in Vietnam time */
const vnTime = (iso: string) =>
  DateTime.fromISO(iso, { zone: VNTimezone }).toMillis();

// ── convertHHmmStringToTimeParts ──────────────────────────────────────────────

describe('convertHHmmStringToTimeParts', () => {
  it('parses "11:00" into { hours: 11, minutes: 0 }', () => {
    expect(convertHHmmStringToTimeParts('11:00')).toEqual({
      hours: 11,
      minutes: 0,
    });
  });

  it('parses "07:30" into { hours: 7, minutes: 30 }', () => {
    expect(convertHHmmStringToTimeParts('07:30')).toEqual({
      hours: 7,
      minutes: 30,
    });
  });

  it('parses "00:00" into { hours: 0, minutes: 0 }', () => {
    expect(convertHHmmStringToTimeParts('00:00')).toEqual({
      hours: 0,
      minutes: 0,
    });
  });

  it('parses "23:59" into { hours: 23, minutes: 59 }', () => {
    expect(convertHHmmStringToTimeParts('23:59')).toEqual({
      hours: 23,
      minutes: 59,
    });
  });

  it('falls back to { hours: 6, minutes: 30 } for undefined input', () => {
    expect(convertHHmmStringToTimeParts(undefined)).toEqual({
      hours: 6,
      minutes: 30,
    });
  });
});

// ── upsertAutomaticStartOrderScheduler ───────────────────────────────────────

describe('upsertAutomaticStartOrderScheduler', () => {
  const startDateVN = vnTime('2024-03-15'); // 2024-03-15T00:00:00+07:00

  beforeEach(() => {
    resetSchedulerMocks();
  });

  it('fires at delivery time when offset is 0 — no adjustment applied', async () => {
    process.env.NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR =
      '0';

    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-1',
      startDate: startDateVN,
      deliveryHour: '11:00',
    });

    expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
    const { ScheduleExpression } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpression).toBe('at(2024-03-15T11:00:00)');
  });

  it('subtracts 1 hour from 11:00 delivery → fires at 10:00', async () => {
    process.env.NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR =
      '1';

    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-1',
      startDate: startDateVN,
      deliveryHour: '11:00',
    });

    const { ScheduleExpression } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpression).toBe('at(2024-03-15T10:00:00)');
  });

  it('subtracts 2 hours from 08:00 delivery → fires at 06:00', async () => {
    process.env.NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR =
      '2';

    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-1',
      startDate: startDateVN,
      deliveryHour: '08:00',
    });

    const { ScheduleExpression } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpression).toBe('at(2024-03-15T06:00:00)');
  });

  it('handles range deliveryHour "11:00-12:00" — uses only the start time 11:00', async () => {
    process.env.NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR =
      '1';

    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-1',
      startDate: startDateVN,
      deliveryHour: '11:00-12:00',
    });

    const { ScheduleExpression } = mockCreateSchedule.mock.calls[0][0];
    // Should treat "11:00-12:00" the same as "11:00"
    expect(ScheduleExpression).toBe('at(2024-03-15T10:00:00)');
  });

  it('uses timezone Asia/Ho_Chi_Minh in the schedule expression', async () => {
    process.env.NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR =
      '0';

    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-1',
      startDate: startDateVN,
      deliveryHour: '11:00',
    });

    const { ScheduleExpressionTimezone } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpressionTimezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('names the scheduler "automaticStartOrder_{orderId}"', async () => {
    process.env.NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR =
      '0';

    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-abc-123',
      startDate: startDateVN,
      deliveryHour: '11:00',
    });

    const { Name } = mockCreateSchedule.mock.calls[0][0];
    expect(Name).toBe('automaticStartOrder_order-abc-123');
  });

  it('updates an existing scheduler instead of creating a new one', async () => {
    process.env.NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR =
      '1';
    // Simulate scheduler already exists — getSchedule resolves
    mockGetSchedule.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({}),
    });

    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-1',
      startDate: startDateVN,
      deliveryHour: '11:00',
    });

    expect(mockUpdateSchedule).toHaveBeenCalledTimes(1);
    expect(mockCreateSchedule).not.toHaveBeenCalled();
    const { ScheduleExpression } = mockUpdateSchedule.mock.calls[0][0];
    expect(ScheduleExpression).toBe('at(2024-03-15T10:00:00)');
  });

  it('returns early without any AWS calls when orderId is empty', async () => {
    await upsertAutomaticStartOrderScheduler({
      orderId: '',
      startDate: startDateVN,
      deliveryHour: '11:00',
    });

    expect(mockCreateSchedule).not.toHaveBeenCalled();
    expect(mockGetSchedule).not.toHaveBeenCalled();
  });

  it('returns early without any AWS calls when startDate is 0', async () => {
    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-1',
      startDate: 0,
      deliveryHour: '11:00',
    });

    expect(mockCreateSchedule).not.toHaveBeenCalled();
    expect(mockGetSchedule).not.toHaveBeenCalled();
  });

  it('returns early without any AWS calls when deliveryHour is empty string', async () => {
    await upsertAutomaticStartOrderScheduler({
      orderId: 'order-1',
      startDate: startDateVN,
      deliveryHour: '',
    });

    expect(mockCreateSchedule).not.toHaveBeenCalled();
    expect(mockGetSchedule).not.toHaveBeenCalled();
  });
});

// ── sendRemindPickingNativeNotificationToBookerScheduler ──────────────────────

describe('sendRemindPickingNativeNotificationToBookerScheduler', () => {
  // Deadline: 2024-03-15 12:00:00 VN time
  const deadlineVN = vnTime('2024-03-15T12:00:00');

  beforeEach(() => {
    resetSchedulerMocks();
  });

  it('fires 30 minutes before deadline → 11:30 when deadline is 12:00', async () => {
    process.env.NEXT_PUBLIC_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_TIME_TO_DEADLINE_IN_MINUTES =
      '30';

    await sendRemindPickingNativeNotificationToBookerScheduler({
      orderId: 'order-1',
      deadlineDate: deadlineVN,
    });

    expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
    const { ScheduleExpression } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpression).toBe('at(2024-03-15T11:30:00)');
  });

  it('fires 60 minutes before deadline → 11:00 when deadline is 12:00', async () => {
    process.env.NEXT_PUBLIC_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_TIME_TO_DEADLINE_IN_MINUTES =
      '60';

    await sendRemindPickingNativeNotificationToBookerScheduler({
      orderId: 'order-1',
      deadlineDate: deadlineVN,
    });

    const { ScheduleExpression } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpression).toBe('at(2024-03-15T11:00:00)');
  });

  it('uses timezone Asia/Ho_Chi_Minh in the schedule expression', async () => {
    process.env.NEXT_PUBLIC_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_TIME_TO_DEADLINE_IN_MINUTES =
      '30';

    await sendRemindPickingNativeNotificationToBookerScheduler({
      orderId: 'order-1',
      deadlineDate: deadlineVN,
    });

    const { ScheduleExpressionTimezone } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpressionTimezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('names the scheduler "sendRPNNTB_{orderId}"', async () => {
    process.env.NEXT_PUBLIC_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_TIME_TO_DEADLINE_IN_MINUTES =
      '30';

    await sendRemindPickingNativeNotificationToBookerScheduler({
      orderId: 'order-xyz',
      deadlineDate: deadlineVN,
    });

    const { Name } = mockCreateSchedule.mock.calls[0][0];
    expect(Name).toBe('sendRPNNTB_order-xyz');
  });

  it('updates an existing scheduler instead of creating a new one', async () => {
    process.env.NEXT_PUBLIC_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_TIME_TO_DEADLINE_IN_MINUTES =
      '30';
    mockGetSchedule.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({}),
    });

    await sendRemindPickingNativeNotificationToBookerScheduler({
      orderId: 'order-1',
      deadlineDate: deadlineVN,
    });

    expect(mockUpdateSchedule).toHaveBeenCalledTimes(1);
    expect(mockCreateSchedule).not.toHaveBeenCalled();
    const { ScheduleExpression } = mockUpdateSchedule.mock.calls[0][0];
    expect(ScheduleExpression).toBe('at(2024-03-15T11:30:00)');
  });
});

// ── upsertPickFoodForEmptyMembersScheduler ────────────────────────────────────

describe('upsertPickFoodForEmptyMembersScheduler', () => {
  // Deadline: 2024-03-15 10:00:00 VN time
  const deadlineVN = vnTime('2024-03-15T10:00:00');

  beforeEach(() => {
    resetSchedulerMocks();
  });

  it('fires exactly at deadlineDate — no offset applied', async () => {
    await upsertPickFoodForEmptyMembersScheduler({
      orderId: 'order-1',
      deadlineDate: deadlineVN,
      params: { orderId: 'order-1' },
    });

    expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
    const { ScheduleExpression } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpression).toBe('at(2024-03-15T10:00:00)');
  });

  it('names the scheduler "PFFEM_{orderId}"', async () => {
    await upsertPickFoodForEmptyMembersScheduler({
      orderId: 'order-1',
      deadlineDate: deadlineVN,
      params: { orderId: 'order-1' },
    });

    const { Name } = mockCreateSchedule.mock.calls[0][0];
    expect(Name).toBe('PFFEM_order-1');
  });

  it('returns early without any AWS calls when deadlineDate is 0', async () => {
    await upsertPickFoodForEmptyMembersScheduler({
      orderId: 'order-1',
      deadlineDate: 0,
      params: { orderId: 'order-1' },
    });

    expect(mockCreateSchedule).not.toHaveBeenCalled();
    expect(mockGetSchedule).not.toHaveBeenCalled();
  });

  it('uses timezone Asia/Ho_Chi_Minh in the schedule expression', async () => {
    await upsertPickFoodForEmptyMembersScheduler({
      orderId: 'order-1',
      deadlineDate: deadlineVN,
      params: { orderId: 'order-1' },
    });

    const { ScheduleExpressionTimezone } = mockCreateSchedule.mock.calls[0][0];
    expect(ScheduleExpressionTimezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('updates an existing scheduler instead of creating a new one', async () => {
    mockGetSchedule.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({}),
    });

    await upsertPickFoodForEmptyMembersScheduler({
      orderId: 'order-1',
      deadlineDate: deadlineVN,
      params: { orderId: 'order-1' },
    });

    expect(mockUpdateSchedule).toHaveBeenCalledTimes(1);
    expect(mockCreateSchedule).not.toHaveBeenCalled();
  });
});
