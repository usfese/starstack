import { Link } from 'react-router-dom';
import type { LeaderboardResponse, ProjectListResponse } from '../../shared/types';
import { EmptyState } from '../components/EmptyState';
import { ProjectCard } from '../components/ProjectCard';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../lib/api';
import { formatWeekRange } from '../lib/format';

export function Home() {
  const { user } = useAuth();
  const leaderboard = useApi<LeaderboardResponse>('/api/leaderboard');
  const latest = useApi<ProjectListResponse>('/api/projects?sort=latest&pageSize=6');
  const needs = useApi<ProjectListResponse>('/api/projects?sort=needs&pageSize=3');

  const topFive = leaderboard.data?.entries.slice(0, 5) ?? [];

  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-indigo-500/15 via-indigo-500/5 to-transparent p-6 sm:p-10">
        <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
          把你的 GitHub 项目，放到聚光灯下
        </h1>
        <p className="mt-3 text-slate-300">AI 质量评估 · 每周真实 Star 榜 · 让好项目被看见</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={user ? '/submit' : '/login'}
            className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
          >
            提交项目
          </Link>
          <Link
            to="/projects?sort=needs"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-medium text-slate-200 hover:bg-white/10"
          >
            去点亮项目
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">本周榜单</h2>
          {leaderboard.data ? (
            <span className="text-xs text-slate-500">
              {formatWeekRange(leaderboard.data.week.start, leaderboard.data.week.end)}
            </span>
          ) : null}
        </div>
        {leaderboard.loading ? <Spinner /> : null}
        {!leaderboard.loading && topFive.length === 0 ? (
          <EmptyState title="本周还没有新的验证 Star" hint="去点亮一个你喜欢的项目吧。" />
        ) : null}
        {topFive.length > 0 ? (
          <ol className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/5">
            {topFive.map((entry) => (
              <li key={entry.projectId}>
                <Link
                  to={`/projects/${entry.projectId}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-white/5"
                >
                  <span className="w-6 shrink-0 text-center text-sm font-semibold text-slate-400">
                    {entry.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {entry.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {entry.repoFullName}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    AI {entry.aiScore ?? '—'}
                  </span>
                  <span className="shrink-0 text-sm text-amber-300/90">{entry.weekStars} ★</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">最新项目</h2>
          <Link to="/projects" className="text-sm text-indigo-300 hover:text-indigo-200">
            查看全部
          </Link>
        </div>
        {latest.loading ? <Spinner /> : null}
        {!latest.loading && (latest.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="还没有项目" hint="成为第一个提交项目的人。" />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.data?.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">待点亮</h2>
          <Link
            to="/projects?sort=needs"
            className="text-sm text-indigo-300 hover:text-indigo-200"
          >
            更多
          </Link>
        </div>
        <p className="mb-4 text-sm text-slate-400">这些优质项目还没有收到足够的验证 Star</p>
        {needs.loading ? <Spinner /> : null}
        {!needs.loading && (needs.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="暂时没有待点亮的项目" />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {needs.data?.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>
    </div>
  );
}
