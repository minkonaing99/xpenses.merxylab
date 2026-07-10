# xpenses — Architecture

## 1. High-Level Shape
```
[ PWA (React+Vite) ]  --HTTPS/JSON-->  [ Express API (Passenger) ]  -->  [ MySQL ]
        |                                        |
   Service Worker                          node-cron (daily)
   IndexedDB outbox                     recurring auto-insert
```
Single subdomain: `xpenses.merxylab.com`. Frontend served as static build;
API under `/api/*` on the same origin (cookie auth needs same-site).

## 2. Deployment Topology (Hostinger Business shared)
- Backend runs in Hostinger's Node.js App slot, managed by Phusion Passenger.
  - No custom listen port: export the Express `app` (Passenger provides the server).
  - `app.js` entry; `NODE_ENV=production`.
  - No always-on worker process guaranteed — cron runs inside the same app via
    node-cron; the app must stay warm. (Fallback: Hostinger cron job hitting a
    protected `/api/cron/run` endpoint — see SCHEMA.md Plan B.)
- Frontend Vite `dist/` rsynced to the subdomain's public web root.
- MySQL hosted by Hostinger; credentials via env (never in repo).
- `deploy.sh` (SSH): `git pull` + `npm ci --omit=dev` on server for backend;
  local `npm run build` then `rsync dist/` for frontend.

## 3. Backend Structure (organize by feature)
```
server/
  app.js                 # express app, middleware, route mount, export app
  config/env.js          # load + validate env (fail fast)
  db/pool.js             # mysql2 pool
  db/migrate.js          # run SQL migrations in order
  middleware/auth.js     # verify JWT cookie
  middleware/validate.js # zod-based boundary validation
  middleware/error.js    # central error -> API envelope
  features/
    auth/       (routes, service, __tests__)
    accounts/   (routes, repo, service, __tests__)
    categories/ (routes, repo, service, __tests__)
    transactions/(routes, repo, service, sync, __tests__)
    budgets/    (routes, repo, service, __tests__)
    recurring/  (routes, repo, service, cron, __tests__)
    reports/    (routes, service, __tests__)
  lib/money.js           # satang helpers (pure, immutable)
  lib/apiResponse.js     # success/error envelope
  cron/index.js          # schedule recurring job
```

## 4. Frontend Structure (organize by feature)
```
web/src/
  app/        # router, layout, providers
  ui/         # design-token primitives (Button, Card, Chip, Field...)
  theme/      # tokens.ts (from root DESIGN.md), globals.css
  features/
    auth/         (LoginScreen, api, hooks)
    transactions/ (List, Row, TxnForm, api, hooks)
    accounts/     (AccountsScreen, AccountPicker, api)
    categories/   (CategoryPicker chips, api)
    budgets/      (BudgetBanner, BudgetsScreen, api)
    reports/      (CategoryChart, SummaryCards)
    nav/          (BottomTabBar)
  offline/
    db.ts         # dexie schema (outbox + cached tables)
    outbox.ts     # enqueue/replay writes
    sync.ts       # pull + push reconcile
  lib/            money, date, fetchClient (credentials: include)
  sw/             # service worker (vite-plugin-pwa)
```

## 5. Data Flow — Writes (offline-first)
1. UI action -> build txn with client UUID + updated_at (now).
2. Optimistically update local Dexie cache.
3. Enqueue op in Dexie outbox.
4. If online, `sync.push()` sends queued ops; server upserts by UUID.
5. On success, mark op done; on 4xx-validation, mark op failed (surface to user).
6. On reconnect (`online` event / periodic), replay outbox in FIFO order.

## 6. Data Flow — Reads / Pull Sync
- On load/online: `GET /api/sync?since=<updated_at>` returns changed rows.
- Client merges by UUID, last-write-wins on updated_at, hides deleted_at rows.
- Cached in Dexie so cold offline start shows last-known data.

## 7. Sync Reconciliation Rules
- Create: idempotent upsert on primary key = client UUID (`INSERT ... ON
  DUPLICATE KEY UPDATE` guarded by updated_at).
- Update/Delete: apply only if incoming updated_at >= stored updated_at.
- Delete is soft (`deleted_at`) so it propagates through the same LWW path.
- Solo-user assumption removes concurrent-merge complexity by design.
- `updated_at` is stored with whole-second precision (MySQL DATETIME, no
  fractional seconds) — two edits to the same transaction within the same
  second compare as equal, and the guard's `>=` treats equal as "apply," so
  whichever write reaches the server second wins, not necessarily whichever
  the client made later. Accepted: same-second conflicting edits from a
  single solo user are rare enough not to warrant microsecond timestamps.

## 8. Auth Flow
- `POST /api/auth/login {password}` -> bcrypt.compare vs env hash -> set
  httpOnly, Secure, SameSite=Lax cookie with signed JWT (short-ish exp + silent
  re-issue on activity). All `/api/*` (except login) require the cookie.

## 9. Recurring Job
- node-cron daily at a fixed hour (server TZ = Asia/Bangkok).
- Query rules where `active=1 AND next_run_date <= today`.
- For each: insert txn from template, advance next_run_date by interval,
  wrap per-rule in try/catch, log outcome. Idempotency: unique
  (rule_id, run_date) guard row prevents double-insert if job runs twice.

## 10. Technical Goals / NFRs
- Performance: sub-5s add-expense interaction on a phone (client-side only,
  optimistic write — no server round-trip required to feel "done").
- Availability: best-effort on shared hosting; no uptime SLA (solo personal tool).
- Scale: single user, low write volume — no horizontal scaling needed.
- Latency: API responses target <300ms on Hostinger shared MySQL for simple
  CRUD; sync pull bounded by `since` filtering (indexed on updated_at).

