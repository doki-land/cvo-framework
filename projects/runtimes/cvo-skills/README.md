# `@cvo/skills`

Agent Skills that help you build and deploy **CVO** backends — edge-native HTTP/RPC, VMZ deployment profiles, Cloudflare Workers/Pages, and Iris transport boundaries.

## Install

```bash
npx skills add @cvo/skills --skill cvo-application -y
npx skills add @cvo/skills --list
```

Requires Node.js 18+ for the installer.

## Skills

| Skill | Purpose |
|-------|---------|
| `cvo-application` | CVO product language, VMZ deployment, Workers/Iris, vs Hono |

## Maintainers

Source: [doki-land/cvo-framework](https://github.com/doki-land/cvo-framework) → `projects/cvo-skills`

```bash
pnpm --filter @cvo/skills typecheck
npx skills add ./projects/cvo-skills --list
```
