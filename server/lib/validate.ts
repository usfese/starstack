import { z } from 'zod';
import { TAG_VALUES, type Tag } from '../../shared/constants';

const tagEnum = z.enum(TAG_VALUES as [Tag, ...Tag[]]);

export const projectListQuerySchema = z.object({
  sort: z.enum(['latest', 'stars_week', 'score', 'needs']).default('latest'),
  q: z.string().trim().max(100).optional(),
  tag: tagEnum.optional(),
  page: z.coerce.number().int().min(1).max(10_000, '页码超出范围').default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const submitProjectSchema = z.object({
  repo: z.string().trim().min(1, '请填写仓库'),
  title: z.string().trim().min(2, '标题至少 2 个字').max(80, '标题最多 80 个字'),
  intro: z.string().trim().min(20, '项目介绍至少 20 个字').max(5000, '项目介绍最多 5000 字'),
  demoUrl: z.string().trim().max(500, '演示地址过长').optional(),
  tags: z.array(tagEnum).max(3, '最多选择 3 个标签').default([]),
});

export const editProjectSchema = z
  .object({
    title: z.string().trim().min(2, '标题至少 2 个字').max(80, '标题最多 80 个字').optional(),
    intro: z
      .string()
      .trim()
      .min(20, '项目介绍至少 20 个字')
      .max(5000, '项目介绍最多 5000 字')
      .optional(),
    demoUrl: z.string().trim().max(500, '演示地址过长').optional(),
    tags: z.array(tagEnum).max(3, '最多选择 3 个标签').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: '没有需要更新的字段' });

/**
 * 解析 owner/repo 或 https://github.com/owner/repo(.git)，非法返回 null。
 */
export function parseRepoInput(input: string): { owner: string; name: string } | null {
  const stripped = input
    .trim()
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, '')
    .trim();
  const match = /^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100}?)(?:\.git)?\/?$/.exec(stripped);
  if (!match) return null;
  const owner = match[1]!;
  const name = match[2]!;
  if (/^\.+$/.test(owner) || /^\.+$/.test(name)) return null;
  return { owner, name };
}

/**
 * 返回规范化后的演示地址；空字符串视为未填写；非法返回 'invalid'。
 */
export function normalizeDemoUrl(raw: string | undefined | null): string | null | 'invalid' {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (value.length > 500) return 'invalid';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid';
    return url.toString();
  } catch {
    return 'invalid';
  }
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? '请求参数不正确';
}

/**
 * 把用户输入转成 LIKE 模式，转义 `\`、`%`、`_` 避免通配符注入。
 * 拼进 SQL 时需配合 `ESCAPE '\'`。
 */
export function likePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export function parsePage(raw: string | undefined, limit: number, fallback = 1): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, limit);
}
