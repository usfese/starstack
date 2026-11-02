export type ToastKind = 'success' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(320px,90vw)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
            toast.kind === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
              : 'border-rose-400/40 bg-rose-500/15 text-rose-100'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
