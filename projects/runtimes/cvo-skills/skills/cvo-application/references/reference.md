# CVO contract v1 (`cvo-contract-v1`)

Schema ids exported from `@cvo/core`:

| Document | Schema id |
|----------|-----------|
| Invocation | `cvo.invocation.v1` |
| Result | `cvo.result.v1` |
| Diagnostic | `cvo.diagnostic.v1` |
| Capability | `cvo.capability.v1` |
| Capability manifest | `cvo.capability_manifest.v1` |
| Transport | `cvo.transport.v1` |
| Trace context | `cvo.trace_context.v1` |

## Invocation shape

```text
Invocation {
  contractId,
  operationId,
  transport,
  input,
  identity?,
  capabilities,
  deadline?,
  traceContext
}
```

Execution stages (fixed order):

```text
decode → authenticate → authorize → validate
  → open transaction (optional)
  → invoke generated Iris/service handler
  → commit/rollback → encode result/diagnostic → observe
```

## Diagnostics

Use stable **code**, **messageKey**, typed **args**, optional path/span — not raw English as the only contract.

Inspect catalog locally:

```bash
pnpm cvo catalog
```

## Transport kinds

- `http-fetch` — public HTTP
- `typed-rpc` — internal structured RPC
- `queue-event` — queue/DO messages
- `cron-alarm` — scheduled invocations
- `in-process` — local host dispatch (default for `@cvo/server`)

Transport changes delivery guarantees, not the operation semantic envelope.
