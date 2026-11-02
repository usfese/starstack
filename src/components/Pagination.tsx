export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="分页">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        上一页
      </button>
      <span className="text-sm text-slate-400">
        第 {page} / {totalPages} 页
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        下一页
      </button>
    </nav>
  );
}
