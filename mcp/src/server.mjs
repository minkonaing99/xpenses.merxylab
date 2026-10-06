import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiError, buildPlan, buildTransactionPatch, buildTransactions, findDuplicates, withNames } from "./client.mjs";

const monthArg = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM");
const amountArg = z.union([z.number(), z.string()]).describe("Amount in baht, e.g. 120 or 12.50");
const requestIdArg = z.string().uuid().describe("Stable UUID; retry with this same ID and unchanged input");
const nameArg = z.string().trim().min(1).max(80).describe("Unique exact, prefix, or substring name match");
const noteArg = z.string().max(255).optional();
const idArg = z.string().uuid();
const dateArg = z.string().date().optional().describe("YYYY-MM-DD; defaults to today in Bangkok. On retry retain the original date.");
const expenseArgs = { amount_baht: amountArg, category: nameArg, account: nameArg, note: noteArg, date: dateArg };
const transactionArg = z.discriminatedUnion("type", [
  z.object({ type: z.literal("expense"), ...expenseArgs }).strict(),
  z.object({ type: z.literal("income"), amount_baht: amountArg, account: nameArg, note: noteArg, date: dateArg }).strict(),
  z.object({ type: z.literal("transfer"), amount_baht: amountArg, from_account: nameArg, to_account: nameArg, note: noteArg, date: dateArg }).strict(),
]);

const money = z.number().finite().describe("THB in satang: divide by 100 for baht. Rates/averages may be fractional.");
const transaction = z.object({ id: z.string(), type: z.enum(["expense", "income", "transfer"]), amount: money }).passthrough();
const account = z.object({ id: z.string(), name: z.string(), balance: money }).passthrough();
const budget = z.object({ categoryId: z.string(), limitAmount: money, spent: money }).passthrough();
const plan = z.object({ id: z.string(), name: z.string(), amount: money, plannedDate: z.string() }).passthrough();
const forecast = z.object({
  month: z.string(), daysInMonth: z.number(), daysElapsed: z.number(), daysRemaining: z.number(),
  paidIncome: money, paidExpense: money, dailyBurnRate: money,
  projectedExpense: money, projectedIncome: money, projectedNet: money,
}).passthrough();
const anomaly = z.discriminatedUnion("type", [
  z.object({ type: z.literal("budget_burn"), categoryId: z.string(), name: z.string(), spent: money, limit: money, pct: z.number() }).passthrough(),
  z.object({ type: z.literal("category_velocity"), categoryId: z.string(), name: z.string(), currentSpent: money, avg3mo: money, projectedFull: money }).passthrough(),
]);
const comparison = z.object({
  categoryId: z.string(), name: z.string(), current: money, last: money, prevAvg: money,
  vsLast: money, vsAvg: money, trend: z.number(),
}).passthrough();
const plans = z.object({
  plans: z.array(plan), confirmedPurchases: z.array(plan),
  accounts: z.array(account), budgets: z.array(budget),
}).passthrough();
const bulkResult = z.object({
  results: z.array(z.object({ id: z.string(), status: z.string(), created: z.boolean(), value: transaction }).passthrough()),
  budgets: z.array(budget.extend({ month: z.string() })).nullable()
    .describe("Status after this write for each budgeted category it touched; null if the lookup failed"),
});
const duplicate = z.object({
  ids: z.array(z.string()), type: z.string(), amount: money, dates: z.array(z.string()), notes: z.array(z.string().nullable()),
});

function safeCode(code) {
  return /^[A-Z][A-Z0-9_]{0,39}$/.test(code ?? "") ? code : "API_ERROR";
}

function register(server, name, description, inputSchema, dataSchema, handler) {
  const readOnly = /^(get|list)_/.test(name);
  server.registerTool(name, {
    description: `${description} Output money is THB in satang (100 satang = 1 baht); rates/averages may be fractional.`,
    inputSchema,
    outputSchema: { currency: z.literal("THB"), money_unit: z.literal("satang"), data: dataSchema },
    annotations: { readOnlyHint: readOnly, destructiveHint: /^(update|delete)_/.test(name), idempotentHint: readOnly, openWorldHint: true },
  }, async (args) => {
    try {
      const data = await handler(args);
      if (!dataSchema.safeParse(data).success) throw new ApiError("API returned an unexpected result shape", "INVALID_RESPONSE");
      const result = { currency: "THB", money_unit: "satang", data };
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    } catch (err) {
      const error = err instanceof ApiError
        ? { code: safeCode(err.code), message: String(err.message).replace(/[\u0000-\u001f\u007f]+/g, " ").slice(0, 200), status: err.status }
        : { code: "INTERNAL_ERROR", message: "Unexpected tool failure. For writes, keep the same request_id and input when retrying." };
      return { content: [{ type: "text", text: JSON.stringify({ error }) }], isError: true };
    }
  });
}

