import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./src/server.mjs";
import { ApiError } from "./src/client.mjs";

const requestId = "3d7feaac-bacd-4f9e-a214-3eb0f572c945";
const accounts = [{ id: "a1", name: "Savings", balance: 12000 }, { id: "a2", name: "Salary", balance: 50000 }];
const categories = [{ id: "c1", name: "Food" }, { id: "c2", name: "Fuel" }];
const expense = { request_id: requestId, amount_baht: "12.50", category: "Food", account: "Savings", date: "2026-10-02" };

async function connect(api) {
  const server = createMcpServer(api);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

function mockApi() {
  const writes = [];
  return {
    writes,
    get: async (path) => path === "/accounts" ? accounts : path === "/categories" ? categories : [],
    patch: async (path, body) => { writes.push({ method: "PATCH", path, body }); return { id: "t1", type: "expense", amount: body.amount ?? 4000 }; },
    del: async (path, body) => { writes.push({ method: "DELETE", path, body }); return {}; },
    getAll: async () => [{ id: "t1", type: "expense", amount: 1250 }],
    post: async (path, body) => {
      writes.push({ path, body });
      if (path === "/recurring") return body;
      if (path.endsWith("/confirm")) return { id: "p1", name: "Laptop", amount: 100, plannedDate: "2026-10-01", status: "confirmed" };
      return path === "/plans" ? body : { results: body.transactions.map((value) => ({ id: value.id, value, created: true, status: "applied" })) };
    },
  };
}

test("tool discovery advertises permissions, money units and output schemas", async () => {
  const session = await connect(mockApi());
  try {
    const { tools } = await session.client.listTools();
    assert.equal(tools.length, 18);
    for (const tool of tools) {
      assert.equal(tool.annotations.readOnlyHint, /^(get|list)_/.test(tool.name));
      assert.equal(tool.annotations.destructiveHint, /^(update|delete)_/.test(tool.name));
      assert.equal(tool.annotations.openWorldHint, true);
      assert.ok(tool.outputSchema.properties.data);
      assert.match(tool.description, /satang/);
    }
    const result = await session.client.callTool({ name: "get_balances", arguments: {} });
    assert.deepEqual(result.structuredContent, { currency: "THB", money_unit: "satang", data: accounts });
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.equal(result.structuredContent.data[0].balance, 12000);
    const categoryResult = await session.client.callTool({ name: "get_categories", arguments: {} });
    assert.deepEqual(categoryResult.structuredContent.data, categories);
    assert.equal(categoryResult.structuredContent.money_unit, "satang");
  } finally { await session.close(); }
});

test("single expense rejects ambiguity and blanks before posting; retry keeps original ID", async () => {
  const api = mockApi();
  const session = await connect(api);
  try {
    for (const patch of [{ account: "Sa" }, { account: "   " }, { category: "F" }, { date: "2026-02-30" }]) {
      const result = await session.client.callTool({ name: "create_expense", arguments: { ...expense, ...patch } });
      assert.equal(result.isError, true);
    }
    assert.equal(api.writes.length, 0);
    for (let i = 0; i < 2; i++) {
      const result = await session.client.callTool({ name: "create_expense", arguments: expense });
      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent.data.created.amount, 1250);
      assert.equal(api.writes[i].body.transactions[0].id, requestId);
    }
  } finally { await session.close(); }
});

test("API failures retain machine-readable codes and status in tool errors", async () => {
  const session = await connect({ get: async () => { throw new ApiError("permission denied", "FORBIDDEN", 403); } });
  try {
    const result = await session.client.callTool({ name: "get_balances", arguments: {} });
    assert.equal(result.isError, true);
    const error = JSON.parse(result.content[0].text).error;
    assert.equal(error.code, "FORBIDDEN");
    assert.equal(error.status, 403);
  } finally { await session.close(); }
});


