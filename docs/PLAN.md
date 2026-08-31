# xpenses — Implementation Plan + Tasks

## Strategy: Backend-first, then vertical slices
Rationale: the sync contract (UUID upsert + LWW) is the load-bearing design
decision; the offline client is meaningless until the server upsert/reconcile
semantics are proven by tests. So Phase 1-3 lock the API + sync server-side,
then Phase 4+ build the PWA vertically feature-by-feature against a stable API.
Each phase is independently mergeable and testable. TDD (RED -> GREEN -> REFACTOR)
applies to every implementation task; write the failing test first.

---

## Phase 0 — Project Scaffold
**Goal:** Repo skeleton, tooling, and pure helper libs in place, no server/client logic yet.
- [ ] 0.1 Root: `.gitignore` (+ CLAUDE.md), `README.md`, `docs/` (this set).
      (`.gitignore`/`CLAUDE.md`/`docs/` done; `README.md` still missing.)
- [x] 0.2 `server/` npm init: express, mysql2, zod, jsonwebtoken, bcrypt,
      cookie-parser, node-cron, express-rate-limit, uuid, dotenv; dev: jest, supertest.
- [x] 0.3 `web/` npm init: vite + react + TS, react-router; dev: vitest, RTL.
      (vite-plugin-pwa + dexie + Playwright E2E deferred to 4.3/Phase 5 — no
      installability or offline work needed until those phases start.)
- [x] 0.4 `config/env.js` — load + validate required env, fail fast (test first).
- [ ] 0.5 `lib/money.js` — pure satang helpers (add, sub, format THB). TDD.
- [ ] 0.6 `lib/apiResponse.js` — envelope helpers. TDD.
**Deliverables:** installable repo, `npm test` runs green on empty suites, money/envelope libs covered.
**Effort:** TBD. **Risk:** Low. No deploy yet.

## Phase 1 — DB + Auth (server)
**Goal:** Authenticated API skeleton against a real MySQL schema.
- [x] 1.1 `db/pool.js` mysql2 pool from env.
- [x] 1.2 Migrations `001_init.sql`, `002_seed.sql`; `db/migrate.js` runner
      + `schema_migrations`. Applied to local dev DB `xpense`
      (accounts/categories/transactions/budgets/recurring_rules/recurring_runs
      all created, starter accounts+categories seeded). Pure helpers
      (`splitStatements`, `pendingMigrations`) unit-tested; full integration
      test against a disposable test DB still TODO (needs a test-DB strategy,
      not yet decided — see Testing in docs/SETUP.md).
- [x] 1.3 `middleware/auth.js` verify JWT cookie. TDD (valid/expired/missing/
      wrong-secret/malformed, 5/5 tests). `algorithms: ['HS256']` pinned on verify.
- [x] 1.4 `features/auth` login/logout/me: bcrypt.compare vs PASSWORD_HASH env,
      sign JWT (HS256, 7d), set httpOnly Secure(prod) SameSite=Lax cookie,
      rate-limited login (express-rate-limit, 10/15min). Integration tests via
      supertest (8/8, incl. rate-limit trip + full login->me->logout->me flow
      with a real cookie jar). Smoke-tested against the running server with
      curl — full flow confirmed working end to end. `app.js` wired (no
      `.listen()`, Passenger-clean per TECH.md ADR); `dev-server.js` added as
      the local-only listener. code-reviewer pass: 0 CRITICAL, 1 HIGH fixed
      (`trust proxy` unset would've broken the rate limiter behind Hostinger's
      proxy), 2 MEDIUM fixed (JWT algorithm pinning, explicit JSON body-size
      limit). Known gap (deliberate, not a bug): no silent token re-issue on
      activity yet — 7-day flat expiry only, matches docs/SCHEMA.md's stated
      v1 scope.
**Deliverables:** migrations runnable, login/logout/me endpoints pass integration tests.
**Depends on:** Phase 0.

## Phase 2 — Core CRUD (server)
**Goal:** Accounts, categories, transactions fully CRUD-able and validated.
- [x] 2.1 accounts feature: repo (parameterized), service (balance compute:
      `startingBalance - expenseOut + incomeIn - transferOut + transferIn`,
      SQL aggregate JOIN + mysql2 DECIMAL-string coercion), routes + zod
      validation. 18/18 tests (unit + integration against `xpense_test`).
- [x] 2.2 categories feature: CRUD, 409-on-referenced delete (transactions OR
      budgets). 17/17 tests. Found + fixed during review: the original
      `UNIQUE(name)` DB constraint blocked reusing a deleted category's name
      forever — moved to an app-level `findActiveByName` check
      (migration `003_category_name_scoped_unique.sql` drops the DB
      constraint), matching this project's existing app-level-invariant
      convention.
