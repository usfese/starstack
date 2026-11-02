# 星栈（StarStack）

GitHub 项目分享社区：用 GitHub OAuth 登录，提交自己名下的公开仓库并撰写介绍；浏览他人项目、在 GitHub 上 Star 后回站验证；站点用 AI 从五个维度评估项目质量；按周（Asia/Shanghai 周一 00:00 切分）统计**已验证 Star** 生成榜单；管理员可上/下架项目、重新评估、封禁用户。

## 功能

- **仅 GitHub 登录**：不实现邮箱、密码或 SMTP 邮件。OAuth 只请求 `read:org`（只读组织成员关系，用于判断组织管理员）；升级后老用户需退出重新登录以授予该 scope。
- **提交项目**：提交页可从下拉直接选择自己的公开仓库，或自己担任 **admin/owner** 的组织公开仓库；必须是公开、非 fork。管理员可代提交任意非 fork 仓库。
- **Star 验证**：Star 由用户本人在 GitHub 完成，站点用其 OAuth token 调用 `GET /user/starred/{owner}/{repo}` 确认（204 = 已 Star）。每人每项目只计一次，验证时间即“本周获星”依据；事后取消 Star 不回滚历史。
- **项目评论**：登录用户可在项目页发表评论（纯文本，最多 1000 字，20 条/小时限流）；评论作者和管理员可删除。
- **自定义标签**：预设标签之外可自由新增（最多 3 个，每个 24 字），项目广场的标签筛选会自动汇总站内已有标签。
- **分享海报**：项目页「分享」按钮会生成一张包含项目数据、AI 总评、五维雷达图和优点/改进建议的图片，可下载或复制链接。
- **AI 评估**：创新性 / 工程质量 / 文档 / 可维护性 / 实用价值五维打分，另给优点、改进建议与结论。未配置 `AI_API_KEY` 时降级为启发式评分，并在页面明确标注。
- **周榜**：只统计本站验证事件；历史周的快照在访问周榜时惰性补齐，保留最近 8 周。
- **管理面板**：统计概览、项目上/下架与删除、重新评估、用户封禁/解封、评估队列查看。

## 技术栈

Bun 1.4（`bun:sqlite`、`bun test`）· Hono 4 · React 19 + TypeScript + Vite + Tailwind CSS v4 · react-router-dom v7 · react-markdown + remark-gfm · zod。无 ORM：手写 SQL，`PRAGMA user_version` 迁移。

单进程单实例：开发时 Vite 5173 代理 `/api`、`/auth` 到 3001；生产时 Hono 同时托管 `dist/`（单端口）。

## 目录

```
shared/          前后端共用常量与 DTO 类型
server/
  env.ts         环境变量校验
  app.ts         Hono 路由装配、安全头、CSRF、生产静态托管
  db/            SQLite 连接与迁移（migrations/001_init.sql）
  lib/           周口径、GitHub、AI、启发式评分、评估队列、榜单、加密、会话
  middleware/    认证、CSRF、错误、限流
  routes/        auth / projects / stars / leaderboard / me / admin
src/             React 前端（pages / components / context）
```

## 环境变量

复制 `.env.example` 为 `.env` 并填写。`APP_SECRET` 必填，至少 16 字符（`openssl rand -hex 32`）。

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `APP_SECRET` | 无 | **必填**。会话与 OAuth token 加密密钥；更换后已存 token 无法解密，用户重新登录即可恢复 |
| `NODE_ENV` | `development` | `production` 启用 Secure Cookie、CSP 与静态托管 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 空 | 生产必填；开发可空（配合 `DEV_FAKE_GITHUB=1` 假登录） |
| `FRONTEND_URL` | `http://localhost:5173` | 登录后跳转与 CSRF Origin 基准 |
| `OAUTH_CALLBACK_URL` | `${FRONTEND_URL}/auth/github/callback` | 必须与 OAuth App 登记一致 |
| `GITHUB_TOKEN` | 空 | 可选；服务端读取仓库/README 时提升限额 |
| `AI_BASE_URL` | `https://api.openai.com/v1` | OpenAI 兼容接口，需提供 `/chat/completions` |
| `AI_API_KEY` | 空 | 留空则使用启发式评分 |
| `AI_MODEL` | `gpt-4o-mini` | 写入评估记录并展示 |
| `ADMIN_GITHUB_LOGINS` | 空 | 逗号分隔，不区分大小写；每次登录重算 `is_admin` |
| `DEV_FAKE_GITHUB` | `0` | 仅开发；生产为 `1` 会拒绝启动 |
| `DATA_DIR` | `./data` | SQLite 数据目录 |
| `PORT` | `3001` | 生产可用 3000 |

