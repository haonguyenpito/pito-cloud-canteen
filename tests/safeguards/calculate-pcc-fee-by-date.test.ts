/**
 * CALCULATE PCC FEE BY DATE SAFEGUARDS
 *
 * These tests protect the per-date PCC fee calculation in calculatePCCFeeByDate.
 * This function determines the PITO service fee charged for a single delivery date,
 * based on how many participants actually joined (group orders) or how many items
 * were ordered (normal orders).
 *
 * Two fee modes exist:
 *   - Standard: delegates to getPCCFeeByMemberAmount tier table
 *   - Specific: uses a fixed override fee when any members are present
 *
 * Changing this logic directly affects per-date billing. If the counting or
 * branching logic changes, update both the source AND these tests.
 *
 * Source: src/helpers/order/cartInfoHelper.ts — calculatePCCFeeByDate
 */

import { calculatePCCFeeByDate } from '@helpers/order/cartInfoHelper';
import { EParticipantOrderStatus } from '@utils/enums';

const joined = EParticipantOrderStatus.joined;
const empty = EParticipantOrderStatus.empty;

describe('calculatePCCFeeByDate', () => {
  describe('group order — standard fee (no specificPCCFee override)', () => {
    it('returns 0 when no members have joined', () => {
      const memberOrders = {
        user1: { foodId: '', status: empty },
        user2: { foodId: '', status: empty },
      };
      expect(
        calculatePCCFeeByDate({
          isGroupOrder: true,
          memberOrders,
          lineItems: [],
          specificPCCFee: 0,
        }),
      ).toBe(0);
    });

    it('returns 169,000 for 3 joined members (tier 1)', () => {
      const memberOrders = {
        user1: { foodId: 'food-1', status: joined },
        user2: { foodId: 'food-2', status: joined },
        user3: { foodId: 'food-3', status: joined },
      };
      expect(
        calculatePCCFeeByDate({
          isGroupOrder: true,
          memberOrders,
          lineItems: [],
          specificPCCFee: 0,
        }),
      ).toBe(169_000);
    });

    it('counts only joined members when statuses are mixed', () => {
      const memberOrders = {
        user1: { foodId: 'food-1', status: joined },
        user2: { foodId: 'food-2', status: joined },
        user3: { foodId: '', status: empty },
        user4: { foodId: '', status: EParticipantOrderStatus.notJoined },
      };
      // 2 joined → tier 1 → 169,000
      expect(
        calculatePCCFeeByDate({
          isGroupOrder: true,
          memberOrders,
          lineItems: [],
          specificPCCFee: 0,
        }),
      ).toBe(169_000);
    });
  });

  describe('group order — specific PCC fee override', () => {
    it('returns specificPCCFee when 2 members have joined', () => {
      const memberOrders = {
        user1: { foodId: 'food-1', status: joined },
        user2: { foodId: 'food-2', status: joined },
      };
      expect(
        calculatePCCFeeByDate({
          isGroupOrder: true,
          memberOrders,
          lineItems: [],
          hasSpecificPCCFee: true,
          specificPCCFee: 250_000,
        }),
      ).toBe(250_000);
    });

    it('returns 0 when hasSpecificPCCFee=true but no members have joined', () => {
      const memberOrders = {
        user1: { foodId: '', status: empty },
      };
      expect(
        calculatePCCFeeByDate({
          isGroupOrder: true,
          memberOrders,
          lineItems: [],
          hasSpecificPCCFee: true,
          specificPCCFee: 250_000,
        }),
      ).toBe(0);
    });
  });

  describe('normal order (lineItems-based count)', () => {
    it('sums quantities from lineItems to determine the fee tier', () => {
      // 3 items × quantity 1 = 3 total → tier 1 → 169,000
      const lineItems = [{ quantity: 1 }, { quantity: 1 }, { quantity: 1 }];
      expect(
        calculatePCCFeeByDate({
          isGroupOrder: false,
          memberOrders: {},
          lineItems,
          specificPCCFee: 0,
        }),
      ).toBe(169_000);
    });

    it('defaults quantity to 1 when the field is absent', () => {
      // 2 items with no quantity field → treated as 2 total → tier 1 → 169,000
      const lineItems = [{}, {}];
      expect(
        calculatePCCFeeByDate({
          isGroupOrder: false,
          memberOrders: {},
          lineItems,
          specificPCCFee: 0,
        }),
      ).toBe(169_000);
    });

    it('returns 0 for empty lineItems', () => {
      expect(
        calculatePCCFeeByDate({
          isGroupOrder: false,
          memberOrders: {},
          lineItems: [],
          specificPCCFee: 0,
        }),
      ).toBe(0);
    });
  });
});
