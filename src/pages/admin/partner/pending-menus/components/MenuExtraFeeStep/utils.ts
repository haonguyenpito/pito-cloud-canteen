import type { TMenuFoodItem } from '@src/types';
import { EDayOfWeek } from '@src/utils/enums';

export type TMenuExtraFeeRow = {
  foodId: string;
  title: string;
  foodType?: string;
  partnerPrice: number;
};

export type TMenuExtraFeeDayGroup = {
  day: EDayOfWeek;
  rows: TMenuExtraFeeRow[];
};

/**
 * Groups a menu's dishes by the weekday they are served on. The fee is a flat
 * `{ [foodId]: fee }` map, so a dish listed on several days shares one fee.
 * @param foodsByDate - The menu's `foodsByDate`.
 * @returns One group per served day, Monday first; dishes sorted by partner
 *   price then title.
 */
export const buildExtraFeeDayGroups = (
  foodsByDate: Partial<
    Record<
      EDayOfWeek,
      Record<
        string,
        Pick<Partial<TMenuFoodItem>, 'title' | 'price' | 'foodType'> | undefined
      >
    >
  > = {},
): TMenuExtraFeeDayGroup[] =>
  Object.values(EDayOfWeek)
    .map((day) => ({
      day,
      rows: Object.entries(foodsByDate[day] || {})
        .map(([foodId, food]) => ({
          foodId,
          title: food?.title || '',
          foodType: food?.foodType,
          partnerPrice: Number(food?.price) || 0,
        }))
        .sort(
          (first, second) =>
            first.partnerPrice - second.partnerPrice ||
            first.title.localeCompare(second.title, 'vi'),
        ),
    }))
    .filter(({ rows }) => rows.length > 0);

/**
 * Keeps only the digits of a fee input, so a negative or decimal fee cannot
 * be typed.
 * @param value - The raw input value.
 * @returns The digits.
 */
export const toFeeInputValue = (value: string): string =>
  value.replace(/\D/g, '');

/**
 * Reads one fee input.
 * @param value - The raw input value.
 * @returns The fee, undefined for an empty input (no fee), NaN when invalid.
 */
export const parseExtraFeeInput = (value: string): number | undefined => {
  const trimmed = value.trim();

  if (trimmed === '') {
    return undefined;
  }

  const fee = Number(trimmed);

  return Number.isInteger(fee) && fee >= 0 ? fee : NaN;
};

/**
 * Turns the fee inputs into the map the API stores.
 * @param drafts - Raw input per foodId.
 * @returns The fees and the dishes whose input is invalid. Empty inputs are
 *   left out: the dish has no fee.
 */
export const toExtraFeeMap = (
  drafts: Record<string, string>,
): { extraFees: Record<string, number>; invalidFoodIds: string[] } =>
  Object.entries(drafts).reduce<{
    extraFees: Record<string, number>;
    invalidFoodIds: string[];
  }>(
    (result, [foodId, value]) => {
      const fee = parseExtraFeeInput(value);

      if (fee === undefined) {
        return result;
      }

      return Number.isNaN(fee)
        ? { ...result, invalidFoodIds: [...result.invalidFoodIds, foodId] }
        : { ...result, extraFees: { ...result.extraFees, [foodId]: fee } };
    },
    { extraFees: {}, invalidFoodIds: [] },
  );
