// Date + label helpers. App TZ is Asia/Bangkok for display.

const TZ = "Asia/Bangkok";

/** Current month as YYYY-MM in Bangkok time (drives all month-scoped queries). */
export function currentMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

/** Today as YYYY-MM-DD in Bangkok time (default txn_date). */
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "July 2026" for a YYYY-MM. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Group header for a txn_date: "Today", "Yesterday", or "Fri, 11 Jul". */
export function dayLabel(isoDate: string, now = new Date()): string {
  if (isoDate === today(now)) return "Today";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const yest = new Date(Date.UTC(y, m - 1, d + 1));
  if (today(yest) === today(now)) return "Yesterday";
  return dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