function registerReads(server, client) {
  register(server, "list_transactions", "List every transaction for a month.", { month: monthArg }, z.array(transaction),
    ({ month }) => client.getAll(`/transactions?month=${month}`));
  register(server, "get_balances", "Current balance of every account.", {}, z.array(account),
    () => client.get("/accounts"));
  register(server, "get_categories", "List expense categories.", {},
    z.array(z.object({ id: z.string(), name: z.string() }).passthrough()), () => client.get("/categories"));
  register(server, "get_budgets", "Per-category budget status for a month, with category names.", { month: monthArg }, z.array(budget),
    async ({ month }) => {
      const [budgets, categories] = await Promise.all([client.get(`/budgets?month=${month}`), client.get("/categories")]);
      return budgets.map((row) => withNames(row, { categories }));
    });
  register(server, "find_duplicates", "Possible duplicate transactions: same type, amount and account(s) within window_days.", {
    month: monthArg, window_days: z.number().int().min(0).max(3).optional().describe("0 = same date (default)"),
  }, z.array(duplicate), async ({ month, window_days }) => findDuplicates(await client.getAll(`/transactions?month=${month}`), window_days ?? 0));
  register(server, "get_forecast", "Recurring-aware month-end spend/net projection.", { month: monthArg }, forecast,
    ({ month }) => client.get(`/insights/forecast?month=${month}`));
  register(server, "get_anomalies", "Budget burn and spending velocity flags.", { month: monthArg }, z.array(anomaly),
    ({ month }) => client.get(`/insights/anomalies?month=${month}`));
  register(server, "get_comparisons", "Per-category spend vs last month and trailing average.", { month: monthArg }, z.array(comparison),
    ({ month }) => client.get(`/insights/comparisons?month=${month}`));
  register(server, "get_plans", "List purchase plans and forecast totals for a month.", { month: monthArg }, plans,
    ({ month }) => client.get(`/plans?month=${month}`));
}

function registerExpense(server, client) {
  register(server, "create_expense", "Log an expense in baht. Ambiguous category/account names are rejected.",
    { request_id: requestIdArg, ...expenseArgs },
    z.object({ created: transaction, category: z.string(), account: z.string() }),
    async ({ request_id, ...input }) => {
      const [categories, accounts] = await Promise.all([client.get("/categories"), client.get("/accounts")]);
      const [txn] = buildTransactions([{ type: "expense", ...input }], accounts, categories, { ids: [request_id] });
      const result = await client.post("/transactions/bulk", { transactions: [txn] });
      return {
        created: result.results[0]?.value,
        category: categories.find((item) => item.id === txn.categoryId).name,
        account: accounts.find((item) => item.id === txn.accountId).name,
      };
    });
}

async function touchedBudgets(client, payload, categories) {
  const expenses = payload.filter((txn) => txn.type === "expense");
  const months = [...new Set(expenses.map((txn) => txn.txnDate.slice(0, 7)))];
  const perMonth = await Promise.all(months.map(async (month) => {
    const touched = new Set(expenses.filter((txn) => txn.txnDate.startsWith(month)).map((txn) => txn.categoryId));
    const budgets = await client.get(`/budgets?month=${month}`);
    return budgets.filter((row) => touched.has(row.categoryId)).map((row) => ({ month, ...withNames(row, { categories }) }));
  }));
  return bulkResult.shape.budgets.unwrap().parse(perMonth.flat());
}

function registerCreates(server, client) {
  registerExpense(server, client);
  register(server, "create_transactions", "Atomically log 1-20 expenses, incomes, and transfers. Inputs use baht; names must be unambiguous.",
    { request_id: requestIdArg, transactions: z.array(transactionArg).min(1).max(20) }, bulkResult,
    async ({ request_id, transactions }) => {
      const needsCategories = transactions.some((item) => item.type === "expense");
      const [accounts, categories] = await Promise.all([
        client.get("/accounts"), needsCategories ? client.get("/categories") : Promise.resolve([]),
      ]);
      const payload = buildTransactions(transactions, accounts, categories, { requestId: request_id });
      const result = await client.post("/transactions/bulk", { transactions: payload });
      const results = result.results.map((item) => ({ ...item, value: withNames(item.value, { accounts, categories }) }));
      return { results, budgets: await touchedBudgets(client, payload, categories).catch(() => null) };
    });
  register(server, "create_plan", "Create a planned purchase in baht. Category/account names must be unambiguous.", {
    request_id: requestIdArg, name: z.string().trim().min(1).max(255), amount_baht: amountArg,
    category: nameArg, account: nameArg, planned_date: z.string().date(),
    wait_days: z.number().int().min(0).max(30).optional(),
  }, plan, async (input) => {
    const [categories, accounts] = await Promise.all([client.get("/categories"), client.get("/accounts")]);
    return withNames(await client.post("/plans", buildPlan(input, accounts, categories, input.request_id)), { accounts, categories });
  });
}

