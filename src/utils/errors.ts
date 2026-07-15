/**
 * ================ API error handling utilities ================
 *
 * This module exports helpers that can be used to check if API
 * response errors are some specific error cases.
 *
 * NOTE: most of the functions are tied to an endpoint, and should not
 * be used to check error responses from any other endpoint. Check the
 * name and the docstring of the function to ensure correct usage.
 */

import { EErrorCode } from './enums';
import type { TError, TSharetribeFlexSdkApiError } from './types';

export enum EHttpStatusCode {
  Continue = 100,
  SwitchingProtocols = 101,
  Processing = 102,
  EarlyHints = 103,
  Ok = 200,
  Created = 201,
  Accepted = 202,
  NonAuthoritativeInformation = 203,
  NoContent = 204,
  ResetContent = 205,
  PartialContent = 206,
  MultiStatus = 207,
  AlreadyReported = 208,
  ImUsed = 226,
  MultipleChoices = 300,
  MovedPermanently = 301,
  Found = 302,
  SeeOther = 303,
  NotModified = 304,
  UseProxy = 305,
  Unused = 306,
  TemporaryRedirect = 307,
  PermanentRedirect = 308,
  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  ProxyAuthenticationRequired = 407,
  RequestTimeout = 408,
  Conflict = 409,
  Gone = 410,
  LengthRequired = 411,
  PreconditionFailed = 412,
  PayloadTooLarge = 413,
  UriTooLong = 414,
  UnsupportedMediaType = 415,
  RangeNotSatisfiable = 416,
  ExpectationFailed = 417,
  ImATeapot = 418,
  MisdirectedRequest = 421,
  UnprocessableEntity = 422,
  Locked = 423,
  FailedDependency = 424,
  TooEarly = 425,
  UpgradeRequired = 426,
  PreconditionRequired = 428,
  TooManyRequests = 429,
  RequestHeaderFieldsTooLarge = 431,
  UnavailableForLegalReasons = 451,
  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
  HttpVersionNotSupported = 505,
  VariantAlsoNegotiates = 506,
  InsufficientStorage = 507,
  LoopDetected = 508,
  NotExtended = 510,
  NetworkAuthenticationRequired = 511,
}

const errorAPIErrors = (error: TError) => {
  return error && error.apiErrors ? error.apiErrors : [];
};

const hasErrorWithCode = (error: TError, code: string) => {
  return errorAPIErrors(error).some((apiError: TSharetribeFlexSdkApiError) => {
    return apiError.code === code;
  });
};

/**
 * return apiErrors from error response
 */
const responseAPIErrors = (error: any) => {
  return error && error.data && error.data.errors ? error.data.errors : [];
};

/**
 * Check if the given API error (from `sdk.currentuser.create()`) is
 * due to the email address already being in use.
 */
export const isSignUpEmailTakenError = (error: TError) =>
  hasErrorWithCode(error, EErrorCode.emailTaken);

/**
 * Check if the given API error (from `sdk.currentuser.changeEmail()`) is
 * due to the email address already being in use.
 */
export const isChangeEmailTakenError = (error: TError) =>
  hasErrorWithCode(error, EErrorCode.emailTaken);

/**
 * Check if the given API error (from
 * `sdk.currentUser.sendVerificationEmail()`) is due to too many
 * active email verification requests.
 *
 * There qre only a specific amount of active verification requests
 * allowed, and the user has to wait for them to expire to be able to
 * request sending new verification emails.
 */
export const isTooManyEmailVerificationRequestsError = (error: TError) =>
  hasErrorWithCode(error, EErrorCode.tooManyVerificationRequests);

/**
 * Check if the given API error (from
 * `sdk.images.upload()`) is due to the image being over
 * the size limit.
 */
export const isUploadImageOverLimitError = (error: TError) =>
  hasErrorWithCode(error, EErrorCode.uploadOverLimit);

/**
 * Check if the given API error (from `sdk.passwordReset.request()`)
 * is due to no user having the given email address.
 */
export const isPasswordRecoveryEmailNotFoundError = (error: TError) =>
  hasErrorWithCode(error, EErrorCode.emailNotFound);

/**
 * Check if the given API error (from `sdk.transaction.initiate()` or
 * `sdk.transaction.initiateSpeculative()`) is due to the listing
 * being closed or deleted.
 */
