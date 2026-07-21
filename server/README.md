# Server

Express + TypeScript REST API with Prisma ORM and PostgreSQL.

## Stack

- **Runtime:** Node.js + TypeScript (ESM, `nodenext`)
- **Framework:** Express 5
- **ORM:** Prisma 7
- **Database:** PostgreSQL (Docker in dev, managed service in prod)
- **Auth:** JWT — access token (15 min) + refresh token (7 d, httpOnly cookie)
- **Cache:** Redis 7 (ioredis) — rate limiting, auth token revocation, BullMQ backend
- **Validation:** Zod v4
- **Hashing:** bcrypt v6
- **Background jobs:** BullMQ — email sending, nightly token cleanup cron
- **Email:** Resend + `react-email` templates
- **Security headers:** Helmet (CSP, HSTS, X-Frame-Options, etc.)

## Prerequisites

- Node.js 20+
- Docker Desktop running

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in values
cp .env.example .env

# 3. First-time database setup (wipes + remigrates + seeds)
npm run db:fresh

# 4. Start dev server (auto-starts DB + Redis containers)
npm run dev

# Optional: start server + BullMQ worker together
npm run dev:all
```

## Environment Variables

### Core

| Variable             | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `PORT`               | Port the server listens on                                     |
| `ORIGIN`             | Allowed CORS origin (frontend URL)                             |
| `DATABASE_URL`       | PostgreSQL connection string — format below                    |
| `JWT_ACCESS_SECRET`  | Secret for signing access tokens (15 min) — any random string  |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (7 d) — any random string    |
| `NODE_ENV`           | Set to `production` on deploy — gates the `secure` cookie flag |
| `REDIS_URL`          | Redis connection string (`redis://localhost:6379` in dev)      |

`DATABASE_URL` format: `postgresql://USER:PASSWORD@localhost:5432/DBNAME`
Must match the credentials in the root `docker-compose.yml`.

### Google OAuth

> Get credentials at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID.
> Add `GOOGLE_REDIRECT_URI` to the **Authorized redirect URIs** list in that same screen.

| Variable               | Description                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth client ID                                                                                      |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret                                                                                  |
| `GOOGLE_REDIRECT_URI`  | Must match an authorized redirect URI in GCP — e.g. `http://localhost:8080/api/auth/google/callback` |

### Resend (email)

