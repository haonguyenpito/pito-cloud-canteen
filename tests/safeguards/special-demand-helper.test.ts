/**
 * SPECIAL DEMAND LABEL SAFEGUARDS
 *
 * Bảo vệ helper map key dị ứng / chế độ dinh dưỡng sang label hiển thị.
 * Helper này dùng chung cho phiếu tracking public và bảng member phía admin,
 * nên một key lạ (option bị xoá khỏi system attributes) không được làm vỡ UI.
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
