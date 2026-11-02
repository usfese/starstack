import { Hono } from 'hono';
import type { ProjectDetail } from '../../shared/types';
import { db } from '../db/index';
import { getAiConfig } from '../lib/ai-config';
import { decryptToken } from '../lib/crypto';
import { evaluationCooldown, schedule } from '../lib/evaluation-queue';
import {
  fetchRepo,
  githubErrorMessage,
  GitHubError,
  isOrgAdmin,
  type RepoMeta,
} from '../lib/github';
import {
  mapProjectRow,
  PROJECT_LIST_COLUMNS,
  PROJECT_LIST_FROM,
  type ProjectListRow,
} from '../lib/projects';
import { getWeekRange } from '../lib/week';
import {
  editProjectSchema,
  firstIssue,
  likePattern,
  normalizeDemoUrl,
  parseRepoInput,
  projectListQuerySchema,
  submitProjectSchema,
} from '../lib/validate';
import { requireUser, type AppEnv } from '../middleware/auth';
import { ApiError, validationError } from '../middleware/errors';
import { enforceRateLimit } from '../middleware/rate-limit';

export const projectRoutes = new Hono<AppEnv>();

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DETAIL_SYNC_TIMEOUT_MS = 4_000;

// 同一仓库的并发刷新合并成一次外呼，避免详情页被反复点击时打爆 GitHub。
const repoRefreshInFlight = new Map<string, Promise<RepoMeta>>();

const ORDER_BY: Record<string, string> = {
  latest: 'p.created_at DESC, p.id DESC',
  stars_week: 'week_stars DESC, COALESCE(total_score, -1) DESC, p.created_at DESC',
  score: 'COALESCE(total_score, -1) DESC, week_stars DESC, p.created_at DESC',
  needs: 'total_stars ASC, COALESCE(total_score, -1) DESC, p.created_at DESC',
};

projectRoutes.get('/', (c) => {
  const parsed = projectListQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw validationError(firstIssue(parsed.error));
  const { sort, q, tag, page, pageSize } = parsed.data;

  const viewerId = c.get('user')?.id ?? null;
  const weekStart = getWeekRange().start;
  const like = q ? likePattern(q) : null;

  const conditions: string[] = ["p.status = 'published'"];
  const args: (string | number)[] = [];

  if (tag) {
    conditions.push('EXISTS(SELECT 1 FROM json_each(p.tags) WHERE json_each.value = ?)');
    args.push(tag);
  }
  if (like) {
    conditions.push(
      "(p.title LIKE ? ESCAPE '\\' OR p.repo_full_name LIKE ? ESCAPE '\\' OR p.intro_md LIKE ? ESCAPE '\\')",
    );
    args.push(like, like, like);
  }
  if (sort === 'needs') {
    conditions.push('(SELECT COUNT(*) FROM star_events s WHERE s.project_id = p.id) < 10');
    if (viewerId !== null) {
      conditions.push('p.user_id != ?');
      args.push(viewerId);
      conditions.push(
        'NOT EXISTS(SELECT 1 FROM star_events s2 WHERE s2.project_id = p.id AND s2.user_id = ?)',
      );
      args.push(viewerId);
    }
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;

  const items = db
    .query(
      `SELECT ${PROJECT_LIST_COLUMNS} ${PROJECT_LIST_FROM} ${whereSql}
       ORDER BY ${ORDER_BY[sort] ?? ORDER_BY.latest} LIMIT ? OFFSET ?`,
    )
    .all(weekStart, viewerId ?? -1, ...args, pageSize, offset)
    .map((row) => mapProjectRow(row as ProjectListRow, viewerId));

  const totalRow = db
    .query(
      `SELECT COUNT(*) AS c FROM projects p JOIN users u ON u.id = p.user_id ${whereSql}`,
    )
    .get(...args) as { c: number };

  return c.json({ items, total: totalRow.c, page, pageSize });
});

projectRoutes.get('/:id{[0-9]+}', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const viewer = c.get('user');
  const weekStart = getWeekRange().start;

  const row = db
    .query(
      `SELECT ${PROJECT_LIST_COLUMNS} ${PROJECT_LIST_FROM} WHERE p.id = ?`,
    )
    .get(weekStart, viewer?.id ?? -1, id) as ProjectListRow | null;

  if (!row) throw new ApiError(404, 'NOT_FOUND', '项目不存在');

  const isOwner = viewer !== null && viewer.id === row.user_id;
  const isAdmin = viewer !== null && viewer.is_admin === 1;
  if (row.status === 'hidden' && !isOwner && !isAdmin) {
    throw new ApiError(404, 'NOT_FOUND', '项目不存在');
  }

  let repoMissing = false;
  const syncedAt = row.repo_synced_at ? Date.parse(row.repo_synced_at) : Number.NaN;
  const needsSync = !Number.isFinite(syncedAt) || Date.now() - syncedAt > SYNC_INTERVAL_MS;

  if (needsSync) {
    const key = `${row.repo_owner}/${row.repo_name}`.toLowerCase();
    let pending = repoRefreshInFlight.get(key);
    if (!pending) {
      pending = fetchRepo(row.repo_owner, row.repo_name, DETAIL_SYNC_TIMEOUT_MS).finally(() =>
        repoRefreshInFlight.delete(key),
      );
      repoRefreshInFlight.set(key, pending);
    }

    const now = new Date().toISOString();
    try {
      const repo = await pending;
      if (repo.private) {
        repoMissing = true;
        db.query('UPDATE projects SET repo_synced_at = ? WHERE id = ?').run(now, id);
      } else {
        row.repo_meta = JSON.stringify(repo);
        row.repo_synced_at = now;
        db.query('UPDATE projects SET repo_meta = ?, repo_synced_at = ? WHERE id = ?').run(
          row.repo_meta,
          now,
          id,
        );
      }
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) {
        repoMissing = true;
      } else {
        console.error(`[星栈] 刷新项目 ${id} 的仓库信息失败：`, githubErrorMessage(error));
      }
      // 失败也记为一次尝试，6 小时内不再对外呼 GitHub 重试。
      db.query('UPDATE projects SET repo_synced_at = ? WHERE id = ?').run(now, id);
    }
  }

  const latestEval = db
    .query('SELECT status FROM evaluations WHERE project_id = ? ORDER BY id DESC LIMIT 1')
    .get(id) as { status: ProjectDetail['evaluationStatus'] } | null;

  const base = mapProjectRow(row, viewer?.id ?? null);
  const detail: ProjectDetail = {
    ...base,
    introMd: row.intro_md,
    demoUrl: row.demo_url,
    repoMissing,
    evaluationStatus: latestEval?.status ?? null,
  };
  return c.json(detail);
});

