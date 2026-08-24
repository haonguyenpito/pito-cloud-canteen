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
