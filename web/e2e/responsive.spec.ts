import { expect, test } from "@playwright/test";

const transaction = {
  id: "11111111-1111-4111-8111-111111111111", type: "expense", amount: 12000,
  note: "Lunch", categoryId: "22222222-2222-4222-8222-222222222222",
  accountId: "33333333-3333-4333-8333-333333333333", txnDate: "2026-09-04",
  updatedAt: "2026-09-04T00:00:00.000Z",
};

const reportSpend = [
  "Food", "Transport", "Shopping", "Bills", "Health", "Travel", "Gifts", "Other",
].map((name, index) => ({
  categoryId: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
  name,
  total: 12000 - index * 1000,
}));

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith("/auth/me")) data = { id: "user", email: "owner@example.test" };
    if (path.endsWith("/accounts")) data = [{ id: transaction.accountId, name: "Cash", type: "cash", balance: 500000 }];
    if (path.endsWith("/categories")) data = [{ id: transaction.categoryId, name: "Food" }];
    if (path.includes("/transactions")) data = [transaction];
    if (path.includes("/reports/summary")) data = { accounts: [], monthIncome: 0, monthExpense: 12000, monthNet: -12000 };
    if (path.includes("/reports/category-spend")) data = reportSpend;
    await route.fulfill({ json: { ok: true, data, meta: { nextCursor: null } } });
  });
});

test("shell and ledger fit the viewport", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => message.type() === "error" && pageErrors.push(message.text()));
  page.on("requestfailed", (request) => pageErrors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto("/ledger?month=2026-09");
  await page.waitForTimeout(500);
  expect(pageErrors).toEqual([]);
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  const body = await page.locator("body").boundingBox();
  expect(body?.width).toBeLessThanOrEqual(testInfo.project.use.viewport!.width);
  const viewport = testInfo.project.use.viewport!;
  const wide = viewport.width >= 768 && viewport.height >= 640;
  const nav = await page.getByRole("navigation", { name: "Primary" }).boundingBox();
  if (wide) {
    expect(nav!.x).toBeLessThan(2);
    expect(nav!.height).toBeGreaterThan(viewport.height * 0.9);
  } else {
    expect(nav!.y + nav!.height).toBeGreaterThan(viewport.height * 0.98);
  }
  const details = page.getByRole("complementary", { name: "Transaction details" });
  if (wide) {
    await expect(details).toBeVisible();
    const listBox = await page.locator(".ledger__list").boundingBox();
    const detailBox = await details.boundingBox();
    const listShare = listBox!.width / (listBox!.width + detailBox!.width);
    expect(listShare).toBeGreaterThan(0.5);
    expect(listShare).toBeLessThan(0.54);
  } else await expect(details).toHaveCount(0);
  await page.getByRole("button", { name: "Add transaction" }).click();
  const panel = await page.getByRole("dialog", { name: "New transaction" }).boundingBox();
  if (wide) {
    expect(panel!.x).toBeGreaterThan(viewport.width * 0.5);
    expect(panel!.height).toBeGreaterThan(viewport.height * 0.9);
  } else {
    expect(panel!.width).toBeGreaterThan(viewport.width * 0.9);
    expect(panel!.y + panel!.height).toBeGreaterThan(viewport.height * 0.98);
  }
  await page.screenshot({ path: testInfo.outputPath("ledger.png"), fullPage: true });
});

test("primary routes stay inside the viewport", async ({ page }, testInfo) => {
  const routes = [
    ["/", "Your overview", "dashboard"],
    ["/ledger?month=2026-09", "Transactions", "ledger"],
    ["/reports", "Reports", "reports"],
    ["/settings", "Settings", "settings"],
  ] as const;
  for (const [path, heading, name] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    if (name === "dashboard") await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    if (name === "reports") await expect(page.getByRole("heading", { name: "By category" })).toBeVisible();
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `${name} horizontal overflow`).toBeLessThanOrEqual(0);
    if (name === "dashboard" && testInfo.project.use.viewport!.width >= 640) {
      const accounts = await page.getByRole("heading", { name: "Accounts" }).locator("..").boundingBox();
      const budgets = await page.getByRole("heading", { name: "Budgets" }).locator("..").boundingBox();
      expect(Math.abs(accounts!.y - budgets!.y)).toBeLessThan(2);
      const spend = await page.getByRole("heading", { name: "Where it went" }).locator("..").boundingBox();
      expect(spend!.width).toBeGreaterThan(accounts!.width * 1.8);
    }
    if (name === "reports") {
      const chart = await page.locator(".rcard--chart").boundingBox();
      const summary = await page.locator(".rstats--summary").boundingBox();
      const gap = summary!.y - (chart!.y + chart!.height);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(20);
      if (testInfo.project.use.viewport!.width >= 768 && testInfo.project.use.viewport!.height >= 640) {
        const categories = await page.locator(".rcard--categories").boundingBox();
        const heatmap = await page.locator(".reports__heatmap").boundingBox();
        expect(Math.abs(chart!.y - categories!.y)).toBeLessThan(2);
        expect(heatmap!.width).toBeGreaterThan(chart!.width * 1.8);
      }
    }
    if (name === "settings") {
      const download = await page.getByRole("link", { name: "Download CSV" }).boundingBox();
      expect(download!.height).toBeGreaterThanOrEqual(44);
      expect(download!.height).toBeLessThanOrEqual(48);
      if (testInfo.project.use.viewport!.width >= 640) {
        expect(download!.width).toBeLessThan(testInfo.project.use.viewport!.width * 0.4);
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  }
});

test("rotation keeps an open transaction draft", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("ipad-mini-portrait"));
  await page.goto("/ledger?month=2026-09");
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByLabel("Amount in baht").fill("123");
  await page.setViewportSize({ width: 1133, height: 744 });
  await expect(page.getByLabel("Amount in baht")).toHaveValue("123");
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCSS("height", "744px");
  const panel = await page.getByRole("dialog", { name: "New transaction" }).boundingBox();
  expect(panel!.x).toBeGreaterThan(1133 * 0.5);
});

test("dark mode persists with compact iOS display type", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("xpenses.theme.v1")) localStorage.setItem("xpenses.theme.v1", "dark");
  });

  for (const [path, name] of [["/", "dashboard"], ["/ledger", "ledger"], ["/reports", "reports"], ["/settings", "settings"]] as const) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    if (name === "dashboard") await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    if (name === "reports") await expect(page.getByRole("heading", { name: "By category" })).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`${name}-dark.png`), fullPage: true });
  }

  await expect(page.locator("#theme-color")).toHaveAttribute("content", "#17151d");
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--t-hero").trim())).toBe("2.125rem");
  await expect(page.getByLabel("From")).toHaveCSS("font-size", "16px");

  await page.getByRole("radio", { name: "Light" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
});
