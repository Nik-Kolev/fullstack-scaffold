# fullstack-scaffold

Reusable fullstack starter. Copy-paste-friendly patterns, clean architecture, production-ready features out of the box.

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

Start the server first, then the client — the client proxies API calls to the server.

```bash
# Server
cd server && npm install && cp .env.example .env
npm run dev

# Client (new terminal)
cd client && npm install && cp .env.example .env
npm run dev
```

See [`server/README.md`](server/README.md) and [`client/README.md`](client/README.md) for full setup, env vars, and commands.
