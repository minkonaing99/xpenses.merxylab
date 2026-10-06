# xpenses — Product Requirements Document

## 1. Summary
xpenses is a single-user THB expense tracker: an Express + MySQL API, an
installable offline-capable PWA, and a local MCP server so Claude can log and
query spending by conversation. It tracks self-defined accounts, per-category
monthly budgets, recurring transactions, planned purchases, savings pots, and
balance reconciliation.

**Problem:** keeping an accurate, trusted picture of personal cash and bank
money with minimal logging effort.

## 2. Goals
- Frictionless data entry: an expense create round-trips in under 5 seconds.
- Accurate money math (integer satang, no float rounding).
- Clear month-at-a-glance: balances, category spend, budget status.
- Logging by conversation: a day's expenses logged through MCP in one exchange.
- Balances that match reality: reconciliation finds and records drift.

## 3. Non-Goals
- Multi-user / registration / OAuth.
- Multi-currency or currency conversion.
- Push notifications.
- Client-side recurring catch-up logic.
- Bank/API import, statement matching, receipt OCR.
- AI-generated financial advice or scores.

Deferred ideas (not commitments) live in [future plan.md](future%20plan.md).

## 4. Users
Solo owner, authenticated by a single shared password. No roles, no sharing.

## 5. Functional Requirements

### 5.1 Auth
- FR-A1: One password (bcrypt hash in env). Login returns a JWT in an httpOnly cookie.
- FR-A2: All data endpoints require a valid JWT cookie.
- FR-A3: Logout clears the cookie.

### 5.2 Accounts
- FR-AC1: CRUD accounts (name, type, starting_balance in satang).
- FR-AC2: Seed "Cash" and "Bank" on first run; both editable/removable.
- FR-AC3: Account current balance = starting_balance + sum of signed txn effects.
- FR-AC4: Deleting an account with transactions is blocked (soft guard, 409).

### 5.3 Categories
- FR-CT1: CRUD categories. Ship a predefined starter list.
- FR-CT2: Each expense references exactly one category.
- FR-CT3: Deleting a category referenced by transactions is blocked (409).

### 5.4 Transactions
- FR-TX1: Three types — expense, income, transfer.
- FR-TX2: Fields: id (client UUID), type, amount (satang, int > 0), note,
  category_id (expense only), account_id (expense/income),
  from_account_id + to_account_id (transfer only), txn_date, created_at,
  updated_at, deleted_at (soft delete).
- FR-TX3: Full CRUD. Creates are append-only by UUID (idempotent on conflict).
- FR-TX4: Edits/deletes reconcile last-write-wins by updated_at.
- FR-TX5: List with filters: month, type, account, category.

### 5.5 Budgets
- FR-BG1: Per-category monthly limit (satang). One active limit per category.
- FR-BG2: Compute spent-vs-limit for the current month per category.
- FR-BG3: When a category's month spend >= limit, the budgets response flags it as over.

### 5.6 Recurring
- FR-RC1: Rules define a template txn + schedule (interval + next_run_date).
- FR-RC2: A server cron runs daily, inserts due transactions, advances next_run_date.
- FR-RC3: Inserted txns carry a server-generated UUID and are normal transactions.
- FR-RC4: Rule CRUD (create/pause/delete).

### 5.7 Reporting + Insights
- FR-RP1: Month spend by category, drill-down into a filtered Ledger.
- FR-RP2: Balance summary per account + net total; month-over-month deltas.
- FR-RP3: Daily-spend calendar heatmap.
- FR-RP4: CSV/JSON export for a month or date range.
- FR-IN1: Recurring-aware month-end forecast (API/MCP).
- FR-IN2: Anomaly flags (budget burn, category velocity) as dismissible cards.
- FR-IN3: Per-category comparison vs last month and trailing 3-month average.

