import React from 'react';
import classNames from 'classnames';

import Button from '@components/Button/Button';
import IconSpinner from '@components/Icons/IconSpinner/IconSpinner';
import { useMenuExtraFeeImportPreview } from '@hooks/useMenuExtraFeeImportPreview';

type TImportExtraFeeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => void;
};

const ImportExtraFeeModal = ({
  isOpen,
  onClose,
  onImported,
}: TImportExtraFeeModalProps) => {
  const {
    previewRecords,
    validRecords,
    invalidRecords,
    isValidating,
    isImporting,
    isImported,
    error,
    handleFileChange,
    handleImport,
    reset,
  } = useMenuExtraFeeImportPreview({ onImportSuccess: onImported });

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[900px] max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Import phụ phí
          </h3>
          <p className="text-sm text-gray-500">
            Mỗi dòng là một cặp <strong>thực đơn + món ăn</strong>. Chỉ những
            thực đơn <strong>chưa được duyệt</strong> mới nhận phụ phí.
          </p>
        </div>

        <div className="px-6">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-gray-600 mb-1">Tệp Excel cần 3 cột:</p>
            <code className="text-sm text-gray-800">
              Thực đơn | Món ăn | Phụ phí (Vnđ)
            </code>
          </div>

          <label
            htmlFor="extraFeeImportFile"
            className="inline-block text-blue-600 underline cursor-pointer text-sm mb-4">
            Chọn tệp Excel
            <input
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              type="file"
              className="hidden"
              name="extraFeeImportFile"
              id="extraFeeImportFile"
              disabled={isValidating || isImporting}
            />
          </label>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}

          {isValidating && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <IconSpinner />
              <span>Đang kiểm tra dữ liệu...</span>
            </div>
          )}
        </div>

        {!!previewRecords.length && (
          <>
            <div className="px-6 flex gap-4 text-sm mb-2">
              <span className="text-green-700 font-medium">
                {validRecords.length} dòng hợp lệ
              </span>
              {invalidRecords.length > 0 && (
                <span className="text-red-600 font-medium">
                  {invalidRecords.length} dòng lỗi (sẽ bỏ qua)
                </span>
              )}
            </div>

            <div className="px-6 overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead className="bg-gray-100 sticky top-0">
                  <tr className="text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">Thực đơn</th>
                    <th className="px-3 py-2 font-medium">Món ăn</th>
                    <th className="px-3 py-2 font-medium">Phụ phí</th>
                    <th className="px-3 py-2 font-medium">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRecords.map((record, index) => (
                    <tr
                      // Rows have no stable id; order is the identity here.
                      key={`${record.menuTitle}-${record.foodName}-${index}`}
                      className={classNames('border-t border-gray-100', {
                        'bg-red-50': record.status === 'error',
                      })}>
                      <td className="px-3 py-2 text-gray-800">
                        {record.menuTitle}
                      </td>
                      <td className="px-3 py-2 text-gray-800">
                        {record.foodName}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {record.extraFee}
                      </td>
                      <td className="px-3 py-2">
                        {record.status === 'error' ? (
                          <span className="text-red-600">{record.error}</span>
                        ) : (
                          <span className="text-green-700">Hợp lệ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {isImported && (
          <p className="px-6 pt-3 text-sm text-green-700 font-medium">
            Đã áp dụng phụ phí cho {validRecords.length} món.
          </p>
        )}

        <div className="flex gap-3 px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
            disabled={isImporting}>
            {isImported ? 'Đóng' : 'Huỷ'}
          </Button>
          {!isImported && (
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={handleImport}
              inProgress={isImporting}
              disabled={!validRecords.length || isValidating}>
              Áp dụng {validRecords.length > 0 && `(${validRecords.length})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportExtraFeeModal;
