/**
 * PREPARE DATA HELPER SAFEGUARDS
 *
 * Tests for the utility functions in prepareDataHelper.ts that were previously
 * untested. These functions are used across the order creation UI and API layers.
 *
 * Source: src/helpers/order/prepareDataHelper.ts
 */

import {
  findDeliveryDate,
  findMinDeadlineDate,
  findSuitableAnchorDate,
  findValidRangeForDeadlineDate,
  getParticipantPickingLink,
  getTrackingLink,
  prepareDaySession,
} from '@helpers/order/prepareDataHelper';

jest.mock('@src/utils/constants', () => ({
  QUERY_REFS: { INVITATION_LINK: 'invitation' },
}));
jest.mock('@helpers/dateHelpers', () => ({
  convertHHmmStringToTimeParts: jest
    .fn()
    .mockReturnValue({ hours: 11, minutes: 30 }),
}));
jest.mock('@src/utils/dates', () => ({
  getDaySessionFromDeliveryTime: jest.fn().mockReturnValue('morning'),
  renderDateRange: jest.fn(),
}));
jest.mock('@components/CalendarDashboard/helpers/constant', () => ({
  SESSION_TIMES: {
    morning: { START: '08:00', END: '12:00' },
    afternoon: { START: '13:00', END: '17:00' },
  },
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_CANONICAL_URL = 'https://app.example.com';
});

// ---------------------------------------------------------------------------
// getTrackingLink
// ---------------------------------------------------------------------------

describe('getTrackingLink', () => {
  it('builds the correct tracking URL', () => {
    expect(getTrackingLink('order-123', 1700000000000)).toBe(
      'https://app.example.com/tracking/order-123_1700000000000',
    );
  });

  it('works with string timestamp', () => {
    expect(getTrackingLink('order-abc', '2024-01-15')).toBe(
      'https://app.example.com/tracking/order-abc_2024-01-15',
    );
  });
});

// ---------------------------------------------------------------------------
// getParticipantPickingLink
// ---------------------------------------------------------------------------

describe('getParticipantPickingLink', () => {
  it('includes ref query param', () => {
    const url = getParticipantPickingLink({ orderId: 'order-1' });
    expect(url).toContain('ref=invitation');
    expect(url).toContain('/invitation/order-1');
  });

  it('includes companyId when provided', () => {
    const url = getParticipantPickingLink({
      orderId: 'order-1',
      companyId: 'co-1',
    });
    expect(url).toContain('companyId=co-1');
  });

  it('omits companyId when not provided', () => {
    const url = getParticipantPickingLink({ orderId: 'order-1' });
    expect(url).not.toContain('companyId');
  });
});

// ---------------------------------------------------------------------------
// findDeliveryDate
// ---------------------------------------------------------------------------

describe('findDeliveryDate', () => {
  it('returns undefined when startDate is missing', () => {
    expect(findDeliveryDate(undefined, '11:30')).toBeUndefined();
  });

  it('returns undefined when deliveryHour is missing', () => {
    expect(findDeliveryDate(1700000000000, undefined)).toBeUndefined();
  });

  it('returns undefined when both params are missing', () => {
    expect(findDeliveryDate()).toBeUndefined();
  });

  it('returns a number greater than the start date', () => {
    const startDate = new Date('2024-01-15T00:00:00.000Z').getTime();
    const result = findDeliveryDate(startDate, '11:30');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(startDate);
  });

  it('handles delivery hour with range format (takes start time)', () => {
    const startDate = new Date('2024-01-15T00:00:00.000Z').getTime();
    const result = findDeliveryDate(startDate, '11:30-12:00');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(startDate);
  });
});

// ---------------------------------------------------------------------------
// findValidRangeForDeadlineDate
// ---------------------------------------------------------------------------

describe('findValidRangeForDeadlineDate', () => {
  it('returns undefined maxSelectedDate when no startDate provided', () => {
    const { maxSelectedDate } = findValidRangeForDeadlineDate();
    expect(maxSelectedDate).toBeUndefined();
  });

  it('returns a minSelectedDate in the future', () => {
    const { minSelectedDate } = findValidRangeForDeadlineDate();
    expect(minSelectedDate.getTime()).toBeGreaterThan(new Date().getTime());
  });

  it('returns maxSelectedDate as 2 days before the given startDate', () => {
    const startDate = new Date('2024-03-20T00:00:00.000Z');
    const { maxSelectedDate } = findValidRangeForDeadlineDate(startDate);
    const expected = new Date('2024-03-18T00:00:00.000Z');
    expect(maxSelectedDate?.toDateString()).toBe(expected.toDateString());
  });

  it('caps minSelectedDate so it does not exceed maxSelectedDate', () => {
    // If maxSelectedDate is earlier than tomorrow, minSelectedDate = maxSelectedDate
    const nearStartDate = new Date();
    nearStartDate.setDate(nearStartDate.getDate() + 2); // 2 days away → max = today
    const { minSelectedDate, maxSelectedDate } =
      findValidRangeForDeadlineDate(nearStartDate);
    expect(minSelectedDate.getTime()).toBeLessThanOrEqual(
      (maxSelectedDate ?? new Date()).getTime(),
    );
  });
});

// ---------------------------------------------------------------------------
// findMinDeadlineDate
// ---------------------------------------------------------------------------

describe('findMinDeadlineDate', () => {
  it('returns a date representing tomorrow at start of day', () => {
    const result = findMinDeadlineDate();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    expect(result.getDate()).toBe(tomorrow.getDate());
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// prepareDaySession
// ---------------------------------------------------------------------------

describe('prepareDaySession', () => {
  it('returns the provided daySession when it is truthy', () => {
    expect(prepareDaySession('morning' as any)).toBe('morning');
  });

  it('falls back to getDaySessionFromDeliveryTime when daySession is falsy', () => {
    const { getDaySessionFromDeliveryTime } =
      jest.requireMock('@src/utils/dates');
    getDaySessionFromDeliveryTime.mockReturnValue('afternoon');

    const result = prepareDaySession(undefined as any, '13:00-14:00');
    expect(result).toBe('afternoon');
    expect(getDaySessionFromDeliveryTime).toHaveBeenCalledWith('13:00');
  });

  it('passes undefined to getDaySessionFromDeliveryTime when deliveryHour is empty', () => {
    const { getDaySessionFromDeliveryTime } =
      jest.requireMock('@src/utils/dates');

    prepareDaySession(undefined as any, '');
    expect(getDaySessionFromDeliveryTime).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// findSuitableAnchorDate
// ---------------------------------------------------------------------------

describe('findSuitableAnchorDate', () => {
  it('returns the selectedDate when provided as a valid Date', () => {
    const { renderDateRange } = jest.requireMock('@src/utils/dates');
    const selectedDate = new Date('2024-01-15');
    const result = findSuitableAnchorDate({
      selectedDate,
      orderDetail: {},
    });
    expect(result).toBe(selectedDate);
    expect(renderDateRange).not.toHaveBeenCalled();
  });

  it('returns startDate when orderDetail is empty', () => {
    const { renderDateRange } = jest.requireMock('@src/utils/dates');
    renderDateRange.mockReturnValue([
      new Date('2024-01-15'),
      new Date('2024-01-16'),
    ]);

    const startDate = new Date('2024-01-15').getTime();
    const result = findSuitableAnchorDate({ orderDetail: {}, startDate });
    expect(result).toBe(startDate);
  });

  it('returns the first date in range that has no food list configured', () => {
    const { renderDateRange } = jest.requireMock('@src/utils/dates');
    const dateWithFood = new Date('2024-01-15T00:00:00.000Z');
    const dateWithoutFood = new Date('2024-01-16T00:00:00.000Z');
    renderDateRange.mockReturnValue([dateWithFood, dateWithoutFood]);

    // Keys must match Date.toString() since the helper does orderDetail[date.toString()]
    const orderDetail = {
      [dateWithFood.toString()]: {
        restaurant: { foodList: { f1: {} } }, // has food — skipped
      },
      [dateWithoutFood.toString()]: {
        restaurant: { foodList: {} }, // no food — selected
      },
    };

    const result = findSuitableAnchorDate({
      orderDetail,
      startDate: dateWithFood.getTime(),
      endDate: dateWithoutFood.getTime(),
    });

    expect(result).toEqual(dateWithoutFood);
  });
});