projectRoutes.post('/', async (c) => {
  const user = await requireUser(c);
  enforceRateLimit(user.id, 'project:create', 5, 60 * 60 * 1000);

  const body = await c.req.json().catch(() => null);
  if (body === null || typeof body !== 'object') throw validationError('请求格式不正确');

  const parsed = submitProjectSchema.safeParse(body);
  if (!parsed.success) throw validationError(firstIssue(parsed.error));
  const { repo, title, intro, tags } = parsed.data;

  const demoUrl = normalizeDemoUrl(parsed.data.demoUrl);
  if (demoUrl === 'invalid') throw validationError('演示地址必须是 http(s) 链接');

  const ref = parseRepoInput(repo);
  if (!ref) throw validationError('仓库格式应为 owner/repo 或 https://github.com/owner/repo');

  let repoMeta;
  try {
    repoMeta = await fetchRepo(ref.owner, ref.name);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) {
      throw validationError('仓库不存在或无权访问');
    }
    throw new ApiError(502, 'GITHUB_ERROR', githubErrorMessage(error));
  }

  if (repoMeta.private) throw validationError('仅支持公开仓库');
  if (repoMeta.fork) throw validationError('不支持提交 fork 仓库');

  if (user.is_admin !== 1 && repoMeta.ownerLogin.toLowerCase() !== user.login.toLowerCase()) {
    if (!user.access_token_enc) {
      throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
    }

    let token: string;
    try {
      token = decryptToken(user.access_token_enc);
    } catch {
      throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
    }

    let orgAdmin = false;
    try {
      orgAdmin = await isOrgAdmin(token, repoMeta.ownerLogin);
    } catch (error) {
      if (error instanceof GitHubError && error.status === 401) {
        throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
      }
      throw new ApiError(502, 'GITHUB_ERROR', githubErrorMessage(error));
    }

    if (!orgAdmin) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        '只能提交自己名下或你担任管理员的组织仓库（组织仓库可能需要重新登录授权 read:org）',
      );
    }
  }

  const existing = db
    .query('SELECT id FROM projects WHERE repo_full_name = ?')
    .get(repoMeta.fullName) as { id: number } | null;
  if (existing) throw new ApiError(409, 'CONFLICT', '该仓库已被提交');

  const now = new Date().toISOString();
  let inserted: { id: number };
  try {
    inserted = db
      .query(
        `INSERT INTO projects
           (user_id, repo_owner, repo_name, repo_full_name, title, intro_md, demo_url, tags,
            status, repo_meta, repo_synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?) RETURNING id`,
      )
      .get(
        user.id,
        repoMeta.ownerLogin,
        repoMeta.name,
        repoMeta.fullName,
        title,
        intro,
        demoUrl,
        JSON.stringify(tags),
        JSON.stringify(repoMeta),
        now,
        now,
        now,
      ) as { id: number };
  } catch (error) {
    if ((error as Error).message.includes('UNIQUE')) {
      throw new ApiError(409, 'CONFLICT', '该仓库已被提交');
    }
    throw error;
  }

  const ai = getAiConfig();
  const evaluation = db
    .query(
      `INSERT INTO evaluations (project_id, status, model) VALUES (?, 'pending', ?) RETURNING id`,
    )
    .get(inserted.id, ai.apiKey ? ai.model : 'heuristic') as { id: number };

  schedule(evaluation.id);
  return c.json({ id: inserted.id }, 201);
});

