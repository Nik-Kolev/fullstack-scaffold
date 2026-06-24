# Client

Vite + React + TypeScript SPA. Connects to the Express server in `../server`.

## Stack

- **Build tool:** Vite 8
- **UI:** React 19 + TypeScript 6
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix primitives, Vega preset) + tw-animate-css
- **HTTP:** Axios — single instance with Bearer token injection and 401 refresh queue
- **Routing:** React Router v7
- **i18n:** react-i18next — English (default) + Bulgarian; language stored in `localStorage`
- **Formatter:** Prettier + prettier-plugin-tailwindcss

## Prerequisites

- Node.js 20+
- Server running on the port matching `VITE_API_URL`

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in values
cp .env.example .env

# 3. Start dev server
npm run dev
```

Runs on `http://localhost:5173` by default.

## Environment Variables

| Variable       | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| `VITE_API_URL` | Base URL of the Express server (e.g. `http://localhost:3000`) |

> Vite only exposes variables prefixed with `VITE_` to the browser bundle.

## Project Structure

```
src/
  main.tsx          Entry point — mounts React, imports global CSS
  App.tsx           Router shell — defines all routes and ProtectedRoute wrapper
  index.css         Tailwind v4 import + shadcn/ui CSS variables
  lib/
    axios.ts        Axios instance — baseURL, withCredentials, request/response interceptors
    utils.ts        shadcn cn() helper — merges Tailwind class names
  services/         API call functions — one file per domain (auth, user, upload …)
  context/          React context providers — hold state, consume services
  hooks/            Form hooks — form state, validation, submit logic
  pages/            Route-level components — thin, compose context + components
  components/
    layout/         Navbar, Layout wrapper
    shared/         Reusable pieces — ProtectedRoute, LoadingSpinner …
    ui/             shadcn generated primitives (Button, Input, Dialog …)
  types/            Shared TypeScript types
```

## Architecture

**Service → Context → Component.** The three layers are strictly separated:

1. `services/` — only axios calls. No state, no side effects.
2. `context/` — consumes services, owns state, exposes it via hooks.
3. `components/` and `pages/` — consume context via hooks. Never call services directly.

Form state and submit logic live in `hooks/` and are used inside components — not in context.

## Auth Strategy

- **Access token** — stored in a module-level variable inside `lib/axios.ts`. Never in `localStorage` or a cookie. Lost on page refresh — recovered by the silent refresh on mount.
- **User object** — stored in `localStorage` (name, email, role, avatar). Rehydrated on mount via `GET /user/me`.
- **Refresh token** — `httpOnly` cookie managed entirely by the server. The axios instance sends it automatically via `withCredentials: true`.
- **Silent refresh on mount** — before rendering protected routes, `AuthContext` calls `POST /auth/refresh`. If it fails, the user is redirected to `/login`.
- **401 queue** — if multiple requests 401 simultaneously, only one refresh fires. Others are queued and retried once the new token is set.

## Pages

| Path                     | Auth     | Description                   |
| ------------------------ | -------- | ----------------------------- |
| `/`                      | public   | Home / landing page           |
| `/terms`                 | public   | Terms of Service              |
| `/privacy`               | public   | Privacy Policy                |
| `/cookies`               | public   | Cookie Policy                 |
| `/login`                 | public   | Email/password + Google OAuth |
| `/register`              | public   | Account registration          |
| `/forgot-password`       | public   | Request password reset email  |
| `/reset-password/:token` | public   | Set new password via token    |
| `/dashboard`             | required | Authenticated home            |
| `/upload`                | required | File upload demo (R2)         |
| `/live`                  | required | WebSocket presence demo       |

## Commands

| Command           | Description                                                           |
| ----------------- | --------------------------------------------------------------------- |
| `npm run dev`     | Start dev server with HMR on port 5173                                |
| `npm run build`   | Type-check + build to `dist/`                                         |
| `npm run preview` | Preview the production build locally                                  |
| `npm run lint`    | Run ESLint                                                            |
| `npm run format`  | Format all files with Prettier (sorts Tailwind classes automatically) |
