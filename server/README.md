# Server

Express + TypeScript REST API with Prisma ORM and PostgreSQL.

## Stack

- **Runtime:** Node.js + TypeScript (ESM, `nodenext`)
- **Framework:** Express 5
- **ORM:** Prisma 7
- **Database:** PostgreSQL (Docker in dev, managed service in prod)
- **Auth:** JWT — access token (15 min) + refresh token (7 d, httpOnly cookie)
- **Cache:** Redis 7 (ioredis) — response caching, BullMQ backend
- **Validation:** Zod v4
- **Hashing:** bcrypt v6
- **Background jobs:** BullMQ — email sending, nightly token cleanup cron
- **Email:** Resend + `react-email` templates
- **Storage:** Cloudflare R2 (S3-compatible)
- **Realtime:** Socket.io

## Prerequisites

- Node.js 20+
- Docker Desktop running

## Getting Started

```bash
# 1. Copy env file and fill in values
cp .env.example .env

# 2. Start dev server (auto-starts DB container)
npm run dev
```

## Environment Variables

| Variable               | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `PORT`                 | Port the server listens on                      |
| `ORIGIN`               | Allowed CORS origin (frontend URL)              |
| `DATABASE_URL`         | PostgreSQL connection string                    |
| `JWT_ACCESS_SECRET`    | Secret used to sign access tokens (15 min)      |
| `JWT_REFRESH_SECRET`   | Secret used to sign refresh tokens (7 d)        |
| `NODE_ENV`             | Set to `production` on deploy (gates secure cookie) |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                              |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                        |
| `GOOGLE_REDIRECT_URI`  | Must match authorized redirect URI in Google Cloud Console |
| `REDIS_URL`            | Redis connection string (`redis://localhost:6379` in dev) |
| `RESEND_API_KEY`       | Resend API key                                  |
| `RESEND_FROM`          | Verified sender address (e.g. `onboarding@resend.dev` in dev) |
| `RESEND_REPLY_TO`      | Address replies land in (e.g. your Gmail)       |
| `R2_ACCOUNT_ID`        | Cloudflare account ID                           |
| `R2_ACCESS_KEY_ID`     | R2 access key ID                                |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key                            |
| `R2_BUCKET_NAME`       | R2 bucket name                                  |
| `R2_PUBLIC_URL`        | Public base URL for the bucket (e.g. `https://pub-xxx.r2.dev`) |
| `R2_ENDPOINT`          | R2 S3 API endpoint (EU: `https://<accountid>.eu.r2.cloudflarestorage.com`) |

`DATABASE_URL` format: `postgresql://USER:PASSWORD@localhost:5432/DBNAME`

The credentials must match the values in the root `.env` used by Docker Compose.

## Project Structure

```
src/
  app.ts            App factory — middleware, routes, error handler (no listen)
  index.ts          Entry point — imports app, creates http.Server, calls initSocket(server)
  worker.ts         Worker process entry point — DB connect + graceful shutdown for BullMQ workers
  config/           Express middleware setup (cors, json, cookieParser, rate limiter)
  routes/           Route definitions — maps URLs to controllers
  controllers/      Thin handlers — call service, set cookie, send response
  services/         All DB and business logic
  middleware/       errorHandler, validateBody, isAuthenticated, requireRole, rateLimiter, redisCache, upload
  schemas/          Zod schemas — one file per domain
  types/            TypeScript augmentations (env.d.ts, express.d.ts)
  lib/              Third-party singletons — prisma.ts, jwt.ts, redis.ts, bullmq.ts, googleOAuth.ts, resend.ts, r2.ts
  lib/socket/       Socket.io setup — socket.ts (initSocket + io singleton), room.ts (room rules), handlers.ts (handler registry), events/ (feature handlers)
  emails/           react-email templates (welcome, passwordReset, passwordChanged), rendered by workers
  workers/          BullMQ worker definitions — email.worker.ts, tokenCleanup.worker.ts; index.ts barrel-exports all
  generated/        Auto-generated Prisma client — do not edit
  __tests__/        Integration tests

prisma/
  schema/           Prisma schema files (one per domain)
    base.prisma     Generator config
    user.prisma     User model
    refreshToken.prisma  RefreshToken model
  migrations/       Auto-generated SQL migration history — commit these
  seed.ts           Seed script — upserts dev/test users
```

## API Endpoints

| Method & Path                  | Auth     | Description                                  |
| ------------------------------ | -------- | --------------------------------------------- |
| `POST /auth/register`          | —        | Create account, send welcome email            |
| `POST /auth/login`             | —        | Issue access + refresh tokens                  |
| `POST /auth/logout`             | —        | Revoke refresh token, clear cookie             |
| `POST /auth/refresh`            | cookie   | Rotate refresh token, issue new access token   |
| `GET /auth/google`              | —        | Start Google OAuth flow                        |
| `GET /auth/google/callback`     | —        | Google OAuth callback, upsert by `googleId`    |
| `POST /auth/change-password`    | required | Change password; invalidates other sessions    |
| `POST /auth/forgot-password`    | —        | Always 200; emails a reset link if user exists |
| `POST /auth/reset-password`     | —        | Reset password via emailed token               |
| `GET /user/:id`                 | —        | Fetch a user by ID                              |
| `POST /upload`                  | required | Upload up to 10 files to a folder               |
| `DELETE /upload/:key`           | required | Delete a file (`key` must be URL-encoded)       |
| `GET /upload/folder/:name`      | required | List all files in a named folder                |
| `GET /upload/folders`           | required | List all distinct folder names for the user     |

