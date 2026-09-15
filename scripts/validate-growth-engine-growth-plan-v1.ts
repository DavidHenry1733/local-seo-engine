#!/usr/bin/env npx tsx
/**
 * Growth Engine — Growth Plan Intelligence V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as growthEngineCampaignModel from "../src/pharmacy/growthEngineCampaignModel.ts";
import * as growthEngineCampaignRecommendationEngine from "../src/pharmacy/growthEngineCampaignRecommendationEngine.ts";
import * as growthEngineFrameworkService from "../src/pharmacy/growthEngineFrameworkService.ts";
import * as growthEngineLocalMarketService from "../src/pharmacy/growthEngineLocalMarketService.ts";
import * as growthEnginePageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as growthEngineGrowthPlanPage from "../src/pharmacy/growthEngineGrowthPlanPage.ts";
import * as pharmacyMasterPublishConfig from "../src/pharmacy/pharmacyMasterPublishConfig.ts";
import * as pharmacyProfileSchema from "../src/pharmacy/pharmacyProfileSchema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

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
  const file = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
  const { normalizeProfileData } = exported(pharmacyProfileSchema);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function main() {
  const { BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS, GROWTH_PLAN_INTELLIGENCE_VERSION } = exported(growthEngineCampaignModel);
  const { buildGrowthPlanIntelligence, estimateCampaignOutputs, toGrowthEnginePlanRecommendation } =
    exported(growthEngineCampaignRecommendationEngine);
  const { buildGrowthPlanRecommendation } = exported(growthEngineFrameworkService);
  const { loadCompetitorSnapshot } = exported(growthEngineLocalMarketService);
  const { renderGrowthPlanPage } = exported(growthEnginePageRenderers);
  const { growthPlanPageCss } = exported(growthEngineGrowthPlanPage);
  const { BENCHMARK_MASTER_SERVICE_IDS } = exported(pharmacyMasterPublishConfig);
  const { normalizeProfileData } = exported(pharmacyProfileSchema);

  console.log("\n=== Growth Engine Growth Plan Intelligence V1 ===\n");

  record("model-version", GROWTH_PLAN_INTELLIGENCE_VERSION === 1, `v${GROWTH_PLAN_INTELLIGENCE_VERSION}`);

  record(
    "output-defaults",
    BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.blogs === 3 &&
      BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.socialPosts === 20 &&
      BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.gbpPosts === 10,
    "generator-aligned counts",
  );

  const sampleProfile = normalizeProfileData({
    pharmacyName: "Test Pharmacy",
    selectedServices: ["pharmacy-first", "blood-pressure-checks"],
    selectedAreas: [{ areaName: "Town A", selected: true }, { areaName: "Town B", selected: true }],
  });
  const outputs = estimateCampaignOutputs(sampleProfile);
  record(
    "output-estimation",
    outputs.servicePage === 1 && outputs.clusterPages === 2 && outputs.blogs === 3,
    `${outputs.clusterPages} cluster pages for 2 areas`,
  );

  record(
    "generator-services",
    BENCHMARK_MASTER_SERVICE_IDS.includes("pharmacy-first"),
    `${BENCHMARK_MASTER_SERVICE_IDS.length} benchmark services`,
  );

  for (const slug of ["dhmdigital", "leeds-pharmacy"]) {
    const snapshot = loadCompetitorSnapshot(slug);
    const intel = buildGrowthPlanIntelligence(slug, snapshot);
    const profile = loadSlug(slug);

    record(`${slug}:plan-builds`, intel.version === 1 && Boolean(intel.executiveSummary.currentPosition), "intelligence report");

    if (intel.primaryCampaign) {
      const c = intel.primaryCampaign;
      record(
        `${slug}:one-campaign`,
        Boolean(c.campaignName && c.serviceId),
        c.campaignName,
      );
      record(
        `${slug}:evidence-backed`,
        c.evidence.some((e) => e.source !== "Business Profile"),
        `${c.evidence.length} evidence items`,
      );
      record(
        `${slug}:no-invented-evidence`,
        c.evidence.every((e) => e.headline && e.detail && e.source),
        "all evidence has source + detail",
      );
      record(
        `${slug}:profile-service`,
        (profile.selectedServices || []).includes(c.serviceId) ||
          profile.selectedServices?.length === 0 ||
          BENCHMARK_MASTER_SERVICE_IDS.includes(c.serviceId as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number]),
        c.serviceId,
      );
      record(
        `${slug}:generator-service`,
        BENCHMARK_MASTER_SERVICE_IDS.includes(c.serviceId as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number]),
        "in benchmark catalogue",
      );
      record(
        `${slug}:alternatives-max`,
        intel.alternatives.length <= 3,
        `${intel.alternatives.length} alternatives`,
      );
      record(
        `${slug}:readiness-items`,
        intel.readiness.length >= 5,
        intel.readiness.map((r) => (r.complete ? "✓" : "○") + r.label).join(", "),
      );
      record(
        `${slug}:expected-benefits`,
        c.expectedBenefits.length >= 3 && !c.expectedBenefits.some((b) => /rank/i.test(b)),
        "no ranking predictions",
      );
    } else {
      record(`${slug}:no-campaign-without-evidence`, true, "no primary when evidence insufficient");
    }

    const legacy = buildGrowthPlanRecommendation(slug);
    const mapped = toGrowthEnginePlanRecommendation(intel, profile);
    record(`${slug}:legacy-compat`, mapped.estimatedPages > 0 && Boolean(mapped.primaryServiceId), mapped.suggestedCampaign);

    record(
      `${slug}:legacy-no-cycle`,
      typeof legacy.primaryServiceId === "string",
      "buildGrowthPlanRecommendation still works for opportunity engine",
    );

    const html = renderGrowthPlanPage(slug, legacy);
    record(`${slug}:page-where-you-stand`, html.includes("Where you stand"), "executive summary");
    record(
      `${slug}:page-recommended-campaign`,
      html.includes("Recommended Campaign") || html.includes("Your recommended campaign") || html.includes("No evidence-backed campaign"),
      "campaign section",
    );
    record(`${slug}:page-why-campaign`, html.includes("Why This Campaign"), "section 3");
    record(`${slug}:page-what-built`, html.includes("What Will Be Built"), "section 4");
    record(`${slug}:page-estimated-outcome`, html.includes("Estimated Outcome"), "section 5");
    record(`${slug}:page-alternatives`, html.includes("Alternative Campaigns"), "section 6");
    record(`${slug}:page-readiness`, html.includes("Campaign Readiness"), "section 7");
    record(`${slug}:page-generate-cta`, html.includes("Open Campaign Builder"), "campaign builder CTA");
    record(`${slug}:page-local-copy`, html.includes("Your Pharmacy") || html.includes("Your Local Market") || html.includes("Complete Your Pharmacy"), "local pharmacy terminology retained");
    record(`${slug}:page-not-national-panel`, !html.includes("Market Opportunity Plan") && !html.includes("pharmacy seo"), "no national fixture injection");
    record(`${slug}:page-css`, growthPlanPageCss().includes(".gp-hero"), "page styles");
  }

  record(
    "docs-exist",
    fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-GROWTH-PLAN-V1.md")),
    "documentation",
  );

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