projectRoutes.patch('/:id{[0-9]+}', async (c) => {
  const user = await requireUser(c);
  enforceRateLimit(user.id, 'project:edit', 20, 60 * 60 * 1000);

  const id = Number.parseInt(c.req.param('id'), 10);
  const project = db.query('SELECT id, user_id FROM projects WHERE id = ?').get(id) as {
    id: number;
    user_id: number;
  } | null;
  if (!project) throw new ApiError(404, 'NOT_FOUND', '项目不存在');
  if (project.user_id !== user.id && user.is_admin !== 1) {
    throw new ApiError(403, 'FORBIDDEN', '只能编辑自己的项目');
  }

  const body = await c.req.json().catch(() => null);
  if (body === null || typeof body !== 'object') throw validationError('请求格式不正确');

  const parsed = editProjectSchema.safeParse(body);
  if (!parsed.success) throw validationError(firstIssue(parsed.error));
  const data = parsed.data;

  const updates: string[] = [];
  const args: (string | null)[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    args.push(data.title);
  }
  if (data.intro !== undefined) {
    updates.push('intro_md = ?');
    args.push(data.intro);
  }
  if (data.demoUrl !== undefined) {
    const demoUrl = normalizeDemoUrl(data.demoUrl);
    if (demoUrl === 'invalid') throw validationError('演示地址必须是 http(s) 链接');
    updates.push('demo_url = ?');
    args.push(demoUrl);
  }
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    args.push(JSON.stringify(data.tags));
  }

  updates.push('updated_at = ?');
  args.push(new Date().toISOString());

  const result = db.transaction(
    (): { updated: boolean; evaluationId: number | null; cooldownUntil: string | null } => {
      const info = db.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...args, id);
      if (info.changes === 0) return { updated: false, evaluationId: null, cooldownUntil: null };

      const cooldownUntil = evaluationCooldown(id);
      if (cooldownUntil) return { updated: true, evaluationId: null, cooldownUntil };

      const ai = getAiConfig();
      const row = db
        .query(
          `INSERT INTO evaluations (project_id, status, model) VALUES (?, 'pending', ?) RETURNING id`,
        )
        .get(id, ai.apiKey ? ai.model : 'heuristic') as { id: number };
      return { updated: true, evaluationId: row.id, cooldownUntil: null };
    },
  )();

  if (!result.updated) throw new ApiError(404, 'NOT_FOUND', '项目不存在');
  if (result.evaluationId !== null) schedule(result.evaluationId);

  return c.json({
    ok: true,
    evaluationQueued: result.evaluationId !== null,
    ...(result.cooldownUntil ? { nextEvaluationAt: result.cooldownUntil } : {}),
  });
});

projectRoutes.delete('/:id{[0-9]+}', async (c) => {
  const user = await requireUser(c);
  enforceRateLimit(user.id, 'project:delete', 10, 60 * 60 * 1000);
  const id = Number.parseInt(c.req.param('id'), 10);
  const project = db.query('SELECT id, user_id FROM projects WHERE id = ?').get(id) as {
    id: number;
    user_id: number;
  } | null;
  if (!project) throw new ApiError(404, 'NOT_FOUND', '项目不存在');
  if (project.user_id !== user.id && user.is_admin !== 1) {
    throw new ApiError(403, 'FORBIDDEN', '只能删除自己的项目');
  }

  db.query('DELETE FROM projects WHERE id = ?').run(id);
  return c.body(null, 204);
});
