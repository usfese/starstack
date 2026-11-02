import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = (payload ?? {}) as { error?: unknown; message?: unknown };
    const code = typeof body.error === 'string' ? body.error : 'HTTP_ERROR';
    const message =
      typeof body.message === 'string' ? body.message : `请求失败（${response.status}）`;
    throw new ApiError(response.status, code, message);
  }

  return payload as T;
}

export interface ApiState<T> {
  data: T | null;
  /** 仅当还没有任何数据时为 true（首屏骨架），后续刷新不再闪白。 */
  loading: boolean;
  /** 有请求在飞行中（含首屏）。 */
  isFetching: boolean;
  error: ApiError | null;
  refresh: () => void;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '未知错误';
}

export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isFetching, setIsFetching] = useState(path !== null);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (path === null) {
      setData(null);
      setError(null);
      setIsFetching(false);
      return;
    }

    // 换 path 时保留旧数据，只用一个 in-flight 标记表达加载态，避免防抖搜索闪白。
    const controller = new AbortController();
    setError(null);
    setIsFetching(true);

    api<T>(path, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK', errorMessage(err)));
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsFetching(false);
      });

    return () => controller.abort();
  }, [path, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  // loading 只在「一次请求已发出但还没有任何数据」时为真，后续刷新不再闪白。
  return { data, loading: data === null && isFetching, isFetching, error, refresh };
}
