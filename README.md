# fullstack-scaffold

Production-ready fullstack starter. Clean architecture, copy-paste-friendly patterns, and a full feature set so you can focus on building product instead of infrastructure.

## What's Included

| Feature | Details |
|---|---|
| **Auth** | Email/password + Google OAuth, JWT access (15 min) + refresh (7 d, httpOnly cookie), silent refresh on mount, token rotation, session revocation |
| **Roles** | `user` and `admin` roles, `requireRole` guard middleware |
| **Password flows** | Change password, forgot password (email link), reset password — all with email notifications |
| **Email** | Resend + react-email templates (welcome, password reset, password changed), BullMQ-queued |
| **Background jobs** | BullMQ — email queue worker, nightly token cleanup cron |
| **File storage** | Cloudflare R2 (S3-compatible) — multi-file upload, folder listing, delete |
| **Payments** | Stripe Checkout — one-time sessions, webhook handling, payment history |
| **Realtime** | Socket.io — per-user rooms, JWT auth on every connection |
| **Cache** | Redis — response caching, access token blacklisting on logout |
| **i18n** | react-i18next — English + Bulgarian |
| **UI** | Tailwind v4, shadcn/ui, Sonner toasts, ErrorBoundary, NotFoundPage |
| **Testing** | Vitest + Supertest (server, 198 tests), Playwright e2e (client, auth flows) |

## Stack

| Layer | Tech |
|---|---|
| Client | Vite 8, React 19, TypeScript 6, Tailwind v4, shadcn/ui, Axios, React Router v7 |
| Server | Express 5, TypeScript (ESM), Prisma 7, PostgreSQL |
| Auth | JWT — access token (15 min, in-memory) + refresh token (7 d, httpOnly cookie) |
| Cache | Redis 7 (ioredis) — response caching, BullMQ background jobs |
| Storage | Cloudflare R2 (S3-compatible) |
| Email | Resend + react-email templates |
| Realtime | Socket.io |
| Payments | Stripe Checkout |

## Structure

```
fullstack-scaffold/
├── client/     # Vite + React SPA — see client/README.md
└── server/     # Express REST API — see server/README.md
```

## Getting Started

**Prerequisites:** Node.js 20+, Docker Desktop running.

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
| Cloudflare R2 | File storage | [dash.cloudflare.com](https://dash.cloudflare.com) |
| Stripe | Payments | [dashboard.stripe.com](https://dashboard.stripe.com) |

You can leave any service's env vars blank if you're not using that feature yet — unrelated routes will still work.
