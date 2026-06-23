# Client — Conventions

See root `CLAUDE.md` for stack, project structure, and env vars.
See `roadmap.md` → `Completed ✓` for server API contracts and FE integration notes — each completed feature has a **FE Integration** block. Read it at the start of every client session.

---

## Conventions

### Architecture

- **Service → Context → Component.** API calls live in `services/` (one file per domain). Context consumes the service and holds state. Components consume via hook. Never a direct fetch inside a component or context bypassing the service.
- **Form hooks in `hooks/`.** Form state, validation, and submit logic go in a dedicated hook used inside the component — not in context.
- **Unique CSS prefix per component.** Abbreviation from the component name (e.g. `UserProfileCard → upc-`). Prevents class name collisions without needing CSS modules.
- **Mobile-first — non-negotiable.** Every layout must be usable on mobile. Top navbar converts to hamburger on small screens. Design mobile layout first, expand for desktop.

### Formatter

`npm run format` from `client/` — runs Prettier with `prettier-plugin-tailwindcss` (auto-sorts Tailwind classes).

### Auth state

- Access token: in memory only (never localStorage, never a cookie).
- User object: in localStorage — rehydrate on app mount via `GET /user/me`.
- Silent refresh on app mount: if the access token is missing or expired, call `POST /auth/refresh` before rendering protected routes.
