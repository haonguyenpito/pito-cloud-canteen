/* eslint-disable @typescript-eslint/default-param-last */
/* eslint-disable no-useless-escape */
import compact from 'lodash/compact';
import isEmpty from 'lodash/isEmpty';
import toPairs from 'lodash/toPairs';
import uniq from 'lodash/uniq';

import { removeNonNumeric } from '@helpers/format';

import { printHoursToString } from './dates';
import { EDayOfWeek } from './enums';
import type { TAddress, TObject } from './types';

/**
 * Validator functions and helpers for Final Forms
 */

// Final Form expects and undefined value for a successful validation
export const VALID = undefined;

const isNonEmptyString = (val: string) => {
  return typeof val === 'string' && val.trim().length > 0;
};

export const required = (message: string) => (value: string) => {
  if (typeof value === 'undefined' || value === null) {
    // undefined or null values are invalid
    return message;
  }
  if (typeof value === 'string') {
    // string must be nonempty when trimmed
    return isNonEmptyString(value) ? VALID : message;
  }

  return VALID;
};

export const addressRequired = (message: string) => (value: TAddress) => {
  if (typeof value === 'undefined' || value === null) {
    // undefined or null values are invalid
    return message;
  }

  return isNonEmptyString(value.search) ? VALID : message;
};

export const requiredStringNoTrim = (message: string) => (value: string) => {
  return typeof value === 'string' && value.length > 0 ? VALID : message;
};

export const requiredFieldArrayCheckbox =
  (message: string) => (value: string) => {
    if (!value) {
      return message;
    }

    const entries = toPairs(value);
    const hasSelectedValues = entries.filter((e: any) => !!e[1]).length > 0;

    return hasSelectedValues ? VALID : message;
  };

export const minLength =
  (message: string, minimumLength: number) => (value: string) => {
    const hasLength = value && typeof value.length === 'number';

    return hasLength && value.length >= minimumLength ? VALID : message;
  };

export const taxLengthRequired = (message: string) => (value: string) => {
  const numberWithoutDash = value.split('-').join('');
  const hasOneDashNumber = value.length - numberWithoutDash.length;
  const hasInvalidChac =
    (value.includes('-') && Number.isNaN(Number(numberWithoutDash))) ||
    (!value.includes('-') && Number.isNaN(Number(value))) ||
    hasOneDashNumber > 1;
  if (hasInvalidChac) {
    return message;
  }
  const hasLength = value && typeof value.length === 'number';

  return hasLength && (value.length === 13 || value.length === 10)
    ? VALID
    : message;
};

export const maxLength =
  (message: string, maximumLength: number) => (value: string) => {
    if (!value) {
      return VALID;
    }
    const hasLength = value && typeof value.length === 'number';

    return hasLength && value.length <= maximumLength ? VALID : message;
  };

export const nonEmptyArray = (message: string) => (value: string[]) => {
  return value && Array.isArray(value) && value.length > 0 ? VALID : message;
};

export const autocompleteSearchRequired = (message: string) => (value: any) => {
  return value && value.search ? VALID : message;
};

export const autocompletePlaceSelected = (message: string) => (value: any) => {
  if (!value || !value?.search) {
    return VALID;
  }
  const selectedPlaceIsValid =
    value && value.selectedPlace && value.selectedPlace.address;

  return selectedPlaceIsValid ? VALID : message;
};

// Source: http://www.regular-expressions.info/email.html
// See the link above for an explanation of the tradeoffs.
export const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export const normalizeInviteEmail = (email: string) =>
  email.trim().toLowerCase();

export const normalizeInviteEmailList = (emails: string[]) =>
  uniq(compact(emails.map(normalizeInviteEmail)));

const PHONE_NUMBER_RE = /^(0[3|5|7|8|9])+([0-9]{8})$/;
const PWD_RE =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,16}$/;

export const emailFormatValid = (message: string) => (value: string) => {
  if (!value) return VALID;

  return value && EMAIL_RE.test(value) ? VALID : message;
};

