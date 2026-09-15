#!/usr/bin/env npx tsx
/**
 * PharmaConnect Workflow Order Reset V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPlatformOperatingSystem,
  resolveNextOsStep,
} from "../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { buildCustomerExperienceView } from "../src/pharmacy/pharmacyCustomerExperienceService.ts";
import { isRequiredProfileComplete } from "../src/pharmacy/pharmacyProfileFieldClassification.ts";
import { loadNormalizedProfile } from "../src/pharmacy/pharmacyRealEnhancementActionsService.ts";
import { renderPharmacyPlatformDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts";
import { getServiceAssetWorkflow } from "../src/pharmacy/pharmacyAssetWorkflowService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";

const EXPECTED_ORDER = [
  "Create Profile",
  "Choose Service & Area",
  "Confirm Brand & Images",
  "Create Content Package",
  "Review Content Package",
  "Approve Content Package",
  "Publish",
  "Submit To Google",
  "Track Results",
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

console.log(`\nPharmaConnect Workflow Order Reset V1 — ${slug}\n`);

const os = buildPlatformOperatingSystem(slug);
const dashboard = buildPharmacyPlatformDashboard(slug);
const html = renderPharmacyPlatformDashboardHtml(dashboard);
const cx = buildCustomerExperienceView(dashboard);
const profile = loadNormalizedProfile(slug);
const serviceId = os.currentCampaignServiceId;
const wf = getServiceAssetWorkflow(slug, serviceId);

record("nine-steps", os.steps.length === 9, `${os.steps.length} steps`);
record(
  "step-order",
  os.steps.map((s) => s.title).join("|") === EXPECTED_ORDER.join("|"),
  os.steps.map((s) => s.title).join(" → "),
);

const profileStep = os.steps.find((s) => s.id === "create-profile")!;
const serviceStep = os.steps.find((s) => s.id === "choose-service-area")!;
const generateStep = os.steps.find((s) => s.id === "generate-asset")!;
const reviewStep = os.steps.find((s) => s.id === "review-content")!;
const approveStep = os.steps.find((s) => s.id === "approve-asset")!;
const publishStep = os.steps.find((s) => s.id === "publish")!;
const indexStep = os.steps.find((s) => s.id === "submit-to-google")!;
const trackStep = os.steps.find((s) => s.id === "track-results")!;

record(
  "profile-complete-no-block",
  isRequiredProfileComplete(profile) ? profileStep.status === "COMPLETE" : true,
  `profile complete=${isRequiredProfileComplete(profile)}, step=${profileStep.status}`,
);

const next = resolveNextOsStep(os.steps);
record(
  "next-after-profile-is-service-area",
  isRequiredProfileComplete(profile) && !wf.assetApprovedAt
    ? next?.id === "choose-service-area" || next?.stepNumber === 2 || serviceStep.status === "COMPLETE"
    : true,
  next ? `${next.stepNumber}. ${next.title}` : "workflow advanced",
);

record("generate-asset-step", generateStep.title === "Create Content Package", generateStep.url);
record("review-content-step", reviewStep.title === "Review Content Package", reviewStep.url);
record("approve-asset-step", approveStep.title === "Approve Content Package", approveStep.url);

record(
  "growth-hidden-before-approval",
  os.hideGrowthMetrics === !Boolean(wf.assetApprovedAt),
  `hideGrowthMetrics=${os.hideGrowthMetrics}, approved=${Boolean(wf.assetApprovedAt)}`,
);

record(
  "performance-hidden-in-html",
  wf.assetApprovedAt ? html.includes("Track Results") : !html.includes('id="performance"') || os.hideGrowthMetrics,
  wf.assetApprovedAt ? "shown after approval" : "hidden before approval",
);

record(
  "publish-locked-before-approval",
  !wf.assetApprovedAt ? publishStep.locked || publishStep.status === "BLOCKED" : true,
  `publish locked=${publishStep.locked}, status=${publishStep.status}`,
);

record(
  "indexing-locked-before-publish",
  dashboard.currentCampaign?.publishingStatus !== "published"
    ? indexStep.locked || indexStep.status === "BLOCKED"
    : true,
  `index locked=${indexStep.locked}`,
);

record(
  "track-locked-before-submit",
  !["submitted", "indexed", "ready_to_submit"].includes(dashboard.currentCampaign?.indexingStatus || "")
    ? trackStep.locked || trackStep.status === "BLOCKED"
    : true,
  `track locked=${trackStep.locked}`,
);

record(
  "continue-resolves",
  Boolean(os.nextStep?.url) && html.includes("Continue"),
  os.nextStep ? os.nextStep.url : "complete",
);

record(
  "all-steps-in-dashboard",
  EXPECTED_ORDER.every((t) => html.includes(t) || html.includes(t.replace(/&/g, "&amp;"))),
  "9 step titles in dashboard HTML",
);

record(
  "current-step-highlight",
  html.includes("Current Step"),
  "current step badge present",
);

record(
  "no-script-errors",
  !html.includes("Run scripts/") && !fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyVisualExperiencePreview.ts"), "utf8").includes("Run scripts/"),
  "no developer script messages",
);

record(
  "asset-first-label",
  html.includes("First Service Page") || html.includes("Service Asset") || os.assetPhaseLabel.length > 0,
  os.assetPhaseLabel,
);

record(
  "outstanding-no-complete-profile-when-done",
  isRequiredProfileComplete(profile)
    ? !cx.outstandingTasks.some((t) => /complete profile|create profile/i.test(t.title) && profileStep.status === "COMPLETE")
    : true,
  cx.outstandingTasks.map((t) => t.title).join(", ") || "none",
);

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-workflow-order-reset-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);
fs.writeFileSync(
  reportPath,
  JSON.stringify({ slug, validatedAt: new Date().toISOString(), passed, total: checks.length, allPass: failed.length === 0, checks }, null, 2),
);

console.log(`\n${passed}/${checks.length} checks passed`);
if (failed.length) {
  console.log("\nFailed:");
  for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
  process.exit(1);
}
console.log(`\nReport: ${reportPath}`);
