#!/usr/bin/env npx tsx
/**
 * Growth Engine Framework V1 — workflow, competitor model, integration, regression guards.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GROWTH_ENGINE_STEPS,
  GROWTH_ENGINE_VERSION,
  buildGrowthEngineFramework,
  buildGrowthPlanRecommendation,
} from "../src/pharmacy/growthEngineFrameworkService.ts";
import {
  normalizeGrowthEngineCompetitor,
  emptyFutureMetrics,
} from "../src/pharmacy/growthEngineCompetitorModel.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import {
  renderGrowthEngineHubPage,
  renderBusinessIntelligencePage,
  renderLocalMarketPage,
  renderWebsiteIntelligencePage,
  renderGrowthIntelligencePage,
  renderGrowthPlanPage,
  renderGeneratePage,
  renderGrowthEngineDashboardPage,
} from "../src/pharmacy/growthEnginePageRenderers.ts";
import { growthEngineWorkflowCss } from "../src/pharmacy/growthEngineWorkflowNav.ts";
import { buildPlatformNavItems } from "../src/pharmacy/pharmacyPlatformNav.ts";
import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { WIZARD_TOTAL_STEPS } from "../src/pharmacy/pharmacyProfileWizardSteps.ts";
import { normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES = path.join(ROOT, "data/pharmacy-profiles");

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

function loadSlug(slug: string) {
  const file = path.join(PROFILES, `${slug}.json`);
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8"))).data;
}

function main() {
  console.log("\n=== Growth Engine Framework V1 ===\n");

  record("framework-version", GROWTH_ENGINE_VERSION === 1, `v${GROWTH_ENGINE_VERSION}`);
  record("seven-workflow-steps", GROWTH_ENGINE_STEPS.length === 7, String(GROWTH_ENGINE_STEPS.length));
  record("step-ids-unique", new Set(GROWTH_ENGINE_STEPS.map((s) => s.id)).size === 7, "unique");

  record("workflow-css", growthEngineWorkflowCss().includes("ge-stepper"), "stepper styles");
  record("nav-growth-engine", buildPlatformNavItems("pharmaconnect").some((i) => i.id === "growth-engine"), "platform nav");

  const routesFile = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/index.ts"), "utf8");
  record("routes-registered", routesFile.includes("growthEnginePageRouter") && routesFile.includes("growthEngineApiRouter"), "index.ts");

  const apiFile = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("api-discover", apiFile.includes("local-market/discover"), "discover endpoint");
  record("api-status", apiFile.includes("/status"), "status endpoint");

  record("competitor-model-fields", (() => {
    const c = normalizeGrowthEngineCompetitor({
      placeId: "abc",
      businessName: "Test Pharmacy",
      rating: 4.5,
      reviewCount: 10,
      photoCount: 3,
      primaryCategory: "Pharmacy",
      future: emptyFutureMetrics(),
    });
    return Boolean(c?.placeId && c.future.indexedPages === null);
  })(), "model + future placeholders");

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const data = loadSlug(slug);
    const framework = buildGrowthEngineFramework(slug);
    record(`${slug}:framework-builds`, framework.steps.length === 7, `${framework.overallCompletionPct}%`);
    record(`${slug}:step-urls`, framework.steps.every((s) => s.url.includes("/api/growth-engine")), "routes");

    const plan = buildGrowthPlanRecommendation(slug);
    record(`${slug}:growth-plan`, plan.estimatedPages > 0 && Boolean(plan.suggestedCampaign), plan.suggestedCampaign);

    const hub = renderGrowthEngineHubPage(slug);
    record(`${slug}:hub-html`, hub.includes("Growth Engine") && hub.includes("ge-stepper"), "hub");
    record(`${slug}:step1-html`, renderBusinessIntelligencePage(slug, data).includes("Your Pharmacy"), "your pharmacy report");
    record(`${slug}:step2-html`, renderLocalMarketPage(slug, loadCompetitorSnapshot(slug)).includes("Your Local Market"), "local market report");
    record(`${slug}:step3-html`, renderWebsiteIntelligencePage(slug).includes("Your Website Report"), "website report");
    record(`${slug}:step4-html`, renderGrowthIntelligencePage(slug, loadCompetitorSnapshot(slug)).includes("Growth Overview"), "growth intelligence internal");
    record(`${slug}:step5-html`, renderGrowthPlanPage(slug, plan).includes("Your Growth Plan"), "growth plan report");
    record(`${slug}:step6-html`, renderGeneratePage(slug, plan).includes("content-package"), "generate");
    record(`${slug}:step7-html`, renderGrowthEngineDashboardPage(slug).includes("What should I do today?"), "operational dashboard v1");

    const wizardQuality = computeWizardQualityScore(data);
    record(`${slug}:wizard-unchanged`, wizardQuality.categories.length === 7, "wizard scoring intact");
    record(`${slug}:wizard-steps`, WIZARD_TOTAL_STEPS === 8, "wizard v2 steps unchanged");
  }

  record("docs-exist", fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-FRAMEWORK-V1.md")), "documentation");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
