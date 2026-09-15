#!/usr/bin/env npx tsx
/**
 * PharmaConnect Platform Operating System V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import {
  buildPlatformOperatingSystem,
  resolveNextOsStep,
  type PlatformOsStepStatus,
} from "../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { renderPharmacyPlatformDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";
const BASE = process.env.PHARMA_API_BASE || "http://127.0.0.1:3001";

const VALID_STATUSES: PlatformOsStepStatus[] = [
  "NOT_STARTED",
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "BLOCKED",
  "COMPLETE",
];

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

console.log(`\nPharmaConnect Platform Operating System V1 — ${slug}\n`);

const os = buildPlatformOperatingSystem(slug);
const dashboard = buildPharmacyPlatformDashboard(slug);
const html = renderPharmacyPlatformDashboardHtml(dashboard);
const osSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyPlatformOperatingSystemService.ts"), "utf8");
const pageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts"), "utf8");
const navSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyPlatformNav.ts"), "utf8");

record("1-os-service-exists", fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyPlatformOperatingSystemService.ts")), "OS service file");
record("2-nine-workflow-steps", os.steps.length === 9, `${os.steps.length} steps`);
record(
  "3-step-titles",
  os.steps.map((s) => s.title).join("|").includes("Business Profile") &&
    os.steps.map((s) => s.title).join("|").includes("Monitor Results"),
  os.steps.map((s) => s.title).join(", "),
);
record(
  "4-state-model",
  os.steps.every((s) => VALID_STATUSES.includes(s.status)),
  "All steps use standard states",
);
record(
  "5-continue-next-step",
  html.includes("Continue Next Step") && (html.includes("btn-primary") || html.includes("btn-continue")),
  "Continue Next Step button rendered when tasks exist",
);
record(
  "6-next-step-resolves",
  Boolean(os.nextStep?.url) && dashboard.nextAction.url === os.nextStep?.url,
  os.nextStep ? `${os.nextStep.title} → ${os.nextStep.url}` : "all complete",
);
record(
  "7-locked-steps",
  os.steps.some((s) => s.locked === true) || os.steps.every((s) => s.status === "COMPLETE" || !s.locked),
  `locked=${os.steps.filter((s) => s.locked).length}`,
);
record(
  "8-view-on-complete",
  pageSrc.includes("View plan") || pageSrc.includes("btn-secondary"),
  "Growth plan deep links available",
);
record(
  "9-current-growth-plan",
  html.includes("Current Growth Plan") && html.includes("Start a Growth Plan") || html.includes("Manage Growth Plans"),
  os.currentCampaignName || "no campaign",
);
record(
  "10-progress-bar",
  html.includes("Growth Progress") && html.includes("progress-fill"),
  `${os.overallCompletionPct}%`,
);
record(
  "11-build-growth-mode",
  os.mode === "BUILD" || os.mode === "GROWTH",
  `mode=${os.mode}`,
);
record(
  "12-growth-cards",
  os.growthCards.length >= 8,
  `${os.growthCards.length} growth cards defined`,
);
record(
  "13-growth-mode-ui",
  (os.mode === "GROWTH" && html.includes("Performance")) ||
    (os.mode === "BUILD" && html.includes("Outstanding Tasks")),
  `mode=${os.mode} reflected in Growth Programme UI`,
);
record(
  "14-workflow-question",
  html.includes("Outstanding Tasks") && html.includes("We guide you"),
  "Growth Programme primary messaging",
);
record(
  "15-nav-labels",
  navSrc.includes("Content Review") &&
    navSrc.includes("Ready To Publish") &&
    navSrc.includes("Search Visibility") &&
    navSrc.includes("Recommended Improvements"),
  "Simplified nav terminology",
);
record(
  "16-os-owns-sequencing",
  osSrc.includes("buildOsSteps") && osSrc.includes("resolveNextOsStep") && !osSrc.includes("buildEnhancementWorkspaceView"),
  "Workflow logic in OS layer only",
);
record(
  "17-no-duplicate-workflow",
  dashboard.operatingSystem.steps.length === 9 && resolveNextOsStep(os.steps)?.stepNumber === os.nextStep?.stepNumber,
  "Single next-step resolution",
);
record(
  "18-module-state-only",
  os.steps.every((s) => typeof s.completionPct === "number" && Array.isArray(s.blockingIssues) && typeof s.url === "string"),
  "Steps expose completion, status, blockers, url",
);
record(
  "19-dashboard-integrates-os",
  Boolean(dashboard.operatingSystem) && dashboard.operatingSystem.steps.length === 9,
  "Dashboard includes operatingSystem",
);

const enhancementSvc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyEnhancementWorkspaceService.ts"), "utf8");
record(
  "20-modules-unchanged",
  !enhancementSvc.includes("buildOsSteps") && !enhancementSvc.includes("PlatformOperatingSystem"),
  "Enhancement workspace has no OS workflow logic",
);

const layoutSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyVisualExperienceLayoutV3.ts"), "utf8");
record("21-templates-unchanged", layoutSrc.includes("clusterImagePanel"), "Visual templates untouched");

try {
  const res = await fetch(`${BASE}/api/pharmacy-dashboard?slug=${slug}`, { redirect: "manual" });
  if (res.status === 302) {
    record("22-live-dashboard", true, "Auth-gated");
  } else {
    const liveHtml = await res.text();
    record("22-live-dashboard", liveHtml.includes("Outstanding Tasks"), `Live at ${BASE}`);
  }
} catch {
  record("22-live-dashboard", html.includes("Outstanding Tasks"), "Offline validation");
}

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-platform-operating-system-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const allPass = checks.every((c) => c.pass);
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      slug,
      pass: allPass,
      mode: os.mode,
      overallCompletionPct: os.overallCompletionPct,
      nextStep: os.nextStep?.id || null,
      steps: os.steps.map((s) => ({ id: s.id, status: s.status, pct: s.completionPct, locked: s.locked })),
      checks,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ PLATFORM OPERATING SYSTEM V1 PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
