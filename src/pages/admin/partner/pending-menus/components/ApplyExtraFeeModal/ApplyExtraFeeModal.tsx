import React, { useState } from 'react';

import Button from '@components/Button/Button';
import { parsePrice } from '@utils/validators';

type TApplyExtraFeeModalProps = {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onApply: (extraFee: number) => void;
  isApplying?: boolean;
};

const ApplyExtraFeeModal = ({
  isOpen,
  selectedCount,
  onClose,
  onApply,
  isApplying = false,
}: TApplyExtraFeeModalProps) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = parsePrice(e.target.value);
    setInputValue(formatted);
    if (error) setError('');
  };

  const handleSubmit = () => {
    const amount = Number(inputValue.replace(/\D/g, ''));
    if (isNaN(amount) || amount < 0) {
      setError('Vui lòng nhập số tiền hợp lệ (≥ 0đ)');
      return;
    }
    onApply(amount);
  };

  const handleClose = () => {
    setInputValue('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-1 text-center">
            Thêm phụ phí
          </h3>
          <p className="text-sm text-gray-500 text-center mb-6">
            Áp dụng cho{' '}
            <strong className="text-amber-600">{selectedCount} menu</strong>{' '}
            đã chọn
          </p>

          {/* Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phí phụ thu
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                className={`w-full px-4 py-3 pr-10 border rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 ${
                  error ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
                type="text"
                inputMode="numeric"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="0"
                disabled={isApplying}
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                đ
              </span>
            </div>
            {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
          </div>

          {/* Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
            <p className="text-sm text-amber-700">
              Phí phụ thu sẽ được áp dụng cho <strong>tất cả món ăn</strong>{' '}
              trong các menu đã chọn. Giá hiển thị với khách sẽ là đơn giá gốc
              + phụ phí.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
            disabled={isApplying}>
            Huỷ
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSubmit}
            inProgress={isApplying}>
            Áp dụng
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApplyExtraFeeModal;
