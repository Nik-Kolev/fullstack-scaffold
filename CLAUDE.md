# Fullstack Scaffold — Project Context

Reusable fullstack starter. Goal: clean, copy-paste-friendly patterns. Prioritize clarity and good structure.

## Project docs
| Purpose | Location |
|---|---|
| Current state | `## Current State` section below |
| Completed features + gotchas | `roadmap.md` → `Completed ✓` |
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
│   └── package.json
└── client/
    ├── e2e/                 # Playwright — auth.setup.ts, login.spec.ts, register.spec.ts
    ├── playwright.config.ts
    └── src/
        ├── components/      # layout/, shared/, ui/ (shadcn)
        ├── context/         # AuthContext (user + token state)
        ├── hooks/           # Form hooks — useLoginForm, useRegisterForm …
        ├── i18n/            # react-i18next — en.json + bg.json
        ├── lib/             # axios.ts (interceptors), utils.ts
        ├── pages/           # Route-level components
        ├── services/        # auth.ts, user.ts — axios call functions
        └── types/           # Shared TS types (User, AuthResponse)
```

---

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

**Next — `/forgot-password` page**
Email input form. Calls `forgotPassword()` from `AuthContext` (already wired — calls `POST /auth/forgot-password`). Server always returns 200 regardless of whether the email exists (prevents user enumeration). Show a success message on submit instead of redirecting. Add e2e tests to `e2e/forgot-password.spec.ts`.

After forgot-password: `/reset-password/:token`, then `/dashboard`. See `roadmap.md` → Up Next for full order.

Full implementation history, gotchas, and design notes for every completed feature: see `roadmap.md` → `Completed ✓`.
