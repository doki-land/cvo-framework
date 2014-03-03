CVO Framework
=============

**One service. Many transports. Explicit boundaries.**

CVO is the application backend platform for **VOS / Iris / VMZ**: define a service capability once, reuse it over HTTP, RPC, jobs, and edge or Node hosts — with platform differences expressed through capabilities and deployment profiles.

**Not** a general Hono replacement. See `@cvo/skills` → `references/positioning.md`.

## Layout

```text
projects/
  runtimes/
    cvo-core/      @cvo/core
    cvo-server/    @cvo/server
    cvo-tools/     @cvo/cvo
  plugins/
    cvo-plugin/              @cvo/plugin
    cvo-plugin-i18n/         @cvo/plugin-i18n
    cvo-plugin-i18n-fluent/  @cvo/plugin-i18n-fluent
    cvo-plugin-auth/         @cvo/plugin-auth
    cvo-plugin-config/       @cvo/plugin-config
    cvo-plugin-logger/       @cvo/plugin-logger
    cvo-plugin-notification/ @cvo/plugin-notification
    cvo-plugin-openapi/      @cvo/plugin-openapi
    cvo-plugin-security/     @cvo/plugin-security
    cvo-plugin-socket/       @cvo/plugin-socket
    cvo-plugin-sse/          @cvo/plugin-sse
    cvo-plugin-storage/      @cvo/plugin-storage
    cvo-plugin-task/         @cvo/plugin-task
    cvo-plugin-validation/   @cvo/plugin-validation
    cvo-plugin-iris/         @cvo/plugin-iris
    cvo-plugin-prisma/       @cvo/plugin-prisma
    cvo-plugin-drizzle/      @cvo/plugin-drizzle
  examples/
  cvo-skills/      @cvo/skills    — Agent Skills user package
  homepage/        @cvo/homepage  — VMZ site + Worker + Cloudflare
```

与 VMZ 同构：`runtimes/` 放可发布/可链接的运行时包；`examples/` 放示例应用；`homepage` 与 skills 为独立 project。

## Scripts

```shell
pnpm install
pnpm build:runtimes
pnpm typecheck
pnpm lint
pnpm conformance:preview
pnpm cvo validate --all
pnpm fmt:check
pnpm cvo catalog
pnpm homepage:dev
pnpm homepage:worker
```
