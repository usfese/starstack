import { Link, useParams } from 'react-router-dom';
import type { ProjectDetail } from '../../shared/types';
import { EmptyState } from '../components/EmptyState';
import { ProjectForm } from '../components/ProjectForm';
import { Spinner } from '../components/Spinner';
import { useApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function EditProject() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const detail = useApi<ProjectDetail>(id ? `/api/projects/${id}` : null);

  if (detail.loading || authLoading) return <Spinner />;

  if (detail.error || !detail.data) {
    return (
      <EmptyState
        title="无法编辑"
        hint={detail.error?.message ?? '项目不存在'}
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

  if (!project.viewer.isOwner && user?.isAdmin !== true) {
    return (
      <EmptyState
        title="无权编辑该项目"
        hint="只有项目作者或管理员可以编辑。"
        action={
          <Link
            to={`/projects/${project.id}`}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            返回项目
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">编辑项目</h1>
        <p className="mt-1 text-sm text-slate-400">
          保存后会重新排队做一次 AI 评估（同一项目 7 天内最多一次）。
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <ProjectForm
          mode="edit"
          projectId={project.id}
          initial={{
            repoFullName: project.repoFullName,
            title: project.title,
            introMd: project.introMd,
            demoUrl: project.demoUrl,
            tags: project.tags,
          }}
        />
      </div>
    </div>
  );
}
