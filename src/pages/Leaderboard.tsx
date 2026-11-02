import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LeaderboardResponse } from '../../shared/types';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useApi } from '../lib/api';
import { formatWeekRange } from '../lib/format';

export function Leaderboard() {
  const board = useApi<LeaderboardResponse>('/api/leaderboard');
  const [selected, setSelected] = useState<string | null>(null);

  if (board.loading) return <Spinner />;
  if (board.error || !board.data) {
    return <EmptyState title="榜单加载失败" hint={board.error?.message} />;
  }

  const data = board.data;
  const historyEntry = selected ? data.history.find((item) => item.key === selected) : undefined;
  const entries = historyEntry ? historyEntry.entries : data.entries;
  const range = historyEntry ?? data.week;
  const isCurrent = !historyEntry;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">周榜</h1>
        <p className="mt-1 text-sm text-slate-400">
          只统计本周在本站完成 GitHub 验证的 Star，每人每个项目仅一次。
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {isCurrent ? '本周' : historyEntry?.key} · {formatWeekRange(range.start, range.end)}
        </p>
      </div>

      {data.history.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={isCurrent}
            onClick={() => setSelected(null)}
            className={`rounded-full border px-3 py-1 text-xs ${
              isCurrent
                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            本周
          </button>
          {data.history.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={selected === item.key}
              onClick={() => setSelected(item.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                selected === item.key
                  ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {item.key}
            </button>
          ))}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState title="本周还没有新的验证 Star，去点亮第一个项目吧。" />
      ) : (
        <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {entries.map((entry) => (
            <li key={`${range.start}-${entry.projectId}`}>
              <Link
                to={`/projects/${entry.projectId}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/5"
              >
                <span
                  className={`w-8 shrink-0 text-center text-lg font-bold ${
                    entry.rank === 1 ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  {entry.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{entry.title}</span>
                    {entry.rank === 1 && isCurrent ? (
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] text-amber-200">
                        本周 Star 王
                      </span>
                    ) : null}
                    {entry.isHeuristic ? (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-500">
                        启发式
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {entry.repoFullName} · {entry.ownerLogin}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">AI {entry.aiScore ?? '—'}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  累计 {entry.totalStars} ★
                </span>
                <span className="shrink-0 text-sm font-semibold text-amber-300/90">
                  {entry.weekStars} ★
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
