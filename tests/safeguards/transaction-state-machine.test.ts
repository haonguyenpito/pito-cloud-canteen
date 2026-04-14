/**
 * TRANSACTION STATE MACHINE SAFEGUARDS
 *
 * These tests protect the Sharetribe transaction state machine for sub-orders.
 * Each delivery date is a Sharetribe transaction with a specific lifecycle.
 *
 * WHY THIS MATTERS:
 * - Invalid transitions throw Sharetribe errors and leave orders in broken state
 * - The process alias must match transaction-process/process.edn deployed to Sharetribe
 * - TRANSITIONS_TO_STATE_CANCELED is used in price calculations to exclude cancelled dates
 *   (a bug here silently includes canceled sub-orders in billing)
 *
 * Transaction lifecycle:
 *   initial → initiated → partner-confirmed → delivering → completed → reviewed
 *                       ↓                   ↓
 *                 partner-rejected     failed-delivery
 *                       ↓
 *                    canceled
 *
 * Source: src/utils/transaction.ts
 */

import {
  ETransactionState,
  ETransition,
  getTransitionsToState,
  TRANSITIONS,
  TRANSITIONS_TO_STATE_CANCELED,
  txIsCanceled,
  txIsCompleted,
  txIsDelivering,
  txIsDeliveryFailed,
  txIsExpiredReview,
  txIsInitiated,
  txIsPartnerConfirmed,
  txIsPartnerRejected,
  txIsReviewed,
} from '@utils/transaction';
import type { TTransaction } from '@utils/types';

// ---------------------------------------------------------------------------
// Helper: build a minimal mock transaction
// ---------------------------------------------------------------------------

const mockTx = (lastTransition: ETransition): TTransaction =>
  ({
    attributes: { lastTransition },
  } as unknown as TTransaction);

// ---------------------------------------------------------------------------
// TRANSITIONS_TO_STATE_CANCELED
// ---------------------------------------------------------------------------

describe('TRANSITIONS_TO_STATE_CANCELED', () => {
  it('includes operator-cancel-plan (cancels from initiated state)', () => {
    expect(TRANSITIONS_TO_STATE_CANCELED).toContain(
      ETransition.OPERATOR_CANCEL_PLAN,
    );
  });

  it('includes operator-cancel-after-partner-rejected', () => {
    expect(TRANSITIONS_TO_STATE_CANCELED).toContain(
      ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED,
    );
  });

  it('includes operator-cancel-after-partner-confirmed', () => {
    expect(TRANSITIONS_TO_STATE_CANCELED).toContain(
      ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED,
    );
  });

  it('has exactly 3 cancel transitions — adding new cancel paths requires updating price logic', () => {
    expect(TRANSITIONS_TO_STATE_CANCELED).toHaveLength(3);
  });

  it('does NOT include non-cancel transitions', () => {
    expect(TRANSITIONS_TO_STATE_CANCELED).not.toContain(
      ETransition.COMPLETE_DELIVERY,
    );
    expect(TRANSITIONS_TO_STATE_CANCELED).not.toContain(
      ETransition.PARTNER_CONFIRM_SUB_ORDER,
    );
  });
});

// ---------------------------------------------------------------------------
// getTransitionsToState
// ---------------------------------------------------------------------------

