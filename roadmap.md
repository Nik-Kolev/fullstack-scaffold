# Feature Roadmap

> **Maintenance rule:** whenever a task is added, moved, or completed — renumber all Up Next items sequentially from 1.

---

## Up Next

### 1. Client — pages

Bootstrap, auth layer, layout layer, and i18n all done. Building pages now.

**Remaining infrastructure (add before or during first page):**
- `sonner` toast — `npx shadcn add sonner`, add `<Toaster />` to Layout. Use for all API error feedback.
- `components/shared/ErrorBoundary.tsx` — React Error Boundary wrapping the layout; shows fallback UI instead of blank screen on component crash.
- `pages/NotFoundPage.tsx` — proper 404 page; replace the current `*` redirect with it. Redirect to `/dashboard` or `/login` from within the page based on auth state.

**Pages to build (stubs exist, need real implementation):**
- `/login` — email/password form + Google OAuth button
- `/register` — registration form
- `/forgot-password` — email input, sends reset link
- `/reset-password/:token` — new password form, reads token from URL
- `/dashboard` — authenticated home, user info + feature overview
- `/upload` — file upload demo (R2 integration)
- `/live` — Socket.io presence demo (open two tabs, see each other online)

---

### 2. Full Dockerize

**Files:** `Dockerfile` (server), `client/Dockerfile`, `docker-compose.yml` (update)

Server Dockerfile (multi-stage):
1. Stage `build`: `npm ci`, `npx tsc`, output to `/dist`.
2. Stage `production`: copy `/dist` + `node_modules` (prod only), `CMD ["node", "dist/index.js"]`.

Client Dockerfile:
1. Stage `build`: `npm ci`, `npm run build`, output to `/dist`.
2. Stage `production`: nginx, copy `/dist` to `/usr/share/nginx/html`.

`docker-compose.yml`: add `server` and `client` services, wire env vars, add named volumes for Postgres + Redis data persistence.

> **Note:** Do after all FE pages and layout are complete.

---

## Completed ✓

### React Client — Layout layer + i18n
Navbar, Footer, Layout wrapper, CookieBanner, page transitions, i18n (EN + BG), mobile hamburger.

**Files:**
- `src/components/layout/Navbar.tsx` — sticky top nav, desktop: 3-col grid (logo | centered links | lang+auth); mobile: `col-start-3` hamburger, absolute overlay menu with `animate-in slide-in-from-top-2 fade-in`; `useRef`+`document.mousedown` click-outside to close; `handleMobileNav` scrolls to top on link click
- `src/components/layout/Footer.tsx` — `md:grid-cols-[auto_auto_auto]` (content-driven column widths, no language-inflation); mobile: `order-1`/`order-2` flips columns above brand; `col-span-2 md:col-span-1` for Legal column; column headers `uppercase tracking-wider`; description `text-center md:text-left`
- `src/components/layout/Layout.tsx` — `key={location.pathname}` on outlet wrapper triggers `animate-in fade-in slide-in-from-bottom-4 duration-300` on every route change
- `src/components/layout/CookieBanner.tsx` — localStorage-gated cookie consent banner
- `src/index.css` — `scrollbar-gutter: stable` prevents layout shift between short/tall pages
- `src/i18n/` — `react-i18next`, EN + BG, `t('key')` throughout, `i18nextLng` in localStorage; nav uses short keys (`nav.terms`, `nav.privacy`, `nav.cookies`)

**Design decisions:**
- `grid-cols-[auto_auto_auto]` over `grid-cols-3` (`1fr`): in a flex intrinsic-width context, `1fr` expands all columns to the widest column's max-content. `auto` sizes each column to its own content independently.
- `w-fit` on the logo `<Link>`: CSS grid items stretch to fill their track regardless of `display: inline-flex` — `width: fit-content` is the only escape.
- Backdrop click-outside avoided in favour of `useRef + document.mousedown`: a `fixed inset-0` backdrop inside the `<header>` (which sets a stacking context) renders above the header's own grid children, intercepting clicks on the close button. The `useRef` approach has no z-index dependency.
- `behavior: 'instant'` in `handleMobileNav`: smooth scroll competes visually with the page fade-in animation. Instant scroll + animated content is cleaner than both animating simultaneously.

---

