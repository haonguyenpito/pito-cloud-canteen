/**
 * PCC SERVICE FEE SAFEGUARDS
 *
 * These tests protect the PCC (PITO Cloud Canteen) tiered service fee table
 * in getPCCFeeByMemberAmount. This function determines how much PITO charges
 * per delivery based on participant count.
 *
 * Changing these tier boundaries or amounts directly affects billing.
 * If the tier logic changes, update both the source AND these tests.
 *
 * Fee tiers (VND):
 *   0 members     →       0
 *   1–44 members  → 169,000
 *   45–59         → 210,000
 *   60–74         → 258,000
 *   75–104        → 333,000
 *   105–129       → 396,000
 *   130–149       → 438,000
 *   150–199       → 558,000
 *   200+          → 540,000
 *
 * Source: src/helpers/orderHelper.ts — getPCCFeeByMemberAmount
 */

import { getPCCFeeByMemberAmount } from '@helpers/orderHelper';

describe('getPCCFeeByMemberAmount', () => {
  describe('zero members', () => {
    it('returns 0 for 0 members (no delivery, no fee)', () => {
      expect(getPCCFeeByMemberAmount(0)).toBe(0);
    });
  });

  describe('tier 1: 1–44 members → 169,000', () => {
    it('charges 169,000 for 1 member', () => {
      expect(getPCCFeeByMemberAmount(1)).toBe(169_000);
    });

    it('charges 169,000 for 44 members (upper boundary)', () => {
      expect(getPCCFeeByMemberAmount(44)).toBe(169_000);
    });
  });

  describe('tier 2: 45–59 members → 210,000', () => {
    it('charges 210,000 for 45 members (lower boundary)', () => {
      expect(getPCCFeeByMemberAmount(45)).toBe(210_000);
    });

    it('charges 210,000 for 59 members (upper boundary)', () => {
      expect(getPCCFeeByMemberAmount(59)).toBe(210_000);
    });
  });

  describe('tier 3: 60–74 members → 258,000', () => {
    it('charges 258,000 for 60 members (lower boundary)', () => {
      expect(getPCCFeeByMemberAmount(60)).toBe(258_000);
    });

    it('charges 258,000 for 74 members (upper boundary)', () => {
      expect(getPCCFeeByMemberAmount(74)).toBe(258_000);
    });
  });

  describe('tier 4: 75–104 members → 333,000', () => {
    it('charges 333,000 for 75 members (lower boundary)', () => {
      expect(getPCCFeeByMemberAmount(75)).toBe(333_000);
    });

    it('charges 333,000 for 104 members (upper boundary)', () => {
      expect(getPCCFeeByMemberAmount(104)).toBe(333_000);
    });
  });

  describe('tier 5: 105–129 members → 396,000', () => {
    it('charges 396,000 for 105 members (lower boundary)', () => {
      expect(getPCCFeeByMemberAmount(105)).toBe(396_000);
    });

    it('charges 396,000 for 129 members (upper boundary)', () => {
      expect(getPCCFeeByMemberAmount(129)).toBe(396_000);
    });
  });

  describe('tier 6: 130–149 members → 438,000', () => {
    it('charges 438,000 for 130 members (lower boundary)', () => {
      expect(getPCCFeeByMemberAmount(130)).toBe(438_000);
    });

    it('charges 438,000 for 149 members (upper boundary)', () => {
      expect(getPCCFeeByMemberAmount(149)).toBe(438_000);
    });
  });

  describe('tier 7: 150–199 members → 558,000', () => {
    it('charges 558,000 for 150 members (lower boundary)', () => {
      expect(getPCCFeeByMemberAmount(150)).toBe(558_000);
    });

    it('charges 558,000 for 199 members (upper boundary)', () => {
      expect(getPCCFeeByMemberAmount(199)).toBe(558_000);
    });
  });

  describe('tier 8: 200+ members → 540,000', () => {
    it('charges 540,000 for 200 members (lower boundary)', () => {
      expect(getPCCFeeByMemberAmount(200)).toBe(540_000);
    });

    it('charges 540,000 for large companies (500 members)', () => {
      expect(getPCCFeeByMemberAmount(500)).toBe(540_000);
    });
  });

  describe('tier boundary transitions — no off-by-one errors', () => {
    const boundaries: [number, number, number][] = [
      [44, 169_000, 45],
      [59, 210_000, 60],
      [74, 258_000, 75],
      [104, 333_000, 105],
      [129, 396_000, 130],
      [149, 438_000, 150],
      [199, 558_000, 200],
    ];

    boundaries.forEach(([below, belowFee, above]) => {
      it(`transitions correctly at boundary ${below}→${above}`, () => {
        expect(getPCCFeeByMemberAmount(below)).toBe(belowFee);
        expect(getPCCFeeByMemberAmount(above)).not.toBe(belowFee);
      });
    });
  });
});
