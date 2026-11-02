import { Hono } from 'hono';
import { z } from 'zod';
import type { AiSettingsDTO } from '../../shared/types';
import { db } from '../db/index';
import { testAiConnection } from '../lib/ai';
import { aiKeyHint, getAiConfig, isAiConfigured, saveAiConfig } from '../lib/ai-config';
import { evaluationCooldown, schedule } from '../lib/evaluation-queue';
import { getWeekRange } from '../lib/week';
import { firstIssue, likePattern, parsePage } from '../lib/validate';
import { requireAdmin, requireUser, type AppEnv } from '../middleware/auth';
import { ApiError, validationError } from '../middleware/errors';
import { enforceRateLimit } from '../middleware/rate-limit';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', requireAdmin);

const PAGE_LIMIT = 20;

const statusBodySchema = z.object({ status: z.enum(['published', 'hidden']) });
const banBodySchema = z.object({ banned: z.boolean() });

function countRows(sql: string, ...params: (string | number)[]): number {
  return (db.query(sql).get(...params) as { c: number }).c;
}

adminRoutes.get('/stats', (c) => {
  const weekStart = getWeekRange().start;

  const evalCounts = { pending: 0, running: 0, done: 0, failed: 0 };
  const evalRows = db
    .query('SELECT status, COUNT(*) AS c FROM evaluations GROUP BY status')
    .all() as { status: keyof typeof evalCounts; c: number }[];
  for (const row of evalRows) {
    if (row.status in evalCounts) evalCounts[row.status] = row.c;
  }

  const recentProjects = db
    .query(
      `SELECT p.id, p.title, p.repo_full_name AS repoFullName, p.status, p.created_at AS createdAt,
              u.login AS ownerLogin
       FROM projects p JOIN users u ON u.id = p.user_id
       ORDER BY p.id DESC LIMIT 5`,
    )
    .all();

  const recentUsers = db
    .query(
      `SELECT u.id, u.login, u.avatar_url AS avatarUrl, u.created_at AS createdAt,
              (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projectCount
       FROM users u ORDER BY u.id DESC LIMIT 5`,
    )
    .all();

  return c.json({
    users: countRows('SELECT COUNT(*) AS c FROM users'),
    projects: countRows('SELECT COUNT(*) AS c FROM projects'),
    publishedProjects: countRows("SELECT COUNT(*) AS c FROM projects WHERE status = 'published'"),
    hiddenProjects: countRows("SELECT COUNT(*) AS c FROM projects WHERE status = 'hidden'"),
    starsTotal: countRows('SELECT COUNT(*) AS c FROM star_events'),
    starsWeek: countRows('SELECT COUNT(*) AS c FROM star_events WHERE star_given_at >= ?', weekStart),
    evaluations: evalCounts,
    recentProjects,
    recentUsers,
  });
});

