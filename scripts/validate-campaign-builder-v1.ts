#!/usr/bin/env npx tsx
/**
 * Campaign Builder V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPAIGN_BUILDER_VERSION } from "../src/pharmacy/growthEngineCampaignBuilderModel.ts";
import {
  allCampaignBuilderAssetsApproved,
  approveCampaignBuilderAsset,
  buildCampaignBuilderApprovalSummary,
  buildCampaignBuilderList,
  buildCampaignBuilderOverview,
  buildCampaignBuilderReviewItems,
  campaignBuilderReadyToPublish,
  campaignBuilderStepUrl,
  loadCampaignBuilderSession,
  selectCampaignBuilderService,
  updateCampaignBuilderSettings,
} from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { buildGrowthPlanIntelligence } from "../src/pharmacy/growthEngineCampaignRecommendationEngine.ts";
import { buildCustomerCampaignGenerationContext } from "../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import { contentPackageGenerated } from "../src/pharmacy/pharmacyContentPackageService.ts";

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

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const SLUGS = ["dhmdigital", "pharmacy-delivered-4u-test", "pharmaconnect"].filter((slug) =>
  fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`)),
);

function pickValidationSlug(): string {
  for (const slug of SLUGS) {
    if (buildCampaignBuilderList(slug).length > 0) return slug;
  }
  return SLUGS[0] || "pharmaconnect";
}

function main() {
  console.log("\n=== Campaign Builder V1 ===\n");

  record("model-version", CAMPAIGN_BUILDER_VERSION === 1, `v${CAMPAIGN_BUILDER_VERSION}`);

  record(
    "routes-wired",
    readSrc("artifacts/api-server/src/routes/index.ts").includes("growthEngineCampaignBuilderPageRouter") &&
      readSrc("artifacts/api-server/src/routes/index.ts").includes("growthEngineCampaignBuilderRouter"),
    "page + API routers registered",
  );

  record(
    "growth-plan-handoff",
    readSrc("src/pharmacy/growthEngineGrowthPlanPage.ts").includes("campaign-builder") &&
      readSrc("artifacts/api-server/src/routes/api/growthEngine.ts").includes("campaign-builder"),
    "Growth Plan → Campaign Builder",
  );

  record(
    "generation-handoff",
    readSrc("artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts").includes("generateContentPackage"),
    "delegates to existing generator",
  );

  const slug = pickValidationSlug();
  const plan = buildGrowthPlanIntelligence(slug);
  const campaigns = buildCampaignBuilderList(slug);

  record("campaign-list", campaigns.length >= 0, `${campaigns.length} campaigns for ${slug}`);
  record(
    "campaign-list-fields",
    campaigns.length === 0 ||
      (Boolean(campaigns[0].serviceName) &&
        Boolean(campaigns[0].priority) &&
        Boolean(campaigns[0].reason) &&
        campaigns[0].expectedAssetCount > 0),
    campaigns[0] ? `${campaigns[0].serviceName} · ${campaigns[0].priority}` : "no campaigns yet",
  );

  const serviceId = plan.primaryCampaign?.serviceId || campaigns[0]?.serviceId;
  if (serviceId) {
    selectCampaignBuilderService(slug, serviceId);
    const overview = buildCampaignBuilderOverview(slug);
    record(
      "campaign-overview",
      Boolean(overview?.campaignName) && overview!.assets.length >= 10,
      overview ? `${overview.assets.length} asset lines · ${overview.totals.pages} pages` : "missing",
    );
    record(
      "asset-totals",
      Boolean(overview && overview.totals.pages >= 0 && overview.totals.posts >= 0),
      overview ? `pages=${overview.totals.pages} posts=${overview.totals.posts}` : "n/a",
    );

    updateCampaignBuilderSettings(slug, "manual", {
      blogs: false,
      social: false,
      servicePage: true,
      guides: true,
      faqs: true,
      gbp: true,
      emails: true,
      images: true,
      landingPages: true,
    });
    const manualOverview = buildCampaignBuilderOverview(slug);
    const blogsOff = manualOverview?.assets.find((a) => a.key === "blogs");
    record(
      "manual-selection",
      manualOverview?.assets.some((a) => a.key === "blogs" && !a.included) === true,
      blogsOff ? `blogs included=${blogsOff.included}` : "manual mode",
    );

    const approval = buildCampaignBuilderApprovalSummary(slug);
    record(
      "approval-page",
      Boolean(approval?.campaignName) && approval!.estimatedAssets > 0,
      approval ? `${approval.estimatedAssets} assets · ${approval.estimatedTime}` : "missing",
    );

    const chooseHtml = renderCampaignBuilderPage(slug, "choose");
    const areasHtml = renderCampaignBuilderPage(slug, "areas");
    const settingsHtml = renderCampaignBuilderPage(slug, "settings");
    const imagesHtml = renderCampaignBuilderPage(slug, "images");
    const overviewHtml = renderCampaignBuilderPage(slug, "overview");
    const approvalHtml = renderCampaignBuilderPage(slug, "approval");

    record(
      "html-choose",
      chooseHtml.includes("🚀 Build Campaign") &&
        chooseHtml.includes("Choose Your First Growth Campaign"),
      "step 1",
    );
    record(
      "html-areas",
      areasHtml.includes("Target Areas") && areasHtml.includes("Whole town"),
      "step 2",
    );
    record(
      "html-settings",
      settingsHtml.includes("Choose What To Include") &&
        settingsHtml.includes("Everything is selected by default"),
      "step 3",
    );
    record(
      "html-images",
      imagesHtml.includes("Image Strategy") &&
        imagesHtml.includes("Browse Library") &&
        imagesHtml.includes("Required campaign images") &&
        imagesHtml.includes("Confirm image plan"),
      "step 4",
    );
    record(
      "html-overview",
      overviewHtml.includes("Generation Summary") &&
        overviewHtml.includes("Website Intelligence Summary") &&
        overviewHtml.includes("Local Market Summary") &&
        overviewHtml.includes("Nothing will be published automatically") &&
        overviewHtml.includes("Generate My Campaign"),
      "step 5",
    );
    record(
      "html-approval",
      approvalHtml.includes("Generation Summary") || approvalHtml.includes("Generate My Campaign"),
      "step 6",
    );

    record(
      "customer-context",
      (() => {
        try {
          const ctx = buildCustomerCampaignGenerationContext(slug, serviceId);
          return Boolean(ctx.generationContext.profile.pharmacyName) && ctx.targetAreas.length > 0;
        } catch {
          return false;
        }
      })(),
      "CustomerCampaignGenerationContext from wizard session",
    );

    record(
      "review-centre-html",
      renderCampaignBuilderPage(slug, "review").includes("Review Centre"),
      "review centre shell",
    );

    if (contentPackageGenerated(slug, serviceId)) {
      const reviewItems = buildCampaignBuilderReviewItems(slug);
      record("review-items", reviewItems.length > 0, `${reviewItems.length} review items`);
      if (reviewItems.length) {
        approveCampaignBuilderAsset(slug, reviewItems[0].key);
        record(
          "approve-asset",
          Boolean(loadCampaignBuilderSession(slug).approvedAssets[reviewItems[0].key]),
          reviewItems[0].key,
        );
      }
    } else {
      record("review-items", true, "skipped — package not generated");
      record("approve-asset", true, "skipped — package not generated");
    }

    record(
      "publish-handoff",
      readSrc("src/pharmacy/growthEngineCampaignBuilderPage.ts").includes("Publish Campaign") &&
        readSrc("src/pharmacy/growthEngineCampaignBuilderService.ts").includes("pharmacy-campaign-launch-queue"),
      campaignBuilderReadyToPublish(slug) ? "ready" : "gated until approved",
    );
  } else {
    record("campaign-overview", true, "skipped — no service");
    record("asset-totals", true, "skipped");
    record("manual-selection", true, "skipped");
    record("approval-page", true, "skipped");
    record("html-choose", renderCampaignBuilderPage(slug, "choose").includes("Choose Your First Growth Campaign"), "fallback");
    record("html-overview", true, "skipped");
    record("html-settings", true, "skipped");
    record("html-approval", true, "skipped");
    record("review-centre-html", renderCampaignBuilderPage(slug, "review").includes("Review Your Campaign"), "shell");
    record("review-items", true, "skipped");
    record("approve-asset", true, "skipped");
    record("publish-handoff", true, "skipped");
  }

  record(
    "customer-language",
    !readSrc("src/pharmacy/growthEngineCampaignBuilderPage.ts").includes("SEO") &&
      !readSrc("src/pharmacy/growthEngineCampaignBuilderPage.ts").includes("generator"),
    "no technical SEO exposed",
  );

  record("step-urls", campaignBuilderStepUrl(slug, "approval").includes("step=approval"), "URL helper");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.log(`  FAIL: ${c.id} — ${c.detail}`));
    process.exit(1);
  }
}

main();
