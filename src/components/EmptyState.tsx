import type { ReactNode } from 'react';

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
      <p className="text-base text-slate-300">{title}</p>
      {hint ? <p className="max-w-md text-sm text-slate-400">{hint}</p> : null}
      {action}
    </div>
  );
}