- [x] 2.3 transactions feature: repo/service/routes, per-type validation
      (expense/income/transfer field matrix, 13/13 unit tests), list filters
      (month/type/accountId/categoryId) + keyset-cursor pagination. 24/24
      tests. POST was a simple create (409 on duplicate id) at this phase —
      the idempotent-upsert-with-LWW-guard behavior from docs/SCHEMA.md's
      API table landed in Phase 3.1 (below), which also closed the
      PATCH/DELETE stale-write gap noted here originally.
      Risk: Medium (type-specific field rules) — realized as expected, no
      surprises.
**Deliverables:** full CRUD API for accounts/categories/transactions, covered
by tests. 115/115 server tests passing. Full lifecycle (login -> create
account -> create category -> create expense -> balance reflects it ->
delete) smoke-tested against the real dev DB with curl. code-reviewer pass:
0 CRITICAL, 1 HIGH (correctly identified as the same Phase-3.1-deferred scope
noted above, not a new defect), 3 LOW (2 fixed: category name reuse, cursor
field-type validation; 1 accepted as-is: `.env.test` reuses the real local
dev DB password — low risk, local-machine-only, gitignored, not worth a
second MySQL user for a solo dev setup).
**Depends on:** Phase 1.

## Phase 3 — Sync + Budgets + Recurring (server)
**Goal:** Offline sync contract proven server-side; budgets and recurring logic complete.
- [x] 3.1 transactions upsert-by-UUID guarded by updatedAt. `shouldApply()`
      pure LWW comparator (4 unit tests). `upsert`/`updateGuarded`/
      `softDeleteGuarded` in repo.js return `{status: applied|skipped|not_found,
      row}`. POST is now upsert semantics (201 create / 200 edit-or-skip +
      `meta.syncStatus`); PATCH/DELETE gained the same guard, closing the gap
      flagged in Phase 2's code-reviewer pass. LWW guarantee (create -> stale
      skip -> newer apply -> delete) smoke-tested live against the dev server.
      Risk: High, as expected — no surprises.
- [x] 3.2 `/api/sync` GET (`?since=`, includes tombstones across accounts/
      categories/transactions/budgets/recurringRules) + `/api/sync/push`
      (batch replay, per-op `applied|skipped|error` results via
      `features/sync/ops.js`). Non-transaction entities have no client clock
      to guard on (DB-managed `updated_at`), so idempotent retries of
      create/delete resolve as `applied`, not error — lets a client outbox
      safely replay. Built after 3.3/3.4 (reordered so sync could cover all
      5 entities in one pass instead of twice).
- [x] 3.3 budgets feature: CRUD + monthly spent (SQL aggregate JOIN) +
      `over` flag. Found + fixed proactively: same `UNIQUE(category_id)`
      soft-delete bug as categories' Phase-2 fix — migration 004 drops it,
      app-level `findActiveByCategoryId` enforces it instead (accepted
      TOCTOU race, documented in-code — solo-user app, not fixed).
- [x] 3.4 recurring feature: rule CRUD, reusing transactions'
      `validateTransactionFields` (identical per-type field shape).
- [x] 3.5 recurring cron: `scheduler.js` pure `addInterval`/`planDueRuns`
      (day/week/month math, clamps month-end overflow e.g. Jan 31 + 1mo =
      Feb 28, catch-up for missed cycles) — unit-tested before any DB/cron
      wiring, per the plan. `runner.js` wraps the `(rule_id, run_date)`
      guard-row insert + transaction insert in one atomic DB transaction;
      `next_run_date` only advances after its full run succeeds, so a
      mid-batch failure safely retries next tick. `cron/index.js` schedules
      via node-cron, daily 01:00 Asia/Bangkok, gated to `NODE_ENV=production`
      only (tests/dev never spin up a real background timer). Plan B
      `POST /api/cron/run` behind a constant-time-compared shared secret
      (`lib/safeCompare.js`), not JWT — verified live (rejects missing/wrong
      secret, runs due rules with the correct one). Risk: High, as expected.
- [x] 3.6 reports feature: `category-spend` + `summary` (account balances +
      month income/expense/net).
