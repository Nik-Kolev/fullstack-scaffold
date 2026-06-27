# Client — Conventions

See root `CLAUDE.md` for stack, project structure, and env vars.  
See `server/README.md → Frontend Integration Notes` for response shapes and API contract gotchas (payment cents, upload key encoding, auth state on change-password).

---

## Architecture

**Service → Context → Component** — strictly separated layers:

- `services/` — axios call functions only. No state, no side effects.
- `context/` — consumes services, owns state, exposes it via hooks.
- `components/` and `pages/` — consume context via hooks. Never call a service directly from a component.

Form state and submit logic live in `hooks/` and are used inside components — not in context.

**CSS prefix per component.** Pick an abbreviation from the component name (e.g. `UserProfileCard → upc-`). Prevents class name collisions without CSS modules.

**Mobile-first.** Design mobile layout first, expand for desktop. The navbar converts to a hamburger on small screens.

---

## API response contracts

Before writing a service call, verify the server response shape. In order:

1. `server/README.md → Frontend Integration Notes` — response shapes, gotchas, and contract details.
2. The server controller for that route — look at what it passes to `res.json(...)`.

Common shapes to know:

- `GET /user/me`, `PATCH /user/me` → `{ user }` (always wrapped, never a bare object)
- `POST /auth/change-password` → `{ user, accessToken, message }`
- `POST /auth/reset-password` → `{ user, accessToken }` — user is logged in after reset

---

## Auth state

- **Access token** — module-level variable in `lib/axios.ts`. Never localStorage or a cookie. Lost on hard refresh; recovered by silent refresh on mount.
- **User object** — `localStorage`. Rehydrated on app mount via `GET /user/me`.
- **Silent refresh** — `AuthContext` calls `POST /auth/refresh` before rendering protected routes. `isLoading` guards against flashing.

---

## Shadcn components

New components: `npx shadcn add <component>` from `client/`. The CLI reads `components.json` and writes to `src/components/ui/`. The `cn()` utility lives in `src/lib/cn.ts` (aliased as `@/lib/cn`).

---

## Formatter

`npm run format` from `client/` — Prettier with `prettier-plugin-tailwindcss` (auto-sorts Tailwind classes). Run before every commit.

---

## Before committing

1. `npm run format`
2. Update `client/README.md` if pages, env vars, project structure, or commands changed.
