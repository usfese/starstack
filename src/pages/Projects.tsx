import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TAGS } from '../../shared/constants';
import type { ProjectListResponse, ProjectTagsResponse } from '../../shared/types';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { ProjectCard } from '../components/ProjectCard';
import { Spinner } from '../components/Spinner';
import { useApi } from '../lib/api';

const SORT_OPTIONS = [
  { value: 'latest', label: '最新发布' },
  { value: 'stars_week', label: '本周获星' },
  { value: 'score', label: 'AI 评分' },
  { value: 'needs', label: '待点亮' },
];

const PAGE_SIZE = 12;

export function Projects() {
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') ?? 'latest';
  const tag = params.get('tag') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const [search, setSearch] = useState(q);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    if (search === q) return undefined;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search) next.set('q', search);
      else next.delete('q');
      next.set('page', '1');
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, q, params, setParams]);

  const query = new URLSearchParams({
    sort,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (q) query.set('q', q);
  if (tag) query.set('tag', tag);

  const list = useApi<ProjectListResponse>(`/api/projects?${query.toString()}`);
  const tagOptions = useApi<ProjectTagsResponse>('/api/projects/tags');

  const tagMap = new Map<string, string>();
  for (const item of TAGS) tagMap.set(item.value, item.label);
  for (const item of tagOptions.data?.tags ?? []) {
    if (!tagMap.has(item.value)) tagMap.set(item.value, item.value);
  }
  if (tag && !tagMap.has(tag)) tagMap.set(tag, tag);

  const lastPage = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  // 页码越界（例如删掉最后一页的最后一条）时收敛到最后一页。
  useEffect(() => {
    if (!list.data) return;
    if (page <= lastPage) return;
    const next = new URLSearchParams(params);
    next.set('page', String(lastPage));
    setParams(next, { replace: true });
  }, [list.data, page, lastPage, params, setParams]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">项目广场</h1>
        {list.data ? <span className="text-sm text-slate-500">共 {list.data.total} 个项目</span> : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索项目、仓库或介绍"
          aria-label="搜索项目"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 sm:max-w-sm"
        />
        <div className="flex gap-2">
          <select
            value={tag}
            onChange={(event) => updateParam('tag', event.target.value)}
            aria-label="标签筛选"
            className="rounded-lg border border-white/10 bg-[#111823] px-3 py-2 text-sm text-slate-200"
          >
            <option value="">全部标签</option>
            {[...tagMap.entries()].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => updateParam('sort', event.target.value)}
            aria-label="排序方式"
            className="rounded-lg border border-white/10 bg-[#111823] px-3 py-2 text-sm text-slate-200"
          >
            {SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.loading && !list.data ? <Spinner /> : null}

      {!list.data && list.error ? (
        <EmptyState title="加载失败" hint={list.error.message} />
      ) : null}

      {list.data && list.error ? (
        <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          刷新失败：{list.error.message}
        </p>
      ) : null}

      {!list.loading &&
      !list.error &&
      page <= lastPage &&
      (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="没有找到匹配的项目" hint="试试换个关键词或标签。" />
      ) : null}

      <div
        aria-busy={list.isFetching}
        className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${
          list.isFetching ? 'opacity-60' : ''
        }`}
      >
        {list.data?.items.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {list.data ? (
        <Pagination
          page={page}
          total={list.data.total}
          pageSize={PAGE_SIZE}
          onChange={(next) => updateParam('page', String(next))}
        />
      ) : null}
    </div>
  );
}