**Deliverables:** sync endpoints proven under LWW + tombstone tests;
budgets/recurring/reports live. 233/233 server tests passing (parallel and
serial — see Testing note below). code-reviewer pass: 0 CRITICAL, 1 HIGH
(budgets TOCTOU race, documented as accepted risk — mirrors the identical
already-accepted categories pattern), 2 MEDIUM fixed (LWW sub-second
precision documented in docs/TECH.md §7; reports' global-aggregate tests
hardened against cross-file pollution with a collision-free month, not just
masked by `--runInBand`).
**Depends on:** Phase 2.

## Phase 4 — PWA Foundation + Design System (client)
**Goal:** Installable app shell with app-native components on the DESIGN.md tokens, authenticated.
- [x] 4.1 `theme/tokens.ts` from root DESIGN.md + docs/DESIGN.md (colors, type scale, spacing, radii).
- [x] 4.2 `ui/` primitives: Button (pill, scale(0.95) press), Panel (lg radius,
      single-shadow discipline), Chip, AmountInput, Banner, EmptyState, ProgressBar,
      Skeleton, BottomTabBar, TxnRow. Component tests (Vitest + RTL).
      Design source: design-bakeoff winner "Quiet Card System" (Variant B —
      one flat elevated panel per screen, grouped rows, VARIANCE 5/MOTION 3/DENSITY 3).
      Transactions/Budgets/Reports/Settings screens built with in-memory mock
      data (no API yet — Phase 1-3 not started). Icon set resolved to Phosphor
      (`@phosphor-icons/react`), closing the "TBD" in docs/DESIGN.md.
- [x] 4.3 vite-plugin-pwa: manifest + service worker (app-shell precache,
      runtime cache for GET /api reads, `/api/auth/*` excluded). Verified via
      `npm run build`: generates `dist/manifest.webmanifest` + `dist/sw.js` +
      workbox runtime. Icons generated with ImageMagick (192/512/maskable-512,
      no external asset-generator dependency). Vite dev proxy (`/api` ->
      `localhost:3001`) added for local dev.
- [x] 4.4 `lib/fetchClient` (credentials: include, unwraps `{ok,data,error}`
      envelope, throws `ApiClientError`) + `features/auth/` (`api.ts`,
      `LoginScreen.tsx` + route guard `RequireAuth` in `App.tsx`). Component
      tests (Vitest + RTL) for fetchClient, auth api, LoginScreen, and the
      route guard's authed/unauthed/error paths. E2E (Playwright) deferred —
      no Playwright harness exists yet in `web/` (introduce with Phase 5/6
      E2E work per docs/SETUP.md, not a blocker for this phase's Done
      Criteria which only requires the login flow work, proven here via
      component tests + a live curl smoke test through the Vite proxy).
**Deliverables:** installable PWA shell, login flow works end-to-end against Phase 1 API.
**Depends on:** Phase 1 (API), independent of Phase 2/3 internals.

## Phase 5 — Offline Engine (client)
**Goal:** Offline writes queue and reconcile correctly against the server sync contract.
- [x] 5.1 `offline/db.ts` Dexie schema: cached accounts/categories/transactions/
      budgets/recurringRules tables (mirroring server rows 1:1) + `outbox`
      queue table (`entity`, `action`, `payload`, `createdAt`, `status`) +
      `meta` key/value table (`lastSyncedAt` cursor). `fake-indexeddb`
      installed as a dev dep so Dexie is unit-testable under Vitest/jsdom.
      Unit tests (4/4).
- [x] 5.2 `offline/outbox.ts` `enqueue`/`getPendingOps` (FIFO by `createdAt`)/
      `markOpDone` (deletes — a done op carries no further information)/
      `markOpFailed` (keeps the row, flips status, for later inspection).
      TDD (4/4).
- [x] 5.3 `offline/sync.ts` `pull()` (GET `/api/sync?since=`, merges into the
      Dexie cache via `shouldApplyToCache()` — a direct mirror of the
      server's `shouldApply()` LWW comparator, so a pull never clobbers a
      locally-newer row still sitting unsent in the outbox) + `push()`
      (POST `/api/sync/push`, one batch call per replay, marks each op
      done/failed from the per-op result). Tombstones (`deletedAt` set) flow
      through the same merge path as edits, per docs/TECH.md §7. Unit tests
      on the merge/LWW logic (18/18) plus a real end-to-end integration
      check against the live running server (see below) — the plan's
      "High — mirrors server reconcile; test both sides agree" risk was
      taken seriously: no Playwright harness exists yet (see Phase 4.4
      note), so verification used a one-off `tsx` script exercising the
      real `offline/db.ts`/`outbox.ts`/`sync.ts` modules against the live
      dev server (login -> enqueue offline create -> push -> confirmed via
      GET /api/accounts that the server has it -> pull -> confirmed it's
      back in the local Dexie cache), then a second script specifically
      confirming the `lastSyncedAt` cursor round-trips through the server's
      strict `zod.datetime()` validation on a second pull. Both scripts
      deleted after use (not part of the permanent suite).
      `code-reviewer` pass found real correctness bugs in the first draft,
      all fixed — see docs/SETUP.md changelog for detail (cursor race,
      missing transaction atomicity, `skipped`-result handling, no
      concurrent pull/push guard, no `results.length` sanity check).