export const isTransactionInitiateListingNotFoundError = (error: TError) =>
  hasErrorWithCode(error, EErrorCode.transactionListingNotFound);

/**
 * Check if the given API error (from `sdk.transaction.initiate()` or
 * `sdk.transaction.initiateSpeculative()`) is due to missign Stripe
 * connection from the listing author.
 */
export const isTransactionInitiateMissingStripeAccountError = (error: TError) =>
  hasErrorWithCode(error, EErrorCode.missingStripeAccount);

/**
 * Check if the given API error (from `sdk.transaction.initiate()` or
 * `sdk.transaction.initiateSpeculative()`) is due to selected booking
 * time already being booked.
 */
export const isTransactionInitiateBookingTimeNotAvailableError = (
  error: TError,
) => hasErrorWithCode(error, EErrorCode.transactionBookingTimeNotAvailable);

/**
 * Check if the given API error (from `sdk.transaction.initiate()` or
 * `sdk.transaction.initiateSpeculative()`) is due to payment being zero.
 */
export const isTransactionZeroPaymentError = (error: TError) =>
  hasErrorWithCode(error, EErrorCode.chargeZeroPayin);

/**
 * Check if the given API error (from `sdk.transactions.transition(id, transition, params)`)
 * is due to invalid transition attempt.
 */
export const isTransactionsTransitionInvalidTransition = (error: TError) =>
  error &&
  error.status === 409 &&
  hasErrorWithCode(error, EErrorCode.transactionInvalidTransition);

/**
 * Check if the given API error (from `sdk.transactions.transition(id, transition, params)`)
 * is due to already sent review.
 */
export const isTransactionsTransitionAlreadyReviewed = (error: TError) =>
  error &&
  error.status === 409 &&
  (hasErrorWithCode(error, EErrorCode.transactionAlreadyReviewedByCustomer) ||
    hasErrorWithCode(error, EErrorCode.transactionAlreadyReviewedByProvider));

/**
 * Check if the given API error (from `sdk.currentUser.changeEmail(params)`)
 * is due to giving wrong password.
 */
export const isChangeEmailWrongPassword = (error: TError) =>
  error && error.status === 403;

/**
 * Check if the given API error (from `transfer-owner`) is due to the new owner already being a company user.
 */

export const isNewOwnerAlreadyACompanyUser = (error: TError) => {
  return (
    error && hasErrorWithCode(error, EErrorCode.newOwnerAlreadyACompanyUser)
  );
};

// Check if the given API error (from `transfer-owner`) is due to booker is in a order progress.*/

export const isBookerInOrderProgress = (error: TError) => {
  return error && hasErrorWithCode(error, EErrorCode.bookerInOrderProgress);
};

/**
 * The account lock is an app-level flag (`metadata.isDisabled`), not a
 * Sharetribe error, so it arrives as an Error whose `name` we set ourselves
 * rather than in `apiErrors`.
 */
export const isAccountDisabledError = (error: TError) =>
  !!error &&
  (error.name === EErrorCode.accountDisabled ||
    hasErrorWithCode(error, EErrorCode.accountDisabled));

/**
 * Check if the given API error (from `sdk.currentUser.changePassword(params)`)
 * is due to giving wrong password.
 */
export const isChangePasswordWrongPassword = (error: TError) =>
  error && error.status === 403;

export const storableError = (error: any): TError => {
  const err = error || {};
  console.error({ error });
  const { name, message, status, statusText } = err;
  // Status, statusText, and data.errors are (possibly) added to the error object by SDK
  const apiErrors = responseAPIErrors(err);

  // Returned object is the same as prop type check in util/types -> error
  return {
    type: 'error',
    name,
    message,
    status,
    statusText,
    apiErrors,
  };
};

export const storableAxiosError = (error: any): TError => {
  const errorData = error?.response?.data;
  const err = errorData || {};
  const { name, status, message, statusText, data } = err;
  const { message: messageInData } = data || {};
  // Status, statusText, and data.errors are (possibly) added to the error object by SDK
  const apiErrors = responseAPIErrors(err);

  // Returned object is the same as prop type check in util/types -> error
  return {
    type: 'error',
    name,
    message: messageInData || message,
    status,
    statusText,
    apiErrors,
  };
};

export const responseApiErrorInfo = (error: TError) =>
  responseAPIErrors(error).map((e: any) => ({
    status: e.status,
    code: e.code,
    meta: e.meta,
  }));
