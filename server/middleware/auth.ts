import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { resolveSession, SESSION_COOKIE, type DbUser } from '../lib/session';
import { ApiError } from './errors';

export type AppEnv = { Variables: { user: DbUser | null } };

export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = resolveSession(getCookie(c, SESSION_COOKIE));
  c.set('user', user);
  await next();
});

export async function requireUser(c: {
  get: (key: 'user') => DbUser | null;
}): Promise<DbUser> {
  const user = c.get('user');
  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', '请先登录');
  }
  if (user.is_banned) {
    throw new ApiError(403, 'BANNED', '账号已被封禁');
  }
  return user;
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  await requireUser(c);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = await requireUser(c);
  if (!user.is_admin) {
    throw new ApiError(403, 'FORBIDDEN', '需要管理员权限');
  }
  await next();
});
