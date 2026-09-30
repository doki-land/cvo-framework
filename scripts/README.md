# scripts/

Root automation for npm placeholder stubs and Trusted Publisher setup.

## Layout

```text
scripts/
  ci/
    publish-npm.mjs         Real release (OIDC via publish-npm.yml)
```

## npm placeholder (0.0.0)

Reserve package names before Trusted Publisher real releases (`@doki-land/nifty`):

```bash
pnpm placeholder          # nifty publish --placeholder --dry-run
pnpm placeholder:publish  # publish missing packages @0.0.0
pnpm placeholder:trust    # configure Trusted Publisher (needs NPM_TOTP_SECRET in .env.placeholder.local)
```

Package set: non-`private` workspace packages (`package.json`). Local secrets (gitignored): `.env.placeholder.local`.

Real versions: push tag `vX.Y.Z` or `workflow_dispatch` on `publish-npm.yml` (environment `NPM_PUBLISH`).
