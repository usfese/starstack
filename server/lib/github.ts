import { env } from '../env';

const USER_AGENT = 'starstack/1.0';
const API_BASE = 'https://api.github.com';
const DEFAULT_TIMEOUT_MS = 8_000;
const README_MAX_CHARS = 20_000;

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface RepoMeta {
  fullName: string;
  name: string;
  ownerLogin: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  topics: string[];
  license: string | null;
  homepage: string | null;
  createdAt: string | null;
  pushedAt: string | null;
  archived: boolean;
  fork: boolean;
  private: boolean;
}

interface RawRepo {
  full_name?: string;
  name?: string;
  owner?: { login?: string };
  description?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string | null;
  topics?: string[];
  license?: { spdx_id?: string | null; name?: string | null } | null;
  homepage?: string | null;
  created_at?: string | null;
  pushed_at?: string | null;
  archived?: boolean;
  fork?: boolean;
  private?: boolean;
}

export function githubErrorMessage(error: unknown): string {
  if (error instanceof GitHubError) {
    if (error.status === 404) return '仓库不存在或无权访问';
    if (error.status === 403) return 'GitHub 接口限流，请稍后重试';
    if (error.status === 401) return 'GitHub 授权已失效，请重新登录';
  }
  return 'GitHub 接口暂时不可用，请稍后重试';
}

async function ghFetch(
  path: string,
  options: { token?: string | null; accept?: string; timeoutMs?: number } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: options.accept ?? 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GitHubError(502, `GitHub 请求失败：${(error as Error).message}`);
  }
  return response;
}

function fakeRepoMeta(owner: string, name: string): RepoMeta {
  return {
    fullName: `${owner}/${name}`,
    name,
    ownerLogin: owner,
    description: '一个用于本地验证的示例仓库',
    stars: 1234,
    forks: 56,
    openIssues: 7,
    language: 'TypeScript',
    topics: ['web', 'framework', 'api'],
    license: 'MIT',
    homepage: 'https://example.com',
    createdAt: '2024-01-01T00:00:00.000Z',
    pushedAt: new Date().toISOString(),
    archived: false,
    fork: false,
    private: false,
  };
}

function fakeReadme(): string {
  return `# 示例仓库

这是一个用于本地验证的示例项目。它演示了 README 渲染、AI 评估与周榜流程，
**所有数据均为假数据**，仅用于开发调试。

## 安装

\`\`\`bash
bun install
bun run dev
\`\`\`

## 使用

1. 克隆仓库
2. 安装依赖
3. 启动开发服务器

## 特性

- 快速启动，零配置
- TypeScript 类型完整
- 内置测试与 CI

## 目录结构

| 目录 | 说明 |
| --- | --- |
| src | 源码 |
| tests | 测试 |

## 许可证

MIT
`.repeat(4);
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  if (env.devFakeGithub) return 'dev';

  let response: Response;
  try {
    response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.githubClientId,
        client_secret: env.githubClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GitHubError(502, `GitHub 换取 token 失败：${(error as Error).message}`);
  }

  if (!response.ok) {
    throw new GitHubError(response.status, 'GitHub 换取 token 失败');
  }

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new GitHubError(401, data.error_description || data.error || 'GitHub 未返回 access_token');
  }
  return data.access_token;
}

export async function fetchUser(token: string): Promise<GitHubUser> {
  if (env.devFakeGithub) {
    return { id: 0, login: 'dev', name: 'Dev User', avatarUrl: null };
  }

  const response = await ghFetch('/user', { token });
  if (response.status === 401) {
    throw new GitHubError(401, 'GitHub 授权无效');
  }
  if (!response.ok) {
    throw new GitHubError(response.status, `GitHub 用户信息读取失败（${response.status}）`);
  }
  const data = (await response.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
  };
  return {
    id: data.id,
    login: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url ?? null,
  };
}

export async function fetchRepo(
  owner: string,
  name: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<RepoMeta> {
  if (env.devFakeGithub) return fakeRepoMeta(owner, name);

  const response = await ghFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
    token: env.githubToken || null,
    timeoutMs,
  });
  if (response.status === 404) {
    throw new GitHubError(404, '仓库不存在或无权访问');
  }
  if (response.status === 403) {
    throw new GitHubError(403, 'GitHub 接口限流，请稍后重试');
  }
  if (!response.ok) {
    throw new GitHubError(response.status, `GitHub 仓库读取失败（${response.status}）`);
  }

  const data = (await response.json()) as RawRepo;
  return {
    fullName: data.full_name ?? `${owner}/${name}`,
    name: data.name ?? name,
    ownerLogin: data.owner?.login ?? owner,
    description: data.description ?? null,
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
    openIssues: data.open_issues_count ?? 0,
    language: data.language ?? null,
    topics: Array.isArray(data.topics) ? data.topics : [],
    license: data.license?.spdx_id ?? data.license?.name ?? null,
    homepage: data.homepage || null,
    createdAt: data.created_at ?? null,
    pushedAt: data.pushed_at ?? null,
    archived: data.archived === true,
    fork: data.fork === true,
    private: data.private === true,
  };
}

export async function fetchReadme(owner: string, name: string): Promise<string | null> {
  if (env.devFakeGithub) return fakeReadme();

  const response = await ghFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`, {
    token: env.githubToken || null,
    accept: 'application/vnd.github.raw',
    timeoutMs: 10_000,
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new GitHubError(response.status, `GitHub README 读取失败（${response.status}）`);
  }
  const text = await response.text();
  return text.slice(0, README_MAX_CHARS);
}

export async function isStarred(token: string, owner: string, name: string): Promise<boolean> {
  if (env.devFakeGithub) return true;

  const response = await ghFetch(
    `/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    { token },
  );
  if (response.status === 204) return true;
  if (response.status === 404) return false;
  if (response.status === 401) {
    throw new GitHubError(401, 'GitHub 授权已失效，请重新登录');
  }
  throw new GitHubError(response.status, `GitHub Star 校验失败（${response.status}）`);
}
