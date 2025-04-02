# CVO server vs native `@vmz/server`

VMZ `script server` 产出**同一份** backend-neutral `ServerArtifact`。部署时再选宿主：**CVO（edge）** 或 **`@vmz/server`（Node 原生）**——二者是竞争/互补的 **deployment profile**，不是两套 VMZ 语言。

```text
script server
  -> ServerArtifact + capability requirements
  -> deployment profile 二选一（或分环境组合）
       ├── @vmz/server + Rust server-core + N-API   （Node / Bun / Deno 默认主链）
       └── CVO + Worker Fetch + Iris transport       （Cloudflare Workers / edge）
```

## 一句话定位

| | `@vmz/server` | `@cvo/server`（CVO） |
|---|---|---|
| **是什么** | 可选 server capability layer；Rust 语义 + Node adapter | Edge application backend profile；Fetch 合同 + Worker 宿主 |
| **不是什么** | Express/Hono 替代品；内建 ORM/队列/邮件 | VMZ 语言的一部分；每个 script server 的必选中间层 |
| **典型宿主** | Node / Bun / Deno；`vmz serve` / ServerArtifact host | Cloudflare Workers / Pages / DO |
| **N-API** | 实现边界（Rust core → N-API → `@vmz/server`） | **Worker 禁止 N-API**；Iris 可走 **`iris-unknown-wasm32`** |
| **Iris 数据** | in-process N-API binding（`node-edge`） | WASM-local / D1 / HTTP gateway |
| **共享输入** | 同一份 `ServerArtifact`、同一套 capability 声明 | 同一份 `ServerArtifact`、同一套 capability 声明 |

## `@vmz/server` 推荐结构（VMZ 主链）

```text
vmz-protocol
  -> ServerArtifact / ServerError / capability schema

Rust server-core（vmz-server-core）
  -> 验证、规范化、计划；不依赖 Node、不依赖 HTTP 框架

vmz-napi
  -> Rust core 的 Node 出口；类型/生命周期/错误转换

@vmz/server
  -> RequestContext、Response helpers、capability adapter
  -> 执行 JS handler；不复制 Rust 语义

vmz CLI
  -> inspect / serve / artifact 管理（与 N-API 同一 Rust core）
```

**共享真相源**是 `Rust server-core + protocol`，不是 CLI 一套、Node 另一套 TypeScript 实现。

## `@cvo/server` 推荐结构（edge 主链）

```text
@cvo/core
  -> Invocation / Result / Diagnostic / Transport 合同

@cvo/server
  -> Fetch handler、in-process dispatch（Node 侧 dev/parity）

Worker entry
  -> /api/* + static assets；Iris gateway / D1 transport

@cvo/plugin-*
  -> auth / logger / iris transport / … capability 插件
```

CVO **不**重新解析 `.vmz`，**不**替代 VMZ 编译器；消费已生成的 contract / transport manifest。

## `script server` 默认：两者都不强制框架

```ts
<script server>
const user = await db.users.find(id);
return user;
</script>
```

业务逻辑可以裸写。只有合同密集型能力才按需引入：

| 能力 | `@vmz/server` | CVO |
|------|---------------|-----|
| RequestContext / abort | ✓ 显式 `ctx` | Worker `Request` + trace |
| ServerArtifact 加载/校验 | ✓ Rust core + host | 消费 artifact / manifest |
| secret / session / cache | ✓ capability | ✓ capability profile |
| SSR / DocumentLayout host | ✓ `createRenderHost` | 静态 CDN + 可选 edge action |
| edge HTTP/RPC / Wrangler | — | ✓ 主场景 |
| 内建 router/middleware 链 | ✗ 不做 | ✗ 不做（非 Hono） |

## Workers：Iris 不能走 N-API

部署到 **Cloudflare Workers** 等 edge 平台时：

> **Iris 无法通过 N-API（`@yydb/iris-napi`）运行。** 这不是配置问题，是 isolate 平台边界。

