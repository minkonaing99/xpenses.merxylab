// Thin, envelope-aware HTTP client for the xpenses API, plus the pure helpers
// the create-expense tool needs. Money is integer satang end to end.

/** Parse a baht amount (number or "1,299.50") to integer satang, or null. */
export function bahtToSatang(input) {
  const cleaned = String(input).replace(/[,\s฿]/g, "").trim();
  if (cleaned === "" || cleaned === ".") return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = (frac + "00").slice(0, 2); // truncate beyond 2dp
  const satang = Number(whole || "0") * 100 + Number(paise);
  return Number.isFinite(satang) && satang > 0 ? satang : null;
}

/** Resolve a free-text name to one of `items` (by .name): exact, prefix, then substring. */
export function matchByName(items, query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  return (
    items.find((i) => i.name.toLowerCase() === q) ||
    items.find((i) => i.name.toLowerCase().startsWith(q)) ||
    items.find((i) => i.name.toLowerCase().includes(q)) ||
    null
  );
}

/** Today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayIn(timeZone = "Asia/Bangkok", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export class ApiError extends Error {}

/** Build a fetch-based client bound to a base URL + bearer token. */
export function createClient({ baseUrl, token, fetchImpl = fetch }) {
  if (!baseUrl) throw new ApiError("XPENSES_API_URL is required");
  if (!token) throw new ApiError("XPENSES_API_TOKEN is required");
  const root = baseUrl.replace(/\/$/, "");

  async function request(method, path, body) {
    const res = await fetchImpl(`${root}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(`Non-JSON response (${res.status}) from ${path}`);
    }
    if (!res.ok || payload.ok === false) {
      const msg = payload?.error?.message || `HTTP ${res.status}`;
      throw new ApiError(msg);
    }
    return payload.data;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
  };
}
