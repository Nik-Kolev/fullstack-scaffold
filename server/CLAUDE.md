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
                           # ADMIN_PASSWORD isn't policy-checked here — loginUser rejects it later if it doesn't match.

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
- Exception: use try/catch in a controller **or service** to swallow errors for non-critical side effects that must not abort a successful response (e.g., Redis blacklist after logout; `emailQueue.add` calls in `authServices.ts`, which stay in the service since they immediately follow the DB write they're reporting on) — add a comment explaining why.

### Validation

- Validate at the route level via `validateBody(schema)` middleware.
- `validateBody` throws `CustomError(400)` and strips unknown fields via `result.data`.
- `errorHandler` stays Zod-free — errors arrive as `CustomError`.

### File uploads

- `utils/fileValidation.ts` verifies uploaded bytes against the declared mimetype (magic-byte check) and derives the storage extension from the mimetype, not the client-supplied filename — a client-supplied mimetype/extension is trivially spoofable. `assertMatchesDeclaredType`/`extensionForMimeType` are the shared entry points; both `uploadServices.ts` (user files) and `productService.ts` (product images) call them before any R2 write. Any new upload path must reuse these, not reimplement its own content check.

### Linting

- `eslint.config.js` — flat config, mirrors `client/eslint.config.js` (`@eslint/js` + `typescript-eslint` + `globals`), swapped to `globals.node` with no React plugins.
- Params required by a framework signature but unused in the body (Express error middleware's 4th param, a BullMQ job processor's `job` arg) are prefixed `_` and covered by `argsIgnorePattern: '^_'` / `caughtErrorsIgnorePattern: '^_'` on `no-unused-vars` — this is a pre-existing codebase convention, not a lint workaround.
- `**/*.test.ts` has `no-explicit-any` turned off — test mocks casting partial third-party SDK responses (e.g. Stripe) past their full type are expected there; production code stays strict.

### Docker

- `GET /health` (unauthenticated, registered in `app.ts` ahead of `expressConfig` — skips CORS/rate-limiting/helmet entirely) exists specifically for `docker-compose.yml`'s `server` healthcheck. `client`'s `depends_on: server: condition: service_healthy` relies on it — if it's ever removed, that needs to change too, or `client` will fail to start.
- `prisma generate` outputs to `src/generated/prisma` as plain `.js`/`.wasm` files (no `.ts` source) — `tsc` never copies non-`.ts` files into `dist/`, so the Dockerfile explicitly copies `src/generated/prisma` into the runtime image after building. If the generator's `output` path in `prisma/schema/base.prisma` ever changes, that `COPY` line has to change with it.
- `prisma db seed` runs `tsx prisma/seed.ts` against the actual TS source tree (not `dist/`), so the runtime image also keeps a full copy of `src/` for that to resolve — moving or renaming anything under `src/lib/prisma.ts` needs to stay consistent with `seed.ts`'s import.

### CSRF posture — settled, not an open question

No CSRF token library is used, and this is a deliberate decision, not an oversight — confirmed independently twice (Phase 2's security-hardening pass, and the Phase 4 reviewer pass over Phases 1-3 combined). Don't re-litigate this from scratch on a future review; the reasoning:

- Every protected route requires a `Bearer` header (`isAuthenticated.ts`) — never auto-attached cross-site by a browser the way a cookie is. There's no cookie-based ambient authority to exploit in the first place, which is what CSRF actually attacks.
- The cookie that carries authority, `refreshToken`, is set `sameSite=strict` — the browser won't attach it to a cross-site request at all. It is written in exactly one place, `setRefreshCookie()` in `utils/authCookies.ts`, so the flags cannot drift between call sites.
- There is a second cookie, `oauthState`, and it is deliberately `sameSite=lax` (see the OAuth state section below). **This does not weaken the posture:** it carries no authority — it's a nonce that is compared and immediately cleared, and the only route that reads it rejects unless the caller also supplies a matching value it cannot obtain. An attacker causing it to be sent gains nothing.
- CORS (`expressConfig.ts`) is a secondary, complementary layer on top of the above two — it stops a malicious page's JS from _reading_ a response even if a request somehow got through, but it's not the reason CSRF isn't a practical concern here. Don't reach for "add a CSRF token" as the fix if this comes up again — the actual gap, if one is ever found, would be in the Bearer-only/`sameSite` reasoning above, not in CORS.

### Never return a Prisma user object directly — always `toSafeUser`

Prisma has **no global `omit`** configured, so `password` is present on every user object it returns. The only thing keeping it out of responses is `toSafeUser` (`utils/safeUser.ts`), an allowlist that constructs a new object from six named fields.

The rule: **a user object crosses from service to controller only via `toSafeUser`.** Controllers never touch `prisma.user` and never reshape a user themselves. This fails closed — a new column added to the schema is invisible to responses until someone explicitly adds it to `SafeUser`.

Watch relation includes specifically (`include: { user: true }`): they embed the full user, hash included. That's fine for internal use, but the result must never be what gets returned. `resetPassword` does exactly this — reads `user.user.*` internally, returns `toSafeUser(updatedUser)` from the transaction.

`hasPassword` exists as a Prisma result extension for this reason: the client needs to know whether an account has a password set (the OAuth-only case) without the hash ever being in the response shape.

### Cached routes stay role-invariant

Any route behind `redisCache` must return the same body regardless of who asks. `GET /product/:id` therefore filters `isActive: true` for everyone, and admin lookup of deactivated products will be a **separate, uncached, `requireRole`-gated route** — not a branch inside the cached one. Adding role-dependent output to a cached route means the first admin request populates the shared cache and every anonymous visitor is served admin data until the TTL expires. If a cached response ever has to vary, the varying dimension goes in the cache key or the route comes out of the cache.

### OAuth state

`GET /auth/google` mints a random `state`, stores it in the `oauthState` cookie, and `GET /auth/google/callback` rejects any mismatch. Without it an attacker can hand the victim their own `?code=` and silently log the victim into the attacker's account (login CSRF).

**The state cookie is `sameSite: 'lax'`, not `'strict'` like `refreshToken`** — Google's callback is a cross-site top-level navigation, and browsers don't attach a strict cookie to one. Setting it strict makes the cookie absent on every callback, failing OAuth 100% of the time. This is the one deliberate exception to the strict-cookie rule below.

### Access-token revocation

Access tokens are stateless and can't be revoked individually. A password change/reset writes `auth:valid-after:<userId>` to Redis and `isAuth` rejects any token whose `iat` predates it — deleting `RefreshToken` rows alone only stops renewal, leaving already-issued access tokens valid for up to 15 minutes. `iat` is second-granular, so a token minted in the same second as the cutoff survives; that window is inherent to JWT, not a bug.

### Auth tokens

- Access token: short-lived (15 min), returned as JSON body field `accessToken`.
- Refresh token: long-lived (7 d), set as `httpOnly; sameSite=strict; secure` cookie named `refreshToken`.
- `secure` cookie flag is gated on `NODE_ENV === 'production'` — must be set on deploy.
- Refresh tokens are stored in DB (`RefreshToken` table) keyed by `refreshTokenId` (UUID). Rotation: delete old on refresh, insert new.
