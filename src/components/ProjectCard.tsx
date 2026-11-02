import { Link, useNavigate } from 'react-router-dom';
import { tagLabel } from '../../shared/constants';
import type { ProjectListItem } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from '../lib/format';
import { ScoreBadge } from './ScoreBadge';

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const actionButton = (() => {
    if (!user) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            navigate('/login');
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
        >
          登录
        </button>
      );
    }
    if (project.viewer.isOwner) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            navigate('/me');
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
        >
          我的项目
        </button>
      );
    }
    if (project.viewer.starred) {
      return (
        <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
          已认证
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          window.open(`https://github.com/${project.repoFullName}`, '_blank', 'noopener,noreferrer');
        }}
        className="rounded-lg bg-indigo-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400"
      >
        去 Star
      </button>
    );
  })();

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/projects/${project.id}`)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        navigate(`/projects/${project.id}`);
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-indigo-400/40 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/projects/${project.id}`}
            onClick={(event) => event.stopPropagation()}
            className="line-clamp-1 text-base font-semibold text-white hover:text-indigo-300"
          >
            {project.title}
          </Link>
          <a
            href={`https://github.com/${project.repoFullName}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-0.5 block truncate text-xs text-slate-400 hover:text-indigo-300"
          >
            {project.repoFullName}
          </a>
        </div>
        <ScoreBadge score={project.score} />
      </div>

      <p className="line-clamp-2 min-h-[2.5em] text-sm text-slate-400">
        {project.meta.description ?? '作者还没有填写项目描述。'}
      </p>

      {project.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/projects?tag=${encodeURIComponent(tag)}`);
              }}
              aria-label={`按标签 ${tagLabel(tag)} 搜索`}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:border-indigo-400/40 hover:text-indigo-200"
            >
              {tagLabel(tag)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="text-amber-300/90">本周 {project.stars.siteWeek} ★</span>
        <span>本站累计 {project.stars.siteTotal} ★</span>
        <span className="ml-auto">{relativeTime(project.createdAt)}</span>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <span className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
          {project.owner.avatarUrl ? (
            <img
              src={project.owner.avatarUrl}
              alt=""
              className="h-5 w-5 rounded-full border border-white/10"
            />
          ) : null}
          <span className="truncate">{project.owner.name || project.owner.login}</span>
        </span>
        {actionButton}
      </div>
    </article>
  );
}