**Deliverables:** outbox + sync engine verified against Phase 3 server contract.
**Depends on:** Phase 3, Phase 4.

## Phase 6 — Vertical Feature Slices (client)
**Goal:** All user-facing screens complete, wired to offline engine.
- [x] 6.0 Foundation (added, not in original plan — required by every other
      sub-phase): `dexie-react-hooks` installed; `offline/hooks.ts`
      (useAccounts/useCategories/useTransactions/useBudgets/
      useRecurringRules/useOutboxStatus, all `useLiveQuery`-based reactive
      reads); `offline/mutations.ts` (generic `applyWrite`: cache write +
      outbox enqueue in one Dexie transaction, then fire-and-forget
      `push()`; per-entity create/update/delete wrappers for all 5
      entities); `offline/SyncBoot.tsx` (gates the app on one initial
      `pull()`, registers `online`-event + 5-minute interval sync triggers,
      never blocks on network failure — offline-first). Wired into
      `App.tsx` between `RequireAuth` and `Layout`.
- [x] 6.3 Categories: `CategoryPicker` (reusable chips, `excludeIds` support
      added later for Budgets) + `CategoriesScreen` (manage list, inline
      add/edit/delete, blocks deleting a category still referenced by
      transactions with a warning banner naming the count). Reached from
      Settings (not a new bottom tab — user confirmed this placement).
- [x] 6.2 Accounts: `AccountPicker` (reusable, icon by account type,
      `exclude` support for transfer from/to) + `AccountsScreen` (balance
      rows — not card-grid, per DESIGN.md's "one flat panel, grouped rows"
      direction — + CRUD, same reference-guard pattern as Categories).
- [x] 6.1 Transactions: `TransactionsScreen` rewired off `useTransactions()`;
      `AddTransactionSheet` rewritten as add+edit+delete (type toggle,
      `AccountPicker`/`CategoryPicker`, transfer from/to, client-side
      `validateTransactionFields` mirroring the server's per-type
      invariants, plus a stale-selection guard disabling Save if the
      selected account/category was soft-deleted mid-session).
      `txnMapping.ts` (pure `calculateNet`/`formatTxnDate`/`iconForTxn`/
      `toTxnRowProps`). `mockTransactions.ts` deleted. Verified live against
      the real server: full offline-create -> reconnect -> push -> server
      confirms it, via a one-off `tsx` script (no Playwright harness —
      deferred to Phase 7, confirmed with user).
- [x] 6.4 Budgets: `BudgetsScreen` rewired — cached budget rows for
      identity/CRUD, live `spent`/`over` from `GET /api/budgets?month=`
      (a server aggregate, not mirrored to the offline cache) refetched on
      every local budget write AND on a 30s poll (a local-write-only
      refetch left `spent`/`over` stale indefinitely between budget edits,
      since adding/editing/deleting a *transaction* never touches the
      `budgets` table and thus never re-triggered the old effect —
      code-reviewer HIGH, fixed). `BudgetBanner` extracted. Edit-in-place
      gained a Cancel button (code-reviewer MEDIUM — user could get stuck
      mid-edit with no way back). `mockBudgets.ts` deleted.
- [x] 6.5 Recurring: net-new `RecurringForm` (create-only, reuses
      `AccountPicker`/`CategoryPicker`/type-toggle/`validateTransactionFields`
      from 6.1) + `RecurringScreen` (list, pause/resume, delete). `nextRunDate`
      gained a `min` guard rejecting past dates — the server's catch-up
      scheduler generates one real transaction per missed occurrence on the
      next cron tick, so a backdated date could flood the account
      (code-reviewer HIGH, fixed). Resuming a rule whose `nextRunDate` has
      drifted into the past now advances it to the first scheduled occurrence
      on or after Bangkok today, preserving its cadence without generating
      missed transactions. REST PATCH and sync push enforce the same rule.
      Reached from Settings.