test("all reads and create tools return schema-valid structured results", async () => {
  const api = mockApi();
  const budget = { categoryId: "c1", limitAmount: 50000, spent: 1250 };
  const plan = { id: requestId, name: "Laptop", amount: 4500000, plannedDate: "2026-11-01" };
  const responses = {
    "/accounts": accounts, "/categories": categories,
    "/budgets?month=2026-10": [budget],
    "/insights/forecast?month=2026-10": {
      month: "2026-10", daysInMonth: 31, daysElapsed: 2, daysRemaining: 29,
      paidIncome: 50000, paidExpense: 1250, dailyBurnRate: 625.5,
      projectedExpense: 19390, projectedIncome: 50000, projectedNet: 30610,
    },
    "/insights/anomalies?month=2026-10": [
      { type: "budget_burn", categoryId: "c1", name: "Food", spent: 40000, limit: 50000, pct: 0.8 },
      { type: "category_velocity", categoryId: "c1", name: "Food", currentSpent: 50000, avg3mo: 10000.5, projectedFull: 75000 },
    ],
    "/insights/comparisons?month=2026-10": [{ categoryId: "c1", name: "Food", current: 1250, last: 1000, prevAvg: 900, vsLast: 250, vsAvg: 350, trend: 1 }],
    "/plans?month=2026-10": { plans: [plan], confirmedPurchases: [plan], accounts, budgets: [budget] },
  };
  const session = await connect({ ...api, get: async (path) => responses[path] });
  try {
    for (const name of ["list_transactions", "get_budgets", "get_forecast", "get_anomalies", "get_comparisons", "get_plans"]) {
      const result = await session.client.callTool({ name, arguments: { month: "2026-10" } });
      assert.equal(result.isError, undefined, JSON.stringify(result));
      assert.equal(result.structuredContent.money_unit, "satang");
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    }
    for (const transactions of [
      [{ type: "income", amount_baht: 500, account: "Salary" }],
      [{ type: "expense", amount_baht: 10, category: "Food", account: "Savings" },
        { type: "transfer", amount_baht: 50, from_account: "Salary", to_account: "Savings" }],
    ]) {
      const result = await session.client.callTool({ name: "create_transactions", arguments: { request_id: requestId, transactions } });
      assert.equal(result.isError, undefined, JSON.stringify(result));
      assert.equal(result.structuredContent.data.results.length, transactions.length);
    }
    const result = await session.client.callTool({ name: "create_plan", arguments: {
      request_id: requestId, name: "Laptop", amount_baht: 45000,
      account: "Savings", category: "Food", planned_date: "2026-11-01",
    } });
    assert.equal(result.isError, undefined, JSON.stringify(result));
    assert.equal(result.structuredContent.data.amount, 4500000);
  } finally { await session.close(); }
});

test("malformed API data and unexpected failures return safe tool errors", async () => {
  for (const get of [async () => ({ wrong: true }), async () => { throw new Error("secret internal detail"); }]) {
    const session = await connect({ get });
    try {
      const result = await session.client.callTool({ name: "get_balances", arguments: {} });
      assert.equal(result.isError, true);
      assert.doesNotMatch(result.content[0].text, /secret internal detail/);
    } finally { await session.close(); }
  }
});


test("stdio entry point completes discovery and HTTP-backed tool call", async () => {
  const http = createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer test-stdio-token");
    assert.equal(req.url, "/api/accounts");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, data: accounts }));
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("./src/index.mjs", import.meta.url))],
    env: { XPENSES_API_URL: `http://127.0.0.1:${http.address().port}/api`, XPENSES_API_TOKEN: "test-stdio-token" },
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 18);
    const result = await client.callTool({ name: "get_balances", arguments: {} });
    assert.deepEqual(result.structuredContent.data, accounts);
  } finally {
    await client.close();
    await new Promise((resolve, reject) => http.close((err) => err ? reject(err) : resolve()));
  }
});


test("update and delete transactions resolve names, send LWW timestamps and replay once per request_id", async () => {
  const api = mockApi();
  const session = await connect(api);
  const txnId = "6f1c1d1e-4b2a-4c3d-8e9f-0a1b2c3d4e5f";
  try {
    const args = { request_id: requestId, id: txnId, account: "Salary", amount_baht: 40 };
    for (let i = 0; i < 2; i++) {
      const result = await session.client.callTool({ name: "update_transaction", arguments: args });
      assert.equal(result.isError, undefined, JSON.stringify(result));
      assert.equal(result.structuredContent.data.account, "Salary");
    }
    assert.equal(api.writes.length, 1);
    assert.equal(api.writes[0].path, `/transactions/${txnId}`);
    assert.equal(api.writes[0].body.accountId, "a2");
    assert.equal(api.writes[0].body.amount, 4000);
    assert.equal(api.writes[0].body.categoryId, undefined);
    assert.ok(Date.parse(api.writes[0].body.updatedAt));

    const changed = await session.client.callTool({ name: "update_transaction", arguments: { ...args, amount_baht: 41 } });
    assert.equal(changed.isError, true);
    const empty = await session.client.callTool({ name: "update_transaction", arguments: { request_id: requestId.replace("3d", "4d"), id: txnId } });
    assert.equal(empty.isError, true);
    assert.equal(api.writes.length, 1);

    const deleteId = "5a7feaac-bacd-4f9e-a214-3eb0f572c945";
    for (let i = 0; i < 2; i++) {
      const result = await session.client.callTool({ name: "delete_transaction", arguments: { request_id: deleteId, id: txnId } });
      assert.equal(result.isError, undefined, JSON.stringify(result));
    }
    assert.equal(api.writes.length, 2);
    assert.equal(api.writes[1].method, "DELETE");
    assert.ok(Date.parse(api.writes[1].body.updatedAt));
  } finally { await session.close(); }
});

