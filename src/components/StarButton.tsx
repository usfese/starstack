import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectDetail } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';

interface VerifyResponse {
  verified: boolean;
  already: boolean;
  weekStars: number;
  totalStars: number;
}

export function StarButton({
  project,
  onVerified,
}: {
  project: ProjectDetail;
  onVerified: () => void;
}) {
  const { user, loading, refresh } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);

  if (loading) {
    return <div className="h-10 animate-pulse rounded-lg bg-white/5" />;
  }

  if (!user) {
    return (
      <Link
        to="/login"
        className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
      >
        {authFailed ? '重新登录' : '登录后参与'}
      </Link>
    );
  }
  if (project.viewer.isOwner) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-slate-400">
        这是你的项目
      </div>
    );
  }

  if (project.viewer.starred) {
    return (
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-center text-sm text-emerald-300">
        已认证 ✓
      </div>
    );
  }

  const verify = async () => {
    setBusy(true);
    try {
      const result = await api<VerifyResponse>(`/api/projects/${project.id}/star/verify`, {
        method: 'POST',
      });
      toast.success(result.already ? '该项目你已经认证过了' : '已验证，感谢点亮！');
      onVerified();
    } catch (error) {
      const err = error as ApiError;
      if (err.status === 401 || err.code === 'GITHUB_AUTH' || err.code === 'BANNED') {
        setAuthFailed(true);
        void refresh();
      }
      toast.error(err.message || '验证失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          window.open(`https://github.com/${project.repoFullName}`, '_blank', 'noopener,noreferrer');
          setAwaitingVerify(true);
        }}
        className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
      >
        去 GitHub Star
      </button>

      {awaitingVerify ? (
        <button
          type="button"
          onClick={verify}
          disabled={busy}
          className="inline-flex w-full items-center justify-center rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? '验证中…' : '验证我已 Star'}
        </button>
      ) : (
        <p className="text-xs text-slate-500">先在 GitHub 上 Star，然后回到这里验证。</p>
      )}

      {authFailed ? (
        <p className="text-xs text-rose-300">
          GitHub 授权已失效，
          <Link to="/login" className="underline">
            重新登录
          </Link>
          后再试。
        </p>
      ) : null}
    </div>
  );
}
