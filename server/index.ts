import { app } from './app';
import { migrate } from './db/migrate';
import { upgradeAiKeyAtRest } from './lib/ai-config';
import { ensureBootTasks } from './lib/evaluation-queue';
import { env } from './env';

migrate();
upgradeAiKeyAtRest();
ensureBootTasks();

const server = Bun.serve({
  port: env.port,
  // 开发环境带 DEV_FAKE_GITHUB 假登录，只监听回环地址，避免局域网内被任意账号登录。
  hostname: env.isProduction ? '0.0.0.0' : '127.0.0.1',
  fetch: app.fetch,
  maxRequestBodySize: 1024 * 1024,
});

console.log(`星栈已启动 http://localhost:${server.port}`);
