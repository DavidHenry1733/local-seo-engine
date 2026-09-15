#!/usr/bin/env npx tsx
/**
 * Growth Engine — Operational Completion V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOperationalHome, customerReadinessLabel, isWebsiteIntelligenceComplete } from "../src/pharmacy/growthEngineOperationalActions.ts";
import { renderGrowthEngineDashboardPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { renderLocalMarketPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { renderGrowthIntelligencePage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { renderGeneratePage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { buildGrowthPlanRecommendation } from "../src/pharmacy/growthEngineFrameworkService.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

function main() {
  console.log("\n=== Growth Engine Operational Completion V1 ===\n");

  record("readiness-label-map", customerReadinessLabel("Generator available") === "Content creation ready", "terminology");

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const ops = buildOperationalHome(slug);
    record(`${slug}:operational-home`, Boolean(ops.headline && ops.todaysTasks.length), ops.currentStageLabel);

    const dash = renderGrowthEngineDashboardPage(slug);
    record(`${slug}:dashboard-today`, dash.includes("What should I do today?"), "operational home");
    record(`${slug}:dashboard-tasks`, dash.includes("Today's tasks"), "tasks panel");
    record(`${slug}:dashboard-milestone`, dash.includes("Next milestone"), "milestone");
    record(`${slug}:no-bridge-jargon`, !dash.includes("visibility bridges"), "no bridge jargon");
    record(`${slug}:dashboard-timeline`, dash.includes("Growth Timeline"), "timeline retained");

    const local = renderLocalMarketPage(slug, loadCompetitorSnapshot(slug));
    record(`${slug}:local-to-website`, local.includes("website-intelligence"), "LM → Website Report CTA");
    record(`${slug}:local-not-skip-website`, !local.includes("Continue to Growth Intelligence →"), "no skip website");

    const gi = renderGrowthIntelligencePage(slug, loadCompetitorSnapshot(slug));
    record(`${slug}:gi-plan-cta`, gi.includes("Your Growth Plan"), "GI CTA to plan");
    if (isWebsiteIntelligenceComplete(slug)) {
      record(`${slug}:gi-website-live`, gi.includes("Pages analysed") || gi.includes("From Website Intelligence"), "website data when complete");
    } else {
      record(`${slug}:gi-website-pending`, gi.includes("Website analysis has not run yet") || gi.includes("Available after"), "website placeholder when pending");
    }

    const plan = buildGrowthPlanRecommendation(slug);
    const gen = renderGeneratePage(slug, plan);
    record(`${slug}:generate-no-serviceid`, !gen.includes("pharmacy-first") || !gen.includes("(pharmacy-first)"), "no raw serviceId slug");
    record(`${slug}:generate-customer-copy`, gen.includes("Create your content") || gen.includes("Create content"), "customer language");
  }

  record(
    "report-exists",
    fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-OPERATIONAL-COMPLETION-V1.md")),
    "operational report",
  );

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