- [x] 6.6 Reports: `ReportsScreen` rewired off `GET /api/reports/category-spend`
      + `GET /api/reports/summary` (both server aggregates — Reports has
      no Dexie reads at all, deliberately online-authoritative).
      `SummaryCards` + `CategoryChart` extracted (bars via the existing
      `ProgressBar` primitive, no charting dependency). `mockReport.ts`
      deleted. code-reviewer: clean, 0 findings beyond one LOW (`ProgressBar`
      could render `NaN%` if `max` were ever 0 — fixed with a guard).
- [x] **Post-implementation UI walkthrough** (Claude-in-Chrome, requested by
      user): found and fixed 2 real bugs invisible to the test suite because
      they only manifest against live server data — (1) `GET /api/sync`'s
      `findChangedSince` for accounts was a plain `SELECT *`, missing the
      computed `balance` field entirely (only `startingBalance`) — every
      account synced via `pull()` showed `฿NaN` forever, since a pull only
      re-fetches rows whose `updated_at` changes again, and a quiet
      account's tombstone/row rarely does. Fixed server-side
      (`accounts/repo.js`'s `findChangedSince` now runs the same
      expense/income/transfer-sum joins as `findAllWithSums`; the sync
      router now maps accounts through `mapAccountRow` instead of plain
      `rowToCamel`), with new regression tests at both the repo and router
      level. (2) `AmountInput` was designed once for `AddTransactionSheet`'s
      full-screen borderless hero amount display, then reused as-is in
      `AccountsScreen`/`BudgetsScreen`'s inline forms, where it looked
      broken/unstyled next to the bordered text inputs around it — added a
      `variant: 'hero' | 'field'` prop.
**Deliverables:** feature-complete app per PRD.md Success Criteria.
**Depends on:** Phase 5.

## Phase 7 — Deploy + Hardening
**Goal:** Live on xpenses.merxylab.com, secured, tested to coverage target.
- [x] 7.1 `server/app.js` exports app for Passenger (no hardcoded port);
      Plan B `/api/cron/run` behind shared secret (documented). Confirmed
      already satisfied during Phase 7 — app exports with no `.listen()`,
      cron gated to production, `/api/cron` behind the shared-secret compare.
- [ ] 7.2 `deploy.sh` (SSH): backend git pull + `npm ci --omit=dev` + restart
      Passenger; frontend `npm run build` + rsync `dist/`. **Deferred** (user
      chose to skip deploy.sh this pass).
- [x] 7.3 security-reviewer pass: 0 CRITICAL / 0 HIGH. Fixed 1 MEDIUM
      (`/api/sync/push` bypassed per-entity zod validation — now validates
      against the same schemas the REST routes use) + 1 LOW (CSV formula-
      injection guard); 1 LOW accepted (`safeCompare` length-timing, standard
      pattern, random secret). Detail in docs/SETUP.md changelog.
- [x] 7.4 Coverage gate: server 88% stmts/lines, web 86% stmts — both > 80%.
- [x] 7.5 `docs/SETUP.md` changelog Phase 7 entry (Security subsection).
**Deliverables:** deployed, reviewed, tested v1 live at the domain.
**Depends on:** Phase 6.

## Cross-Cutting Definition of Done (every task)
- Failing test written first; implementation makes it pass; refactor.
- Files 200-400 lines, functions <50 lines, immutable data.
- Inputs validated at boundary; no hardcoded secrets.
- code-reviewer run; CRITICAL + HIGH fixed.

## Milestone Table
| Milestone | Description | Target Date | Status |
|---|---|---|---|
| M0 — Scaffold | Phase 0 complete | TBD | Not started |
| M1 — API core | Phases 1-3 complete, sync contract proven | TBD | Complete |
| M2 — PWA shell | Phase 4 complete, installable + login works | TBD | Complete |
| M3 — Offline-capable | Phase 5 complete | TBD | Complete |
| M4 — Feature complete | Phase 6 complete, matches PRD.md Success Criteria | TBD | Complete |
| M5 — Live | Phase 7 complete, deployed to xpenses.merxylab.com | TBD | Not started |

## Dependencies Map
- Phase 0 blocks everything.
- Phase 1 blocks Phase 2, Phase 4.
- Phase 2 blocks Phase 3.
- Phase 3 + Phase 4 block Phase 5.
- Phase 5 blocks Phase 6.
- Phase 6 blocks Phase 7.