## 11. System Constraints
- Hostinger Business shared plan: Node runs only via Passenger App slot (no
  custom port, no guaranteed long-lived background process).
- MySQL version/features limited to what Hostinger shared MySQL supports —
  avoid MySQL 8-only syntax unless confirmed available.
- No dedicated Redis/cache tier available — no caching layer planned for v1.

## 12. Integration Points
- None external in v1 (no bank APIs, no OAuth, no push notification service).
- Hostinger cron (Plan B fallback) is the only "external" trigger, authenticated
  via a shared secret header on `/api/cron/run`.

## 13. Scalability Plan
- Not applicable at solo-user scale. If revisited: vertical scaling on
  Hostinger plan tier, or migrate to a VPS with a persistent Node process
  (removing the Passenger/cron-warmth constraint).

## 14. Deployment Target
- Hostinger Business shared hosting, subdomain `xpenses.merxylab.com`.
- Backend: Node.js App slot (Phusion Passenger managed).
- Frontend: static `dist/` build served from the subdomain web root.
- Database: Hostinger-provided MySQL instance.

## 15. Observability
- Logging: server-side console logs (stdout, captured by Passenger/Hostinger
  logs) for request errors and cron run outcomes.
- Metrics/alerting: none in v1 (no APM budget for a solo personal tool) —
  budget-limit banner in-app is the only "alerting" surface, and it's
  user-facing, not operational.

## 16. Testing Architecture
- Backend: unit (services, money, sync reconciler) + integration (supertest on
  routes against a test MySQL schema / or mysql2 with a disposable test DB).
- Frontend: unit (money/date/reducers, outbox logic) + component (RTL) + E2E
  (Playwright: add txn online, add offline then reconnect, budget banner).

## 17. Key Libraries (rationale)
- **express** — minimal, huge MySQL/Passenger compatibility.
- **mysql2** — promise-based MySQL driver, prepared statements.
- **zod** — schema validation at API boundary.
- **jsonwebtoken + bcrypt** — standard JWT/password hashing pair.
- **node-cron** — in-process scheduling for recurring job (Plan B: external
  Hostinger cron hitting `/api/cron/run`).
- **vite + vite-plugin-pwa** — PWA manifest/service-worker generation, minimal config.
- **dexie** — ergonomic IndexedDB wrapper for the offline outbox/cache.
- **uuid** — client-generated transaction IDs.
- Chart: a small dependency-light approach (e.g. a minimal bar list or a tiny
  lib like `recharts` only if built-in SVG bars prove insufficient) — decide
  at implementation time against actual data density; avoid a heavy charting
  dependency for a single current-month bar breakdown.

---

## Architecture Decision Records

## [2026-07-10] Node.js + Express backend on Hostinger shared hosting
**Status:** Accepted

**Context:** Hostinger Business shared plan is PHP/LiteSpeed-native. Node is
only available via a constrained Node.js App slot (Phusion Passenger managed:
no custom listen port, no guaranteed always-on process). A PHP backend would
be a more natural fit for this host. The user was explicitly told of this
mismatch mid-interview and chose to proceed with Node anyway.

**Decision:** Keep Node.js + Express as the backend, deployed via Hostinger's
Passenger-managed Node.js App slot. Export the Express `app` (no custom
`.listen()`), rely on Passenger for the HTTP server, and run the recurring-txn
cron in-process via `node-cron` with a documented Plan B fallback
(`/api/cron/run` behind a shared secret, triggered by Hostinger's own cron)
in case the app process isn't kept warm reliably.

**Consequences:**
- Positive: single language (JS/TS) across client and server; team/user
  familiarity with the Node ecosystem preserved; zod/Express/mysql2 stack is
  well-documented and simple.
- Negative: in-process cron reliability is not guaranteed on shared hosting —
  mitigated by the Plan B external-cron fallback, which must be kept in sync
  with the primary path (same idempotency guard table covers both).
- Negative: no custom port/process management flexibility Passenger doesn't expose.

---

## Security

- **Auth + authorization**: single shared password (bcrypt hash in env, never
  in code/repo). Login issues a JWT set in an httpOnly, Secure, SameSite=Lax
  cookie. All `/api/*` routes except `/api/auth/login` require a valid cookie,
  enforced by `middleware/auth.js`. No roles/permissions (single owner).
- **Input validation**: every route validates its body/query with zod at the
  boundary before touching the DB or business logic; invalid input returns
  `400 VALIDATION_ERROR` via the shared error envelope, never a raw stack trace.
- **Secret management**: `PASSWORD_HASH`, `JWT_SECRET`, MySQL credentials, and
  the Plan-B cron shared secret all come from environment variables only
  (`config/env.js` fails fast at boot if any required var is missing). Never
  hardcoded, never committed (`.gitignore` excludes `.env*`).
- **Known attack surfaces + mitigations**:
  - Login brute force -> rate-limited via `express-rate-limit` on
    `/api/auth/login`.
  - SQL injection -> `mysql2` parameterized queries only, no string-concatenated SQL.
  - Cookie theft/XSS -> httpOnly cookie (unreadable by JS) + Secure flag
    (HTTPS-only) + SameSite=Lax (limits cross-site send).
  - Cron endpoint abuse (Plan B) -> requires a shared-secret header, not
    public; treat as a second credential to rotate if exposed.
  - Error responses -> central `middleware/error.js` maps all errors to the
    standard envelope, stripping stack traces/SQL details from client responses.
- **Dependency audit process**: run `npm audit` (server + web) before each
  deploy; address CRITICAL/HIGH findings before shipping (see SETUP.md testing
  workflow and PLAN.md Phase 7 hardening task).
