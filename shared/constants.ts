export const SITE_NAME = '星栈';
export const SITE_TAGLINE = 'GitHub 项目分享与周榜';

export const TAGS = [
  { value: 'ai', label: 'AI/机器学习' },
  { value: 'web', label: 'Web 开发' },
  { value: 'cli', label: '命令行工具' },
  { value: 'devtools', label: '开发者工具' },
  { value: 'mobile', label: '移动端' },
  { value: 'data', label: '数据/数据库' },
  { value: 'game', label: '游戏' },
  { value: 'other', label: '其他' },
] as const;

export type Tag = (typeof TAGS)[number]['value'];

export const TAG_VALUES = TAGS.map((t) => t.value) as Tag[];

export function tagLabel(value: string): string {
  return TAGS.find((t) => t.value === value)?.label ?? value;
}