## Risks + Mitigations
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Passenger doesn't keep node-cron warm on Hostinger shared hosting | Medium | High (recurring txns silently stop) | Plan B `/api/cron/run` external-cron fallback (TECH.md §2, §9), same idempotency guard covers both paths. |
| Client/server LWW reconcile logic diverges (edge case in updated_at comparison) | Medium | High (data loss/duplication) | Server-side sync tests (Phase 3.1/3.2) written before client sync (Phase 5.3); Phase 5.3 explicitly re-tests both sides agree. |
| MySQL version on Hostinger shared plan lacks an assumed feature | Low | Medium | Avoid MySQL 8-only syntax; app-level invariants instead of DB CHECK constraints (SCHEMA.md). |
| Scope creep beyond v1 (multi-currency, push notifications, etc.) | Low | Medium | PRD.md Non-Goals is the explicit guardrail; re-confirm with user before adding. |
| Design tokens misapplied as literal marketing components | Low | Low | DESIGN.md explicitly states tokens-only, app-native components (already resolved via user decision). |

## Done Criteria (per phase)
Each phase is "done" when: all its checklist tasks are checked, its tests pass
at 80%+ coverage for the code it touches, and code-reviewer has been run with
CRITICAL/HIGH findings fixed. Phase 7 is additionally done only after
security-reviewer passes and the app is reachable at `xpenses.merxylab.com`.

---

## Current Tasks

Keep updated. Claude reads this before starting work.

### In Progress
- None. Phase 7 hardening done (7.1 confirmed, 7.3 security pass, 7.4 coverage
  gate, 7.5 changelog). Only 7.2 `deploy.sh` remains, deliberately deferred by
  the user.

### Done — Phase 8 (Insights) + Phase 9 (MCP)
- **Phase 8** — `features/insights/` + `/api/insights` (forecast, anomalies,
  comparisons). Recurring-aware month-end forecast; anomaly flags (budget burn,
  category velocity, duplicates); per-category MoM comparisons. Web: dashboard
  forecast + dismissible anomaly cards, reports trend chips. TDD throughout
  (service pure-math + repo SQL + router), 96% feature coverage.
- **Phase 9** — `mcp/` stdio MCP server (read tools + `create_expense`). Added
  optional `API_TOKEN` bearer auth to `middleware/auth.js` (constant-time,
  alongside JWT cookie) + `config/env.js` 24-char floor. Docs: `docs/MCP.md`.
- Tests after both phases: 286 server / 76 web passing, `mcp/test.mjs` green.

### Backlog
- Phase 0 — 0.1 (README.md still missing), 0.5 (`lib/money.js` on the
  server — note `web/src/lib/money.ts` already exists client-side).
