/**
 * TRANSACTION HELPER SAFEGUARDS
 *
 * Tests for countCompletedTransactions which is used to determine
 * whether sub-orders have been fully processed — affects payment
 * confirmation display and order completion logic.
 *
 * Key contract: a transaction is counted if its last transition is
 * COMPLETE_DELIVERY or a transition leading to REVIEWED state.
 *
 * Source file: src/helpers/transactionHelper.ts
 */

import { countCompletedTransactions } from '@helpers/transactionHelper';
import { ETransition } from '@utils/transaction';
import type { TTransaction } from '@utils/types';

const makeTx = (lastTransition: ETransition): TTransaction =>
  ({
    attributes: { lastTransition },
  } as unknown as TTransaction);

describe('countCompletedTransactions', () => {
  it('returns 0 for an empty array', () => {
    expect(countCompletedTransactions([])).toBe(0);
  });

  it('counts a COMPLETE_DELIVERY transaction as completed', () => {
    const txs = [makeTx(ETransition.COMPLETE_DELIVERY)];
    expect(countCompletedTransactions(txs)).toBe(1);
  });

  it('counts a REVIEW_RESTAURANT transaction as completed (reviewed state)', () => {
    const txs = [makeTx(ETransition.REVIEW_RESTAURANT)];
    expect(countCompletedTransactions(txs)).toBe(1);
  });

  it('counts a REVIEW_RESTAURANT_AFTER_EXPIRE_TIME transaction as completed', () => {
    const txs = [makeTx(ETransition.REVIEW_RESTAURANT_AFTER_EXPIRE_TIME)];
    expect(countCompletedTransactions(txs)).toBe(1);
  });

  it('does not count a DELIVERING transaction', () => {
    const txs = [makeTx(ETransition.START_DELIVERY)];
    expect(countCompletedTransactions(txs)).toBe(0);
  });

  it('does not count a CANCELED transaction', () => {
    const txs = [makeTx(ETransition.OPERATOR_CANCEL_PLAN)];
    expect(countCompletedTransactions(txs)).toBe(0);
  });

  it('does not count an INITIATED transaction', () => {
    const txs = [makeTx(ETransition.INITIATE_TRANSACTION)];
    expect(countCompletedTransactions(txs)).toBe(0);
  });

  it('counts only completed transactions in a mixed array', () => {
    const txs = [
      makeTx(ETransition.COMPLETE_DELIVERY),
      makeTx(ETransition.START_DELIVERY),
      makeTx(ETransition.REVIEW_RESTAURANT),
      makeTx(ETransition.OPERATOR_CANCEL_PLAN),
      makeTx(ETransition.COMPLETE_DELIVERY),
    ];
    expect(countCompletedTransactions(txs)).toBe(3);
  });

  it('counts all transactions when all are completed', () => {
    const txs = [
      makeTx(ETransition.COMPLETE_DELIVERY),
      makeTx(ETransition.COMPLETE_DELIVERY),
      makeTx(ETransition.REVIEW_RESTAURANT),
    ];
    expect(countCompletedTransactions(txs)).toBe(3);
  });
});
