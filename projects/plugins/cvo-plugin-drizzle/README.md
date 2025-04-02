# @cvo/plugin-drizzle

[Drizzle ORM](https://orm.drizzle.team/) **capability** profiles for CVO — pure TypeScript, no query-engine binary.

## Workers：D1 首选轻量 ORM

**D1 是 SQLite binding**，不是 PostgreSQL。Drizzle 在 Workers 上典型用法：

```typescript
import { drizzle } from 'drizzle-orm/d1';

const db = drizzle(env.DB);
```

CVO manifest：`driver: "d1-binding"`, `d1BindingName: "DB"`

## Driver 对照

| CVO `driver` | Drizzle 用法 | Workers |
|--------------|--------------|---------|
| `d1-binding` | `drizzle-orm/d1` + D1 binding | ✓ **D1 推荐** |
| `http-remote` | Neon / PlanetScale / libsql HTTP 驱动 | ✓ |
| `node-native` | TCP / 本地文件驱动 | ✗（仅 Node/Bun） |

Unlike Prisma, Drizzle has **no Rust query engine** — Workers 限制来自 **SQL 传输层**（binding vs HTTP vs TCP），不是 ORM 本身。

## 与 Iris / Prisma 的关系

- CVO 主链仍是 **Iris generated call**
- Drizzle 是**可选、显式** capability；D1 上常与 Iris 二选一，或 `secondaryToIris: true` 混用需审计
- 已有 Prisma schema → `@cvo/plugin-prisma`；要更小 bundle / 更轻 edge ORM → `@cvo/plugin-drizzle`

详情：`@cvo/skills` → `references/workers-data.md`