// ponytail: in-memory replay cache (newest 500 IDs), lost on MCP restart. Later replays stay safe because
// updates set absolute values, deletes are tombstones, and confirm/create reject reuse.
const MAX_REPLAYS = 500;

function once(applied, tool, { request_id, ...input }, run) {
  const key = JSON.stringify([tool, input], Object.keys(input).sort());
  const prior = applied.get(request_id);
  if (prior) {
    if (prior.key !== key) throw new ApiError("request_id already used with different input", "CONFLICT");
    return prior.data;
  }
  const data = run(input).catch((err) => {
    applied.delete(request_id);
    throw err;
  });
  applied.set(request_id, { key, data });
  if (applied.size > MAX_REPLAYS) applied.delete(applied.keys().next().value);
  return data;
}

function registerEdits(server, client) {
  const applied = new Map();
  const deleted = z.object({ deleted: z.string() });
  register(server, "update_transaction", "Edit a transaction's account, category, amount, date or note. Returns the resolved names.", {
    request_id: requestIdArg, id: idArg, amount_baht: amountArg.optional(), category: nameArg.optional(),
    account: nameArg.optional(), date: z.string().date().optional(), note: z.string().max(255).nullable().optional(),
  }, z.object({ updated: transaction, category: z.string().optional(), account: z.string().optional() }),
  (args) => once(applied, "update_transaction", args, async ({ id, ...input }) => {
    const [accounts, categories] = await Promise.all([
      input.account ? client.get("/accounts") : [], input.category ? client.get("/categories") : [],
    ]);
    const { body, names } = buildTransactionPatch(input, accounts, categories);
    return { updated: await client.patch(`/transactions/${id}`, body), ...names };
  }));
  register(server, "delete_transaction", "Soft-delete a transaction.", { request_id: requestIdArg, id: idArg }, deleted,
    (args) => once(applied, "delete_transaction", args, async ({ id }) => {
      await client.del(`/transactions/${id}`, { updatedAt: new Date().toISOString() });
      return { deleted: id };
    }));
  register(server, "confirm_plan", "Mark a planned purchase as bought: logs its expense today and releases the plan reserve.",
    { request_id: requestIdArg, id: idArg }, plan,
    (args) => once(applied, "confirm_plan", args, ({ id }) => client.post(`/plans/${id}/confirm`)));
  register(server, "delete_plan", "Remove a planned purchase without buying it.", { request_id: requestIdArg, id: idArg }, deleted,
    (args) => once(applied, "delete_plan", args, async ({ id }) => {
      await client.del(`/plans/${id}`);
      return { deleted: id };
    }));
  register(server, "get_recurring", "List recurring transaction rules.", {}, z.array(transaction), () => client.get("/recurring"));
  register(server, "create_recurring", "Create a recurring rule in baht. Expense needs category+account, income account, transfer from/to accounts.", {
    request_id: requestIdArg, type: z.enum(["expense", "income", "transfer"]), amount_baht: amountArg,
    category: nameArg.optional(), account: nameArg.optional(), from_account: nameArg.optional(), to_account: nameArg.optional(),
    note: noteArg, interval_unit: z.enum(["day", "week", "month"]), interval_count: z.number().int().min(1).max(365).optional(),
    next_run_date: z.string().date(),
  }, transaction, (args) => once(applied, "create_recurring", args, async ({ interval_unit, interval_count, next_run_date, ...rule }) => {
    const [accounts, categories] = await Promise.all([client.get("/accounts"), rule.type === "expense" ? client.get("/categories") : []]);
    const [{ txnDate, updatedAt, ...built }] = buildTransactions([rule], accounts, categories, { ids: [args.request_id] });
    return withNames(await client.post("/recurring", { ...built, intervalUnit: interval_unit, intervalCount: interval_count ?? 1, nextRunDate: next_run_date }), { accounts, categories });
  }));
}

export function createMcpServer(client) {
  const server = new McpServer({ name: "xpenses", version: "0.3.0" });
  registerReads(server, client);
  registerCreates(server, client);
  registerEdits(server, client);
  return server;
}
