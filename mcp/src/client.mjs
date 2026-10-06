// Thin, envelope-aware HTTP client for the xpenses API, plus the pure helpers
// the create-expense tool needs. Money is integer satang end to end.
import { createHash, randomUUID } from "node:crypto";

/** Parse a baht amount (number or "1,299.50") to integer satang, or null. */
export function bahtToSatang(input) {
  const cleaned = String(input).replace(/[,\s฿]/g, "").trim();
  if (cleaned === "" || cleaned === ".") return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = (frac + "00").slice(0, 2); // truncate beyond 2dp
  const satang = Number(whole || "0") * 100 + Number(paise);
  return Number.isSafeInteger(satang) && satang > 0 ? satang : null;
}

/** Resolve a free-text name to one of `items` (by .name): exact, prefix, then substring. */
export function matchByName(items, query) {
  if (typeof query !== "string" || !query.trim()) return null;
  const q = query.toLowerCase().trim();
  const exact = items.filter((item) => item.name.toLowerCase() === q);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const prefix = items.filter((item) => item.name.toLowerCase().startsWith(q));
  if (prefix.length) return prefix.length === 1 ? prefix[0] : null;
  const partial = items.filter((item) => item.name.toLowerCase().includes(q));
  return partial.length === 1 ? partial[0] : null;
}

function requireUniqueName(items, query, kind) {
  const match = matchByName(items, query);
  if (match) return match;
  throw new ApiError(`No unique ${kind} matching "${query}". Supply an exact, unambiguous name.`);
}

