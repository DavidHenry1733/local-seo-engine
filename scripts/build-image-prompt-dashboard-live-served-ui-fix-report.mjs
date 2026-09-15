#!/usr/bin/env node
/**
 * Live served Image Prompt Dashboard UI verification report.
 * Run: node scripts/build-image-prompt-dashboard-live-served-ui-fix-report.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(
  ROOT,
  "output/universal-image-intelligence/image-prompt-dashboard-live-served-ui-fix-report.json",
);
const TOKEN = process.env.IPD_DASHBOARD_TOKEN || "local-seo-engine-production-secret-change-later-2026";
const BASE = process.env.IPD_API_BASE || "http://127.0.0.1:3000";
const SLUG = process.env.IPD_DASHBOARD_SLUG || "inboxingproweb";
const DASH_URL = `${BASE}/api/dashboard?slug=${encodeURIComponent(SLUG)}&_t=${encodeURIComponent(TOKEN)}`;

const REQUIRED_MARKERS = [
  "ipd-live-debug",
  "ipdApiPath",
  "IPD_DASHBOARD_BUILD_TS",
  "data-ipd-action",
  "Copy Prompt",
  "pharmacy-first",
  "ipd-prompts-output",
  "ipdLoadPromptsForFilters",
  "IPD_FALLBACK_SERVICES",
];

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, error: "non-json", preview: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

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
  const distPath = join(ROOT, "artifacts/api-server/dist/index.mjs");
  const distMtime = existsSync(distPath) ? statSync(distPath).mtime.toISOString() : "missing";

  let servedHtml = "";
  try {
    const res = await fetch(DASH_URL);
    servedHtml = await res.text();
    if (!res.ok) issues.push(`Dashboard fetch HTTP ${res.status}`);
  } catch (err) {
    issues.push(`Dashboard fetch failed: ${err.message}`);
  }

  const markerResults = Object.fromEntries(
    REQUIRED_MARKERS.map((m) => [m, servedHtml.includes(m)]),
  );
  const servedContainsLatest = REQUIRED_MARKERS.every((m) => markerResults[m]);
  if (!servedContainsLatest) {
    issues.push("LIVE DASHBOARD STALE — BUILD/ROUTE SERVING OLD CODE");
    for (const [m, ok] of Object.entries(markerResults)) {
      if (!ok) issues.push(`Missing served marker: ${m}`);
    }
  }

  const meta = await fetchJson(
    `${BASE}/api/image-prompt-dashboard/meta?_t=${encodeURIComponent(TOKEN)}`,
  );
  const prompts = await fetchJson(
    `${BASE}/api/image-prompt-dashboard/prompts?_t=${encodeURIComponent(TOKEN)}&industry=pharmacy&templateFamily=clinical-nhs-services&serviceKey=pharmacy-first&pack=clinical-nhs-services`,
  );

  const metaOk = meta.ok && meta.data?.servicesByTemplateFamily?.["clinical-nhs-services"]?.some(
    (s) => s.serviceKey === "pharmacy-first",
  );
  const metaFeatured = meta.ok && (meta.data?.featuredHubServices ?? []).some(
    (s) => s.serviceKey === "pharmacy-first",
  );
  const promptCount = prompts.ok ? (prompts.data?.prompts?.length ?? 0) : 0;
  const promptsOk = prompts.ok && promptCount === 4;

  if (!metaOk) issues.push("Meta API missing servicesByTemplateFamily pharmacy-first");
  if (!metaFeatured) issues.push("Meta API missing featuredHubServices pharmacy-first");
  if (!promptsOk) issues.push(`Prompts API expected 4 prompts, got ${promptCount} (status ${prompts.status})`);

  const buildTsMatch = servedHtml.match(/IPD_DASHBOARD_BUILD_TS = "([^"]+)"/);
  const dashboardBuildTimestamp = buildTsMatch ? buildTsMatch[1] : "not found in served HTML";

  const pass = issues.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    result: pass
      ? "PASS: Live Image Prompt Dashboard Verified In Served HTML"
      : "FAIL: Live Dashboard Still Not Serving Prompt UI",
    servedHtmlContainsLatestCode: servedContainsLatest,
    markerResults,
    metaApiStatus: {
      httpStatus: meta.status ?? null,
      ok: metaOk,
      featuredHubServices: metaFeatured,
      hasServicesByTemplateFamily: !!(meta.data?.servicesByTemplateFamily),
    },
    promptsApiStatus: {
      httpStatus: prompts.status ?? null,
      ok: promptsOk,
      promptCount,
    },
    browserFallbackStatus: {
      htmlPreseededServiceOptions: servedHtml.includes('value="pharmacy-first"') && servedHtml.includes("Ear Wax Removal"),
      ipdFallbackServices: markerResults["IPD_FALLBACK_SERVICES"],
      ipdLiveDebugPanel: markerResults["ipd-live-debug"],
      ipdApiPathAuthToken: markerResults["ipdApiPath"],
      immediateDefaultPromptLoad: markerResults["ipdLoadPromptsForFilters"],
      manualTextareaCopyHint: servedHtml.includes("Select text below to copy manually"),
    },
    dashboardBuildTimestamp,
    distBuildTimestamp: distMtime,
    pm2RestartTimestamp: pm2RestartTime(),
    dashboardOpenUrl: DASH_URL,
    validationNotes: {
      rootCauseFixed: "ipdFetch now appends INTERNAL_TOKEN (_t) like apiFetch — unauthenticated fetches were returning 401/302",
      issues,
    },
  };

  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(report.result);
  console.log("Report:", REPORT_OUT);
  console.log("Open:", DASH_URL);
  if (issues.length) {
    issues.forEach((i) => console.error(" -", i));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
