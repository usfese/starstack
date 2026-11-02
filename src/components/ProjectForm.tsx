import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TAGS, type Tag } from '../../shared/constants';
import type {
  GithubRepoOption,
  GithubReposResponse,
  ProjectPatchResponse,
} from '../../shared/types';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import { RepoPicker, RepoIcon } from './RepoPicker';

interface ProjectFormProps {
  mode: 'create' | 'edit';
  projectId?: number;
  initial?: {
    repoFullName?: string;
    title: string;
    introMd: string;
    demoUrl: string | null;
    tags: string[];
  };
}

interface CreatedResponse {
  id: number;
}

export function ProjectForm({ mode, projectId, initial }: ProjectFormProps) {
  const toast = useToast();
  const navigate = useNavigate();

  const [repo, setRepo] = useState('');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [intro, setIntro] = useState(initial?.introMd ?? '');
  const [demoUrl, setDemoUrl] = useState(initial?.demoUrl ?? '');
  const [tags, setTags] = useState<Tag[]>(
    (initial?.tags ?? []).filter((tag): tag is Tag => TAGS.some((item) => item.value === tag)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [repoOptions, setRepoOptions] = useState<GithubRepoOption[] | null>(null);
  const [repoOptionsLoading, setRepoOptionsLoading] = useState(mode === 'create');
  const [repoOptionsError, setRepoOptionsError] = useState<string | null>(null);
  const [repoReload, setRepoReload] = useState(0);

  useEffect(() => {
    if (mode !== 'create') {
      setRepoOptionsLoading(false);
      return;
    }

    let cancelled = false;
    setRepoOptionsLoading(true);
    setRepoOptionsError(null);
    api<GithubReposResponse>('/api/github/repos')
      .then((data) => {
        if (cancelled) return;
        setRepoOptions(data.repos);
      })
      .catch((err) => {
        if (cancelled) return;
        setRepoOptions([]);
        setRepoOptionsError(
          err instanceof ApiError ? err.message : '读取 GitHub 仓库失败，请手动输入',
        );
      })
      .finally(() => {
        if (!cancelled) setRepoOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, repoReload]);

  const handleSelectRepo = (option: GithubRepoOption) => {
    setRepo(option.fullName);
    setError(null);
    if (!title.trim()) setTitle(option.name);
  };

  const toggleTag = (tag: Tag) => {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, tag];
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'create' && !repo.trim()) {
      setError('请先选择一个 GitHub 仓库');
      return;
    }
    setPending(true);
    setError(null);

    try {
      if (mode === 'create') {
        const result = await api<CreatedResponse>('/api/projects', {
          method: 'POST',
          body: JSON.stringify({ repo, title, intro, demoUrl, tags }),
        });
        toast.success('项目已发布，AI 评估排队中');
        navigate(`/projects/${result.id}`);
      } else {
        const result = await api<ProjectPatchResponse>(`/api/projects/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, intro, demoUrl, tags }),
        });
        if (result.evaluationQueued) {
          toast.success('修改已保存，正在重新评估');
        } else {
          toast.success(
            `修改已保存；本周已评估过，${formatDate(result.nextEvaluationAt ?? '')} 后可再次评估`,
          );
        }
        navigate(`/projects/${projectId}`);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '提交失败，请稍后重试';
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  const fieldClass =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60';

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {error ? (
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {mode === 'create' ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">GitHub 仓库</span>
          <RepoPicker
            repos={repoOptions ?? []}
            loading={repoOptionsLoading}
            error={repoOptionsError}
            selected={repo}
            onSelect={handleSelectRepo}
            onClear={() => setRepo('')}
            onRetry={() => setRepoReload((value) => value + 1)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">GitHub 仓库</span>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <span className="text-slate-400">
              <RepoIcon />
            </span>
            <span className="font-mono text-slate-200">{initial?.repoFullName}</span>
          </div>
          <span className="text-xs text-slate-500">仓库不可修改。</span>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-slate-300">项目标题</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          minLength={2}
          required
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-slate-300">项目介绍</span>
        <textarea
          value={intro}
          onChange={(event) => setIntro(event.target.value)}
          maxLength={5000}
          minLength={20}
          required
          rows={12}
          className={`${fieldClass} font-mono`}
        />
        <span className="flex justify-between text-xs text-slate-500">
          <span>介绍会展示在项目页，支持 Markdown。</span>
          <span>{intro.length}/5000</span>
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-slate-300">在线演示（可选）</span>
        <input
          value={demoUrl}
          onChange={(event) => setDemoUrl(event.target.value)}
          placeholder="https://example.com"
          className={fieldClass}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-slate-300">标签（最多 3 个）</span>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const selected = tags.includes(tag.value);
            const disabled = !selected && tags.length >= 3;
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggleTag(tag.value)}
                disabled={disabled}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected
                    ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending || (mode === 'create' && !repo.trim())}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-5 py-2 font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? '提交中…' : mode === 'create' ? '发布项目' : '保存修改'}
        </button>
      </div>
    </form>
  );
}