### React Client — Bootstrap + Auth layer
Vite + React + TypeScript client. Axios instance, silent refresh on mount, AuthContext, ProtectedRoute, router.

**Files:**
- `src/main.tsx` — entry point; mounts React, imports global CSS and i18n
- `src/App.tsx` — router shell; public routes + `<ProtectedRoute>` wrapping auth-gated pages
- `src/lib/axios.ts` — Axios instance with `baseURL`, `withCredentials`, Bearer injection interceptor, 401 queue (one refresh fires, queued requests retry on new token)
- `src/services/auth.ts` — `login`, `register`, `logout`, `refreshToken`, `forgotPassword`, `resetPassword`; all return typed shapes
- `src/services/user.ts` — `getMe`, `updateMe`
- `src/context/AuthContext.tsx` — holds `user + accessToken` in memory; rehydrates on mount via `GET /user/me` after silent refresh; exposes `login`, `logout`, `register`, `updateUser`
- `src/components/shared/ProtectedRoute.tsx` — renders `<Outlet>` after auth is confirmed; redirects to `/login` on failure
- `src/types/index.ts` — `User`, `AuthResponse` shared types

**Design decisions:**
- Access token in module-level variable inside `axios.ts` — not state, not localStorage. Lost on hard refresh; recovered by silent refresh before any protected route renders.
- `isLoading` guard in `AuthContext` prevents protected routes from flashing before the silent refresh resolves.
- 401 queue: `isRefreshing` flag + `failedQueue` array — only one `POST /auth/refresh` fires even if multiple requests 401 simultaneously; all queued callers retry with the new token.

---

### User — /me endpoints
`GET /user/me` and `PATCH /user/me` for authenticated self-service. `/me` routes registered before `/:id` to prevent param capture.

**Files:**
- `src/schemas/user.schema.ts` — `updateMeSchema`: `name?` + `email?`, at least one required via `.refine`
- `src/services/userServices.ts` — added `updateMe`; removed redundant `omit: { password: true }` from `getUser` (global Prisma config handles it)
- `src/controllers/userController.ts` — added `getMe`, `updateMe`
- `src/routes/user.routes.ts` — `/me` routes before `/:id`, `PATCH /me` uses `validateBody`
- `src/__tests__/user.test.ts` — 11 tests: auth guard, empty body, invalid email, empty name, update name, update email, 409 duplicate email, field stripping (role: admin rejected)

**Design decisions:**
- No ownership check needed — server derives userId from JWT (`req.user!.userId`), client cannot influence whose data is fetched
- `updateMe` has no explicit 404 guard — Prisma P2025 maps to 404 in `errorHandler`
- P2002 (duplicate email) maps to 409 in `errorHandler` — no service-level handling needed
- All user endpoints return `{ user }` wrapper: `GET /user/me`, `GET /user/:id`, `PATCH /user/me`

**FE Integration:**
- `GET /user/me` → call on app mount to rehydrate user state after page refresh. Returns `{ user }` — full profile, no password field, includes computed `hasPassword: boolean`.
- `PATCH /user/me` → send `{ name?, email? }`, at least one required. Returns `{ user }` — replace stored user object on success.
- **409** = new email already taken by another account.
- Unknown fields stripped server-side (`role`, `stripeCustomerId`, etc.) — don't filter on the FE.

---

### Products — product catalogue
`Product` model with soft delete. Admin CRUD, public read with pagination. Image upload integrated into `POST /product` (one request). Checkout takes `productId + quantity` — server derives price and description.

