import { Hono } from 'hono';
import { db } from '../db/index';
import { decryptToken } from '../lib/crypto';
import { githubErrorMessage, GitHubError, isStarred } from '../lib/github';
import { getWeekRange } from '../lib/week';
import { requireUser, type AppEnv } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { enforceRateLimit } from '../middleware/rate-limit';

export const starRoutes = new Hono<AppEnv>();

function starCounts(projectId: number): { weekStars: number; totalStars: number } {
  const weekStart = getWeekRange().start;
  const week = db
    .query('SELECT COUNT(*) AS c FROM star_events WHERE project_id = ? AND star_given_at >= ?')
    .get(projectId, weekStart) as { c: number };
  const total = db
    .query('SELECT COUNT(*) AS c FROM star_events WHERE project_id = ?')
    .get(projectId) as { c: number };
  return { weekStars: week.c, totalStars: total.c };
}

starRoutes.post('/:id{[0-9]+}/star/verify', async (c) => {
  const user = await requireUser(c);
  enforceRateLimit(user.id, 'star:verify', 10, 10 * 60 * 1000);

  const id = Number.parseInt(c.req.param('id'), 10);
  const project = db
    .query(
      `SELECT id, user_id, repo_owner, repo_name, status FROM projects WHERE id = ?`,
    )
    .get(id) as {
    id: number;
    user_id: number;
    repo_owner: string;
    repo_name: string;
    status: string;
  } | null;

  if (!project || project.status !== 'published') {
    throw new ApiError(404, 'NOT_FOUND', '项目不存在');
  }
  if (project.user_id === user.id) {
    throw new ApiError(400, 'VALIDATION', '不能给自己的项目点 Star');
  }

  const existing = db
    .query('SELECT id FROM star_events WHERE user_id = ? AND project_id = ?')
    .get(user.id, id) as { id: number } | null;
  if (existing) {
    return c.json({ verified: true, already: true, ...starCounts(id) });
  }

  if (!user.access_token_enc) {
    throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
  }

  let token: string;
  try {
    token = decryptToken(user.access_token_enc);
  } catch (error) {
    console.error('[星栈] 解密 GitHub token 失败：', (error as Error).message);
    throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
  }

  let starred: boolean;
  try {
    starred = await isStarred(token, project.repo_owner, project.repo_name);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 401) {
      throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
    }
    throw new ApiError(502, 'GITHUB_ERROR', githubErrorMessage(error));
  }

  if (!starred) {
    throw new ApiError(409, 'NOT_STARRED', '未检测到 Star，请先在 GitHub 上 Star 后重试');
  }

  try {
    db.query(
      'INSERT INTO star_events (user_id, project_id, star_given_at) VALUES (?, ?, ?)',
    ).run(user.id, id, new Date().toISOString());
  } catch (error) {
    if (!(error as Error).message.includes('UNIQUE')) throw error;
    return c.json({ verified: true, already: true, ...starCounts(id) });
  }

  return c.json({ verified: true, already: false, ...starCounts(id) });
});