function transactionId(requestId, index) {
  if (!requestId) return randomUUID();
  const hash = createHash("sha256").update(`${requestId}:${index}`).digest("hex");
  const variant = "89ab"[Number.parseInt(hash[16], 16) % 4];
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function buildTransactions(items, accounts, categories, options = {}) {
  const defaultDate = options.date ?? todayIn("Asia/Bangkok");
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  return items.map((item, index) => {
    const amount = bahtToSatang(item.amount_baht);
    if (amount === null) throw new ApiError(`Invalid amount: ${item.amount_baht}`);
    const common = {
      id: options.ids?.[index] ?? transactionId(options.requestId, index),
      type: item.type,
      amount,
      note: item.note ?? undefined,
      txnDate: item.date ?? defaultDate,
      updatedAt,
    };
    if (item.type === "expense") {
      const category = requireUniqueName(categories, item.category, "category");
      const account = requireUniqueName(accounts, item.account, "account");
      return { ...common, categoryId: category.id, accountId: account.id };
    }
    if (item.type === "income") {
      const account = requireUniqueName(accounts, item.account, "account");
      return { ...common, accountId: account.id };
    }
    const from = requireUniqueName(accounts, item.from_account, "source account");
    const to = requireUniqueName(accounts, item.to_account, "destination account");
    if (from.id === to.id) throw new ApiError("Transfer accounts must be different");
    return { ...common, fromAccountId: from.id, toAccountId: to.id };
  });
}

export function buildPlan(input, accounts, categories, id = randomUUID()) {
  const amount = bahtToSatang(input.amount_baht);
  if (amount === null) throw new ApiError(`Invalid amount: ${input.amount_baht}`);
  const category = requireUniqueName(categories, input.category, "category");
  const account = requireUniqueName(accounts, input.account, "account");
  return {
    id,
    name: input.name,
    amount,
    categoryId: category.id,
    accountId: account.id,
    plannedDate: input.planned_date,
    waitDays: input.wait_days ?? 7,
  };
}

export function buildTransactionPatch(input, accounts, categories, updatedAt = new Date().toISOString()) {
  const amount = input.amount_baht === undefined ? undefined : bahtToSatang(input.amount_baht);
  if (amount === null) throw new ApiError(`Invalid amount: ${input.amount_baht}`);
  const category = input.category === undefined ? undefined : requireUniqueName(categories, input.category, "category");
  const account = input.account === undefined ? undefined : requireUniqueName(accounts, input.account, "account");
  const body = { amount, categoryId: category?.id, accountId: account?.id, txnDate: input.date, note: input.note, updatedAt };
  if (Object.values(body).filter((value) => value !== undefined).length < 2) {
    throw new ApiError("Supply at least one field to change");
  }
  return { body, names: { category: category?.name, account: account?.name } };
}

const NAME_FIELDS = [
  ["categoryId", "categoryName", "categories"], ["accountId", "accountName", "accounts"],
  ["fromAccountId", "fromAccountName", "accounts"], ["toAccountId", "toAccountName", "accounts"],
];

/** Copy of `value` with the name of every referenced category/account added. */
export function withNames(value, lists) {
  return NAME_FIELDS.reduce((named, [idKey, nameKey, list]) => value[idKey]
    ? { ...named, [nameKey]: lists[list]?.find((item) => item.id === value[idKey])?.name ?? null }
    : named, value);
}

// ponytail: O(n^2) pair scan within one month; fine for hundreds of rows, ignores pairs across months.
export function findDuplicates(transactions, windowDays) {
  const rows = transactions.filter((txn) => txn.kind !== "adjustment");
  const key = (txn) => [txn.type, txn.amount, txn.accountId, txn.fromAccountId, txn.toAccountId].join("|");
  const day = (txn) => Date.parse(txn.txnDate) / 86400000;
  return rows.flatMap((a, index) => rows.slice(index + 1)
    .filter((b) => key(a) === key(b) && Math.abs(day(a) - day(b)) <= windowDays)
    .map((b) => ({ ids: [a.id, b.id], type: a.type, amount: a.amount, dates: [a.txnDate, b.txnDate], notes: [a.note ?? null, b.note ?? null] })));
}

/** Today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayIn(timeZone = "Asia/Bangkok", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export class ApiError extends Error {
  constructor(message, code = "VALIDATION_ERROR", status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function paginationPath(path, cursor) {
  const page = new URL(path, "https://pagination.invalid");
  page.searchParams.set("limit", "200");
  if (cursor) page.searchParams.set("cursor", cursor);
  return `${page.pathname}${page.search}`;
}

async function parseResponse(res, path) {
  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(`Non-JSON response (${res.status}) from ${path}`, "INVALID_RESPONSE", res.status);
  }
  if (!res.ok || payload?.ok === false) {
    const msg = payload?.error?.message || `HTTP ${res.status}`;
    throw new ApiError(msg, payload?.error?.code || `HTTP_${res.status}`, res.status);
  }
  if (payload?.ok !== true || !Object.hasOwn(payload, "data")) {
    throw new ApiError(`Invalid API response from ${path}`, "INVALID_RESPONSE", res.status);
  }
  return payload;
}

/** Build a fetch-based client bound to a base URL + bearer token. */
export function createClient({ baseUrl, token, fetchImpl = fetch, timeoutMs = 15000 }) {
  if (!baseUrl) throw new ApiError("XPENSES_API_URL is required");
  if (!token) throw new ApiError("XPENSES_API_TOKEN is required");
  const root = baseUrl.replace(/\/$/, "");

  async function requestEnvelope(method, path, body) {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const res = await fetchImpl(`${root}${path}`, {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      return await parseResponse(res, path);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const code = signal.aborted ? "TIMEOUT" : "NETWORK_ERROR";
      const recovery = method !== "GET"
        ? "Write outcome unknown. Retry only with the same request_id and unchanged input."
        : "Retry this read when the API is reachable.";
      throw new ApiError(`${code === "TIMEOUT" ? "API request timed out" : "API connection failed"}. ${recovery}`, code);
    }
  }

  async function request(method, path, body) {
    return (await requestEnvelope(method, path, body)).data;
  }

  async function guardedWrite(method, path, body) {
    const payload = await requestEnvelope(method, path, body);
    if (payload.meta?.syncStatus === "skipped") {
      throw new ApiError("Write skipped: the server has a newer version of this record", "CONFLICT");
    }
    return payload.data;
  }

  async function getAll(path, cursor = null, collected = [], seen = []) {
    const payload = await requestEnvelope("GET", paginationPath(path, cursor));
    if (!Array.isArray(payload.data)) throw new ApiError("Paginated API data must be an array");

    const nextCursor = payload.meta?.nextCursor;
    if (nextCursor != null && typeof nextCursor !== "string") {
      throw new ApiError("Invalid pagination cursor from API");
    }

    const combined = [...collected, ...payload.data];
    if (!nextCursor) return combined;
    if (seen.includes(nextCursor)) throw new ApiError("API returned a repeated pagination cursor");
    return getAll(path, nextCursor, combined, [...seen, nextCursor]);
  }

  return {
    get: (path) => request("GET", path),
    getAll,
    post: (path, body) => request("POST", path, body),
    patch: (path, body) => guardedWrite("PATCH", path, body),
    del: (path, body) => guardedWrite("DELETE", path, body),
  };
}