export const emailListFormatValid =
  (message: string, separator = ' ') =>
  (value: string) => {
    if (!value) return VALID;

    const normalizeValue = value.trim().replace(/\s+/g, ' ');

    return value &&
      normalizeValue.split(separator).every((v) => EMAIL_RE.test(v))
      ? VALID
      : message;
  };
export const emailListValid =
  (message: string, restrictEmailList: string[], separator = ' ') =>
  (value: string) => {
    if (!value) return VALID;

    const normalizeValue = value.trim().replace(/\s+/g, ' ');

    return value &&
      normalizeValue
        .split(separator)
        .some((v) => !restrictEmailList.includes(v))
      ? VALID
      : message;
  };

export const passwordFormatValid = (message: string) => (value: string) => {
  return value && PWD_RE.test(value) ? VALID : message;
};

export const phoneNumberFormatValid = (message: string) => (value?: string) => {
  const hasValue = !!value || value === '';

  if (!hasValue) return VALID;

  return PHONE_NUMBER_RE.test(value) ? VALID : message;
};

export const passwordMatchConfirmPassword =
  (message: string) => (confirmPassword: string, allValues: TObject) => {
    return allValues &&
      allValues?.password &&
      allValues?.password === confirmPassword
      ? VALID
      : message;
  };

export const parseNum = (str: string) => {
  const num = Number.parseInt(str, 10);

  return Number.isNaN(num) ? null : num;
};

export const validBusinessURL = (message: string) => (value: string) => {
  if (typeof value === 'undefined' || value === null) {
    return message;
  }

  const disallowedChars = /[^-A-Za-z0-9+&@#/%?=~_|!:,.;()]/;
  const protocolTokens = value.split(':');
  const includesProtocol = protocolTokens.length > 1;
  const usesHttpProtocol =
    includesProtocol && !!protocolTokens[0].match(/^(https?)/);

  const invalidCharacters = !!value.match(disallowedChars);
  const invalidProtocol = !(usesHttpProtocol || !includesProtocol);
  // Stripe checks against example.com
  const isExampleDotCom = !!value.match(
    /^(https?:\/\/example\.com|example\.com)/,
  );
  const isLocalhost = !!value.match(
    /^(https?:\/\/localhost($|:|\/)|localhost($|:|\/))/,
  );

  return invalidCharacters || invalidProtocol || isExampleDotCom || isLocalhost
    ? message
    : VALID;
};

export const isInt = (message: string) => (value: any) => {
  return value === parseInt(value, 10) ? VALID : message;
};

export const numberMaxLength =
  (message: string, maximumLength: number, shouldPassIfEmpty = false) =>
  (value: number) => {
    const isValueEmpty = isEmpty(value?.toString());

    if (shouldPassIfEmpty && isValueEmpty) {
      return VALID;
    }

    const parsedValue = isValueEmpty
      ? 0
      : Number(removeNonNumeric(value.toString()));
    const isNumber = typeof parsedValue === 'number';

    return isNumber && parsedValue <= maximumLength ? VALID : message;
  };

export const numberMinLength =
  (message: string, minimumLength: number, shouldPassIfEmpty = false) =>
  (value: number) => {
    const isValueEmpty = isEmpty(value?.toString());

    if (shouldPassIfEmpty && isValueEmpty) {
      return VALID;
    }

    const parsedValue = isValueEmpty
      ? 0
      : Number(removeNonNumeric(value.toString()));
    const isNumber = typeof parsedValue === 'number';

    return isNumber && parsedValue >= minimumLength ? VALID : message;
  };

export const confirmPassword =
  (message: string, fieldNameToCompare: string) =>
  (value: string, allValues: any) => {
    return allValues[fieldNameToCompare] === value ? VALID : message;
  };

export const nonEmptyImage = (message: string) => (value: any) => {
  return value && (value.id || value.imageId) ? VALID : message;
};

export const nonEmptyImageArray = (message: string) => (value: any) => {
  return value &&
    Array.isArray(value) &&
    value.some((val) => val.id || val.imageId)
    ? VALID
    : message;
};

export const composeValidatorsWithAllValues =
  (...validators: any) =>
  (value: any, allValues: any, fieldState: any) =>
    validators.reduce(
      (error: any, validator: any) =>
        error || validator(value, allValues, fieldState),
      VALID,
    );

export const composeValidators =
  (...validators: any) =>
  (value: any) =>
    validators.reduce(
      (error: any, validator: any) => error || validator(value),
      VALID,
    );

export const validFacebookUrl = (message: string) => (value: string) => {
  if (!value) return VALID;
  const pattern =
    /^(?:(?:http|https):\/\/)?(?:www.)?facebook.com\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[?\w\-]*\/)?(?:profile.php\?id=(?=\d.*))?([\w\-]*)?$/;
  if (pattern.test(value)) {
    return VALID;
  }

  return message;
};

