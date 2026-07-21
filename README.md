# fullstack-scaffold

A fully implemented base for future projects, regardless of their purpose — not a product, a starting point. Solid auth, error handling, and i18n-ready FE pages, in clean, copy-paste-friendly patterns.

## What's Included

| Feature | Details |
|---|---|
| **Auth** | Email/password + Google OAuth, JWT access (15 min) + refresh (7 d, httpOnly cookie), silent refresh on mount, token rotation, session revocation |
| **Roles** | `user` and `admin` roles, `requireRole` guard middleware |
| **Password flows** | Change password, forgot password (email link), reset password — all with email notifications |
| **Email** | Resend + react-email templates (welcome, password reset, password changed), BullMQ-queued |
| **Background jobs** | BullMQ — email queue worker, nightly token cleanup cron |
| **Cache** | Redis — rate limiting, access token blacklisting/revocation on logout and password change |
| **i18n** | react-i18next — English + Bulgarian |
| **UI** | Tailwind v4, shadcn/ui, Sonner toasts, ErrorBoundary, NotFoundPage |
| **Testing** | Vitest + Supertest (server), Playwright e2e (client, auth flows) |

## Stack

| Layer | Tech |
|---|---|
| Client | Vite 8, React 19, TypeScript 6, Tailwind v4, shadcn/ui, Axios, React Router v7 |
| Server | Express 5, TypeScript (ESM), Prisma 7, PostgreSQL |
| Auth | JWT — access token (15 min, in-memory) + refresh token (7 d, httpOnly cookie) |
| Cache | Redis 7 (ioredis) — rate limiting, auth token revocation, BullMQ background jobs |
| Email | Resend + react-email templates |

## Structure

```
fullstack-scaffold/
├── client/     # Vite + React SPA — see client/README.md
└── server/     # Express REST API — see server/README.md
```

## Getting Started

### Option A: Docker (recommended)

Runs the entire stack — client, server, worker, Postgres, and Redis — in containers. No local Node, Postgres, or Redis install needed.

**Prerequisites:** Docker Desktop running.

```bash
git clone <repo-url>
cd fullstack-scaffold
cp .env.example .env               # already has working local defaults — no editing needed
cp server/.env.example server/.env # already has working local defaults for the core app;
                                    # optional services (Resend, Google OAuth) stay blank until you need them
docker compose up --build -d
```

`-d` runs everything in the background and hands your terminal back once containers are up.

That's it — the server container applies pending migrations and seeds the test users automatically on startup (safe to re-run, so this stays true on every `docker compose up`, not just the first). `client/.env` isn't needed for the Docker path — the client's API URL is baked in at build time via `docker-compose.yml`, not read from that file.

The client is now running at http://localhost:5173, the API at http://localhost:8080. `docker compose down` stops everything; add `-v` to also wipe the database volumes.

**Using an external database or Redis instance instead of the bundled containers?** Set `DATABASE_URL`/`REDIS_URL` in the root `.env` — they override the bundled `postgres`/`redis` containers' URLs when present.

**Need a real admin user** (e.g. for a production deploy, where seeding known test credentials isn't appropriate)?

```bash
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=<a real password> -e ADMIN_NAME="Your Name" server npm run create-admin
```

Safe to re-run — upserts by email, so it also works to promote an already-registered user to admin.

Every service reads its config entirely from environment variables (`DATABASE_URL`, `REDIS_URL`, etc.) — nothing is wired to `localhost` inside the images themselves. That means the same Dockerfiles and `docker-compose.yml` are a real starting point for deploying to any container host later (a Droplet, DigitalOcean App Platform, etc.), not just a local dev convenience.

### Option B: Local Node (hot-reload dev)

The Docker build is a static, production-style build with no hot reload. For active development, running natively with `tsx`/`vite` gives instant reload on save.

**Prerequisites:** Node.js 20+, Docker Desktop running (for Postgres/Redis containers only).

```bash
# Server
cd server
npm install
cp .env.example .env   # fill in your API keys — see server/README.md for where to get them
npm run db:fresh       # first time only — creates schema, runs migrations, seeds test users
npm run dev            # starts Docker containers, then the server on :8080
npm run worker         # BullMQ worker (separate terminal) — handles email jobs, token cleanup cron
# or start both together:
npm run dev:all        # server + worker in one terminal, colour-coded output

# Client (new terminal)
cd client
npm install
cp .env.example .env
npm run dev            # starts the client on :5173
```

See [`server/README.md`](server/README.md) and [`client/README.md`](client/README.md) for full setup, env vars, and commands.

## Seed Data

`db:fresh` seeds automatically on first setup. To seed without wiping the database:

```bash
cd server && npm run db:seed
```

Test credentials:

| Email | Password | Role |
|---|---|---|
| `test@abv.bg` | `password` | `user` |
| `admin@abv.bg` | `password` | `admin` |

## Third-Party Services

The scaffold integrates several external services. All are free-tier friendly for development:

| Service | Used for | Sign-up |
|---|---|---|
| Google Cloud Console | OAuth 2.0 | [console.cloud.google.com](https://console.cloud.google.com) |
| Resend | Transactional email | [resend.com](https://resend.com) |

You can leave any service's env vars blank if you're not using that feature yet — unrelated routes will still work.
