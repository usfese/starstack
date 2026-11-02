import { describe, expect, test } from 'bun:test';
import {
  likePattern,
  normalizeDemoUrl,
  parseRepoInput,
  projectListQuerySchema,
} from './validate';

describe('parseRepoInput', () => {
  test('接受 owner/repo', () => {
    expect(parseRepoInput('honojs/hono')).toEqual({ owner: 'honojs', name: 'hono' });
  });

  test('接受带 .git 的 GitHub 链接', () => {
    expect(parseRepoInput('https://github.com/honojs/hono.git')).toEqual({
      owner: 'honojs',
      name: 'hono',
    });
  });

  test('接受结尾斜杠的 GitHub 链接', () => {
    expect(parseRepoInput('https://github.com/honojs/hono/')).toEqual({
      owner: 'honojs',
      name: 'hono',
    });
  });

  test('拒绝缺少 owner 或层级过深的输入', () => {
    expect(parseRepoInput('a')).toBeNull();
    expect(parseRepoInput('a/b/c')).toBeNull();
    expect(parseRepoInput('github.com/a/b')).toBeNull();
  });

  test('拒绝纯点的 owner/name', () => {
    expect(parseRepoInput('a/..')).toBeNull();
  });
});

describe('normalizeDemoUrl', () => {
  test('空值视为未填写', () => {
    expect(normalizeDemoUrl('')).toBeNull();
    expect(normalizeDemoUrl(undefined)).toBeNull();
  });

  test('http(s) 链接原样返回', () => {
    expect(normalizeDemoUrl('https://x.com/a')).toBe('https://x.com/a');
  });

  test('非 http(s)、非法与超长输入返回 invalid', () => {
    expect(normalizeDemoUrl('ftp://x')).toBe('invalid');
    expect(normalizeDemoUrl('not a url')).toBe('invalid');
    expect(normalizeDemoUrl('a'.repeat(501))).toBe('invalid');
  });
});

describe('likePattern', () => {
  test('转义 %、_、\\ 各一次', () => {
    expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});

describe('projectListQuerySchema', () => {
  test('page=10000 通过', () => {
    expect(projectListQuerySchema.safeParse({ page: '10000' }).success).toBe(true);
  });

  test('page=10001 拒绝', () => {
    expect(projectListQuerySchema.safeParse({ page: '10001' }).success).toBe(false);
  });

  test('page=1e308 拒绝', () => {
    expect(projectListQuerySchema.safeParse({ page: '1e308' }).success).toBe(false);
  });
});
