/**
 * PAYMENT MODIFICATION ON SUB-ORDER CANCELLATION — SAFEGUARDS
 *
 * When a sub-order is canceled via the transit hub, modifyPaymentWhenCancelSubOrderService
 * must update the Firebase payment ledger to reflect the new (lower) total.
 * Errors here create incorrect payment amounts that are difficult to audit because
 * Firebase payment records are append-only and confirmed payments are irreversible.
 *
 * Key invariants:
 * 1. The partner payment record for the canceled date is always deleted
 * 2. The client payment total is updated with the new quotation (excluding the canceled date)
 * 3. If the new client total is 0 (all sub-orders canceled), the client record is deleted
 * 4. Falls back to admin's systemVATPercentage when the order has no orderVATPercentage set
 * 5. If no partner payment record exists, only the client record is updated (no crash)
 * 6. If no client payment record exists, only the partner record is deleted (no crash)
 *
 * Source file: src/pages/api/admin/payment/modify-payment-when-cancel-sub-order.service.ts
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Factories use only inline jest.fn() — no external variable references.
// jest.mock() is hoisted before imports, so external const refs would be in TDZ.

// ── Imports ───────────────────────────────────────────────────────────────────

import { modifyPaymentWhenCancelSubOrderService } from '@pages/api/admin/payment/modify-payment-when-cancel-sub-order.service';
import { fetchUser } from '@services/integrationHelper';
import {
  deletePaymentRecordByIdOnFirebase,
  queryPaymentRecordOnFirebase,
  updatePaymentRecordOnFirebase,
} from '@services/payment';
import { ensureListing } from '@utils/data';
import { EPaymentType } from '@utils/enums';

jest.mock('@services/payment', () => ({
  queryPaymentRecordOnFirebase: jest.fn(),
  deletePaymentRecordByIdOnFirebase: jest.fn().mockResolvedValue(undefined),
  updatePaymentRecordOnFirebase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@services/integrationHelper', () => ({
  fetchUser: jest.fn(),
}));

jest.mock('@helpers/orderHelper', () => ({
  getFoodDataMap: jest.fn().mockReturnValue({}),
  getTotalInfo: jest.fn().mockReturnValue({ totalPrice: 0, totalDishes: 0 }),
  getOrderParticipantNumber: jest.fn().mockReturnValue(0),
  getPCCFeeByMemberAmount: jest.fn().mockReturnValue(0),
}));

// Typed aliases — const declarations are not reordered by ESLint import rules
const mockQueryPaymentRecord = queryPaymentRecordOnFirebase as jest.Mock;
const mockDeletePaymentRecord = deletePaymentRecordByIdOnFirebase as jest.Mock;
const mockUpdatePaymentRecord = updatePaymentRecordOnFirebase as jest.Mock;
const mockFetchUser = fetchUser as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORDER_ID = 'order-1';
const SUB_ORDER_DATE = 1710432000000; // 2024-03-15

/** Minimal order listing with the fields modifyPaymentWhenCancelSubOrderService reads */
const makeOrder = (meta: {
  orderVATPercentage?: number;
  packagePerMember?: number;
  hasSpecificPCCFee?: boolean;
  specificPCCFee?: number;
}) =>
  ensureListing({
    id: { uuid: ORDER_ID },
    type: 'listing',
    attributes: {
      metadata: {
        packagePerMember: 0,
        hasSpecificPCCFee: true,
        specificPCCFee: 0,
        ...meta,
      },
    },
  });

/** Admin user object whose privateData.systemVATPercentage is the fallback VAT.
 *  User.getPrivateData() uses get(attributes.profile, 'privateData', {}),
 *  so privateData must be nested under attributes.profile. */
const makeAdmin = (systemVATPercentage: number) => ({
  id: { uuid: 'admin-1' },
  type: 'user',
  attributes: {
    profile: {
      privateData: { systemVATPercentage },
    },
  },
});

/**
 * Client quotation after cancellation (the canceled date should already be removed
 * by the caller before passing to this service).
 */
const clientQuotationAfterCancel = {
  quotation: {
    '1710518400000': [{ foodPrice: 50_000, frequency: 2 }], // remaining date
  },
};

const partnerQuotationAfterCancel = {
  'partner-1': {
    quotation: {
      '1710518400000': [{ foodPrice: 45_000, frequency: 2 }],
    },
  },
};

