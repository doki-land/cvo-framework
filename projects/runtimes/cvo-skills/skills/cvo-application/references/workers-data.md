# Iris on Cloudflare Workers（及同类 edge 平台）

## 硬约束：Workers 上不能跑 Iris N-API

如果你要把 VMZ 应用部署到 **Cloudflare Workers、Pages、Durable Objects** 等 V8 isolate 宿主：

> **Iris 无法通过 `@yydb/iris-napi` / N-API 接口运行。**

原因不是 Iris 能力缺失，而是 **平台边界**：

```text
iris-napi  = native addon + TCP/socket + Node 进程内绑定
Workers    = 无 N-API、无 TCP、无 Node 原生模块加载
```

因此在 Worker bundle 里 `import '@yydb/iris-napi'` **必然失败**（构建期或运行期）。这与 `@vmz/server` 在 Node 侧用 N-API 跑 Iris 是 **不同 deployment profile**，不能混用。

## Workers + D1：WASM 生成 SQL，D1 执行（推荐）

D1 生产路径 **不是**「有 D1 就不用 WASM」。正确拆分：

```text
generated call
  -> iris-unknown-wasm32（Rust：resolver / planner / lowering）
  -> 参数化 SQL 或 physical plan
  -> env.DB（D1 binding，只执行，不规划）
```

| 层 | 职责 |
|----|------|
| **WASM** | Rust Iris 与 Node N-API **同一套语义**（compile 到 wasm32） |
| **D1** | SQLite platform binding，** dumb executor** |

**禁止**在 TS 里另写一套 SQL 生成逻辑冒充 Iris D1 adapter — 会破坏与 Node 的 conformance 一致。

Manifest 示例（`worker-d1` + WASM plan）：

```json
{
  "deploymentProfile": "worker-d1",
  "transport": "d1-binding",
  "d1BindingName": "DB",
  "wasmTarget": "iris-unknown-wasm32",
  "schemaFingerprint": "…"
}
```

## 其他可行路径

| 路径 | 说明 |
|------|------|
| **WASM plan + D1 exec** | **CF + D1 主路径**（上节） |
| **HTTP gateway** | 远端 PG/MySQL；Rust 在 gateway，Worker Fetch |
| **纯 worker-wasm** | 无 D1，内存/local backend，或不能走 gateway 的 edge |
| **自行 WASM 封装** | 须对齐 CVO manifest，禁止 `iris-napi` |

## CVO 官方封装（WASM 部分）

```text
Iris schema / codegen
  -> wasm32 artifact（iris-unknown-wasm32）
  -> lowering -> SQL/plan
  ->（D1 路径）env.DB 执行 /（gateway 路径）Fetch 出站
```

### 与 Node `@vmz/server` 的对比

```text
Node / vmz serve:
  全链 Rust N-API（plan + execute 同在进程）

Cloudflare Workers + D1:
  WASM Rust（plan）+ D1 binding（execute）   ✓ 推荐

Cloudflare Workers + 远端库:
  worker-gateway                               ✓

napi-in-process on Workers                     ✗ 禁止
```

## Agent 必须说清的一句话

> Workers + Iris + D1 → **WASM 生成 SQL/plan，D1 执行**；不是 N-API，也不是 TS 重造 planner。

---

# Workers 数据层：Prisma / Drizzle

Cloudflare Workers **可以**跑 edge 数据访问，但 transport 必须换层：**禁止 N-API / TCP / 旧版 Prisma Rust binary**；允许 **WASM、Fetch、platform binding**。

**D1 是 SQLite，不是 PostgreSQL。** 不要用 PG 协议或 `postgresql://` 去连 D1；D1 走 **binding + SQLite adapter**。

CVO 主链数据访问仍是 **Iris generated call**（`@cvo/plugin-iris`）。Prisma / Drizzle 是**可选、显式**的第二 capability。

## 先选存储，再选 transport

```text
Cloudflare D1（SQLite binding）
  -> Iris: worker-d1 = WASM plan（iris-unknown-wasm32）+ D1 exec（env.DB）
  -> Prisma: driver-adapter-d1
  -> Drizzle: d1-binding

远端 Postgres / MySQL（HTTP 出站，非 D1）
  -> Iris: worker-gateway
  -> Prisma: accelerate-http / edge-wasm

无 D1、要在 isolate 跑完整 Iris 引擎（内存/local）
  -> worker-wasm（纯 WASM runtime，不绑 D1）
```

## Iris transport 一览

| Profile | 说明 |
|---------|------|
| `worker-d1` | **WASM plan + D1 exec**（D1 主路径） |
| `worker-wasm` | 纯 WASM runtime（无 D1，内存/local） |
| `worker-gateway` | Fetch → 远端 Iris |
| `node-edge` | N-API（仅 Node） |

## Prisma 在 Workers 上

自 Prisma **6.16+** 起引擎为 TS/WASM。CVO **只拒绝** legacy `node-native`（旧 Rust binary）。

### D1（SQLite）

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

const prisma = new PrismaClient({ adapter: new PrismaD1(env.DB) });
```

CVO manifest：`transport: "driver-adapter-d1"`, `d1BindingName: "DB"`

### Drizzle + D1（轻量）

```typescript
import { drizzle } from 'drizzle-orm/d1';

const db = drizzle(env.DB);
```

CVO manifest：`driver: "d1-binding"`, `d1BindingName: "DB"`（`@cvo/plugin-drizzle`）

### 远端 SQL（与 D1 无关）

- Prisma Accelerate → `accelerate-http`
- Prisma Client edge → `edge-wasm` + 远端 URL
- Drizzle HTTP 驱动 → `http-remote`

| CVO transport / driver | 存储 | 机制 |
|------------------------|------|------|
| Iris `worker-wasm` | 同 isolate | CVO WASM 封装 |
| Iris `worker-d1` | D1 | binding |
| Iris `worker-gateway` | 远端 | Fetch |
| Prisma `driver-adapter-d1` | D1 | SQLite adapter |
| Drizzle `d1-binding` | D1 | drizzle-orm/d1 |
| Prisma/Drizzle 远端 | 远端 SQL | HTTP |

## 决策树

```text
部署在 CF Workers？
  Iris 要用 generated call？
    D1         -> WASM 生成 SQL/plan + D1 执行（worker-d1 + iris-unknown-wasm32）
    远端 DB    -> worker-gateway
    无 D1 内存 -> worker-wasm
  不用 Iris？
    D1 -> Drizzle d1-binding 或 Prisma driver-adapter-d1
  仅 Node？
    -> napi-in-process（@vmz/server 默认）
```

## Agent 提示

- 「Workers 上 Iris + D1？」→ **WASM 生成 SQL/plan，D1 执行**；禁止 N-API，禁止 TS 重造 planner。
- 「D1 用什么 ORM？」→ SQLite：Iris D1、Drizzle、或 Prisma adapter-d1。
- 不要把 Node dev 的 `iris-napi` 路径打进 Wrangler。
