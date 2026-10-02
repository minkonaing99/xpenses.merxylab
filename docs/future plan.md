# Future plan

Status: optional ideas for later implementation. No feature implementation authorized by this document.
Implemented behavior is documented in [SCHEMA.md](SCHEMA.md), [WEB.md](WEB.md),
and [SETUP.md](SETUP.md).

## Savings pots

Deferred: automatic contributions, deadlines, monthly saving suggestions,
multiple accounts per pot, partial pot funding, and links to planned purchases.
Add only when manual use reveals a need.

If Plans are linked later, deduct only a plan's unfunded portion in addition to
pot reserves. Confirming a linked purchase must create one expense and consume
its reserve exactly once.

## Purchase reflection

- Offer an in-app review list after seven days, allowing earlier review or skipping.
  Seven days is a proposed delay, not a requirement for every kind of purchase.
- Summarize counts and purchase amounts by reflection, showing the reviewed count.
- Exclude unreviewed and "Not sure yet" purchases from worth-it/regret ratios.
- Treat results as personal feedback, not proof of what caused satisfaction.

Defer push reminders, scores, AI interpretations, and category rankings until
there are enough reflections to make them useful.

## Pending sync list

Deferred: optimistic balances, bulk retry, and cancellation. Add only when
individual status and recovery are reliable and actual usage shows a need.
Cancelling an in-flight request cannot guarantee that the server has not already
applied it.

## Balance check

Deferred: statement import, cleared flags, and automatic matching.
