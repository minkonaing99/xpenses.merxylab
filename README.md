# Xpenses

Xpenses is a mobile-first personal finance app I designed and built to make everyday money tracking fast, dependable, and useful. It brings accounts, budgets, recurring bills, reports, and forward-looking spending insights into one installable app, with offline support for real-world use.

## Why I built it

Personal finance tools often become either too simple to trust or too complex to use every day. I wanted a focused product that answers practical questions quickly:

- Where did my money go this month?
- Am I staying within my budgets?
- Which expenses are changing unusually fast?
- What will my spending look like by month end?

I deliberately designed Xpenses for one owner. That decision kept the product focused and let me spend more time on reliable money calculations, quick data entry, useful insights, and safe automation instead of building unused multi-user features.

## What the product does

- Tracks expenses, income, and transfers across cash, bank, and custom accounts.
- Organizes spending with categories and monthly budgets.
- Shows balances, monthly cash flow, category trends, and daily spending patterns.
- Forecasts month-end spending using current activity and upcoming recurring bills.
- Flags unusual budget usage and category spending changes.
- Repeats recent transactions with one tap for faster daily entry.
- Automates recurring transactions while preventing duplicate entries.
- Works as an installable mobile app and keeps recent information available offline.
- Queues changes made without a connection and resumes them when the device reconnects.
- Exports transaction data for personal analysis or backup.
- Connects to Claude through an optional MCP server for conversational finance checks and expense entry.

## What this project demonstrates

This project shows how I take a product from a personal problem to a deployed, tested system.

### Product judgment

I chose a clear single-user scope and prioritized the tasks that matter every day: fast entry, trustworthy totals, useful monthly context, and low maintenance. Features were added only when they supported those goals.

### Reliable financial data

Money is stored as integer satang rather than floating-point values, preventing rounding errors. Dates and monthly calculations follow the Asia/Bangkok timezone so reports, budgets, and recurring transactions stay consistent.

### Resilient real-world behavior

The app handles weak or missing connections by preserving recent data and safely replaying queued changes. Transaction writes are designed so a retry does not create duplicates, and recurring jobs can run again without charging the same scheduled item twice.

### Practical security

Authentication uses secure cookies, secrets stay in environment variables, external input is validated, and database requests use parameterized queries. The Claude integration is intentionally limited to reading data and creating expenses. Editing and deletion remain inside the app.

### Quality and maintainability

Frontend and backend features are organized by business area, with automated tests covering calculations, API behavior, screens, offline recovery, and recurring schedules. Both application layers maintain more than 80% test coverage.

## Selected engineering decisions

- Built a mobile-first PWA instead of treating mobile as a smaller desktop layout.
- Used one shared source of server data on the frontend to keep caching and updates predictable.
- Served frontend and API from the same origin for simpler, safer authentication.
- Kept reporting calculations close to transaction data so balances remain explainable.
- Added forward-looking insights without introducing a separate analytics platform.
- Designed AI access around least privilege rather than exposing every write operation.

## Technology

React, TypeScript, TanStack Query, Vite, Express, MySQL, Jest, Vitest, and Model Context Protocol.

The app is deployed on Hostinger using its managed Node.js environment. The frontend and API share one deployment, while MySQL stores the financial records.

## Project documentation

- [Product requirements](docs/prd.md)
- [Web app and offline behavior](docs/WEB.md)
- [Architecture and technical decisions](docs/TECH.md)
- [Database and API design](docs/SCHEMA.md)
- [Setup and development notes](docs/SETUP.md)
- [MCP integration](docs/MCP.md)