要在 Worker 内使用 Iris generated call，须走 **CVO 官方 WASM 封装**：

```text
worker-wasm + wasm-local + iris-unknown-wasm32
  -> @cvo/plugin-iris 校验 manifest
  -> CVO Worker host 加载 wasm 产物并执行 generatedCall()
```

也可选用 **不经 N-API** 的 D1（`worker-d1`）或远端 gateway（`worker-gateway`）。详见 [references/iris-workers.md](references/iris-workers.md)。

**Workers isolate 里同样不能跑：**

- Iris `@yydb/iris-napi`（TCP + native addon）
- Prisma **legacy** native query engine（旧 Rust binary）
- 任意 Node-only TCP driver

**Workers 上的可行路径：**

```text
Iris（禁止 N-API，CVO 官方 WASM 封装）:
  worker-wasm  -> iris-unknown-wasm32（@cvo/plugin-iris 官方封装方案）
  worker-d1    -> D1 binding
  worker-gateway -> Fetch → 远端 gateway（N-API 仅在 Node/Rust 侧）
```

详见 [references/workers-data.md](references/workers-data.md)。

`@vmz/server` 路径则在 **Node 进程内** 使用 N-API Iris binding——这是 **`node-edge` profile**，不是 Worker profile。

## 如何选择（决策树）

```text
部署目标是什么？
├── 仅 Node / 自建 VPS / vmz serve
│     └── @vmz/server + ServerArtifact（默认）
│           Iris: N-API in-process
│
├── Cloudflare Workers / Pages
│     └── CVO Worker profile
│           Iris: CVO 官方 WASM 封装（worker-wasm）/ worker-d1 / worker-gateway — **禁止 N-API**
│           可选 Prisma: driver-adapter-d1（D1）/ accelerate-http / edge-wasm（远端 SQL）
│
└── 静态站 + 少量 edge API
      └── VMZ static CDN + CVO Worker 只处理 /api/*
            script server 本地 dev；生产 edge 不绕 HTTP 除非显式 capability
```

## 禁止的混淆

1. **把 CVO 写进 VMZ 语法** — deployment profile 选择，不是语言特性。
2. **在 Worker 里用 Iris N-API** — 禁止；改用 **CVO 官方 WASM 封装**（`worker-wasm`）或 D1/gateway。
3. **让 `@vmz/server` 变成 Express** — 它是 capability layer，外部 IO 走 plugin。
4. **CLI 与 Node 各维护一套 ServerArtifact 语义** — 必须同一 Rust core + fixtures。
5. **隐式全局 `currentRequest`** — 两边都要求显式 context / trace。

## 与 Compiled DocumentLayout

DocumentLayout / SSR 需要统一的 locale、request、render host：

- **Node 路径**：`@vmz/server` → `createRenderHost` → DocumentLayout chrome
- **Edge 路径**：静态预渲染 + CDN；动态部分走 CVO action/RPC（显式 capability）

`@vmz/server` 提供宿主与合同，**不**吞掉 DocumentLayout 产品语义。

## 相关包（本仓库 vs VMZ 仓库）

| 包 | 仓库 | 角色 |
|----|------|------|
| `@vmz/server` | vmz-framework | Node server capability（竞争方案 / Node 默认） |
| `@cvo/core` / `@cvo/server` | cvo-framework | Edge contract + Fetch adapter |
| `@cvo/plugin-iris` | cvo-framework | Workers-safe Iris transport manifest |
| `@cvo/plugin-drizzle` | cvo-framework | Drizzle D1 / HTTP / Node driver manifest |

## Agent 提示

- 用户问「Workers 上怎么用 Iris？」→ **不能 N-API**；用 **CVO 官方 WASM 封装**（`iris-workers.md`）或 D1/gateway。
- 用户问「CVO 还是 @vmz/server」→ 先问 **部署宿主**；Node 才用 N-API Iris。
- 用户要在 Worker 用 `iris-napi` → **拒绝**，说明 CVO `worker-wasm` 官方封装方案。
