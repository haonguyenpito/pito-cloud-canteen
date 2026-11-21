import React, { useState } from 'react';

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
  /** Applies one value to many dishes in a single draft update. */
  onApplySelected: (foodIds: string[], value: string) => void;
  onSave: () => void;
};

const MenuExtraFeePanel = ({
  rows,
  draft,
  isDirty,
  isEditable,
  inProgress = false,
  onChange,
  onApplySelected,
  onSave,
}: TMenuExtraFeePanelProps) => {
  /**
   * Selection and the bulk amount are deliberately panel-local: the panel
   * unmounts when its row collapses, so both reset when the admin switches menu,
   * while the fee values themselves live in the page and survive a collapse.
   */
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const [bulkAmount, setBulkAmount] = useState('');

  const isAllSelected =
    rows.length > 0 && selectedFoodIds.length === rows.length;
  const isPartiallySelected =
    selectedFoodIds.length > 0 && selectedFoodIds.length < rows.length;
  // `''` and not falsiness: "0" is a real instruction to clear the surcharge.
  const canApplySelected =
    selectedFoodIds.length > 0 && bulkAmount !== '' && !inProgress;

  const handleToggleFood = (foodId: string) => {
    setSelectedFoodIds((current) =>
      current.includes(foodId)
        ? current.filter((id) => id !== foodId)
        : [...current, foodId],
    );
  };

  const handleToggleAll = () => {
    setSelectedFoodIds(isAllSelected ? [] : rows.map((row) => row.foodId));
  };

  const handleBulkAmountChange = (value: string) => {
    // Digits only, for two reasons: `parsePrice('')` returns '0' (so an emptied
    // field could never be cleared again), and `parsePrice('abc')` returns 'abc'
    // unchanged — which would pass the "not empty" check and silently apply 0.
    const digits = value.replace(/\D/g, '');

    setBulkAmount(digits === '' ? '' : parsePrice(digits));
  };

  const handleApplySelected = () => {
    if (!canApplySelected) {
      return;
    }

    onApplySelected(selectedFoodIds, bulkAmount);
    // Clearing the ticks confirms the apply landed; the amount stays so the same
    // fee can go to a second group without retyping.
    setSelectedFoodIds([]);
  };

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

      {isEditable && (
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <div className="relative w-[130px]">
            <input
              className="w-full px-3 py-1.5 pr-7 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400"
              type="text"
              inputMode="numeric"
              placeholder="0"
              aria-label="Phụ phí áp dụng cho các món đã chọn"
              value={bulkAmount}
              disabled={inProgress}
              onChange={(event) => handleBulkAmountChange(event.target.value)}
              onKeyDown={(event) => {
                // Same reason as the row inputs: Enter would submit the table's
                // react-final-form <Form>.
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleApplySelected();
                }
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              đ
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleApplySelected}
            disabled={!canApplySelected}>
            Áp dụng cho {selectedFoodIds.length} món
          </Button>
          <span className="text-sm text-gray-500">
            Chọn món rồi áp dụng một mức phụ phí. Nhập <strong>0</strong> để bỏ
            phụ phí. Thay đổi chỉ được lưu khi bấm &quot;Lưu phụ phí&quot;.
          </span>
        </div>
      )}

      <div className="max-h-[360px] overflow-y-auto rounded-lg bg-white border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_rgb(229,231,235)]">
            <tr className="text-left text-gray-500">
              {isEditable && (
                <th className="py-2 px-3 font-medium w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                    aria-label="Chọn tất cả món"
                    checked={isAllSelected}
                    disabled={inProgress}
                    // `indeterminate` is a DOM property, not an attribute.
                    ref={(element) => {
                      if (element) {
                        element.indeterminate = isPartiallySelected;
                      }
                    }}
                    onChange={handleToggleAll}
                  />
                </th>
              )}
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
                  {isEditable && (
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-amber-500 cursor-pointer"
                        aria-label={`Chọn ${row.title}`}
                        checked={selectedFoodIds.includes(row.foodId)}
                        disabled={inProgress}
                        onChange={() => handleToggleFood(row.foodId)}
                      />
                    </td>
                  )}
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
