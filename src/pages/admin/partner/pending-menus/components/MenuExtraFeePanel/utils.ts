const DAY_LABELS: Record<string, string> = {
  mon: 'T2',
  tue: 'T3',
  wed: 'T4',
  thu: 'T5',
  fri: 'T6',
  sat: 'T7',
  sun: 'CN',
};

export type TMenuFoodExtraFeeRow = {
  foodId: string;
  title: string;
  price: number;
  /** Weekday short labels the dish is served on, for context only. */
  days: string[];
};

/**
 * One row per DISH, not per (day, dish): the fee is stored as a flat map on the
 * menu, so a dish served on several days carries a single fee within this menu.
 */
export const buildExtraFeeRows = (
  foodsByDate: Record<string, Record<string, any>> = {},
): TMenuFoodExtraFeeRow[] => {
  const rowsByFoodId = new Map<string, TMenuFoodExtraFeeRow>();

  Object.keys(foodsByDate).forEach((dayOfWeek) => {
    const foodsOfDay = foodsByDate[dayOfWeek] || {};

    Object.keys(foodsOfDay).forEach((foodId) => {
      const food = foodsOfDay[foodId] || {};
      const dayLabel = DAY_LABELS[dayOfWeek] || dayOfWeek;
      const existing = rowsByFoodId.get(foodId);

      if (existing) {
        if (!existing.days.includes(dayLabel)) {
          existing.days.push(dayLabel);
        }

        return;
      }

      rowsByFoodId.set(foodId, {
        foodId,
        title: food.title || '',
        price: Number(food.price) || 0,
        days: [dayLabel],
      });
    });
  });

  return Array.from(rowsByFoodId.values()).sort((first, second) =>
    first.title.localeCompare(second.title, 'vi'),
  );
};

export const formatVnd = (amount: number) =>
  `${amount.toLocaleString('vi-VN')}đ`;

/** Strips the thousand separators the fee input renders. */
export const toAmount = (value: string) =>
  Number(value.replace(/\D/g, '')) || 0;

/**
 * Applies one raw input value to several dishes at once.
 *
 * Returns the whole next draft so the caller can do it in a single state update:
 * looping the per-row `onChange` would base every call on the same stale draft
 * and only the last dish would keep the fee.
 */
export const applyFeeToFoods = (
  draft: Record<string, string>,
  foodIds: string[],
  value: string,
): Record<string, string> => ({
  ...draft,
  ...foodIds.reduce<Record<string, string>>(
    (result, foodId) => ({ ...result, [foodId]: value }),
    {},
  ),
});

/**
 * True when the admin's draft differs from what is stored on the menu.
 *
 * Guards against silent edit loss: the panel shows "chưa lưu" from this, and an
 * empty field must compare equal to a missing/zero saved fee rather than
 * reading as a change.
 */
export const hasUnsavedExtraFeeChanges = (
  draft: Record<string, string> = {},
  saved: Record<string, number | undefined> = {},
  foodIds: string[] = [],
): boolean =>
  foodIds.some(
    (foodId) => toAmount(draft[foodId] || '') !== (saved[foodId] ?? 0),
  );

const MENU_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Label for the menu list's "Phụ phí" column: the single value when the
 * dishes agree, a range when they do not.
 *
 * Only dishes still in the menu count — a fee left over from a removed dish
 * (stored before orphans were pruned on menu save) must not widen the range.
 */
export const buildExtraFeeLabel = (
  foodExtraFees: Record<string, number | undefined> = {},
  menuMetadata: Record<string, unknown> = {},
): string => {
  const menuFoodIds = new Set(
    MENU_DAY_KEYS.flatMap(
      (day) => (menuMetadata[`${day}FoodIdList`] as string[]) || [],
    ),
  );
  const fees = Object.entries(foodExtraFees)
    .filter(([foodId]) => menuFoodIds.has(foodId))
    .map(([, fee]) => fee)
    .filter((fee): fee is number => typeof fee === 'number' && fee > 0);

  if (fees.length === 0) {
    return '';
  }

  const min = Math.min(...fees);
  const max = Math.max(...fees);

  return min === max ? formatVnd(min) : `${formatVnd(min)} – ${formatVnd(max)}`;
};
