import { useEffect, useRef, useState } from 'react';

export function ConfirmButton({
  label,
  confirmLabel = '确认',
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!armed) return;
    timer.current = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer.current);
  }, [armed]);

  const base =
    'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors';

  return (
    <button
      type="button"
      aria-label={armed ? confirmLabel : label}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={`${base} ${
        armed
          ? 'border-rose-400/60 bg-rose-500/20 text-rose-100'
          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
      }`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
