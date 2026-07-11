// Money is integer satang everywhere. 1 THB = 100 satang. Never floats in state.
// Parse/format only at the display edge.

export const SATANG_PER_BAHT = 100;

/** Parse a user-typed baht string ("120", "12.50", "1,299.9") to integer satang. */
export function bahtToSatang(input: string): number | null {
  const cleaned = input.replace(/[,\s฿]/g, "").trim();
  if (cleaned === "" || cleaned === ".") return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = (frac + "00").slice(0, 2); // truncate beyond 2dp, don't round up silently
  const satang = Number(whole || "0") * SATANG_PER_BAHT + Number(paise);
  return Number.isFinite(satang) ? satang : null;
}

/** Satang -> baht number, for formatting only. */
export function satangToBaht(satang: number): number {
  return satang / SATANG_PER_BAHT;
}

const thb = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format satang as THB with grouping, no currency symbol. e.g. 129990 -> "1,299.90" */
export function formatSatang(satang: number): string {
  return thb.format(satangToBaht(Math.abs(satang)));
}

/** Signed display: "+฿1,200.00" / "-฿120.00". */
export function formatSigned(satang: number): string {
  const sign = satang < 0 ? "-" : satang > 0 ? "+" : "";
  return `${sign}฿${formatSatang(satang)}`;
}