export const validURL = (message: string) => (str: string) => {
  if (!str) return VALID;
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$',
    'i',
  ); // fragment locator
  if (pattern.test(str)) {
    return VALID;
  }

  return message;
};

export const minPriceLength =
  (message: string, minimumLength: number) => (value: number | number) => {
    const removeComma = value?.toString().split('.') || [];
    const mergeWithoutComma = removeComma.join('');
    const parsedValue = Number(mergeWithoutComma);
    const isNumber = typeof parsedValue === 'number';

    return isNumber && parsedValue >= minimumLength ? VALID : message;
  };

export const numberWithCommas = (x: number) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parsePrice = (value: string = '') => {
  const removeComma = value.toString().replace(',', '.').split('.');
  const mergeWithoutComma = removeComma.join('');
  const parseNumber = Number(mergeWithoutComma);
  const isNotANumber =
    Number.isNaN(parseNumber) || typeof parseNumber !== 'number';

  return !isNotANumber ? numberWithCommas(parseNumber) : value;
};

export const nonNegativeValue = (message: string) => (value: number) => {
  return value <= 0 ? message : VALID;
};

export const timeToMinute = (timeInHour: string) => {
  if (!timeInHour) {
    return 0;
  }
  const timeParts = timeInHour.split(':');

  return Number(timeParts[0]) * 60 + Number(timeParts[1]);
};

export const nonConflictAvailabilityEntriesByDayOfWeek =
  (message: string) => (value: string, allValues: TObject, input: TObject) => {
    const [fieldName, dayOfWeekString] = input.name.split('.');
    const [dayOfWeek] = dayOfWeekString.split('[');
    const valueEntryIndex = Number(dayOfWeekString.match(/\d+/)?.[0]);
    const availabilityPlans = allValues[fieldName];
    let isConflict = false;
    Object.keys(availabilityPlans).forEach((k) => {
      if (Object.values(EDayOfWeek).includes(k as EDayOfWeek)) {
        availabilityPlans[k].forEach((entry: any, entryIndex: number) => {
          if (k === dayOfWeek) {
            const { startTime, endTime } = entry;
            const startTimeInMinutesToCompare = timeToMinute(startTime);
            const endTimeInMinutesToCompare = timeToMinute(endTime);
            const valueInMinute = timeToMinute(value);
            if (
              !isConflict &&
              valueEntryIndex !== Number(entryIndex) &&
              valueInMinute > startTimeInMinutesToCompare &&
              valueInMinute < endTimeInMinutesToCompare
            ) {
              isConflict = true;
            }
          }
        });
      }
    });

    return isConflict ? message : VALID;
  };

