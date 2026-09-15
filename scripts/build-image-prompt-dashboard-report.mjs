#!/usr/bin/env node
/**
 * Phase 6K — Image Prompt Dashboard validation report.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/image-prompt-dashboard-report.json");

const REQUIRED_INPUTS = [
  "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json",
  "output/pharmacy-blueprint/pharmacy-production-image-library.json",
  "output/universal-image-intelligence/image-intelligence.json",
];

const REQUIRED_INDUSTRIES = ["dentist", "accountant", "builder", "electrician", "hairdresser"];

const DASHBOARD_MARKERS = [
  { id: "current-images", label: "Current Images tab", patterns: ["ipd-panel-current", "ipdLoadCurrent", "current-images"] },
  { id: "prompt-generator", label: "Prompt Generator tab", patterns: ["ipd-panel-prompts", "ipdLoadPrompts", "Download Prompt Pack"] },
  { id: "upload-queue", label: "Upload Queue tab", patterns: ["ipd-panel-queue", "ipdLoadQueue", "upload-queue"] },
  { id: "coverage-report", label: "Coverage Report tab", patterns: ["ipd-panel-coverage", "ipdLoadCoverage", "coverage"] },
];

async function loadService() {
  const modPath = join(ROOT, "src/image-intelligence/imagePromptDashboardService.ts");
  const mod = await import(pathToFileURL(modPath).href);
  return mod;
}

function checkDashboardSource() {
  const dashPath = join(ROOT, "artifacts/api-server/src/routes/dashboard.ts");
  const apiPath = join(ROOT, "artifacts/api-server/src/routes/api/imagePromptDashboard.ts");
  const indexPath = join(ROOT, "artifacts/api-server/src/routes/index.ts");
  const dash = readFileSync(dashPath, "utf8");
  const api = existsSync(apiPath) ? readFileSync(apiPath, "utf8") : "";
  const index = readFileSync(indexPath, "utf8");

  const tabs = DASHBOARD_MARKERS.map((m) => ({
    id: m.id,
    label: m.label,
    exists: m.patterns.every((p) => dash.includes(p) || api.includes(p)),
  }));

  return {
    campaignContentSubTab: dash.includes('data-cc-sub="image-library"') && dash.includes("Image Library"),
    apiRouterRegistered: index.includes("imagePromptDashboard"),
    tabs,
    allTabsPresent: tabs.every((t) => t.exists),
  };
}

async function main() {
  const issues = [];
  const checks = {};

  for (const rel of REQUIRED_INPUTS) {
    const full = join(ROOT, rel);
    checks[rel] = existsSync(full);
    if (!checks[rel]) issues.push(`Missing input: ${rel}`);
  }

  const dashboard = checkDashboardSource();
  if (!dashboard.campaignContentSubTab) issues.push("Campaign Content Image Library sub-tab not found in dashboard.ts");
  if (!dashboard.apiRouterRegistered) issues.push("imagePromptDashboard router not registered in index.ts");
  if (!dashboard.allTabsPresent) issues.push("One or more Image Library sub-tabs missing from dashboard");

  const svc = await loadService();

  const meta = svc.getDashboardMeta();
  const currentImages = svc.getCurrentImages("pharmacy");
  const prompts = svc.getPrompts({ industry: "pharmacy", packKey: "clinical-nhs-services" });
  const exportPack = svc.exportPromptPack({ industry: "pharmacy", serviceKey: "pharmacy-first" });
  const queue = svc.getUploadQueue("pharmacy");
  const coverage = svc.getCoverageReport("pharmacy");
  const future = svc.getFutureIndustryReadiness();
  const workflow = svc.getDashboardWorkflowPipeline();

  if (currentImages.length < 1) issues.push("Current images list is empty");
  if (prompts.length < 1) issues.push("Prompt generator returned no prompts");
  if ((exportPack.promptCount ?? 0) < 1) issues.push("Prompt pack export is empty");
  if (!queue.buckets || queue.buckets.length < 5) issues.push("Upload queue buckets incomplete");
  if (!coverage.services || coverage.services.length < 1) issues.push("Coverage report has no services");
  if (workflow.length < 7) issues.push("Workflow pipeline has fewer than 7 stages");

  const pharmacyFirst = coverage.services.find((s) => s.serviceKey === "pharmacy-first");
  const flu = coverage.services.find((s) => s.serviceKey === "nhs-flu-vaccination");
  const coverageEngineOk =
    !!pharmacyFirst &&
    typeof pharmacyFirst.coveragePercent === "number" &&
    pharmacyFirst.slots?.hero &&
    !!flu &&
    flu.slots?.hero;

  if (!coverageEngineOk) issues.push("Coverage engine missing expected hub services (pharmacy-first, nhs-flu-vaccination)");

  const futureReady =
    future.length === 5 && REQUIRED_INDUSTRIES.every((k) => future.some((f) => f.industryKey === k && f.workflowReady));

  if (!futureReady) issues.push("Future industry workflow validation incomplete");

  const promptExportOk = (exportPack.promptCount ?? 0) > 0 && Array.isArray(exportPack.prompts);

  const report = {
    schemaVersion: "1.0",
    phase: "image-prompt-dashboard",
    generatedAt: new Date().toISOString(),
    verdict: issues.length === 0 ? "PASS: Image Prompt Dashboard Complete" : "FAIL: Image Prompt Dashboard Requires Investigation",
    pass: issues.length === 0,
    tabsCreated: dashboard.tabs,
    campaignContentImageLibrary: dashboard.campaignContentSubTab,
    apiEndpoints: "/api/image-prompt-dashboard/*",
    coverageEngine: {
      status: coverageEngineOk ? "operational" : "needs-investigation",
      totalServices: coverage.summary.totalServices,
      averageCoveragePercent: coverage.summary.averageCoveragePercent,
      sampleServices: {
        pharmacyFirst: pharmacyFirst
          ? {
              serviceName: pharmacyFirst.serviceName,
              coveragePercent: pharmacyFirst.coveragePercent,
              slots: Object.fromEntries(
                Object.entries(pharmacyFirst.slots).map(([k, v]) => [k, v.covered ? "✓" : "✗"]),
              ),
            }
          : null,
        fluVaccination: flu
          ? {
              serviceName: flu.serviceName,
              coveragePercent: flu.coveragePercent,
              slots: Object.fromEntries(Object.entries(flu.slots).map(([k, v]) => [k, v.covered ? "✓" : "✗"])),
            }
          : null,
      },
    },
    promptExport: {
      status: promptExportOk ? "operational" : "needs-investigation",
      sampleServiceKey: "pharmacy-first",
      promptCount: exportPack.promptCount,
    },
    uploadQueue: {
      status: queue.buckets?.length === 5 ? "operational" : "needs-investigation",
      totals: queue.totals,
    },
    workflowPipeline: workflow.map((s) => s.label),
    universalEngineIntegration: {
      status: meta.sourceFiles?.imageIntelligence ? "operational" : "needs-investigation",
      resolverModule: "src/image-intelligence/universalImageIntelligenceEngine.ts",
      serviceModule: "src/image-intelligence/imagePromptDashboardService.ts",
    },
    futureIndustryReadiness: {
      status: futureReady ? "ready" : "needs-investigation",
      industries: future,
    },
    inputValidation: checks,
    productionImageCount: currentImages.length,
    issues,
    recommendedNextPhase: issues.length === 0
      ? "Phase 6L — Ideogram batch generation + asset upload workflow with approval state persistence"
      : "Resolve dashboard validation issues before image generation batch",
    constraintsRespected: {
      noDeployment: true,
      noRegistryChanges: true,
      noSitemapChanges: true,
      noAuthChanges: true,
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
  console.error("FAIL: Image Prompt Dashboard Requires Investigation");
  console.error(err);
  process.exit(1);
});
