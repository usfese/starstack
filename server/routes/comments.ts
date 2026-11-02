import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type {
  CommentCreateResponse,
  CommentDTO,
  CommentsResponse,
} from '../../shared/types';
import { db } from '../db/index';
import { requireUser, type AppEnv } from '../middleware/auth';
import { ApiError, validationError } from '../middleware/errors';
import { enforceRateLimit } from '../middleware/rate-limit';

export const commentRoutes = new Hono<AppEnv>();

const commentBodySchema = z.object({
  content: z.string().trim().min(1, '评论不能为空').max(1000, '评论最多 1000 个字'),
});

interface ProjectRow {
  id: number;
  user_id: number;
  status: 'published' | 'hidden';
}

interface CommentRow {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  authorIsAdmin: number;
}

function getVisibleProject(c: Context<AppEnv>, projectId: number): ProjectRow {
  const project = db
    .query('SELECT id, user_id, status FROM projects WHERE id = ?')
    .get(projectId) as ProjectRow | null;
  if (!project) throw new ApiError(404, 'NOT_FOUND', '项目不存在');

  const viewer = c.get('user');
  const canSeeHidden =
    viewer !== null && (viewer.is_admin === 1 || viewer.id === project.user_id);
  if (project.status === 'hidden' && !canSeeHidden) {
    throw new ApiError(404, 'NOT_FOUND', '项目不存在');
  }
  return project;
}

function mapComment(row: CommentRow, viewerId: number | null, viewerIsAdmin: boolean): CommentDTO {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    author: {
      id: row.userId,
      login: row.login,
      name: row.name,
      avatarUrl: row.avatarUrl,
      isAdmin: row.authorIsAdmin === 1,
    },
    canDelete: viewerId !== null && (viewerId === row.userId || viewerIsAdmin),
  };
}

commentRoutes.get('/:id{[0-9]+}/comments', (c) => {
  const projectId = Number.parseInt(c.req.param('id'), 10);
  getVisibleProject(c, projectId);

  const pageRaw = Number.parseInt(c.req.query('page') ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const sizeRaw = Number.parseInt(c.req.query('pageSize') ?? '20', 10);
  const pageSize = Number.isFinite(sizeRaw) ? Math.min(50, Math.max(1, sizeRaw)) : 20;

  const viewer = c.get('user');
  const rows = db
    .query(
      `SELECT c.id, c.content, c.created_at AS createdAt, c.user_id AS userId,
              u.login, u.name, u.avatar_url AS avatarUrl, u.is_admin AS authorIsAdmin
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.project_id = ?
       ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    )
    .all(projectId, pageSize, (page - 1) * pageSize) as CommentRow[];

  const totalRow = db
    .query('SELECT COUNT(*) AS c FROM comments WHERE project_id = ?')
    .get(projectId) as { c: number } | null;
  const total = totalRow?.c ?? 0;

  const payload: CommentsResponse = {
    items: rows.map((row) => mapComment(row, viewer?.id ?? null, viewer?.is_admin === 1)),
    total,
    page,
    pageSize,
  };
  return c.json(payload);
});

commentRoutes.post('/:id{[0-9]+}/comments', async (c) => {
  const user = await requireUser(c);
  enforceRateLimit(user.id, 'comment:create', 20, 60 * 60 * 1000);

  const projectId = Number.parseInt(c.req.param('id'), 10);
  getVisibleProject(c, projectId);

  const body = await c.req.json().catch(() => null);
  if (body === null || typeof body !== 'object') throw validationError('请求格式不正确');
  const parsed = commentBodySchema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error.issues[0]?.message ?? '评论内容不正确');

  const content = parsed.data.content;
  const createdAt = new Date().toISOString();
  const inserted = db
    .query(
      `INSERT INTO comments (project_id, user_id, content, created_at)
       VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .get(projectId, user.id, content, createdAt) as { id: number };

  const payload: CommentCreateResponse = {
    comment: {
      id: inserted.id,
      content,
      createdAt,
      author: {
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        isAdmin: user.is_admin === 1,
      },
      canDelete: true,
    },
  };
  return c.json(payload, 201);
});

commentRoutes.delete('/:id{[0-9]+}/comments/:commentId{[0-9]+}', async (c) => {
  const user = await requireUser(c);
  const projectId = Number.parseInt(c.req.param('id'), 10);
  const commentId = Number.parseInt(c.req.param('commentId'), 10);

  const comment = db
    .query('SELECT id, user_id FROM comments WHERE id = ? AND project_id = ?')
    .get(commentId, projectId) as { id: number; user_id: number } | null;
  if (!comment) throw new ApiError(404, 'NOT_FOUND', '评论不存在');
  if (comment.user_id !== user.id && user.is_admin !== 1) {
    throw new ApiError(403, 'FORBIDDEN', '只能删除自己的评论');
  }

  db.query('DELETE FROM comments WHERE id = ?').run(commentId);
  return c.body(null, 204);
});