export const nonConflictAvailabilityEntries =
  (message: string) => (value: string, allValues: TObject, input: TObject) => {
    const [fieldNameString] = input.name.split('.');
    const [fieldName, entryIndexString] = fieldNameString.split('[');
    const valueEntryIndex = Number(entryIndexString.match(/\d+/)?.[0]);
    const allWeekAvailabilityEntries = allValues[fieldName];
    let isConflict = false;
    allWeekAvailabilityEntries.forEach((entry: any, index: number) => {
      const { startTime, endTime } = entry;
      const startTimeInMinutesToCompare = timeToMinute(startTime);
      const endTimeInMinutesToCompare = timeToMinute(endTime);
      const valueInMinute = timeToMinute(value);
      if (
        !isConflict &&
        valueEntryIndex !== Number(index) &&
        valueInMinute > startTimeInMinutesToCompare &&
        valueInMinute < endTimeInMinutesToCompare
      ) {
        isConflict = true;
      }
    });

    return isConflict ? message : VALID;
  };

export const validAvailabilityPlanEntries =
  (message: string) => (value: string) => {
    if (!value) return message;
    const time = value?.split(':')?.[1];
    if (time && Number(time) % 5 === 0) {
      return VALID;
    }

    return message;
  };

export const entriesStartAndEndIsDifferentOnEachDayOfWeek =
  (message: string) => (value: string, allValues: TObject, input: any) => {
    const [fieldName, dayOfWeekString, timeName] = input.name.split('.');
    const [dayOfWeek] = dayOfWeekString.split('[');
    const valueEntryIndex = Number(dayOfWeekString.match(/\d+/)?.[0]);

    const availabilityPlans = allValues[fieldName];
    let isConflict = false;
    Object.keys(availabilityPlans).forEach((k) => {
      if (Object.values(EDayOfWeek).includes(k as EDayOfWeek)) {
        availabilityPlans[k].forEach((entry: any, index: number) => {
          if (k === dayOfWeek && valueEntryIndex === index) {
            const { startTime, endTime } = entry;
            const startTimeInMinutesToCompare = timeToMinute(startTime);
            const endTimeInMinutesToCompare = timeToMinute(endTime);
            const valueInMinute = timeToMinute(value);
            isConflict =
              valueInMinute ===
              (timeName === 'startTime'
                ? endTimeInMinutesToCompare
                : startTimeInMinutesToCompare);
          }
        });
      }
    });

    return isConflict ? message : VALID;
  };

export const entriesStartAndEndIsDifferent =
  (message: string) => (value: string, allValues: TObject, input: any) => {
    const [fieldNameString, timeName] = input.name.split('.');
    const [fieldName, valueEntryIndexString] = fieldNameString.split('[');
    const valueEntryIndex = Number(valueEntryIndexString.match(/\d+/)?.[0]);

    const allWeekAvailabilityEntries = allValues[fieldName];
    let isConflict = false;
    allWeekAvailabilityEntries.forEach((entry: any, index: number) => {
      if (valueEntryIndex === index) {
        const { startTime, endTime } = entry;
        const startTimeInMinutesToCompare = timeToMinute(startTime);
        const endTimeInMinutesToCompare = timeToMinute(endTime);
        const valueInMinute = timeToMinute(value);
        isConflict =
          valueInMinute ===
          (timeName === 'startTime'
            ? endTimeInMinutesToCompare
            : startTimeInMinutesToCompare);
      }
    });

    return isConflict ? message : VALID;
  };

export const startTimeGreaterThanEndTimeOnEachDayOfWeek =
  (message: string) => (value: string, allValues: TObject, input: any) => {
    const [fieldName, dayOfWeekString, timeName] = input.name.split('.');
    const [dayOfWeek] = dayOfWeekString.split('[');
    const availabilityPlans = allValues[fieldName];
    let condition = false;
    const valueEntryIndex = Number(dayOfWeekString.match(/\d+/)?.[0]);

    Object.keys(availabilityPlans).forEach((k) => {
      if (Object.values(EDayOfWeek).includes(k as EDayOfWeek)) {
        availabilityPlans[k].forEach((entry: any, index: number) => {
          if (k === dayOfWeek && valueEntryIndex === index) {
            const { startTime, endTime } = entry;
            const startTimeInMinutesToCompare = timeToMinute(startTime);
            const endTimeInMinutesToCompare = timeToMinute(endTime);
            const valueInMinute = timeToMinute(value);
            condition =
              timeName === 'startTime'
                ? valueInMinute > endTimeInMinutesToCompare
                : valueInMinute < startTimeInMinutesToCompare;
          }
        });
      }
    });

    return condition ? message : VALID;
  };

