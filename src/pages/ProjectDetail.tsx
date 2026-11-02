import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { tagLabel } from '../../shared/constants';
import type { ProjectDetail } from '../../shared/types';
import { AiPanel } from '../components/AiPanel';
import { Comments } from '../components/Comments';
import { ConfirmButton } from '../components/ConfirmButton';
import { EmptyState } from '../components/EmptyState';
import { Markdown } from '../components/Markdown';
import { ShareProject } from '../components/ShareProject';
import { Spinner } from '../components/Spinner';
import { StarButton } from '../components/StarButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, useApi } from '../lib/api';
import { formatNumber, relativeTime } from '../lib/format';

export function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const detail = useApi<ProjectDetail>(id ? `/api/projects/${id}` : null);
  const [shareOpen, setShareOpen] = useState(false);

  if (detail.loading && !detail.data) return <Spinner />;

  if (!detail.data) {
    return (
      <EmptyState
        title="项目不存在"
        hint={detail.error?.status === 404 ? '该项目可能已被删除或下架。' : detail.error?.message}
        action={
          <Link
            to="/projects"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            返回项目广场
          </Link>
        }
      />
    );
  }

  const project = detail.data;
  const canManage = project.viewer.isOwner || user?.isAdmin === true;

  const remove = async () => {
    try {
      await api(`/api/projects/${project.id}`, { method: 'DELETE' });
      toast.success('项目已删除');
      navigate('/me');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {detail.error ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            刷新失败：{detail.error.message}
          </p>
        ) : null}

        {project.repoMissing ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            GitHub 仓库当前不可访问（可能已删除或改名）
          </p>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">{project.title}</h1>
              <a
                href={`https://github.com/${project.repoFullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-slate-400 hover:text-indigo-300"
              >
                {project.repoFullName}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
              >
                分享
              </button>
              {canManage ? (
                <>
                  <Link
                    to={`/projects/${project.id}/edit`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
                  >
                    编辑
                  </Link>
                  <ConfirmButton label="删除" confirmLabel="确认删除？" onConfirm={remove} />
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              {project.owner.avatarUrl ? (
                <img
                  src={project.owner.avatarUrl}
                  alt=""
                  className="h-5 w-5 rounded-full border border-white/10"
                />
              ) : null}
              {project.owner.name || project.owner.login}
            </span>
            <span>GitHub Star {formatNumber(project.stars.github)}</span>
            <span>Fork {formatNumber(project.meta.forks)}</span>
            <span>{project.meta.language ?? '未知语言'}</span>
            <span>最近推送 {relativeTime(project.meta.pushedAt)}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={`https://github.com/${project.repoFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
            >
              在 GitHub 查看
            </a>
            {project.demoUrl ? (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
              >
                在线演示
              </a>
            ) : null}
            {project.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
                  >
                    {tagLabel(tag)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <Markdown content={project.introMd} />
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <AiPanel
          score={project.score}
          status={project.evaluationStatus}
          onRefresh={detail.refresh}
        />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-base font-semibold text-white">点亮项目</h2>
          <div className="mt-3 flex items-center gap-4 text-sm text-slate-400">
            <span className="text-amber-300/90">本周 {project.stars.siteWeek} ★</span>
            <span>本站累计 {project.stars.siteTotal} ★</span>
          </div>
          <div className="mt-4">
            <StarButton project={project} onVerified={detail.refresh} />
          </div>
        </section>
      </aside>
      </div>

      <Comments projectId={project.id} />
      <ShareProject project={project} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
