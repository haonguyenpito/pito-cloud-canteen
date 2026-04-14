/**
 * date-utils.test.ts
 *
 * Safeguard tests for pure date utility functions exported from src/utils/dates.ts.
 * These functions are used throughout the order lifecycle (date range generation,
 * delivery time calculation, weekday extraction) and must not regress silently.
 *
 * Tested functions:
 *   - renderDateRange(startDate, endDate)
 *   - findEndDeliveryTime(time)
 *   - getDayInWeekFromPeriod(start, end)
 */

// ── Mocks (must come before imports) ──────────────────────────────────────────

// ── Imports ───────────────────────────────────────────────────────────────────

import { DateTime } from 'luxon';

import {
  findEndDeliveryTime,
  getDayInWeekFromPeriod,
  renderDateRange,
} from '@utils/dates';

jest.mock('@src/translations/TranslationProvider', () => ({
  __esModule: true,
  getCurrentLocaleFromLocalStorage: jest.fn().mockReturnValue('vi'),
  getLocaleTimeProvider: jest.fn(),
}));

jest.mock('@components/CalendarDashboard/helpers/constant', () => ({
  MORNING_SESSION: {},
  AFTERNOON_SESSION: {},
  EVENING_SESSION: {},
  DINNER_SESSION: {},
}));

jest.mock('@components/CalendarDashboard/helpers/types', () => ({}));

const VN = 'Asia/Ho_Chi_Minh';

// ── renderDateRange ───────────────────────────────────────────────────────────

describe('renderDateRange', () => {
  it('returns a single timestamp when start === end', () => {
    const day = DateTime.fromObject(
      { year: 2025, month: 3, day: 10, hour: 0 },
      { zone: VN },
    ).toMillis();

    const result = renderDateRange(day, day);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(day);
  });

  it('returns 3 timestamps for a 3-day range', () => {
    const start = DateTime.fromObject(
      { year: 2025, month: 3, day: 10, hour: 0 },
      { zone: VN },
    ).toMillis();
    const end = DateTime.fromObject(
      { year: 2025, month: 3, day: 12, hour: 0 },
      { zone: VN },
    ).toMillis();

    const result = renderDateRange(start, end);

    expect(result).toHaveLength(3);
  });

  it('produces timestamps that are exactly 1 day apart in VN timezone', () => {
    const start = DateTime.fromObject(
      { year: 2025, month: 3, day: 10, hour: 0 },
      { zone: VN },
    ).toMillis();
    const end = DateTime.fromObject(
      { year: 2025, month: 3, day: 12, hour: 0 },
      { zone: VN },
    ).toMillis();

    const result = renderDateRange(start, end);

    for (let i = 1; i < result.length; i++) {
      const prev = DateTime.fromMillis(result[i - 1]).setZone(VN);
      const curr = DateTime.fromMillis(result[i]).setZone(VN);
      expect(curr.diff(prev, 'days').days).toBe(1);
    }
  });

  it('returns an empty array when start > end', () => {
    const later = DateTime.fromObject(
      { year: 2025, month: 3, day: 15, hour: 0 },
      { zone: VN },
    ).toMillis();
    const earlier = DateTime.fromObject(
      { year: 2025, month: 3, day: 10, hour: 0 },
      { zone: VN },
    ).toMillis();

    const result = renderDateRange(later, earlier);

    expect(result).toEqual([]);
  });
});

// ── findEndDeliveryTime ───────────────────────────────────────────────────────

describe('findEndDeliveryTime', () => {
  it('adds 1 hour to "6:30" -> "7:30"', () => {
    expect(findEndDeliveryTime('6:30')).toBe('7:30');
  });

  it('adds 1 hour to "11:00" -> "12:00"', () => {
    expect(findEndDeliveryTime('11:00')).toBe('12:00');
  });

  it('returns "24:00" for "23:00" (boundary: 24 > 24 is false)', () => {
    // Implementation: numHour = 23 + 1 = 24, condition is numHour > 24 (strict),
    // so 24 is NOT greater than 24 and the raw value "24:00" is returned.
    // This is arguably a bug (should probably wrap to "0:00") but we document
    // the current behavior to prevent silent changes.
    expect(findEndDeliveryTime('23:00')).toBe('24:00');
  });

  it('defaults to "6:30" input when called with no argument, returning "7:30"', () => {
    expect(findEndDeliveryTime()).toBe('7:30');
  });
});

// ── getDayInWeekFromPeriod ────────────────────────────────────────────────────

describe('getDayInWeekFromPeriod', () => {
  it('returns 1 weekday number for a single day', () => {
    // 2025-03-10 is a Monday
    const day = DateTime.fromObject(
      { year: 2025, month: 3, day: 10, hour: 12 },
      { zone: VN },
    ).toMillis();

    const result = getDayInWeekFromPeriod(day, day);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(1); // Monday = 1 in Luxon
  });

  it('returns 7 weekday numbers for a full week', () => {
    // Mon 2025-03-10 to Sun 2025-03-16
    const start = DateTime.fromObject(
      { year: 2025, month: 3, day: 10, hour: 0 },
      { zone: VN },
    ).toMillis();
    const end = DateTime.fromObject(
      { year: 2025, month: 3, day: 16, hour: 0 },
      { zone: VN },
    ).toMillis();

    const result = getDayInWeekFromPeriod(start, end);

    expect(result).toHaveLength(7);
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('returns [] when start is 0', () => {
    const end = DateTime.fromObject(
      { year: 2025, month: 3, day: 10 },
      { zone: VN },
    ).toMillis();

    expect(getDayInWeekFromPeriod(0, end)).toEqual([]);
  });

  it('returns [] when end is 0', () => {
    const start = DateTime.fromObject(
      { year: 2025, month: 3, day: 10 },
      { zone: VN },
    ).toMillis();

    expect(getDayInWeekFromPeriod(start, 0)).toEqual([]);
  });

  it('returns correct weekday numbers for known dates', () => {
    // Wed 2025-03-12 to Fri 2025-03-14
    const start = DateTime.fromObject(
      { year: 2025, month: 3, day: 12, hour: 0 },
      { zone: VN },
    ).toMillis();
    const end = DateTime.fromObject(
      { year: 2025, month: 3, day: 14, hour: 0 },
      { zone: VN },
    ).toMillis();

    const result = getDayInWeekFromPeriod(start, end);

    // Wed=3, Thu=4, Fri=5
    expect(result).toEqual([3, 4, 5]);
  });
});
