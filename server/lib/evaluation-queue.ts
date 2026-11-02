import { db } from '../db/index';
import { evaluateWithAI, type EvalInput, type EvaluationResult } from './ai';
import { getAiConfig } from './ai-config';
import { fetchReadme, type RepoMeta } from './github';
import { evaluateHeuristic } from './heuristic';
import { pruneExpiredSessions } from './session';

const MAX_CONCURRENT = 2;
const STALE_RUNNING_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const SWEEP_BATCH = 20;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

const queue: number[] = [];
const inFlight = new Set<number>();
let activeCount = 0;
let timer: NodeJS.Timeout | null = null;

interface EvalJobRow {
  id: number;
  status: string;
  project_id: number;
  repo_owner: string;
  repo_name: string;
  repo_meta: string;
  intro_md: string;
}

export function schedule(evalId: number): void {
  if (inFlight.has(evalId)) return;
  inFlight.add(evalId);
  queue.push(evalId);
  pump();
}

function pump(): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const evalId = queue.shift()!;
    activeCount += 1;
    void runEval(evalId)
      .catch((error) => {
        console.error(`[星栈] 评估任务 ${evalId} 异常：`, error);
      })
      .finally(() => {
        activeCount -= 1;
        inFlight.delete(evalId);
        pump();
      });
  }
}

function parseRepoMeta(raw: string): RepoMeta {
  try {
    return JSON.parse(raw) as RepoMeta;
  } catch {
    return {
      fullName: '',
      name: '',
      ownerLogin: '',
      description: null,
      stars: 0,
      forks: 0,
      openIssues: 0,
      language: null,
      topics: [],
      license: null,
      homepage: null,
      createdAt: null,
      pushedAt: null,
      archived: false,
      fork: false,
      private: false,
    };
  }
}

async function runEval(evalId: number): Promise<void> {
  const job = db
    .query(
      `SELECT e.id, e.status, e.project_id, p.repo_owner, p.repo_name, p.repo_meta, p.intro_md
       FROM evaluations e JOIN projects p ON p.id = e.project_id
       WHERE e.id = ?`,
    )
    .get(evalId) as EvalJobRow | null;

  if (!job || (job.status !== 'pending' && job.status !== 'failed')) return;

  const startedAt = new Date().toISOString();
  db.query(
    `UPDATE evaluations SET status = 'running', attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?`,
  ).run(startedAt, evalId);

  const repo = parseRepoMeta(job.repo_meta);

  try {
    let readme: string | null = null;
    try {
      readme = await fetchReadme(job.repo_owner, job.repo_name);
    } catch (error) {
      console.error(`[星栈] 读取 README 失败（${job.repo_owner}/${job.repo_name}）：`, error);
    }

    const input: EvalInput = { repo, readme, introMd: job.intro_md };
    let result: EvaluationResult;
    let model: string;
    let heuristic: boolean;

    const ai = getAiConfig();
    if (ai.apiKey) {
      result = await evaluateWithAI(input);
      model = ai.model;
      heuristic = false;
    } else {
      result = evaluateHeuristic(input);
      model = 'heuristic';
      heuristic = true;
    }

    db.query(
      `UPDATE evaluations
       SET status = 'done', model = ?, is_heuristic = ?, total_score = ?, dimensions = ?,
           strengths = ?, improvements = ?, summary = ?, tags = ?, error = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(
      model,
      heuristic ? 1 : 0,
      result.total,
      JSON.stringify(result.dimensions),
      JSON.stringify(result.strengths),
      JSON.stringify(result.improvements),
      result.summary,
      JSON.stringify(result.tags),
      new Date().toISOString(),
      evalId,
    );
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    console.error(`[星栈] 评估 ${evalId} 失败：${message}`);
    db.query(
      `UPDATE evaluations SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`,
    ).run(message, new Date().toISOString(), evalId);
  }
}

export function sweep(): void {
  db.query(
    `UPDATE evaluations SET status = 'pending', updated_at = ? WHERE status = 'running' AND updated_at < ?`,
  ).run(
    new Date().toISOString(),
    new Date(Date.now() - STALE_RUNNING_MS).toISOString(),
  );

  const pending = db
    .query(
      `SELECT id FROM evaluations
       WHERE status = 'pending' OR (status = 'failed' AND attempt_count < ?)
       ORDER BY id ASC LIMIT ?`,
    )
    .all(MAX_ATTEMPTS, SWEEP_BATCH) as { id: number }[];

  for (const row of pending) schedule(row.id);

  pruneExpiredSessions();
}

/** 定时器/启动路径统一入口：单次失败记日志，不终止进程。 */
export function safeSweep(): void {
  try {
    sweep();
  } catch (error) {
    console.error('[星栈] 后台清理失败：', error);
  }
}

export const WEEKLY_EVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 该项目 7 天内已有评估（含排队/进行中）时返回「可再次评估」的 ISO 时间，否则返回 null。
 * status='failed' 不计入，便于修好配置后立即重试。
 */
export function evaluationCooldown(projectId: number): string | null {
  const row = db
    .query(
      `SELECT created_at FROM evaluations
       WHERE project_id = ? AND status IN ('pending','running','done')
       ORDER BY id DESC LIMIT 1`,
    )
    .get(projectId) as { created_at: string } | null;
  if (!row) return null;
  const until = Date.parse(row.created_at) + WEEKLY_EVAL_WINDOW_MS;
  return Number.isFinite(until) && until > Date.now() ? new Date(until).toISOString() : null;
}

export function ensureBootTasks(): void {
  // 单实例架构下启动时不存在合法的 running 评估：上次进程留下的都是孤儿，直接回收。
  db.query("UPDATE evaluations SET status = 'pending', updated_at = ? WHERE status = 'running'").run(
    new Date().toISOString(),
  );
  safeSweep();
  if (timer) return;
  timer = setInterval(safeSweep, SWEEP_INTERVAL_MS);
  timer.unref?.();
}
