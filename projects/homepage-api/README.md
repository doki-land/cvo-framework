# `@cvo/homepage-api`

CVO **Worker host** for the homepage VMZ `ServerArtifact`.

Does **not** define `/api/*` by hand. It:

1. Loads `generated/server-artifact.json` (from `vmz build --profile edge`)
2. Bundles compiled `#server` modules
3. Runs `createServerArtifactModuleHandlers` + `createServerArtifactFetchService`

```bash
pnpm home:server          # from repo root
pnpm --filter @cvo/homepage-api dry-run
pnpm --filter @cvo/homepage-api deploy
```
