/**
 * NT-E2E-13 — Commercial Intelligence evidence completeness validation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { resolveGoogleProfileOnboardingState } from "../src/pharmacy/masterAdminGoogleProfileOnboardingService.ts";

const SLUG = "reliable-direct-pharmacy";
const SEARCH_DEMAND_UNAVAILABLE =
  "Search demand not yet available. Keyword research can be completed using connected keyword intelligence.";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function main() {
  const steps: Step[] = [];
  const page = readFileSync(
    resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"),
    "utf8",
  );
  const dashboardSrc = readFileSync(
    resolve("src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"),
    "utf8",
  );

  steps.push(step("Dashboard exposes googleProfileMetrics", dashboardSrc.includes("googleProfileMetrics: CommercialGoogleMetric[]")));
  steps.push(step("Dashboard exposes sectionEvidence", dashboardSrc.includes("sectionEvidence:")));
  steps.push(step("Dashboard exposes competitorSummary", dashboardSrc.includes("competitorSummary:")));
  steps.push(step("Dashboard exposes trafficOpportunity", dashboardSrc.includes("trafficOpportunity:")));
  steps.push(step("No fabricated traffic volumes in dashboard service", !dashboardSrc.includes("estimatedMonthlySearches")));
  steps.push(step("Search demand unavailable message present", dashboardSrc.includes(SEARCH_DEMAND_UNAVAILABLE)));
  steps.push(step("UI renders Google Profile Metrics table", page.includes("ciMetricTable") && page.includes("Google Profile Metrics")));
  steps.push(step("UI renders Gap Analysis section", page.includes("Gap Analysis")));
  steps.push(step("UI renders evidence footers", page.includes("ciEvidenceFoot")));
  steps.push(step("UI uses measured competitor summary", page.includes("ciCompSummaryHtml")));
  steps.push(step("UI traffic section uses provenance", page.includes("Provenance:")));

  const d = buildCommercialIntelligenceDashboard(SLUG);
  const profile = readSetupProfile(SLUG);
  const googleState = resolveGoogleProfileOnboardingState(profile);

  steps.push(step("Google metrics array populated", d.googleProfileMetrics.length === 4, `count=${d.googleProfileMetrics.length}`));
  steps.push(
    step(
      "Google metrics include all required fields",
      d.googleProfileMetrics.every(
        (m) =>
          m.label &&
          m.yourPharmacy != null &&
          m.localAverage != null &&
          m.highestCompetitor != null &&
          m.gap != null &&
          m.recommendedTarget != null &&
          m.opportunity,
      ),
    ),
  );

  if (googleState === "no_profile") {
    const reviews = d.googleProfileMetrics.find((m) => m.id === "reviews");
    const rating = d.googleProfileMetrics.find((m) => m.id === "rating");
    const photos = d.googleProfileMetrics.find((m) => m.id === "photos");
    const categories = d.googleProfileMetrics.find((m) => m.id === "categories");
    steps.push(step("No GBP: reviews = 0", reviews?.yourPharmacy === "0", reviews?.yourPharmacy));
    steps.push(step("No GBP: rating = 0.0", rating?.yourPharmacy === "0.0", rating?.yourPharmacy));
    steps.push(step("No GBP: photos = 0", photos?.yourPharmacy === "0", photos?.yourPharmacy));
    steps.push(step("No GBP: categories = 0", categories?.yourPharmacy === "0", categories?.yourPharmacy));
  }

  steps.push(
    step(
      "Gap analysis opportunities present",
      d.googleProfileMetrics.every((m) => m.opportunity.length > 20),
    ),
  );
  steps.push(
    step(
      "Competitor summary measured",
      d.competitorSummary.length >= 3 && d.competitorSummary.every((s) => s.label && s.statement),
      `lines=${d.competitorSummary.length}`,
    ),
  );
  steps.push(
    step(
      "Competitor summary references evidence source",
      d.competitorSummary.some((s) => /google-places|google places/i.test(s.statement)),
    ),
  );
  steps.push(
    step(
      "Traffic opportunity uses search demand unavailable",
      d.trafficOpportunity.summary === SEARCH_DEMAND_UNAVAILABLE ||
        d.trafficOpportunity.keywords.every((k) => k.searchDemand === SEARCH_DEMAND_UNAVAILABLE),
    ),
  );
  steps.push(
    step(
      "Traffic keywords include provenance",
      d.trafficOpportunity.keywords.length === 0 ||
        d.trafficOpportunity.keywords.every((k) => k.provenance && k.provenance !== "Unknown"),
      `keywords=${d.trafficOpportunity.keywords.length}`,
    ),
  );
  steps.push(step("No fabricated enquiry estimates", d.executiveSummary.estimatedEnquiryOpportunity === SEARCH_DEMAND_UNAVAILABLE));
  steps.push(
    step(
      "Executive summary traffic has provenance or unavailable message",
      d.executiveSummary.estimatedTrafficOpportunity.includes("Pharmacy Visibility Bridge") ||
        d.executiveSummary.estimatedTrafficOpportunity === SEARCH_DEMAND_UNAVAILABLE,
      d.executiveSummary.estimatedTrafficOpportunity.slice(0, 120),
    ),
  );

  const sections = [
    d.sectionEvidence.executiveSummary,
    d.sectionEvidence.googleProfileMetrics,
    d.sectionEvidence.competitorAnalysis,
    d.sectionEvidence.localMarketIntelligence,
    d.sectionEvidence.growthIntelligence,
    d.sectionEvidence.trafficOpportunity,
  ];
  steps.push(
    step(
      "All sections expose evidence provenance",
      sections.every((e) => e.evidenceSource && e.confidence && e.dataFreshness),
    ),
  );

  const dashJson = JSON.stringify(d);
  steps.push(step("No fabricated monthly search volumes", !/monthly searches|estimated traffic/i.test(dashJson)));
  steps.push(step("No dash placeholders for zero values in metrics", !d.googleProfileMetrics.some((m) => m.yourPharmacy === "-")));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-13 validation: FAIL (${failed.length})` : "\nNT-E2E-13 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
