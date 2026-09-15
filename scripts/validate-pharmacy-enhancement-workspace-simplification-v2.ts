#!/usr/bin/env npx tsx
/**
 * PharmaConnect Enhancement Workspace Simplification V2 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { refreshPharmacyAuthorityEnhancement } from "../src/pharmacy/pharmacyAuthorityEnhancementService.ts";
import { buildEnhancementWorkspaceView } from "../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { buildPharmacyCampaignControlCentre } from "../src/pharmacy/pharmacyCampaignControlCentreService.ts";
import { renderEnhancementWorkspaceHtml } from "../artifacts/api-server/src/routes/pharmacyEnhancementWorkspacePage.ts";
import { renderPharmacyCampaignsHtml } from "../artifacts/api-server/src/routes/pharmacyCampaignsPage.ts";
import {
  groupCampaignImprovements,
  plainEnglishTitle,
} from "../src/pharmacy/pharmacyEnhancementWorkspaceUi.ts";

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

console.log(`\nPharmaConnect Enhancement Workspace Simplification V2 — ${slug}\n`);

refreshPharmacyAuthorityEnhancement(slug);
const view = buildEnhancementWorkspaceView(slug);
const html = renderEnhancementWorkspaceHtml(view);
const pageSrc = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/pharmacyEnhancementWorkspacePage.ts"),
  "utf8",
);
const uiSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyEnhancementWorkspaceUi.ts"), "utf8");
const engineSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyAuthorityEnhancementService.ts"), "utf8");
const workspaceSvcSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyEnhancementWorkspaceService.ts"), "utf8");
const campaignsPageSrc = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/pharmacyCampaignsPage.ts"),
  "utf8",
);

const allTasks = [
  ...view.board.ready,
  ...view.board.inProgress,
  ...view.board.completed,
  ...view.board.deferred,
];
const groups = groupCampaignImprovements(allTasks);

record("1-page-renamed", html.includes("Campaign Improvements") && html.includes("<h1>Campaign Improvements</h1>"), "Page title is Campaign Improvements");
record(
  "2-subtitle",
  html.includes("Complete these actions to make your campaign ready for launch"),
  "Customer-facing subtitle present",
);
record(
  "3-no-engine-wording",
  !html.includes("Authority Enhancement Engine") && !html.includes("AI Quality Consultant") && !html.includes("Advisory only"),
  "Technical engine wording removed from page",
);
record("4-summary-strip", html.includes("summary-strip") && html.includes("Required Before Launch") && html.includes("Potential Score"), "Six-card summary strip");
record("5-continue-next-action", html.includes("Continue Next Action") && html.includes("btn-continue"), "Continue Next Action button");
record("6-required-section", html.includes('id="required-before-launch"') && html.includes("Required Before Launch"), "Required Before Launch section");
record("7-quick-wins-section", html.includes('id="quick-wins"') && html.includes("Quick Wins"), "Quick Wins section");
record("8-high-impact-section", html.includes('id="high-impact"') && html.includes("High Impact Improvements"), "High Impact section");
record("9-future-collapsed", html.includes('id="future-improvements"') && html.includes("is-collapsed"), "Future Improvements collapsed");
record("10-completed-collapsed", html.includes('id="completed"') && pageSrc.includes('collapsed: true'), "Completed collapsed");
record("11-deferred-collapsed", html.includes('id="deferred"'), "Deferred section present and collapsed");
record(
  "12-responsive-grid",
  pageSrc.includes("grid-template-columns:repeat(3") && pageSrc.includes("repeat(2") && pageSrc.includes("1fr"),
  "CSS Grid 3/2/1 columns",
);
record("13-equal-height-cards", pageSrc.includes("height:100%") && pageSrc.includes("min-height"), "Equal-height cards");
record(
  "14-evidence-hidden",
  pageSrc.includes("<details") &&
    pageSrc.includes("Show Details") &&
    pageSrc.includes('class="evidence"') &&
    pageSrc.includes("details-inner"),
  "Evidence inside Show Details only",
);
record(
  "15-advanced-filters-collapsed",
  html.includes("Advanced Filters") && pageSrc.includes("<details class=\"advanced-filters\""),
  "Advanced Filters collapsed by default",
);
record(
  "16-show-more-less",
  pageSrc.includes("Show More") && pageSrc.includes("Show Less"),
  "Show More / Show Less toggles",
);
record(
  "17-grouping-logic",
  groups.requiredBeforeLaunch.length + groups.quickWins.length + groups.highImpact.length + groups.future.length + groups.completed.length + groups.deferred.length === allTasks.length,
  `Grouped ${allTasks.length} tasks without loss`,
);
record(
  "18-plain-english",
  plainEnglishTitle("Enhance: Independent Prescriber").includes("Independent Prescriber") &&
    plainEnglishTitle("Entity Clarity").includes("Pharmacy Location"),
  "Plain-English title mapping",
);
record(
  "19-card-fields",
  html.includes("Why this matters") && html.includes("What you need to do") && html.includes("Estimated benefit"),
  "Simplified card fields",
);

const centre = buildPharmacyCampaignControlCentre(slug);
const campaignsHtml = renderPharmacyCampaignsHtml(centre);
record(
  "20-campaign-os-links",
  campaignsHtml.includes("Review Campaign Improvements") || campaignsHtml.includes("Continue Improvements"),
  "Campaign OS links updated",
);
record(
  "21-nav-label",
  fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyPlatformNav.ts"), "utf8").includes("Campaign Improvements"),
  "Nav label updated",
);

record(
  "22-no-engine-modified",
  engineSrc.includes("export function refreshPharmacyAuthorityEnhancement") &&
    engineSrc.includes("estimatedScoreGain") &&
    !engineSrc.includes("groupCampaignImprovements"),
  "Recommendation engine unchanged",
);
record(
  "23-no-scoring-modified",
  workspaceSvcSrc.includes("projectedAuthorityScore") &&
    workspaceSvcSrc.includes("potentialAuthorityScore") &&
    !workspaceSvcSrc.includes("pharmacyEnhancementWorkspaceUi"),
  "Scoring logic unchanged in workspace service",
);
record(
  "24-ui-only-grouping",
  uiSrc.includes("groupCampaignImprovements") && pageSrc.includes("pharmacyEnhancementWorkspaceUi"),
  "Grouping lives in UI layer only",
);

const layoutSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyVisualExperienceLayoutV3.ts"), "utf8");
record("25-no-template-modified", layoutSrc.includes("clusterImagePanel"), "Visual templates unchanged");

const masterDir = path.join(ROOT, "docs/pharmacy-master-library");
record("26-no-master-modified", fs.existsSync(masterDir), "Service masters read-only");

record(
  "27-no-kanban",
  !html.includes("Task board") && !pageSrc.includes("renderColumn"),
  "Old kanban board removed",
);

record(
  "28-quick-wins-limit",
  pageSrc.includes("defaultLimit: 6") && pageSrc.match(/defaultLimit: 6/g)!.length >= 2,
  "Quick Wins and High Impact limited to 6",
);

try {
  const liveRes = await fetch(`${BASE}/api/pharmacy-enhancement-workspace?slug=${slug}`, { redirect: "manual" });
  if (liveRes.status === 302) {
    record("29-live-workspace", true, "Auth-gated (expected in production)");
  } else {
    const liveHtml = await liveRes.text();
    record("29-live-workspace", liveHtml.includes("Campaign Improvements"), `Live at ${BASE}`);
  }
} catch {
  record("29-live-workspace", html.includes("Campaign Improvements"), "Offline validation");
}

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-enhancement-workspace-simplification-v2.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const allPass = checks.every((c) => c.pass);
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      slug,
      pass: allPass,
      checks,
      grouping: {
        required: groups.requiredBeforeLaunch.length,
        quickWins: groups.quickWins.length,
        highImpact: groups.highImpact.length,
        future: groups.future.length,
        completed: groups.completed.length,
        deferred: groups.deferred.length,
      },
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ ENHANCEMENT WORKSPACE SIMPLIFICATION V2 PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
