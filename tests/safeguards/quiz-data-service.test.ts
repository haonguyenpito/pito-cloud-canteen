/**
 * QUIZ DATA MERGE SAFEGUARDS
 *
 * A booker's quizData is the default for `generalInfo` of every order they
 * create after the first one (Order.slice.ts — `hasOrderBefore ? bookerQuizData : quiz`),
 * including `packagePerMember`, the per-person budget. Overwriting a wrong field
 * here silently mispriced every subsequent order.
 *
 * Source: src/pages/api/apiServices/user/quizData.service.ts
 */

import type { TBookerQuizData } from '@apiServices/user/quizData.service';
import { mergeQuizData } from '@apiServices/user/quizData.service';

const current: TBookerQuizData = {
  packagePerMember: 60_000,
  memberAmount: 30,
  daySession: 'lunch',
  deliveryHour: '11:30',
  mealStyles: ['viet'],
  nutritions: ['vegetarian'],
  mealType: ['lunch'],
};

describe('mergeQuizData', () => {
  it('overwrites only fields present in patch', () => {
    expect(mergeQuizData(current, { packagePerMember: 75_000 })).toEqual({
      ...current,
      packagePerMember: 75_000,
    });
  });

  it('skips fields with undefined value in patch', () => {
    expect(
      mergeQuizData(current, { packagePerMember: undefined, memberAmount: 40 }),
    ).toEqual({ ...current, memberAmount: 40 });
  });

  it('keeps existing data unchanged when patch is empty', () => {
    expect(mergeQuizData(current, {})).toEqual(current);
  });

  it('replaces the whole array instead of merging elements', () => {
    expect(mergeQuizData(current, { mealStyles: ['japanese'] })).toEqual({
      ...current,
      mealStyles: ['japanese'],
    });
  });

  it('works when the booker has no quizData yet', () => {
    expect(mergeQuizData({}, { memberAmount: 12 })).toEqual({
      memberAmount: 12,
    });
  });

  it('does not carry over fields outside the quizData allowlist', () => {
    expect(
      mergeQuizData(current, {
        hasOrderBefore: true,
        memberAmount: 40,
      } as TBookerQuizData),
    ).toEqual({ ...current, memberAmount: 40 });
  });
});
