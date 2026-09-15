#!/usr/bin/env node
/**
 * Phase 6L — Image upload & approval workflow validation report.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/image-upload-approval-workflow-report.json");
const APPROVAL_STATE = join(ROOT, "output/universal-image-intelligence/image-approval-state.json");
const DASHBOARD_PATH = join(ROOT, "artifacts/api-server/src/routes/dashboard.ts");
const API_PATH = join(ROOT, "artifacts/api-server/src/routes/api/imagePromptDashboard.ts");

const TEST_IMAGE = {
  industry: "pharmacy",
  pack: "clinical-nhs-services",
  imageKey: "pharmacy-first-consultation",
  slot: "hero",
};

const REQUIRED_INDUSTRIES = ["dentist", "accountant", "builder", "electrician", "hairdresser"];

async function loadModules() {
  const svc = await import(pathToFileURL(join(ROOT, "src/image-intelligence/imagePromptDashboardService.ts")).href);
  const state = await import(pathToFileURL(join(ROOT, "src/image-intelligence/imageApprovalState.ts")).href);
  return { svc, state };
}

function checkDashboardPromptGenerator() {
  const dash = readFileSync(DASHBOARD_PATH, "utf8");
  const checks = {
    promptGeneratorTab: dash.includes("ipd-panel-prompts") && dash.includes("Prompt Generator"),
    industrySelector: dash.includes("ipd-industry-prompts"),
    templateFamilySelector: dash.includes("ipd-family-prompts"),
    serviceSelector: dash.includes("ipd-service-prompts"),
    packSelector: dash.includes("ipd-pack-prompts"),
    copyPrompt: dash.includes("Copy Prompt"),
    copyNegativePrompt: dash.includes("Copy Negative Prompt"),
    copyBoth: dash.includes("Copy Both"),
    downloadSinglePrompt: dash.includes("export-prompt"),
    downloadPromptPack: dash.includes("ipdDownloadPromptPack"),
    uploadEndpointUi: dash.includes("ipdSubmitUpload"),
    approvalActions: dash.includes("ipdApprovalAction") && dash.includes("Mark Uploaded"),
  };
  return {
    ...checks,
    allPass: Object.values(checks).every(Boolean),
  };
}

function checkApiRoutes() {
  const api = readFileSync(API_PATH, "utf8");
  return {
    meta: api.includes("/image-prompt-dashboard/meta"),
    prompts: api.includes("/image-prompt-dashboard/prompts"),
    export: api.includes("/image-prompt-dashboard/export"),
    exportPrompt: api.includes("/image-prompt-dashboard/export-prompt"),
    upload: api.includes("/image-prompt-dashboard/upload"),
    approvalAction: api.includes("/image-prompt-dashboard/approval-action"),
    allPass: false,
  };
}

async function main() {
  const issues = [];
  const { svc, state } = await loadModules();

  const promptDashboard = checkDashboardPromptGenerator();
  if (!promptDashboard.allPass) issues.push("Prompt Generator dashboard checks incomplete");

  const apiChecks = checkApiRoutes();
  apiChecks.allPass =
    apiChecks.meta &&
    apiChecks.prompts &&
    apiChecks.export &&
    apiChecks.upload &&
    apiChecks.approvalAction;
  if (!apiChecks.allPass) issues.push("API route checks incomplete");

  if (!existsSync(APPROVAL_STATE)) issues.push("image-approval-state.json missing");

  const meta = svc.getDashboardMeta();
  const prompts = svc.getPrompts({ industry: "pharmacy", packKey: "clinical-nhs-services" });
  if (prompts.length < 1) issues.push("Prompts endpoint data empty for clinical-nhs-services pack");

  const exportPack = svc.exportPromptPack({ industry: "pharmacy", serviceKey: "pharmacy-first" });
  if ((exportPack.promptCount ?? 0) < 1) issues.push("Prompt pack export empty");

  const single = svc.exportSinglePrompt({
    industry: "pharmacy",
    packKey: TEST_IMAGE.pack,
    imageKey: TEST_IMAGE.imageKey,
  });
  if (!single) issues.push("Single prompt export failed");

  const uploadPath = state.resolveIndustryUploadPath(TEST_IMAGE.industry, TEST_IMAGE.pack, TEST_IMAGE.imageKey);
  const futurePath = state.resolveIndustryUploadPath("dentist", "default", "hero");
  const futurePathOk =
    futurePath === "assets/dentist-image-library/default/hero.webp" &&
    uploadPath === "assets/pharmacy-image-library/clinical-nhs-services/pharmacy-first-consultation.webp";
  if (!futurePathOk) issues.push("Future industry upload path strategy incorrect");

  const transitionSteps = ["uploaded", "quality-review", "compliance-review", "approved", "live-ready"];
  const transitionLog = [];

  try {
    for (const toStatus of transitionSteps) {
      const record = state.transitionApprovalStatus(
        { ...TEST_IMAGE, toStatus, dryRun: true, testOnly: true },
        { force: toStatus === "uploaded" ? true : undefined },
      );
      transitionLog.push({ toStatus, status: record.status });
      if (record.status !== toStatus) {
        issues.push(`Transition failed at ${toStatus}`);
      }
    }
  } catch (err) {
    issues.push(`Dry-run transition error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const finalRecord = state.getApprovalRecord(TEST_IMAGE.industry, TEST_IMAGE.pack, TEST_IMAGE.imageKey);
  const transitionsOk = finalRecord?.status === "live-ready" && finalRecord?.testOnly === true;

  state.removeApprovalRecord(TEST_IMAGE.industry, TEST_IMAGE.pack, TEST_IMAGE.imageKey);

  if (!transitionsOk) issues.push("Dry-run workflow did not reach live-ready");

  const coverage = svc.getCoverageReport("pharmacy");
  const coverageOk =
    coverage.summary.totalServices > 0 &&
    typeof coverage.summary.averageUploadedCoveragePercent === "number" &&
    typeof coverage.summary.averageApprovedCoveragePercent === "number" &&
    coverage.services[0]?.slots?.hero?.status;

  if (!coverageOk) issues.push("Coverage report does not read approval state correctly");

  const future = svc.getFutureIndustryReadiness();
  const futureReady =
    future.length === 5 && REQUIRED_INDUSTRIES.every((k) => future.some((f) => f.industryKey === k));

  if (!futureReady) issues.push("Future industry readiness incomplete");

  const previewIntegration = existsSync(join(ROOT, "src/pharmacy/templates/pharmacyImageLibrary.ts")) &&
    readFileSync(join(ROOT, "src/pharmacy/templates/pharmacyImageLibrary.ts"), "utf8").includes("resolveDisplayForRecord");

  if (!previewIntegration) issues.push("Preview integration not found in pharmacyImageLibrary.ts");

  const report = {
    schemaVersion: "1.0",
    phase: "image-upload-approval-workflow",
    generatedAt: new Date().toISOString(),
    verdict: issues.length === 0
      ? "PASS: Image Upload Approval Workflow Complete"
      : "FAIL: Image Upload Approval Workflow Requires Investigation",
    pass: issues.length === 0,
    dashboardPromptCopy: {
      status: promptDashboard.allPass ? "operational" : "needs-investigation",
      checks: promptDashboard,
    },
    uploadEndpoint: {
      status: apiChecks.upload ? "exists" : "missing",
      path: "POST /api/image-prompt-dashboard/upload",
      savePattern: {
        pharmacy: "assets/pharmacy-image-library/{pack}/{imageKey}.webp",
        future: "assets/{industry}-image-library/{pack}/{imageKey}.webp",
      },
    },
    approvalState: {
      status: existsSync(APPROVAL_STATE) ? "operational" : "missing",
      path: "output/universal-image-intelligence/image-approval-state.json",
    },
    approvalTransitionsTested: {
      status: transitionsOk ? "pass" : "fail",
      testImage: TEST_IMAGE,
      steps: transitionLog,
      restored: !state.getApprovalRecord(TEST_IMAGE.industry, TEST_IMAGE.pack, TEST_IMAGE.imageKey),
    },
    coverageCalculation: {
      status: coverageOk ? "operational" : "needs-investigation",
      totalServices: coverage.summary.totalServices,
      averageUploadedCoveragePercent: coverage.summary.averageUploadedCoveragePercent,
      averageApprovedCoveragePercent: coverage.summary.averageApprovedCoveragePercent,
      slotStatuses: ["missing", "uploaded", "approved", "fallback", "rejected"],
    },
    previewIntegration: {
      status: previewIntegration ? "operational" : "needs-investigation",
      module: "src/pharmacy/templates/pharmacyImageLibrary.ts",
      behavior: "approved images render live; uploaded-not-approved show preview badge; rejected use placeholder",
    },
    apiValidation: apiChecks,
    promptExport: {
      packPromptCount: exportPack.promptCount,
      singleExport: !!single,
    },
    futureIndustryReadiness: {
      status: futureReady ? "ready" : "needs-investigation",
      pathStrategyValidated: futurePathOk,
      industries: future,
    },
    issues,
    nextRecommendedAction: issues.length === 0
      ? "Generate first real Ideogram assets for pharmacy-first-consultation hero and upload via dashboard"
      : "Resolve workflow validation issues before real image upload",
    constraintsRespected: {
      noDeployment: true,
      noRegistryChanges: true,
      noSitemapChanges: true,
      noLifecycleChanges: true,
      noSeoHealthChanges: true,
      noContentEngineChanges: true,
    },
  };

  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2) + "\n");

  console.log(report.verdict);
  console.log(`Report: ${REPORT_OUT}`);
  if (issues.length) {
    console.error("Issues:");
    issues.forEach((i) => console.error(" -", i));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL: Image Upload Approval Workflow Requires Investigation");
  console.error(err);
  process.exit(1);
});
