import { db } from '../db/index';
import { env } from '../env';
import { randomToken, sha256Hex } from './crypto';

export const SESSION_COOKIE = 'starstack_sid';
export const OAUTH_STATE_COOKIE = 'starstack_oauth_state';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface DbUser {
  id: number;
  github_id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  access_token_enc: string | null;
  is_admin: number;
  is_banned: number;
  created_at: string;
  last_login_at: string | null;
}

const USER_COLUMNS = `u.id, u.github_id, u.login, u.name, u.avatar_url, u.access_token_enc,
  u.is_admin, u.is_banned, u.created_at, u.last_login_at`;

export function createSession(userId: number): string {
  const token = randomToken(32);
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  db.query('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').run(
    userId,
    new Date().toISOString(),
  );
  db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    tokenHash,
    userId,
    expiresAt,
  );
  return token;
}

export function resolveSession(token: string | undefined): DbUser | null {
  if (!token) return null;
  const row = db
    .query(
      `SELECT ${USER_COLUMNS}
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256Hex(token), new Date().toISOString()) as DbUser | null;
  return row ?? null;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db.query('DELETE FROM sessions WHERE token_hash = ?').run(sha256Hex(token));
}

export function destroyUserSessions(userId: number): void {
  db.query('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function pruneExpiredSessions(): void {
  db.query('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    secure: env.isProduction,
  };
}
