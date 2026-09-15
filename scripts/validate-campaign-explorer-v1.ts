#!/usr/bin/env npx tsx
/**
 * Campaign Explorer V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCampaignExplorerCatalog,
  resolveRecommendedCampaign,
} from "../src/pharmacy/growthEngineCampaignExplorerService.ts";
import {
  CE_BADGE_EXISTING,
  CE_BADGE_GROWTH,
  CE_BADGE_NHS,
  CE_BADGE_PRIVATE,
  CE_EXPLORE_TITLE,
  CE_SELECT_CAMPAIGN,
} from "../src/pharmacy/growthEngineCampaignExplorerModel.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  buildCampaignBuilderOverview,
  selectCampaignBuilderService,
} from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { CB_UX_BUILD_CAMPAIGN, CB_UX_RECOMMENDED_BANNER } from "../src/pharmacy/growthEngineCampaignBuilderUxV2.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TEST_SLUG = "pharmacy-delivered-4u-test";

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
  console.log("\n=== Campaign Explorer V1 ===\n");

  const catalog = buildCampaignExplorerCatalog(TEST_SLUG);
  const recommended = resolveRecommendedCampaign(TEST_SLUG);
  const chooseHtml = renderCampaignBuilderPage(TEST_SLUG, "choose");

  record("catalog-built", Boolean(catalog), catalog?.recommendedServiceName || "missing");
  record(
    "recommended-campaign-first",
    Boolean(recommended && catalog && recommended.serviceId === catalog.recommendedServiceId),
    recommended?.serviceName || "missing",
  );
  record(
    "recommended-banner-pinned",
    chooseHtml.includes(CB_UX_RECOMMENDED_BANNER) && chooseHtml.includes('id="recommended"'),
    CB_UX_RECOMMENDED_BANNER,
  );
  record(
    "recommended-build-campaign",
    (chooseHtml.match(/🚀 Build Campaign/g) || []).length === 1,
    `${(chooseHtml.match(/🚀 Build Campaign/g) || []).length} primary build button`,
  );
  record(
    "explore-other-campaigns",
    chooseHtml.includes(CE_EXPLORE_TITLE) && chooseHtml.includes("You can choose another campaign at any time"),
    CE_EXPLORE_TITLE,
  );
  record(
    "existing-services-section",
    chooseHtml.includes("Services Already On Your Website") &&
      chooseHtml.includes(CE_BADGE_EXISTING) &&
      chooseHtml.includes(`(${catalog?.websiteImportServiceCount || 0})`),
    `${catalog?.existingOnWebsite.length || 0} existing · import ${catalog?.websiteImportServiceCount || 0}`,
  );
  record(
    "growth-opportunities-section",
    catalog?.growthOpportunities.length
      ? chooseHtml.includes("Recommended Growth Opportunities") && chooseHtml.includes(CE_BADGE_GROWTH)
      : !chooseHtml.includes("Recommended Growth Opportunities"),
    catalog?.growthOpportunities.length ? `${catalog.growthOpportunities.length} growth` : "hidden — no evidence",
  );
  record(
    "nhs-services-section",
    chooseHtml.includes("All NHS Pharmacy Services") && chooseHtml.includes(CE_BADGE_NHS),
    `${catalog?.nhsServices.length || 0} NHS`,
  );
  record(
    "private-services-section",
    chooseHtml.includes("Private Services") && chooseHtml.includes(CE_BADGE_PRIVATE),
    `${catalog?.privateServices.length || 0} private`,
  );
  record(
    "select-campaign-buttons",
    chooseHtml.includes(CE_SELECT_CAMPAIGN) && (chooseHtml.match(/Select Campaign/g) || []).length >= 3,
    `${(chooseHtml.match(/Select Campaign/g) || []).length} select buttons`,
  );

  const alternateId =
    catalog?.existingOnWebsite.find((s) => s.serviceId !== catalog.recommendedServiceId)?.serviceId ||
    "blood-pressure-checks";
  selectCampaignBuilderService(TEST_SLUG, alternateId);
  const alternateOverview = renderCampaignBuilderPage(TEST_SLUG, "overview");
  const overviewData = buildCampaignBuilderOverview(TEST_SLUG);

  record(
    "alternate-updates-overview",
    Boolean(overviewData && overviewData.serviceId === alternateId),
    overviewData?.campaignName || alternateId,
  );
  record(
    "alternate-updates-intelligence-or-preview",
    alternateOverview.includes("What We'll Create") &&
      (alternateOverview.includes("Why we recommend starting here") || alternateOverview.includes("What this campaign is designed to achieve") || alternateOverview.includes(overviewData?.campaignName || "")),
    "overview + intelligence/preview",
  );
  record(
    "return-to-recommended-link",
    alternateOverview.includes("Return to recommended campaign"),
    catalog?.recommendedServiceName || "n/a",
  );

  record(
    "workflow-select-endpoint",
    chooseHtml.includes(`/api/growth-engine/${TEST_SLUG}/campaign-builder/select`),
    "select POST preserved",
  );
  record(
    "generation-engine-unchanged",
    fs
      .readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts"), "utf8")
      .includes("generateContentPackage") &&
      !fs
        .readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts"), "utf8")
        .includes("CampaignExplorer"),
    "delegates to existing generator",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.log(`  FAIL: ${c.id} — ${c.detail}`));
    process.exit(1);
  }
}

main();