adminRoutes.get('/projects', (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 100);
  const status = c.req.query('status') ?? 'all';
  const page = parsePage(c.req.query('page'), 10_000);
  const weekStart = getWeekRange().start;

  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (q) {
    const like = likePattern(q);
    conditions.push(
      "(p.title LIKE ? ESCAPE '\\' OR p.repo_full_name LIKE ? ESCAPE '\\' OR u.login LIKE ? ESCAPE '\\')",
    );
    args.push(like, like, like);
  }
  if (status === 'published' || status === 'hidden') {
    conditions.push('p.status = ?');
    args.push(status);
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const items = db
    .query(
      `SELECT p.id, p.title, p.repo_full_name AS repoFullName, p.status, p.created_at AS createdAt,
              u.id AS ownerId, u.login AS ownerLogin,
              (SELECT COUNT(*) FROM star_events s WHERE s.project_id = p.id) AS totalStars,
              (SELECT COUNT(*) FROM star_events s WHERE s.project_id = p.id AND s.star_given_at >= ?) AS weekStars,
              e.status AS evalStatus, e.total_score AS evalTotal, e.is_heuristic AS evalHeuristic,
              e.model AS evalModel, e.error AS evalError
       FROM projects p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN evaluations e ON e.id = (
         SELECT id FROM evaluations WHERE project_id = p.id ORDER BY id DESC LIMIT 1
       )
       ${whereSql}
       ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    )
    .all(weekStart, ...args, PAGE_LIMIT, (page - 1) * PAGE_LIMIT);

  const total = countRows(
    `SELECT COUNT(*) AS c FROM projects p JOIN users u ON u.id = p.user_id ${whereSql}`,
    ...args,
  );

  return c.json({ items, total, page, pageSize: PAGE_LIMIT });
});

adminRoutes.post('/projects/:id{[0-9]+}/status', async (c) => {
  const adminId = c.get('user')!.id;
  enforceRateLimit(adminId, 'admin:mutate', 120, 60 * 60 * 1000);
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => null);
  const parsed = statusBodySchema.safeParse(body);
  if (!parsed.success) throw validationError(firstIssue(parsed.error));

  const existing = db.query('SELECT id FROM projects WHERE id = ?').get(id) as {
    id: number;
  } | null;
  if (!existing) throw new ApiError(404, 'NOT_FOUND', '项目不存在');

  db.query('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(
    parsed.data.status,
    new Date().toISOString(),
    id,
  );
  return c.json({ ok: true });
});

adminRoutes.post('/projects/:id{[0-9]+}/reevaluate', (c) => {
  const adminId = c.get('user')!.id;
  enforceRateLimit(adminId, 'admin:reevaluate', 30, 60 * 60 * 1000);
  const id = Number.parseInt(c.req.param('id'), 10);
  const existing = db.query('SELECT id FROM projects WHERE id = ?').get(id) as {
    id: number;
  } | null;
  if (!existing) throw new ApiError(404, 'NOT_FOUND', '项目不存在');

  const force = c.req.query('force') === '1';

  const result = db.transaction(
    (): { blocked: string } | { evaluationId: number; forced: boolean } => {
      const cooldownUntil = evaluationCooldown(id);
      if (cooldownUntil && !force) return { blocked: cooldownUntil };

      const ai = getAiConfig();
      const row = db
        .query(
          `INSERT INTO evaluations (project_id, status, model) VALUES (?, 'pending', ?) RETURNING id`,
        )
        .get(id, ai.apiKey ? ai.model : 'heuristic') as { id: number };
      return { evaluationId: row.id, forced: cooldownUntil !== null };
    },
  )();

  if ('blocked' in result) {
    throw new ApiError(
      429,
      'EVALUATION_COOLDOWN',
      `该项目本周已评估，${result.blocked.slice(0, 10)} 后可再次评估（管理员可用 ?force=1 强制）`,
      { nextEvaluationAt: result.blocked },
    );
  }

  schedule(result.evaluationId);
  return c.json({ evaluationId: result.evaluationId, forced: result.forced });
});

adminRoutes.get('/users', (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 100);
  const page = parsePage(c.req.query('page'), 10_000);

  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (q) {
    const like = likePattern(q);
    conditions.push("(u.login LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
    args.push(like, like);
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const items = db
    .query(
      `SELECT u.id, u.login, u.name, u.avatar_url AS avatarUrl, u.is_admin AS isAdmin,
              u.is_banned AS isBanned, u.created_at AS createdAt,
              (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projectCount,
              (SELECT COUNT(*) FROM star_events s WHERE s.user_id = u.id) AS starsGiven
       FROM users u ${whereSql}
       ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, PAGE_LIMIT, (page - 1) * PAGE_LIMIT);

  const total = countRows(`SELECT COUNT(*) AS c FROM users u ${whereSql}`, ...args);

  return c.json({ items, total, page, pageSize: PAGE_LIMIT });
});

adminRoutes.post('/users/:id{[0-9]+}/ban', async (c) => {
  const admin = await requireUser(c);
  enforceRateLimit(admin.id, 'admin:mutate', 120, 60 * 60 * 1000);
  const targetId = Number.parseInt(c.req.param('id'), 10);
  if (targetId === admin.id) throw validationError('不能封禁自己');

  const body = await c.req.json().catch(() => null);
  const parsed = banBodySchema.safeParse(body);
  if (!parsed.success) throw validationError(firstIssue(parsed.error));

  const existing = db.query('SELECT id FROM users WHERE id = ?').get(targetId) as {
    id: number;
  } | null;
  if (!existing) throw new ApiError(404, 'NOT_FOUND', '用户不存在');

  if (parsed.data.banned) {
    db.query('UPDATE users SET is_banned = 1 WHERE id = ?').run(targetId);
    db.query('DELETE FROM sessions WHERE user_id = ?').run(targetId);
    db.query("UPDATE projects SET status = 'hidden', updated_at = ? WHERE user_id = ?").run(
      new Date().toISOString(),
      targetId,
    );
  } else {
    db.query('UPDATE users SET is_banned = 0 WHERE id = ?').run(targetId);
  }

  return c.json({ ok: true });
});

adminRoutes.get('/evaluations', (c) => {
  const status = c.req.query('status') ?? '';
  const page = parsePage(c.req.query('page'), 10_000);

  const valid = status === 'pending' || status === 'running' || status === 'done' || status === 'failed';
  const whereSql = valid ? 'WHERE e.status = ?' : '';
  const args: (string | number)[] = valid ? [status] : [];

  const items = db
    .query(
      `SELECT e.id, e.project_id AS projectId, p.title AS projectTitle, e.status, e.model,
              e.is_heuristic AS isHeuristic, e.total_score AS totalScore, e.error,
              e.attempt_count AS attemptCount, e.created_at AS createdAt, e.updated_at AS updatedAt
       FROM evaluations e JOIN projects p ON p.id = e.project_id
       ${whereSql}
       ORDER BY e.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, PAGE_LIMIT, (page - 1) * PAGE_LIMIT);

  const total = countRows(`SELECT COUNT(*) AS c FROM evaluations e ${whereSql}`, ...args);

  return c.json({ items, total, page, pageSize: PAGE_LIMIT });
});

const aiSettingsSchema = z.object({
  baseUrl: z.string().trim().max(300).optional(),
  apiKey: z.string().trim().max(500).optional(),
  model: z.string().trim().max(100).optional(),
});

function describeAiSettings(): AiSettingsDTO {
  const config = getAiConfig();
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    hasApiKey: config.apiKey.length > 0,
    apiKeyHint: aiKeyHint(config.apiKey),
    sources: config.sources,
  };
}

adminRoutes.get('/settings/ai', (c) => c.json(describeAiSettings()));

adminRoutes.put('/settings/ai', async (c) => {
  const adminId = c.get('user')!.id;
  enforceRateLimit(adminId, 'admin:ai-config', 30, 60 * 60 * 1000);
  const body = await c.req.json().catch(() => null);
  const parsed = aiSettingsSchema.safeParse(body);
  if (!parsed.success) throw validationError(firstIssue(parsed.error));
  const { baseUrl, apiKey, model } = parsed.data;

  if (baseUrl) {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw validationError('接口地址必须是合法 URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw validationError('接口地址必须是 http(s) 链接');
    }
    if (url.username || url.password) throw validationError('接口地址不能包含用户名或密码');
  }

  saveAiConfig({ baseUrl, apiKey, model });
  return c.json(describeAiSettings());
});

adminRoutes.post('/settings/ai/test', async (c) => {
  const adminId = c.get('user')!.id;
  enforceRateLimit(adminId, 'admin:ai-test', 20, 60 * 60 * 1000);
  if (!isAiConfigured()) throw new ApiError(400, 'AI_NOT_CONFIGURED', '请先填写并保存 API Key');
  try {
    const result = await testAiConnection();
    return c.json({ ok: true, ...result });
  } catch (error) {
    throw new ApiError(502, 'AI_TEST_FAILED', (error as Error).message.slice(0, 300));
  }
});
