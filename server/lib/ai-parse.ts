import type { Dimensions } from '../../shared/types';

export interface EvaluationResult {
  dimensions: Dimensions;
  strengths: string[];
  improvements: string[];
  summary: string;
  tags: string[];
  total: number;
}

export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiParseError';
  }
}

function clampScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AiParseError('维度分数缺失或不是数字');
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function cleanList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, max);
}

/**
 * 从可能包含解释文字 / Markdown 围栏的回复中截取第一个完整的 JSON 对象。
 * 通过字符串/转义状态避免把 JSON 字符串里的花括号当成结构。
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

export function parseAiPayload(raw: string): EvaluationResult {
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (!text) throw new AiParseError('AI 返回内容为空');

  const candidates: string[] = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const extracted = extractJsonObject(text);
  if (extracted) candidates.push(extracted);

  let data: unknown;
  let parsed = false;
  for (const candidate of candidates) {
    try {
      data = JSON.parse(candidate);
      parsed = true;
      break;
    } catch {
      // 尝试下一个候选（原始文本 / 代码围栏内容 / 截取出的 JSON 对象）
    }
  }
  if (!parsed) throw new AiParseError('AI 返回内容不是合法 JSON');

  if (typeof data !== 'object' || data === null) {
    throw new AiParseError('AI 返回内容不是 JSON 对象');
  }

  const obj = data as Record<string, unknown>;
  const dims = obj.dimensions;
  if (typeof dims !== 'object' || dims === null) {
    throw new AiParseError('AI 返回缺少 dimensions');
  }
  const d = dims as Record<string, unknown>;

  const dimensions: Dimensions = {
    innovation: clampScore(d.innovation),
    engineering: clampScore(d.engineering),
    documentation: clampScore(d.documentation),
    maintainability: clampScore(d.maintainability),
    usefulness: clampScore(d.usefulness),
  };

  const strengths = cleanList(obj.strengths, 5);
  const improvements = cleanList(obj.improvements, 5);
  if (strengths.length === 0) throw new AiParseError('AI 未返回优点');
  if (improvements.length === 0) throw new AiParseError('AI 未返回改进建议');

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim()
      ? obj.summary.trim().slice(0, 500)
      : 'AI 未给出结论。';

  const total = Math.round(
    (dimensions.innovation +
      dimensions.engineering +
      dimensions.documentation +
      dimensions.maintainability +
      dimensions.usefulness) /
      5,
  );

  return { dimensions, strengths, improvements, summary, tags: cleanList(obj.tags, 8), total };
}
