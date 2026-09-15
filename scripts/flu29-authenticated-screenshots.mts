#!/usr/bin/env npx tsx
/**
 * APPROVED-CORE-PAGE-SHARED-RENDERER-QUALITY-29 — authenticated live preview screenshots.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const TS = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const CK = `/home/inboxingproweb/recovery/approved-core-page-shared-renderer-quality-29-checkpoint-${TS}`;
const SHOT = path.join(CK, "screenshots");
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "flu-vaccinations";

function loadEnvFile(): Record<string, string> {
  const out: Record<string, string> = {};
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadSessionSecret(): string {
  for (const envFile of [".env.production", ".env"]) {
    const p = path.join(ROOT, envFile);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^SESSION_SECRET=(.+)$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  try {
    const requireCjs = createRequire(import.meta.url);
    const eco = requireCjs(path.join(ROOT, "ecosystem.config.cjs")) as {
      apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
    };
    return eco.apps?.[0]?.env?.SESSION_SECRET || "";
  } catch {
    return process.env.SESSION_SECRET || "";
  }
}

function resolveBaseAndToken(): { base: string; token: string } {
  const fileEnv = loadEnvFile();
  const token = loadSessionSecret().trim();
  const port = String(process.env.PORT || fileEnv.PORT || "3001").trim();
  if (!token) throw new Error("SESSION_SECRET not available for authenticated preview");
  return { base: `http://127.0.0.1:${port}`, token };
}

async function main() {
  fs.mkdirSync(path.join(SHOT, "desktop"), { recursive: true });
  fs.mkdirSync(path.join(SHOT, "mobile"), { recursive: true });
  fs.mkdirSync(path.join(SHOT, "live-html"), { recursive: true });
  fs.writeFileSync("/tmp/flu29-ck.txt", `CK=${CK}\n`);

  const { base, token } = resolveBaseAndToken();
  const t = encodeURIComponent(token);
  const routes = {
    reviewCentre: `${base}/api/growth-engine/review-centre?slug=${encodeURIComponent(SLUG)}&_t=${t}`,
    service: `${base}/api/pharmacy-visual-experience/${SERVICE}/?slug=${encodeURIComponent(SLUG)}&_t=${t}`,
    darfield: `${base}/api/pharmacy-content-ecosystem-preview/${SERVICE}/local/darfield/?slug=${encodeURIComponent(SLUG)}&_t=${t}`,
    cudworth: `${base}/api/pharmacy-content-ecosystem-preview/${SERVICE}/local/cudworth/?slug=${encodeURIComponent(SLUG)}&_t=${t}`,
  };

  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  for (const [name, url] of Object.entries(routes)) {
    for (const [mode, ctx] of [
      ["desktop", desktop],
      ["mobile", mobile],
    ] as const) {
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
      const html = await page.content();
      fs.writeFileSync(path.join(SHOT, "live-html", `${name}-${mode}.html`), html);
      await page.screenshot({
        path: path.join(SHOT, mode, `${name}.png`),
        fullPage: true,
      });
      await page.close();
    }
  }

  await browser.close();
  const manifest = {
    checkpoint: CK,
    screenshots: {
      desktop: [
        path.join(SHOT, "desktop", "reviewCentre.png"),
        path.join(SHOT, "desktop", "service.png"),
        path.join(SHOT, "desktop", "darfield.png"),
        path.join(SHOT, "desktop", "cudworth.png"),
      ],
      mobile: [
        path.join(SHOT, "mobile", "reviewCentre.png"),
        path.join(SHOT, "mobile", "service.png"),
        path.join(SHOT, "mobile", "darfield.png"),
        path.join(SHOT, "mobile", "cudworth.png"),
      ],
    },
    routes,
  };
  fs.writeFileSync(path.join(CK, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
