import { db } from '../db/index';
import { env } from '../env';
import { decryptToken, encryptToken } from './crypto';

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiConfigWithSources extends AiConfig {
  sources: { baseUrl: 'db' | 'env'; apiKey: 'db' | 'env' | 'none'; model: 'db' | 'env' };
}

const SETTING_KEYS = { baseUrl: 'ai.base_url', apiKey: 'ai.api_key', model: 'ai.model' } as const;

function readSetting(key: string): string | null {
  const row = db.query('SELECT value FROM settings WHERE key = ?').get(key) as {
    value: string;
  } | null;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string): void {
  if (!value) {
    db.query('DELETE FROM settings WHERE key = ?').run(key);
    return;
  }
  db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, new Date().toISOString());
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** 落盘的 key 一律以 APP_SECRET 派生密钥加密；解不开视为未配置，回退环境变量。 */
function readApiKey(): string | null {
  const raw = readSetting(SETTING_KEYS.apiKey);
  if (raw === null) return null;
  try {
    return decryptToken(raw);
  } catch {
    return null;
  }
}

export function getAiConfig(): AiConfigWithSources {
  const baseUrl = readSetting(SETTING_KEYS.baseUrl);
  const apiKeyRow = readSetting(SETTING_KEYS.apiKey);
  const apiKey = readApiKey();
  const model = readSetting(SETTING_KEYS.model);
  return {
    baseUrl: stripTrailingSlash(baseUrl ?? env.aiBaseUrl),
    apiKey: apiKey ?? env.aiApiKey,
    model: model ?? env.aiModel,
    sources: {
      baseUrl: baseUrl === null ? 'env' : 'db',
      apiKey: apiKeyRow !== null ? 'db' : env.aiApiKey ? 'env' : 'none',
      model: model === null ? 'env' : 'db',
    },
  };
}

export function isAiConfigured(): boolean {
  return getAiConfig().apiKey.length > 0;
}

/** undefined = 不修改该字段；'' = 清除覆盖并回退到环境变量。 */
export function saveAiConfig(input: { baseUrl?: string; apiKey?: string; model?: string }): void {
  db.transaction(() => {
    if (input.baseUrl !== undefined)
      writeSetting(SETTING_KEYS.baseUrl, stripTrailingSlash(input.baseUrl.trim()));
    if (input.apiKey !== undefined) {
      const trimmed = input.apiKey.trim();
      writeSetting(SETTING_KEYS.apiKey, trimmed ? encryptToken(trimmed) : '');
    }
    if (input.model !== undefined) writeSetting(SETTING_KEYS.model, input.model.trim());
  })();
}

/** 启动时把历史明文 ai.api_key 升级为密文；已是密文则跳过。 */
export function upgradeAiKeyAtRest(): void {
  const raw = readSetting(SETTING_KEYS.apiKey);
  if (raw === null) return;
  try {
    decryptToken(raw);
    return;
  } catch {
    writeSetting(SETTING_KEYS.apiKey, encryptToken(raw));
  }
}

export function aiKeyHint(apiKey: string): string | null {
  return apiKey ? `…${apiKey.slice(-4)}` : null;
}
