# xpenses — Product Requirements Document

## 1. Summary
xpenses is a single-user, mobile-first, installable PWA expense tracker for one
person tracking THB spending across self-defined accounts. It works offline,
syncs writes when back online, enforces per-category monthly budgets with an
in-app banner, and auto-inserts recurring transactions via a server cron.

## 2. Goals
- Frictionless data entry: add an expense in under 5 seconds on a phone.
- Reliable offline capture; nothing is lost when the network drops.
- Accurate money math (integer satang, no float rounding).
- Clear month-at-a-glance: balances, category spend, budget status.

## 3. Non-Goals (explicitly out of scope for V1)
- Multi-user / registration / OAuth.
- Multi-currency or currency conversion.
- Push notifications (no VAPID / SW push).
- Client-side recurring catch-up logic.
- Bank/API import, receipt OCR, analytics beyond current-month category spend.

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
- FR-BG3: When a category's month spend >= limit, surface an in-app banner/badge.

### 5.6 Recurring
- FR-RC1: Rules define a template txn + schedule (interval + next_run_date).
- FR-RC2: A server cron runs daily, inserts due transactions, advances next_run_date.
- FR-RC3: Inserted txns carry a server-generated UUID and are normal transactions.
- FR-RC4: Rule CRUD (create/pause/delete).

### 5.7 Reporting
- FR-RP1: Current-month spend by category (list + simple bar chart).
- FR-RP2: Balance summary card per account + net total.

## 6. Offline / Sync Requirements
- FR-OF1: App shell + last-synced data available offline (service worker cache).
- FR-OF2: Writes made offline queue in an IndexedDB outbox and replay in order on reconnect.
- FR-OF3: Client generates UUIDs for all txns so offline creates never collide.
- FR-OF4: Sync is last-write-wins by updated_at (solo user, no merge UI).

## 7. Non-Functional Requirements
- NFR-1: Mobile-first; installable to homescreen; 44px min touch targets.
- NFR-2: Money stored/transported as integer satang; formatted to THB in UI only.
- NFR-3: All API inputs validated at the boundary; parameterized SQL only.
- NFR-4: No hardcoded secrets; config via env.
- NFR-5: 80%+ test coverage; TDD.
- NFR-6: Runs under Hostinger Passenger Node slot (no long-lived custom port).

## 8. Success Criteria
- [ ] Add/edit/delete expense, income, transfer — online and offline.
- [ ] Offline writes replay correctly and balances reconcile.
- [ ] Budgets banner appears when a category exceeds its monthly limit.
- [ ] Recurring cron inserts due txns exactly once per due date.
- [ ] Current-month category chart renders from real data.
- [ ] Installs as PWA on iOS/Android homescreen.
- [ ] Deploy via deploy.sh updates backend (git pull) + frontend (rsync build).

## 9. App Flow

### 9.1 User Journey Map
- Single entry point: `xpenses.merxylab.com` (installed PWA icon or browser).
- No signup/onboarding — one owner, one password, set once via env at deploy time.

### 9.2 Core Flows
1. **Login**: open app -> LoginScreen (password field) -> POST /api/auth/login
   -> cookie set -> redirect to Transactions list (default screen).
2. **Add transaction**: tap FAB -> TxnForm -> pick type (expense/income/transfer)
   -> amount + account/category/note -> save -> optimistic insert into local
   list + Dexie outbox -> sync push if online.
3. **Review month**: bottom tab "Reports" -> current-month category chart +
   account balance summary cards.
4. **Manage budgets**: tab "Budgets" -> set/edit per-category monthly limit ->
   banner appears on Transactions/Reports when a category is over limit.
5. **Recurring setup**: from Transactions or a "Recurring" list screen ->
   create rule (template + interval) -> server cron inserts on due dates.
6. **Manage accounts/categories**: Settings-adjacent screens -> CRUD list ->
   blocked (409) delete if referenced by transactions.
7. **Logout**: Settings -> logout -> POST /api/auth/logout -> back to LoginScreen.

### 9.3 Navigation Structure
- Bottom tab bar (mobile-first): Transactions | Reports | Budgets | Settings.
- Transactions tab has a floating Add button (opens TxnForm as a sheet/modal).
- No deep sidebar/breadcrumbs — flat single-level tabs suit a solo-user utility app.

### 9.4 Auth Gating
- Public: LoginScreen only.
- All other routes require a valid JWT cookie; a route guard redirects to
  LoginScreen on 401 from any API call.

### 9.5 State Transitions (per screen)
- **Loading**: skeleton rows for lists (Transactions, Reports) while Dexie
  cache hydrates or network fetch resolves.
- **Empty**: "No transactions yet" / "No budgets set" with a CTA to add one.
- **Error**: inline banner with retry action; never a blank white screen.
- **Success**: optimistic UI updates immediately on save, before server ack.

### 9.6 Edge Cases
- **Offline**: app shell + last-synced data still renders (service worker
  cache); writes queue in the outbox and show a "pending sync" indicator.
- **Expired session**: any 401 clears local auth state and redirects to
  LoginScreen; queued offline writes are preserved and replay after re-login.
- **Sync conflict**: never surfaced as a merge UI — last-write-wins by
  updated_at is silent and automatic (solo user, single device assumption
  relaxed to "single writer at a time").
- **Permission denied**: not applicable (no roles) beyond the auth gate above.
