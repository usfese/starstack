import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AiSettingsDTO } from '../../shared/types';
import { ConfirmButton } from '../components/ConfirmButton';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, useApi } from '../lib/api';
import { formatDate, relativeTime, scoreColorClass } from '../lib/format';

interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface AdminStats {
  users: number;
  projects: number;
  publishedProjects: number;
  hiddenProjects: number;
  starsTotal: number;
  starsWeek: number;
  evaluations: { pending: number; running: number; done: number; failed: number };
  recentProjects: {
    id: number;
    title: string;
    repoFullName: string;
    status: string;
    createdAt: string;
    ownerLogin: string;
  }[];
  recentUsers: {
    id: number;
    login: string;
    avatarUrl: string | null;
    createdAt: string;
    projectCount: number;
  }[];
}

interface AdminProject {
  id: number;
  title: string;
  repoFullName: string;
  status: 'published' | 'hidden';
  createdAt: string;
  ownerId: number;
  ownerLogin: string;
  totalStars: number;
  weekStars: number;
  evalStatus: string | null;
  evalTotal: number | null;
  evalHeuristic: number | null;
  evalModel: string | null;
  evalError: string | null;
}

interface AdminUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: number;
  isBanned: number;
  createdAt: string;
  projectCount: number;
  starsGiven: number;
}

interface AdminEval {
  id: number;
  projectId: number;
  projectTitle: string;
  status: string;
  model: string;
  isHeuristic: number;
  totalScore: number | null;
  error: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'projects', label: '项目' },
  { key: 'users', label: '用户' },
  { key: 'evaluations', label: '评估' },
  { key: 'ai', label: 'AI 设置' },
];

const EVAL_STATUS_LABEL: Record<string, string> = {
  pending: '排队中',
  running: '评估中',
  done: '已完成',
  failed: '失败',
};

