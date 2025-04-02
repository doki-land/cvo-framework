# @cvo/server

Node / Bun / Deno **Fetch adapter** for CVO contracts. Reuses `@cvo/core` shapes; does not define a parallel invocation model.

## vs `@vmz/server` (native VMZ server)

Both consume the same VMZ **`ServerArtifact`** — they are **deployment profiles**, not competing language semantics.

| | `@vmz/server` | `@cvo/server` |
|---|---|---|
| Host | Node / Bun / Deno (`vmz serve`) | Workers + optional Node dev parity |
| Core | Rust `server-core` + N-API | `@cvo/core` contract + Fetch |
| Iris | N-API in-process | HTTP gateway / D1 (no N-API on Workers) |
| Role | Default Node server capability layer | Edge backend profile |

See `@cvo/skills` → `references/vmz-server.md` for the full decision guide.

## Local execution default

In-process handlers stay on the same host. Remote CVO HTTP/RPC is **opt-in** via capability requirements on the invocation envelope.
