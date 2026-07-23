# HaulPilot

HaulPilot converts an issued oversize/overweight permit into a locked driver
route, monitors the truck's position against that route, warns the driver when
the vehicle leaves the permitted corridor, and stores a basic trip compliance
record.

HaulPilot is **not** responsible for determining whether a route is legally
suitable for a load. The permit authority has already selected the route.

**Current milestone: M0** — repository, application shells, shared package,
Firebase emulator configuration, tests, linting, CI. No product screens yet.

## Repository layout

```
haulpilot/
├── apps/
│   ├── web/                 # @haulpilot/web — Next.js dispatcher app (TypeScript, App Router)
│   │   └── src/app/         # application shell page + layout
│   └── driver/              # @haulpilot/driver — React Native driver app (Android only)
│       ├── android/         # Gradle project (package com.haulpilotdriver)
│       └── App.tsx          # application shell screen
├── packages/
│   └── shared/              # @haulpilot/shared — data models, constants
│       └── src/
│           ├── models.ts    # User, Vehicle, Trip, PermitFile, RouteVersion, …
│           └── constants.ts # roles, trip statuses, corridor defaults
├── firebase.json            # Auth/Firestore/Storage emulator configuration
├── .firebaserc              # default project: demo-haulpilot (emulator-only)
├── firestore.rules          # deny-all until M1
├── storage.rules            # deny-all until M1
├── firestore.indexes.json
├── .github/workflows/ci.yml # lint + typecheck + test + web build
├── pnpm-workspace.yaml
├── .npmrc                   # node-linker=hoisted (React Native compatibility)
└── tsconfig.base.json
```

## Architecture

- **pnpm workspace monorepo.** Three workspaces: the dispatcher web app, the
  driver app, and a shared package. `.npmrc` sets `node-linker=hoisted`
  because Metro and Gradle do not tolerate pnpm's default symlinked
  `node_modules` layout; hoisting mimics npm/yarn classic for the whole repo.
- **`@haulpilot/shared`** is consumed as TypeScript source (no build step):
  Next.js transpiles it via `transpilePackages`, Metro/Jest transform it via
  Babel. It holds the canonical data model and system constants; validation
  schemas, route geometry, and corridor calculations join it in later
  milestones so web and driver use _identical_ corridor math.
- **Firebase** (Auth, Firestore, Storage) is the backend. All local
  development runs against the emulator suite with the `demo-haulpilot`
  project id, which works fully offline and can never touch production.
  Security rules currently deny everything; M1 replaces them with role- and
  organization-scoped rules plus emulator permission tests.
- **Testing**: Vitest in `shared` and `web`, Jest (React Native preset) in
  `driver`. CI runs format check, lint, typecheck, all tests, and a
  production build of the web app. Android Gradle builds are not part of M0
  CI (they need an Android SDK runner and would dominate CI time).

## Local development

Prerequisites: Node ≥ 20 (22 recommended), pnpm ≥ 9, Java 17+ (Firebase
emulators), Android Studio/SDK only if you want to run the driver app.

```sh
pnpm install

# Dispatcher web app → http://localhost:3000
cp apps/web/.env.local.example apps/web/.env.local
pnpm dev:web

# Firebase emulators (Auth 9099, Firestore 8080, Storage 9199, UI 4000)
pnpm emulators

# Driver app (Android device or emulator required)
cp apps/driver/.env.example apps/driver/.env
pnpm dev:driver          # Metro bundler
pnpm android             # build + install the Android app

# Quality gates (each also works per-workspace via pnpm --filter)
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## Environment variables

Templates: `apps/web/.env.local.example`, `apps/driver/.env.example`. No
secrets are committed; real Firebase project values replace the demo values
when a cloud project exists.

| Variable                                   | App    | Purpose                                        |
| ------------------------------------------ | ------ | ---------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | web    | Firebase web app config                        |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | web    | Firebase web app config                        |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | web    | Firebase project id                            |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | web    | Permit PDF storage bucket                      |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | web    | Firebase web app config                        |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | web    | Firebase web app config                        |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`       | web    | Point the app at local emulators               |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL`   | web    | Auth emulator URL                              |
| `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST`      | web    | Firestore emulator host:port                   |
| `NEXT_PUBLIC_STORAGE_EMULATOR_HOST`        | web    | Storage emulator host:port                     |
| `FIREBASE_PROJECT_ID`                      | driver | Firebase project id                            |
| `USE_FIREBASE_EMULATORS`                   | driver | Point the app at local emulators               |
| `FIREBASE_AUTH_EMULATOR_URL`               | driver | Auth emulator (10.0.2.2 from Android emulator) |
| `FIRESTORE_EMULATOR_HOST`                  | driver | Firestore emulator host:port                   |
| `STORAGE_EMULATOR_HOST`                    | driver | Storage emulator host:port                     |

## Milestones

M0 (this) → M1 auth/org data → M2 trip creation → M3 route editor/publishing →
M4 driver offline app → M5 GPS + deviation monitoring → M6 sync + reports →
M7 field pilot hardening. Work stops for review after each milestone.
