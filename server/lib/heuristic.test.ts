import { describe, expect, test } from 'bun:test';
import type { RepoMeta } from './github';
import { evaluateHeuristic } from './heuristic';

const DAY = 24 * 60 * 60 * 1000;

function repo(overrides: Partial<RepoMeta> = {}): RepoMeta {
  return {
    fullName: 'a/b',
    name: 'b',
    ownerLogin: 'a',
    description: '描述',
    stars: 0,
    forks: 0,
    openIssues: 0,
    language: 'TypeScript',
    topics: ['x', 'y'],
    license: 'MIT',
    homepage: 'https://a.dev',
    createdAt: null,
    pushedAt: new Date(Date.now() - 10 * DAY).toISOString(),
    archived: false,
    fork: false,
    private: false,
    ...overrides,
  };
}

function evaluate(overrides: Partial<RepoMeta> = {}, readme: string | null = null) {
  return evaluateHeuristic({ repo: repo(overrides), readme, introMd: '' });
}

describe('evaluateHeuristic', () => {
  test('无 README 时文档分封顶在基线 50', () => {
    expect(evaluate({}, null).dimensions.documentation).toBe(50);
  });

  test('README 越长文档分越高', () => {
    expect(evaluate({}, 'x'.repeat(4000)).dimensions.documentation).toBe(90);
  });

  test('零 star 的实用价值为基线 60', () => {
    expect(evaluate({ stars: 0 }).dimensions.usefulness).toBe(60);
  });

  test('500 star 时实用价值触及上界 95', () => {
    expect(evaluate({ stars: 500 }).dimensions.usefulness).toBe(95);
  });

  test('归档 + 无许可证 + 长期未推送 + 无话题时维护分 clamp 到 0', () => {
    const result = evaluate({
      archived: true,
      license: null,
      pushedAt: new Date(Date.now() - 400 * DAY).toISOString(),
      topics: [],
    });
    expect(result.dimensions.maintainability).toBe(0);
  });

  test('strengths 恒定 3 条（不足时用固定文案补齐）', () => {
    expect(evaluate({}, null).strengths).toHaveLength(3);
    expect(evaluate({ stars: 500 }, 'x'.repeat(4000)).strengths).toHaveLength(3);
  });

  test('tags 取 topics 前 5 个', () => {
    const result = evaluate({ topics: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(result.tags).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('total 是五维均值的四舍五入', () => {
    const result = evaluate({}, 'x'.repeat(4000));
    const dims = result.dimensions;
    const mean =
      (dims.innovation +
        dims.engineering +
        dims.documentation +
        dims.maintainability +
        dims.usefulness) /
      5;
    expect(result.total).toBe(Math.round(mean));
  });
});
