# @cvo/core

CVO contract v1 — invocation, result, diagnostic, capability and transport envelopes.

0.0.1 preview: fixed execution graph (`decode` → `validate` → `capability_check` → `invoke` → `encode`) and JSON fixtures under `specifications/fixtures/`.

0.0.2 preview: static HTTP route table (`src/route.ts`) with path/query/body decode for Worker vertical slice.

Edge-first: no Node, N-API, TCP or filesystem APIs.
