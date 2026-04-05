/**
 * VAT CALCULATION SAFEGUARDS
 *
 * These tests protect the VAT calculation logic which directly affects
 * payment amounts charged to companies and paid to restaurants.
 *
 * Key business rules enforced here:
 * - EPartnerVATSetting.direct    → 0% VAT (no VAT applied)
 * - EPartnerVATSetting.noExportVat → -4% applied on MENU price (discount/deduction)
 * - EPartnerVATSetting.vat       → standard VAT% applied on PROVISIONAL price
 * - Customer-side VAT always uses provisional price regardless of partner setting
 *
 * Source files:
 *   src/helpers/order/cartInfoHelper.ts     — calculateVATFee
 *   src/helpers/order/prepareDataHelper.ts  — vatPercentageBaseOnVatSetting, ensureVATSetting
 */

import { calculateVATFee } from '@helpers/order/cartInfoHelper';
import {
  ensureVATSetting,
  vatPercentageBaseOnVatSetting,
} from '@helpers/order/prepareDataHelper';
import { EPartnerVATSetting } from '@utils/enums';

// ---------------------------------------------------------------------------
// vatPercentageBaseOnVatSetting
// ---------------------------------------------------------------------------

describe('vatPercentageBaseOnVatSetting', () => {
  describe('when isPartner = true (default)', () => {
    it('returns 0 for direct VAT setting — no VAT charged to partner', () => {
      expect(
        vatPercentageBaseOnVatSetting({
          vatSetting: EPartnerVATSetting.direct,
          vatPercentage: 0.1,
        }),
      ).toBe(0);
    });

    it('returns -0.04 for noExportVat setting — 4% deducted from partner price', () => {
      expect(
        vatPercentageBaseOnVatSetting({
          vatSetting: EPartnerVATSetting.noExportVat,
          vatPercentage: 0.1,
        }),
      ).toBe(-0.04);
    });

    it('returns the provided vatPercentage for vat setting', () => {
      expect(
        vatPercentageBaseOnVatSetting({
          vatSetting: EPartnerVATSetting.vat,
          vatPercentage: 0.1,
        }),
      ).toBe(0.1);
    });

    it('returns the provided vatPercentage for vat setting even at 0%', () => {
      expect(
        vatPercentageBaseOnVatSetting({
          vatSetting: EPartnerVATSetting.vat,
          vatPercentage: 0,
        }),
      ).toBe(0);
    });
  });

  describe('when isPartner = false (customer side)', () => {
    it('always returns vatPercentage regardless of vatSetting (direct)', () => {
      expect(
        vatPercentageBaseOnVatSetting({
          vatSetting: EPartnerVATSetting.direct,
          vatPercentage: 0.1,
          isPartner: false,
        }),
      ).toBe(0.1);
    });

    it('always returns vatPercentage regardless of vatSetting (noExportVat)', () => {
      expect(
        vatPercentageBaseOnVatSetting({
          vatSetting: EPartnerVATSetting.noExportVat,
          vatPercentage: 0.1,
          isPartner: false,
        }),
      ).toBe(0.1);
    });

    it('always returns vatPercentage regardless of vatSetting (vat)', () => {
      expect(
        vatPercentageBaseOnVatSetting({
          vatSetting: EPartnerVATSetting.vat,
          vatPercentage: 0.08,
          isPartner: false,
        }),
      ).toBe(0.08);
    });
  });
});

// ---------------------------------------------------------------------------
// ensureVATSetting
// ---------------------------------------------------------------------------

describe('ensureVATSetting', () => {
  it('returns vat when given a valid vat setting', () => {
    expect(ensureVATSetting(EPartnerVATSetting.vat)).toBe(
      EPartnerVATSetting.vat,
    );
  });

  it('returns noExportVat when given a valid noExportVat setting', () => {
    expect(ensureVATSetting(EPartnerVATSetting.noExportVat)).toBe(
      EPartnerVATSetting.noExportVat,
    );
  });

  it('returns direct when given a valid direct setting', () => {
    expect(ensureVATSetting(EPartnerVATSetting.direct)).toBe(
      EPartnerVATSetting.direct,
    );
  });

  it('falls back to vat for an invalid/unknown setting', () => {
    expect(ensureVATSetting('unknown-setting' as EPartnerVATSetting)).toBe(
      EPartnerVATSetting.vat,
    );
  });
});

