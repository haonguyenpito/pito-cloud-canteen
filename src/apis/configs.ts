import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

import cookies from '@services/cookie';
import type { TObject } from '@utils/types';

const inFlightRequests = new Map<string, Promise<any>>();

const getRequestKey = (config: AxiosRequestConfig): string => {
  const { method, url, params, data } = config;

  return JSON.stringify({ method, url, params, data });
};

export const fetchWithDedup = <T = any>(
  axiosInstance: AxiosInstance,
  config: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  const key = getRequestKey(config);

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<AxiosResponse<T>>;
  }

  const requestPromise = axiosInstance(config)
    .then((res) => res as AxiosResponse<T>)
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, requestPromise);

  return requestPromise;
};

export const apiBaseUrl = () => {
  const port = process.env.NEXT_PUBLIC_PORT || 3000;
  const useDevApiServer =
    (process.env.NODE_ENV === 'development' ||
      process.env.ENVIRONMENT === 'development') &&
    !!port;

  // In development, the dev API server is running in a different port
  if (useDevApiServer) {
    return `http://localhost:${port}/api`;
  }

  // Otherwise, use the same domain and port as the frontend
  return `${window.location.origin}/api`;
};

export const getApi = <T = any>(
  path: string,
  params: TObject = {},
  options: { signal?: AbortSignal } = {}, // hỗ trợ huỷ bằng AbortController
): Promise<AxiosResponse<T>> => {
  // get 'JSONParams' in req.query, remember using JSON.parse()
  // to convert JSONParams into params

  return axios.get(`${apiBaseUrl()}${path}`, {
    ...(params ? { params: { JSONParams: JSON.stringify(params) } } : {}),
    signal: options.signal,
  });
};

export const getDedupApi = <T = any>(path: string, params: TObject = {}) => {
  return fetchWithDedup<T>(axios, {
    method: 'GET',
    url: `${apiBaseUrl()}${path}`,
    params: {
      ...(params ? { JSONParams: JSON.stringify(params) } : {}),
    },
  });
};

export const postApi = <T = any>(
  path: string,
  body: TObject = {},
  options: { signal?: AbortSignal } = {},
): Promise<AxiosResponse<T>> => {
  return axios.post(`${apiBaseUrl()}${path}`, body, {
    signal: options.signal, // ✅ hỗ trợ huỷ bằng AbortController
  });
};

export const putApi = <T = any>(path: string, body: TObject = {}) => {
  return axios.put<T>(`${apiBaseUrl()}${path}`, body);
};

export const patchApi = <T = any>(
  path: string,
  body: TObject = {},
  options: { signal?: AbortSignal } = {},
): Promise<AxiosResponse<T>> => {
  return axios.patch<T>(`${apiBaseUrl()}${path}`, body, {
    signal: options.signal,
  });
};

export const deleteApi = (path: string, data: TObject = {}) => {
  // get any keys of data in req.body
  return axios.delete(`${apiBaseUrl()}${path}`, { data });
};

export type TBodyParams = {
  dataParams: TObject;
  queryParams: TObject;
};

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
}

type TApiCheckerFunction = (
  handler: NextApiHandler,
) => (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | void;

export const composeApiCheckers =
  (...checkers: TApiCheckerFunction[]) =>
  (handler: NextApiHandler) => {
    const handlerWithCookies = cookies(handler);

    checkers.forEach((checker) => checker(handlerWithCookies));

    return handlerWithCookies;
  };
