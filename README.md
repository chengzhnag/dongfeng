# 东风

> 遇事不决，可问东风。

东风是一个带有仪式感的随机决策工具。用户可以创建带权重选项的决定，由服务端使用密码学安全随机数完成选择，并将结果发布到公开池或保存到个人历史。

项目面向 Cloudflare Workers，使用 Durable Object SQLite 保存数据，使用 Hono 提供 API。

## 功能

- 带权重的随机决策
- Roulette、Tally、Bagua 三种展示模式
- 公开决定池、标签筛选和热门排序
- 用户注册、登录和 HttpOnly Cookie 会话
- PBKDF2 密码哈希
- 私人决定历史、删除和公开状态切换
- Like / Unlike
- 决定结果验真哈希
- 访客创建公开决定
- `robots.txt` 和 `sitemap.xml`
- 登录、注册、创建和 Like 限流

## 技术栈

- Cloudflare Workers
- Cloudflare Durable Objects
- Durable Object SQLite
- Hono
- TypeScript
- React 18
- D3.js
- Lucide React
- Canvas Confetti

## 项目结构

```text
.
├── public/
│   ├── app.jsx          # React 前端应用
│   ├── index.html       # 页面入口和 import map
│   └── styles.css       # 全局样式
├── src/
│   ├── index.ts         # Worker、Durable Object 和 API 路由
│   └── lib/
│       ├── crypto.ts    # ID、PBKDF2、验真哈希
│       ├── decision.ts  # 加权随机选择
│       └── rate-limit.ts# 内存限流器
├── wrangler.json        # Cloudflare Workers 配置
└── LICENSE              # MIT License
```

## 环境要求

- Node.js 18 或更高版本
- npm
- Cloudflare 账号
- 已安装或可通过 `npx` 使用 Wrangler

安装依赖：

```bash
npm install
```

## 环境变量

### `PUBLIC_ORIGIN`

公开站点地址，用于生成 `robots.txt` 和 `sitemap.xml`。当前配置示例：

```json
{
  "vars": {
    "PUBLIC_ORIGIN": "https://dong.952737.xyz"
  }
}
```

### `JWT_SECRET`

用于签发和验证登录 JWT 的高熵随机密钥，至少 32 个字符。不要把它提交到 Git 或写入公开的 `wrangler.json`。

生产环境配置：

```bash
npx wrangler secret put JWT_SECRET
```

本地开发可以在项目根目录创建 `.dev.vars`：

```env
JWT_SECRET="replace-with-at-least-32-random-characters"
```

并确保 `.dev.vars` 已加入 `.gitignore`。

## 本地开发

启动 Wrangler 开发服务器：

```bash
npx wrangler dev
```

然后打开 Wrangler 输出的本地地址。前端资源由 Worker 的 Assets binding 提供，API 路径以 `/api/` 开头。

## 构建检查

执行 Cloudflare Worker dry-run：

```bash
npx wrangler deploy --dry-run
```

该命令会检查 Worker、Durable Object binding 和静态资源是否能够被 Wrangler 打包。

## 部署

首次使用时登录 Cloudflare：

```bash
npx wrangler login
```

配置生产 JWT Secret：

```bash
npx wrangler secret put JWT_SECRET
```

部署：

```bash
npx wrangler deploy
```

部署前请确认：

- `PUBLIC_ORIGIN` 是实际公开域名
- `JWT_SECRET` 已通过 Wrangler Secret 配置
- Durable Object migration 配置没有被删除
- 不要提交 `.dev.vars`、`.env` 或其他密钥文件

## API 概览

### 公开接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/avatars` | 获取可用头像列表 |
| `GET` | `/api/decisions/public` | 获取公开决定列表 |
| `GET` | `/api/decisions/:id/verify` | 验证公开决定结果 |
| `GET` | `/robots.txt` | 搜索引擎规则 |
| `GET` | `/sitemap.xml` | 站点地图 |

### 认证接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册并创建会话 |
| `POST` | `/api/auth/login` | 登录并创建会话 |
| `POST` | `/api/auth/logout` | 删除当前浏览器会话 Cookie |
| `GET` | `/api/auth/me` | 获取当前会话用户 |

### 决定接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/decisions/create` | 创建并执行一个决定 |
| `GET` | `/api/decisions/mine` | 获取当前用户的决定历史 |
| `POST` | `/api/decisions/:id/like` | Like / Unlike 公开决定 |
| `POST` | `/api/decisions/:id/toggle-public` | 切换本人决定的公开状态 |
| `DELETE` | `/api/decisions/:id` | 删除本人决定 |

所有私人数据接口都从服务端会话取得用户 ID，不接受前端传入的用户 ID。删除和公开状态切换会执行 ownership 校验。

## 数据模型

Durable Object SQLite 当前包含：

- `users`：用户、邮箱、PBKDF2 密码哈希和头像
- `decisions`：决定内容、随机结果、可见性、标签和验真信息
- `likes`：决定与操作者的唯一 Like 关系

项目不会在初始化时自动注入样例数据。首次部署后，公开池为空，数据由用户创建。

## 安全说明

- 登录状态使用 HttpOnly、Secure、SameSite Cookie。
- 密码使用 PBKDF2 保存，不保存明文密码。
- 私人决定的查询、删除、公开切换和验真受用户 ownership 约束。
- Like 只允许作用于公开决定。
- API 对注册、登录、创建和 Like 设置了限流。
- 状态变更接口执行同源校验。
- 服务端限制请求体、标题、选项、标签和用户字段长度。
- 不要将 `JWT_SECRET` 写入仓库、截图、日志或客户端代码。

当前的结果哈希用于校验已保存结果的一致性，不等同于可证明服务端在选择前无法操控结果的完整 commit-reveal 协议。若用于高信任场景，应进一步设计独立的承诺与揭示流程。

## 已知限制

- 当前所有 API 使用同一个 Durable Object 实例，适合小规模项目和原型阶段。
- 限流器主要保存在 Durable Object 运行时内存中，实例重启后会重置。
- 前端页面依赖 CDN import map 和 Babel Standalone。生产环境可进一步改为 Vite 构建并自托管依赖。
- 游客的私人历史不持久化，游客只能创建公开决定。
- JWT 登出主要删除浏览器 Cookie，已经泄露的 JWT 在过期前仍可能有效。

## 贡献

欢迎提交 Issue 和 Pull Request。

建议的贡献流程：

1. Fork 本项目并创建功能分支。
2. 保持改动聚焦，并补充必要的 API 或前端验证。
3. 执行 `npx wrangler deploy --dry-run`。
4. 执行 `git diff --check`。
5. 在 Pull Request 中说明行为变化、测试方式和部署影响。

涉及认证、权限、数据库结构或安全策略的改动，请同时说明威胁模型和回滚方式。

## 许可证

本项目使用 [MIT License](LICENSE)。
