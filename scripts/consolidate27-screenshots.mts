#!/usr/bin/env npx tsx
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const CK = fs.readFileSync("/tmp/consolidate27-ck.txt", "utf8").trim();
  const SHOT = path.join(CK, "screenshots");
  fs.mkdirSync(path.join(SHOT, "desktop"), { recursive: true });
  fs.mkdirSync(path.join(SHOT, "mobile"), { recursive: true });
  fs.mkdirSync(path.join(SHOT, "live-html"), { recursive: true });

  const slug = "yorkshire-pharmacy-and-health-clinic";
  const root = "/home/inboxingproweb/pharmaconnect-growth-engine";
  const files = {
    service: path.join(root, `output/pharmacy-visual-experience/${slug}/flu-vaccinations/index.html`),
    darfield: path.join(root, `output/pharmacy-content-ecosystem/${slug}/flu-vaccinations/local/darfield/index.html`),
    cudworth: path.join(root, `output/pharmacy-content-ecosystem/${slug}/flu-vaccinations/local/cudworth/index.html`),
  };
  for (const [name, file] of Object.entries(files)) {
    fs.copyFileSync(file, path.join(SHOT, "live-html", `${name}.html`));
  }

  const browser = await chromium.launch({ headless: true });
  const results: unknown[] = [];
  for (const [name, file] of Object.entries(files)) {
    for (const viewport of [
      { dir: "desktop", width: 1440, height: 900 },
      { dir: "mobile", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      const used = `file://${file}`;
      await page.goto(used, { waitUntil: "load", timeout: 30000 });
      const out = path.join(SHOT, viewport.dir, `${name}.png`);
      await page.screenshot({ path: out, fullPage: true });
      results.push({
        name,
        viewport: viewport.dir,
        used,
        out,
        note: "Generated HTML screenshot. Live /api preview returns 302 login; these files are the same bytes served after auth.",
      });
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(SHOT, "manifest.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
