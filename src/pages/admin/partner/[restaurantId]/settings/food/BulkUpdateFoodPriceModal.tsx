import { useState } from 'react';
import classNames from 'classnames';

import Button from '@components/Button/Button';
import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import AlertModal from '@components/Modal/AlertModal';
import { parseThousandNumber, removeNonNumeric } from '@helpers/format';

type TFoodPriceItem = { id: string; title: string; price: number };

type TBulkUpdateFoodPriceModalProps = {
  foods: TFoodPriceItem[];
  inProgress: boolean;
  error?: any;
  onClose: () => void;
  onSubmit: (foodPrices: { id: string; price: number }[]) => void;
};

const formatVND = (value: number) => `${parseThousandNumber(value)}đ`;

const inputClassName =
  'w-full rounded-lg border border-solid border-gray-300 px-3 py-2 text-right text-sm focus:border-black focus:outline-none';

const BulkUpdateFoodPriceModal: React.FC<TBulkUpdateFoodPriceModalProps> = ({
  foods,
  inProgress,
  error,
  onClose,
  onSubmit,
}) => {
  const [newPrices, setNewPrices] = useState<Record<string, string>>({});
  const [commonPrice, setCommonPrice] = useState('');

  const getNewPrice = (food: TFoodPriceItem) =>
    newPrices[food.id] ?? String(food.price);

  const changedFoods = foods
    .map((food) => ({ id: food.id, price: Number(getNewPrice(food)) }))
    .filter(({ id, price }) => price !== foods.find((f) => f.id === id)?.price);
  const hasInvalidPrice = foods.some(
    (food) => !(Number(getNewPrice(food)) > 0),
  );

  const applyCommonPrice = () => {
    if (!commonPrice) return;
    setNewPrices(Object.fromEntries(foods.map(({ id }) => [id, commonPrice])));
  };

  return (
    <AlertModal
      isOpen
      title="Sửa giá món"
      handleClose={onClose}
      onCancel={onClose}
      onConfirm={() => onSubmit(changedFoods)}
      cancelLabel="Hủy"
      confirmLabel={`Cập nhật giá (${changedFoods.length} món)`}
      confirmInProgress={inProgress}
      confirmDisabled={inProgress || hasInvalidPrice || !changedFoods.length}
      containerClassName="!w-full md:!min-w-[640px]"
      childrenClassName="!text-gray-900">
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-semibold">
              Đặt cùng một giá cho {foods.length} món
            </span>
            <input
              className={inputClassName}
              inputMode="numeric"
              placeholder="VD: 45,000"
              value={parseThousandNumber(commonPrice)}
              onChange={(e) => setCommonPrice(removeNonNumeric(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && applyCommonPrice()}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={!commonPrice}
            onClick={applyCommonPrice}>
            Áp dụng
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 font-medium">Tên món</th>
                <th className="py-2 text-right font-medium">Giá hiện tại</th>
                <th className="w-40 py-2 pl-4 text-right font-medium">
                  Giá mới (đ)
                </th>
              </tr>
            </thead>
            <tbody>
              {foods.map((food) => {
                const newPrice = getNewPrice(food);
                const isChanged = Number(newPrice) !== food.price;
                const isInvalid = !(Number(newPrice) > 0);

                return (
                  <tr
                    key={food.id}
                    className={classNames('border-t border-gray-200', {
                      'bg-yellow-50': isChanged,
                    })}>
                    <td className="py-2 pr-2">{food.title}</td>
                    <td
                      className={classNames('py-2 text-right', {
                        'text-gray-400 line-through': isChanged,
                      })}>
                      {formatVND(food.price)}
                    </td>
                    <td className="py-2 pl-4">
                      <input
                        className={classNames(inputClassName, {
                          '!border-red-500': isInvalid,
                        })}
                        inputMode="numeric"
                        value={parseThousandNumber(newPrice)}
                        onChange={(e) =>
                          setNewPrices((prev) => ({
                            ...prev,
                            [food.id]: removeNonNumeric(e.target.value),
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          Giá mới áp dụng cho menu và các đơn nháp có món này. Đơn đã chốt giữ
          nguyên giá cũ.
        </p>
        {error && <ErrorMessage message={error.message} />}
      </div>
    </AlertModal>
  );
};

export default BulkUpdateFoodPriceModal;
