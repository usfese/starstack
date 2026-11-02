import { useMemo, useState } from 'react';
import type { GithubRepoOption } from '../../shared/types';
import { formatNumber, relativeTime } from '../lib/format';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  PHP: '#4f5d95',
  Ruby: '#701516',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Dart: '#00b4ab',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};

export function RepoIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 0 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M3.38 8A4.63 4.63 0 0 1 8 3.38c1.26 0 2.4.5 3.24 1.31l-1.1 1.1A.75.75 0 0 0 10.67 7h3.08a.75.75 0 0 0 .75-.75V3.17a.75.75 0 0 0-1.28-.53l-.96.96A6.13 6.13 0 0 0 8 1.87 6.13 6.13 0 0 0 1.87 8a.75.75 0 0 0 1.5 0Zm9.75 0a.75.75 0 0 0-.75.75A4.63 4.63 0 0 1 8 12.62c-1.26 0-2.4-.5-3.24-1.31l1.1-1.1a.75.75 0 0 0-.53-1.28H2.25a.75.75 0 0 0-.75.75v3.08a.75.75 0 0 0 1.28.53l.96-.96A6.13 6.13 0 0 0 8 14.13 6.13 6.13 0 0 0 14.13 8a.75.75 0 0 0-.75-.75Z" />
    </svg>
  );
}

interface RepoPickerProps {
  repos: GithubRepoOption[];
  loading: boolean;
  error: string | null;
  selected: string;
  onSelect: (repo: GithubRepoOption) => void;
  onClear: () => void;
  onRetry: () => void;
}

export function RepoPicker({
  repos,
  loading,
  error,
  selected,
  onSelect,
  onClear,
  onRetry,
}: RepoPickerProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return repos;
    return repos.filter((repo) => {
      const haystack = [repo.fullName, repo.description ?? '', repo.language ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [repos, normalizedQuery]);

  const groups = useMemo(() => {
    const map = new Map<string, GithubRepoOption[]>();
    for (const repo of filtered) {
      const list = map.get(repo.ownerLogin) ?? [];
      list.push(repo);
      map.set(repo.ownerLogin, list);
    }
    return [...map.entries()].sort((a, b) => {
      const personal = (a[1][0]?.ownerType === 'User' ? 0 : 1) - (b[1][0]?.ownerType === 'User' ? 0 : 1);
      return personal !== 0 ? personal : a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  const selectedRepo = repos.find((repo) => repo.fullName === selected) ?? null;

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-slate-100">选择 GitHub 仓库</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            只显示你担任管理员/所有者的公开仓库；私有仓库与 fork 不可提交。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{filtered.length} 个仓库</span>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <RefreshIcon />
            刷新
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 p-3">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索仓库名、描述或语言"
            aria-label="搜索仓库"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60"
          />
        </div>
      </div>

      {selectedRepo ? (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-indigo-500/5 px-4 py-2.5 text-sm">
          <span className="truncate text-slate-300">
            已选择 <span className="font-mono text-slate-100">{selectedRepo.fullName}</span>
          </span>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline"
          >
            清除
          </button>
        </div>
      ) : null}

      <div className="max-h-[340px] overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[74px] animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-rose-200">无法读取仓库列表：{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-xs text-indigo-300 underline-offset-2 hover:underline"
            >
              重试
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            {repos.length === 0
              ? '没有可提交的公开仓库（需本人或组织管理员，且非 fork）。'
              : '没有匹配的仓库，换个关键词试试。'}
          </p>
        ) : (
          groups.map(([owner, ownerRepos]) => {
            const first = ownerRepos[0];
            return (
              <div key={owner} className="pb-1">
                <div className="flex items-center gap-2 px-2 py-2 text-xs text-slate-400">
                  {first?.ownerAvatarUrl ? (
                    <img
                      src={first.ownerAvatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full border border-white/20"
                    />
                  ) : (
                    <span className="h-4 w-4 rounded-full bg-white/10" />
                  )}
                  <span className="font-medium text-slate-300">{owner}</span>
                  {first?.ownerType === 'Organization' ? (
                    <span className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] text-slate-500">
                      组织
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {ownerRepos.map((repo) => {
                    const isSelected = repo.fullName === selected;
                    return (
                      <button
                        key={repo.fullName}
                        type="button"
                        onClick={() => onSelect(repo)}
                        aria-pressed={isSelected}
                        className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? 'border-indigo-400/60 bg-indigo-500/10'
                            : 'border-transparent hover:border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-400">
                          <RepoIcon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-100">
                              {repo.name}
                            </span>
                            {repo.archived ? (
                              <span className="shrink-0 rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                                已归档
                              </span>
                            ) : null}
                            {isSelected ? (
                              <span className="ml-auto shrink-0 text-indigo-300">
                                <CheckIcon />
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-400">
                            {repo.description || '暂无描述'}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            {repo.language ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor:
                                      LANGUAGE_COLORS[repo.language] ?? 'var(--muted, #64748b)',
                                  }}
                                />
                                {repo.language}
                              </span>
                            ) : null}
                            <span>★ {formatNumber(repo.stars)}</span>
                            <span>更新于 {relativeTime(repo.pushedAt)}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
