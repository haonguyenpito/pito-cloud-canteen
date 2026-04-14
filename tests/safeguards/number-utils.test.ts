/**
 * NUMBER UTILITY SAFEGUARDS
 *
 * Tests for number formatting utilities used throughout the UI to display
 * Vietnamese-style prices (dot as thousands separator).
 *
 * Source file: src/utils/number.ts
 */

import { convertStringToNumber, numberWithDots } from '@utils/number';

// ---------------------------------------------------------------------------
// numberWithDots
// ---------------------------------------------------------------------------

describe('numberWithDots', () => {
  it('formats 1000 as 1.000', () => {
    expect(numberWithDots(1000)).toBe('1.000');
  });

  it('formats 1000000 as 1.000.000', () => {
    expect(numberWithDots(1_000_000)).toBe('1.000.000');
  });

  it('formats numbers under 1000 without dots', () => {
    expect(numberWithDots(999)).toBe('999');
  });

  it('formats 0 as 0', () => {
    expect(numberWithDots(0)).toBe('0');
  });

  it('formats typical Vietnamese meal price 85000', () => {
    expect(numberWithDots(85_000)).toBe('85.000');
  });

  it('formats typical monthly order total 12500000', () => {
    expect(numberWithDots(12_500_000)).toBe('12.500.000');
  });

  it('preserves decimal part', () => {
    expect(numberWithDots(1000.5)).toBe('1.000.5');
  });
});

// ---------------------------------------------------------------------------
// convertStringToNumber
// ---------------------------------------------------------------------------

describe('convertStringToNumber', () => {
  it('returns 0 for empty string', () => {
    expect(convertStringToNumber('')).toBe(0);
  });

  it('returns sum of char codes for a simple string', () => {
    // 'A' = 65, 'B' = 66
    expect(convertStringToNumber('AB')).toBe(131);
  });

  it('returns same value for same input (deterministic)', () => {
    const id = 'some-uuid-abc123';
    expect(convertStringToNumber(id)).toBe(convertStringToNumber(id));
  });

  it('returns different values for different strings', () => {
    expect(convertStringToNumber('abc')).not.toBe(convertStringToNumber('xyz'));
  });
});
