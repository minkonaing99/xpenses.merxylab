# Product

## Register

product

## Users

Solo owner, authenticated by a single shared password, logging cash/bank
spending through the PWA or by talking to Claude (MCP), and checking
month-at-a-glance balances, category spend, and budget status. No sharing, no roles, no other users ever.

## Product Purpose

xpenses is a personal expense tracker (API, PWA, and MCP server): capture every
expense, income, and transfer against self-defined accounts, categorize spend,
cap it with per-category monthly budgets, auto-insert recurring transactions,
plan purchases, reserve savings, and reconcile balances against reality.
Success looks like: numbers that are never distrusted because of float
rounding, and a recurring cron that never double-inserts or silently misses
a due date.

## Design Principles

- Money never lies — integer satang everywhere, THB formatting only at the
  display edge.
- One owner, zero friction — no multi-user machinery (no roles, no sharing,
  no permission model) since none of it will ever be used.