test("recurring and plan lifecycle tools hit the right endpoints", async () => {
  const api = mockApi();
  const session = await connect({ ...api, get: async (path) => path === "/recurring" ? [{ id: "r1", type: "expense", amount: 37026 }] : api.get(path) });
  const planId = "7b7feaac-bacd-4f9e-a214-3eb0f572c945";
  try {
    const list = await session.client.callTool({ name: "get_recurring", arguments: {} });
    assert.equal(list.isError, undefined, JSON.stringify(list));
    const created = await session.client.callTool({ name: "create_recurring", arguments: {
      request_id: requestId, type: "expense", amount_baht: 370.26, category: "Food", account: "Savings",
      interval_unit: "month", next_run_date: "2026-11-05", note: "Claude",
    } });
    assert.equal(created.isError, undefined, JSON.stringify(created));
    assert.deepEqual(api.writes[0], { path: "/recurring", body: {
      id: requestId, type: "expense", amount: 37026, note: "Claude", categoryId: "c1", accountId: "a1",
      intervalUnit: "month", intervalCount: 1, nextRunDate: "2026-11-05",
    } });
    const confirmed = await session.client.callTool({ name: "confirm_plan", arguments: { request_id: requestId.replace("3d", "8d"), id: planId } });
    assert.equal(confirmed.isError, undefined, JSON.stringify(confirmed));
    assert.equal(api.writes[1].path, `/plans/${planId}/confirm`);
    const removed = await session.client.callTool({ name: "delete_plan", arguments: { request_id: requestId.replace("3d", "9d"), id: planId } });
    assert.equal(removed.isError, undefined, JSON.stringify(removed));
    assert.deepEqual(api.writes[2], { method: "DELETE", path: `/plans/${planId}`, body: undefined });
  } finally { await session.close(); }
});


test("reads and writes report resolved names, budget impact and duplicates", async () => {
  const api = mockApi();
  const budget = { categoryId: "c1", limitAmount: 1000, spent: 1250, over: true };
  const txns = [
    { id: "t1", type: "expense", amount: 4000, accountId: "a1", txnDate: "2026-10-06" },
    { id: "t2", type: "expense", amount: 4000, accountId: "a1", txnDate: "2026-10-06" },
  ];
  const session = await connect({ ...api, getAll: async () => txns,
    get: async (path) => path.startsWith("/budgets?month=") ? [budget, { categoryId: "c2", limitAmount: 1, spent: 0, over: false }] : api.get(path) });
  try {
    const budgets = await session.client.callTool({ name: "get_budgets", arguments: { month: "2026-10" } });
    assert.equal(budgets.structuredContent.data[0].categoryName, "Food");

    const created = await session.client.callTool({ name: "create_transactions", arguments: { request_id: requestId, transactions: [
      { type: "expense", amount_baht: 10, category: "Foo", account: "Sav", date: "2026-10-06" },
      { type: "transfer", amount_baht: 50, from_account: "Salary", to_account: "Savings", date: "2026-10-06" },
    ] } });
    assert.equal(created.isError, undefined, JSON.stringify(created));
    const [expenseResult, transferResult] = created.structuredContent.data.results;
    assert.equal(expenseResult.value.categoryName, "Food");
    assert.equal(expenseResult.value.accountName, "Savings");
    assert.equal(transferResult.value.fromAccountName, "Salary");
    assert.deepEqual(created.structuredContent.data.budgets, [{ month: "2026-10", ...budget, categoryName: "Food" }]);

    const plan = await session.client.callTool({ name: "create_plan", arguments: {
      request_id: requestId, name: "Pen", amount_baht: 10, category: "Food", account: "Savings", planned_date: "2026-11-01" } });
    assert.equal(plan.structuredContent.data.categoryName, "Food");

    const dupes = await session.client.callTool({ name: "find_duplicates", arguments: { month: "2026-10" } });
    assert.equal(dupes.isError, undefined, JSON.stringify(dupes));
    assert.deepEqual(dupes.structuredContent.data[0].ids, ["t1", "t2"]);
  } finally { await session.close(); }
});


test("upstream error text is sanitized and capped; replay cache is bounded", async () => {
  const noisy = await connect({ get: async () => { throw new ApiError(`bad\u0000\n${"x".repeat(500)}`, "weird code!", 502); } });
  try {
    const result = await noisy.client.callTool({ name: "get_balances", arguments: {} });
    const { error } = JSON.parse(result.content[0].text);
    assert.equal(error.code, "API_ERROR");
    assert.ok(error.message.length <= 200);
    assert.doesNotMatch(error.message, /[\u0000-\u001f]/);
  } finally { await noisy.close(); }

  const api = mockApi();
  const session = await connect(api);
  const id = "7b7feaac-bacd-4f9e-a214-3eb0f572c945";
  const requestIdFor = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  try {
    for (let n = 0; n <= 500; n++) {
      await session.client.callTool({ name: "delete_plan", arguments: { request_id: requestIdFor(n), id } });
    }
    assert.equal(api.writes.length, 501);
    await session.client.callTool({ name: "delete_plan", arguments: { request_id: requestIdFor(500), id } });
    assert.equal(api.writes.length, 501);
    await session.client.callTool({ name: "delete_plan", arguments: { request_id: requestIdFor(0), id } });
    assert.equal(api.writes.length, 502);
  } finally { await session.close(); }
});
