import type { Dimensions, EvalSummary, ProjectListItem } from '../../shared/types';

export interface ProjectListRow {
  id: number;
  user_id: number;
  repo_owner: string;
  repo_name: string;
  repo_full_name: string;
  title: string;
  intro_md: string;
  demo_url: string | null;
  tags: string;
  status: 'published' | 'hidden';
  repo_meta: string;
  repo_synced_at: string | null;
  created_at: string;
  updated_at: string;
  owner_login: string;
  owner_name: string | null;
  owner_avatar: string | null;
  week_stars: number;
  total_stars: number;
  eval_id: number | null;
  total_score: number | null;
  dimensions: string | null;
  is_heuristic: number | null;
  eval_model: string | null;
  eval_summary: string | null;
  eval_strengths: string | null;
  eval_improvements: string | null;
  eval_tags: string | null;
  eval_created_at: string | null;
  viewer_starred: number;
}

const EMPTY_DIMENSIONS: Dimensions = {
  innovation: 0,
  engineering: 0,
  documentation: 0,
  maintainability: 0,
  usefulness: 0,
};

export function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseStringArray(raw: string | null | undefined): string[] {
  const value = parseJsonField<unknown>(raw, []);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export interface ProjectRepoMeta {
  fullName?: string;
  description?: string | null;
  language?: string | null;
  homepage?: string | null;
  pushedAt?: string | null;
  archived?: boolean;
  forks?: number;
  stars?: number;
  topics?: string[];
}

export function mapEvalRow(row: ProjectListRow): EvalSummary | null {
  if (row.eval_id === null || row.total_score === null) return null;
  const dims = parseJsonField<Dimensions>(row.dimensions, EMPTY_DIMENSIONS);
  return {
    id: row.eval_id,
    total: row.total_score,
    dimensions: {
      innovation: Number(dims.innovation) || 0,
      engineering: Number(dims.engineering) || 0,
      documentation: Number(dims.documentation) || 0,
      maintainability: Number(dims.maintainability) || 0,
      usefulness: Number(dims.usefulness) || 0,
    },
    isHeuristic: row.is_heuristic === 1,
    model: row.eval_model ?? 'heuristic',
    summary: row.eval_summary,
    strengths: parseStringArray(row.eval_strengths),
    improvements: parseStringArray(row.eval_improvements),
    tags: parseStringArray(row.eval_tags),
    createdAt: row.eval_created_at ?? row.created_at,
  };
}

export function mapProjectRow(row: ProjectListRow, viewerId: number | null): ProjectListItem {
  const repo = parseJsonField<ProjectRepoMeta>(row.repo_meta, {});
  return {
    id: row.id,
    title: row.title,
    repoFullName: row.repo_full_name,
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    tags: parseStringArray(row.tags),
    createdAt: row.created_at,
    status: row.status,
    owner: {
      id: row.user_id,
      login: row.owner_login,
      name: row.owner_name,
      avatarUrl: row.owner_avatar,
    },
    score: mapEvalRow(row),
    stars: {
      siteTotal: row.total_stars ?? 0,
      siteWeek: row.week_stars ?? 0,
      github: typeof repo.stars === 'number' ? repo.stars : 0,
    },
    meta: {
      description: repo.description ?? null,
      language: repo.language ?? null,
      homepage: repo.homepage ?? null,
      pushedAt: repo.pushedAt ?? null,
      archived: repo.archived === true,
      forks: typeof repo.forks === 'number' ? repo.forks : 0,
    },
    viewer: {
      starred: row.viewer_starred === 1,
      isOwner: viewerId !== null && viewerId === row.user_id,
    },
  };
}

export const PROJECT_LIST_COLUMNS = `
  p.*, u.login AS owner_login, u.name AS owner_name, u.avatar_url AS owner_avatar,
  (SELECT COUNT(*) FROM star_events s WHERE s.project_id = p.id AND s.star_given_at >= ?) AS week_stars,
  (SELECT COUNT(*) FROM star_events s WHERE s.project_id = p.id) AS total_stars,
  e.id AS eval_id, e.total_score, e.dimensions, e.is_heuristic, e.model AS eval_model,
  e.summary AS eval_summary, e.strengths AS eval_strengths, e.improvements AS eval_improvements,
  e.tags AS eval_tags, e.created_at AS eval_created_at,
  EXISTS(SELECT 1 FROM star_events s WHERE s.project_id = p.id AND s.user_id = ?) AS viewer_starred
`;

// 占位符顺序：weekStart（SELECT 中的 week_stars 子查询），然后 viewerId（SELECT 中的 EXISTS）。
export const PROJECT_LIST_FROM = `
  FROM projects p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN evaluations e ON e.id = (
    SELECT id FROM evaluations WHERE project_id = p.id AND status = 'done' ORDER BY id DESC LIMIT 1
  )
`;
