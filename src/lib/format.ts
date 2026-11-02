const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '—';

  const diff = Date.now() - time;
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 2 * DAY) return '昨天';
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return formatDate(iso);
}

const weekFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
});

export function formatWeekRange(start: string, end: string): string {
  const endDate = new Date(end);
  const startLabel = weekFormatter.format(new Date(start));
  const endLabel = weekFormatter.format(new Date(endDate.getTime() - 1));
  return `${startLabel} – ${endLabel}`;
}

export function scoreColorClass(total: number): string {
  if (total >= 80) return 'text-emerald-400';
  if (total >= 60) return 'text-indigo-400';
  return 'text-amber-400';
}

export function scoreBarClass(total: number): string {
  if (total >= 80) return 'bg-emerald-400';
  if (total >= 60) return 'bg-indigo-400';
  return 'bg-amber-400';
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}
