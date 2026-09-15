#!/usr/bin/env node
/**
 * Standalone Image Prompts page validation report.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/standalone-image-prompts-page-report.json");
const TOKEN = process.env.IPD_DASHBOARD_TOKEN || "local-seo-engine-production-secret-change-later-2026";
const SLUG = process.env.IPD_DASHBOARD_SLUG || "inboxingproweb";
const BASE = process.env.IPD_API_BASE || "http://127.0.0.1:3000";
const PAGE_URL = `${BASE}/api/image-prompts?slug=${encodeURIComponent(SLUG)}&_t=${encodeURIComponent(TOKEN)}`;

const REQUIRED_PROMPT_KEYS = [
  "pharmacy-first-consultation",
  "minor-illness-advice",
  "blood-pressure-check",
  "nhs-service-support",
];

const REQUIRED_STRINGS = [
  "pharmacy-first-consultation",
  "minor-illness-advice",
  "Copy Prompt",
  "Copy Negative Prompt",
  "Copy Both",
  "Download JSON",
  "Download Prompt Pack",
  "Pharmacy First",
  "Ear Wax Removal",
  "sip-textarea",
];

function pm2RestartTime() {
  try {
    const out = execSync("pm2 show local-seo-engine 2>/dev/null", { encoding: "utf8" });
    const m = out.match(/created at\s+\│\s+([^\│]+)/);
    return m ? m[1].trim() : "unknown";
  } catch {
    return "unknown";
  }
}

async function main() {
  const issues = [];
  let html = "";
  try {
    const res = await fetch(PAGE_URL);
    html = await res.text();
    if (!res.ok) issues.push(`Page HTTP ${res.status}`);
  } catch (err) {
    issues.push(`Page fetch failed: ${err.message}`);
  }

  for (const s of REQUIRED_STRINGS) {
    if (!html.includes(s)) issues.push(`Missing in served HTML: ${s}`);
  }

  for (const key of REQUIRED_PROMPT_KEYS) {
    if (!html.includes(key)) issues.push(`Default prompt key missing: ${key}`);
  }

  const dashPath = join(ROOT, "artifacts/api-server/src/routes/dashboard.ts");
  const dash = readFileSync(dashPath, "utf8");
  const dashboardLinkAdded =
    dash.includes("Open Standalone Prompt Page") && dash.includes("/api/image-prompts");

  if (!dashboardLinkAdded) issues.push("Dashboard link to standalone page not found");

  const distPath = join(ROOT, "artifacts/api-server/dist/index.mjs");
  const distTs = existsSync(distPath) ? statSync(distPath).mtime.toISOString() : "missing";

  const pass = issues.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    result: pass
      ? "PASS: Standalone Image Prompts Page Complete"
      : "FAIL: Standalone Image Prompts Page Requires Investigation",
    standalonePageUrl: PAGE_URL,
    defaultPromptsVisible: REQUIRED_PROMPT_KEYS.every((k) => html.includes(k)),
    defaultPromptKeys: REQUIRED_PROMPT_KEYS.filter((k) => html.includes(k)),
    copyButtonsPresent:
      html.includes("Copy Prompt") &&
      html.includes("Copy Negative Prompt") &&
      html.includes("Copy Both"),
    downloadButtonsPresent:
      html.includes("Download JSON") && html.includes("Download Prompt Pack"),
    dashboardLinkAdded,
    browserFallbackStatus: {
      serverRenderedTextareas: html.includes("sip-textarea"),
      manualCopyHint: html.includes("select and copy manually") || html.includes("Select text"),
      noDashboardTabDependency: !html.includes("ipdLoadPromptPanel"),
      formGetReload: html.includes('method="GET"') && html.includes('action="/api/image-prompts"'),
    },
    distBuildTimestamp: distTs,
    pm2RestartTimestamp: pm2RestartTime(),
    validationNotes: { issues },
  };

  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(report.result);
  console.log("Report:", REPORT_OUT);
  console.log("URL:", PAGE_URL);
  if (issues.length) {
    issues.forEach((i) => console.error(" -", i));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
