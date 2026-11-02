export function Spinner({ label = '加载中' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-400" role="status">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
