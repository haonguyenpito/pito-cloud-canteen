import { useCallback, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { importMenuExtraFeesApi } from '@apis/menuApi';

export type TMenuExtraFeeImportRecord = {
  menuTitle?: string;
  foodName?: string;
  extraFee?: string;
  status?: 'ok' | 'error';
  error?: string;
};

/** Excel header → record key. Headers are NFC-normalised before lookup. */
const NAME_TO_KEY_ADAPTER: Record<string, keyof TMenuExtraFeeImportRecord> = {
  'Thực đơn': 'menuTitle',
  'Món ăn': 'foodName',
  'Phụ phí (Vnđ)': 'extraFee',
  // The food-import template spells it "Phí phụ thu"; accept both.
  'Phí phụ thu (Vnđ)': 'extraFee',
};

type TUseMenuExtraFeeImportPreviewOptions = {
  onImportSuccess?: () => void;
};

export const useMenuExtraFeeImportPreview = ({
  onImportSuccess,
}: TUseMenuExtraFeeImportPreviewOptions = {}) => {
  const [previewRecords, setPreviewRecords] = useState<
    TMenuExtraFeeImportRecord[]
  >([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImported, setIsImported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validRecords = useMemo(
    () => previewRecords.filter((record) => record.status === 'ok'),
    [previewRecords],
  );

  const invalidRecords = useMemo(
    () => previewRecords.filter((record) => record.status === 'error'),
    [previewRecords],
  );

  const reset = useCallback(() => {
    setPreviewRecords([]);
    setIsImported(false);
    setError(null);
  }, []);

  const handleFileChange = useCallback((event: any) => {
    event.stopPropagation();
    event.preventDefault();

    const targetFiles = event?.dataTransfer?.files?.length
      ? [...event.dataTransfer.files]
      : [...(event.target?.files || [])];

    if (!targetFiles.length) return;

    setPreviewRecords([]);
    setIsImported(false);
    setError(null);

    const excelFile = targetFiles[targetFiles.length - 1];

    const reader = new FileReader();

    reader.onload = async (loadEvent) => {
      try {
        const data = new Uint8Array(loadEvent.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        // Accept a "Template" sheet like the food import, else the first sheet.
        const sheet =
          workbook.Sheets.Template ?? workbook.Sheets[workbook.SheetNames[0]];

        const sheetRecords = XLSX.utils.sheet_to_json(sheet) as Record<
          string,
          string
        >[];

        const rows = sheetRecords
          .map((sheetRecord) => {
            const record: TMenuExtraFeeImportRecord = {};

            Object.keys(sheetRecord).forEach((key) => {
              const adapterKey = NAME_TO_KEY_ADAPTER[key.normalize('NFC')];

              if (adapterKey) {
                (record as Record<string, unknown>)[adapterKey] =
                  sheetRecord[key];
              }
            });

            return record;
          })
          .filter((record) => record.menuTitle || record.foodName);

        if (!rows.length) {
          setError(
            'Không đọc được dòng nào. Kiểm tra tiêu đề cột: Thực đơn / Món ăn / Phụ phí (Vnđ).',
          );

          return;
        }

        // Validate before showing anything — nothing is written yet.
        setIsValidating(true);
        const response = await importMenuExtraFeesApi({ rows, dryRun: true });
        setPreviewRecords(response.data?.results || []);
      } catch (parseError) {
        setError(
          (parseError as Error)?.message || 'Không đọc được tệp Excel này',
        );
      } finally {
        setIsValidating(false);
        // Let the same file be picked again after a failed attempt.
        // eslint-disable-next-line no-param-reassign
        if (event.target) event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(excelFile);
  }, []);

  const handleImport = useCallback(async () => {
    if (!validRecords.length) return;

    setIsImporting(true);
    setError(null);

    try {
      const response = await importMenuExtraFeesApi({
        rows: validRecords.map(({ menuTitle, foodName, extraFee }) => ({
          menuTitle,
          foodName,
          extraFee,
        })),
        dryRun: false,
      });

      setPreviewRecords(response.data?.results || []);
      setIsImported(true);
      onImportSuccess?.();
    } catch (importError) {
      setError((importError as Error)?.message || 'Import phụ phí thất bại');
    } finally {
      setIsImporting(false);
    }
  }, [validRecords, onImportSuccess]);

  return {
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
  };
};
