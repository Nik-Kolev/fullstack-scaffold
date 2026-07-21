# Fullstack Scaffold — Project Context

A fully implemented base for future projects, regardless of their purpose. Goal: clean, copy-paste-friendly patterns. Prioritize clarity and good structure over feature breadth.

## The governing rule — read before proposing any work

**This is a scaffold whose purpose is to demonstrate technologies working correctly together. It is not a product being built to completion.**

Every scoping decision follows from that:

- **Breadth beats depth.** One correct, idiomatic example of a technology is the deliverable. A second hardening pass on something already demonstrated is worth less than the next technology that isn't represented at all.
- **Correct, not bulletproof.** Fix what is actually broken or misleading. Don't build machinery for failure modes this codebase will never meet at its real scale (one developer, demo traffic).
- **Prefer the smaller fix.** Where two solutions both close a real bug, take the one that adds less surface — fewer tables, fewer migrations, fewer concepts a reader has to hold.
- **Defer whole features rather than half-building them.** A missing capability noted in `roadmap.md` reads better than a partial one in the code.
- **Readable to a stranger.** Someone copying this into a new project should understand a file without archaeology. That is the actual product.

**Definition of done for the project:** every technology on the intended list is implemented and demonstrably working for a case or two. Not a complete marketplace — no promotions, wishlists, reviews, or inventory management. If a feature exists only to make the demo feel like a real shop, it doesn't belong.

**Push back at the start of a unit, not after it.** Before writing the first file, say plainly if the unit is bigger than the scaffold needs and name the smaller version. Once something is half-built, finishing it is usually the right call — so the objection is worth nothing if it arrives late. A product catalog, Stripe checkout, Socket.io, and R2/file uploads all shipped and were later removed once it was clear they'd outgrown this brief — that removal is the reference point for how much is too much.

When a proposal fails this test, say so and offer the smaller version instead of building it.

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
| Cache      | Redis 7 (`ioredis`) — rate limiting, auth token revocation, BullMQ backend |
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
│   │   ├── lib/             # prisma.ts, jwt.ts, redis.ts, bullmq.ts, googleOAuth.ts, resend.ts
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
    ├── nginx.conf           # SPA fallback + reverse-proxies /api to the server service
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
```

---

## Current State

**Full Docker setup — done.** `docker compose up --build` starts the entire stack (client, server, worker, Postgres, Redis) with no local Node/Postgres/Redis install required, using `.env.example` files that already have working local defaults — no editing needed for the core app to boot. `server/Dockerfile` is a multi-stage build shared by both the `server` and `worker` compose services (`command:` override selects the entrypoint); its `docker-entrypoint.sh` runs `prisma migrate deploy` and (outside `NODE_ENV=production`) `prisma db seed` automatically before starting — both are safe to re-run on every boot, not just the first. `client/Dockerfile` builds a static Vite bundle (`ARG VITE_API_URL=/api`, relative/same-origin since nginx now fronts the whole app) served by nginx, which reverse-proxies `/api` to the `server` service using a dynamic-DNS resolver pattern (`resolver 127.0.0.11` + a variable in `proxy_pass`) so it survives the `server` container being recreated without needing its own restart. `server`/`worker`'s `DATABASE_URL`/`REDIS_URL` default to the bundled `postgres`/`redis` containers but can be overridden by setting either in the root `.env` — points the stack at an external database/Redis instance instead, no code change needed. All compose resources (containers, images, volumes, network) share a consistent `scaffold` project name/prefix (explicit `name: scaffold` at the top of `docker-compose.yml`). CI's `.github/workflows/ci.yml` gained a `docker` job that builds all three images so a broken Dockerfile fails the build.

**FE modernization — done.** All four auth forms (Login, Register, Forgot Password, Reset Password) run on React Hook Form + Zod, with factory-function schemas for i18n error messages. The reviewer pass over the combined CI + security-hardening + full-Docker diff is complete, and `develop` merged to `main` for that batch.

**API error convention — built.** `CustomError`/`errorHandler` carry a stable `code`; no bare `message` reaches the client. See `zod.md` for the full convention (response shape, named codes, `VALIDATION_ERROR` carve-out).

**Scope reset — done.** The product catalog, Stripe checkout, Socket.io, and Cloudflare R2/file uploads were removed. Each had grown into its own multi-phase effort (a full e-commerce catalog with cursor pagination/caching/load-testing; a Stripe integration with webhooks and disputes) that outgrew what a scaffold needs to demonstrate — the actual deliverable is a fully implemented base for future projects regardless of their purpose: solid auth, error handling, and i18n-ready FE pages. Redis/BullMQ (email queue, nightly token cleanup, rate limiting, auth token revocation) stayed — core auth infrastructure, not tied to the removed features.

**Next — nothing in progress**, per `roadmap.md`.
