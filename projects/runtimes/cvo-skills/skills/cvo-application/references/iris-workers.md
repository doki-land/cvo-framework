# Iris on edge platforms (Cloudflare Workers)

Short reference — full data-layer guide: [workers-data.md](workers-data.md).

## The rule

If you deploy to **Cloudflare Workers, Pages, or Durable Objects**:

**Iris does not run through N-API.** `@yydb/iris-napi` is Node-only (native addon + TCP). Workers isolates cannot load it.

## Recommended split: WASM plans, D1 executes

For **Workers + D1** (the main Cloudflare production path), the correct model is **not** “D1 OR WASM”. It is:

```text
generated Iris call
  -> WASM (iris-unknown-wasm32): Rust planner / lowering -> parameterized SQL or physical plan
  -> D1 binding (env.DB): execute only — SQLite platform API, no TCP, no PG protocol
```

| Layer | Role | Rust consistency |
|-------|------|------------------|
| **WASM** | VOS IR → validation → physical plan / SQL | Same Rust Iris code as Node (wasm32 artifact) |
| **D1 binding** | Run prepared statements against `env.DB` | Dumb executor; no second planner in TS |

This matches Iris architecture: *WASM may own plan preparation*; the foreign store adapter (D1) owns **protocol execution only**.

**Do not** reimplement SQL lowering in TypeScript for Iris on D1 — that breaks Rust/conformance parity with Node N-API.

### vs other paths

| Path | Plan / lowering | Execute |
|------|-----------------|---------|
| **Workers + D1** (recommended) | **WASM** (`iris-unknown-wasm32`) | **D1 binding** |
| **Workers + remote PG/MySQL** | Gateway (Rust off-edge) or WASM + gateway | Fetch / remote driver |
| **Workers + in-memory only** | **WASM** full runtime | WASM local backend |
| **Node / vmz serve** | **Rust N-API** in-process | Native driver / N-API |

## CVO manifest shape (Workers + D1)

`worker-d1` means **D1 is the execution backend**. For Rust runtime parity, pair it with WASM plan preparation:

```json
{
  "deploymentProfile": "worker-d1",
  "transport": "d1-binding",
  "d1BindingName": "DB",
  "wasmTarget": "iris-unknown-wasm32",
  "schemaFingerprint": "…"
}
```

Runtime flow:

```text
@yydb/iris codegen
  -> generatedCall(envelope)
  -> instantiate iris-unknown-wasm32
  -> wasm lowers to D1-safe SQL + binds
  -> env.DB.prepare/bind/run
  -> Iris result envelope -> CVO Response
```

**wrangler.toml:**

```toml
[[d1_databases]]
binding = "DB"
database_name = "my-app"
database_id = "…"
```

## When full WASM runtime (no D1)

Use **`worker-wasm`** alone when there is **no D1 binding** and you need Iris in isolate without gateway hop — e.g. memory/local backend, browser-local, or non-CF WASM edge.

## When gateway

Use **`worker-gateway`** when the database is **remote Postgres/MySQL/YYDB** and cannot be exposed as a Workers binding.

## Node

**`node-edge` + `napi-in-process`** — full Rust chain via `@yydb/iris-napi`; via `@vmz/server`, not CVO Worker.

## Implementation status (this repo)

- **Today:** `@cvo/plugin-iris` validates manifests (`worker-d1`, `d1-binding`, `wasmTarget`).
- **Roadmap:** `cvo-worker-d1` — wire WASM plan step + D1 exec step in CVO Worker host + Iris conformance fixtures.

Non-Iris escape hatches today: Drizzle `drizzle-orm/d1`, Prisma `@prisma/adapter-d1` (`@cvo/plugin-drizzle` / `@cvo/plugin-prisma`).

## One-line for agents

> Workers + Iris + D1 → **WASM (Rust) generates SQL/plan, D1 executes**; never N-API; do not lower SQL in TS.
