/**
 * PARTICIPANT ORDER HELPER SAFEGUARDS
 *
 * These tests protect two order-participation helpers in orderHelper.ts:
 *
 *   getOrderParticipantNumber — counts members who have a non-empty foodId
 *     AND status === 'joined'. Used for PCC fee calculation and display counts.
 *
 *   isCompletePickFood — checks whether a specific participant has a joined
 *     entry for every date in an orderDetail map. Drives UI "all dates picked"
 *     indicators and reminder logic.
 *
 * Both helpers delegate the per-member predicate to isJoinedPlan, which requires
 * foodId !== '' AND status === 'joined'. Tests confirm that partial or missing
 * data is treated as "not joined".
 *
 * Source: src/helpers/orderHelper.ts
 */

import {
  getOrderParticipantNumber,
  isCompletePickFood,
} from '@helpers/orderHelper';
import { EParticipantOrderStatus } from '@utils/enums';

const joined = EParticipantOrderStatus.joined;
const empty = EParticipantOrderStatus.empty;
const notJoined = EParticipantOrderStatus.notJoined;

// ---------------------------------------------------------------------------
// getOrderParticipantNumber
// ---------------------------------------------------------------------------

describe('getOrderParticipantNumber', () => {
  it('returns 0 for an empty memberOrders object', () => {
    expect(getOrderParticipantNumber({})).toBe(0);
  });

  it('returns the full count when all members have joined', () => {
    const memberOrders = {
      user1: { foodId: 'food-1', status: joined },
      user2: { foodId: 'food-2', status: joined },
      user3: { foodId: 'food-3', status: joined },
    };
    expect(getOrderParticipantNumber(memberOrders as any)).toBe(3);
  });

  it('counts only joined members when statuses are mixed', () => {
    const memberOrders = {
      user1: { foodId: 'food-1', status: joined },
      user2: { foodId: '', status: empty },
      user3: { foodId: '', status: notJoined },
      user4: { foodId: 'food-4', status: joined },
    };
    expect(getOrderParticipantNumber(memberOrders as any)).toBe(2);
  });

  it('does not count a member who has status=joined but an empty foodId', () => {
    // isJoinedPlan requires foodId !== '' — a joined status alone is insufficient
    const memberOrders = {
      user1: { foodId: '', status: joined },
      user2: { foodId: 'food-2', status: joined },
    };
    expect(getOrderParticipantNumber(memberOrders as any)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// isCompletePickFood
// ---------------------------------------------------------------------------

describe('isCompletePickFood', () => {
  it('returns true when the participant is joined on the single available date', () => {
    const orderDetail = {
      '1700000000000': {
        memberOrders: {
          participant1: { foodId: 'food-1', status: joined },
        },
      },
    };
    expect(
      isCompletePickFood({ participantId: 'participant1', orderDetail }),
    ).toBe(true);
  });

  it('returns false when the participant is not joined on the single available date', () => {
    const orderDetail = {
      '1700000000000': {
        memberOrders: {
          participant1: { foodId: '', status: empty },
        },
      },
    };
    expect(
      isCompletePickFood({ participantId: 'participant1', orderDetail }),
    ).toBe(false);
  });

  it('returns true when the participant is joined on all multiple dates', () => {
    const orderDetail = {
      '1700000000000': {
        memberOrders: {
          participant1: { foodId: 'food-1', status: joined },
        },
      },
      '1700086400000': {
        memberOrders: {
          participant1: { foodId: 'food-2', status: joined },
        },
      },
    };
    expect(
      isCompletePickFood({ participantId: 'participant1', orderDetail }),
    ).toBe(true);
  });

  it('returns false when one of multiple dates has an empty foodId', () => {
    const orderDetail = {
      '1700000000000': {
        memberOrders: {
          participant1: { foodId: 'food-1', status: joined },
        },
      },
      '1700086400000': {
        memberOrders: {
          participant1: { foodId: '', status: empty },
        },
      },
    };
    expect(
      isCompletePickFood({ participantId: 'participant1', orderDetail }),
    ).toBe(false);
  });

  it('returns false when the participant is absent from memberOrders entirely', () => {
    // memberOrders[participantId] is undefined → destructuring gives undefined status/foodId
    // isJoinedPlan(undefined, undefined) → false, so completedDates = 0 < totalDates = 1
    const orderDetail = {
      '1700000000000': {
        memberOrders: {
          otherUser: { foodId: 'food-1', status: joined },
        },
      },
    };
    expect(
      isCompletePickFood({ participantId: 'participant1', orderDetail }),
    ).toBe(false);
  });
});
