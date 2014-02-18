# @cvo/plugin-iris

Iris **transport** profiles for CVO deployment hosts.

## Cloudflare Workers: no N-API

**Iris cannot run via `@yydb/iris-napi` on Workers.**

## Workers + D1: WASM plans, D1 executes

Recommended production split:

```text
generated call -> iris-unknown-wasm32 (Rust plan/SQL) -> env.DB (execute only)
```

Manifest:

```json
{
  "deploymentProfile": "worker-d1",
  "transport": "d1-binding",
  "d1BindingName": "DB",
  "wasmTarget": "iris-unknown-wasm32"
}
```

| Profile | Plan | Execute |
|---------|------|---------|
| `worker-d1` | WASM (`iris-unknown-wasm32`) | D1 binding |
| `worker-wasm` | WASM full runtime | local/memory |
| `worker-gateway` | off-edge / gateway | Fetch |
| `node-edge` | Rust N-API | native driver |

See `@cvo/skills` → `references/iris-workers.md`.
