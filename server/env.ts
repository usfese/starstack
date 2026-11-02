import { z } from 'zod';

const rawSchema = z.object({
  APP_SECRET: z.string().min(16, 'APP_SECRET 至少需要 16 个字符'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  OAUTH_CALLBACK_URL: z.string().optional(),
  GITHUB_TOKEN: z.string().default(''),
  AI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  ADMIN_GITHUB_LOGINS: z.string().default(''),
  DEV_FAKE_GITHUB: z.string().default('0'),
  DATA_DIR: z.string().default('./data'),
  PORT: z.coerce.number().int().positive().default(3001),
});

function fail(message: string): never {
  console.error(`[星栈] 环境变量配置错误：${message}`);
  process.exit(1);
}

const parsed = rawSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  if (issues.includes('APP_SECRET')) {
    fail('APP_SECRET 未配置（可用 openssl rand -hex 32 生成）');
  }
  fail(issues);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';
const devFakeGithub = raw.DEV_FAKE_GITHUB === '1';

if (isProduction && devFakeGithub) {
  fail('生产环境禁止启用 DEV_FAKE_GITHUB=1，请设置为 0');
}

if (isProduction) {
  if (!raw.GITHUB_CLIENT_ID || !raw.GITHUB_CLIENT_SECRET) {
    fail('生产环境必须配置 GITHUB_CLIENT_ID 与 GITHUB_CLIENT_SECRET');
  }
}

let frontendOrigin: string;
try {
  frontendOrigin = new URL(raw.FRONTEND_URL).origin;
} catch {
  fail(`FRONTEND_URL 不是合法 URL：${raw.FRONTEND_URL}`);
}

const frontendUrl = raw.FRONTEND_URL.replace(/\/+$/, '');
const oauthCallbackUrl = (raw.OAUTH_CALLBACK_URL || `${frontendUrl}/auth/github/callback`).trim();
const aiBaseUrl = raw.AI_BASE_URL.replace(/\/+$/, '');

export const env = {
  appSecret: raw.APP_SECRET,
  nodeEnv: raw.NODE_ENV,
  isProduction,
  isTest: raw.NODE_ENV === 'test',
  githubClientId: raw.GITHUB_CLIENT_ID,
  githubClientSecret: raw.GITHUB_CLIENT_SECRET,
  frontendUrl,
  frontendOrigin,
  oauthCallbackUrl,
  githubToken: raw.GITHUB_TOKEN,
  aiBaseUrl,
  aiApiKey: raw.AI_API_KEY,
  aiModel: raw.AI_MODEL,
  adminLogins: raw.ADMIN_GITHUB_LOGINS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  devFakeGithub: !isProduction && devFakeGithub,
  dataDir: raw.DATA_DIR,
  port: raw.PORT,
} as const;

export function isAdminLogin(login: string): boolean {
  return env.adminLogins.includes(login.trim().toLowerCase());
}

export function isFakeGithubEnabled(): boolean {
  return env.devFakeGithub;
}
