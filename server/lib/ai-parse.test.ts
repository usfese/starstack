import { describe, expect, test } from 'bun:test';
import { AiParseError, parseAiPayload } from './ai-parse';

const payload = {
  dimensions: {
    innovation: 70,
    engineering: 80,
    documentation: 60,
    maintainability: 75,
    usefulness: 90,
  },
  strengths: ['清晰', '实用', '可维护'],
  improvements: ['补文档', '加测试', '加示例'],
  summary: '整体不错。',
  tags: ['typescript', 'web'],
};

describe('parseAiPayload', () => {
  test('解析纯 JSON', () => {
    const result = parseAiPayload(JSON.stringify(payload));
    expect(result.total).toBe(75);
    expect(result.dimensions.engineering).toBe(80);
    expect(result.tags).toEqual(['typescript', 'web']);
  });

  test('从解释文字和 Markdown 围栏中提取 JSON', () => {
    const raw = `下面是评估结果：\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n希望有帮助。`;
    const result = parseAiPayload(raw);
    expect(result.strengths).toHaveLength(3);
    expect(result.summary).toBe('整体不错。');
  });

  test('字符串中的花括号不会截断对象', () => {
    const withBraces = { ...payload, summary: '用法是 {owner}/{repo}，不是 JSON。' };
    const raw = `结果如下：${JSON.stringify(withBraces)}`;
    expect(parseAiPayload(raw).summary).toBe('用法是 {owner}/{repo}，不是 JSON。');
  });

  test('没有 JSON 时抛出 AiParseError', () => {
    expect(() => parseAiPayload('模型拒绝了这次请求')).toThrow(AiParseError);
  });
});
