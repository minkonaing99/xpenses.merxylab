# xpenses — MCP Server

Talk to your finances from Claude Desktop or Claude Code. The `mcp/` package is
a local stdio [MCP](https://modelcontextprotocol.io) server that wraps the
xpenses REST API over HTTPS with a bearer token.

## What Claude can do

The server exposes 18 tools. Read: `list_transactions`, `get_balances`, `get_categories`,
`get_budgets`, `get_forecast`, `get_anomalies`, `get_comparisons`,
`get_plans`, `get_recurring`, and `find_duplicates`. Create: `create_expense`,
`create_transactions`, `create_plan`, and `create_recurring`. Edit:
`update_transaction`, `delete_transaction`, `confirm_plan`, and `delete_plan`.
Purchase reflections remain app-only.

## Usage (talking to it)

After the client is registered (below) and approved, you don't call tools by
name — just talk. Claude reads the request and picks the tool. Examples:

| You say | Tool |
| --- | --- |
| "what are my account balances?" | `get_balances` |
| "am I on track this month?" / "projected spend by end of July?" | `get_forecast` |
| "how are my budgets doing?" | `get_budgets` |
| "anything unusual in my spending?" | `get_anomalies` |
| "what am I spending more on vs last month?" | `get_comparisons` |
| "list my July transactions" | `list_transactions` |
| "log ฿120 lunch to Cash under Food" | `create_expense` |
| "log lunch, salary, and a transfer" | `create_transactions` |
| "show my September purchase plans" | `get_plans` |
| "plan a ฿30,000 laptop for October" | `create_plan` |
| "move today's breakfast to KrungThai" | `update_transaction` |
| "delete that duplicate coffee" | `delete_transaction` |
| "I bought the Apple Pencil" | `confirm_plan` |
| "drop the laptop plan" | `delete_plan` |
| "what recurring rules do I have?" | `get_recurring` |
| "did I log anything twice?" | `find_duplicates` |
| "add Claude ฿370.26 monthly from KrungThai" | `create_recurring` |

Notes:
- **Months** must be supplied as YYYY-MM. The assistant resolves phrases such as "this month" before calling.
- **Complete transaction lists:** `list_transactions` follows every API cursor,
  so months with more than 200 transactions are returned in full.
- **Logging an expense**: amount in baht (auto-converted to satang); category
  and account are matched by name (unique exact, then unique prefix, then unique substring); date defaults to
  today (Bangkok), or say "...on 2026-07-09".
- **Safe retries:** every write tool requires a `request_id` UUID. Generate it
  once and reuse the same value if the call is retried; the API will not create
  duplicates for that request. Keep the input unchanged, including the original
  transaction date when retrying after midnight.
- **Resolved names:** `get_budgets` adds `categoryName`. Write results add
  `categoryName`, `accountName`, `fromAccountName`, or `toAccountName` for
  every name matched, so a wrong fuzzy match is visible.
- **Budget impact:** `create_transactions` also returns `budgets`: the status
  (`spent`, `limitAmount`, `over`) of each budgeted category it touched, per
  month. `null` means the lookup failed after the write succeeded.
- **Duplicates:** `find_duplicates` pairs transactions with the same type,
  amount, and account(s) within `window_days` (0-3, default 0 = same date).
  Reconciliation adjustments are ignored; pairs across months are not checked.
- **Bulk logging:** `create_transactions` accepts 1-20 mixed expenses, incomes,
  and transfers. It validates every item and commits them atomically, so one
  failure rolls back the whole batch.
- **Plans:** `confirm_plan` logs the plan's expense today (after its waiting
  period) and releases its reserve. `delete_plan` drops it without buying.
- **Edits:** `update_transaction` changes account, category, amount, date, or
  note and returns the resolved names. `delete_transaction` soft-deletes. Both
  send an `updatedAt` so the server's last-write-wins guard applies. The MCP
  process remembers each `request_id` and replays the first result; reusing an
  ID with different input is rejected. That memory is lost on restart, but a
  repeated update sets the same values and a repeated delete returns
  `NOT_FOUND`, so nothing applies twice.