### 5.8 Planned Purchases
- FR-PL1: Plan a purchase with price, account, category, and a 0-30 day wait.
- FR-PL2: Plans reserve their amount in account and budget forecasts.
- FR-PL3: Confirming after the wait creates the expense; deleting drops the plan.
- FR-PL4: Confirmed purchases take a reflection (worth it / regret / not sure + note).

### 5.9 Savings Pots
- FR-SP1: Reserve existing account money for named goals without moving it.
- FR-SP2: Allocate/release history; pot-funded expenses consume the reserve atomically.
- FR-SP3: Archive only at zero reserve.

### 5.10 Balance Reconciliation
- FR-BC1: Compare a real balance with the tracked one; matched checks are immutable snapshots.
- FR-BC2: Mismatches are fixed with a noted, immutable adjustment transaction.
- FR-BC3: Warn when an account's last check is stale.

### 5.11 MCP Access
- FR-MCP1: Local stdio MCP server with bearer-token API access on a route allowlist.
- FR-MCP2: Read, create, edit, and soft-delete transactions; recurring and plan tools.
- FR-MCP3: Every write takes a `request_id` so retries never apply twice.

## 6. Non-Functional Requirements
- NFR-1: Money stored/transported as integer satang; never floats.
- NFR-2: All API inputs validated at the boundary; parameterized SQL only.
- NFR-3: No hardcoded secrets; config via env.
- NFR-4: 80%+ test coverage; TDD.
- NFR-5: Runs under Hostinger Passenger Node slot (no long-lived custom port).

## 7. Success Criteria
- [x] Add/edit/delete expense, income, transfer via API, PWA, and MCP.
- [x] Budgets response flags a category as over at or above its monthly limit.
- [x] Recurring cron inserts due txns exactly once per due date.
- [x] Category report renders from real data.
- [x] Deployed to `xpenses.merxylab.com` (git-based deploy).
- [ ] Every account reconciled against its real balance at least monthly.

## 8. Auth Gating
- Public: `/api/auth/login`, `/api/auth/logout`, static PWA assets.
- All other routes require a valid JWT cookie; 401 on missing/expired session.
- Bearer `API_TOKEN` (MCP) reaches only allowlisted routes; others return 403.
- `/api/cron/run` uses its own shared-secret header.

---

## 9. App Flow

### Entry points
- PWA launch or `https://xpenses.merxylab.com` -> login screen if no session.
- Claude conversation -> MCP tools (no UI).
- Hostinger cron -> `/api/cron/run` (Plan B).

### Navigation
- Phone/iPad portrait: bottom tabs Home, Ledger, + (Add), Reports, Plans.
- iPad landscape/desktop: same items in a sidebar.
- Settings hub: Accounts, Categories, Budgets, Recurring, Savings pots, Export.

### Core flows
1. **Log an expense (PWA):** + (or `n`) -> amount -> category/account (or a
   favorite template) -> Save. Offline: write queues and replays on reconnect.
2. **Log by conversation (MCP):** describe the day -> Claude resolves
   names -> `create_transactions` -> response shows resolved names and the
   touched budgets.
3. **Review a month:** Home (balances, budgets, insight cards) -> Reports
   (category split, heatmap, comparisons) -> drill into Ledger filters.
4. **Plan a purchase:** Plans -> new plan with wait days -> after the wait,
   confirm (creates the expense) or delete -> reflect later.
5. **Reconcile an account:** Settings -> Accounts -> balance check -> enter the
   real balance -> match, or record a noted adjustment.

### Screen states
- Loading: inline notes (Savings pots uses a skeleton).
- Error: `role="alert"` message, retry by refetch.
- Empty: per-screen empty states (e.g. Ledger "No transactions yet").
- Offline: last cached data renders; the sync banner shows queued, sending,
  and failed writes.

### Edge cases
- Expired session: 401 -> login; unresolved queued writes warn before sign-out.
- Unsaved form: closing a sheet asks before discarding.
- Validation conflict on a queued write: banner links back to its editor.
- MCP retry after timeout: same `request_id` replays instead of duplicating.
