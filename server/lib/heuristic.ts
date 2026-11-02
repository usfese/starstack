import type { Dimensions } from '../../shared/types';
import type { EvalInput, EvaluationResult } from './ai';

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function evaluateHeuristic({ repo, readme }: EvalInput): EvaluationResult {
  const readmeLength = readme ? readme.length : 0;
  const pushedAt = repo.pushedAt ? Date.parse(repo.pushedAt) : Number.NaN;
  const recent = Number.isFinite(pushedAt) && Date.now() - pushedAt <= 180 * DAY_MS;
  const topicN = repo.topics.length;
  const hasHomepage = Boolean(repo.homepage);
  const hasLicense = Boolean(repo.license);
  const hasDescription = Boolean(repo.description);

  const innovation =
    30 +
    Math.min(25, topicN * 5) +
    (hasHomepage ? 10 : 0) +
    (repo.stars >= 500 ? 25 : repo.stars >= 100 ? 18 : repo.stars >= 20 ? 10 : 0);

  const engineering =
    35 +
    (readmeLength >= 2000 ? 15 : readmeLength >= 500 ? 10 : 0) +
    (hasLicense ? 15 : 0) +
    (recent ? 20 : 0) +
    (repo.forks >= 20 ? 10 : repo.forks >= 5 ? 5 : 0);

  const documentation =
    20 +
    (readmeLength >= 4000 ? 45 : readmeLength >= 1500 ? 35 : readmeLength >= 400 ? 20 : 5) +
    (hasDescription ? 15 : 0) +
    (hasLicense ? 10 : 0);

  const maintainability =
    30 + (recent ? 30 : 0) + (hasLicense ? 15 : 0) + (topicN >= 3 ? 10 : 0) - (repo.archived ? 30 : 0);

  const usefulness =
    25 +
    Math.min(35, Math.floor(repo.stars / 10)) +
    (hasDescription ? 15 : 0) +
    (hasHomepage ? 10 : 0) +
    (topicN >= 2 ? 10 : 0);

  const dimensions: Dimensions = {
    innovation: clamp(innovation),
    engineering: clamp(engineering),
    documentation: clamp(documentation),
    maintainability: clamp(maintainability),
    usefulness: clamp(usefulness),
  };

  const candidates: [boolean, string][] = [
    [readmeLength >= 1500, 'README 文档较完整'],
    [hasLicense, '包含开源许可证'],
    [recent, '近期仍在维护'],
    [repo.stars >= 20, '已获得社区关注'],
    [hasHomepage, '提供在线演示地址'],
    [hasDescription, '项目描述清晰'],
  ];

  const strengths = candidates
    .filter(([condition]) => condition)
    .map(([, label]) => label)
    .slice(0, 3);
  const padding = ['项目已公开可供体验', '结构简洁，便于阅读', '具备进一步打磨的基础'];
  for (const item of padding) {
    if (strengths.length >= 3) break;
    strengths.push(item);
  }

  const total = Math.round(
    (dimensions.innovation +
      dimensions.engineering +
      dimensions.documentation +
      dimensions.maintainability +
      dimensions.usefulness) /
      5,
  );

  return {
    dimensions,
    strengths,
    improvements: ['补充更完整的 README（安装、使用、截图）', '添加自动化测试与 CI', '补充在线演示或示例项目'],
    summary: '启发式评分：未配置 AI_API_KEY，本分数根据仓库元数据与 README 篇幅估算，仅供排序参考。',
    tags: repo.topics.slice(0, 5),
    total,
  };
}
