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

`DATABASE_URL` format: `postgresql://USER:PASSWORD@localhost:5432/DBNAME`

The credentials must match the values in the root `.env` used by Docker Compose.

## Project Structure

```
src/
  app.ts            App factory — middleware, routes, error handler (no listen)
  index.ts          Entry point — imports app, calls app.listen()
  config/           Express middleware setup (cors, json, cookieParser, rate limiter)
  routes/           Route definitions — maps URLs to controllers
  controllers/      Thin handlers — call service, set cookie, send response
  services/         All DB and business logic
  middleware/       errorHandler, validateBody, isAuthenticated, requireRole, rateLimiter, redisCache
  schemas/          Zod schemas — one file per domain
  types/            TypeScript augmentations (env.d.ts, express.d.ts)
  lib/              Third-party singletons (prisma.ts, jwt.ts, redis.ts)
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

## Commands

### Dev

| Command       | Description                                       |
| ------------- | ------------------------------------------------- |
| `npm run dev` | Start dev server with hot reload (auto-starts DB) |

### Docker

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `npm run docker:up`   | Start PostgreSQL container      |
| `npm run docker:stop` | Stop container (data preserved) |

### Database

| Command                               | Description                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| `npm run db:migrate -- --name <name>` | Create and apply a new migration                                |
| `npm run db:reset`                    | Drop DB and re-apply all existing migrations                    |
| `npm run db:fresh`                    | Wipe migration history + reset DB + create clean init migration |
| `npm run db:studio`                   | Open Prisma Studio (browser DB viewer)                          |
| `npm run db:seed`                     | Seed the database with dev users (idempotent)                   |
| `npm run db:migrate:test`             | Run migrations against the test database                        |

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

Run `npm run db:seed` to populate the database with two default users:

| Email             | Password | Role    |
| ----------------- | -------- | ------- |
| `test@abv.bg`     | `1234`   | `user`  |
| `admin@abv.bg`    | `1234`   | `admin` |

The seed is idempotent — safe to run multiple times.

## Testing

Tests use **Vitest** (test runner) and **Supertest** (HTTP assertions against the real Express app).

Integration tests hit a real database. Set up the test database once before running tests:

```bash
# 1. Create a separate test DB in Postgres (e.g. scaffold_test)
# 2. Copy .env and point DATABASE_URL at the test DB
cp .env .env.test

# 3. Apply migrations to the test DB
npm run db:migrate:test

# 4. Run tests
npm run test
```

Tests clear relevant tables in `beforeEach` — no manual cleanup needed between runs.

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
