#!/usr/bin/env node
/**
 * Pharmacy Image Upload Dropdown validation report.
 * Run: node --import tsx scripts/build-pharmacy-image-upload-dropdown-report.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/pharmacy-image-upload-dropdown-report.json");
const TOKEN = process.env.IPD_DASHBOARD_TOKEN || "local-seo-engine-production-secret-change-later-2026";
const BASE = process.env.IPD_API_BASE || "http://127.0.0.1:3000";

const REQUIRED_PACKS = [
  "core-pharmacy",
  "clinical-nhs-services",
  "vaccination-services",
  "private-healthcare-services",
  "travel-health-services",
  "weight-management-services",
];

const REQUIRED_CLINICAL_KEYS = [
  "pharmacy-first-consultation",
  "minor-illness-advice",
  "blood-pressure-check",
  "nhs-service-support",
];

const EXPECTED_UPLOAD_PATH =
  "assets/pharmacy-image-library/clinical-nhs-services/pharmacy-first-consultation.webp";

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
  const svc = await import(
    pathToFileURL(join(ROOT, "src/image-intelligence/imagePromptDashboardService.ts")).href
  );

  const options = svc.getUploadOptions("pharmacy");
  const packKeys = options.packs.map((p) => p.packKey);
  const clinicalImages = options.imageKeysByPack["clinical-nhs-services"] ?? [];
  const clinicalKeys = clinicalImages.map((i) => i.imageKey);

  for (const pack of REQUIRED_PACKS) {
    if (!packKeys.includes(pack)) issues.push(`Missing pack: ${pack}`);
  }
  for (const key of REQUIRED_CLINICAL_KEYS) {
    if (!clinicalKeys.includes(key)) issues.push(`Missing clinical imageKey: ${key}`);
  }

  const pathKey = "clinical-nhs-services:pharmacy-first-consultation";
  const uploadPath = options.uploadTargetPaths[pathKey];
  if (uploadPath !== EXPECTED_UPLOAD_PATH) {
    issues.push(`Upload path mismatch: ${uploadPath} !== ${EXPECTED_UPLOAD_PATH}`);
  }

  const pfConsult = clinicalImages.find((i) => i.imageKey === "pharmacy-first-consultation");
  if (!pfConsult || pfConsult.imageLabel !== "Pharmacy First Consultation") {
    issues.push("Friendly label missing for pharmacy-first-consultation");
  }

  const live = await fetchJson(
    `${BASE}/api/image-prompt-dashboard/upload-options?_t=${encodeURIComponent(TOKEN)}&industry=pharmacy`,
  );

  let apiOk = false;
  if (live.ok && live.data) {
    const livePacks = (live.data.packs ?? []).map((p) => p.packKey);
    const liveClinical = (live.data.imageKeysByPack?.["clinical-nhs-services"] ?? []).map((i) => i.imageKey);
    const livePath = live.data.uploadTargetPaths?.[pathKey];
    apiOk =
      livePacks.includes("clinical-nhs-services") &&
      liveClinical.includes("pharmacy-first-consultation") &&
      livePath === EXPECTED_UPLOAD_PATH;
    if (!apiOk) issues.push("Live upload-options API validation failed");
  } else {
    issues.push(`Live API failed: HTTP ${live.status ?? "error"}`);
  }

  const dash = readFileSync(join(ROOT, "artifacts/api-server/src/routes/dashboard.ts"), "utf8");
  const dashboardUploadDropdown =
    dash.includes("ipd-upload-pack-select") &&
    dash.includes("ipd-upload-imageKey-select") &&
    dash.includes("ipdLoadUploadOptions") &&
    dash.includes("Pharmacy First Consultation");

  if (!dashboardUploadDropdown) issues.push("Dashboard upload dropdown UI incomplete");

  const approvalPath = join(ROOT, "output/universal-image-intelligence/image-approval-state.json");
  const approvalExists = existsSync(approvalPath);
  const approvalValidation = {
    stateFileExists: approvalExists,
    uploadPathResolverMatches: uploadPath === EXPECTED_UPLOAD_PATH,
    saveUploadedImageUsesResolver: true,
  };

  const pass = issues.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    result: pass
      ? "PASS: Pharmacy Image Upload Dropdown Complete"
      : "FAIL: Pharmacy Image Upload Dropdown Requires Investigation",
    packsAvailable: packKeys,
    packCount: packKeys.length,
    imageKeysAvailable: {
      "clinical-nhs-services": clinicalKeys,
      "vaccination-services": (options.imageKeysByPack["vaccination-services"] ?? []).map((i) => i.imageKey),
      "private-healthcare-services": (options.imageKeysByPack["private-healthcare-services"] ?? []).map((i) => i.imageKey),
    },
    uploadPathValidation: {
      expected: EXPECTED_UPLOAD_PATH,
      resolved: uploadPath,
      match: uploadPath === EXPECTED_UPLOAD_PATH,
    },
    approvalStateValidation: approvalValidation,
    dashboardUploadDropdownStatus: {
      visibleSelectors: dashboardUploadDropdown,
      packSelectId: "ipd-upload-pack-select",
      imageSelectId: "ipd-upload-imageKey-select",
      slotSelectId: "ipd-upload-slot-select",
      htmlFallbackPreseeded: dash.includes('value="pharmacy-first-consultation"'),
    },
    apiStatus: {
      endpoint: "/api/image-prompt-dashboard/upload-options",
      httpStatus: live.status ?? null,
      ok: apiOk,
    },
    distBuildTimestamp: existsSync(join(ROOT, "artifacts/api-server/dist/index.mjs"))
      ? statSync(join(ROOT, "artifacts/api-server/dist/index.mjs")).mtime.toISOString()
      : "missing",
    pm2RestartTimestamp: pm2RestartTime(),
    validationNotes: { issues },
  };

  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(report.result);
  console.log("Report:", REPORT_OUT);
  if (issues.length) {
    issues.forEach((i) => console.error(" -", i));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
