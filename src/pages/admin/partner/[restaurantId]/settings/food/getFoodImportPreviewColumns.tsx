import React from 'react';

import IconSpinner from '@components/Icons/IconSpinner/IconSpinner';
import type { FoodImportRecord } from '@hooks/useFoodImportPreview';

import { PastableImageInput } from './PastableImageInput';
import type { Column } from './PreviewTable';

export const getFoodImportPreviewColumns = (
  setPreviewRecords: React.Dispatch<React.SetStateAction<FoodImportRecord[]>>,
): Column[] => {
  const handleImageChange = (index: number, newVal: string) => {
    setPreviewRecords((prev) => {
      const next = [...prev];
      if (typeof index === 'number') {
        next[index] = {
          ...next[index],
          imageBase64: newVal,
          imageBase64Loading: false,
        };
      }

      return next;
    });
  };

  return [
    {
      label: 'STT',
      accessor: 'index',
      render: (_value: string, _record: FoodImportRecord, index?: number) => {
        if (index === undefined) {
          return <></>;
        }

        return index + 1;
      },
    },
    {
      label: 'Tình trạng',
      accessor: 'status',
      render: (value: string) => {
        let indicator: React.ReactNode = '❌';
        if (!value) {
          indicator = '⚫';
        }

        if (value === 'loading') {
          indicator = <IconSpinner className="text-blue-500 stroke-blue-500" />;
        }

        if (value === 'success') {
          indicator = '✅';
        }

        return (
          <div className="text-center flex items-center justify-center">
            {indicator}
          </div>
        );
      },
    },
    {
      label: 'Hình ảnh',
      accessor: 'imageBase64',
      render: (value: string, record: FoodImportRecord, index?: number) => {
        if (index === undefined) {
          return <></>;
        }

        if (record.imageBase64Loading) {
          return <IconSpinner className="text-blue-500 stroke-blue-500" />;
        }

        return (
          <div className="flex gap-2">
            <div className="min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px]">
              {value && (
                <img
                  src={value}
                  alt="Template"
                  className="min-w-[64px] min-h-[64px] object-cover rounded-md max-w-[64px] max-h-[64px]"
                />
              )}
            </div>
            <PastableImageInput
              onChange={(newVal: string) => handleImageChange(index, newVal)}
            />
          </div>
        );
      },
    },
    {
      label: 'Tên món ăn',
      accessor: 'name',
      width: 200,
    },
    {
      label: 'Loại menu',
      accessor: 'menuType',
    },
    {
      label: 'Phân loại',
      accessor: 'category',
    },
    {
      label: 'Mô tả chi tiết',
      accessor: 'description',
      width: 400,
    },
    {
      label: 'Chất liệu bao bì',
      accessor: 'packaging',
    },
    {
      label: 'Đơn giá (Vnđ)',
      accessor: 'price',
    },
    {
      label: 'Phí phụ thu (Vnđ)',
      accessor: 'extraFee',
    },
    {
      label: 'Số món chính (món)',
      accessor: 'numberOfMainDishes',
    },
    {
      label: 'Món xào',
      accessor: 'stirFriedMeal',
    },
    {
      label: 'Món canh',
      accessor: 'soup',
    },
    {
      label: 'Tráng miệng',
      accessor: 'dessert',
    },
    {
      label: 'Nước uống',
      accessor: 'drink',
    },
    {
      label: 'Thành phần dị ứng',
      accessor: 'allergicIngredients',
    },
    {
      label: 'Ghi chú',
      accessor: 'note',
    },
  ];
};