**Files:**
- `prisma/schema/product.prisma` — `Product` model (`id`, `name`, `description?`, `price Int` cents, `imageUrl?`, `isActive Boolean @default(true)`, `createdAt`)
- `src/schemas/product.schema.ts` — `createProductSchema` (name, price required; imageUrl validated as URL), `updateProductSchema` (all partial, at least one field required via `.refine`)
- `src/services/productService.ts` — `createProduct`, `getProducts` (active only, desc by `createdAt`), `getProductById` (all — allows admin to fetch inactive), `updateProduct`, `deactivateProduct` (soft delete: `isActive = false`)
- `src/controllers/productController.ts` — thin; `createProduct` → 201, `getProducts` → 200, `getProductById` → 200, `updateProduct` → 200, `deactivateProduct` → 204
- `src/routes/product.route.ts` — GET `/` + GET `/:id` public; POST `/`, PUT `/:id`, DELETE `/:id` guarded by `isAuth + requireRole('admin') + validateBody`
- `src/routes/index.ts` — `router.use('/product', productRoutes)`
- `src/schemas/payment.schema.ts` — replaced `{ amountTotal, quantity, description? }` with `{ productId, quantity }`
- `src/services/paymentService.ts` — `createCheckoutSession` now accepts `productId + quantity`; looks up product, throws 404 if missing or inactive, derives `amountTotal = product.price * quantity` and `description = product.name`
- `src/controllers/paymentController.ts` — destructures `{ productId, quantity }` from `req.body`
- `prisma/seed.ts` — idempotent product seed: `Basic Plan` (999) + `Pro Plan` (2999), guarded by `product.count() === 0`
- `src/__tests__/product.test.ts` — 25 tests covering all routes: auth/role guards, validation (float price, zero price, bad URL), soft delete DB assertion, deactivated product excluded from list

**Design decisions:**
- `getProductById` returns inactive products — allows admins to fetch deactivated items directly. `getProducts` (list) only returns active ones.
- Inactive and non-existent products both return 404 in checkout — avoids leaking product existence to the client.
- `deactivateProduct` (soft delete) preserves historical Payment rows that reference the product name.
- `product.deleteMany()` added first in `beforeEach` for payment and product tests — required because `Payment` stores the product's name (not a FK), so order doesn't matter for FK; but clearing products before users avoids any future FK issues.

**Gotcha — `prisma generate` after `db:fresh`:**
`db:fresh` wipes and resets the DB but may not re-run `prisma generate`. If `prisma.product` is `undefined` at test time, run `npx prisma generate` manually to update the client.

---

### Stripe — payments
`stripe` v22.2.1, API version `2026-05-27.dahlia`. One-time Checkout sessions only — no subscriptions.

