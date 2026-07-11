#!/usr/bin/env node
// xpenses MCP server. Exposes read access to your finances plus a single
// write (log an expense) over stdio, for use in Claude Desktop / Claude Code.
//
// Config (env):
//   XPENSES_API_URL    e.g. https://your-host/api
//   XPENSES_API_TOKEN  the API_TOKEN set on the server
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient, bahtToSatang, matchByName, todayIn, ApiError } from "./client.mjs";

const client = createClient({
  baseUrl: process.env.XPENSES_API_URL,
  token: process.env.XPENSES_API_TOKEN,
});

const monthArg = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM")
  .describe("Month as YYYY-MM");

function json(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// Wrap a handler so API/validation errors come back as tool errors, not crashes.
function tool(fn) {
  return async (args) => {
    try {
      return json(await fn(args));
    } catch (err) {
      if (err instanceof ApiError) return fail(err.message);
      throw err;
    }
  };
}

const server = new McpServer({ name: "xpenses", version: "0.1.0" });

server.registerTool(
  "list_transactions",
  { description: "List transactions for a month (YYYY-MM).", inputSchema: { month: monthArg } },
  tool(({ month }) => client.get(`/transactions?month=${month}&limit=200`)),
);

server.registerTool(
  "get_balances",
  { description: "Current balance of every account plus net total.", inputSchema: {} },
  tool(() => client.get("/accounts")),
);

server.registerTool(
  "get_budgets",
  { description: "Per-category budget status (spent vs limit) for a month.", inputSchema: { month: monthArg } },
  tool(({ month }) => client.get(`/budgets?month=${month}`)),
);

server.registerTool(
  "get_forecast",
  { description: "Recurring-aware month-end spend/net projection.", inputSchema: { month: monthArg } },
  tool(({ month }) => client.get(`/insights/forecast?month=${month}`)),
);

server.registerTool(
  "get_anomalies",
  { description: "Spending heads-up flags (budget burn, velocity, duplicates).", inputSchema: { month: monthArg } },
  tool(({ month }) => client.get(`/insights/anomalies?month=${month}`)),
);

server.registerTool(
  "get_comparisons",
  { description: "Per-category spend vs last month and trailing average.", inputSchema: { month: monthArg } },
  tool(({ month }) => client.get(`/insights/comparisons?month=${month}`)),
);

server.registerTool(
  "create_expense",
  {
    description: "Log an expense. Amount is in baht; category and account are matched by name.",
    inputSchema: {
      amount_baht: z.union([z.number(), z.string()]).describe("Expense amount in baht, e.g. 120 or 12.50"),
      category: z.string().describe("Category name (fuzzy-matched)"),
      account: z.string().describe("Account name (fuzzy-matched)"),
      note: z.string().optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Transaction date YYYY-MM-DD; defaults to today (Bangkok)"),
    },
  },
  tool(async ({ amount_baht, category, account, note, date }) => {
    const amount = bahtToSatang(amount_baht);
    if (amount === null) throw new ApiError(`Invalid amount: ${amount_baht}`);

    const [categories, accounts] = await Promise.all([client.get("/categories"), client.get("/accounts")]);
    const cat = matchByName(categories, category);
    if (!cat) throw new ApiError(`No category matching "${category}"`);
    const acc = matchByName(accounts, account);
    if (!acc) throw new ApiError(`No account matching "${account}"`);

    const txn = {
      id: randomUUID(),
      type: "expense",
      amount,
      note: note ?? undefined, // schema wants string|omitted, not null
      categoryId: cat.id,
      accountId: acc.id,
      txnDate: date ?? todayIn("Asia/Bangkok"),
      updatedAt: new Date().toISOString(), // client-supplied LWW timestamp
    };
    const created = await client.post("/transactions", txn);
    return { created, category: cat.name, account: acc.name };
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