> Get your API key at [resend.com](https://resend.com) → API Keys.
> In dev you can use `onboarding@resend.dev` as `RESEND_FROM` without verifying a domain.

| Variable          | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `RESEND_API_KEY`  | Resend API key                                        |
| `RESEND_FROM`     | Sender address (e.g. `onboarding@resend.dev` in dev)  |
| `RESEND_REPLY_TO` | Address where user replies land (e.g. your own inbox) |

## Project Structure

```
src/
  app.ts            App factory — middleware, routes, error handler (no listen)
  index.ts          Entry point — imports app, calls app.listen
  worker.ts         Worker process entry point — DB connect + graceful shutdown for BullMQ workers
  config/           Express middleware setup (helmet, cors, json, cookieParser, rate limiter)
  routes/           Route definitions — maps URLs to controllers
  controllers/      Thin handlers — call service, set cookie, send response
  services/         All DB and business logic
  middleware/       errorHandler, validateBody, isAuthenticated, requireRole, rateLimiter
  schemas/          Zod schemas — one file per domain (auth, user)
  types/            TypeScript augmentations (env.d.ts, express.d.ts)
  lib/              Third-party singletons — prisma, jwt, redis, bullmq, googleOAuth, resend
  emails/           react-email templates (welcome, passwordReset, passwordChanged)
  workers/          BullMQ worker definitions — email.worker.ts, tokenCleanup.worker.ts
  __tests__/        Integration tests

prisma/
  schema/           Prisma schema files (one per domain)
  migrations/       Auto-generated SQL migration history — commit these
  seed.ts           Seed script — upserts dev/test users
```

## API Endpoints

| Method & Path                | Auth     | Description                                    |
| ---------------------------- | -------- | ---------------------------------------------- |
| `POST /auth/register`        | —        | Create account, send welcome email             |
| `POST /auth/login`           | —        | Issue access + refresh tokens                  |
| `POST /auth/logout`          | —        | Revoke refresh token, clear cookie             |
| `POST /auth/refresh`         | cookie   | Rotate refresh token, issue new access token   |
| `GET /auth/google`           | —        | Start Google OAuth flow                        |
| `GET /auth/google/callback`  | —        | Google OAuth callback, upsert by `googleId`    |
| `POST /auth/change-password` | required | Change password; invalidates other sessions    |
| `POST /auth/forgot-password` | —        | Always 200; emails a reset link if user exists |
| `POST /auth/reset-password`  | —        | Reset password via emailed token               |
| `GET /user/me`               | required | Fetch the authenticated user's profile         |
| `PATCH /user/me`             | required | Update own name or email                       |
| `GET /user/:id`              | —        | Fetch a user by ID                             |

## Frontend Integration Notes

Key contracts to know when writing frontend service calls:

### Errors

Every error response is `{ statusCode, code, details }` — no `message` field. `code` is the stable, machine-readable value to dispatch UI copy off (never display raw server text — see `zod.md`'s client rules). `details` is only ever populated for `VALIDATION_ERROR` (a `[{ field, message }]` array); every other code sends `details: undefined` since the code alone already implies which field/flow is affected.

Named codes in use so far:

| Code                                                                      | Where                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `VALIDATION_ERROR`                                                        | any Zod shape mismatch, all routes                                      |
| `INVALID_CREDENTIALS`                                                     | login                                                                   |
| `EMAIL_TAKEN`                                                             | register                                                                |
| `INVALID_RESET_TOKEN`                                                     | reset-password                                                          |
| `NO_TOKEN` / `INVALID_TOKEN` / `TOKEN_EXPIRED` / `TOKEN_REVOKED`          | `isAuth` — missing, malformed, expired, or cut off by a password change |
| `FORBIDDEN`                                                               | `requireRole`                                                           |
| `RATE_LIMITED`                                                            | any limiter                                                             |
| `NO_REFRESH_TOKEN` / `INVALID_REFRESH_TOKEN` / `SESSION_INVALID`          | `POST /auth/refresh`                                                    |
| `CURRENT_PASSWORD_REQUIRED` / `INVALID_CURRENT_PASSWORD`                  | change-password                                                         |
| `OAUTH_STATE_MISMATCH` / `INVALID_OAUTH_CODE` / `GOOGLE_EMAIL_UNVERIFIED` | Google OAuth                                                            |

`TOKEN_REVOKED` covers both a blacklisted `jti` and a token issued before the user's `auth:valid-after` cutoff — the client treats both as "log in again".

### Auth

- `GET /user/me` → `{ user }` — includes `hasPassword: boolean` (computed). Use this, not `googleId`, to decide whether to show the current-password field on the change-password form. A Google user who has since set a password will have both `googleId` set and `hasPassword: true`.
- `POST /auth/change-password` → `{ user, accessToken, message }` — replace the stored access token and cached user object on success. All other sessions are invalidated server-side.
- `POST /auth/reset-password` → `{ user, accessToken }` — user is logged in immediately after reset.

## Background Jobs (BullMQ)

Workers run in a separate process from the HTTP server. Start them alongside the dev server with:

```bash
npm run dev:all   # server + worker in one terminal (colour-coded output)
```

Or in separate terminals:

```bash
npm run dev       # HTTP server
npm run worker    # BullMQ worker
```

- `email.worker.ts` — sends welcome / password-reset / password-changed emails via Resend.
- `tokenCleanup.worker.ts` — nightly cron (`0 3 * * *`) that deletes expired refresh and password reset tokens.

Any test that exercises a service which enqueues a job needs `vi.mock('../lib/bullmq.js', ...)`.

## Commands

### Dev

| Command           | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Start HTTP server with hot reload (auto-starts Docker) |
| `npm run worker`  | Start BullMQ worker process with hot reload            |
| `npm run dev:all` | Start HTTP server + worker together (colour-coded)     |

### Docker

| Command               | Description                         |
| --------------------- | ----------------------------------- |
| `npm run docker:up`   | Start PostgreSQL + Redis containers |
| `npm run docker:stop` | Stop containers (data preserved)    |

### Database

| Command                               | Description                                                           |
| ------------------------------------- | --------------------------------------------------------------------- |
| `npm run db:migrate -- --name <name>` | Create and apply a new migration (dev DB), then deploy to the test DB |
| `npm run db:reset`                    | Drop and re-apply all existing migrations (dev DB only)               |
| `npm run db:fresh`                    | Wipe migration history, reset dev + test DBs, then seed               |
| `npm run db:seed`                     | Seed the database with dev users (idempotent)                         |
| `npm run db:studio`                   | Open Prisma Studio (browser DB viewer)                                |

> `db:migrate` and `db:fresh` both keep the `scaffold_test` DB in sync automatically.

### Testing

| Command              | Description             |
| -------------------- | ----------------------- |
| `npm run test`       | Run all tests           |
| `npm run test:watch` | Run tests in watch mode |

### Code

| Command          | Description                 |
| ---------------- | --------------------------- |
| `npm run format` | Format all TypeScript files |

## Seed Data

Run `npm run db:seed` (or it runs automatically after `db:fresh`) to populate the database:

| Email          | Password   | Role    |
| -------------- | ---------- | ------- |
| `test@abv.bg`  | `password` | `user`  |
| `admin@abv.bg` | `password` | `admin` |

The seed is idempotent — safe to run multiple times.

> Add your own admin user to `prisma/seed.ts` before running in a new environment.

## Testing

Tests use **Vitest** and **Supertest** against the real Express app and a dedicated test database.

```bash
# 1. Create a test DB in Postgres (e.g. scaffold_test)
# 2. Copy .env and point DATABASE_URL at the test DB
cp .env .env.test

# 3. Apply migrations to the test DB
dotenv -e .env.test -- prisma migrate deploy

# 4. Run tests
npm run test
```

Tests clear relevant tables in `beforeEach` — no manual cleanup needed. `vitest.config.ts` sets `fileParallelism: false` to prevent test files that do blanket cleanup from wiping each other's in-flight data.

> After initial setup, `db:migrate` and `db:fresh` keep the test DB in sync automatically.

## Adding a New Model

1. Create `prisma/schema/<domain>.prisma`
2. Define your model
3. Run `npm run db:migrate -- --name <describe_the_change>`

## Resetting the Database

Use during early development when you want one clean migration instead of a chain of small ones:

```bash
npm run db:fresh
```

Wipes migration history, drops and recreates both the dev and test DBs, creates a single fresh `init` migration, then seeds. Only use this before others are working on the project — after that always use `db:migrate`.

## Deployment Notes

- Set `NODE_ENV=production` — gates the `secure` flag on the refresh token cookie (required for HTTPS) and the CSP `upgrade-insecure-requests` directive (force-redirects `http://` → `https://`, which breaks local dev)
- Replace `DATABASE_URL` with your managed database connection string
- `docker-compose.yml` is for local dev only — do not use in production
