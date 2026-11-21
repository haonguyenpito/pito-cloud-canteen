/**
 * SPECIAL DEMAND SANITIZE SAFEGUARDS
 *
 * This admin endpoint writes straight into a user's publicData. Any stray
 * key that slips through renders as blank space on the kitchen's delivery
 * slip, so it must be filtered before the write.
 *
 * Source: src/pages/api/apiServices/user/specialDemand.service.ts
 */

import { sanitizeSpecialDemand } from '@apiServices/user/specialDemand.service';

const nutritionOptions = [{ key: 'vegetarian' }, { key: 'lowCarb' }];

describe('sanitizeSpecialDemand', () => {
  it('returns two empty arrays when body is empty', () => {
    expect(sanitizeSpecialDemand({}, nutritionOptions)).toEqual({
      allergies: [],
      nutritions: [],
    });
  });

  it('keeps valid keys', () => {
    expect(
      sanitizeSpecialDemand(
        { allergies: ['egg', 'shrimp'], nutritions: ['vegetarian'] },
        nutritionOptions,
      ),
    ).toEqual({ allergies: ['egg', 'shrimp'], nutritions: ['vegetarian'] });
  });

  it('drops keys not present in the option list', () => {
    expect(
      sanitizeSpecialDemand(
        { allergies: ['egg', 'rac'], nutritions: ['vegetarian', 'rac'] },
        nutritionOptions,
      ),
    ).toEqual({ allergies: ['egg'], nutritions: ['vegetarian'] });
  });

  it('drops non-string elements and non-array values', () => {
    expect(
      sanitizeSpecialDemand(
        { allergies: ['egg', 1, null], nutritions: 'vegetarian' },
        nutritionOptions,
      ),
    ).toEqual({ allergies: ['egg'], nutritions: [] });
  });

  it('drops duplicate keys', () => {
    expect(
      sanitizeSpecialDemand({ allergies: ['egg', 'egg'] }, nutritionOptions),
    ).toEqual({ allergies: ['egg'], nutritions: [] });
  });
});
