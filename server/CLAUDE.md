# Server — Conventions & Commands

See root `CLAUDE.md` for stack, project structure, and env vars.

---

## Dev Commands (run from `server/`)

```bash
# Dev
npm run dev               # starts Docker (predev), then nodemon + tsx

# Docker
npm run docker:up         # start Postgres container only
npm run docker:stop       # stop containers

# Database
npm run db:migrate        # prisma migrate dev (dev) + deploy to test DB
npm run db:reset          # prisma migrate reset — wipe + re-apply dev DB only
npm run db:fresh          # wipe migrations + full reset for dev AND test DB
npm run db:seed           # prisma db seed (runs prisma/seed.ts)
npm run db:studio         # Prisma Studio

# Tests
npm run test              # vitest run (single pass)
npm run test:watch        # vitest (watch mode)

# Code
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

### Auth tokens
- Access token: short-lived (15 min), returned as JSON body field `accessToken`.
- Refresh token: long-lived (7 d), set as `httpOnly; sameSite=strict; secure` cookie named `refreshToken`.
- `secure` cookie flag is gated on `NODE_ENV === 'production'` — must be set on deploy.
- Refresh tokens are stored in DB (`RefreshToken` table) keyed by `refreshTokenId` (UUID). Rotation: delete old on refresh, insert new.
