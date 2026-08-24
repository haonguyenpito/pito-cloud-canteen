import React from 'react';

import Button from '@components/Button/Button';
import { parsePrice } from '@utils/validators';

import type { TMenuFoodExtraFeeRow } from './utils';
import { formatVnd, toAmount } from './utils';

type TMenuExtraFeePanelProps = {
  rows: TMenuFoodExtraFeeRow[];
  /** Raw input strings keyed by foodId — owned by the page so edits survive a collapse. */
  draft: Record<string, string>;
  isDirty: boolean;
  isEditable: boolean;
  inProgress?: boolean;
  onChange: (foodId: string, value: string) => void;
  onSave: () => void;
};

const MenuExtraFeePanel = ({
  rows,
  draft,
  isDirty,
  isEditable,
  inProgress = false,
  onChange,
  onSave,
}: TMenuExtraFeePanelProps) => {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-4 bg-gray-50 text-sm text-gray-500">
        Menu này chưa có món ăn nào.
      </div>
    );
  }

  return (
    <div className="px-6 py-4 bg-gray-50">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          Phụ phí được lưu riêng cho từng món <strong>trong menu này</strong>.
          Cùng một món ở menu khác vẫn giữ phụ phí riêng của menu đó.
        </p>
        {isDirty && (
          <span className="text-sm text-amber-600 font-medium whitespace-nowrap">
            • chưa lưu
          </span>
        )}
      </div>

      {!isEditable && (
        <p className="text-sm text-gray-600 mb-3">
          Menu đã được duyệt nên không thể thay đổi phụ phí.
        </p>
      )}

      <div className="max-h-[360px] overflow-y-auto rounded-lg bg-white border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_rgb(229,231,235)]">
            <tr className="text-left text-gray-500">
              <th className="py-2 px-3 font-medium">Món ăn</th>
              <th className="py-2 px-3 font-medium whitespace-nowrap">Ngày</th>
              <th className="py-2 px-3 font-medium whitespace-nowrap">
                Đơn giá
              </th>
              <th className="py-2 px-3 font-medium whitespace-nowrap">
                Phụ phí
              </th>
              <th className="py-2 px-3 font-medium whitespace-nowrap">
                Giá hiển thị
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const fee = toAmount(draft[row.foodId] || '');

              return (
                <tr key={row.foodId} className="border-t border-gray-100">
                  <td className="py-2 px-3 text-gray-800">{row.title}</td>
                  <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                    {row.days.join(', ')}
                  </td>
                  <td className="py-2 px-3 text-gray-700 whitespace-nowrap">
                    {formatVnd(row.price)}
                  </td>
                  <td className="py-2 px-3">
                    <div className="relative w-[130px]">
                      <input
                        className="w-full px-3 py-1.5 pr-7 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400"
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={draft[row.foodId] || ''}
                        disabled={!isEditable || inProgress}
                        onChange={(event) =>
                          onChange(row.foodId, parsePrice(event.target.value))
                        }
                        onKeyDown={(event) => {
                          // These inputs sit inside the table's react-final-form
                          // <Form>; Enter would submit it.
                          if (event.key === 'Enter') {
                            event.preventDefault();
                          }
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        đ
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap font-semibold text-gray-900">
                    {formatVnd(row.price + fee)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEditable && (
        <div className="flex justify-end mt-3">
          <Button
            type="button"
            onClick={onSave}
            inProgress={inProgress}
            disabled={!isDirty}>
            Lưu phụ phí
          </Button>
        </div>
      )}
    </div>
  );
};

export default MenuExtraFeePanel;
