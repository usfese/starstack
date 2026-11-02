import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { bodyLimit } from 'hono/body-limit';
import { Hono } from 'hono';
import { env } from './env';
import { errorHandler } from './middleware/errors';
import { optionalAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { starRoutes } from './routes/stars';
import { commentRoutes } from './routes/comments';
import { leaderboardRoutes } from './routes/leaderboard';
import { meRoutes } from './routes/me';
import { githubRoutes } from './routes/github';
import { adminRoutes } from './routes/admin';

export const app = new Hono();

const DIST_DIR = resolve(process.cwd(), 'dist');

app.onError(errorHandler);

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  if (env.isProduction) {
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
    );
  }
});

app.use(
  '*',
  bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: 'VALIDATION', message: '请求体过大（最大 1MB）' }, 413),
  }),
);

app.use('/api/*', optionalAuth);
app.use('/api/*', csrfProtection);
app.use('/auth/logout', csrfProtection);

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    devFakeGithub: env.devFakeGithub,
    githubOAuth: Boolean(env.githubClientId && env.githubClientSecret),
  }),
);

app.route('/auth', authRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/projects', starRoutes);
app.route('/api/projects', commentRoutes);
app.route('/api/leaderboard', leaderboardRoutes);
app.route('/api/me', meRoutes);
app.route('/api/github', githubRoutes);
app.route('/api/admin', adminRoutes);

app.all('/api/*', (c) => c.json({ error: 'NOT_FOUND', message: '接口不存在' }, 404));
app.all('/auth/*', (c) => c.json({ error: 'NOT_FOUND', message: '接口不存在' }, 404));

if (env.isProduction) {
  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next();

    let pathname: string;
    try {
      pathname = decodeURIComponent(c.req.path);
    } catch {
      return c.text('请求路径不合法', 400);
    }
    if (pathname.includes('\u0000')) return c.text('请求路径不合法', 400);
    if (pathname.includes('..')) return c.text('请求路径不合法', 400);

    const resolved = resolve(DIST_DIR, `.${pathname}`);
    if (resolved !== DIST_DIR && !resolved.startsWith(`${DIST_DIR}/`)) {
      return c.text('请求路径不合法', 400);
    }

    const stat = statSync(resolved, { throwIfNoEntry: false });
    if (stat?.isFile()) {
      const headers = new Headers({
        'Content-Type': Bun.file(resolved).type,
        'Cache-Control': pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      });
      if (c.req.method === 'HEAD') return new Response(null, { headers });
      return new Response(Bun.file(resolved), { headers });
    }

    const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
    if (lastSegment.includes('.')) return next();

    const indexFile = Bun.file(resolve(DIST_DIR, 'index.html'));
    if (!(await indexFile.exists())) {
      return c.text('前端未构建，请先运行 bun run build', 500);
    }
    const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    if (c.req.method === 'HEAD') return new Response(null, { headers });
    return new Response(indexFile, { headers });
  });
}

app.notFound((c) => {
  if (c.req.path.startsWith('/api') || c.req.path.startsWith('/auth')) {
    return c.json({ error: 'NOT_FOUND', message: '接口不存在' }, 404);
  }
  return c.json({ error: 'NOT_FOUND', message: '页面不存在' }, 404);
});
