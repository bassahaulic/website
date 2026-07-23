# @haulpilot/web

HaulPilot Dispatch — Next.js web app for dispatchers and admins.

M0 status: basic application shell. No product screens yet.

## Commands (run from the repo root)

```sh
pnpm install                 # once, at the repo root
cp apps/web/.env.local.example apps/web/.env.local
pnpm dev:web                 # http://localhost:3000
pnpm --filter @haulpilot/web test
pnpm --filter @haulpilot/web lint
pnpm --filter @haulpilot/web typecheck
pnpm --filter @haulpilot/web build
```