也可在管理面板「AI 设置」里填接口地址 / API Key / 模型，保存即生效（写入 `settings` 表，优先级高于环境变量；API Key 以 `APP_SECRET` 派生密钥加密落盘，启动时会把历史明文升级为密文）；同一项目 7 天内最多评估一次，失败的评估不计入。更换 `APP_SECRET` 后已存 Key 无法解密，视为未配置并回退 `AI_API_KEY`。

## GitHub OAuth App

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。
2. Homepage URL：`http://localhost:5173`（生产填站点域名）。
3. Authorization callback URL：`http://localhost:5173/auth/github/callback`（生产填 `https://你的域名/auth/github/callback`）。
4. OAuth App 本身不需要配置 scope；应用在授权时会请求 `read:org`。个人仓库用户不受影响，组织仓库需要该权限。
5. 把 Client ID / Client Secret 写入 `.env` 的 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`，并把 `DEV_FAKE_GITHUB=0`。

## 本地启动

```bash
bun install
cp .env.example .env      # 填入 APP_SECRET 等
bun run dev               # 5173 前端 + 3001 API
```

开发调试可临时使用假 GitHub（`DEV_FAKE_GITHUB=1`）：`/login` 会显示「开发登录」输入框，填用户名提交即完成登录；也可直接访问 `http://localhost:5173/auth/dev/login?login=honojs`（`ADMIN_GITHUB_LOGINS` 中的账号为管理员），仓库读取与 Star 校验均返回固定假数据。此模式下 `GITHUB_CLIENT_ID` 无需真实值；若要测真实 GitHub 登录，必须配置真实 OAuth App 凭据并把 `DEV_FAKE_GITHUB` 设为 `0`。

## 脚本

| 命令 | 作用 |
| --- | --- |
| `bun run dev` | 并发启动 API（watch）与 Vite |
| `bun run build` | 构建前端到 `dist/` |
| `bun run start` | 生产启动（`NODE_ENV=production`，单端口托管前端） |
| `bun run db:migrate` | 单独执行数据库迁移（服务启动时也会自动执行） |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | 单元测试（周口径等） |

## 生产部署

```bash
bun install
bun run build
NODE_ENV=production bun server/index.ts   # 或 bun run start
```

前置反向代理（Nginx / Caddy）终结 TLS，把请求转发到 `PORT`。生产必须配置 `APP_SECRET`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`，并把 `DEV_FAKE_GITHUB` 保持为 `0`（为 `1` 时启动直接失败）。

### GitHub Actions

- `.github/workflows/ci.yml`：push 到 `main`、PR 或手动触发时运行 `bun install --frozen-lockfile`、`typecheck`、`bun test`、`bun run build`。
- `.github/workflows/deploy.yml`：`main` 上 CI 成功后自动部署；也可在 Actions → Deploy production → Run workflow 手动触发。SSH 登录服务器执行 `git pull`、安装依赖、构建、`systemctl restart starstack`，随后检查本机 `/api/health` 与公网 `https://starstack.usfese.cc/api/health`。

服务器首次部署需用 git clone（不要用 rsync 覆盖，否则 deploy workflow 的 `git pull` 会失败）。仓库是私有时，先在服务器生成只读部署密钥，把公钥加到 GitHub 仓库 Settings → Deploy keys（勾选 read-only）：