**Files:**
- `src/lib/stripe.ts` — Stripe singleton
- `src/lib/stripeWebhook.ts` — `handleStripeEvent(event)`: switches on `event.type`, calls service update functions; `default: return` silently handles unknown events (returning 200 to Stripe, not throwing — throwing would trigger retries for events we don't care about)
- `prisma/schema/payment.prisma` — `PaymentStatus` enum (`PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`) + `Payment` model
- `prisma/schema/user.prisma` — added `stripeCustomerId String? @unique` + `payments Payment[]` relation
- `src/services/paymentService.ts` — `getOrCreateStripeCustomer` (private), `createCheckoutSession`, `updatePaymentBySessionId`, `updatePaymentByPaymentIntentId`
- `src/schemas/payment.schema.ts` — `createCheckoutSessionSchema`
- `src/controllers/paymentController.ts` — `createCheckoutSession`, `handleWebhook`
- `src/routes/payment.route.ts` — `POST /payment/checkout` (isAuth → checkoutLimiter → validateBody → controller)
- `src/middleware/rateLimiter.ts` — `checkoutLimiter` (1 req / 5s, keyed by `userId`)
- `src/types/env.d.ts` — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `scripts/payment-test.mjs` — logs in, creates a checkout session, prints the URL + test card number

**Design decisions:**
- `amountTotal` stored in cents (integer). FE divides by 100 and formats with `Intl.NumberFormat`.
- `getOrCreateStripeCustomer` is unexported — Stripe Customer created lazily on first checkout, not at registration.
- Pending session guard in `createCheckoutSession`: if a `PENDING` row exists, retrieve the Stripe session — if still `open` return the existing URL; if expired mark it `FAILED` then create fresh.
- `checkoutLimiter` keys on `req.user.userId` (not IP) — must sit after `isAuth` in the chain.
- Two service update functions needed because Stripe uses different identifiers across event types: `stripeSessionId` for `checkout.session.*` events, `stripePaymentIntentId` for `charge.*` events.
- `charge.amount_refunded === charge.amount` distinguishes full vs partial refund in a single comparison.

**Critical gotcha — webhook route placement:**
`POST /payment/webhook` is registered in `app.ts` **before** `expressConfig(app)`. Stripe's `constructEvent` verifies an HMAC over the raw request bytes — `express.json()` consumes the body stream before the route sees it, making signature verification impossible. Registering with `express.raw({ type: 'application/json' })` before the global JSON parser is the only fix. The `handleWebhook` controller wraps `constructEvent` in try/catch to return 400 (not 500) on invalid signatures.

**Automated tests (`src/__tests__/payment.test.ts`) — 29 tests:**
- Stripe SDK fully mocked via `vi.mock('../lib/stripe.js')` — no real API calls
- Webhook events injected via `stripe.webhooks.constructEvent` mock (`mockReturnValueOnce`)
- Checkout: auth guard, 8 validation cases, field stripping, happy path + DB assertions, customer lifecycle, pending session guard (open + expired), no-url 500
- Webhook: missing/invalid signature, all 4 event types, `payment_intent` as expanded object (silent skip), unknown event type, unknown session 404, duplicate event idempotency
- `Payment` has no cascade delete — `payment.deleteMany()` added to `beforeEach` in auth and upload tests to prevent FK violations across test files
- `STRIPE_SECRET_KEY=sk_test_dummy` + `STRIPE_WEBHOOK_SECRET=whsec_dummy` required in `.env.test` — Stripe constructor runs at module load even in non-payment test files

**FE Integration:**
- Send `{ productId: number, quantity: number }` — never a raw price. Server derives `amountTotal = product.price * quantity` and uses `product.name` as description. Prevents price manipulation.
- Fetch active products first from `GET /product`; only let users select from those. Inactive/missing `productId` → 404.
- `amountTotal` is in cents (integer). Format: `new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amountTotal / 100)`.
- On success: `201 { url }` — redirect immediately to `url` (Stripe-hosted checkout page).
- After payment: Stripe redirects to `ORIGIN/payment/success?session_id=...` or `ORIGIN/payment/cancel`. Do not trust the redirect alone — wait for DB to show `SUCCEEDED` (set by webhook) before showing confirmation.
- Rate limited: 1 req / 5s per user. Disable the pay button on click to prevent double-submits.

---

### Express scaffold
Middleware, CORS, cookie-parser, rate limiting, error handler.

### Prisma
`User`, `RefreshToken` models; multi-file schema; `prisma.config.ts`; PrismaPg adapter. `@map`/`@@map` throughout — DB is snake_case (`users`, `refresh_tokens`, `google_id`...), TS layer is camelCase. `onDelete: Cascade` on `RefreshToken → User`. Global `omit: { password: true }` in the `PrismaClient` constructor (services opt back in per-query for bcrypt comparisons); `$extends` adds a computed `hasPassword: boolean` to every user query.

### JWT auth
Access token (15 min) + refresh token (7 d, httpOnly cookie). Rotation, `jti` uniqueness. `isAuth` stores `jti`/`exp` on `req.user`. `logoutUser` uses `deleteMany` (idempotent — no error if the token's already gone). `refreshToken` uses an atomic `deleteMany({ refreshTokenId, expiresAt: { gt: now } })` + count check to close a TOCTOU race.

### Auth routes
Register, login, logout, refresh — all under `/auth`.

### Change Password
`POST /auth/change-password` — authenticated; `currentPassword` only required when `hasPassword` is true (validated via `.refine` in `changePasswordSchema`, which also blocks reusing the current password). On success: all refresh tokens deleted, new token pair issued, old access token blacklisted in Redis (non-fatal try/catch — Redis being down doesn't fail the request). Returns `{ user, accessToken, message }` + new refresh cookie. 11 integration tests.

**FE Integration:**
- Use `hasPassword`, not `googleId`, to drive the form. `googleId` tells you how the user signed up — not whether they currently have a password. A Google user who set a password later has `googleId` set *and* `hasPassword: true`.
  - `hasPassword: false` → show `newPassword` + confirm only; send `{ newPassword }`
  - `hasPassword: true` → show `currentPassword` + `newPassword` + confirm; send `{ currentPassword, newPassword }`
- On success: replace stored access token with `accessToken`, replace cached user object with `user` (will have `hasPassword: true`). Do not re-fetch — server sends updated state.
- All other sessions invalidated on success — other devices log out on next refresh rotation.
- Edge case: if Redis is down, old access token is not blacklisted but expires naturally within 15 min. User sees no error.

### Google OAuth
Authorization Code Flow, upsert by `googleId`.

### Redis
Response cache middleware, token blacklisting on logout via `ioredis`.

### Middleware
`isAuthenticated`, `requireRole`, `validateBody`, `rateLimiter`.

### Tests
60 auth integration tests (incl. change-password, forgot-password, reset-password), 11 middleware tests, 2 worker tests, 14 upload tests; separate `scaffold_test` DB. `vitest.config.ts` sets `fileParallelism: false` — `auth.test.ts` and `upload.test.ts` both do blanket cleanup in `beforeEach`, and running them in parallel let one wipe the other's in-flight data. `middleware.test.ts` still uses a throwaway express instance, not the real app/routes.

### BullMQ
`createQueue`/`createWorker` factory helpers, email worker, token cleanup cron (`0 3 * * *`), barrel entry point, separate worker process (`npm run worker`), graceful shutdown. Worker process runs separately from the HTTP server — any test that triggers a service which enqueues a job needs `vi.mock('../lib/bullmq.js', ...)`. Cron schedule is defined via top-level `await` inside `tokenCleanup.worker.ts` itself; `worker.ts` only handles DB connect + graceful shutdown.

### Resend
`sendEmail` wrapper pre-filling `from`/`replyTo` from `RESEND_FROM`/`RESEND_REPLY_TO` env vars. Welcome email template via `react-email`, rendered with `@react-email/render`, sent on register via BullMQ job.

### Password Reset
`PasswordResetToken` model (tokenHash as PK, 15 min expiry, `onDelete: Cascade`). `POST /auth/forgot-password` (always 200, enqueues reset link email). `POST /auth/reset-password` (verifies hash, checks expiry, updates password + rotates tokens atomically, deletes token). `PasswordReset` email template. Expired token cleanup in nightly cron. 15 integration tests.

### WebSockets — Socket.io
Modular setup in `lib/socket/`. JWT auth middleware on every connection. Room rule registry (`room.ts`) — per-user room auto-joined on connect, role/feature rooms added via one-line entries. Handler registry (`handlers.ts`) — feature handlers registered via `registerHandler`, applied on connect via `applyHandlers`. Feature handlers live in `events/` folder, imported via barrel `index.ts`. `io` exported as a singleton — import it in any service to push events: `io.to(`user:${userId}`).emit(...)`. Client-controlled room joins go through `handlers.ts` (client emits, server calls `socket.join(...)`). `index.ts` uses an explicit `http.Server` + `initSocket(server)`. `kill-port` added to `predev` so orphaned Windows node processes don't hold the port after Ctrl+C.

### File Uploads — Cloudflare R2
`lib/r2.ts` (S3Client singleton, EU jurisdiction, `uploadFile`/`deleteFile` helpers). `middleware/upload.ts` (multer memory storage, 5MB limit, image/PDF filter). `uploadServices.ts` — `uploadFiles(userId, folder, files)` (multi-file, `Promise.all` + `createMany`), `deleteFile(userId, key)` (404s if the key is missing *or* belongs to another user), `getFilesByFolder(userId, folder)`, `getUserFolders(userId)` (Prisma `distinct: ['folder']` — dedup at DB level, returns `string[]`). Routes: `POST /upload` (`uploadLimiter` → `isAuth` → `upload.array('files', 10)` → `validateBody`), `DELETE /upload/:key`, `GET /upload/folder/:name`, `GET /upload/folders`. `UserFile` model (`key` as PK). New `uploadLimiter` (15 min / 30 req). `errorHandler` maps `MulterError` to clean 400s instead of a generic 500. 24 integration tests (mocks `lib/r2.ts` + `lib/bullmq.ts`). Key structure: `{userId}/{folder}/uuid.ext`; URL is built client-side as `R2_PUBLIC_URL/key` (R2 doesn't return it). Bucket is EU jurisdiction with public access enabled — every uploaded file is publicly accessible by URL. GET routes need no `validateBody` — folder name comes from route param `:name`, not body.

**FE Integration:**
- `DELETE /upload/:key` — always `encodeURIComponent(key)` when building the URL. Keys look like `42/images/<uuid>.png` (contain `/`); without encoding, Express splits them across route segments and 404s. `%2F` keeps it as one param on the wire; Express decodes it back before the controller sees it.
  ```ts
  fetch(`/api/upload/${encodeURIComponent(key)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
  ```
- On success: `204 No Content`, no body — drop the file from local state.
- 404 = key missing or belongs to another user. Both cases return the same response on purpose — do not try to distinguish them.
