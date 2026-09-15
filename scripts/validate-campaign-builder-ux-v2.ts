#!/usr/bin/env npx tsx
/**
 * Campaign Builder UX V2 — commercial presentation validation.
 */
import {
  CB_UX_BADGE_GROW,
  CB_UX_BADGE_NEW,
  CB_UX_BUILD_CAMPAIGN,
  CB_UX_BUILD_MY_CAMPAIGN,
  CB_UX_CHOOSE_TITLE,
  CB_UX_RECOMMENDED_BANNER,
  CB_UX_STEP_LABELS,
  cbUxCopyIsCommercialSafe,
  cbUxPrimaryActionCount,
} from "../src/pharmacy/growthEngineCampaignBuilderUxV2.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { selectCampaignBuilderService } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { buildGrowthPlanIntelligence } from "../src/pharmacy/growthEngineCampaignRecommendationEngine.ts";

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
  console.log("\n=== Campaign Builder UX V2 ===\n");

  const choose = renderCampaignBuilderPage(TEST_SLUG, "choose");
  record("choose-title", choose.includes(CB_UX_CHOOSE_TITLE), CB_UX_CHOOSE_TITLE);
  record(
    "choose-subtitle",
    choose.includes("Based on your pharmacy, your website and your local market"),
    "consultation subtitle",
  );
  record("recommended-banner", choose.includes(CB_UX_RECOMMENDED_BANNER), CB_UX_RECOMMENDED_BANNER);
  record("grow-this-service", choose.includes(CB_UX_BADGE_GROW), CB_UX_BADGE_GROW);
  record(
    "new-growth-opportunity",
    !choose.includes("Missing Opportunity") && choose.includes(CB_UX_BADGE_GROW),
    CB_UX_BADGE_NEW + " when missing cards present",
  );
  record("build-campaign-cta", choose.includes(CB_UX_BUILD_CAMPAIGN), CB_UX_BUILD_CAMPAIGN);
  record("no-choose-campaign-generic", !choose.includes(">Choose Campaign<") && !choose.includes("Create Campaign"), "removed generic labels");

  selectCampaignBuilderService(TEST_SLUG, "pharmacy-first");
  const overview = renderCampaignBuilderPage(TEST_SLUG, "overview");
  record("what-well-create", overview.includes("What We'll Create") && overview.includes("Here's everything PharmaConnect will prepare"), "overview page");
  record("overview-no-seo-jargon", !overview.toLowerCase().includes("seo strength"), "no SEO label");

  const settings = renderCampaignBuilderPage(TEST_SLUG, "settings");
  record("choose-what-to-include", settings.includes("Choose What To Include"), CB_UX_STEP_LABELS.settings);

  const approval = renderCampaignBuilderPage(TEST_SLUG, "approval");
  record("ready-to-build", approval.includes("Ready To Build") && approval.includes(CB_UX_BUILD_MY_CAMPAIGN), CB_UX_BUILD_MY_CAMPAIGN);

  const review = renderCampaignBuilderPage(TEST_SLUG, "review");
  record(
    "review-your-campaign",
    review.includes("Review Your Campaign") && review.includes("Everything has been generated"),
    "review page shell",
  );

  record(
    "stepper-labels",
    choose.includes(CB_UX_STEP_LABELS.choose) &&
      choose.includes(CB_UX_STEP_LABELS.overview) &&
      choose.includes(CB_UX_STEP_LABELS.settings) &&
      choose.includes(CB_UX_STEP_LABELS.approval) &&
      choose.includes(CB_UX_STEP_LABELS.review),
    Object.values(CB_UX_STEP_LABELS).join(", "),
  );

  record(
    "commercial-language",
    [choose, overview, settings, approval, review].every(cbUxCopyIsCommercialSafe),
    "forbidden terms absent",
  );

  record(
    "primary-action-choose",
    cbUxPrimaryActionCount(choose) >= 1 && !choose.includes("Create Campaign"),
    `${cbUxPrimaryActionCount(choose)} primary CTA(s)`,
  );
  record("primary-action-overview", cbUxPrimaryActionCount(overview) === 1, `${cbUxPrimaryActionCount(overview)} primary CTA`);
  record("primary-action-settings", cbUxPrimaryActionCount(settings) === 1, `${cbUxPrimaryActionCount(settings)} primary CTA`);
  record("primary-action-approval", cbUxPrimaryActionCount(approval) === 1, `${cbUxPrimaryActionCount(approval)} primary CTA`);

  const plan = buildGrowthPlanIntelligence(PLAN_SLUG);
  const planChoose = renderCampaignBuilderPage(PLAN_SLUG, "choose");
  record(
    "growth-plan-still-works",
    Boolean(plan.primaryCampaign) && planChoose.includes(CB_UX_BUILD_CAMPAIGN),
    plan.primaryCampaign?.campaignName || "n/a",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.log(`  FAIL: ${c.id} — ${c.detail}`));
    process.exit(1);
  }
}

main();
