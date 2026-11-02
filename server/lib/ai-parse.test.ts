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
    expect(result.strengths).toHaveLength(2);
    expect(result.summary).toBe('整体不错。');
  });

  test('字符串中的花括号不会截断对象', () => {
    const withBraces = { ...payload, summary: '用法是 {owner}/{repo}，不是 JSON。' };
    const raw = `结果如下：${JSON.stringify(withBraces)}`;
    expect(parseAiPayload(raw).summary).toBe('用法是 {owner}/{repo}，不是 JSON。');
  });

  test('优点和改进建议最多两条且截短', () => {
    const long = {
      ...payload,
      strengths: ['一条非常非常长的优点描述，长到不可能塞进分享图里，需要被截断', '第二条很长的优点描述，同样需要被截断', '第三条应该被丢弃'],
      improvements: ['一条非常非常长的改进建议，长到不可能塞进分享图里，需要被截断', '第二条很长的改进建议，同样需要被截断', '第三条应该被丢弃'],
    };
    const result = parseAiPayload(JSON.stringify(long));
    expect(result.strengths).toHaveLength(2);
    expect(result.improvements).toHaveLength(2);
    for (const item of [...result.strengths, ...result.improvements]) {
      expect(item.length).toBeLessThanOrEqual(24);
    }
  });

  test('没有 JSON 时抛出 AiParseError', () => {
    expect(() => parseAiPayload('模型拒绝了这次请求')).toThrow(AiParseError);
  });
});
