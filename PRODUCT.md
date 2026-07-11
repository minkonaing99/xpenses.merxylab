# Product

## Register

product

## Users

Solo owner, authenticated by a single shared password, calling the API to
log cash/bank spending and periodically check month-at-a-glance balances,
category spend, and budget status. No sharing, no roles, no other users ever.

## Product Purpose

xpenses is a personal expense tracker API: capture every expense, income, and
transfer against self-defined accounts, categorize spend, cap it with
per-category monthly budgets, and auto-insert recurring transactions.
Success looks like: numbers that are never distrusted because of float
rounding, and a recurring cron that never double-inserts or silently misses
a due date.

## Design Principles

- Money never lies — integer satang everywhere, THB formatting only at the
  display edge.
- One owner, zero friction — no multi-user machinery (no roles, no sharing,
  no permission model) since none of it will ever be used.
