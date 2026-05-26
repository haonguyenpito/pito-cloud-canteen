import {
  countHighlightedMembers,
  getHighlightedMembersAfterDeadline,
  getHistoryCreatedAtMs,
} from '@helpers/order/subOrderHighlightHelper';
import {
  buildSubOrderHistoryEntryFromMemberOrderDiff,
  resolveMemberFoodHistoryType,
} from '@helpers/order/subOrderHistoryHelper';
import {
  EEditSubOrderHistoryType,
  EParticipantOrderStatus,
} from '@utils/enums';

describe('resolveMemberFoodHistoryType', () => {
  it('returns ADDED when member had no joined food before', () => {
    expect(
      resolveMemberFoodHistoryType(
        { status: EParticipantOrderStatus.empty, foodId: '' },
        {
          status: EParticipantOrderStatus.joined,
          foodId: 'f1',
        },
      ),
    ).toBe(EEditSubOrderHistoryType.MEMBER_FOOD_ADDED);
  });

  it('returns CHANGED when foodId changes', () => {
    expect(
      resolveMemberFoodHistoryType(
        {
          status: EParticipantOrderStatus.joined,
          foodId: 'f1',
        },
        {
          status: EParticipantOrderStatus.joined,
          foodId: 'f2',
        },
      ),
    ).toBe(EEditSubOrderHistoryType.MEMBER_FOOD_CHANGED);
  });

  it('returns null when food is unchanged', () => {
    expect(
      resolveMemberFoodHistoryType(
        {
          status: EParticipantOrderStatus.joined,
          foodId: 'f1',
        },
        {
          status: EParticipantOrderStatus.joined,
          foodId: 'f1',
        },
      ),
    ).toBeNull();
  });
});

describe('getHighlightedMembersAfterDeadline', () => {
  const deadlineDate = 1_700_000_000_000;

  it('maps ADDED and CHANGED after deadline with correct changeType', () => {
    const result = getHighlightedMembersAfterDeadline({
      deadlineDate,
      historyItems: [
        {
          memberId: 'user-1',
          type: EEditSubOrderHistoryType.MEMBER_FOOD_ADDED,
          authorRole: 'admin',
          createdAt: { seconds: deadlineDate / 1000 + 100 },
        },
        {
          memberId: 'user-2',
          type: EEditSubOrderHistoryType.MEMBER_FOOD_CHANGED,
          authorRole: 'booker',
          createdAt: { seconds: deadlineDate / 1000 + 200 },
        },
      ],
    });

    expect(result['user-1']).toEqual({
      changeType: 'added',
      authorRole: 'admin',
    });
    expect(result['user-2']).toEqual({
      changeType: 'changed',
      authorRole: 'booker',
    });
  });

  it('ignores records before deadline', () => {
    const result = getHighlightedMembersAfterDeadline({
      deadlineDate,
      historyItems: [
        {
          memberId: 'user-1',
          type: EEditSubOrderHistoryType.MEMBER_FOOD_ADDED,
          authorRole: 'admin',
          createdAt: { seconds: deadlineDate / 1000 - 100 },
        },
      ],
    });

    expect(result).toEqual({});
  });

  it('uses the latest record when multiple exist for one member', () => {
    const result = getHighlightedMembersAfterDeadline({
      deadlineDate,
      historyItems: [
        {
          memberId: 'user-1',
          type: EEditSubOrderHistoryType.MEMBER_FOOD_ADDED,
          authorRole: 'admin',
          createdAt: { seconds: deadlineDate / 1000 + 100 },
        },
        {
          memberId: 'user-1',
          type: EEditSubOrderHistoryType.MEMBER_FOOD_CHANGED,
          authorRole: 'admin',
          createdAt: { seconds: deadlineDate / 1000 + 500 },
        },
      ],
    });

    expect(result['user-1']?.changeType).toBe('changed');
  });
});

describe('countHighlightedMembers', () => {
  it('counts added and changed entries', () => {
    expect(
      countHighlightedMembers({
        a: { changeType: 'added', authorRole: 'admin' },
        b: { changeType: 'changed', authorRole: 'booker' },
        c: { changeType: 'added', authorRole: 'booker' },
      }),
    ).toEqual({ added: 2, changed: 1 });
  });
});

describe('getHistoryCreatedAtMs', () => {
  it('reads firestore-like seconds', () => {
    expect(getHistoryCreatedAtMs({ seconds: 1_700_000_000 })).toBe(
      1_700_000_000_000,
    );
  });

  it('reads Firestore Timestamp via toDate()', () => {
    const date = new Date(1_700_000_000_000);
    expect(getHistoryCreatedAtMs({ toDate: () => date })).toBe(date.getTime());
  });
});

describe('buildSubOrderHistoryEntryFromMemberOrderDiff', () => {
  it('builds an ADDED history entry with food metadata', () => {
    const entry = buildSubOrderHistoryEntryFromMemberOrderDiff({
      memberId: 'user-1',
      planId: 'plan-1',
      planOrderDate: 1_700_000_000_000,
      authorRole: 'admin',
      oldMemberOrder: { status: EParticipantOrderStatus.empty, foodId: '' },
      newMemberOrder: {
        status: EParticipantOrderStatus.joined,
        foodId: 'f1',
      },
      foodList: {
        f1: { foodName: 'Cơm', foodPrice: 50_000 },
      },
    });

    expect(entry?.type).toBe(EEditSubOrderHistoryType.MEMBER_FOOD_ADDED);
    expect(entry?.newValue?.foodName).toBe('Cơm');
    expect(entry?.authorRole).toBe('admin');
  });
});
