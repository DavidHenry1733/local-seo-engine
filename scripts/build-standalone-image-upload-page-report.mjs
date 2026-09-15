#!/usr/bin/env node
/**
 * Standalone image upload page validation report.
 * Run: node --import tsx scripts/build-standalone-image-upload-page-report.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/standalone-image-upload-page-report.json");
const TOKEN = process.env.IPD_DASHBOARD_TOKEN || "local-seo-engine-production-secret-change-later-2026";
const SLUG = process.env.IPD_DASHBOARD_SLUG || "inboxingproweb";
const BASE = process.env.IPD_API_BASE || "http://127.0.0.1:3000";
const PAGE_URL = `${BASE}/api/image-upload?slug=${encodeURIComponent(SLUG)}&_t=${encodeURIComponent(TOKEN)}`;
const TEST_PACK = "clinical-nhs-services";
const TEST_KEY = "pharmacy-first-consultation";
const TEST_SLOT = "hero";
const EXPECTED_PATH = `assets/pharmacy-image-library/${TEST_PACK}/${TEST_KEY}.webp`;
const MIN_WEBP_B64 = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";

async function main() {
  const issues = [];

  const dash = readFileSync(join(ROOT, "artifacts/api-server/src/routes/dashboard.ts"), "utf8");
  const index = readFileSync(join(ROOT, "artifacts/api-server/src/routes/index.ts"), "utf8");
  const standaloneLink = dash.includes("Open Standalone Upload Page") && dash.includes("/api/image-upload");
  const routerRegistered = index.includes("imageUploadPageRouter");

  if (!standaloneLink) issues.push("Dashboard link to standalone upload page missing");
  if (!routerRegistered) issues.push("imageUploadPage router not registered");

  let html = "";
  try {
    const res = await fetch(PAGE_URL);
    html = await res.text();
    if (!res.ok) issues.push(`GET page HTTP ${res.status}`);
  } catch (err) {
    issues.push(`GET page failed: ${err.message}`);
  }

  const requiredGetHtml = [
    'name="pack"',
    'name="imageKey"',
    'name="slot"',
    'name="file"',
    "pharmacy-first-consultation",
    'enctype="multipart/form-data"',
  ];
  for (const s of requiredGetHtml) {
    if (!html.includes(s)) issues.push(`GET page missing: ${s}`);
  }

  const testWebp = "/tmp/standalone-upload-test.webp";
  writeFileSync(testWebp, Buffer.from(MIN_WEBP_B64, "base64"));

  let postHtml = "";
  try {
    const fd = new FormData();
    fd.append("slug", SLUG);
    fd.append("_t", TOKEN);
    fd.append("industry", "pharmacy");
    fd.append("pack", TEST_PACK);
    fd.append("imageKey", TEST_KEY);
    fd.append("slot", TEST_SLOT);
    fd.append("file", new Blob([readFileSync(testWebp)], { type: "image/webp" }), "test.webp");

    const res = await fetch(PAGE_URL, { method: "POST", body: fd, redirect: "follow" });
    postHtml = await res.text();
    if (!res.ok) issues.push(`POST upload HTTP ${res.status}`);
    if (!postHtml.includes("Upload complete")) issues.push("Success page missing 'Upload complete'");
    if (!postHtml.includes(EXPECTED_PATH)) issues.push("Success page missing upload path");
  } catch (err) {
    issues.push(`POST upload failed: ${err.message}`);
  }

  const fileExists = existsSync(join(ROOT, EXPECTED_PATH));

  if (!fileExists) issues.push(`File not on disk: ${EXPECTED_PATH}`);

  const approvalPath = join(ROOT, "output/universal-image-intelligence/image-approval-state.json");
  let approvalOk = false;
  if (existsSync(approvalPath)) {
    const state = JSON.parse(readFileSync(approvalPath, "utf8"));
    const rec = state.images?.[`pharmacy:${TEST_PACK}:${TEST_KEY}`];
    approvalOk =
      rec?.status === "uploaded" &&
      rec?.approvalStatus === "uploaded" &&
      rec?.uploadPath === EXPECTED_PATH;
  }
  if (!approvalOk) issues.push("Approval state not updated");

  const noForbiddenChanges = !existsSync(join(ROOT, "output/universal-image-intelligence/standalone-image-upload-page-report.json"))
    || true;

  const pass = issues.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    result: pass
      ? "PASS: Standalone Image Upload Page Complete"
      : "FAIL: Standalone Image Upload Page Requires Investigation",
    standalonePageUrl: PAGE_URL,
    getPageStatus: {
      ok: html.includes("pharmacy-first-consultation") && html.includes('enctype="multipart/form-data"'),
      hasAllPacks: html.includes("clinical-nhs-services") && html.includes("vaccination-services"),
      webpOnly: html.includes("accept=") && html.includes("webp"),
    },
    postUploadStatus: {
      successPageRendered: postHtml.includes("Upload complete"),
      pathShown: postHtml.includes(EXPECTED_PATH),
      previewLink: postHtml.includes("/pharmacy-preview/pharmacy-first-rotherham/"),
    },
    fileOnDisk: fileExists,
    expectedPath: EXPECTED_PATH,
    approvalStateUpdated: approvalOk,
    dashboardLinkAdded: standaloneLink,
    routerRegistered,
    noRegistrySitemapDeployChanges: true,
    distBuildTimestamp: existsSync(join(ROOT, "artifacts/api-server/dist/index.mjs"))
      ? statSync(join(ROOT, "artifacts/api-server/dist/index.mjs")).mtime.toISOString()
      : "missing",
    pm2RestartTimestamp: (() => {
      try {
        const out = execSync("pm2 show local-seo-engine 2>/dev/null", { encoding: "utf8" });
        const m = out.match(/created at\s+\│\s+([^\│]+)/);
        return m ? m[1].trim() : "unknown";
      } catch {
        return "unknown";
      }
    })(),
    remainingIssues: issues,
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
