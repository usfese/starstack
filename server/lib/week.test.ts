import { describe, expect, test } from 'bun:test';
import { getWeekRange, weekRangeFromIso } from './week';

describe('getWeekRange', () => {
  test('周日 23:59:59（上海时间）仍属上一周', () => {
    const r = getWeekRange(new Date('2026-10-25T15:59:59Z'));
    expect(r.key).toBe('2026-W43');
    expect(r.start).toBe('2026-10-18T16:00:00.000Z');
    expect(r.end).toBe('2026-10-25T16:00:00.000Z');
  });

  test('周一 00:00:00（上海时间）进入新的一周', () => {
    const r = getWeekRange(new Date('2026-10-25T16:00:00Z'));
    expect(r.key).toBe('2026-W44');
    expect(r.start).toBe('2026-10-25T16:00:00.000Z');
    expect(r.end).toBe('2026-11-01T16:00:00.000Z');
  });

  test('跨年：2025-12-29（上海）属于 2026-W01', () => {
    const r = getWeekRange(new Date('2025-12-28T16:00:00Z'));
    expect(r.key).toBe('2026-W01');
    expect(r.start).toBe('2025-12-28T16:00:00.000Z');
    expect(r.end).toBe('2026-01-04T16:00:00.000Z');
  });

  test('周中时间取当周起点', () => {
    const r = getWeekRange(new Date('2026-10-30T03:12:45.123Z'));
    expect(r.key).toBe('2026-W44');
    expect(r.start).toBe('2026-10-25T16:00:00.000Z');
  });

  test('start/end 为左闭右开且相差 7 天', () => {
    const r = getWeekRange(new Date('2024-02-29T05:00:00Z'));
    expect(new Date(r.end).getTime() - new Date(r.start).getTime()).toBe(7 * 24 * 3600 * 1000);
  });
});

describe('weekRangeFromIso', () => {
  test('合法 ISO 时间与 getWeekRange 完全一致', () => {
    const iso = '2026-10-30T03:12:45.123Z';
    const fromIso = weekRangeFromIso(iso);
    const direct = getWeekRange(new Date(iso));
    expect(fromIso).not.toBeNull();
    expect(fromIso?.key).toBe(direct.key);
    expect(fromIso?.start).toBe(direct.start);
    expect(fromIso?.end).toBe(direct.end);
  });

  test('脏字符串返回 null', () => {
    expect(weekRangeFromIso('garbage')).toBeNull();
  });

  test('空字符串返回 null', () => {
    expect(weekRangeFromIso('')).toBeNull();
  });
});
