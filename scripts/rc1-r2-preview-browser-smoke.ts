#!/usr/bin/env npx tsx
import { chromium } from "playwright";

async function main(): Promise<void> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error("SESSION_SECRET required");
    process.exit(1);
  }
  const url =
    process.env.RC1_R2_PREVIEW_URL ||
    "http://127.0.0.1:3001/api/pharmacy-visual-experience/?slug=banner-cross-pharmacy";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${secret}` },
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => failed.push(r.url()));
  const resp = await page.goto(url, { waitUntil: "networkidle" });
  await page.hover(".nav-dropdown");
  const menuVisible = await page
    .locator(".nav-dropdown-menu")
    .evaluate((el) => getComputedStyle(el).display !== "none")
    .catch(() => false);
  const header = (await page.locator("header, .site-header, [data-component=\"brand-header\"]").count()) > 0;
  const footer = (await page.locator("footer, .site-footer, [data-component=\"brand-footer\"]").count()) > 0;
  const logo = (await page.locator(".brand img, img[alt*=\"Banner Cross\"]").count()) > 0;
  console.log(
    JSON.stringify(
      {
        status: resp?.status() ?? 0,
        menuVisible,
        header,
        footer,
        logo,
        consoleErrors,
        failed,
      },
      null,
      2,
    ),
  );
  await browser.close();
  if ((resp?.status() ?? 0) !== 200 || !menuVisible || !header || !footer || !logo || consoleErrors.length || failed.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
