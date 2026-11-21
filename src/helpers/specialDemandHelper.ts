import { ALLERGIES_OPTIONS } from '@src/utils/options';

type TOption = { key: string; label: string };

const mapKeysToLabels = (keys: string[], options: TOption[]): string[] =>
  keys.reduce<string[]>((result, key) => {
    const option = options.find((item) => item.key === key);

    return option ? [...result, option.label] : result;
  }, []);

export const getAllergyLabels = (keys: string[] = []): string[] =>
  mapKeysToLabels(keys, ALLERGIES_OPTIONS);

export const getNutritionLabels = (
  keys: string[] = [],
  options: TOption[] = [],
): string[] => mapKeysToLabels(keys, options);
