import { Hono } from 'hono';
import type { UserDTO } from '../../shared/types';
import { db } from '../db/index';
import {
  mapProjectRow,
  PROJECT_LIST_COLUMNS,
  PROJECT_LIST_FROM,
  type ProjectListRow,
} from '../lib/projects';
import type { DbUser } from '../lib/session';
import { getWeekRange } from '../lib/week';
import { requireUser, type AppEnv } from '../middleware/auth';

export const meRoutes = new Hono<AppEnv>();

export function toUserDTO(user: DbUser): UserDTO {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    isAdmin: user.is_admin === 1,
    createdAt: user.created_at,
  };
}

meRoutes.get('/', (c) => {
  const user = c.get('user');
  if (!user || user.is_banned) {
    return c.json({ user: null });
  }

  const projects = db
    .query('SELECT COUNT(*) AS c FROM projects WHERE user_id = ?')
    .get(user.id) as { c: number };
  const starsGiven = db
    .query('SELECT COUNT(*) AS c FROM star_events WHERE user_id = ?')
    .get(user.id) as { c: number };
  const starsReceived = db
    .query(
      'SELECT COUNT(*) AS c FROM star_events se JOIN projects p ON p.id = se.project_id WHERE p.user_id = ?',
    )
    .get(user.id) as { c: number };

  return c.json({
    user: toUserDTO(user),
    stats: {
      projects: projects.c,
      starsGiven: starsGiven.c,
      starsReceived: starsReceived.c,
    },
  });
});

meRoutes.get('/projects', async (c) => {
  const user = await requireUser(c);
  const weekStart = getWeekRange().start;

  const rows = db
    .query(
      `SELECT ${PROJECT_LIST_COLUMNS} ${PROJECT_LIST_FROM}
       WHERE p.user_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    )
    .all(weekStart, user.id, user.id) as ProjectListRow[];

  return c.json({ items: rows.map((row) => mapProjectRow(row, user.id)) });
});

meRoutes.get('/stars', async (c) => {
  const user = await requireUser(c);

  const rows = db
    .query(
      `SELECT se.project_id AS projectId, p.title, p.repo_full_name AS repoFullName,
              u.login AS ownerLogin, se.star_given_at AS starGivenAt
       FROM star_events se
       JOIN projects p ON p.id = se.project_id
       JOIN users u ON u.id = p.user_id
       WHERE se.user_id = ? AND p.status = 'published'
       ORDER BY se.star_given_at DESC
       LIMIT 200`,
    )
    .all(user.id);

  return c.json({ items: rows });
});
