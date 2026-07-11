# xpenses — Product Requirements Document

## 1. Summary
xpenses is a single-user expense tracker API for one person tracking THB
spending across self-defined accounts. It enforces per-category monthly
budgets and auto-inserts recurring transactions via a server cron.

## 2. Goals
- Frictionless data entry: an expense create round-trips in under 5 seconds.
- Accurate money math (integer satang, no float rounding).
- Clear month-at-a-glance: balances, category spend, budget status.

## 3. Non-Goals (explicitly out of scope for V1)
- Multi-user / registration / OAuth.
- Multi-currency or currency conversion.
- Push notifications.
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
- FR-BG3: When a category's month spend >= limit, the budgets response flags it as over.

### 5.6 Recurring
- FR-RC1: Rules define a template txn + schedule (interval + next_run_date).
- FR-RC2: A server cron runs daily, inserts due transactions, advances next_run_date.
- FR-RC3: Inserted txns carry a server-generated UUID and are normal transactions.
- FR-RC4: Rule CRUD (create/pause/delete).

### 5.7 Reporting
- FR-RP1: Current-month spend by category (list).
- FR-RP2: Balance summary card per account + net total.

## 6. Non-Functional Requirements
- NFR-1: Money stored/transported as integer satang; never floats.
- NFR-2: All API inputs validated at the boundary; parameterized SQL only.
- NFR-3: No hardcoded secrets; config via env.
- NFR-4: 80%+ test coverage; TDD.
- NFR-5: Runs under Hostinger Passenger Node slot (no long-lived custom port).

## 7. Success Criteria
- [ ] Add/edit/delete expense, income, transfer via API.
- [ ] Budgets response flags a category as over when it exceeds its monthly limit.
- [ ] Recurring cron inserts due txns exactly once per due date.
- [ ] Current-month category report renders from real data.
- [ ] Deploy via deploy.sh updates backend (git pull).

## 8. Auth Gating
- Public: `/api/auth/login` only.
- All other routes require a valid JWT cookie; 401 on missing/expired session.
