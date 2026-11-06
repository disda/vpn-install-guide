# 连接指南

基于 Next.js App Router、React 和 TypeScript 的客户端安装指南，包含服务端版本查询与下载接口，需要 Node.js 服务运行。

## 平台

| 系统         | 唯一客户端                      | 安装包            |
| ------------ | ------------------------------- | ----------------- |
| Windows      | FlClash                         | x64 / ARM64 EXE   |
| macOS        | FlClash                         | Apple / Intel DMG |
| iOS / iPadOS | Shadowrocket                    | App Store         |
| Android      | Clash（Clash Meta for Android） | Universal APK     |

页面不包含订阅服务商推荐、注册入口或品牌推广。订阅地址由用户在客户端自行导入，本站不接收或存储。

首屏在服务端根据请求的 User-Agent 自动选中 Windows、macOS、iOS / iPadOS 或 Android，同时初始化对应的下载包类型，保留手动切换。未知系统默认显示 Windows。芯片型号仍由用户选择；完全伪装为 Mac 的 iPad 桌面 UA 无法仅靠 UA 区分，可手动切换到 iOS。

## 本地开发

需要 Node.js 22+（Cloudflare Wrangler 的最低要求）。

```bash
npm ci
npm run dev
```

打开 http://127.0.0.1:3000 。可复制 `.env.example` 为 `.env.local` 设置可选的 `GITHUB_TOKEN`，提高官方公共 API 的额度。该令牌仅用于服务端，不会返回浏览器。

## 后端

- `GET /api/clients`：返回四个平台的教程和版本信息。
- `GET /api/download/windows?arch=amd64`：Windows x64；也支持 `arm64`。
- `GET /api/download/macos?arch=arm64`：Apple 芯片；Intel 使用 `amd64`。
- `GET /api/download/android?arch=universal`：Clash 通用 APK。
- `GET /api/download/ios?arch=universal`：跳转到 Shadowrocket 的 App Store 页面。

服务端从固定的官方 GitHub 仓库查询最新稳定版，使用 Next.js Fetch Cache 缓存一小时，并设置 8 秒请求超时。下载接口校验系统、芯片以及资产的官方仓库地址，以 307 重定向到官方文件；不代理安装包、不接受自定义远端 URL。

官方 API 超时、限流或返回无效数据时，使用 2026-11-06 核对过的已知版本（FlClash v0.9.3 / Clash Meta for Android v2.11.36），页面明确提示为备用版本。若最新版未包含所选安装包，下载接口返回 503，可通过页面上的官方发布页自行查看。未知平台返回 404，错误芯片返回 400。

主要文件：`lib/catalog.ts` 管理教程，`lib/release-source.ts` 处理版本校验与安装包匹配，`lib/releases.ts` 执行服务端查询，`components/guide-page.tsx` 提供交互页面。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 生产运行

```bash
npm ci
npm run build
npm start
```

也可部署到支持 Next.js 服务端的托管环境。该项目包含 API Route Handlers，不能通过 GitHub Pages 或静态导出方式部署。自行托管时可在反向代理后运行；需要对外监听时使用 `npx next start --hostname 0.0.0.0`。

客户端版权归各自开发者所有。所有安装包下载和应用购买均通过客户端官方渠道完成。

## Cloudflare Workers

已配置 OpenNext Cloudflare 适配器，保留服务端 UA 识别、版本查询及下载接口。

线上地址：https://guide.wepic.top

备用地址：https://vpn-install-guide.disdaderpeng.workers.dev

```bash
# 登录自己的 Cloudflare 账号
npx wrangler login

# 构建 Workers 产物
npm run build:cloudflare

# 在本地 Workers 环境预览
npm run preview:cloudflare

# 构建并发布
npm run deploy
```

`wrangler.jsonc` 指向当前账号的 `vpn-install-guide` Worker 与专用 KV 命名空间。KV 仅存储 Next.js 版本查询缓存，页面 HTML 按 UA 动态渲染。迁移至其他 Cloudflare 账号时，需要修改 `account_id`，并创建、替换 KV 命名空间 ID。

可选的 GitHub 令牌通过 `npx wrangler secret put GITHUB_TOKEN` 设置为 Worker Secret，勿写入配置文件。静态构建产物、Wrangler 本地状态及密钥文件均已加入 Git 忽略。
