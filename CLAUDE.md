# Fullstack Scaffold — Project Context

Reusable fullstack starter. Goal: clean, copy-paste-friendly patterns. Prioritize clarity and good structure.

## Project docs
| Purpose | Location |
|---|---|
| Current state | `## Current State` section below |
| API contracts + FE integration notes | `server/README.md` → `Frontend Integration Notes` |
| Server conventions + commands | `server/CLAUDE.md` |
| Client conventions + API contracts | `client/CLAUDE.md` |
| Formatter (server) | `npm run format` from `server/` |
| Formatter (client) | `npm run format` from `client/` |
| README to update on change | `server/README.md` and `client/README.md` |

---

## Stack

| Layer      | Tech                                                               |
| ---------- | ------------------------------------------------------------------ |
| Server     | Express 5, TypeScript (ESM), tsx/nodemon                           |
| ORM        | Prisma 7 (multi-file schema, `prisma.config.ts`, PrismaPg adapter) |
| Database   | PostgreSQL (Docker in dev)                                         |
| Auth       | JWT — access (15 min) + refresh (7 d, httpOnly cookie)             |
| Cache      | Redis 7 (`ioredis`) — response caching, BullMQ backend             |
| Validation | Zod v4                                                             |
| Hashing    | bcrypt v6                                                          |

---

## Project Structure

```
fullstack-scaffold/
├── server/
│   ├── prisma/
│   │   ├── schema/          # multi-file: base.prisma, user.prisma, refreshToken.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/          # expressConfig.ts — middleware + server start
│   │   ├── controllers/     # thin: call service, set cookie, send response
│   │   ├── lib/             # prisma.ts, jwt.ts, (redis.ts, socket.ts, stripe.ts …)
│   │   ├── middleware/      # errorHandler, validateBody, isAuthenticated, requireRole
│   │   ├── routes/          # index.ts mounts all routers; 404.route.ts last
│   │   ├── schemas/         # Zod schemas — one file per domain
│   │   ├── services/        # all DB/business logic lives here
│   │   ├── types/           # env.d.ts (typed ProcessEnv), express.d.ts (req.user)
│   │   └── index.ts         # entry: create app, mount routes, attach errorHandler last
│   ├── scripts/             # db-fresh.mjs
│   ├── prisma.config.ts     # Prisma 7 — datasource URL goes here, not in schema
│   ├── Dockerfile           # multi-stage; runtime image shared by server + worker (compose command: override)
│   ├── docker-entrypoint.sh # runs `prisma migrate deploy` before exec'ing the CMD
│   └── package.json
└── client/
    ├── e2e/                 # Playwright — auth.setup.ts, login.spec.ts, register.spec.ts, forgot-password.spec.ts, reset-password.spec.ts
    ├── playwright.config.ts
    ├── Dockerfile           # multi-stage; ARG VITE_API_URL baked in at build time (Vite inlines env at build, not runtime)
    ├── nginx.conf           # SPA fallback + reverse-proxies /api and /socket.io to the server service
    └── src/
        ├── components/      # layout/, shared/, ui/ (shadcn)
        ├── context/         # AuthContext (user + token state)
        ├── hooks/           # Form hooks by domain — hooks/auth/ (useLoginForm, useRegisterForm, useForgotPasswordForm, useResetPasswordForm)
        ├── i18n/            # react-i18next — en.json + bg.json
        ├── lib/             # axios.ts (interceptors), cn.ts (shadcn utility)
        ├── pages/           # Route-level components by domain — pages/auth/ (LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage)
        ├── schemas/         # Zod schemas as factory functions of t() (i18n) — auth.schema.ts, consumed by hooks/ via React Hook Form's resolver
        ├── services/        # auth.ts, user.ts — axios call functions
        └── types/           # Shared TS types (User, AuthResponse)
```

---

## Env Vars (root `.env`)

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
```

Used by `docker-compose.yml` — both to initialize the `postgres` container and, via variable substitution, to build the `DATABASE_URL` that the `server`/`worker` containers actually connect with (their own `server/.env`'s `DATABASE_URL` points at `localhost`, which is correct for local dev but not reachable from inside a sibling container — see `docker-compose.yml`'s `server`/`worker` `environment:` overrides).

## Env Vars (`server/.env`)

```
PORT=
ORIGIN=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
NODE_ENV=           # set to "production" on deploy — gates secure cookie

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=   # must match Google Cloud Console authorised redirect URI

# Redis
REDIS_URL=redis://localhost:6379

# Resend
RESEND_API_KEY=
RESEND_FROM=                # e.g. onboarding@resend.dev (dev) or noreply@yourdomain.com (prod)
RESEND_REPLY_TO=            # e.g. your Gmail — users who reply land here

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=              # e.g. https://pub-xxx.r2.dev (from bucket public access settings)
R2_ENDPOINT=                # EU: https://<accountid>.eu.r2.cloudflarestorage.com

# Stripe
STRIPE_SECRET_KEY=          # from Stripe Dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=      # from Stripe Dashboard → Webhooks → signing secret
```

---

## Current State

**Full Docker setup — done.** `docker compose up --build` starts the entire stack (client, server, worker, Postgres, Redis) with no local Node/Postgres/Redis install required, using `.env.example` files that already have working local defaults — no editing needed for the core app to boot. `server/Dockerfile` is a multi-stage build shared by both the `server` and `worker` compose services (`command:` override selects the entrypoint); its `docker-entrypoint.sh` runs `prisma migrate deploy` and (outside `NODE_ENV=production`) `prisma db seed` automatically before starting — both are safe to re-run on every boot, not just the first. `client/Dockerfile` builds a static Vite bundle (`ARG VITE_API_URL=/api`, relative/same-origin since nginx now fronts the whole app) served by nginx, which reverse-proxies `/api` and `/socket.io` to the `server` service using a dynamic-DNS resolver pattern (`resolver 127.0.0.11` + a variable in `proxy_pass`) so it survives the `server` container being recreated without needing its own restart. `server`/`worker`'s `DATABASE_URL`/`REDIS_URL` default to the bundled `postgres`/`redis` containers but can be overridden by setting either in the root `.env` — points the stack at an external database/Redis instance instead, no code change needed. All compose resources (containers, images, volumes, network) share a consistent `scaffold` project name/prefix (explicit `name: scaffold` at the top of `docker-compose.yml`). CI's `.github/workflows/ci.yml` gained a `docker` job that builds all three images so a broken Dockerfile fails the build.

**Next — reviewer pass** over the combined CI + security-hardening + full-Docker diff, per the standing plan.