- Phase 7 (deploy + hardening).
- Playwright E2E harness for `web/` (deferred from 4.4/6.x; every E2E-shaped
  requirement across Phases 4-6 was instead covered by component tests +
  one-off live `tsx` scripts against the real dev server — a consistent,
  deliberate substitution, not a gap. Introduce Playwright at Phase 7 if the
  deploy/hardening phase's Definition of Done actually requires it).
- Offline engine: no retry/backoff or requeue path for `'failed'` outbox
  ops (they sit inert; Phase 6 added a Settings-screen banner surfacing the
  failed count via `useOutboxStatus`, but there's still no way to retry or
  discard one); no differentiation between transient (`SERVER_ERROR`) and
  terminal (`VALIDATION_ERROR`, `NOT_FOUND`) push error codes. See
  docs/SETUP.md Known gaps.
- Recurring rules referencing a since-deleted account/category have no
  "broken reference" warning in `RecurringScreen` (the list falls back to
  `'Uncategorized'`/`'?'` gracefully, but nothing prompts the user to fix
  or pause the rule) — flagged by code-reviewer as MEDIUM, not fixed this
  phase (needs product input on the right UX, not a mechanical fix).
- Generated recurring transactions have no back-reference to the rule that
  created them (no `recurringRuleId` on the transaction row/schema) —
  code-reviewer MEDIUM, needs a schema/API change, out of scope for a
  client-only phase.

### Done
- Product/architecture/schema/API planning (PRD.md, TECH.md, SCHEMA.md).
- Design token install + app-native design brief (DESIGN.md).
- design-bakeoff: 2-variant bake-off ("Restrained Instrument" vs "Quiet Card
  System"), user picked Variant B. Winner ported to `web/` (Vite+React+TS).
- Phase 0.3 — `web/` scaffold (Vite+React+TS, react-router, Vitest+RTL).
- Phase 4.1/4.2 — tokens.ts, ui/ primitives, Transactions/Budgets/Reports/
  Settings screens on mock data. 38/38 tests passing, build clean,
  code-reviewer pass complete (2 HIGH + 1 MEDIUM findings fixed).
- Phase 0.2/0.4 — `server/` scaffold (Express, mysql2, zod, jsonwebtoken,
  bcrypt, cookie-parser, node-cron, express-rate-limit, uuid, dotenv; dev:
  jest, supertest); `config/env.js` fail-fast validator, TDD, 11/11 tests.
- Phase 1.1/1.2 — `db/pool.js`, migrations (`001_init.sql`/`002_seed.sql`) +
  `db/migrate.js` runner. Applied to local dev MySQL DB `xpense`: 7 tables
  created, starter accounts (Cash/Bank) + 10 categories seeded. 16/16 server
  tests passing, code-reviewer pass complete (0 CRITICAL, 1 HIGH reviewed and
  rejected as a false positive — `transactions.updated_at` having no DB
  default is intentional per docs/SCHEMA.md's client-supplied LWW design).
- Phase 0.6 (prereq) — `lib/apiResponse.js` envelope + `ApiError` helpers, TDD.
- `middleware/error.js` — central error -> envelope mapper, never leaks
  stack/SQL detail to the client.
- Phase 1.3/1.4 — full JWT-cookie auth: `middleware/auth.js`,
  `features/auth/{service,router}.js`, `app.js`, `dev-server.js`. 42/42
  server tests passing, code-reviewer pass complete (1 HIGH + 2 MEDIUM
  fixed: `trust proxy` for the rate limiter, JWT algorithm pinning, JSON
  body-size limit). Full login->me->logout->me flow smoke-tested against
  the running server with curl.
- Disposable test DB `xpense_test` created + migrated, `server/.env.test` +
  `jest.setup.js` wired so integration tests never touch the dev DB `xpense`.
- Phase 2.1/2.2/2.3 — accounts/categories/transactions CRUD. `lib/caseMap.js`
  (snake_case->camelCase row mapping) + `lib/mysqlDate.js` (ISO8601->MySQL
  DATETIME) added as shared helpers. `db/pool.js` gained `dateStrings: true`
  (avoids timezone day-shift bugs on DATE columns). 115/115 server tests
  passing. Full lifecycle smoke-tested against the real dev DB with curl.
  code-reviewer pass complete (0 CRITICAL, 1 HIGH correctly identified as
  Phase-3.1-deferred scope not a new bug, 2 of 3 LOW fixed).
- Phase 3.1 — transactions LWW-guarded upsert/update/delete (`shouldApply`,
  `upsert`/`updateGuarded`/`softDeleteGuarded`), POST now upsert semantics.
- Phase 3.2 — `/api/sync` GET (since, incl. tombstones) + `/api/sync/push`
  (batch replay, per-op results). Built after 3.3/3.4 so it could cover all
  5 entities in one pass.
- Phase 3.3 — budgets CRUD + monthly spent + `over` flag. Migration 004
  fixed the same soft-delete/UNIQUE bug pattern as categories (Phase 2),
  proactively this time.
- Phase 3.4 — recurring rule CRUD, reusing transactions' type-validation.
- Phase 3.5 — recurring cron: pure `scheduler.js` (day/week/month math,
  month-end clamping, catch-up), atomic `runner.js` idempotency guard,
  node-cron wired to production only, Plan B `/api/cron/run` behind a
  constant-time-compared shared secret.
- Phase 3.6 — reports (category-spend, summary).
- Phase 3 wrap: 233/233 server tests passing (parallel and serial).
  code-reviewer pass: 0 CRITICAL, 1 HIGH (budgets TOCTOU race, documented
  as an accepted risk — solo-user app), 2 MEDIUM fixed (LWW sub-second
  precision documented in docs/TECH.md §7; reports' global-aggregate tests
  hardened with a collision-free month instead of relying solely on
  `jest --runInBand`, which was also kept as defense-in-depth).

- Phase 4.3/4.4 — vite-plugin-pwa (manifest + SW, installable per `npm run
  build` output), `lib/fetchClient` + `features/auth/` (api.ts, LoginScreen,
  `RequireAuth` route guard in `App.tsx`). 53/53 web tests passing (up from
  38), typecheck clean, build clean. Live-smoke-tested end to end through
  the real Vite dev proxy with curl (401 with no cookie -> login sets cookie
  -> 200 authenticated with cookie), since no Chrome extension was available
  for an in-browser check this session. `code-reviewer` pass: 0 CRITICAL,
  1 HIGH fixed (workbox `NetworkFirst` runtime cache was matching
  `/api/auth/*`, risking stale/cached session-check responses surviving
  logout in Cache Storage — excluded `/api/auth/*` from the cache pattern
  and added a `caches.delete('api-get-cache')` call to `logout()`),
  2 MEDIUM fixed (route guard collapsed real 401s and network/offline
  failures into the same "redirect to login" behavior — now only a genuine
  401 `ApiClientError` triggers the redirect, other failures show a
  non-redirecting error banner instead; added an unmount-cancellation guard
  on the guard's `me()` effect), 1 LOW fixed (login button no longer
  enables for a whitespace-only password).

- Phase 5.1/5.2/5.3 — offline engine: `offline/db.ts` (Dexie cache tables +
  outbox + meta cursor), `offline/outbox.ts` (enqueue/FIFO/status),
  `offline/sync.ts` (`pull()`/`push()`, LWW merge mirroring the server's
  `shouldApply()`). 79/79 web tests passing (up from 53), typecheck clean.
  Verified end to end against the live running server via one-off `tsx`
  scripts (no Playwright harness yet) — full round trip (offline enqueue ->
  push -> server has it -> pull -> back in local cache) and a dedicated
  second check confirming the `lastSyncedAt` cursor round-trips through the
  server's strict ISO `zod.datetime()` validation. `code-reviewer` pass:
  0 CRITICAL, 3 HIGH fixed (a `'skipped'` push result was silently treated
  identically to `'applied'` with no distinguishing comment/intent — now
  explicit, and confirmed correct since resubmitting a stale-LWW op can
  never succeed; the `lastSyncedAt` cursor was captured from the client
  clock *before* the round trip, which combined with whole-second DB
  precision could permanently skip a row that changed mid-request — now
  derived from the actual max `updatedAt` observed in the merged rows
  instead; no Dexie transaction wrapped the multi-table merge or the
  outbox status updates, so a crash mid-loop could leave the cache and the
  `lastSyncedAt` cursor pointing past rows that were never actually
  written — now wrapped in `db.transaction('rw', ...)`, with the network
  `fetch` kept outside the transaction to avoid Dexie's
  `TransactionInactiveError`), 3 MEDIUM (2 fixed: added a per-db-instance
  lock so an `online` event and a periodic timer can't run `pull()`/
  `push()` concurrently and double-submit or race the cursor; added a
  `results.length !== pending.length` guard before applying any outbox
  status changes; 1 accepted as an intentional Phase 6 deferral — failed
  outbox ops have no retry/backoff/requeue path yet, logged in Known gaps),
  1 LOW fixed (folded into the results-length guard above).

- Phase 6 — all six screens wired off mock data onto the real API + offline
  engine, per docs/PLAN.md Phase 6 section above (full detail there; not
  duplicated here). Headline numbers: 185/185 web tests passing (up from
  53 at the end of Phase 4), 236/236 server tests passing (up from 233 —
  3 new regression tests for the balance-sync bug found during manual UI
  review), typecheck clean, build clean, both stable across repeated runs.
  Every sub-phase got its own `code-reviewer` pass; every actionable
  finding was fixed (see the Phase 6 checklist above for specifics) except
  two genuinely out-of-scope items logged in Backlog (broken-reference
  warning UX, recurring-rule-to-transaction back-reference schema change).
  After the phase's automated work was done, walked the live app in a
  real browser (Claude-in-Chrome) at the user's request and found two bugs
  invisible to the test suite (both required real synced server data to
  surface): the account-balance `฿NaN` sync bug and the unstyled
  `AmountInput` reuse — both fixed, tested, and re-verified live in-browser.

**Current status pointer (updated 2026-07-11):** the web frontend was
**rebuilt from scratch** with a leaner React-Query architecture, replacing the
Phase-6 custom offline-engine build described above. Current frontend is
authoritative in `docs/WEB.md`; the Phase 6 notes are retained as history of
the prior approach. Feature parity holds: all six screens + login run against
the real server. Production-readiness done this session:
- `PASSWORD_HASH` set to a real bcrypt hash (cost 12); old placeholder rejected.
- Same-origin serving: web builds into `server/public/`, `app.js` serves it
  with SPA fallback in production (first-party cookie, no CORS).
- Auth cookie confirmed `Secure` in production (HTTPS via Hostinger TLS).
- Offline sync via React Query persistence (offline reads + resumable writes).
- 54 web tests (~85% cov) + 236 server tests passing.

Remaining Phase 7: `deploy.sh` (build web -> rsync `server/` -> restart
Passenger), security-reviewer pass, optional optimistic-UI + `/api/sync`
bidirectional pull (only if multi-device), and Backlog items above.
