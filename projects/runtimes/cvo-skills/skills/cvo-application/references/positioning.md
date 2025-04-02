# CVO product language

## Primary promise (user-facing)

**中文：**

> 一次定义服务能力，多种入口与宿主复用。

**English:**

> One service. Many transports. Explicit boundaries.

**Subtitle (when needed):**

> CVO unifies HTTP, typed RPC, background jobs, auth, data access, and deployment under one **service runtime contract** — platform differences stay visible through capabilities and profiles.

### What users actually get

```text
Define a service operation once
  -> HTTP, typed RPC, queue/job, cron, in-process host can call it
  -> same inputs/outputs, auth, errors, deadlines, observability shape
  -> D1 vs gateway vs Node vs Workers differ via explicit capability + profile — not hidden
```

### What we do NOT promise

```text
Write once, run everywhere with identical transactions, performance, and delivery semantics
```

D1 ≠ remote Postgres; queue ≥-once ≠ HTTP; DO state ≠ stateless Worker. Differences are **explicit**, not erased.

---

## Three layers of wording

| Layer | Audience | Phrasing |
|-------|----------|----------|
| **Marketing** | Users, homepage | 一次定义服务能力，HTTP / RPC / Job / 边缘部署复用 |
| **Product** | Docs, skills, README | One service definition → HTTP, RPC, jobs, Workers/Node hosts; shared I/O, auth, errors, trace; capability/profile for platform gaps |
| **Architecture** | Implementers only | `contract-first` — schema/service/operation before generated route/RPC/job/client |

**Do not** lead with `contract-first`, OpenAPI generator, or “enterprise schema workflow” in user-facing copy.

---

## Not a Hono replacement

```text
NOT:  universal TypeScript web framework
IS:   VOS / Iris / VMZ application backend platform
```

| | Hono | CVO |
|---|------|-----|
| Kernel | Thin HTTP router | Service runtime + multi-transport |
| Win | Ecosystem, speed, freedom | Unified service contract across transports (when mature) |

See full comparison and maturity notes below.

---

## VMZ author experience

VMZ authors do **not** write CVO contracts by hand:

```text
.vmz / script server / component
  -> compiler → ServerArtifact
  -> deployment profile → CVO Worker | @vmz/server Node | test host
```

`contract-first` lives in **compiler and generators**, not in author-facing DSL.

For VMZ-facing copy:

```text
页面与服务能力一次定义，按 deployment profile 运行。
```

---

## Design target vs current implementation

**Target:**

```text
VOS service operation
  -> generated HTTP / RPC / job surfaces
  -> execution graph + Iris transport + deployment profile
```

**Shipped in `cvo-framework` today:**

```text
@cvo/core, @cvo/server, @cvo/plugin-* manifests, manual homepage Worker
```

**Not yet proven:** full VOS → generated multi-transport chain. Do not market planned capabilities as shipped.

---

## CVO vs Hono (honest)

| Dimension | Hono | CVO |
|-----------|------|-----|
| Dev style | Handwritten routes, fast hacks | Service definition → generated surfaces |
| Data | Any ORM | Iris-first; Prisma/Drizzle = secondary adapters |
| Ecosystem | Mature | Early, vertical |
| Debug | Short path | VOS → generate → graph → transport |

```text
Hono:  compose your stack
CVO:   one service, many transports, explicit boundaries
```

---

## Risks (keep honest in replies)

- **Scope vs maturity** — wide platform promise, narrow shipped surface
- **Coupling** — VOS/Iris/CVO/profile lock-in is feature for VMZ stack, cost elsewhere
- **Escape hatch** — health/webhooks must not require full VOS ceremony
- **Transport semantics** — unify control plane; do not flatten HTTP stream vs queue ack vs cron retry
- **ORM plugins** — not three equal “first” data models

Workers + Iris + D1: **WASM plan + D1 execute** — [iris-workers.md](iris-workers.md).

---

## Migration wording (prefer over “contract-first migration”)

```text
service-capability migration
先定义服务能力，再生成多入口实现
```

---

## Agent rules

- Lead with **one service, many transports, explicit boundaries** — not `contract-first`.
- Do not sell “write once, run everywhere” with identical semantics across all hosts.
- Do not recommend CVO over Hono for generic TS APIs without VOS/Iris/VMZ.
- Do not claim full generation chain is shipped.
- VMZ authors: deployment profile, not CVO DSL in source.