```bash
# 服务器上，以 starstack 用户执行
sudo install -d -m 700 -o starstack -g starstack /home/starstack/.ssh
sudo -u starstack ssh-keygen -t ed25519 -C "starstack-server-readonly" -f /home/starstack/.ssh/starstack_readonly -N ""
sudo -u starstack cat /home/starstack/.ssh/starstack_readonly.pub
# 把输出贴到 GitHub 仓库 Settings → Deploy keys（不要勾选 Allow write access）

# 本机也可以直接添加（把上面的公钥保存为文件后）
gh repo deploy-key add starstack_readonly.pub --title "starstack server" --repo usfese/starstack
```

配置服务器 SSH 使用该密钥：

```bash
sudo -u starstack tee /home/starstack/.ssh/config >/dev/null <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/starstack_readonly
  IdentitiesOnly yes
EOF
sudo chmod 600 /home/starstack/.ssh/config
```

然后克隆并允许部署用户免密重启服务：

```bash
sudo mkdir -p /opt/starstack
sudo chown starstack:starstack /opt/starstack
sudo -u starstack git clone git@github.com:usfese/starstack.git /opt/starstack
# 生成 Actions → 服务器 的专用部署密钥（本机执行），公钥加到服务器 starstack 用户的 ~/.ssh/authorized_keys
ssh-keygen -t ed25519 -C "starstack-deploy" -f ~/.ssh/starstack_deploy -N ""

# 服务器上（仅允许这一条免密命令）
echo 'starstack ALL=(root) NOPASSWD: /bin/systemctl restart starstack' | sudo tee /etc/sudoers.d/starstack-deploy
sudo chmod 440 /etc/sudoers.d/starstack-deploy
```

在 GitHub 仓库配置 Actions secrets（可用 `gh secret set`）：

```bash
gh secret set DEPLOY_HOST --body "服务器IP或域名"
gh secret set DEPLOY_USER --body "starstack"
gh secret set DEPLOY_SSH_KEY < ~/.ssh/starstack_deploy
gh secret set DEPLOY_PORT --body "22"   # 可选，默认 22
```

工作流使用部署用户 `$HOME/.bun/bin/bun`（并回退到 `/usr/local/bin/bun`），不会硬编码用户名；部署用户没装 Bun 时会给出明确错误。部署用户需对 `/opt/starstack` 有写权限，并能通过 `sudo -n systemctl restart starstack` 免密重启。GitHub 的 `production` environment 可另行加审批人/保护规则。详细的手动部署、HTTPS、OAuth 配置见上文对应章节。

## 数据与备份

所有数据在 `DATA_DIR/app.db`（SQLite，WAL 模式）。备份即复制整个 `data/` 目录（含 `app.db-wal`、`app.db-shm`；停服复制最稳妥）。删除 `data/` 会清空账号、项目、星标与榜单。

注意：会话、限流与评估队列都是进程内状态，本架构不支持多实例横向扩展。

## API 摘要

公开：`GET /api/health`、`GET /api/projects`、`GET /api/projects/tags`、`GET /api/projects/:id`、`GET /api/projects/:id/comments`、`GET /api/leaderboard`。
登录后：`GET /api/me`、`GET /api/me/projects`、`GET /api/me/stars`、`POST /api/projects`、`PATCH/DELETE /api/projects/:id`、`POST /api/projects/:id/star/verify`、`POST /api/projects/:id/comments`、`DELETE /api/projects/:id/comments/:commentId`、`POST /auth/logout`。
管理员：`GET /api/admin/stats`、`GET /api/admin/projects`、`POST /api/admin/projects/:id/status`、`POST /api/admin/projects/:id/reevaluate`、`GET /api/admin/users`、`POST /api/admin/users/:id/ban`、`GET /api/admin/evaluations`。

错误统一为 `{ error, message, details? }`；`/api/*` 与 `/auth/logout` 的非安全方法要求 `Origin` 与 `FRONTEND_URL` 一致（CSRF）。

## License

GNU Affero General Public License v3.0（AGPL-3.0）。完整条款见 [LICENSE](LICENSE)。

Copyright (C) 2026 usfese

