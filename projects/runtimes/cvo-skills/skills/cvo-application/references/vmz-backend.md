# VMZ and CVO — author vs deployment

## Author contract

VMZ authors write `<script server>` without choosing CVO, Node, Workers, D1, or Iris gateway. The compiler emits:

- backend-neutral **ServerArtifact**
- **RequestContext**
- **capability requirements** (when remote services are needed)

Business logic and same-process data access stay **local** unless a capability is declared.

## Deployment contract

**CVO** is a first-class VMZ backend profile for:

- edge HTTP/RPC entry
- auth, queue, job, cache adapters
- Iris HTTP/gateway transport on Workers (**no N-API** — use CVO official WASM wrap or D1/gateway)
- Workers / Pages / Durable Objects production profiles

Choosing CVO happens in **deployment profile** (`vmz.config.ts#delivery`, Wrangler, CI), not in VMZ component syntax.

**Competing Node profile:** `@vmz/server` (Rust server-core + N-API + optional capability layer) is the default for `vmz serve` / Node hosts. See [references/vmz-server.md](references/vmz-server.md).

## Iris on Cloudflare Workers

On **Workers / Pages / DO**, Iris **cannot** run through N-API (`@yydb/iris-napi`). CVO provides the **official WASM encapsulation**: `worker-wasm` + `iris-unknown-wasm32` via `@cvo/plugin-iris`. Alternatives: `worker-d1` (D1 binding) or `worker-gateway` (remote Iris). See [references/iris-workers.md](references/iris-workers.md).

## When to wire CVO transport

Explicitly, when the app needs:

- remote database or Iris gateway from Workers
- cross-service RPC with auth/deadline/trace propagation
- queue/cron/DO alarm execution graph
- edge observability or idempotency policies

Each such call must be visible in execution plan, capability manifest, and tracing — with its own timeout/cancel semantics.

## Same-process vs remote

| Call kind | Default path |
|-----------|--------------|
| Business function in ServerArtifact | Local |
| Same-process Iris binding (Node only, N-API) | Local via `@vmz/server` |
| Workers Iris (generated call in isolate) | CVO **`worker-wasm`** official WASM wrap — **not N-API** |
| Workers DB via Iris D1 / gateway | CVO `worker-d1` / `worker-gateway` |
| Edge auth/session | CVO capability profile |

## Package map (this repo)

| Path | npm name | Role |
|------|----------|------|
| `projects/runtimes/cvo-core` | `@cvo/core` | Contract v1 types and schema ids |
| `projects/runtimes/cvo-server` | `@cvo/server` | Node/Bun/Deno + Fetch host adapter |
| `projects/runtimes/cvo-tools` | `@cvo/cvo` | CLI (`cvo catalog`) |
| `projects/homepage` | `@cvo/homepage` | VMZ site + Worker demo |
| `projects/plugins/cvo-plugin-iris` | `@cvo/plugin-iris` | Iris transport + Workers WASM official wrap manifest |
| `projects/plugins/cvo-plugin-prisma` | `@cvo/plugin-prisma` | Prisma capability manifest |
| `projects/plugins/cvo-plugin-drizzle` | `@cvo/plugin-drizzle` | Drizzle ORM capability manifest |
