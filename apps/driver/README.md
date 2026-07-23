# @haulpilot/driver

HaulPilot Driver — React Native (Android-only) tablet app for drivers.

M0 status: basic application shell. No product screens yet.

## Commands (run from the repo root)

```sh
pnpm install                 # once, at the repo root
pnpm dev:driver              # start Metro
pnpm android                 # build + install on a connected device/emulator
pnpm --filter @haulpilot/driver test
pnpm --filter @haulpilot/driver lint
pnpm --filter @haulpilot/driver typecheck
```

Android builds require a local Android SDK; set `ANDROID_HOME` or create
`android/local.properties` with `sdk.dir=...`.

iOS is intentionally not supported (out of MVP scope); the `ios/` directory
was removed from the template.
