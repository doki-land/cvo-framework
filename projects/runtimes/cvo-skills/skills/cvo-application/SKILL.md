---
name: cvo-application
description: >-
  Help deploy VMZ/VOS/Iris apps with CVO — one service, many transports (HTTP, RPC, jobs, edge).
  Not a generic Hono replacement. Use for Workers, wrangler, Iris transport, deployment profiles.
license: MPL-2.0
compatibility: >-
  Install with Node.js 18+ (`npx skills add`). CVO contract applies to Workers and Node/Bun/Deno hosts;
  see references/positioning.md, references/cloudflare.md, references/vmz-backend.md, references/vmz-server.md, references/iris-workers.md, and references/workers-data.md.
metadata:
  author: doki-land
  version: "0.0.0"
---

# cvo-application

Help the user ship **VOS/Iris/VMZ** applications with CVO.

**Product promise:** 一次定义服务能力，多种入口与宿主复用 — *One service. Many transports. Explicit boundaries.*

CVO is **not** a generic Hono substitute. `contract-first` is an **internal** implementation strategy (compiler/generator), not user-facing marketing.

**Maturity:** repo ships envelopes, Fetch adapter, plugin manifests, manual homepage Worker — not full multi-transport generation yet. See [references/positioning.md](references/positioning.md).

## Core boundaries

```text
VMZ script server  →  backend-neutral ServerArtifact (author does not pick CVO in source)
Deployment profile →  CVO / Node server / Worker host / test host
```

- `<script server>` defaults to **local in-process** execution in the same ServerArtifact/host.
- CVO HTTP/RPC transport is **opt-in** via explicit capability requirements — never implicit on every call.
- Data access is **Iris-first**; on Workers Iris **cannot use N-API** — WASM plan + D1 exec or gateway (see [references/iris-workers.md](references/iris-workers.md)). Prisma/Drizzle plugins are secondary migration adapters only.

## Positioning vs Hono

See [references/positioning.md](references/positioning.md). User-facing: **one service, many transports, explicit boundaries**. Do not lead with `contract-first` or “write once, run everywhere”.

## How to help

1. **Inspect layout** — `vmz.config.ts`, delivery profiles, and whether `/api/*` is served by VMZ dev host or a Worker.
2. **Keep contracts typed** — route input/output and diagnostics use `cvo-contract-v1` shapes from `@cvo/core`.
3. **Split surfaces** — VMZ static/SSR assets vs Worker `fetch` handler; do not assume Node N-API on Workers.
4. **Declare capabilities** — remote DB, auth, queue, cross-service RPC must appear in manifest/plan/trace.
5. **Prefer small diffs** — one route profile or one deployment slice per change.

## Local development

| Layer | Typical command |
|-------|-----------------|
| VMZ frontend | `pnpm --filter @cvo/homepage dev` or `vmz dev .` |
| CVO libraries | `pnpm build` at repo root (`@cvo/core`, `@cvo/server`) |
| Worker preview | `pnpm --filter @cvo/homepage worker:dev` (Wrangler) |

VMZ `script server` `@Get` routes work in dev; production `/api/*` on Cloudflare is handled by the Worker entry in
`projects/homepage/worker/`.

## Cloudflare deployment

See [references/cloudflare.md](references/cloudflare.md) for `wrangler.toml`, static assets binding, and `/api` routing.

## VMZ + CVO relationship

See [references/vmz-backend.md](references/vmz-backend.md) for author vs deployment contracts.

See [references/vmz-server.md](references/vmz-server.md) for **CVO vs native `@vmz/server`** — when to use edge profile vs Node Rust/N-API host, and why N-API/Iris cannot run inside Workers isolates.

## Contract reference

See [references/reference.md](references/reference.md) for Invocation/Result/Diagnostic envelopes.

See [references/iris-workers.md](references/iris-workers.md) for **Iris on Workers** (WASM plan + D1 exec; no N-API).

See [references/workers-data.md](references/workers-data.md) for Prisma / Drizzle on Workers.

## Do not

- Turn VMZ into a CVO-specific DSL or require CVO imports in every `script server` file.
- Use Node-only APIs (`Buffer`, TCP, N-API, filesystem) in Worker core paths.
- Recommend CVO over Hono for generic APIs with no VOS/Iris/VMZ commitment.
- Claim full generated CVO surface (routes/RPC/jobs) is shipped when only envelopes/plugins exist.
- Put `@yydb/iris-napi` in a Worker bundle — use WASM plan + D1 exec or gateway.
- Use Prisma on **D1** without `driver-adapter-d1` — D1 is SQLite, not PG protocol.
- Use Prisma on Workers with `node-native` (legacy binary engine).
- Hand-edit generated route tables — fix VOS/service contracts upstream when generation exists.
- Silently proxy every `script server` call through CVO HTTP in production without capability declaration.
