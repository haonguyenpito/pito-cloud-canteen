import { EEditSubOrderHistoryType } from '@src/utils/enums';
import type { TSubOrderChangeHistoryItem } from '@src/utils/types';

export type SubOrderHighlightEntry = {
  changeType: 'added' | 'changed';
  authorRole: 'admin' | 'booker';
};

export function getHistoryCreatedAtMs(createdAt: unknown): number {
  if (!createdAt) {
    return 0;
  }

  if (typeof createdAt === 'number') {
    return createdAt;
  }

  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }

  if (typeof createdAt === 'object') {
    const record = createdAt as {
      seconds?: number;
      _seconds?: number;
      toDate?: () => Date;
    };

    if (typeof record.toDate === 'function') {
      return record.toDate().getTime();
    }

    if (record.seconds != null) {
      return Number(record.seconds) * 1000;
    }

    if (record._seconds != null) {
      return Number(record._seconds) * 1000;
    }
  }

  return 0;
}

const HIGHLIGHT_HISTORY_TYPES = new Set([
  EEditSubOrderHistoryType.MEMBER_FOOD_ADDED,
  EEditSubOrderHistoryType.MEMBER_FOOD_CHANGED,
]);

export function getHighlightedMembersAfterDeadline({
  historyItems,
  deadlineDate,
}: {
  historyItems: TSubOrderChangeHistoryItem[];
  deadlineDate?: number;
}): Record<string, SubOrderHighlightEntry> {
  if (!deadlineDate) {
    return {};
  }

  const latestByMember: Record<
    string,
    { entry: SubOrderHighlightEntry; createdAtMs: number }
  > = {};

  historyItems.forEach((item) => {
    const { memberId, type, authorRole, createdAt } = item;

    if (!memberId || !authorRole) {
      return;
    }

    if (authorRole !== 'admin' && authorRole !== 'booker') {
      return;
    }

    if (!type || !HIGHLIGHT_HISTORY_TYPES.has(type)) {
      return;
    }

    const createdAtMs = getHistoryCreatedAtMs(createdAt);

    if (createdAtMs <= deadlineDate) {
      return;
    }

    const changeType =
      type === EEditSubOrderHistoryType.MEMBER_FOOD_ADDED ? 'added' : 'changed';

    const existing = latestByMember[memberId];

    if (!existing || createdAtMs >= existing.createdAtMs) {
      latestByMember[memberId] = {
        entry: { changeType, authorRole },
        createdAtMs,
      };
    }
  });

  return Object.fromEntries(
    Object.entries(latestByMember).map(([memberId, { entry }]) => [
      memberId,
      entry,
    ]),
  );
}

export function countHighlightedMembers(
  highlightedMembers: Record<string, SubOrderHighlightEntry>,
) {
  return Object.values(highlightedMembers).reduce(
    (acc, { changeType }) => {
      if (changeType === 'added') {
        acc.added += 1;
      } else {
        acc.changed += 1;
      }

      return acc;
    },
    { added: 0, changed: 0 },
  );
}
