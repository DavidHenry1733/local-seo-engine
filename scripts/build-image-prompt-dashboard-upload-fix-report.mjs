#!/usr/bin/env node
/**
 * Image Prompt Dashboard upload fix validation report.
 * Run: node --import tsx scripts/build-image-prompt-dashboard-upload-fix-report.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/image-prompt-dashboard-upload-fix-report.json");
const TOKEN = process.env.IPD_DASHBOARD_TOKEN || "local-seo-engine-production-secret-change-later-2026";
const BASE = process.env.IPD_API_BASE || "http://127.0.0.1:3000";
const TEST_WEBP = "/tmp/ipd-upload-test.webp";
const TEST_KEY = "pharmacy-first-consultation";
const TEST_PACK = "clinical-nhs-services";
const EXPECTED_PATH = `assets/pharmacy-image-library/${TEST_PACK}/${TEST_KEY}.webp`;

const MIN_WEBP_B64 = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";

async function main() {
  const issues = [];
  const dash = readFileSync(join(ROOT, "artifacts/api-server/src/routes/dashboard.ts"), "utf8");
  const api = readFileSync(join(ROOT, "artifacts/api-server/src/routes/api/imagePromptDashboard.ts"), "utf8");

  const dashboardHandlerStatus = {
    ipdSubmitUpload: dash.includes("function ipdSubmitUpload"),
    ipdApiPathUpload: dash.includes("ipdApiPath('/image-prompt-dashboard/upload')"),
    noManualContentType: !dash.includes("'Content-Type': 'multipart/form-data'"),
    uploadStatusElement: dash.includes("ipd-upload-status"),
    ipdShowUploadStatus: dash.includes("function ipdShowUploadStatus"),
    webpAcceptOnly: dash.includes('accept="image/webp,.webp"'),
    uploadButtonTypeButton: dash.includes('id="ipd-upload-btn"') && dash.includes('type="button"'),
    readsVisibleSelects: dash.includes("ipdGetUploadSelection"),
  };

  if (!Object.values(dashboardHandlerStatus).every(Boolean)) {
    issues.push("Dashboard upload handler incomplete");
  }

  const multipartHandlingStatus = {
    multerSingleFile: api.includes('upload.single("file")'),
    uploadMiddleware: api.includes("uploadMiddleware"),
    webpOnlyFilter: api.includes("Please upload a .webp file"),
    fieldAliases: api.includes("packKey") && api.includes("selectedImageKey"),
    okResponse: api.includes("ok: true"),
  };

  if (!multipartHandlingStatus.multerSingleFile) issues.push("Missing multer single file handler");

  writeFileSync(TEST_WEBP, Buffer.from(MIN_WEBP_B64, "base64"));

  let uploadJson = null;
  let uploadHttp = 0;
  try {
    const res = await fetch(
      `${BASE}/api/image-prompt-dashboard/upload?_t=${encodeURIComponent(TOKEN)}`,
      {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
        body: (() => {
          const fd = new FormData();
          fd.append("industry", "pharmacy");
          fd.append("pack", TEST_PACK);
          fd.append("imageKey", TEST_KEY);
          fd.append("slot", "hero");
          fd.append("approvalStatus", "uploaded");
          fd.append("file", new Blob([readFileSync(TEST_WEBP)], { type: "image/webp" }), "test.webp");
          return fd;
        })(),
      },
    );
    uploadHttp = res.status;
    uploadJson = await res.json();
  } catch (err) {
    issues.push(`Upload curl test failed: ${err.message}`);
  }

  const uploadPathWritten =
    uploadJson?.ok === true &&
    uploadJson?.uploadPath === EXPECTED_PATH &&
    existsSync(join(ROOT, EXPECTED_PATH));

  if (!uploadPathWritten) {
    issues.push(`Upload path not written correctly: ${uploadJson?.uploadPath}`);
  }

  let pngRejected = false;
  try {
    const pngBlob = new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" });
    const fd = new FormData();
    fd.append("industry", "pharmacy");
    fd.append("pack", TEST_PACK);
    fd.append("imageKey", TEST_KEY);
    fd.append("slot", "hero");
    fd.append("file", pngBlob, "test.png");
    const res = await fetch(`${BASE}/api/image-prompt-dashboard/upload?_t=${encodeURIComponent(TOKEN)}`, {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body: fd,
    });
    const data = await res.json();
    pngRejected = res.status === 422 && String(data.error || "").includes(".webp");
  } catch {
    pngRejected = false;
  }
  if (!pngRejected) issues.push("Non-webp upload should be rejected with clear message");

  const approvalPath = join(ROOT, "output/universal-image-intelligence/image-approval-state.json");
  let approvalRecord = null;
  if (existsSync(approvalPath)) {
    const state = JSON.parse(readFileSync(approvalPath, "utf8"));
    approvalRecord = state.images?.[`pharmacy:${TEST_PACK}:${TEST_KEY}`];
  }
  const approvalStateUpdated =
    approvalRecord?.status === "uploaded" &&
    approvalRecord?.approvalStatus === "uploaded" &&
    approvalRecord?.uploadPath === EXPECTED_PATH;

  if (!approvalStateUpdated) issues.push("Approval state record not updated after upload");

  const svc = await import(
    pathToFileURL(join(ROOT, "src/image-intelligence/imagePromptDashboardService.ts")).href
  );
  const coverage = svc.getCoverageReport("pharmacy");
  const clinicalSvc = coverage.services?.find((s) => s.serviceKey === "pharmacy-first");
  const coverageUpdateStatus = {
    reportGenerated: !!coverage.summary,
    pharmacyFirstUploadedSlots: clinicalSvc?.uploadedSlots ?? [],
    hasUploadedSlot: (clinicalSvc?.uploadedSlots ?? []).length > 0 || uploadPathWritten,
  };

  const uploadOptions = await fetch(
    `${BASE}/api/image-prompt-dashboard/upload-options?_t=${encodeURIComponent(TOKEN)}&industry=pharmacy`,
    { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } },
  ).then((r) => r.json());

  const uploadOptionsStable =
    uploadOptions.packs?.length === 6 &&
    uploadOptions.imageKeysByPack?.[TEST_PACK]?.some((i) => i.imageKey === TEST_KEY);

  if (!uploadOptionsStable) issues.push("upload-options endpoint unstable");

  const pass = issues.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    result: pass
      ? "PASS: Image Prompt Dashboard Upload Fixed"
      : "FAIL: Image Upload Still Requires Investigation",
    uploadEndpointStatus: {
      httpStatus: uploadHttp,
      ok: uploadJson?.ok === true,
      uploadPath: uploadJson?.uploadPath ?? null,
      pngRejected,
    },
    multipartHandlingStatus,
    dashboardHandlerStatus,
    uploadPathWritten: {
      expected: EXPECTED_PATH,
      exists: existsSync(join(ROOT, EXPECTED_PATH)),
      match: uploadPathWritten,
    },
    approvalStateUpdated: {
      updated: approvalStateUpdated,
      record: approvalRecord
        ? {
            status: approvalRecord.status,
            approvalStatus: approvalRecord.approvalStatus,
            uploadPath: approvalRecord.uploadPath,
            uploadedAt: approvalRecord.uploadedAt,
          }
        : null,
    },
    coverageUpdateStatus,
    uploadOptionsStable,
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
  if (issues.length) {
    issues.forEach((i) => console.error(" -", i));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
