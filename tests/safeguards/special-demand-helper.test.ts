/**
 * SPECIAL DEMAND LABEL SAFEGUARDS
 *
 * Guards the helper mapping allergy / nutrition keys to display labels.
 * It is shared by the public tracking sheet and the admin member table, so an
 * unknown key (an option removed from system attributes) must not break the UI.
 *
 * Source: src/helpers/specialDemandHelper.ts
 */

import {
  getAllergyLabels,
  getNutritionLabels,
} from '@helpers/specialDemandHelper';

describe('getAllergyLabels', () => {
  it('trả về mảng rỗng khi không truyền gì', () => {
    expect(getAllergyLabels()).toEqual([]);
    expect(getAllergyLabels([])).toEqual([]);
  });

  it('map key sang label tiếng Việt theo đúng thứ tự truyền vào', () => {
    expect(getAllergyLabels(['shrimp', 'egg'])).toEqual(['Tôm', 'Trứng']);
  });

  it('bỏ qua key không có trong danh sách option', () => {
    expect(getAllergyLabels(['egg', 'khong-ton-tai'])).toEqual(['Trứng']);
  });
});

describe('getNutritionLabels', () => {
  const options = [
    { key: 'vegetarian', label: 'Ăn chay' },
    { key: 'lowCarb', label: 'Ít tinh bột' },
  ];

  it('trả về mảng rỗng khi thiếu options', () => {
    expect(getNutritionLabels(['vegetarian'])).toEqual([]);
    expect(getNutritionLabels(['vegetarian'], [])).toEqual([]);
  });

  it('map key sang label lấy từ options truyền vào', () => {
    expect(getNutritionLabels(['lowCarb', 'vegetarian'], options)).toEqual([
      'Ít tinh bột',
      'Ăn chay',
    ]);
  });

  it('bỏ qua key không có trong options', () => {
    expect(getNutritionLabels(['vegetarian', 'unknown'], options)).toEqual([
      'Ăn chay',
    ]);
  });
});
