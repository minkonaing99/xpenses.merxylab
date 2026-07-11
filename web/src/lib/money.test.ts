import { describe, expect, it } from "vitest";
import { bahtToSatang, formatSatang, formatSigned } from "./money";

describe("bahtToSatang", () => {
  it("parses whole baht", () => expect(bahtToSatang("120")).toBe(12000));
  it("parses decimals", () => expect(bahtToSatang("12.50")).toBe(1250));
  it("parses one decimal place", () => expect(bahtToSatang("12.5")).toBe(1250));
  it("strips grouping and symbol", () => expect(bahtToSatang("1,299.90")).toBe(129990));
  it("strips ฿", () => expect(bahtToSatang("฿99")).toBe(9900));
  it("truncates beyond 2dp, no float error", () => expect(bahtToSatang("0.019")).toBe(1));
  it("rejects empty", () => expect(bahtToSatang("")).toBeNull());
  it("rejects letters", () => expect(bahtToSatang("12a")).toBeNull());
  it("rejects lone dot", () => expect(bahtToSatang(".")).toBeNull());
});

describe("formatSatang / formatSigned", () => {
  it("groups thousands", () => expect(formatSatang(129990)).toBe("1,299.90"));
  it("uses absolute value", () => expect(formatSatang(-500)).toBe("5.00"));
  it("signs negative", () => expect(formatSigned(-12000)).toBe("-฿120.00"));
  it("signs positive", () => expect(formatSigned(12000)).toBe("+฿120.00"));
  it("no sign for zero", () => expect(formatSigned(0)).toBe("฿0.00"));
});
