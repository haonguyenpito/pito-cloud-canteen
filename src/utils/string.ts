import type { TProfile } from '@src/utils/types';

export const splitNameFormFullName = (fullName?: string) => {
  if (!fullName) {
    return {
      lastName: 'Người dùng',
      firstName: 'chưa đặt tên',
    };
  }

  const nonEmptyNames = fullName.split(' ').filter((name) => !!name); // Remove empty string

  const firstName = nonEmptyNames.pop();

  if (!firstName) {
    return {
      lastName: 'Người dùng',
      firstName: 'chưa đặt tên',
    };
  }

  let lastName = nonEmptyNames.join(' ');

  if (!lastName) {
    lastName = firstName; // lastName is required, if lastName === firstName, it means the user has only one name
  }

  return {
    lastName,
    firstName,
  };
};

export const removeAccents = (str: string) => {
  return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
};

export const capitalize = (str: string) => {
  const arr = str.split(' ');
  for (let i = 0; i < arr.length; i++) {
    arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
  }
  const str2 = arr.join(' ');

  return str2;
};

export const NON_ACCENT_VIETNAMESE_CONVERTERS_CHAR_CODE = [
  {
    to: 'a',
    from: '\u00E0|\u00E1|\u1EA1|\u1EA3|\u00E3|\u00E2|\u1EA7|\u1EA5|\u1EAD|\u1EA9|\u1EAB|\u0103|\u1EB1|\u1EAF|\u1EB7|\u1EB3|\u1EB5',
  },
  {
    to: 'e',
    from: '\u00E8|\u00E9|\u1EB9|\u1EBB|\u1EBD|\u00EA|\u1EC1|\u1EBF|\u1EC7|\u1EC3|\u1EC5',
  },
  { to: 'i', from: '\u00EC|\u00ED|\u1ECB|\u1EC9|\u0129' },
  {
    to: 'o',
    from: '\u00F2|\u00F3|\u1ECD|\u1ECF|\u00F5|\u00F4|\u1ED3|\u1ED1|\u1ED9|\u1ED5|\u1ED7|\u01A1|\u1EDD|\u1EDB|\u1EE3|\u1EDF|\u1EE1',
  },
  {
    to: 'u',
    from: '\u00F9|\u00FA|\u1EE5|\u1EE7|\u0169|\u01B0|\u1EEB|\u1EE9|\u1EF1|\u1EED|\u1EEF',
  },
  { to: 'y', from: '\u1EF3|\u00FD|\u1EF5|\u1EF7|\u1EF9' },
  { to: 'd', from: '\u0111' },
  // Huyền sắc hỏi ngã nặng
  { to: '', from: '\u0300|\u0301|\u0303|\u0309|\u0323' },
  { to: '', from: '\u02C6|\u0306|\u031B' },
];

const NON_ACCENT_VIETNAMESE_CONVERTERS = [
  { to: 'a', from: 'à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ' },
  { to: 'e', from: 'è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ' },
  { to: 'i', from: 'ì|í|ị|ỉ|ĩ' },
  { to: 'o', from: 'ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ' },
  { to: 'u', from: 'ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ' },
  { to: 'y', from: 'ỳ|ý|ỵ|ỷ|ỹ' },
  { to: 'd', from: 'đ' },
  // Huyền sắc hỏi ngã nặng
  { to: '', from: '\u0300|\u0301|\u0303|\u0309|\u0323' },
  { to: '', from: '\u02C6|\u0306|\u031B' },
];

// This function converts the string to lowercase, then perform the conversion
export const toNonAccentVietnamese = (
  str: string,
  shouldLowCase = false,
  convertors = NON_ACCENT_VIETNAMESE_CONVERTERS,
) => {
  if (!str || typeof str !== 'string') return '';

  let text = shouldLowCase ? str.toLowerCase() : str;

  convertors.forEach(({ from, to }) => {
    text = text.replace(new RegExp(`[${from}]`, 'gi'), to);
  });

  return text;
};

export const getFullName = (profile?: TProfile) => {
  if (!profile) return 'Anh/Chị';

  const { firstName, lastName } = profile;

  const formatName = (name: unknown) =>
    typeof name === 'string' ? name.trim() : '';

  const fullName = [formatName(lastName), formatName(firstName)]
    .join(' ')
    .trim();

  return fullName || 'Anh/Chị';
};

const DECORATORS: string[] = [
  '/static/loading-asset-1.png',
  '/static/loading-asset-2.png',
  '/static/loading-asset-3.png',
  '/static/loading-asset-4.png',
];

export const getDecorator = (id: string): string => {
  if (!id) return DECORATORS[0];
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return DECORATORS[hash % DECORATORS.length];
};
