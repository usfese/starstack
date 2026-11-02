const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeekRange {
  key: string;
  start: string;
  end: string;
}

function isoWeekKey(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const weekNo = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * 以 Asia/Shanghai 周一 00:00 为界的自然周（左闭右开）。
 */
export function getWeekRange(now: Date = new Date()): WeekRange {
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const dow = shifted.getUTCDay();
  const diff = (dow + 6) % 7;

  const startMs = Date.UTC(y, m, d - diff) - SHANGHAI_OFFSET_MS;
  const endMs = startMs + WEEK_MS;

  return {
    key: isoWeekKey(y, m, d),
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

/** 解析失败返回 null，供读取历史时间戳的调用方跳过脏数据。 */
export function weekRangeFromIso(raw: string): WeekRange | null {
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return null;
  return getWeekRange(new Date(time));
}
