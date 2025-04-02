# `@cvo/homepage`

CVO 官方站点 — **VMZ** 前端 + **CVO Worker** 后端 + **Cloudflare Pages/Workers** 部署示例。

## 结构

```text
src/              VMZ 页面与组件
worker/           Cloudflare Worker（/api/* + 静态 assets）
wrangler.toml     Cloudflare 配置
dist/cdn/         VMZ static 构建产物（Wrangler assets）
dist/browser/     本地 dev/serve 输出
```

## 开发

```bash
# 仓库根目录
pnpm install
pnpm build

# VMZ 本地 dev（含 script server /api/health）
pnpm --filter @cvo/homepage dev

# Worker 本地预览（需先 build 出 dist/cdn）
pnpm --filter @cvo/homepage build
pnpm --filter @cvo/homepage worker:dev
```

## 部署 Cloudflare

```bash
pnpm --filter @cvo/homepage build
pnpm --filter @cvo/homepage worker:deploy
```

Wrangler 将 `dist/cdn` 作为静态 assets，`worker/index.ts` 处理 `/api/health`、`/api/catalog`、`/api/invoke`。

## 边界

- VMZ `script server` 在 dev 中提供 `/api/health`（本地宿主）
- 生产环境由 Worker 提供同名路由；**不会**把每个 script server 调用隐式代理到 CVO HTTP
