export const SITE_NAME = '星栈';
export const SITE_TAGLINE = 'GitHub 项目分享与周榜';
export const SOURCE_URL = 'https://github.com/usfese/starstack';

export const TAGS = [
  { value: 'ai', label: 'AI/机器学习' },
  { value: 'web', label: 'Web 开发' },
  { value: 'cli', label: '命令行工具' },
  { value: 'devtools', label: '开发者工具' },
  { value: 'mobile', label: '移动端' },
  { value: 'data', label: '数据/数据库' },
  { value: 'game', label: '游戏' },
] as const;

export type PresetTag = (typeof TAGS)[number]['value'];
export type Tag = string;

export const TAG_MAX_LENGTH = 24;
export const TAG_MAX_COUNT = 3;

export function tagLabel(value: string): string {
  return TAGS.find((t) => t.value === value)?.label ?? value;
}

/** 去空格、去掉开头的 #，用于用户自定义标签。 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, TAG_MAX_LENGTH);
}

/** 去重（忽略大小写）并限制最多 3 个。 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const value = normalizeTag(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= TAG_MAX_COUNT) break;
  }
  return result;
}