- Ambiguous or blank category/account names are rejected before writing. Supply
  an exact, unambiguous name. Correct already-saved mistakes in the app.

Troubleshooting: tools missing -> restart the client and approve the server;
`authentication required` -> the server lacks the deployed Bearer-auth code or
the `API_TOKEN`/`XPENSES_API_TOKEN` pair doesn't match.

## Server setup (one time)

1. Generate a token and set it on the API server's `.env`:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Put it in `API_TOKEN=` (min 24 chars). When set, requests with
   `Authorization: Bearer <token>` authenticate without a cookie, restricted to the routes below. Leave unset to
   disable programmatic access entirely.
2. Redeploy / restart the server so it picks up the new env.

## Client setup

Install deps once:

```
cd mcp && npm install
```

Register with Claude Desktop (`claude_desktop_config.json`) or Claude Code
(`.mcp.json`):

```json
{
  "mcpServers": {
    "xpenses": {
      "command": "node",
      "args": ["/absolute/path/to/xpenses/mcp/src/index.mjs"],
      "env": {
        "XPENSES_API_URL": "https://your-host/api",
        "XPENSES_API_TOKEN": "the-same-token-as-API_TOKEN"
      }
    }
  }
}
```

`XPENSES_API_URL` is the API root (ends in `/api`). Both env vars are required;
the server refuses to start without them.

## Security notes

- The token is compared in constant time (`lib/safeCompare.js`); a mismatch
  falls through to cookie auth and then 401.
- The token permits only GET `/accounts`, `/categories`, `/transactions`,
  `/budgets`, `/plans`, `/recurring`, `/insights/forecast`,
  `/insights/anomalies`, and `/insights/comparisons`; POST
  `/transactions/bulk`, `/plans`, `/recurring`, and `/plans/:uuid/confirm`;
  PATCH and DELETE `/transactions/:uuid`; DELETE `/plans/:uuid` (all under
  `/api`). Other authenticated API operations return 403 `FORBIDDEN`.
  A matching bearer token stays restricted even if a browser cookie is present.
  Cookie-only browser access is unchanged. Rotate the token by changing
  `API_TOKEN` on the server and the client config.
- MCP writes can create, edit, and soft-delete transactions, create recurring
  rules, and create, confirm, or delete plans. They cannot touch accounts,
  categories, budgets, savings pots, sync, or reflections.

## Self-check

```
cd mcp && npm test
```

Covers money conversion, unique matching, pagination, API errors, connection
failures, and timeouts during both request and response-body reading. SDK
integration checks cover tool discovery, schemas, every tool, retry IDs, and
stdio startup against a local mock HTTP server. No production data is used.

## Tool response contract

Successful tools return the same JSON through text and `structuredContent`:

```json
{ "currency": "THB", "money_unit": "satang", "data": [] }
```

`data` contains the tool-specific result validated by its advertised output
schema. All monetary fields use satang: divide by 100 for baht. Rates and
averages can contain fractional satang. Counts, days, percentages, and trend
indicators are not money. Inputs named `amount_baht` still use baht.

Read tools advertise read-only, non-destructive, idempotent behavior. Create
tools advertise non-destructive writes; update and delete tools advertise
destructive writes; clients must preserve the
request ID and inputs for safe retries. Annotations are hints, not permissions.

HTTP requests have a 15-second timeout covering response-body reading too.
There are no automatic retries. Errors set `isError: true` and return JSON
`error` with `code`, `message`, and HTTP `status` when available. A timed-out or
failed write may already have committed: retry only with the same request ID
and unchanged input. Reads can be retried when the API is reachable.

## Upgrade notes

Deploy the API and restart MCP clients together. Existing token configuration
still works, but the token no longer grants general API access. Successful MCP
text responses now use the envelope above instead of a bare array/object.
Consumers should read `data`; output monetary values are unchanged.
