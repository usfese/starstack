import { createMiddleware } from 'hono/factory';
import { env } from '../env';
import { ApiError } from './errors';

const SAFE_METHOD: Record<string, true> = { GET: true, HEAD: true, OPTIONS: true };

export const csrfProtection = createMiddleware(async (c, next) => {
  if (!SAFE_METHOD[c.req.method]) {
    const origin = c.req.header('origin');
    if (!origin || origin !== env.frontendOrigin) {
      throw new ApiError(403, 'CSRF', '请求来源校验失败，请刷新页面后重试');
    }
  }
  await next();
});
