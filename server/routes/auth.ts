import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { db } from '../db/index';
import { env, isAdminLogin } from '../env';
import { encryptToken, randomToken, safeEqualString, sha256Hex } from '../lib/crypto';
import { exchangeCode, fetchUser, githubErrorMessage } from '../lib/github';
import {
  createSession,
  destroySession,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
  type DbUser,
} from '../lib/session';
import { ApiError } from '../middleware/errors';
import { optionalAuth, requireAuth, type AppEnv } from '../middleware/auth';

export const authRoutes = new Hono<AppEnv>();

const STATE_TTL_SECONDS = 600;

function stateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: STATE_TTL_SECONDS,
    secure: env.isProduction,
  };
}

function readUser(id: number): DbUser {
  return db
    .query(
      `SELECT id, github_id, login, name, avatar_url, access_token_enc, is_admin, is_banned,
              created_at, last_login_at FROM users WHERE id = ?`,
    )
    .get(id) as DbUser;
}

function upsertUserRow(input: {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  tokenEnc: string;
}): DbUser {
  const isAdmin = isAdminLogin(input.login) ? 1 : 0;
  const lastLoginAt = new Date().toISOString();
  const existing = db.query('SELECT id FROM users WHERE github_id = ?').get(input.githubId) as {
    id: number;
  } | null;

  if (existing) {
    db.query(
      `UPDATE users SET login = ?, name = ?, avatar_url = ?, access_token_enc = ?,
         is_admin = ?, last_login_at = ? WHERE id = ?`,
    ).run(
      input.login,
      input.name,
      input.avatarUrl,
      input.tokenEnc,
      isAdmin,
      lastLoginAt,
      existing.id,
    );
    return readUser(existing.id);
  }

  const inserted = db
    .query(
      `INSERT INTO users (github_id, login, name, avatar_url, access_token_enc, is_admin, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      input.githubId,
      input.login,
      input.name,
      input.avatarUrl,
      input.tokenEnc,
      isAdmin,
      lastLoginAt,
    ) as { id: number };
  return readUser(inserted.id);
}

/**
 * login 在 users 表上是 UNIQUE COLLATE NOCASE，但身份按 github_id 认定。
 * 老用户改名后旧名可能被他人注册，此时新用户 INSERT 会撞唯一约束；
 * 把占用该名字的历史账号改名成 old:<github_id> 后重试一次即可登录。
 */
function upsertUser(input: {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  tokenEnc: string;
}): DbUser {
  try {
    return upsertUserRow(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('UNIQUE') || !message.includes('users.login')) throw error;
    db.query("UPDATE users SET login = 'old:' || github_id WHERE login = ? AND github_id != ?").run(
      input.login,
      input.githubId,
    );
    return upsertUserRow(input);
  }
}

function startSession(c: Parameters<typeof setCookie>[0], user: DbUser) {
  const token = createSession(user.id);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions());
}

authRoutes.get('/github', (c) => {
  if (!env.githubClientId) {
    return c.json({ error: 'CONFIG', message: 'GitHub OAuth 未配置' }, 500);
  }

  const state = randomToken(32);
  setCookie(c, OAUTH_STATE_COOKIE, state, stateCookieOptions());

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.githubClientId);
  url.searchParams.set('redirect_uri', env.oauthCallbackUrl);
  url.searchParams.set('state', state);
  // 只读组织成员关系，用于判断组织仓库提交者是否为组织管理员。
  url.searchParams.set('scope', 'read:org');
  return c.redirect(url.toString(), 302);
});

authRoutes.get('/github/callback', async (c) => {
  const expectedState = getCookie(c, OAUTH_STATE_COOKIE);
  const state = c.req.query('state') ?? '';
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });

  if (!expectedState || !state || !safeEqualString(expectedState, state)) {
    return c.redirect(`${env.frontendUrl}/login?error=state`, 302);
  }

  const code = c.req.query('code');
  if (!code) {
    return c.redirect(`${env.frontendUrl}/login?error=oauth`, 302);
  }

  try {
    const accessToken = await exchangeCode(code, env.oauthCallbackUrl);
    const ghUser = await fetchUser(accessToken);
    const user = upsertUser({
      githubId: ghUser.id,
      login: ghUser.login,
      name: ghUser.name,
      avatarUrl: ghUser.avatarUrl,
      tokenEnc: encryptToken(accessToken),
    });

    if (user.is_banned) {
      return c.redirect(`${env.frontendUrl}/login?error=banned`, 302);
    }

    startSession(c, user);
    return c.redirect(`${env.frontendUrl}/`, 302);
  } catch (error) {
    console.error('[星栈] GitHub OAuth 登录失败：', error);
    const message = error instanceof ApiError ? error.message : githubErrorMessage(error);
    console.error(`[星栈] 原因：${message}`);
    return c.redirect(`${env.frontendUrl}/login?error=oauth`, 302);
  }
});

authRoutes.get('/dev/login', (c) => {
  if (!env.devFakeGithub || env.isProduction) {
    throw new ApiError(404, 'NOT_FOUND', '接口不存在');
  }

  const login = (c.req.query('login') ?? '').trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) {
    throw new ApiError(400, 'VALIDATION', 'login 参数不合法');
  }

  const githubId = -Number.parseInt(sha256Hex(login).slice(0, 8), 16);
  const user = upsertUser({
    githubId,
    login,
    name: login,
    avatarUrl: `https://github.com/identicons/${login}.png`,
    tokenEnc: encryptToken('dev'),
  });

  if (user.is_banned) {
    return c.redirect(`${env.frontendUrl}/login?error=banned`, 302);
  }

  startSession(c, user);
  return c.redirect(`${env.frontendUrl}/`, 302);
});

authRoutes.post('/logout', optionalAuth, requireAuth, (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  destroySession(token);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});
