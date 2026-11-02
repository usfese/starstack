import { ApiError } from './errors';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * 固定窗口限流：键为 `${userId}:${bucket}`。单实例内存实现。
 */
export function enforceRateLimit(
  userId: number,
  bucket: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  cleanup(now);
  const key = `${userId}:${bucket}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw new ApiError(429, 'RATE_LIMITED', '操作过于频繁，请稍后再试', undefined, retryAfter);
  }

  existing.count += 1;
}
