// Runnable self-check for the pure helpers (no SDK, no network).
// Run: node test.mjs
import assert from "node:assert/strict";
import { bahtToSatang, matchByName, todayIn, createClient } from "./src/client.mjs";

// bahtToSatang
assert.equal(bahtToSatang(120), 12000);
assert.equal(bahtToSatang("12.50"), 1250);
assert.equal(bahtToSatang("1,299.9"), 129990);
assert.equal(bahtToSatang("12.999"), 1299); // truncates, never rounds up
assert.equal(bahtToSatang(0), null); // must be > 0
assert.equal(bahtToSatang("abc"), null);

// matchByName
const cats = [{ name: "Food" }, { name: "Fuel" }, { name: "Fun money" }];
assert.equal(matchByName(cats, "food").name, "Food");
assert.equal(matchByName(cats, "fu").name, "Fuel"); // prefix beats substring order
assert.equal(matchByName(cats, "money").name, "Fun money"); // substring
assert.equal(matchByName(cats, "zzz"), null);

// todayIn
assert.match(todayIn("Asia/Bangkok", new Date("2026-07-11T20:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);

// createClient: unwraps the envelope and sends the bearer token
let seen;
const client = createClient({
  baseUrl: "https://x.test/api/",
  token: "tok",
  fetchImpl: async (url, opts) => {
    seen = { url, opts };
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: [{ id: "a" }] }) };
  },
});
const data = await client.get("/accounts");
assert.deepEqual(data, [{ id: "a" }]);
assert.equal(seen.url, "https://x.test/api/accounts"); // trailing slash trimmed
assert.equal(seen.opts.headers.Authorization, "Bearer tok");

// createClient: surfaces API error envelope
const failing = createClient({
  baseUrl: "https://x.test",
  token: "tok",
  fetchImpl: async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ ok: false, error: { code: "VALIDATION_ERROR", message: "bad" } }),
  }),
});
await assert.rejects(() => failing.get("/x"), /bad/);

console.log("ok - all mcp client self-checks passed");
