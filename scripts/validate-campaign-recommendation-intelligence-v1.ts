#!/usr/bin/env npx tsx
/**
 * Campaign Recommendation Intelligence V1 validation.
 */
import {
  buildCampaignBuilderList,
  selectCampaignBuilderService,
} from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  buildCampaignRecommendationIntelligence,
  campaignIntelligenceCopyIsSafe,
  campaignIntelligenceHasMinimumEvidence,
} from "../src/pharmacy/growthEngineCampaignRecommendationIntelligenceService.ts";
import {
  CAMPAIGN_EVIDENCE_CARD_LABELS,
  CAMPAIGN_INTELLIGENCE_FORBIDDEN_TERMS,
} from "../src/pharmacy/growthEngineCampaignRecommendationIntelligenceModel.ts";
import { fallbackClaimsAreSafe } from "../src/pharmacy/growthEngineCampaignBuilderFallbackService.ts";

const TEST_SLUG = "pharmacy-delivered-4u-test";
const PLAN_SLUG = "dhmdigital";

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
  console.log("\n=== Campaign Recommendation Intelligence V1 ===\n");

  const campaigns = buildCampaignBuilderList(TEST_SLUG);
  record("campaigns-available", campaigns.length > 0, `${campaigns.length} campaigns`);

  const primary = campaigns.find((c) => c.recommended) || campaigns[0];
  const intel = primary ? buildCampaignRecommendationIntelligence(TEST_SLUG, primary.serviceId) : null;

  record(
    "every-recommendation-has-evidence",
    Boolean(intel && intel.evidenceCards.length >= 1),
    intel ? `${intel.evidenceCards.length} evidence card(s)` : "missing intelligence",
  );

  record(
    "evidence-card-count-range",
    Boolean(intel && intel.evidenceCards.length >= 3 && intel.evidenceCards.length <= 6),
    intel ? `${intel.evidenceCards.length} cards` : "n/a",
  );

  record(
    "no-invented-facts",
    Boolean(
      intel &&
        intel.evidenceCards.every((c) => fallbackClaimsAreSafe(c.detail) && fallbackClaimsAreSafe(c.label)) &&
        fallbackClaimsAreSafe(intel.summary.reasonSelected) &&
        fallbackClaimsAreSafe(intel.whyNow),
    ),
    "copy safety scan",
  );

  record(
    "recommendation-confidence",
    Boolean(intel && intel.confidence.level && intel.confidence.stars >= 2),
    intel ? `${intel.confidence.level} · ${intel.confidence.stars} stars` : "missing",
  );

  record(
    "evidence-source-labels",
    Boolean(
      intel &&
        intel.evidenceCards.every((c) =>
          ["Google Business Profile", "Website Analysis", "Local Market Analysis"].includes(c.source),
        ) &&
        intel.evidenceCards.every((c) => Object.values(CAMPAIGN_EVIDENCE_CARD_LABELS).includes(c.label)),
    ),
    intel ? intel.evidenceCards.map((c) => c.source).join(", ") : "missing",
  );

  record(
    "current-position-card",
    Boolean(intel && intel.currentPosition.length >= 5 && intel.currentPosition.some((p) => p.label === "Overall Campaign Readiness")),
    intel ? `${intel.currentPosition.length} rows` : "missing",
  );

  record(
    "expected-outcome-section",
    Boolean(intel && intel.expectedOutcomes.length >= 1 && intel.expectedOutcomes.every((o) => !/rank|revenue|demand/i.test(o))),
    intel ? intel.expectedOutcomes.join("; ") : "missing",
  );

  record(
    "whats-next-section",
    Boolean(intel && intel.whatsNext.includes("review") && intel.whatsNext.includes("before publishing")),
    intel?.whatsNext.slice(0, 50) || "missing",
  );

  if (primary) {
    selectCampaignBuilderService(TEST_SLUG, primary.serviceId);
  }
  const overviewHtml = renderCampaignBuilderPage(TEST_SLUG, "overview");

  record(
    "overview-intelligence-rendered",
    overviewHtml.includes("Why we recommend starting here") &&
      overviewHtml.includes("Current visibility") &&
      overviewHtml.includes("What this campaign is designed to achieve") &&
      overviewHtml.includes("Recommendation Confidence") &&
      overviewHtml.includes("What's next"),
    "overview sections",
  );

  record(
    "no-seo-jargon",
    !overviewHtml.toLowerCase().includes("seo strength") && !overviewHtml.toLowerCase().includes("search engine"),
    "overview scan",
  );

  record(
    "no-ai-jargon",
    !/\bartificial intelligence\b/i.test(overviewHtml) &&
      !overviewHtml.includes("AI Images") &&
      overviewHtml.includes("What We'll Create"),
    "overview scan",
  );

  record(
    "commercial-language-safe",
    Boolean(intel && campaignIntelligenceCopyIsSafe(JSON.stringify(intel))),
    CAMPAIGN_INTELLIGENCE_FORBIDDEN_TERMS.join(", "),
  );

  record(
    "minimum-evidence-helper",
    Boolean(intel && campaignIntelligenceHasMinimumEvidence(intel)),
    "helper",
  );

  const planIntel = buildCampaignRecommendationIntelligence(
    PLAN_SLUG,
    buildCampaignBuilderList(PLAN_SLUG)[0]?.serviceId || "pharmacy-first",
  );
  record(
    "growth-plan-path",
    Boolean(planIntel && planIntel.evidenceCards.length >= 1),
    planIntel ? planIntel.serviceName : "missing",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.log(`  FAIL: ${c.id} — ${c.detail}`));
    process.exit(1);
  }
}

main();
