import type { Context } from 'hono';

export class ApiError extends Error {
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502;
  code: string;
  details?: unknown;
  retryAfter?: number;

  constructor(
    status: ApiError['status'],
    code: string,
    message: string,
    details?: unknown,
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export const validationError = (message: string, details?: unknown) =>
  new ApiError(400, 'VALIDATION', message, details);

export const notFound = (message = '资源不存在') => new ApiError(404, 'NOT_FOUND', message);
export const unauthorized = (message = '请先登录') =>
  new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = '没有权限执行该操作', code = 'FORBIDDEN') =>
  new ApiError(403, code, message);

export function errorResponse(c: Context, error: ApiError) {
  if (error.retryAfter) c.header('Retry-After', String(error.retryAfter));
  return c.json(
    {
      error: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    error.status as 400,
  );
}

export function errorHandler(error: Error, c: Context) {
  if (error instanceof ApiError) {
    return errorResponse(c, error);
  }
  console.error('[星栈] 未处理异常：', error);
  return c.json({ error: 'INTERNAL', message: '服务器内部错误' }, 500);
}
