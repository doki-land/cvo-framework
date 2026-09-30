# `@cvo/homepage`

CVO 官方站点前端 — **VMZ** 全栈作者面；生产静态由 **Cloudflare Pages** 交付。

后端不是手写 Worker 路由：`<script server>` 经 `vmz build --profile edge` 产出
`ServerArtifact` + `#server` 模块，由 `@cvo/homepage-api`（CVO host）加载执行。

## 结构

```text
src/                 VMZ 页面与组件（含 <script server>）
vmz.config.ts        static（Pages）+ edge（ServerArtifact）
dist/cdn/            home:client 产物 → Pages
dist/server/         home:server 产物 → CVO API Worker 输入
```

## 开发

```bash
# 仓库根
pnpm home:client          # Pages 静态
pnpm home:server          # emit artifact + prepare CVO Worker
pnpm homepage:dev         # VMZ 本地 dev（script server 本机执行）
```

## Cloudflare

| 项目 | 构建 | 部署 |
|------|------|------|
| Pages | `pnpm home:client` | 输出 `projects/homepage/dist/cdn` |
| Worker | `pnpm home:server` | `npx wrangler deploy`（根 `wrangler.toml` → homepage-api） |

同域时把 `/api/*` 指到 Worker；跨域时 Worker 已允许 CORS。

## 边界

- 作者只写 VMZ；生产 API 真相源是 `dist/server/_vmz/server-artifact.json`
- CVO 不绕过 VMZ `createRenderHost`；不隐式把每个 script server 调用变成 HTTP hop
- `@cvo/preview-worker` 仍是人造 fixture 符合性切片，不是 homepage
