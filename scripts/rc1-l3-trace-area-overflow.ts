#!/usr/bin/env npx tsx
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import { chromium } from "playwright";
import { createRequire } from "node:module";
import path from "node:path";

const EXEC = "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";
const requireCjs = createRequire(import.meta.url);
const eco = requireCjs(path.join(import.meta.dirname, "../ecosystem.config.cjs")) as {
  apps?: Array<{ name?: string; env?: { SESSION_SECRET?: string } }>;
};
const secret = eco.apps?.find((a) => a.name === "pharmaconnect-growth-engine")?.env?.SESSION_SECRET || "";
const url =
  "http://127.0.0.1:3001/api/pharmacy-visual-experience/local-sheffield-city-centre/?slug=banner-cross-pharmacy";

async function main() {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true });
  for (const width of [320, 390]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 800 },
      extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const data = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const offenders: Record<string, unknown>[] = [];
      for (const el of document.querySelectorAll("html, body, body *")) {
        const rect = el.getBoundingClientRect();
        const sw = (el as HTMLElement).scrollWidth;
        if (rect.right <= vw + 0.5 && sw <= vw + 0.5) continue;
        const cs = getComputedStyle(el);
        const cls =
          typeof el.className === "string" && el.className
            ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".")
            : "";
        offenders.push({
          sel: `${el.tagName.toLowerCase()}${cls}`,
          right: Math.round(rect.right),
          rectW: Math.round(rect.width),
          scrollW: sw,
          minW: cs.minWidth,
          maxW: cs.maxWidth,
          width: cs.width,
          padL: cs.paddingLeft,
          padR: cs.paddingRight,
          marginL: cs.marginLeft,
          marginR: cs.marginRight,
          display: cs.display,
          grid: cs.gridTemplateColumns,
          flex: cs.flexWrap,
          whiteSpace: cs.whiteSpace,
        });
      }
      offenders.sort((a, b) => (b.right as number) - (a.right as number));
      return {
        docSW: document.documentElement.scrollWidth,
        vw,
        bodyDS: document.body.getAttribute("data-publish-source"),
        hasLocalStyles: Boolean(document.querySelector('style[data-pharmacy-local-responsive="1"]')),
        top: offenders.slice(0, 12),
      };
    });
    console.log(`\n=== ${width}px ===`);
    console.log(JSON.stringify(data, null, 2));
    await ctx.close();
  }
  await browser.close();
}

main();
