# 执行计划:管理后台、项目展示、本地运行、VPS 部署与 CI/CD

状态:已确认,执行中(2026-10-31)。阶段编号接在已合并的 Stage 3(PR #3,管理员认证基础)之后。

## 目标

1. 独立的管理后台应用 `apps/admin`,用于管理照片、项目和上传图片;登录地址可配置。
2. 公开站点新增项目展示。
3. 先在本地完整运行(PostgreSQL + API + 前台 + 后台)。
4. 再部署到 VPS,用 GitHub Actions 做 CI/CD,替换 GitHub Pages。

约束:公开站点现有的视觉与交互保持不变,新功能以新增为主。例外:React 及相关依赖升级到最新版本(用户已同意,不受“迁移后界面不能变”的约束;升级本身也不应主动改动界面)。

## 参考项目

可从 `D:\Projects\internal-developer-tools-portal` 复用的部分(同为 Fastify 5 + React + npm workspaces):

| 来源 | 用途 | 方式 |
|---|---|---|
| `server/src/services/auth.ts`、`routes/auth.ts`、`routes/guards.ts` | 管理员登录、会话 Cookie、CSRF、登录限流、管理来源 IP 白名单 | 移植,去掉 proxy 认证模式 |
| `packages/shared/src/adminPath.ts`、`server/src/routes/web.ts`、`web/vite.config.ts` 中的 adminPath 插件 | 可配置的管理后台地址(`ADMIN_PATH`),只对管理页面注入地址 | 移植并改为服务独立的 admin 构建产物 |
| `server/src/lib/errors.ts`、`lib/validation.ts`、`app.ts` 的错误处理 | 统一错误格式 + Zod 校验 | 移植 |
| `app.ts` 的安全响应头 / CSP / 日志脱敏 | 生产环境加固 | 移植 |
| `server/src/services/screenshot/image.ts`、`routes/thumbnails.ts` 的上传 | 图片上传处理 | 移植并扩展(多尺寸、EXIF) |
| `web/src/lib/api.ts` | 后台请求封装 `request()` / `ApiError` | 移植 |
| `web/src/pages/admin/*`、`web/src/components/ui/*` | 后台列表、编辑弹窗、表单、Toast、Select 等 | 移植到 `apps/admin`(Tailwind) |
| Vitest + Fastify `inject` 测试 | 接口测试 | 移植测试配置 |
| `docs/deployment.md` | 部署参考 | 参考 |

不复用:JSON 文件存储、SQLite/Drizzle、使用分析、proxy 认证、URL 白名单(等服务端需要主动访问外部地址时再引入)。

## 关键技术决策(提议)

- **依赖版本**:前台与后台统一使用 React 19.3、React Router 8(v8 不再有 `react-router-dom`,统一从 `react-router` 导入)。Vite 8 等工具链在升级阶段评估兼容性后一并升级。Prisma 已在 Stage 4 一并升级到 7.10.1(Prisma 8 仍是 RC,暂不使用)。
- **管理后台技术栈**:`apps/admin` 使用 React 19 + Tailwind 4 + TanStack Query + React Router 8。
- **可配置的后台地址(`ADMIN_PATH`)**:
  - 在 API 的 `.env` 中设置,默认 `/admin`;格式校验,禁止与 `/api`、`/uploads` 等冲突。
  - 生产环境由 Fastify 托管 admin 构建产物:只有请求 `ADMIN_PATH` 下的页面(且来源 IP 在 `ADMIN_ALLOWED_IPS` 内)才返回后台页面,并通过 `<meta>` 注入后台地址;其它地址、猜错的地址都返回前台页面或 404,不泄露真实地址。
  - admin 以相对路径构建(`base: "./"`),路由的 `basename` 从注入的 `<meta>` 读取,因此**修改地址只需改环境变量并重启,无需重新构建**。
  - 公开接口不返回后台地址;只有已登录的管理员能从 `/api/admin/session` 得到它。
  - 登录等接口沿用 `/api/admin/*`;来源 IP 不在白名单时,管理相关接口统一返回与“不存在”相同的 404。
  - 开发环境:admin 的 Vite 插件读取同一个 `ADMIN_PATH`,行为与生产一致。
- **同源部署**:后台与前台同域名,`SameSite=Strict` 会话 Cookie 即可工作,无需带凭据的 CORS。
- **托管方式**:Fastify 统一提供前台静态文件、后台(`ADMIN_PATH`)、`/api`、`/uploads`;Caddy/Nginx 只负责 HTTPS、压缩和转发。这样反向代理不需要知道后台地址。
- **共享类型与校验**:Zod schema 和 API 类型放在共享包(扩展 `packages/content` 或新建 `packages/shared`),API、前台、后台共用。
- **管理员密码**:只保存 scrypt 哈希(`ADMIN_PASSWORD_HASH`,Stage 3 已实现,通过 `npm run auth:hash` 生成);服务器上不保存明文密码。
- **图片存储**:先实现 `local` 驱动(文件存放在 `UPLOAD_DIR`,通过 `/uploads` 访问),保留驱动接口以便之后接入 R2。现有 Flickr 照片保持 `remote-url`。
- **种子数据回退**:后台上线后,只有数据库未配置或无法连接时才回退种子数据;数据库为空时不再回退(否则删除全部照片后会重新显示种子照片)。
- **Node**:升级到 Node 22 LTS(CI 与 VPS 一致)。
- **开发端口**:API `8787`、前台 `5173`、后台 `5174`(代理 `/api`、`/uploads` 到 API)。

## 阶段

每个阶段沿用现有流程:在 `dev` 分支开发、频繁提交、更新 `docs/`(progress、decisions、development-log)、Claude Code 审查、修复问题、提交 PR。

### Stage 3:管理员认证基础(已完成,PR #3)

- scrypt 密码哈希(`npm run auth:hash`)、`ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET`。
- HMAC 签名的 HttpOnly 会话 Cookie、登出注销、登录限流、`requireAdmin()` 守卫。
- 接口:`GET /api/admin/session`、`POST /api/admin/login`、`POST /api/admin/logout`。
- `apps/web` 内固定的 `/admin` 登录页(Stage 6 迁移到 `apps/admin` 后删除)。

### Stage 4:前台依赖升级(已完成,PR #4,含 Prisma 7 升级)

- `apps/web` 升级到 React 19.3、React Router 8(导入从 `react-router-dom` 改为 `react-router`),同步 `@types/react` 19。
- 评估并升级 Vite 8、`@vitejs/plugin-react-swc`、`lucide-react` 等相关依赖;不兼容的记录原因后暂缓。
- 处理 React 19 的破坏性变更(`forwardRef`、`defaultProps`、ref 回调返回值、类型变化等)。
- 根目录与 CI 的 Node 版本改为 22。

完成标准:`typecheck`、`build` 通过;首页、作品集、照片弹窗、全屏查看、主题切换、多语言、Spotify 浮窗逐项手动验证正常。

### Stage 5:后端基础与认证完善(已完成)

在 Stage 3 的认证代码基础上补齐,不推倒重来。

- 新增依赖:`zod`、`@fastify/cookie`、`@fastify/multipart`、`@fastify/static`、`vitest`。
- `config/env.ts`:用 Zod 校验环境变量,配置错误时启动失败。
- `HttpError` + 全局错误处理、安全响应头、日志脱敏。
- 认证:保留 Stage 3 的会话、限流与注销;补充 CSRF 请求头(`x-admin-request`)、Cookie 改用 `@fastify/cookie`、会话接口在已登录时返回后台地址。
- `ADMIN_PATH` 与 `ADMIN_ALLOWED_IPS`:路径校验、IP 白名单、页面注入逻辑(先完成服务端部分)。
- 所有 `/api/admin/*` 接口使用 `requireAdmin` 守卫。
- Vitest 测试:登录成功/失败、限流、CSRF、守卫、IP 白名单 404、后台地址不泄露、现有照片接口。

完成标准:`typecheck`、`test`、`build` 通过;未登录访问管理接口被拒绝。

### Stage 6:`apps/admin` 骨架(已完成)

- Vite 应用(`base: "./"`)、Tailwind 4 设计令牌、开发代理、`ADMIN_PATH` 开发插件。
- 移植 UI 基础组件:`Dialog`、`Field`、`Select`、`Combobox`、`Toast`、`Tooltip`。
- 请求封装(`request()`、`ApiError`、CSRF 请求头)、TanStack Query。
- 登录页、登录后布局(侧边栏:照片 / 项目)、登出。
- 根目录 `npm run dev` 用 `concurrently` 同时启动 API、前台、后台。

完成标准:本地可以在 `http://localhost:5174<ADMIN_PATH>` 登录和登出;改 `ADMIN_PATH` 后旧地址不可用、新地址可用;前台不受影响。

### Stage 7:照片管理与上传(已完成)

- Prisma:`Photo` 新增 `storageDriver`、`storageKey`、`variants`(JSON,宽度 → 地址)、占位图字段;生成迁移。
- 上传接口 `POST /api/admin/uploads`:Sharp 校验格式白名单与像素上限,按 EXIF 自动旋转,生成多尺寸 WebP(例如长边 640 / 1280 / 2048),读取宽高与 EXIF(相机、镜头、曝光参数)用于预填表单。
- 本地存储驱动写入 `UPLOAD_DIR`,API 提供 `/uploads`。
- 照片管理接口:`GET/POST/PATCH/DELETE /api/admin/photos`、`PUT /api/admin/photos/order`,支持公开/隐藏、精选。
- 后台界面:照片网格、带进度的上传、多语言分页的编辑弹窗(zh / zh-Hant / en / fr / ja)、拖拽排序。
- 前台:图片组件在保留 Flickr 逻辑的同时支持上传图片的 `srcset`;现有照片显示不变。
- 测试:上传校验与增删改查。

完成标准:后台上传一张新照片后,作品集页面正确显示;现有 41 张照片显示不变。

### Stage 8:项目模块(已完成)

- Prisma `Project`:`slug`,多语言的 `title` / `summary` / `body`(Markdown),`coverImage`(复用图片处理流程),可选 `gallery`,`techStack`,`links`(仓库 / 演示 / 文档),`status`,`startedAt` / `endedAt`,`featured`,`visibility`,`sortOrder`。
- 公开接口:`GET /api/projects`、`GET /api/projects/:slug`。
- 后台接口与界面:增删改查、封面上传、排序(复用照片管理的组件)。
- 前台:首页精选项目区、`/projects` 列表页、项目详情页、多语言文案。动工前先出设计稿给用户确认。
- 以后可选:用 Playwright 自动截取演示地址作为封面(届时引入参考项目的截图服务与 URL 白名单)。

完成标准:后台创建项目后,前台可以看到。

### Stage 9:本地完整运行

- API 生产构建(`tsup` 或 `tsc` 输出),不再用 `tsx` 运行;启动时执行 `prisma migrate deploy`。
- 多阶段 Dockerfile:构建前台、后台、API,产出一个镜像,由 Fastify 统一托管。
- `compose.yaml`:`postgres` + `app` + `caddy`(或 Nginx);数据库与上传目录使用持久化卷。
- 验证真实 PostgreSQL 流程(Stage 2 时没有 Docker,未验证)。
- 编写 `docs/local-development.md` 运行手册。

完成标准:`docker compose up` 后,本地前台与后台均可正常使用,重启后数据保留。

### Stage 10:VPS 部署与 CI/CD

- 服务器准备文档:Docker + Compose、防火墙(22/80/443)、非 root 部署用户、仅密钥登录 SSH。
- 反向代理与自动 HTTPS(推荐 Caddy,配置简单;备选 Nginx + certbot)。
- GitHub Actions:
  - `ci.yml`(PR 与 `dev`):安装依赖、类型检查、测试、构建。
  - `deploy.yml`(推送到 `main`):构建镜像 → 推送到 GHCR → SSH 到 VPS → `docker compose pull && up -d` → 数据库迁移 → 检查 `/api/health`,不健康则任务失败。
  - GitHub Secrets:`VPS_HOST`、`VPS_USER`、`VPS_SSH_KEY`;运行时 `.env`(含 `ADMIN_PATH`、密码哈希、会话密钥)只保存在 VPS 上。
- 备份:每晚 `pg_dump` + 上传目录打包,保留策略(例如 7 天 / 4 周),可选异地备份(R2)。
- 切换:`HashRouter` 改为 `BrowserRouter`,旧的 `#/...` 链接自动跳转;`twilightfrosty.com` 的 DNS 指向 VPS;停用 GitHub Pages 工作流与 `VITE_DISABLE_API_FETCH`。

完成标准:合并到 `main` 后自动部署,域名通过 HTTPS 正常访问前台与后台。

## 需要用户提供的信息

- Stage 8 之前:项目需要展示哪些字段、是否需要详情页、项目区的设计方向。
- Stage 10 之前:VPS 服务商 / 系统 / 配置、DNS 由谁管理(是否 Cloudflare)、Caddy 还是 Nginx。
- 随时:图片是现在就迁移到 R2,还是上线之后再做。
