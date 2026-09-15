#!/usr/bin/env npx tsx
/**
 * Growth Engine — Product Reset Sprint V1 UX validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CUSTOMER_REPORT_STEP_IDS,
  GROWTH_ENGINE_STEPS,
  buildGrowthEngineFramework,
  buildGrowthPlanRecommendation,
  isCustomerVisibleInStepper,
} from "../src/pharmacy/growthEngineFrameworkService.ts";
import { renderGrowthEngineHubPage, renderBusinessIntelligencePage, renderLocalMarketPage, renderWebsiteIntelligencePage, renderGrowthPlanPage, renderGeneratePage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { WIZARD_TOTAL_STEPS } from "../src/pharmacy/pharmacyProfileWizardSteps.ts";
import { growthEngineWorkflowCss, renderGrowthEngineStepper } from "../src/pharmacy/growthEngineWorkflowNav.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "dhmdigital";

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

const BANNED_CUSTOMER_TERMS = [
  /\bschema\b/i,
  /\bcanonical\b/i,
  /\bbreadcrumb/i,
  /\bmeta titles?\b/i,
  /\bmeta descriptions?\b/i,
  /\bentity\b/i,
  /\bBusiness Intelligence\b/,
  /\bLocal Healthcare Intelligence\b/,
  /\bWebsite Intelligence\b/,
  /\bGrowth Intelligence\b/,
];

function bannedTermsIn(html: string): string[] {
  return BANNED_CUSTOMER_TERMS.filter((re) => re.test(html)).map((re) => re.source);
}

function loadSlug(slug: string) {
  const file = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8"))).data;
}

function main() {
  console.log("\n=== Growth Engine Product Reset Sprint V1 ===\n");

  record("four-report-ids", CUSTOMER_REPORT_STEP_IDS.length === 4, CUSTOMER_REPORT_STEP_IDS.join(", "));

  for (const id of CUSTOMER_REPORT_STEP_IDS) {
    const meta = GROWTH_ENGINE_STEPS.find((s) => s.id === id);
    record(`report-title:${id}`, Boolean(meta?.title.startsWith("Your")), meta?.title || "missing");
  }

  record("gi-hidden-from-stepper", !isCustomerVisibleInStepper("growth-intelligence"), "internal step");

  const framework = buildGrowthEngineFramework(SLUG);
  const stepper = renderGrowthEngineStepper(framework, "local-market");
  record("stepper-no-gi", !stepper.includes("Growth Intelligence"), "customer stepper");
  record("stepper-four-reports", (stepper.match(/Report \d/g) || []).length >= 4, "report labels");

  const data = loadSlug(SLUG);
  const plan = buildGrowthPlanRecommendation(SLUG);
  const pages: Array<{ id: string; html: string }> = [
    { id: "pharmacy", html: renderBusinessIntelligencePage(SLUG, data) },
    { id: "local-market", html: renderLocalMarketPage(SLUG, loadCompetitorSnapshot(SLUG)) },
    { id: "website", html: renderWebsiteIntelligencePage(SLUG) },
    { id: "growth-plan", html: renderGrowthPlanPage(SLUG, plan) },
    { id: "hub", html: renderGrowthEngineHubPage(SLUG) },
  ];

  for (const page of pages) {
    const banned = bannedTermsIn(page.html);
    record(`${page.id}:no-seo-jargon`, banned.length === 0, banned.join(", ") || "clean");
  }

  record("pharmacy-import-badges", pages[0].html.includes("Imported") && pages[0].html.includes("Needs Review"), "import badges");
  record("local-comparison", pages[1].html.includes("Competitor comparison") && pages[1].html.includes("Market insights"), "comparison report");
  record("website-plain-english", pages[2].html.includes("What this means for your pharmacy"), "plain english");
  record("website-skips-gi", pages[2].html.includes("Your Growth Plan") && !pages[2].html.includes("growth-intelligence"), "nav to plan");
  record("plan-one-campaign", pages[3].html.includes("Your recommended campaign"), "one campaign");

  const gen = renderGeneratePage(SLUG, plan);
  record("generate-preserved", gen.includes("content-package") && gen.includes("Create content"), "generation workflow");

  record("wizard-unchanged", computeWizardQualityScore(data).categories.length === 7 && WIZARD_TOTAL_STEPS === 8, "BPI engine intact");

  const pubApi = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyPublishing.ts"), "utf8");
  record("publishing-engine-unchanged", pubApi.includes("/publish") && pubApi.includes("confirm"), "publish API");

  record("workflow-css-review-badge", growthEngineWorkflowCss().includes("ge-import-badge.review"), "needs review badge");

  record(
    "report-doc-exists",
    fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-PRODUCT-RESET-V1.md")),
    "documentation",
  );

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
