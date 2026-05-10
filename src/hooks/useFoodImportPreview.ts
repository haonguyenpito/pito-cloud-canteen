import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { partnerFoodApi } from '@apis/foodApi';
import { createPartnerFoodApi } from '@apis/partnerApi';
import { sleep } from '@helpers/index';
import { remoteImageUrlToBase64 } from '@pages/admin/partner/[restaurantId]/settings/food/remoteImageUrlToBase64';
import { getImportDataFromCsv } from '@pages/partner/products/food/utils';
import { createSdkInstance } from '@sharetribe/sdk';

export type FoodImportRecord = {
  image?: string;
  name?: string;
  menuType?: string;
  category?: string;
  description?: string;
  packaging?: string;
  price?: string;
  extraFee?: string;
  numberOfMainDishes?: string;
  stirFriedMeal?: string;
  soup?: string;
  dessert?: string;
  drink?: string;
  allergicIngredients?: string;
  note?: string;
  imageBase64?: string;
  imageBase64Loading?: boolean;
  status?: 'loading' | 'success' | string;
};

type FoodImportRecordStringKey = {
  [K in keyof FoodImportRecord]: FoodImportRecord[K] extends string | undefined
    ? K
    : never;
}[keyof FoodImportRecord];

const NAME_TO_KEY_ADAPTER: Record<string, FoodImportRecordStringKey> = {
  'Hình ảnh': 'image',
  'Tên món ăn': 'name',
  'Loại menu': 'menuType',
  'Phân loại': 'category',
  'Mô tả chi tiết': 'description',
  'Chất liệu bao bì': 'packaging',
  'Đơn giá (Vnđ)': 'price',
  'Phí phụ thu (Vnđ)': 'extraFee',
  'Số món chính (món)': 'numberOfMainDishes',
  'Món xào': 'stirFriedMeal',
  'Món canh': 'soup',
  'Tráng miệng': 'dessert',
  'Nước uống': 'drink',
  'Thành phần dị ứng': 'allergicIngredients',
  'Ghi chú': 'note',
};

type UseFoodImportPreviewOptions = {
  restaurantId?: string | string[];
  packagingOptions: any;
  onImportSuccess?: () => void;
  onImportError?: (error: unknown) => void;
  isPartner?: boolean;
};

const dataUrlToFile = (dataUrl: string, filename: string) => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
};

const normalizeRestaurantId = (restaurantId?: string | string[]) => {
  if (!restaurantId) return undefined;

  return Array.isArray(restaurantId) ? restaurantId[0] : restaurantId;
};

