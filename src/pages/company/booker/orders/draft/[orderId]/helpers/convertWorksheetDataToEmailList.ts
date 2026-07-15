import compact from 'lodash/compact';
import uniq from 'lodash/uniq';

import { EMAIL_RE } from '@src/utils/validators';

export const convertWorksheetDataToEmailList = (data: any[]) => {
  const normalizedEmailList = compact(
    data.map((d) => {
      const rowData = d?.[0]?.toString().trim().toLowerCase();
      if (rowData && EMAIL_RE.test(rowData)) return rowData;

      return undefined;
    }),
  );
  if (
    normalizedEmailList.length === 0 ||
    data.length !== normalizedEmailList.length
  ) {
    return { isFileValid: false, emailList: uniq(normalizedEmailList) };
  }

  return { isFileValid: true, emailList: uniq(normalizedEmailList) };
};
