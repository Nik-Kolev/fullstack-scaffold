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
- **Payments:** Stripe (one-time Checkout sessions)
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

### Cloudflare R2 (file storage)

> Create a bucket at [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → Create bucket.  
> Enable **Public Access** on the bucket to get a `R2_PUBLIC_URL`.  
> Generate R2 API keys under R2 → Manage R2 API Tokens.

| Variable               | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare account ID (from the R2 overview page)                          |
| `R2_ACCESS_KEY_ID`     | R2 API token access key ID                                                 |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret access key                                             |
| `R2_BUCKET_NAME`       | Bucket name                                                                |
| `R2_PUBLIC_URL`        | Public base URL for the bucket (e.g. `https://pub-xxx.r2.dev`)             |
| `R2_ENDPOINT`          | R2 S3 API endpoint — EU: `https://<accountid>.eu.r2.cloudflarestorage.com` |

### Stripe (payments)

> Get keys at [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys.  
> Get the webhook secret at Developers → Webhooks → your endpoint → Signing secret.  
> In dev, use the Stripe CLI: `stripe listen --forward-to localhost:8080/api/payment/webhook`.

| Variable                | Description                       |
| ----------------------- | --------------------------------- |
| `STRIPE_SECRET_KEY`     | Secret key (`sk_test_...` in dev) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret            |

## Project Structure

```
src/
  app.ts            App factory — middleware, routes, error handler (no listen)
  index.ts          Entry point — imports app, creates http.Server, calls initSocket(server)
  worker.ts         Worker process entry point — DB connect + graceful shutdown for BullMQ workers
  config/           Express middleware setup (helmet, cors, json, cookieParser, rate limiter)
  routes/           Route definitions — maps URLs to controllers
  controllers/      Thin handlers — call service, set cookie, send response
  services/         All DB and business logic
  middleware/       errorHandler, validateBody, isAuthenticated, requireRole, rateLimiter, redisCache, upload
  schemas/          Zod schemas — one file per domain (auth, upload, payment, product, user)
  types/            TypeScript augmentations (env.d.ts, express.d.ts)
  lib/              Third-party singletons — prisma, jwt, redis, bullmq, googleOAuth, resend, r2, stripe
  lib/socket/       Socket.io setup — socket.ts, room.ts, handlers.ts, events/
  emails/           react-email templates (welcome, passwordReset, passwordChanged)
  workers/          BullMQ worker definitions — email.worker.ts, tokenCleanup.worker.ts
  __tests__/        Integration tests

prisma/
  schema/           Prisma schema files (one per domain)
  migrations/       Auto-generated SQL migration history — commit these
  seed.ts           Seed script — upserts dev/test users + seeds default products
```

## API Endpoints

| Method & Path                | Auth     | Description                                                                                                                                      |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/register`        | —        | Create account, send welcome email                                                                                                               |
| `POST /auth/login`           | —        | Issue access + refresh tokens                                                                                                                    |
| `POST /auth/logout`          | —        | Revoke refresh token, clear cookie                                                                                                               |
| `POST /auth/refresh`         | cookie   | Rotate refresh token, issue new access token                                                                                                     |
| `GET /auth/google`           | —        | Start Google OAuth flow                                                                                                                          |
| `GET /auth/google/callback`  | —        | Google OAuth callback, upsert by `googleId`                                                                                                      |
| `POST /auth/change-password` | required | Change password; invalidates other sessions                                                                                                      |
| `POST /auth/forgot-password` | —        | Always 200; emails a reset link if user exists                                                                                                   |
| `POST /auth/reset-password`  | —        | Reset password via emailed token                                                                                                                 |
| `GET /user/me`               | required | Fetch the authenticated user's profile                                                                                                           |
| `PATCH /user/me`             | required | Update own name or email                                                                                                                         |
| `GET /user/:id`              | —        | Fetch a user by ID                                                                                                                               |
| `POST /upload`               | required | Upload up to 10 files to a folder                                                                                                                |
| `DELETE /upload/:key`        | required | Delete a file (`key` must be URL-encoded)                                                                                                        |
| `GET /upload/folder/:name`   | required | List all files in a named folder                                                                                                                 |
| `GET /upload/folders`        | required | List all distinct folder names for the user                                                                                                      |
| `POST /payment/checkout`     | required | Create Stripe Checkout session; body `{ productId, quantity }`, returns `{ url }`                                                                |
| `POST /payment/webhook`      | —        | Stripe webhook — updates payment status on checkout/charge events                                                                                |
| `GET /product`               | —        | List active products — cursor pagination, see Products below                                                                                     |
| `GET /product/:id`           | —        | Get a single product by ID (includes inactive)                                                                                                   |
| `POST /product`              | admin    | Create a product; multipart `{ name, price, categoryId, color, shape, description?, quantity?, discountPercent?, imageUrl? }` + optional `image` |
| `PUT /product/:id`           | admin    | Update a product (partial — at least one field required)                                                                                         |
| `DELETE /product/:id`        | admin    | Soft-delete a product (`isActive = false`), deletes R2 image                                                                                     |
| `POST /product/:id/image`    | admin    | Replace product image; deletes old R2 object first                                                                                               |
| `DELETE /product/:id/image`  | admin    | Remove product image without deactivating                                                                                                        |
| `POST /product/:id/like`     | required | Like a product (any logged-in user); 409 `ALREADY_LIKED` on duplicate                                                                            |
| `DELETE /product/:id/like`   | required | Remove your like from a product                                                                                                                  |
| `GET /category`              | —        | List all product categories, sorted by name                                                                                                      |

## Frontend Integration Notes

Key contracts to know when writing frontend service calls:

### Errors

Every error response is `{ statusCode, code, details }` — no `message` field. `code` is the stable, machine-readable value to dispatch UI copy off (never display raw server text — see `zod.md`'s client rules). `details` is only ever populated for `VALIDATION_ERROR` (a `[{ field, message }]` array); every other code sends `details: undefined` since the code alone already implies which field/flow is affected.

Named codes in use so far: `VALIDATION_ERROR` (any Zod shape mismatch, all routes), `INVALID_CREDENTIALS` (login), `EMAIL_TAKEN` (register), `INVALID_RESET_TOKEN` (reset-password), `ALREADY_LIKED` (`POST /product/:id/like` on a duplicate). Routes without a named code yet (e.g. change-password) still return `{ statusCode }` with `code: undefined` — fall back to a generic message for those.

### Auth

- `GET /user/me` → `{ user }` — includes `hasPassword: boolean` (computed). Use this, not `googleId`, to decide whether to show the current-password field on the change-password form. A Google user who has since set a password will have both `googleId` set and `hasPassword: true`.
- `POST /auth/change-password` → `{ user, accessToken, message }` — replace the stored access token and cached user object on success. All other sessions are invalidated server-side.
- `POST /auth/reset-password` → `{ user, accessToken }` — user is logged in immediately after reset.

### Products

`GET /product` uses **cursor pagination**, not page numbers — there is no `page`/`total`/`totalPages` in the response, and no way to jump to an arbitrary page. Build a "Load more" UI, not a numbered page picker.

- Query params: `limit` (default 10, max 100), `cursor` (opaque, see below), `categoryId`, `minPrice`, `maxPrice`, `color`, `shape` (all optional filters), `sortBy` (`'price' | 'likesCount'`, omit for newest-first), `order` (`'asc' | 'desc'`, default `'desc'`).
- Response: `{ products, nextCursor, limit }`. `nextCursor` is `null` on the last page.
- To fetch the next page, send the previous response's `nextCursor` back verbatim as the `cursor` param, **with the same `sortBy`/`order`** — a cursor carries the sort it was generated under and returns 400 if reused with a different one. Treat `cursor` as an opaque string; never construct or parse it client-side, its internal shape can change without notice.
- `color`/`shape` are stored title-cased (`"black"` → `"Black"`) regardless of input casing — filtering by either casing works, no need to normalize before sending.

### Payments

- `POST /payment/checkout` → `{ url }` — redirect to `url` immediately (Stripe-hosted checkout). Send `{ productId, quantity }`, never a raw price.
- `payment.amountTotal` is stored and returned in **cents** (integer). Format for display: `new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amountTotal / 100)`.
- After payment, wait for the DB to reflect `SUCCEEDED` (set by webhook) before showing a confirmation screen — don't trust the Stripe redirect query param alone.

### File uploads

- `DELETE /upload/:key` — always `encodeURIComponent(key)` when building the URL. Keys contain `/` (e.g. `42/images/<uuid>.png`); without encoding Express splits them across route segments and 404s.
    ```ts
    fetch(`/api/upload/${encodeURIComponent(key)}`, { method: 'DELETE' });
    ```
- Successful delete returns `204 No Content` — drop the file from local state, don't parse a body.
- 404 on delete means the key is missing _or_ belongs to another user — both cases return the same response on purpose.

---

## Realtime (Socket.io)

Every authenticated socket connection is auto-joined to a personal room (`user:${userId}`). To push a server-initiated event from any service:

```ts
import { io } from '../lib/socket/socket.js';
io.to(`user:${userId}`).emit('event-name', payload);
```

- Add role/feature rooms in `lib/socket/room.ts`.
- Add client-driven event handlers in `lib/socket/events/`, then export from the barrel `lib/socket/index.ts`.

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
| `npm run db:seed`                     | Seed the database with dev users and default products (idempotent)    |
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

The seed is idempotent — safe to run multiple times. It also seeds two categories (`Electronics`, `Books`) and two products (`Wireless Bluetooth Headphones` at €79.99, `The Pragmatic Programmer` at €34.99) if no products exist yet.

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

### Required `.env.test` values

`.env.test` is gitignored — copy `.env` and adjust. The following are required even for non-payment tests:

| Variable                | Test value      | Why                                                                                |
| ----------------------- | --------------- | ---------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | `sk_test_dummy` | `stripe.ts` initialises at module load — all files that import `app` need this set |
| `STRIPE_WEBHOOK_SECRET` | `whsec_dummy`   | Same reason — referenced in `paymentController.ts`                                 |

Payment tests mock the Stripe SDK entirely — no real API calls are made.

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

## Performance Notes

`GET /product` and `GET /product/:id` are Redis-cached (5 min TTL, stampede-protected — see `middleware/redisCache.ts`). Load-tested with k6 (`loadtest/product-stress.js`) against ~400k seeded products (`npm run db:seed:bulk`), ramping to 300 concurrent users:

```bash
npm run db:fresh && npm run db:seed:bulk && npm run dev
k6 run -e BASE_URL=http://localhost:8080/api loadtest/product-stress.js
```

- `color`/`shape` filters are intentionally left unindexed — existing sort indexes already keep these queries fast (confirmed via `EXPLAIN ANALYZE`: `Index Scan`, never `Seq Scan`, at any limit this API allows).
- `GET /product/:id` had no caching before this unit; adding it cut repeated-hit latency from ~650ms to ~30ms.
- Postgres was never the bottleneck — connections stayed well under the configured limit throughout.
- Tests were run on a single machine also running the app itself — take absolute numbers with a grain of salt; the relative improvement is what's proven, not a production capacity ceiling.

## Deployment Notes

- Set `NODE_ENV=production` — gates the `secure` flag on the refresh token cookie (required for HTTPS) and the CSP `upgrade-insecure-requests` directive (force-redirects `http://` → `https://`, which breaks local dev)
- Replace `DATABASE_URL` with your managed database connection string
- `docker-compose.yml` is for local dev only — do not use in production
