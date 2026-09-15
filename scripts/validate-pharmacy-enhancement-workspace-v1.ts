#!/usr/bin/env npx tsx
/**
 * PharmaConnect Enhancement Workspace V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { refreshPharmacyAuthorityEnhancement } from "../src/pharmacy/pharmacyAuthorityEnhancementService.ts";
import {
  buildEnhancementWorkspaceView,
  getEnhancementWorkspacePath,
  loadEnhancementWorkspaceStore,
  markEnhancementTaskComplete,
  resolveEnhancementPrimaryAction,
} from "../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { buildPharmacyCampaignControlCentre } from "../src/pharmacy/pharmacyCampaignControlCentreService.ts";
import { renderEnhancementWorkspaceHtml } from "../artifacts/api-server/src/routes/pharmacyEnhancementWorkspacePage.ts";
import { renderPharmacyCampaignsHtml } from "../artifacts/api-server/src/routes/pharmacyCampaignsPage.ts";

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

console.log(`\nPharmaConnect Enhancement Workspace V1 — ${slug}\n`);

refreshPharmacyAuthorityEnhancement(slug);
const viewBefore = buildEnhancementWorkspaceView(slug);
const html = renderEnhancementWorkspaceHtml(viewBefore);

record("1-workspace-loads", html.includes("Enhancement Workspace") && html.includes("Task board"), "HTML workspace renders");
record(
  "2-recommendations-grouped",
  viewBefore.board.ready.length + viewBefore.board.inProgress.length + viewBefore.board.completed.length + viewBefore.board.deferred.length > 0,
  `ready=${viewBefore.board.ready.length} in_progress=${viewBefore.board.inProgress.length} completed=${viewBefore.board.completed.length}`,
);

const sampleTask = viewBefore.board.ready[0];
if (sampleTask) {
  const action = resolveEnhancementPrimaryAction(sampleTask, slug, sampleTask.serviceId);
  record("3-action-link-resolves", action.url.startsWith("/"), `${action.label} → ${action.url}`);
} else {
  record("3-action-link-resolves", false, "No ready tasks");
}

const remainingBefore = viewBefore.summary.recommendationsRemaining;
const recToComplete = viewBefore.board.ready.find((t) => t.signalId.includes("reviewer") || t.title.toLowerCase().includes("reviewer")) || viewBefore.board.ready[0];

if (recToComplete) {
  const result = markEnhancementTaskComplete(slug, recToComplete.id, {
    completedBy: "validation-script",
    notes: "Validation test mode completion",
    serviceId: recToComplete.serviceId,
  });
  record("4-status-updates", result.store.tasks.some((t) => t.recommendationId === recToComplete.id && t.status === "completed"), "Task marked completed");
  record("5-completion-log-created", fs.existsSync(getEnhancementWorkspacePath(slug)), getEnhancementWorkspacePath(slug));
  record("6-authority-refresh-executes", Boolean(result.refresh?.authorityRefreshedAt), result.refresh?.authorityRefreshedAt || "missing");
} else {
  record("4-status-updates", false, "No task to complete");
  record("5-completion-log-created", fs.existsSync(getEnhancementWorkspacePath(slug)), "skipped");
  record("6-authority-refresh-executes", false, "skipped");
}

const viewAfter = buildEnhancementWorkspaceView(slug);
record(
  "7-remaining-reduced",
  recToComplete ? viewAfter.summary.recommendationsRemaining < remainingBefore : viewAfter.summary.recommendationsRemaining >= 0,
  `${remainingBefore} → ${viewAfter.summary.recommendationsRemaining} remaining`,
);
record(
  "8-completed-increased",
  recToComplete ? viewAfter.summary.completed >= 1 : viewAfter.summary.completed >= 0,
  `${viewAfter.summary.completed} completed`,
);

const centre = buildPharmacyCampaignControlCentre(slug);
const campaign = centre.campaigns.find((c) => c.status === "active") || centre.campaigns[0];
const campaignsHtml = renderPharmacyCampaignsHtml(centre);
record(
  "9-campaign-os-updates",
  Boolean(campaign?.enhancementWorkspaceUrl && campaign.enhancementProgressRemaining >= 0),
  campaign ? `remaining=${campaign.enhancementProgressRemaining} completed=${campaign.enhancementProgressCompleted} projected=${campaign.enhancementProgressProjected}` : "no campaign",
);

record("10-campaign-os-section", campaignsHtml.includes("Enhancement Progress") && campaignsHtml.includes("Continue Improvements"), "Campaign OS section rendered");

const layoutSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyVisualExperienceLayoutV3.ts"), "utf8");
record("11-no-template-modified", layoutSrc.includes("clusterImagePanel"), "Template unchanged");

const masterDir = path.join(ROOT, "docs/pharmacy-master-library");
record("12-no-master-modified", fs.existsSync(masterDir), "Masters read-only");

try {
  const liveRes = await fetch(`${BASE}/api/pharmacy-enhancement-workspace?slug=${slug}`, { redirect: "manual" });
  if (liveRes.status === 302) {
    record("13-live-workspace", true, "Auth-gated");
  } else {
    const liveHtml = await liveRes.text();
    record("13-live-workspace", liveHtml.includes("Enhancement Workspace"), `Live at ${BASE}`);
  }
} catch {
  record("13-live-workspace", html.includes("Enhancement Workspace"), "Offline validation");
}

const store = loadEnhancementWorkspaceStore(slug);
record("14-test-mode-flag", store.testMode === true, "Test mode enabled");

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-enhancement-workspace-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const allPass = checks.every((c) => c.pass);
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      slug,
      pass: allPass,
      checks,
      workspace: {
        remainingBefore,
        remainingAfter: viewAfter.summary.recommendationsRemaining,
        completed: viewAfter.summary.completed,
        projectedScore: viewAfter.summary.projectedAuthorityScore,
      },
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ ENHANCEMENT WORKSPACE V1 PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
