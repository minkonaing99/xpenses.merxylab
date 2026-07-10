# Product

## Register

product

## Users

Solo owner, authenticated by a single shared password. Uses the app on their
phone (installed PWA) throughout the day to log cash/bank spending in under
5 seconds, and periodically checks month-at-a-glance balances, category
spend, and budget status. No sharing, no roles, no other users ever.

## Product Purpose

xpenses is a personal expense tracker: capture every expense, income, and
transfer against self-defined accounts, categorize spend, cap it with
per-category monthly budgets, and auto-insert recurring transactions. It
works fully offline and syncs on reconnect. Success looks like: the owner
never avoids logging a transaction because the app is in the way, and never
distrusts the numbers because of float rounding or lost offline writes.

## Brand Personality

Precise, calm, quiet. A measuring instrument, not a dashboard: it shows
exactly what's needed and steps back. Reference: Apple Wallet / Apple.com
(restrained color, SF Pro type, single-shadow discipline, chrome recedes so
the content speaks) — already the source for this project's DESIGN.md tokens.

## Anti-references

Not a generic SaaS admin dashboard: no hero-metric template (big number +
small label + gradient accent), no gradient text, no identical icon+heading
card grids repeated as the default layout answer, no glassmorphism-as-decor,
no side-stripe accent borders on rows/cards.

## Design Principles

- Speed over ceremony — the add-expense flow is the single most-run action;
  every other screen defers to it.
- Money never lies — integer satang everywhere, no visual ambiguity about
  precision, THB formatting only at the display edge.
- Restraint over decoration — one accent color, tinted neutrals, chrome
  recedes; DESIGN.md tokens applied as an app-native system, not marketing
  components forced into app screens.
- Offline is not an edge case — every state (loading, empty, error, pending
  sync) is designed as a first-class case, not an afterthought.
- One owner, zero friction — no multi-user chrome (no avatars, no sharing
  affordances, no permission UI) since none of it will ever be used.

## Accessibility & Inclusion

WCAG AA minimum: 4.5:1 text contrast, full keyboard navigation, screen
reader labels on icon-only controls, 44px minimum touch targets (see
docs/DESIGN.md for the full spec this inherits from).
