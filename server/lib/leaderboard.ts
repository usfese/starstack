import type { LeaderboardEntry, WeekRange } from '../../shared/types';
import { db } from '../db/index';
import { getWeekRange, weekRangeFromIso } from './week';

interface LeaderRow {
  project_id: number;
  title: string;
  repo_full_name: string;
  owner_login: string;
  week_stars: number;
  total_stars: number;
  ai_score: number | null;
  is_heuristic: number | null;
}

function queryWeekEntries(start: string, end: string): LeaderboardEntry[] {
  const rows = db
    .query(
      `SELECT p.id AS project_id, p.title, p.repo_full_name, u.login AS owner_login,
              COUNT(*) AS week_stars,
              (SELECT COUNT(*) FROM star_events s2 WHERE s2.project_id = p.id) AS total_stars,
              e.total_score AS ai_score, e.is_heuristic AS is_heuristic
       FROM star_events se
       JOIN projects p ON p.id = se.project_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN evaluations e ON e.id = (
         SELECT id FROM evaluations WHERE project_id = p.id AND status = 'done' ORDER BY id DESC LIMIT 1
       )
       WHERE se.star_given_at >= ? AND se.star_given_at < ? AND p.status = 'published'
       GROUP BY p.id
       ORDER BY week_stars DESC, ai_score DESC, p.created_at ASC
       LIMIT 10`,
    )
    .all(start, end) as LeaderRow[];

  return rows.map((row, index) => ({
    rank: index + 1,
    projectId: row.project_id,
    title: row.title,
    repoFullName: row.repo_full_name,
    ownerLogin: row.owner_login,
    weekStars: row.week_stars,
    totalStars: row.total_stars,
    aiScore: row.ai_score,
    isHeuristic: row.is_heuristic === 1,
  }));
}

interface SnapshotRow {
  week_key: string;
  week_start: string;
  week_end: string;
  entries: string;
}

const SNAPSHOT_TTL_MS = 60_000;
let lastSnapshotSweep = 0;

export function ensureWeeklySnapshots(): void {
  const now = Date.now();
  if (now - lastSnapshotSweep < SNAPSHOT_TTL_MS) return;
  lastSnapshotSweep = now;

  const current = getWeekRange();
  const existing = new Set(
    (db.query('SELECT week_key FROM leaderboard_snapshots').all() as { week_key: string }[]).map(
      (row) => row.week_key,
    ),
  );

  const latest = db
    .query('SELECT week_end FROM leaderboard_snapshots ORDER BY week_key DESC LIMIT 1')
    .get() as { week_end: string } | null;
  const since = latest?.week_end ?? '0000-01-01T00:00:00.000Z';

  const events = db
    .query('SELECT star_given_at FROM star_events WHERE star_given_at >= ? AND star_given_at < ?')
    .all(since, current.start) as {
    star_given_at: string;
  }[];

  const weeks = new Map<string, WeekRange>();
  for (const event of events) {
    const range = weekRangeFromIso(event.star_given_at);
    if (!range) continue;
    if (!weeks.has(range.key)) weeks.set(range.key, range);
  }

  const ordered = [...weeks.values()].sort((a, b) => a.start.localeCompare(b.start));
  db.transaction(() => {
    for (const range of ordered) {
      if (existing.has(range.key)) continue;
      const entries = queryWeekEntries(range.start, range.end);
      db.query(
        `INSERT OR IGNORE INTO leaderboard_snapshots (week_key, week_start, week_end, entries)
         VALUES (?, ?, ?, ?)`,
      ).run(range.key, range.start, range.end, JSON.stringify(entries));
    }
  })();
}

export function getLeaderboard(): {
  week: WeekRange;
  entries: LeaderboardEntry[];
  history: { key: string; start: string; end: string; entries: LeaderboardEntry[] }[];
} {
  const week = getWeekRange();
  ensureWeeklySnapshots();

  const entries = queryWeekEntries(week.start, week.end);

  const snapshots = db
    .query(
      `SELECT week_key, week_start, week_end, entries FROM leaderboard_snapshots
       ORDER BY week_key DESC LIMIT 8`,
    )
    .all() as SnapshotRow[];

  const history = snapshots.map((row) => {
    let parsed: LeaderboardEntry[] = [];
    try {
      const value = JSON.parse(row.entries) as unknown;
      if (Array.isArray(value)) parsed = value as LeaderboardEntry[];
    } catch {
      parsed = [];
    }
    return { key: row.week_key, start: row.week_start, end: row.week_end, entries: parsed };
  });

  return { week, entries, history };
}
