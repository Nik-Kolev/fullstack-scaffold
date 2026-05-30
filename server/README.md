# Server

Express + TypeScript REST API with Prisma ORM and PostgreSQL.

## Stack

- **Runtime:** Node.js + TypeScript (ESM, `nodenext`)
- **Framework:** Express 5
- **ORM:** Prisma 7
- **Database:** PostgreSQL (Docker in dev, managed service in prod)

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

| Variable       | Description                        |
| -------------- | ---------------------------------- |
| `PORT`         | Port the server listens on         |
| `ORIGIN`       | Allowed CORS origin (frontend URL) |
| `DATABASE_URL` | PostgreSQL connection string       |
| `JWT_SECRET`   | Secret used to sign JWT tokens     |

`DATABASE_URL` format: `postgresql://USER:PASSWORD@localhost:5432/DBNAME`

The credentials must match the values in the root `.env` used by Docker Compose.

## Project Structure

```
src/
  index.ts          Entry point — creates app, mounts middleware, starts server
  config/           Express middleware setup (cors, json, cookieParser)
  routes/           Route definitions — maps URLs to controllers
  controllers/      Request/response handlers — calls services, returns responses
  services/         Business logic — database queries live here
  middleware/       Express middleware (error handler)
  utils/            Shared utilities (CustomError class)
  types/            TypeScript type augmentations (env.d.ts)
  lib/              Third-party singletons (Prisma client instance)
  generated/        Auto-generated Prisma client — do not edit

prisma/
  schema/           Prisma schema files (one per domain)
    base.prisma     Generator + datasource config
    user.prisma     User model
  migrations/       Auto-generated SQL migration history — commit these
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
| `npm run db:studio`                   | Open Prisma Studio (browser DB viewer) at localhost:5555        |

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

- Set `NODE_ENV=production` in your hosting environment (DigitalOcean App Platform → Environment Variables, PM2 config, etc.)
- This is required to prevent dev-only scripts like `db:fresh` from running in production
- Replace `DATABASE_URL` with your managed database connection string
- `docker-compose.yml` is for local dev only — do not use it in production