## Realtime (Socket.io)

Every authenticated socket connection is auto-joined to a personal room (`user:${userId}`). To push a server-initiated event from any service, import the `io` singleton from `lib/socket/socket.ts`:

```ts
io.to(`user:${userId}`).emit('event-name', payload);
```

- Add role/feature rooms by adding entries to `lib/socket/room.ts`.
- Add client-driven event handlers (client emits, server reacts) in `lib/socket/events/`, then import the file in the barrel `lib/socket/index.ts`.

## Background Jobs (BullMQ)

Workers run in a separate process from the HTTP server:

```bash
npm run worker
```

- `email.worker.ts` — sends welcome / password-reset / password-changed emails via Resend, rendering templates from `emails/` with `@react-email/render`.
- `tokenCleanup.worker.ts` — nightly cron (`0 3 * * *`) that deletes expired refresh tokens and password reset tokens.

Any test that exercises a service which enqueues a job needs `vi.mock('../lib/bullmq.js', ...)`.

## Commands

### Dev

| Command            | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `npm run dev`      | Start HTTP server with hot reload (auto-starts DB)     |
| `npm run worker`   | Start BullMQ worker process with hot reload            |

### Docker

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `npm run docker:up`   | Start PostgreSQL container      |
| `npm run docker:stop` | Stop container (data preserved) |

### Database

| Command                               | Description                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| `npm run db:migrate -- --name <name>` | Create and apply a new migration (dev DB), then deploy it to the test DB |
| `npm run db:reset`                    | Drop DB and re-apply all existing migrations (dev DB only)      |
| `npm run db:fresh`                    | Wipe migration history + reset DB + create clean init migration (dev **and** test DB) |
| `npm run db:studio`                   | Open Prisma Studio (browser DB viewer)                          |
| `npm run db:seed`                     | Seed the database with dev users (idempotent)                   |

> Both `db:migrate` and `db:fresh` keep the `scaffold_test` DB in sync automatically — there's no separate test-DB command to run.

### Testing

| Command              | Description                  |
| -------------------- | ---------------------------- |
| `npm run test`       | Run all tests                |
| `npm run test:watch` | Run tests in watch mode      |

### Code

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run format`  | Format all TypeScript files        |

## Seed Data

Run `npm run db:seed` to populate the database with three default users:

| Email                 | Password | Role    |
| --------------------- | -------- | ------- |
| `test@abv.bg`         | `1234`   | `user`  |
| `admin@abv.bg`        | `1234`   | `admin` |
| `ngkolev93@gmail.com` | `1234`   | `admin` |

The seed is idempotent — safe to run multiple times.

> `ngkolev93@gmail.com` is a personal test account — remove it from `seed.ts` (and this table) before sharing the repo or deploying anywhere publicly reachable.

## Testing

Tests use **Vitest** (test runner) and **Supertest** (HTTP assertions against the real Express app).

Integration tests hit a real database. Set up the test database once before running tests:

```bash
# 1. Create a separate test DB in Postgres (e.g. scaffold_test)
# 2. Copy .env and point DATABASE_URL at the test DB
cp .env .env.test

# 3. Apply migrations to the test DB once
dotenv -e .env.test -- prisma migrate deploy

# 4. Run tests
npm run test
```

Tests clear relevant tables and Redis state in `beforeEach` — no manual cleanup needed between runs. `vitest.config.ts` sets `fileParallelism: false`: `auth.test.ts` and `upload.test.ts` both do blanket cleanup in `beforeEach`, and running test files in parallel lets one wipe the other's in-flight data.

> After that initial setup, `npm run db:migrate` and `npm run db:fresh` both keep the test DB in sync automatically.

## Adding a New Model

1. Create `prisma/schema/<domain>.prisma`
2. Define your model
3. Run `npm run db:migrate -- --name <describe_the_change>`

## Resetting the Database (clean slate)

Use during early development when you want one clean migration instead of a chain of small ones:

```bash
npm run db:fresh
```

This deletes all migration files, drops the database, and creates a single fresh `init` migration from the current schema.

> Only use this before others are using the project. After that, always use `db:migrate`.

## Deployment Notes

- Set `NODE_ENV=production` in your hosting environment
- This gates the `secure` flag on the refresh token cookie — required for HTTPS
- Replace `DATABASE_URL` with your managed database connection string
- `docker-compose.yml` is for local dev only — do not use it in production