describe('getTransitionsToState', () => {
  it('returns correct transitions leading to CANCELED', () => {
    const toCancel = getTransitionsToState(ETransactionState.CANCELED);
    expect(toCancel).toContain(ETransition.OPERATOR_CANCEL_PLAN);
    expect(toCancel).toContain(
      ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED,
    );
    expect(toCancel).toContain(
      ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED,
    );
  });

  it('returns correct transitions leading to FAILED_DELIVERY', () => {
    const toFailed = getTransitionsToState(ETransactionState.FAILED_DELIVERY);
    expect(toFailed).toContain(ETransition.EXPIRED_START_DELIVERY);
    expect(toFailed).toContain(ETransition.EXPIRED_DELIVERY);
    expect(toFailed).toContain(ETransition.CANCEL_DELIVERY);
  });

  it('returns correct transitions leading to REVIEWED', () => {
    const toReviewed = getTransitionsToState(ETransactionState.REVIEWED);
    expect(toReviewed).toContain(ETransition.REVIEW_RESTAURANT);
    expect(toReviewed).toContain(
      ETransition.REVIEW_RESTAURANT_AFTER_EXPIRE_TIME,
    );
  });

  it('returns correct transitions leading to COMPLETED', () => {
    const toCompleted = getTransitionsToState(ETransactionState.COMPLETED);
    expect(toCompleted).toContain(ETransition.COMPLETE_DELIVERY);
    expect(toCompleted).toHaveLength(1);
  });

  it('returns correct transitions leading to DELIVERING', () => {
    const toDelivering = getTransitionsToState(ETransactionState.DELIVERING);
    expect(toDelivering).toContain(ETransition.START_DELIVERY);
    expect(toDelivering).toHaveLength(1);
  });

  it('returns empty array for INITIAL state (nothing leads to initial)', () => {
    const toInitial = getTransitionsToState(ETransactionState.INITIAL);
    expect(toInitial).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TRANSITIONS — completeness check
// ---------------------------------------------------------------------------

describe('TRANSITIONS list', () => {
  it('contains all expected transitions', () => {
    const expectedTransitions = Object.values(ETransition);
    expectedTransitions.forEach((t) => {
      expect(TRANSITIONS).toContain(t);
    });
  });
});

// ---------------------------------------------------------------------------
// txIs* state-check helpers
// ---------------------------------------------------------------------------

describe('txIsInitiated', () => {
  it('returns true after initiate-transaction', () => {
    expect(txIsInitiated(mockTx(ETransition.INITIATE_TRANSACTION))).toBe(true);
  });

  it('returns false for other transitions', () => {
    expect(txIsInitiated(mockTx(ETransition.COMPLETE_DELIVERY))).toBe(false);
    expect(txIsInitiated(mockTx(ETransition.OPERATOR_CANCEL_PLAN))).toBe(false);
  });
});

describe('txIsPartnerConfirmed', () => {
  it('returns true after partner-confirm-sub-order', () => {
    expect(
      txIsPartnerConfirmed(mockTx(ETransition.PARTNER_CONFIRM_SUB_ORDER)),
    ).toBe(true);
  });

  it('returns false for other transitions', () => {
    expect(txIsPartnerConfirmed(mockTx(ETransition.INITIATE_TRANSACTION))).toBe(
      false,
    );
  });
});

describe('txIsPartnerRejected', () => {
  it('returns true after partner-reject-sub-order', () => {
    expect(
      txIsPartnerRejected(mockTx(ETransition.PARTNER_REJECT_SUB_ORDER)),
    ).toBe(true);
  });

  it('returns false for other transitions', () => {
    expect(
      txIsPartnerRejected(mockTx(ETransition.PARTNER_CONFIRM_SUB_ORDER)),
    ).toBe(false);
  });
});

describe('txIsDelivering', () => {
  it('returns true after start-delivery', () => {
    expect(txIsDelivering(mockTx(ETransition.START_DELIVERY))).toBe(true);
  });

  it('returns false for other transitions', () => {
    expect(txIsDelivering(mockTx(ETransition.PARTNER_CONFIRM_SUB_ORDER))).toBe(
      false,
    );
  });
});

describe('txIsCompleted', () => {
  it('returns true after complete-delivery', () => {
    expect(txIsCompleted(mockTx(ETransition.COMPLETE_DELIVERY))).toBe(true);
  });

  it('returns false for other transitions', () => {
    expect(txIsCompleted(mockTx(ETransition.START_DELIVERY))).toBe(false);
  });
});

describe('txIsDeliveryFailed', () => {
  it('returns true after expired-delivery', () => {
    expect(txIsDeliveryFailed(mockTx(ETransition.EXPIRED_DELIVERY))).toBe(true);
  });

  it('returns true after cancel-delivery', () => {
    expect(txIsDeliveryFailed(mockTx(ETransition.CANCEL_DELIVERY))).toBe(true);
  });

  it('returns true after expired-start-delivery', () => {
    expect(txIsDeliveryFailed(mockTx(ETransition.EXPIRED_START_DELIVERY))).toBe(
      true,
    );
  });

  it('returns false after complete-delivery', () => {
    expect(txIsDeliveryFailed(mockTx(ETransition.COMPLETE_DELIVERY))).toBe(
      false,
    );
  });
});

describe('txIsCanceled', () => {
  it('returns true after operator-cancel-plan', () => {
    expect(txIsCanceled(mockTx(ETransition.OPERATOR_CANCEL_PLAN))).toBe(true);
  });

  it('returns true after operator-cancel-after-partner-confirmed', () => {
    expect(
      txIsCanceled(mockTx(ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED)),
    ).toBe(true);
  });

  it('returns true after operator-cancel-after-partner-rejected', () => {
    expect(
      txIsCanceled(mockTx(ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED)),
    ).toBe(true);
  });

  it('returns false after complete-delivery', () => {
    expect(txIsCanceled(mockTx(ETransition.COMPLETE_DELIVERY))).toBe(false);
  });

  it('returns false after delivering', () => {
    expect(txIsCanceled(mockTx(ETransition.START_DELIVERY))).toBe(false);
  });
});

describe('txIsReviewed', () => {
  it('returns true after review-restaurant', () => {
    expect(txIsReviewed(mockTx(ETransition.REVIEW_RESTAURANT))).toBe(true);
  });

  it('returns true after review-restaurant-after-expire-time', () => {
    expect(
      txIsReviewed(mockTx(ETransition.REVIEW_RESTAURANT_AFTER_EXPIRE_TIME)),
    ).toBe(true);
  });

  it('returns false after complete-delivery (not yet reviewed)', () => {
    expect(txIsReviewed(mockTx(ETransition.COMPLETE_DELIVERY))).toBe(false);
  });
});

describe('txIsExpiredReview', () => {
  it('returns true after expired-review-time', () => {
    expect(txIsExpiredReview(mockTx(ETransition.EXPIRED_REVIEW_TIME))).toBe(
      true,
    );
  });

  it('returns false after review-restaurant', () => {
    expect(txIsExpiredReview(mockTx(ETransition.REVIEW_RESTAURANT))).toBe(
      false,
    );
  });
});
