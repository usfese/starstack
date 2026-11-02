import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CommentCreateResponse, CommentDTO, CommentsResponse } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import { relativeTime } from '../lib/format';
import { ConfirmButton } from './ConfirmButton';

const PAGE_SIZE = 20;

function Avatar({ url, login }: { url: string | null; login: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full border border-white/10"
        loading="lazy"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
      {login.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Comments({ projectId }: { projectId: number }) {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<CommentDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api<CommentsResponse>(`/api/projects/${projectId}/comments?page=1&pageSize=${PAGE_SIZE}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setPage(1);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : '加载评论失败，请稍后重试');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, user?.id, reload]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await api<CommentsResponse>(
        `/api/projects/${projectId}/comments?page=${nextPage}&pageSize=${PAGE_SIZE}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setPage(nextPage);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '加载更多评论失败');
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value) return;

    setPosting(true);
    try {
      const data = await api<CommentCreateResponse>(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: value }),
      });
      setItems((prev) => [data.comment, ...prev]);
      setTotal((prev) => prev + 1);
      setContent('');
      toast.success('评论已发布');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '评论发布失败，请稍后重试');
    } finally {
      setPosting(false);
    }
  };

  const remove = async (commentId: number) => {
    try {
      await api(`/api/projects/${projectId}/comments/${commentId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.id !== commentId));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success('评论已删除');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除评论失败');
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">
          评论 <span className="text-sm font-normal text-slate-400">{total}</span>
        </h2>
        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10"
        >
          刷新
        </button>
      </div>

      {user ? (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="写下你的看法…"
            className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{content.length}/1000</span>
            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {posting ? '发布中…' : '发表评论'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
          <Link to="/login" className="text-indigo-300 hover:underline">
            登录
          </Link>
          {' '}后参与评论。
        </p>
      )}

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}{' '}
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="underline underline-offset-2"
          >
            重试
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1].map((item) => (
            <div key={item} className="flex gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-full animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <p className="mt-6 text-center text-sm text-slate-500">还没有评论，来抢沙发。</p>
      ) : (
        <div className="mt-4 divide-y divide-white/10">
          {items.map((comment) => (
            <article key={comment.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
              <Avatar url={comment.author.avatarUrl} login={comment.author.login} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium text-slate-100">
                    {comment.author.name || comment.author.login}
                  </span>
                  <span className="text-xs text-slate-500">@{comment.author.login}</span>
                  {comment.author.isAdmin ? (
                    <span className="rounded border border-indigo-400/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-200">
                      管理员
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-500">{relativeTime(comment.createdAt)}</span>
                  {comment.canDelete ? (
                    <span className="ml-auto">
                      <ConfirmButton
                        label="删除"
                        confirmLabel="确认删除？"
                        onConfirm={() => void remove(comment.id)}
                      />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                  {comment.content}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {items.length < total ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {loadingMore ? '加载中…' : '加载更多'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
