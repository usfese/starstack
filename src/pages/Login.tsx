import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/api';

const ERROR_MESSAGES: Record<string, string> = {
  banned: '账号已被封禁',
  state: '登录状态已过期，请重试',
  oauth: '登录失败，请重试',
};

interface HealthResponse {
  ok: boolean;
  devFakeGithub: boolean;
  githubOAuth: boolean;
}

const GITHUB_ICON = (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-5 w-5 fill-current">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);

export function Login() {
  const [params] = useSearchParams();
  const error = params.get('error');
  const message = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.oauth) : null;

  // 开发环境用假登录时 GitHub OAuth 未配置，直接给 GitHub 链接只会落到 GitHub 的 404。
  const health = useApi<HealthResponse>('/api/health');
  const devFakeGithub = health.data?.devFakeGithub === true;
  const [login, setLogin] = useState('');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-white/10 bg-white/5 p-8">
      <div>
        <h1 className="text-xl font-semibold text-white">登录星栈</h1>
        <p className="mt-2 text-sm text-slate-400">
          仅读取公开资料；Star 通过 GitHub 官方接口由你本人完成，本站不代点。
        </p>
      </div>

      {message ? (
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {message}
        </p>
      ) : null}

      {devFakeGithub ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = login.trim();
            if (!value) return;
            window.location.href = `/auth/dev/login?login=${encodeURIComponent(value)}`;
          }}
        >
          <label className="text-sm text-slate-300" htmlFor="dev-login">
            开发环境假登录
          </label>
          <input
            id="dev-login"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="GitHub 用户名，例如 honojs"
            autoComplete="off"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60"
          />
          <button
            type="submit"
            disabled={login.trim().length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            开发登录
          </button>
          <p className="text-xs text-slate-500">
            当前 <code className="rounded bg-white/10 px-1">DEV_FAKE_GITHUB=1</code>，未配置真实 GitHub
            OAuth；填任意用户名即可登录，`ADMIN_GITHUB_LOGINS` 内的用户名获得管理员权限。
          </p>
        </form>
      ) : health.data?.githubOAuth ? (
        <a
          href="/auth/github"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 font-medium text-slate-900 hover:bg-slate-100"
        >
          {GITHUB_ICON}
          使用 GitHub 登录
        </a>
      ) : health.data ? (
        <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          服务端未配置 GitHub OAuth（GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET），且未开启
          DEV_FAKE_GITHUB；请补齐环境变量后重启。
        </p>
      ) : null}

      <p className="text-xs text-slate-500">
        登录即表示同意本站使用你的 GitHub 公开资料（头像、用户名）展示项目。
        <Link to="/" className="ml-1 underline hover:text-slate-300">
          返回首页
        </Link>
      </p>
    </div>
  );
}