export const startTimeGreaterThanEndTime =
  (message: string) => (value: string, allValues: TObject, input: any) => {
    const [fieldNameString, timeName] = input.name.split('.');
    const [fieldName, valueEntryIndexString] = fieldNameString.split('[');
    const valueEntryIndex = Number(valueEntryIndexString.match(/\d+/)?.[0]);

    const allWeekAvailabilityEntries = allValues[fieldName];
    let condition = false;
    allWeekAvailabilityEntries.forEach((entry: any, index: number) => {
      if (valueEntryIndex === index) {
        const { startTime, endTime } = entry;
        const startTimeInMinutesToCompare = timeToMinute(startTime);
        const endTimeInMinutesToCompare = timeToMinute(endTime);
        const valueInMinute = timeToMinute(value);
        condition =
          timeName === 'startTime'
            ? valueInMinute > endTimeInMinutesToCompare
            : valueInMinute < startTimeInMinutesToCompare;
      }
    });

    return condition ? message : VALID;
  };

export const minTimeValidate =
  (message: string, minVal: string) => (value: string) => {
    return timeToMinute(value) >= timeToMinute(minVal) ? VALID : message;
  };

export const maxTimeValidate =
  (message: string, maxVal: string) => (value: string) => {
    return timeToMinute(value) <= timeToMinute(maxVal) ? VALID : message;
  };
export const nonSatOrSunDay = (message: string) => (value: number) => {
  const dayOfWeek = new Date(value).getDay();

  return dayOfWeek === 6 || dayOfWeek === 0 ? message : VALID;
};

export const greaterThanOneThousand = (message: string) => (value: number) => {
  return value < 1000 ? message : VALID;
};

export const greaterThanZero = (message: string) => (value: number) => {
  return value <= 0 ? message : VALID;
};

export const parseAvailabilityEntries = (time: Date) => {
  const minutes = time.getMinutes();
  const hours = time.getHours();

  return printHoursToString(hours, minutes);
};

export const validFoodTitle = (message: string) => (value: string) => {
  const format = /[`!@#$%^&*_+\-=\[\]{};':"\\|,.<>\/?~]/;

  return format.test(value) ? message : VALID;
};

export const upperCaseFirstLetter = (value: string) => {
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const validateNonEnterInputField =
  (message: string) => (value: string, allValues: TObject) => {
    const { tempValue } = allValues;

    return tempValue ? message : VALID;
  };

export const valueLessThanMax =
  (message: string, maxNameField: string) =>
  (value: string, allValues: TObject) => {
    const maxFieldValue = allValues?.[maxNameField] || 0;

    return value > maxFieldValue ? message : VALID;
  };

export const valueGreaterThanMin =
  (message: string, minNameField: string) =>
  (value: string, allValues: TObject) => {
    const maxFieldValue = allValues?.[minNameField] || 0;

    return value < maxFieldValue ? message : VALID;
  };

export const foodByDatesAtLeastOneDayHasFood =
  (message: string, daysOfWeek: string[]) => (value: TObject) => {
    let valid = true;

    if (daysOfWeek.length !== Object.keys(value || {}).length) {
      return message;
    }

    Object.keys(value || {}).forEach((k) => {
      if (Object.keys(value[k]).length <= 0) {
        valid = false;
      }
    });

    return valid ? VALID : message;
  };

export const replaceSpaceByCommas = (value: string) => {
  return value.replace(/ /g, ',');
};

export const emailsWithCommasValid = (message: string) => (value: string) => {
  if (!value) return VALID;
  const emails = compact(value.split(','));
  const validEmails = emails.filter((email) => {
    return email.trim().match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
  });

  return validEmails.length === emails.length ? VALID : message;
};
