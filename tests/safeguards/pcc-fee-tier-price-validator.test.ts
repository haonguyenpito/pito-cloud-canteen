/**
 * PCC FEE TIER PRICE VALIDATOR SAFEGUARDS
 *
 * Protects the `nonNegativeNumber` validator on the tier price input in the
 * admin "Other Settings" PCC fee table.
 *
 * WHY THIS MATTERS:
 * - A tier price of 0 is a valid, intentional override (charge nothing).
 * - The field value can arrive as EITHER a string (freshly typed) or a NUMBER
 *   (loaded from saved company metadata, where price is stored via Number(...)).
 *   A naive `!value` empty-check misclassifies the number 0 as empty and rejects
 *   it — the box shows "0" but the form refuses to submit. This regressed once
 *   already; these tests lock the behavior for both value types.
 *
 * Source: src/pages/admin/company/components/EditCompanyOtherSettingsForm/FieldPccFeeTiers.tsx
 */

import { nonNegativeNumber } from '@pages/admin/company/components/EditCompanyOtherSettingsForm/FieldPccFeeTiers';

const validate = nonNegativeNumber('ERR');

describe('nonNegativeNumber (tier price validator)', () => {
  describe('accepts zero regardless of value type', () => {
    it('accepts the number 0 (as loaded from saved metadata)', () => {
      expect(validate(0)).toBeUndefined();
    });

    it('accepts the string "0" (as freshly typed)', () => {
      expect(validate('0')).toBeUndefined();
    });
  });

  describe('accepts positive values', () => {
    it('accepts a positive number', () => {
      expect(validate(50_000)).toBeUndefined();
    });

    it('accepts a thousand-separated string', () => {
      expect(validate('50,000')).toBeUndefined();
    });
  });

  describe('rejects genuinely-empty values', () => {
    it('rejects empty string', () => {
      expect(validate('')).toBe('ERR');
    });

    it('rejects undefined', () => {
      expect(validate(undefined as any)).toBe('ERR');
    });

    it('rejects null', () => {
      expect(validate(null as any)).toBe('ERR');
    });

    // Note: negative input is not reachable in practice — the price field
    // strips non-digits on entry, and removeNonNumeric() drops the sign here
    // too (so "-1" is read as 1). The n < 0 guard is kept as defensive code.
  });
});
