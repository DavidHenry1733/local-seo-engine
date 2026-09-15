#!/usr/bin/env npx tsx
/**
 * FLU-APPROVED-BANK-COPY-QUALITY-28A — authenticated live preview screenshots.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const CK = fs.readFileSync("/tmp/flu28a-ck.txt", "utf8").trim().replace(/^CK=/, "");
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

  const { base, token } = resolveBaseAndToken();
  const t = encodeURIComponent(token);
  const routes = {
    service: `${base}/api/pharmacy-visual-experience/${SERVICE}/?slug=${encodeURIComponent(SLUG)}&_t=${t}`,
    darfield: `${base}/api/pharmacy-content-ecosystem-preview/${SERVICE}/local/darfield/?slug=${encodeURIComponent(SLUG)}&_t=${t}`,
    cudworth: `${base}/api/pharmacy-content-ecosystem-preview/${SERVICE}/local/cudworth/?slug=${encodeURIComponent(SLUG)}&_t=${t}`,
  };

  const browser = await chromium.launch({ headless: true });
  const results: unknown[] = [];

  for (const [name, url] of Object.entries(routes)) {
    for (const viewport of [
      { dir: "desktop", width: 1440, height: 900 },
      { dir: "mobile", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      const status = res?.status() || 0;
      const finalUrl = page.url();
      const redirectedToLogin = /\/api\/login/i.test(finalUrl);
      const html = await page.content();
      if (viewport.dir === "desktop") {
        fs.writeFileSync(path.join(SHOT, "live-html", `${name}.html`), html);
      }
      const out = path.join(SHOT, viewport.dir, `${name}.png`);
      await page.screenshot({ path: out, fullPage: true });
      results.push({
        name,
        viewport: viewport.dir,
        status,
        redirectedToLogin,
        out,
        htmlBytes: html.length,
        authOk: status === 200 && !redirectedToLogin && !/sign in|log in/i.test(html.slice(0, 2000)),
      });
      await page.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(SHOT, "manifest.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ ok: results.every((r) => (r as { authOk?: boolean }).authOk), results }, null, 2));
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