// ---------------------------------------------------------------------------
// calculateVATFee
// ---------------------------------------------------------------------------

describe('calculateVATFee', () => {
  const MENU_PRICE = 300_000;
  const PROVISIONAL_PRICE = 270_000; // after service fee deduction
  const VAT_RATE = 0.1; // 10%

  describe('customer target', () => {
    it('calculates VAT on provisional price for customer', () => {
      const result = calculateVATFee({
        vatPercentage: VAT_RATE,
        partnerVATSetting: EPartnerVATSetting.vat,
        orderProvisionalPrice: PROVISIONAL_PRICE,
        orderMenuPrice: MENU_PRICE,
        target: 'customer',
      });
      expect(result).toBe(Math.round(PROVISIONAL_PRICE * VAT_RATE)); // 27,000
    });

    it('uses provisional price even when partnerVATSetting is noExportVat', () => {
      const result = calculateVATFee({
        vatPercentage: VAT_RATE,
        partnerVATSetting: EPartnerVATSetting.noExportVat,
        orderProvisionalPrice: PROVISIONAL_PRICE,
        orderMenuPrice: MENU_PRICE,
        target: 'customer',
      });
      expect(result).toBe(Math.round(PROVISIONAL_PRICE * VAT_RATE));
    });

    it('returns 0 when vatPercentage is 0', () => {
      const result = calculateVATFee({
        vatPercentage: 0,
        partnerVATSetting: EPartnerVATSetting.vat,
        orderProvisionalPrice: PROVISIONAL_PRICE,
        orderMenuPrice: MENU_PRICE,
        target: 'customer',
      });
      expect(result).toBe(0);
    });
  });

  describe('partner target — vat setting', () => {
    it('calculates VAT on provisional price', () => {
      const result = calculateVATFee({
        vatPercentage: VAT_RATE,
        partnerVATSetting: EPartnerVATSetting.vat,
        orderProvisionalPrice: PROVISIONAL_PRICE,
        orderMenuPrice: MENU_PRICE,
        target: 'partner',
      });
      expect(result).toBe(Math.round(PROVISIONAL_PRICE * VAT_RATE)); // 27,000
    });
  });

  describe('partner target — noExportVat setting', () => {
    it('calculates VAT on MENU price (not provisional) — critical difference from vat mode', () => {
      const result = calculateVATFee({
        vatPercentage: -0.04, // noExportVat always uses -0.04
        partnerVATSetting: EPartnerVATSetting.noExportVat,
        orderProvisionalPrice: PROVISIONAL_PRICE,
        orderMenuPrice: MENU_PRICE,
        target: 'partner',
      });
      // Uses MENU_PRICE, not PROVISIONAL_PRICE — this is the key difference
      expect(result).toBe(Math.round(MENU_PRICE * -0.04)); // -12,000
    });

    it('produces a negative value — deducted from total (shown as abs in UI)', () => {
      const result = calculateVATFee({
        vatPercentage: -0.04,
        partnerVATSetting: EPartnerVATSetting.noExportVat,
        orderProvisionalPrice: PROVISIONAL_PRICE,
        orderMenuPrice: MENU_PRICE,
        target: 'partner',
      });
      expect(result).toBeLessThan(0);
    });
  });

  describe('partner target — direct setting', () => {
    it('returns 0 when vatPercentage is 0 (direct = no VAT)', () => {
      const result = calculateVATFee({
        vatPercentage: 0, // vatPercentageBaseOnVatSetting returns 0 for direct
        partnerVATSetting: EPartnerVATSetting.direct,
        orderProvisionalPrice: PROVISIONAL_PRICE,
        orderMenuPrice: MENU_PRICE,
        target: 'partner',
      });
      expect(result).toBe(0);
    });
  });

  describe('rounding', () => {
    it('rounds the result to nearest integer', () => {
      const result = calculateVATFee({
        vatPercentage: 0.1,
        partnerVATSetting: EPartnerVATSetting.vat,
        orderProvisionalPrice: 100_001,
        orderMenuPrice: 100_001,
        target: 'customer',
      });
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});
