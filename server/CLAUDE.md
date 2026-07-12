# Server — Conventions & Commands

See root `CLAUDE.md` for stack, project structure, and env vars.

---

## Dev Commands (run from `server/`)

```bash
# Dev
npm run dev               # starts Docker (predev), then nodemon + tsx
npm run worker            # BullMQ worker process (separate terminal)
npm run dev:all           # server + worker together, colour-coded output

# Docker
npm run docker:up         # start Postgres + Redis containers
npm run docker:stop       # stop containers
npm run build              # tsc -> dist/ (used by the Dockerfile; not needed for local tsx-based dev)
npm run start               # node dist/index.js
npm run start:worker        # node dist/worker.js

# Database
npm run db:migrate        # prisma migrate dev (dev) + deploy to test DB
npm run db:reset          # prisma migrate reset — wipe + re-apply dev DB only
npm run db:fresh          # wipe migrations + reset dev AND test DB + seed
npm run db:seed           # prisma db seed (runs prisma/seed.ts)
npm run db:studio         # Prisma Studio
npm run create-admin      # ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run create-admin
                           # upserts a role:admin user — safe to run in production (unlike db:fresh/db:seed's
                           # known test credentials). Values must be env vars, never CLI args (shell history).

# Tests
npm run test              # vitest run (single pass)
npm run test:watch        # vitest (watch mode)

# Code
npm run lint              # eslint .
npm run format            # prettier --write src/**/*.ts
```

---

## Conventions

### Imports

- Always `.js` extension on local imports (ESM + nodenext resolution).
- Named exports preferred; default export only for singleton instances (prisma, router).

### Error handling

- **No try/catch in controllers or services.** Express 5 auto-catches async errors. (Express 4 does not — every async handler would need explicit try/catch or `express-async-errors`.)
- Throw `CustomError(statusCode, message, details?)` for operational errors.
- `errorHandler` middleware maps: CustomError → its fields, Prisma known errors → PRISMA_ERROR_MAP, PrismaClientValidationError → 400, generic Error → 500.
- Only add try/catch in a service when you need to produce a more specific message than the default Prisma mapping provides.
- Exception: use try/catch in a controller when you need a side-effect before rethrowing (e.g., `clearCookie` on failed refresh) — always rethrow so `errorHandler` still processes it.
- Exception: use try/catch in a controller to swallow errors for non-critical side effects that must not abort a successful response (e.g., Redis blacklist after password change) — add a comment explaining why.

### Validation

- Validate at the route level via `validateBody(schema)` middleware.
- `validateBody` throws `CustomError(400)` and strips unknown fields via `result.data`.
- `errorHandler` stays Zod-free — errors arrive as `CustomError`.

### Linting

- `eslint.config.js` — flat config, mirrors `client/eslint.config.js` (`@eslint/js` + `typescript-eslint` + `globals`), swapped to `globals.node` with no React plugins.
- Params required by a framework signature but unused in the body (Express error middleware's 4th param, a BullMQ job processor's `job` arg) are prefixed `_` and covered by `argsIgnorePattern: '^_'` / `caughtErrorsIgnorePattern: '^_'` on `no-unused-vars` — this is a pre-existing codebase convention, not a lint workaround.
- `**/*.test.ts` has `no-explicit-any` turned off — test mocks casting partial third-party SDK responses (e.g. Stripe) past their full type are expected there; production code stays strict.

### Docker

- `prisma generate` outputs to `src/generated/prisma` as plain `.js`/`.wasm` files (no `.ts` source) — `tsc` never copies non-`.ts` files into `dist/`, so the Dockerfile explicitly copies `src/generated/prisma` into the runtime image after building. If the generator's `output` path in `prisma/schema/base.prisma` ever changes, that `COPY` line has to change with it.
- `prisma db seed` runs `tsx prisma/seed.ts` against the actual TS source tree (not `dist/`), so the runtime image also keeps a full copy of `src/` for that to resolve — moving or renaming anything under `src/lib/prisma.ts` needs to stay consistent with `seed.ts`'s import.

### Auth tokens

- Access token: short-lived (15 min), returned as JSON body field `accessToken`.
- Refresh token: long-lived (7 d), set as `httpOnly; sameSite=strict; secure` cookie named `refreshToken`.
- `secure` cookie flag is gated on `NODE_ENV === 'production'` — must be set on deploy.
- Refresh tokens are stored in DB (`RefreshToken` table) keyed by `refreshTokenId` (UUID). Rotation: delete old on refresh, insert new.
