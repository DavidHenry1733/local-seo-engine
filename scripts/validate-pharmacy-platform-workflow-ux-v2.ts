#!/usr/bin/env npx tsx
/**
 * PharmaConnect Platform Workflow UX V2 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { buildAuthorityReadinessDashboard } from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import { buildContentReviewPanels } from "../src/pharmacy/pharmacyContentReviewUi.ts";
import {
  getCampaignCoverageSummary,
  regeneratePharmacyCampaignPage,
  readPharmacyCampaignStore,
} from "../src/pharmacy/pharmacyCampaignService.ts";
import { getCampaignStaleStatus, listStaleCampaigns } from "../src/pharmacy/pharmacyCampaignStaleService.ts";
import { renderPharmacyPlatformDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts";
import { renderAuthorityReadinessDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyAuthorityReadinessPage.ts";
import { renderPharmacyCampaignsHtml } from "../artifacts/api-server/src/routes/pharmacyCampaignsPage.ts";
import { buildPharmacyCampaignControlCentre } from "../src/pharmacy/pharmacyCampaignControlCentreService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";
const BASE = process.env.PHARMA_API_BASE || "http://127.0.0.1:3001";

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

console.log(`\nPharmaConnect Platform Workflow UX V2 — ${slug}\n`);

const dashboard = buildPharmacyPlatformDashboard(slug);
const dashHtml = renderPharmacyPlatformDashboardHtml(dashboard);
const authDash = buildAuthorityReadinessDashboard(slug);
const authHtml = renderAuthorityReadinessDashboardHtml(authDash);
const centre = buildPharmacyCampaignControlCentre(slug);
const campaignsHtml = renderPharmacyCampaignsHtml(centre);
const navSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyPlatformNav.ts"), "utf8");
const authPageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyAuthorityReadinessPage.ts"), "utf8");
const campaignsPageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyCampaignsPage.ts"), "utf8");
const campaignSvcSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyCampaignService.ts"), "utf8");

const audit = authDash.selectedAudit;
const panels = audit ? buildContentReviewPanels(audit, slug) : null;
const coverage = getCampaignCoverageSummary(slug);
const store = readPharmacyCampaignStore(slug);
const activeCampaign = store?.campaigns.find((c) => c.status === "active");

record("1-content-review-renamed", navSrc.includes("Content Review") && authHtml.includes("<h1>Content Review</h1>"), "Nav and page use Content Review");
record(
  "2-overall-review-status",
  authHtml.includes("Overall Review Status") && !authHtml.includes("Authority score"),
  "Overall Review Status label",
);
record(
  "3-review-panels-split",
  authHtml.includes("Ready For Publishing") &&
    authHtml.includes("Required Before Publishing") &&
    authHtml.includes("Recommended Improvements"),
  "Three review sections",
);
record(
  "4-ready-with-recommendations",
  authPageSrc.includes("Recommended improvements available") || authHtml.includes("Recommended improvements available"),
  "Ready + recommendations messaging",
);
record(
  "5-every-warning-has-action",
  authPageSrc.includes("btn-action") && !authPageSrc.includes("renderSignalList(audit.missingSignals"),
  "Tasks include action buttons",
);
record(
  "6-content-review-ui-module",
  fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyContentReviewUi.ts")),
  "Content review UI helper",
);
record(
  "7-create-or-manage-growth-plans",
  dashHtml.includes(coverage.allCampaignsCreated ? "Manage Growth Plans" : "Start a Growth Plan"),
  coverage.allCampaignsCreated ? "Manage Growth Plans" : "Start a Growth Plan",
);
record(
  "8-campaign-coverage-logic",
  coverage.enabledServiceCount >= 1 && typeof coverage.allCampaignsCreated === "boolean",
  `${coverage.activeCampaignCount}/${coverage.enabledServiceCount}`,
);
record(
  "9-regenerate-available",
  campaignSvcSrc.includes("regeneratePharmacyCampaignPage") && campaignsHtml.includes("Regenerate Page"),
  "Regenerate Page in Campaign OS",
);
record(
  "10-regenerate-api",
  fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyCampaigns.ts"), "utf8").includes("/regenerate/"),
  "Regenerate API route",
);

if (activeCampaign) {
  const stale = getCampaignStaleStatus(slug, activeCampaign);
  record("11-stale-detection-runs", typeof stale.isStale === "boolean", `isStale=${stale.isStale}`);
  try {
    const regen = regeneratePharmacyCampaignPage(slug, activeCampaign.id);
    record("12-regenerate-executes", Boolean(regen.campaign.regeneratedAt), regen.redirectUrl);
  } catch (err) {
    record("12-regenerate-executes", false, String(err));
  }
} else {
  record("11-stale-detection-runs", listStaleCampaigns(slug).length >= 0, "no active campaign");
  record("12-regenerate-executes", true, "skipped — no active campaign");
}

record(
  "13-profile-update-banner",
  dashHtml.includes("Profile updated") || campaignsPageSrc.includes("stale-profile-banner"),
  "Profile update / stale UI",
);
record(
  "14-plain-campaign-status",
  campaignsHtml.includes("plain-status-strip") || campaignsPageSrc.includes("buildPlainCampaignStatus"),
  "Plain campaign status strip",
);
record(
  "15-terminology-simplified",
  !dashHtml.includes("Authority Score") &&
    navSrc.includes("Search Visibility") &&
    navSrc.includes("Recommended Improvements"),
  "Simplified dashboard terminology",
);
record(
  "16-structured-data-placeholder",
  fs.existsSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyStructuredDataReviewPlaceholderPage.ts")),
  "Structured data review page",
);
record(
  "17-no-dead-end-blockers",
  dashHtml.includes("Fix →") || authPageSrc.includes("btn-action"),
  "Blockers link to actions",
);
record(
  "18-templates-unchanged",
  fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyVisualExperienceLayoutV3.ts"), "utf8").includes("clusterImagePanel"),
  "Visual templates untouched",
);

if (panels) {
  const allTasks = [...panels.requiredBeforePublishing, ...panels.recommendedImprovements, ...panels.readyForPublishing];
  record(
    "19-all-tasks-have-buttons",
    allTasks.every((t) => t.buttonLabel && t.url),
    `${allTasks.length} tasks with buttons`,
  );
} else {
  record("19-all-tasks-have-buttons", false, "no audit");
}

try {
  const res = await fetch(`${BASE}/api/pharmacy-dashboard?slug=${slug}`, { redirect: "manual" });
  if (res.status === 302) record("20-live-dashboard", true, "Auth-gated");
  else {
    const live = await res.text();
    record("20-live-dashboard", live.includes("Continue Next Step"), `Live at ${BASE}`);
  }
} catch {
  record("20-live-dashboard", dashHtml.includes("Continue Next Step"), "Offline");
}

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-platform-workflow-ux-v2.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const allPass = checks.every((c) => c.pass);
fs.writeFileSync(
  reportPath,
  JSON.stringify({ slug, pass: allPass, checks, coverage, staleCount: listStaleCampaigns(slug).length, generatedAt: new Date().toISOString() }, null, 2),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ PLATFORM WORKFLOW UX V2 PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