function useDebounced(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// 删除最后一页的唯一数据后把页码收敛回最后一页，避免空页且无分页控件。
function usePageClamp(
  meta: { total: number; pageSize: number } | null,
  page: number,
  setPage: (next: number) => void,
): void {
  useEffect(() => {
    if (!meta) return;
    const last = Math.max(1, Math.ceil(meta.total / meta.pageSize));
    if (page > last) setPage(last);
  }, [meta, page, setPage]);
}

export function Admin() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';

  const stats = useApi<AdminStats>(user?.isAdmin === true ? '/api/admin/stats' : null);

  const [projectQuery, setProjectQuery] = useState('');
  const [projectStatus, setProjectStatus] = useState('all');
  const [projectPage, setProjectPage] = useState(1);
  const debouncedProjectQuery = useDebounced(projectQuery);

  const [userQuery, setUserQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const debouncedUserQuery = useDebounced(userQuery);

  const [evalStatus, setEvalStatus] = useState('');
  const [evalPage, setEvalPage] = useState(1);

  const projects = useApi<Paged<AdminProject>>(
    tab === 'projects'
      ? `/api/admin/projects?q=${encodeURIComponent(debouncedProjectQuery)}&status=${projectStatus}&page=${projectPage}`
      : null,
  );
  const users = useApi<Paged<AdminUser>>(
    tab === 'users'
      ? `/api/admin/users?q=${encodeURIComponent(debouncedUserQuery)}&page=${userPage}`
      : null,
  );
  const evaluations = useApi<Paged<AdminEval>>(
    tab === 'evaluations'
      ? `/api/admin/evaluations?status=${evalStatus}&page=${evalPage}`
      : null,
  );

  const aiSettings = useApi<AiSettingsDTO>(tab === 'ai' ? '/api/admin/settings/ai' : null);
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiKey, setAiKey] = useState('');

  usePageClamp(projects.data, projectPage, setProjectPage);
  usePageClamp(users.data, userPage, setUserPage);
  usePageClamp(evaluations.data, evalPage, setEvalPage);

  useEffect(() => {
    if (!aiSettings.data) return;
    setAiBaseUrl(aiSettings.data.baseUrl);
    setAiModel(aiSettings.data.model);
    setAiKey('');
  }, [aiSettings.data]);

  const refreshAll = () => {
    stats.refresh();
    if (tab === 'projects') projects.refresh();
    else if (tab === 'users') users.refresh();
    else if (tab === 'evaluations') evaluations.refresh();
    else if (tab === 'ai') aiSettings.refresh();
  };

  const setProjectStatusById = async (id: number, status: 'published' | 'hidden') => {
    try {
      await api(`/api/admin/projects/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      toast.success(status === 'published' ? '项目已上架' : '项目已下架');
      refreshAll();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const reevaluate = async (id: number) => {
    try {
      await api(`/api/admin/projects/${id}/reevaluate`, { method: 'POST' });
      toast.success('已加入评估队列');
      refreshAll();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const deleteProject = async (id: number) => {
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' });
      toast.success('项目已删除');
      refreshAll();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const setBanned = async (id: number, banned: boolean) => {
    try {
      await api(`/api/admin/users/${id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ banned }),
      });
      toast.success(banned ? '用户已封禁' : '用户已解封');
      refreshAll();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const saveAi = async (): Promise<void> => {
    try {
      await api('/api/admin/settings/ai', {
        method: 'PUT',
        body: JSON.stringify({
          baseUrl: aiBaseUrl,
          model: aiModel,
          ...(aiKey ? { apiKey: aiKey } : {}),
        }),
      });
      setAiKey('');
      toast.success('AI 配置已保存');
      aiSettings.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const clearAiKey = async (): Promise<void> => {
    try {
      await api('/api/admin/settings/ai', { method: 'PUT', body: JSON.stringify({ apiKey: '' }) });
      toast.success('已清除保存的 API Key');
      aiSettings.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const testAi = async (): Promise<void> => {
    try {
      const result = await api<{ model: string; latencyMs: number }>(
        '/api/admin/settings/ai/test',
        { method: 'POST' },
      );
      toast.success(`连接成功（${result.model}，${result.latencyMs}ms）`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (user?.isAdmin !== true) {
    return <EmptyState title="无权访问管理面板" />;
  }

  const cell = 'px-3 py-2 align-top text-sm text-slate-300';
  const paginationBar = (page: number, total: number, setPage: (next: number) => void) =>
    total > 20 ? (
      <div className="flex items-center justify-end gap-2 text-sm text-slate-400">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40"
        >
          上一页
        </button>
        <span>第 {page} 页 / 共 {total} 条</span>
        <button
          type="button"
          onClick={() => setPage(page + 1)}
          disabled={page * 20 >= total}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-white">管理面板</h1>

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('tab', item.key);
              setParams(next);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === item.key
                ? 'bg-white/10 text-white'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        stats.loading ? (
          <Spinner />
        ) : stats.data ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: '用户数', value: stats.data.users },
                { label: '项目总数', value: stats.data.projects },
                { label: '已上架', value: stats.data.publishedProjects },
                { label: '已下架', value: stats.data.hiddenProjects },
                { label: '本站 Star 总数', value: stats.data.starsTotal },
                { label: '本周 Star', value: stats.data.starsWeek },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <p className="text-sm text-slate-400">
              评估队列：排队 {stats.data.evaluations.pending} · 进行中{' '}
              {stats.data.evaluations.running} · 完成 {stats.data.evaluations.done} · 失败{' '}
              {stats.data.evaluations.failed}
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table className="w-full">
                  <caption className="px-4 py-3 text-left text-sm font-medium text-white">
                    最近项目
                  </caption>
                  <tbody className="divide-y divide-white/5">
                    {stats.data.recentProjects.map((project) => (
                      <tr key={project.id}>
                        <td className={cell}>
                          <Link to={`/projects/${project.id}`} className="hover:text-indigo-300">
                            {project.title}
                          </Link>
                        </td>
                        <td className={cell}>{project.ownerLogin}</td>
                        <td className={cell}>
                          {project.status === 'published' ? '已上架' : '已下架'}
                        </td>
                        <td className={cell}>{relativeTime(project.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table className="w-full">
                  <caption className="px-4 py-3 text-left text-sm font-medium text-white">
                    最近用户
                  </caption>
                  <tbody className="divide-y divide-white/5">
                    {stats.data.recentUsers.map((item) => (
                      <tr key={item.id}>
                        <td className={cell}>{item.login}</td>
                        <td className={cell}>{item.projectCount} 个项目</td>
                        <td className={cell}>{relativeTime(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="统计数据加载失败" hint={stats.error?.message} />
        )
      ) : null}

      {tab === 'projects' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <input
              value={projectQuery}
              onChange={(event) => {
                setProjectQuery(event.target.value);
                setProjectPage(1);
              }}
              placeholder="搜索项目或 owner"
              aria-label="搜索项目"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <select
              value={projectStatus}
              onChange={(event) => {
                setProjectStatus(event.target.value);
                setProjectPage(1);
              }}
              aria-label="状态筛选"
              className="rounded-lg border border-white/10 bg-[#111823] px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">全部状态</option>
              <option value="published">已上架</option>
              <option value="hidden">已下架</option>
            </select>
          </div>

          {projects.loading ? <Spinner /> : null}

          {projects.data ? (
            <>
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table className="w-full">
                  <thead className="text-left text-xs text-slate-400">
                    <tr className="border-b border-white/10">
                      <th className={cell}>项目</th>
                      <th className={cell}>owner</th>
                      <th className={cell}>状态</th>
                      <th className={cell}>AI 分</th>
                      <th className={cell}>本周星</th>
                      <th className={cell}>评估</th>
                      <th className={cell}>操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {projects.data.items.map((project) => (
                      <tr key={project.id}>
                        <td className={cell}>
                          <Link to={`/projects/${project.id}`} className="hover:text-indigo-300">
                            {project.title}
                          </Link>
                          <span className="block text-xs text-slate-500">{project.repoFullName}</span>
                        </td>
                        <td className={cell}>{project.ownerLogin}</td>
                        <td className={cell}>
                          {project.status === 'published' ? '已上架' : '已下架'}
                        </td>
                        <td className={cell}>
                          {project.evalTotal === null ? (
                            '—'
                          ) : (
                            <span className={scoreColorClass(project.evalTotal)}>
                              {project.evalTotal}
                              {project.evalHeuristic === 1 ? '（启发式）' : ''}
                            </span>
                          )}
                        </td>
                        <td className={cell}>{project.weekStars}</td>
                        <td className={cell}>
                          {project.evalStatus ? EVAL_STATUS_LABEL[project.evalStatus] ?? project.evalStatus : '—'}
                        </td>
                        <td className={cell}>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void setProjectStatusById(
                                  project.id,
                                  project.status === 'published' ? 'hidden' : 'published',
                                )
                              }
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                            >
                              {project.status === 'published' ? '下架' : '上架'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void reevaluate(project.id)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                            >
                              重新评估
                            </button>
                            <ConfirmButton
                              label="删除"
                              confirmLabel="确认删除？"
                              onConfirm={() => void deleteProject(project.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginationBar(projectPage, projects.data.total, setProjectPage)}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'users' ? (
        <div className="flex flex-col gap-4">
          <input
            value={userQuery}
            onChange={(event) => {
              setUserQuery(event.target.value);
              setUserPage(1);
            }}
            placeholder="搜索用户"
            aria-label="搜索用户"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 sm:max-w-xs"
          />

          {users.loading ? <Spinner /> : null}

          {users.data ? (
            <>
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table className="w-full">
                  <thead className="text-left text-xs text-slate-400">
                    <tr className="border-b border-white/10">
                      <th className={cell}>用户</th>
                      <th className={cell}>项目数</th>
                      <th className={cell}>给星数</th>
                      <th className={cell}>注册时间</th>
                      <th className={cell}>状态</th>
                      <th className={cell}>操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.data.items.map((item) => (
                      <tr key={item.id}>
                        <td className={cell}>
                          {item.login}
                          {item.isAdmin === 1 ? (
                            <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[11px] text-indigo-200">
                              管理员
                            </span>
                          ) : null}
                        </td>
                        <td className={cell}>{item.projectCount}</td>
                        <td className={cell}>{item.starsGiven}</td>
                        <td className={cell}>{formatDate(item.createdAt)}</td>
                        <td className={cell}>{item.isBanned === 1 ? '已封禁' : '正常'}</td>
                        <td className={cell}>
                          {item.id === user?.id ? (
                            <span className="text-xs text-slate-500">当前账号</span>
                          ) : item.isBanned === 1 ? (
                            <button
                              type="button"
                              onClick={() => void setBanned(item.id, false)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                            >
                              解封
                            </button>
                          ) : (
                            <ConfirmButton
                              label="封禁"
                              confirmLabel="确认封禁？"
                              onConfirm={() => void setBanned(item.id, true)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginationBar(userPage, users.data.total, setUserPage)}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'evaluations' ? (
        <div className="flex flex-col gap-4">
          <select
            value={evalStatus}
            onChange={(event) => {
              setEvalStatus(event.target.value);
              setEvalPage(1);
            }}
            aria-label="评估状态筛选"
            className="w-fit rounded-lg border border-white/10 bg-[#111823] px-3 py-2 text-sm text-slate-200"
          >
            <option value="">全部状态</option>
            <option value="pending">排队中</option>
            <option value="running">评估中</option>
            <option value="done">已完成</option>
            <option value="failed">失败</option>
          </select>

          {evaluations.loading ? <Spinner /> : null}

          {evaluations.data ? (
            <>
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table className="w-full">
                  <thead className="text-left text-xs text-slate-400">
                    <tr className="border-b border-white/10">
                      <th className={cell}>项目</th>
                      <th className={cell}>状态</th>
                      <th className={cell}>模型</th>
                      <th className={cell}>分数</th>
                      <th className={cell}>尝试</th>
                      <th className={cell}>更新时间</th>
                      <th className={cell}>操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {evaluations.data.items.map((item) => (
                      <tr key={item.id}>
                        <td className={cell}>
                          <Link to={`/projects/${item.projectId}`} className="hover:text-indigo-300">
                            {item.projectTitle}
                          </Link>
                        </td>
                        <td className={cell}>
                          {EVAL_STATUS_LABEL[item.status] ?? item.status}
                          {item.error ? (
                            <span className="mt-1 block max-w-xs break-words text-xs text-rose-300">
                              {item.error}
                            </span>
                          ) : null}
                        </td>
                        <td className={cell}>
                          {item.model}
                          {item.isHeuristic === 1 ? '（启发式）' : ''}
                        </td>
                        <td className={cell}>{item.totalScore ?? '—'}</td>
                        <td className={cell}>{item.attemptCount}</td>
                        <td className={cell}>{relativeTime(item.updatedAt)}</td>
                        <td className={cell}>
                          <button
                            type="button"
                            onClick={() => void reevaluate(item.projectId)}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                          >
                            重新评估
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginationBar(evalPage, evaluations.data.total, setEvalPage)}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'ai' ? (
        aiSettings.loading ? (
          <Spinner />
        ) : aiSettings.data ? (
          <div className="flex max-w-xl flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-slate-300">
              {aiSettings.data.hasApiKey
                ? `已配置密钥${aiSettings.data.apiKeyHint ? `（${aiSettings.data.apiKeyHint}）` : ''}，来源：${
                    aiSettings.data.sources.apiKey === 'db' ? '面板设置' : '环境变量'
                  }`
                : '未配置密钥：评估会退回启发式评分，填入地址与 API Key 后立即启用 AI。'}
            </div>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              接口地址
              <input
                value={aiBaseUrl}
                onChange={(event) => setAiBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              API Key
              <input
                type="password"
                value={aiKey}
                onChange={(event) => setAiKey(event.target.value)}
                placeholder={aiSettings.data.apiKeyHint ?? '未设置'}
                autoComplete="off"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              模型
              <input
                value={aiModel}
                onChange={(event) => setAiModel(event.target.value)}
                placeholder="gpt-4o-mini"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveAi()}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => void testAi()}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
              >
                测试连接
              </button>
              <button
                type="button"
                onClick={() => void clearAiKey()}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
              >
                清除已保存密钥
              </button>
            </div>
          </div>
        ) : (
          <EmptyState title="读取 AI 配置失败" hint={aiSettings.error?.message} />
        )
      ) : null}
    </div>
  );
}
