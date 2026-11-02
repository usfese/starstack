import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectListItem } from '../../shared/types';
import { ConfirmButton } from '../components/ConfirmButton';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, useApi } from '../lib/api';
import { formatDate, relativeTime, scoreColorClass } from '../lib/format';

interface StarItem {
  projectId: number;
  title: string;
  repoFullName: string;
  ownerLogin: string;
  starGivenAt: string;
}

export function Me() {
  const { user, stats, refresh } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'projects' | 'stars'>('projects');

  // 按 tab 取数：未打开的 tab 不发请求。
  const projects = useApi<{ items: ProjectListItem[] }>(
    tab === 'projects' ? '/api/me/projects' : null,
  );
  const stars = useApi<{ items: StarItem[] }>(tab === 'stars' ? '/api/me/stars' : null);

  const remove = async (id: number) => {
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' });
      toast.success('项目已删除');
      projects.refresh();
      void refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-full border border-white/15" />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">{user?.name || user?.login}</h1>
          <a
            href={`https://github.com/${user?.login ?? ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 hover:text-indigo-300"
          >
            @{user?.login}
          </a>
        </div>
        {user ? (
          <p className="ml-auto text-xs text-slate-500">加入于 {formatDate(user.createdAt)}</p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: '我的项目', value: stats?.projects ?? 0 },
          { label: '我给的 Star', value: stats?.starsGiven ?? 0 },
          { label: '收到的 Star', value: stats?.starsReceived ?? 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </section>

      <div className="flex gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'projects'}
          onClick={() => setTab('projects')}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            tab === 'projects'
              ? 'bg-white/10 text-white'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          我的项目
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stars'}
          onClick={() => setTab('stars')}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            tab === 'stars' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          我给的 Star
        </button>
      </div>

      {tab === 'projects' ? (
        projects.loading ? (
          <Spinner />
        ) : (projects.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="还没有提交项目"
            action={
              <Link
                to="/submit"
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
              >
                提交第一个项目
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {projects.data?.items.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/projects/${project.id}`}
                      className="truncate text-sm font-medium text-white hover:text-indigo-300"
                    >
                      {project.title}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        project.status === 'published'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}
                    >
                      {project.status === 'published' ? '已上架' : '已下架'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{project.repoFullName}</p>
                </div>
                <span className={`text-sm ${project.score ? scoreColorClass(project.score.total) : 'text-slate-500'}`}>
                  {project.score ? `AI ${project.score.total}` : '评估中'}
                </span>
                <span className="text-xs text-slate-400">本周 {project.stars.siteWeek} ★</span>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/projects/${project.id}/edit`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    编辑
                  </Link>
                  <ConfirmButton
                    label="删除"
                    confirmLabel="确认删除？"
                    onConfirm={() => void remove(project.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : stars.loading ? (
        <Spinner />
      ) : (stars.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="还没有给出 Star" hint="去项目广场看看，点亮你喜欢的项目。" />
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {stars.data?.items.map((item) => (
            <li key={item.projectId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link
                to={`/projects/${item.projectId}`}
                className="min-w-0 flex-1 truncate text-sm text-white hover:text-indigo-300"
              >
                {item.title}
              </Link>
              <span className="text-xs text-slate-500">{item.ownerLogin}</span>
              <span className="text-xs text-slate-400">{relativeTime(item.starGivenAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
