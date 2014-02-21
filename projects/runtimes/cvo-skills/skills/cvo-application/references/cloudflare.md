# Cloudflare deployment (homepage pattern)

The reference layout lives in `projects/homepage/`:

```text
dist/cdn/          ← VMZ static build (`vmz build --profile static`)
worker/index.ts    ← CVO Fetch handler (`@cvo/core` + `@cvo/server`)
wrangler.toml      ← Worker + Assets binding
```

## wrangler.toml essentials

- `main = "worker/index.ts"` — edge entry; no Node N-API.
- `[assets] directory = "./dist/cdn"` — VMZ static output.
- `not_found_handling = "single-page-application"` — client router fallback.

Build order:

```bash
pnpm --filter @cvo/core --filter @cvo/server run build
pnpm --filter @cvo/homepage run build
pnpm --filter @cvo/homepage worker:deploy
```

## Routing

| Path | Handler |
|------|---------|
| `/api/health` | Worker JSON health |
| `/api/catalog` | `contractCatalog()` from `@cvo/core` |
| `/api/invoke` | POST typed invocation envelope |
| other | static assets / SPA fallback |

Local preview:

```bash
pnpm --filter @cvo/homepage worker:dev
```

Wrangler serves built assets and the Worker together when `dist/cdn` exists.

## Workers constraints

### Iris: no N-API on Workers

**Iris cannot run via N-API on Cloudflare Workers.** Use CVO's **official WASM encapsulation** (`worker-wasm` + `iris-unknown-wasm32` via `@cvo/plugin-iris`), or `worker-d1` / `worker-gateway`. See [references/iris-workers.md](references/iris-workers.md).

Forbidden in Worker core:

- `@yydb/iris-napi` and any N-API Iris binding
- TCP sockets, `node:fs`, dynamic `require`
- Prisma **`node-native`** (legacy Rust query engine binary)
- pretending the browser can open PostgreSQL/MySQL directly

Allowed:

- Fetch, Web Crypto, Streams, URL, AbortSignal
- Iris **`iris-unknown-wasm32`** (`worker-wasm`)
- Prisma on **D1**: `driver-adapter-d1` only (SQLite — not PostgreSQL)
- Prisma on **remote SQL**: `accelerate-http` or `edge-wasm`
- explicit platform bindings (D1, KV, Queues, R2, DO) via capability profiles

## CI hint

Add a job that runs `pnpm build`, `vmz check`, and `wrangler deploy --dry-run` (or `wrangler versions upload`) before production deploy.