export const useFoodImportPreview = ({
  restaurantId,
  packagingOptions,
  onImportError,
  onImportSuccess,
  isPartner = false,
}: UseFoodImportPreviewOptions) => {
  const [previewRecords, setPreviewRecords] = useState<FoodImportRecord[]>([]);
  const [isCreatingModeOn, setIsCreatingModeOn] = useState(false);
  const [
    isCreatingModeCompletedOneWayFlag,
    setIsCreatingModeCompletedOneWayFlag,
  ] = useState(false);
  const [shouldFetchImages, setShouldFetchImages] = useState(false);

  const normalizedRestaurantId = normalizeRestaurantId(restaurantId);

  const numberOfCreatedRecords = useMemo(() => {
    return previewRecords.filter(
      (record) => !!record.status && record.status !== 'loading',
    ).length;
  }, [previewRecords]);

  const totalRecords = previewRecords.length;

  const handleFileChange = useCallback((event: any) => {
    event.stopPropagation();
    event.preventDefault();
    setIsCreatingModeOn(false);
    setIsCreatingModeCompletedOneWayFlag(false);

    const targetFiles = event?.dataTransfer?.files?.length
      ? [...event.dataTransfer.files]
      : [...(event.target?.files || [])];

    if (!targetFiles.length) return;

    setPreviewRecords([]);

    const excelFile =
      targetFiles
        .filter(
          (file: File) =>
            file.type ===
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.type === 'application/vnd.ms-excel',
        )
        .pop() || targetFiles[targetFiles.length - 1];

    if (!excelFile) return;

    const reader = new FileReader();
    reader.onload = (_event) => {
      const data = new Uint8Array(_event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets.Template;

      const sheetRecords = XLSX.utils.sheet_to_json(sheet) as Record<
        string,
        string
      >[];

      const mappedRecords = sheetRecords.map((sheetRecord) => {
        const mappedRecord: Partial<FoodImportRecord> = {};

        Object.keys(sheetRecord).forEach((key) => {
          const adapterKey = NAME_TO_KEY_ADAPTER[key.normalize('NFC')];

          if (adapterKey) {
            (mappedRecord as Record<string, string | undefined>)[adapterKey] =
              sheetRecord[key];
          }
        });

        return mappedRecord;
      });

      setPreviewRecords(mappedRecords as FoodImportRecord[]);
      setShouldFetchImages(true);
    };

    reader.readAsArrayBuffer(excelFile);

    if (event.target) {
      // reset input value so the same file can be selected twice
      event.target.value = '';
    }
  }, []);

  useEffect(() => {
    if (!shouldFetchImages || previewRecords.length === 0) return;

    let isCancelled = false;

    const fetchImageBase64 = async () => {
      setPreviewRecords((prev) =>
        prev.map((record) => ({
          ...record,
          imageBase64Loading: true,
        })),
      );

      const previewRecordsWithBase64 = await Promise.all(
        previewRecords.map(async (record) => {
          if (!record.image) {
            return { ...record, imageBase64Loading: false };
          }

          try {
            if (record.image.startsWith('data:image')) {
              return {
                ...record,
                imageBase64: record.image,
                imageBase64Loading: false,
              };
            }

            const imageBase64 = await remoteImageUrlToBase64(record.image);

            return {
              ...record,
              imageBase64,
              imageBase64Loading: false,
            };
          } catch (error) {
            return {
              ...record,
              imageBase64: undefined,
              imageBase64Loading: false,
            };
          }
        }),
      );

      if (!isCancelled) {
        setPreviewRecords(previewRecordsWithBase64);
        setShouldFetchImages(false);
      }
    };

    fetchImageBase64();

    return () => {
      isCancelled = true;
    };
    // previewRecords intentionally omitted: including it causes an infinite loop
  // because setPreviewRecords(imageBase64Loading:true) would re-trigger this effect.
}, [shouldFetchImages]); // eslint-disable-line react-hooks/exhaustive-deps

  const onImportFoodFromCsv = useCallback(async () => {
    if (!normalizedRestaurantId) {
      throw new Error('Missing restaurant id');
    }

    const snapshotRecords = [...previewRecords];

    setIsCreatingModeOn(true);

    for (let i = 0; i < snapshotRecords.length; i++) {
      setPreviewRecords((prev) =>
        prev.map((record, index) => {
          if (index === i) {
            return {
              ...record,
              status: 'loading',
            };
          }

          return record;
        }),
      );

      const imageBase64 = snapshotRecords[i].imageBase64;

      try {
        let imageIdHolder = null;

        if (imageBase64) {
          const fileFromImageBase64 = dataUrlToFile(imageBase64, 'image.png');

          // eslint-disable-next-line no-await-in-loop
          const uploadRes = await createSdkInstance().images.upload(
            {
              image: fileFromImageBase64,
            },
            {
              expand: true,
              'fields.image': [
                'variants.squareSmall',
                'variants.squareSmall2x',
                'variants.scaledLarge',
              ],
            },
          );

          imageIdHolder = uploadRes.data.data.id.uuid;
        }

        const {
          imageBase64: _imageBase64,
          status: _status,
          imageBase64Loading: _imageBase64Loading,
          ...dataParamsInput
        } = snapshotRecords[i];

        const dataParams: ReturnType<typeof getImportDataFromCsv> & {
          images?: string;
        } = getImportDataFromCsv(
          {
            ...dataParamsInput,
            restaurantId: normalizedRestaurantId,
          },
          packagingOptions,
          {
            title: dataParamsInput.name,
            description: dataParamsInput.description,
            price: dataParamsInput.price,
            allergicIngredients: dataParamsInput.allergicIngredients,
            foodType: dataParamsInput.category,
            numberOfMainDishes: dataParamsInput.numberOfMainDishes,
            menuType: dataParamsInput.menuType,
            packaging: dataParamsInput.packaging,
            notes: dataParamsInput.note,
            'stir-fried-meal': dataParamsInput.stirFriedMeal,
            soup: dataParamsInput.soup,
            dessert: dataParamsInput.dessert,
            drink: dataParamsInput.drink,
            ...(!isPartner && dataParamsInput.extraFee ? { extraFee: dataParamsInput.extraFee } : {}),
          },
        );

        dataParams.images = imageIdHolder;

        const queryParams = {
          expand: true,
        };
        if (!isPartner) {
          // for admin endpoint
          // eslint-disable-next-line no-await-in-loop
          await partnerFoodApi.createFood({
            dataParams,
            queryParams,
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          await createPartnerFoodApi({
            dataParams,
            queryParams,
          });
        }

        // eslint-disable-next-line no-await-in-loop
        await sleep(500);

        setPreviewRecords((prev) =>
          prev.map((record, index) => {
            if (index === i) {
              return {
                ...record,
                status: 'success',
              };
            }

            return record;
          }),
        );
      } catch (error) {
        setPreviewRecords((prev) =>
          prev.map((record, index) => {
            if (index === i) {
              return {
                ...record,
                status: 'error',
              };
            }

            return record;
          }),
        );
        onImportError?.(error);
      }
    }

    setIsCreatingModeOn(false);
    setIsCreatingModeCompletedOneWayFlag(true);
    onImportSuccess?.();
  }, [
    normalizedRestaurantId,
    onImportError,
    onImportSuccess,
    packagingOptions,
    previewRecords,
    setPreviewRecords,
  ]);

  const resetImportState = useCallback(() => {
    setPreviewRecords([]);
    setIsCreatingModeOn(false);
    setIsCreatingModeCompletedOneWayFlag(false);
    setShouldFetchImages(false);
  }, []);

  return {
    previewRecords,
    setPreviewRecords,
    isCreatingModeOn,
    isCreatingModeCompletedOneWayFlag,
    numberOfCreatedRecords,
    totalRecords,
    handleFileChange,
    onImportFoodFromCsv,
    resetImportState,
  };
};
