/**
 * STRING UTILITY SAFEGUARDS
 *
 * Tests for string utilities used across UI and data layers.
 * Vietnamese name splitting and accent removal are especially important
 * because they affect display names sent in emails and notifications.
 *
 * Source file: src/utils/string.ts
 */

import {
  capitalize,
  getDecorator,
  getFullName,
  removeAccents,
  splitNameFormFullName,
  toNonAccentVietnamese,
} from '@utils/string';

// ---------------------------------------------------------------------------
// splitNameFormFullName
// ---------------------------------------------------------------------------

describe('splitNameFormFullName', () => {
  it('splits a two-word Vietnamese name correctly', () => {
    const result = splitNameFormFullName('Nguyễn An');
    expect(result.lastName).toBe('Nguyễn');
    expect(result.firstName).toBe('An');
  });

  it('splits a three-word Vietnamese name: last two words become firstName/lastName', () => {
    // "Nguyễn Văn An" → lastName = "Nguyễn Văn", firstName = "An"
    const result = splitNameFormFullName('Nguyễn Văn An');
    expect(result.lastName).toBe('Nguyễn Văn');
    expect(result.firstName).toBe('An');
  });

  it('uses the single word as both firstName and lastName', () => {
    const result = splitNameFormFullName('An');
    expect(result.firstName).toBe('An');
    expect(result.lastName).toBe('An');
  });

  it('returns default names when input is undefined', () => {
    const result = splitNameFormFullName(undefined);
    expect(result.lastName).toBe('Người dùng');
    expect(result.firstName).toBe('chưa đặt tên');
  });

  it('returns default names when input is empty string', () => {
    const result = splitNameFormFullName('');
    expect(result.lastName).toBe('Người dùng');
    expect(result.firstName).toBe('chưa đặt tên');
  });

  it('handles extra whitespace between words', () => {
    const result = splitNameFormFullName('Nguyễn  An');
    expect(result.firstName).toBe('An');
    expect(result.lastName).toBe('Nguyễn');
  });
});

// ---------------------------------------------------------------------------
// removeAccents
// ---------------------------------------------------------------------------

describe('removeAccents', () => {
  it('removes Vietnamese diacritical marks', () => {
    expect(removeAccents('Nguyễn')).toBe('Nguyen');
  });

  it('leaves plain ASCII unchanged', () => {
    expect(removeAccents('hello')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(removeAccents('')).toBe('');
  });

  it('handles falsy input gracefully', () => {
    expect(removeAccents(null as any)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// capitalize
// ---------------------------------------------------------------------------

describe('capitalize', () => {
  it('capitalizes first letter of each word', () => {
    expect(capitalize('nguyen van an')).toBe('Nguyen Van An');
  });

  it('handles a single word', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('leaves already-capitalized words unchanged', () => {
    expect(capitalize('Hello World')).toBe('Hello World');
  });
});

// ---------------------------------------------------------------------------
// toNonAccentVietnamese
// ---------------------------------------------------------------------------

describe('toNonAccentVietnamese', () => {
  it('converts accented Vietnamese text to non-accented', () => {
    expect(toNonAccentVietnamese('phở bò')).toBe('pho bo');
  });

  it('converts đ to d', () => {
    expect(toNonAccentVietnamese('đặt hàng')).toBe('dat hang');
  });

  it('returns empty string for falsy input', () => {
    expect(toNonAccentVietnamese('')).toBe('');
    expect(toNonAccentVietnamese(null as any)).toBe('');
  });

  it('lowercases input when shouldLowCase is true', () => {
    expect(toNonAccentVietnamese('PHỞ', true)).toBe('pho');
  });

  it('preserves case when shouldLowCase is false (default)', () => {
    const result = toNonAccentVietnamese('PHO');
    expect(result).toBe('PHO');
  });
});

// ---------------------------------------------------------------------------
// getFullName
// ---------------------------------------------------------------------------

const makeProfile = (overrides: Record<string, string> = {}) => ({
  firstName: '',
  lastName: '',
  displayName: '',
  abbreviatedName: '',
  ...overrides,
});

describe('getFullName', () => {
  it('returns combined first and last name', () => {
    expect(
      getFullName(makeProfile({ firstName: 'An', lastName: 'Nguyễn' })),
    ).toBe('Nguyễn An');
  });

  it('returns Anh/Chị when profile is undefined', () => {
    expect(getFullName(undefined)).toBe('Anh/Chị');
  });

  it('returns Anh/Chị when both names are empty strings', () => {
    expect(getFullName(makeProfile())).toBe('Anh/Chị');
  });

  it('handles profile with only firstName', () => {
    const result = getFullName(makeProfile({ firstName: 'An' }));
    expect(result).toBe('An');
  });
});

// ---------------------------------------------------------------------------
// getDecorator
// ---------------------------------------------------------------------------

describe('getDecorator', () => {
  it('returns a valid decorator path for a non-empty id', () => {
    const result = getDecorator('some-id');
    expect(result).toMatch(/^\/static\/loading-asset-\d\.png$/);
  });

  it('returns the first decorator for an empty id', () => {
    expect(getDecorator('')).toBe('/static/loading-asset-1.png');
  });

  it('returns a deterministic result for the same id', () => {
    const id = 'user-abc-123';
    expect(getDecorator(id)).toBe(getDecorator(id));
  });

  it('distributes across 4 decorators (hash % 4)', () => {
    const decorators = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(getDecorator),
    );
    // Should hit multiple decorator values across different IDs
    expect(decorators.size).toBeGreaterThan(1);
  });
});