/** A client quotation with no remaining dates — total will be 0 */
const emptyClientQuotation = { quotation: {} };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('modifyPaymentWhenCancelSubOrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchUser.mockResolvedValue(makeAdmin(0.1));
  });

  it('deletes the partner payment record for the canceled sub-order date', async () => {
    const partnerRecord = {
      id: 'partner-rec-1',
      paymentType: EPaymentType.PARTNER,
    };
    const clientRecord = {
      id: 'client-rec-1',
      paymentType: EPaymentType.CLIENT,
      totalPrice: 200_000,
    };

    mockQueryPaymentRecord
      .mockResolvedValueOnce([partnerRecord]) // partner query
      .mockResolvedValueOnce([clientRecord]); // client query

    await modifyPaymentWhenCancelSubOrderService({
      order: makeOrder({ orderVATPercentage: 0.1 }),
      subOrderDate: SUB_ORDER_DATE,
      clientQuotation: clientQuotationAfterCancel,
      partnerQuotation: partnerQuotationAfterCancel,
    });

    expect(mockDeletePaymentRecord).toHaveBeenCalledWith('partner-rec-1');
  });

  it('queries partner payment with the exact subOrderDate string', async () => {
    mockQueryPaymentRecord
      .mockResolvedValueOnce([]) // no partner record
      .mockResolvedValueOnce([]); // no client record

    await modifyPaymentWhenCancelSubOrderService({
      order: makeOrder({ orderVATPercentage: 0.1 }),
      subOrderDate: SUB_ORDER_DATE,
      clientQuotation: clientQuotationAfterCancel,
      partnerQuotation: partnerQuotationAfterCancel,
    });

    const [partnerCall] = mockQueryPaymentRecord.mock.calls;
    expect(partnerCall[0]).toMatchObject({
      paymentType: EPaymentType.PARTNER,
      orderId: ORDER_ID,
      subOrderDate: String(SUB_ORDER_DATE),
    });
  });

  it('updates the client payment record with the recalculated total', async () => {
    const partnerRecord = { id: 'partner-rec-1' };
    const clientRecord = { id: 'client-rec-1', totalPrice: 300_000 };

    mockQueryPaymentRecord
      .mockResolvedValueOnce([partnerRecord])
      .mockResolvedValueOnce([clientRecord]);

    await modifyPaymentWhenCancelSubOrderService({
      order: makeOrder({ orderVATPercentage: 0.1 }),
      subOrderDate: SUB_ORDER_DATE,
      clientQuotation: clientQuotationAfterCancel, // 50,000 × 2 = 100,000 + 10% VAT = 110,000
      partnerQuotation: partnerQuotationAfterCancel,
    });

    expect(mockUpdatePaymentRecord).toHaveBeenCalledWith(
      'client-rec-1',
      expect.objectContaining({ totalPrice: 110_000 }),
    );
  });

  it('deletes the client payment record when the new total is 0 (all sub-orders canceled)', async () => {
    const partnerRecord = { id: 'partner-rec-1' };
    const clientRecord = { id: 'client-rec-1' };

    mockQueryPaymentRecord
      .mockResolvedValueOnce([partnerRecord])
      .mockResolvedValueOnce([clientRecord]);

    await modifyPaymentWhenCancelSubOrderService({
      order: makeOrder({ orderVATPercentage: 0.1 }),
      subOrderDate: SUB_ORDER_DATE,
      clientQuotation: emptyClientQuotation, // no remaining dates → totalWithVAT = 0
      // non-empty partner map prevents the isEmpty early-return in calculatePriceQuotationInfoFromQuotation
      partnerQuotation: { 'partner-1': { quotation: {} } },
    });

    expect(mockDeletePaymentRecord).toHaveBeenCalledWith('client-rec-1');
    expect(mockUpdatePaymentRecord).not.toHaveBeenCalled();
  });

  it('uses systemVATPercentage from admin when order has no orderVATPercentage', async () => {
    mockFetchUser.mockResolvedValue(makeAdmin(0.08)); // 8% fallback VAT
    const clientRecord = { id: 'client-rec-1' };

    mockQueryPaymentRecord
      .mockResolvedValueOnce([]) // no partner record
      .mockResolvedValueOnce([clientRecord]);

    await modifyPaymentWhenCancelSubOrderService({
      order: makeOrder({ orderVATPercentage: undefined }), // no order-level VAT
      subOrderDate: SUB_ORDER_DATE,
      clientQuotation: {
        quotation: { '1710518400000': [{ foodPrice: 100_000, frequency: 1 }] },
      },
      partnerQuotation: { 'partner-1': { quotation: {} } },
    });

    // totalWithoutVAT = 100,000; VAT at 8% = 8,000; totalWithVAT = 108,000
    expect(mockUpdatePaymentRecord).toHaveBeenCalledWith(
      'client-rec-1',
      expect.objectContaining({ totalPrice: 108_000 }),
    );
  });

  it('skips partner deletion gracefully when no partner payment record exists', async () => {
    const clientRecord = { id: 'client-rec-1' };

    mockQueryPaymentRecord
      .mockResolvedValueOnce([]) // no partner record
      .mockResolvedValueOnce([clientRecord]);

    await expect(
      modifyPaymentWhenCancelSubOrderService({
        order: makeOrder({ orderVATPercentage: 0.1 }),
        subOrderDate: SUB_ORDER_DATE,
        clientQuotation: clientQuotationAfterCancel,
        partnerQuotation: partnerQuotationAfterCancel,
      }),
    ).resolves.not.toThrow();

    // deletePaymentRecord should NOT have been called for partner (no record)
    const deleteCalls = mockDeletePaymentRecord.mock.calls;
    const partnerDeleteCalls = deleteCalls.filter(
      (call) => call[0] === 'partner-rec-1',
    );
    expect(partnerDeleteCalls).toHaveLength(0);
  });

  it('skips client update gracefully when no client payment record exists', async () => {
    const partnerRecord = { id: 'partner-rec-1' };

    mockQueryPaymentRecord
      .mockResolvedValueOnce([partnerRecord])
      .mockResolvedValueOnce([]); // no client record

    await expect(
      modifyPaymentWhenCancelSubOrderService({
        order: makeOrder({ orderVATPercentage: 0.1 }),
        subOrderDate: SUB_ORDER_DATE,
        clientQuotation: clientQuotationAfterCancel,
        partnerQuotation: partnerQuotationAfterCancel,
      }),
    ).resolves.not.toThrow();

    expect(mockUpdatePaymentRecord).not.toHaveBeenCalled();
    // Partner is still deleted
    expect(mockDeletePaymentRecord).toHaveBeenCalledWith('partner-rec-1');
  });
});
