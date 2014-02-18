# @cvo/plugin-prisma

Prisma **capability** profiles for CVO — not a second ORM inside CVO.

## Workers：Prisma 可用，但 D1 ≠ Postgres

**Cloudflare D1 是 SQLite binding**，不是 PostgreSQL。连 D1 用 **`driver-adapter-d1`**，不要用 PG 协议或 Prisma Postgres 产品路径。

自 Prisma **6.16+** 起引擎为 TS/WASM。CVO **只拒绝** legacy **`node-native`**（Rust binary 在 isolate 内）。

| CVO transport | 适用存储 | Workers |
|---------------|----------|---------|
| `driver-adapter-d1` | **D1（SQLite）** | ✓ **D1 首选** |
| `accelerate-http` | 远端 Postgres/MySQL 等 | ✓ |
| `edge-wasm` | 远端 SQL（非 D1 binding） | ✓ |
| `node-native` | Node 侧 legacy binary | ✗（仅 Node/Bun） |

Workers 密钥：**.dev.vars`** / Wrangler secrets。

## 与 Iris 的关系

CVO 主链仍是 **Iris generated call**。D1 场景通常优先 **`@cvo/plugin-iris` `worker-d1`**；已有 Prisma schema 才显式加 `driver-adapter-d1`。

## 推荐

- **D1**：Iris `worker-d1` 或 Prisma `driver-adapter-d1`
- **远端 PG/MySQL**（非 D1）：`accelerate-http` 或 `edge-wasm`
- **Node VPS**：`node-native`

详情：`references/workers-data.md`
