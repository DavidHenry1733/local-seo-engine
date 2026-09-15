#!/usr/bin/env npx tsx
/**
 * Campaign Improvements — tenant current-campaign service authority.
 * Fixtures plus read-only Vision analysis from existing generated data.
 * Does not generate, change services/profile/approvals, mark complete, defer, publish, or index.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  campaignImprovementsNeedsCanonicalRedirect,
  resolveCampaignImprovementsService,
  resolveCampaignImprovementsServiceForTenant,
} from "../src/pharmacy/pharmacyCampaignImprovementsServiceAuthority.ts";
import { buildEnhancementWorkspaceView } from "../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { renderEnhancementWorkspaceHtml } from "../artifacts/api-server/src/routes/pharmacyEnhancementWorkspacePage.ts";
import { buildPlatformNavItems, renderPharmacyPlatformNavBar } from "../src/pharmacy/pharmacyPlatformNav.ts";
import { analyseServiceAuthorityEnhancement } from "../src/pharmacy/pharmacyAuthorityEnhancementService.ts";
import { explicitConfirmedLocalityNames } from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha(rel: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function main() {
  console.log("\n=== Campaign Improvements service authority ===\n");

  const oneCurrent = resolveCampaignImprovementsService({
    enabledServiceIds: ["service-a"],
    existingCampaignServiceIds: ["service-a"],
    currentCampaignServiceId: "service-a",
    requestedServiceId: null,
  });
  record(
    "one-current-campaign-resolves-that-service",
    oneCurrent.resolvedServiceId === "service-a" && oneCurrent.source === "current-campaign",
    `resolved=${oneCurrent.resolvedServiceId} source=${oneCurrent.source}`,
  );

  const staleOutside = resolveCampaignImprovementsService({
    enabledServiceIds: ["service-a"],
    existingCampaignServiceIds: ["service-a"],
    currentCampaignServiceId: "service-a",
    requestedServiceId: "blood-pressure-checks",
  });
  record(
    "stale-url-cannot-override",
    staleOutside.resolvedServiceId === "service-a" &&
      staleOutside.rejectedRequested === true &&
      staleOutside.resolvedServiceId !== "blood-pressure-checks",
    `requested=${staleOutside.requestedServiceId} resolved=${staleOutside.resolvedServiceId}`,
  );

  const multiValid = resolveCampaignImprovementsService({
    enabledServiceIds: ["service-a", "service-b"],
    existingCampaignServiceIds: ["service-a", "service-b"],
    currentCampaignServiceId: "service-a",
    requestedServiceId: "service-b",
  });
  record(
    "multiple-campaigns-explicit-valid-selected",
    multiValid.resolvedServiceId === "service-b" && multiValid.source === "requested-valid-campaign",
    `resolved=${multiValid.resolvedServiceId} source=${multiValid.source}`,
  );

  const missingParam = resolveCampaignImprovementsService({
    enabledServiceIds: ["service-a", "service-b"],
    existingCampaignServiceIds: ["service-a", "service-b"],
    currentCampaignServiceId: "service-a",
    requestedServiceId: null,
  });
  record(
    "missing-service-param-uses-current",
    missingParam.resolvedServiceId === "service-a" && missingParam.source === "current-campaign",
    `resolved=${missingParam.resolvedServiceId} source=${missingParam.source}`,
  );

  const catalogueOnly = resolveCampaignImprovementsService({
    enabledServiceIds: [],
    existingCampaignServiceIds: [],
    currentCampaignServiceId: null,
    requestedServiceId: "blood-pressure-checks",
  });
  record(
    "catalogue-membership-is-not-authority",
    catalogueOnly.resolvedServiceId !== "blood-pressure-checks" &&
      catalogueOnly.resolvedServiceId === null &&
      catalogueOnly.source === "none" &&
      !catalogueOnly.authoritativeServiceIds.includes("blood-pressure-checks"),
    `resolved=${catalogueOnly.resolvedServiceId || "NONE"} source=${catalogueOnly.source}`,
  );

  record(
    "stale-needs-canonical-redirect",
    campaignImprovementsNeedsCanonicalRedirect("blood-pressure-checks", "pharmacy-first") === true &&
      campaignImprovementsNeedsCanonicalRedirect("pharmacy-first", "pharmacy-first") === false &&
      campaignImprovementsNeedsCanonicalRedirect(null, "pharmacy-first") === true,
    "stale/missing redirect; matching service stays",
  );

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/growth-engine/vision-pharmacy-campaign-generation-context-pharmacy-first.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
    "data/growth-engine/vision-pharmacy-review-centre.json",
    "data/pharmacy-enhancement-workspace/vision-pharmacy.json",
    "data/pharmacy-authority-enhancements/vision-pharmacy.json",
    "data/pharmacy-master-admin/active-service-campaign/vision-pharmacy.json",
    "output/pharmacy-visual-experience/vision-pharmacy/pharmacy-first/index.html",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));

  const visionMissing = resolveCampaignImprovementsServiceForTenant("vision-pharmacy", null);
  const visionStale = resolveCampaignImprovementsServiceForTenant("vision-pharmacy", "blood-pressure-checks");
  const visionExplicit = resolveCampaignImprovementsServiceForTenant("vision-pharmacy", "pharmacy-first");
  const viewFromStale = buildEnhancementWorkspaceView("vision-pharmacy", { serviceId: "blood-pressure-checks" });
  const html = renderEnhancementWorkspaceHtml(viewFromStale);
  const analysis = analyseServiceAuthorityEnhancement("vision-pharmacy", "pharmacy-first");
  const nav = buildPlatformNavItems("vision-pharmacy");
  const geNav = renderPharmacyPlatformNavBar({ slug: "vision-pharmacy", activeId: "growth-engine" });
  const improvementsNav = nav.find((item) => item.id === "enhancement");
  const areas = explicitConfirmedLocalityNames(readSetupProfile("vision-pharmacy").selectedAreas);
  const campaigns = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-campaigns/vision-pharmacy.json"), "utf8"),
  ) as { campaigns?: Array<{ serviceId?: string }> };
  const campaignServices = (campaigns.campaigns || []).map((c) => c.serviceId);
  const titles = analysis.recommendations.map((r) => r.title);

  record(
    "vision-resolves-pharmacy-first",
    visionMissing.resolvedServiceId === "pharmacy-first" &&
      visionStale.resolvedServiceId === "pharmacy-first" &&
      visionExplicit.resolvedServiceId === "pharmacy-first" &&
      visionStale.rejectedRequested === true,
    `missing=${visionMissing.resolvedServiceId} stale=${visionStale.resolvedServiceId} explicit=${visionExplicit.resolvedServiceId}`,
  );
  record(
    "vision-view-not-blood-pressure",
    viewFromStale.selectedServiceId === "pharmacy-first" &&
      viewFromStale.selectedServiceName === "Pharmacy First" &&
      !viewFromStale.authoritativeServiceIds.includes("blood-pressure-checks"),
    `service=${viewFromStale.selectedServiceId} name=${viewFromStale.selectedServiceName} source=${viewFromStale.serviceSource}`,
  );
  record(
    "vision-visual-page-recognised",
    viewFromStale.visualPageRecognised === true &&
      !html.includes("Build visual service page first") &&
      !html.includes("Enhancement analysis requires a built visual page."),
    viewFromStale.visualPageRecognised ? "existing Pharmacy First visual page recognised" : "visual page missing",
  );
  record(
    "vision-html-pharmacy-first-not-bp",
    html.includes("Pharmacy First") &&
      html.includes('data-campaign-service="pharmacy-first"') &&
      !/blood-pressure-checks/i.test(html) &&
      !/Blood Pressure Checks/i.test(html),
    /blood-pressure-checks/i.test(html) ? "Blood Pressure still in HTML" : "Pharmacy First only",
  );
  record(
    "vision-nav-carries-pharmacy-first",
    Boolean(improvementsNav?.url.includes("service=pharmacy-first")) &&
      !Boolean(improvementsNav?.url.includes("blood-pressure-checks")) &&
      geNav.includes("service=pharmacy-first") &&
      !geNav.includes("pharmacy-enhancement-workspace?slug=vision-pharmacy&service=blood-pressure-checks"),
    improvementsNav?.url || "missing nav",
  );
  record(
    "vision-areas-unchanged",
    areas.length === 8,
    `areas=${areas.length}`,
  );
  record(
    "vision-no-bp-campaign-created",
    !campaignServices.includes("blood-pressure-checks") && campaignServices.join() === "pharmacy-first",
    `campaigns=${campaignServices.join(",") || "none"}`,
  );

  console.log("\nPharmacy First Campaign Improvements analysis (existing generated data)");
  console.log(`  service=${analysis.serviceId} name=${analysis.serviceName}`);
  console.log(`  currentScore=${analysis.currentAuthorityScore} potential=${analysis.potentialAuthorityScore}`);
  console.log(`  total=${analysis.totalRecommendations} easyWins=${analysis.easyWins} highImpact=${analysis.highImpactImprovements}`);
  console.log(`  remaining=${viewFromStale.summary.recommendationsRemaining} requiredCards=${html.match(/is-required/g)?.length || 0}`);
  console.log("  recommendations:");
  for (const title of titles.slice(0, 12)) console.log(`    - ${title}`);
  if (titles.length > 12) console.log(`    … ${titles.length - 12} more`);

  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  record(
    "vision-hashes-unchanged",
    hashed.every((rel) => before[rel] === after[rel]),
    hashed.every((rel) => before[rel] === after[rel]) ? "no Vision writes" : "HASH CHANGED",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length} checks\n`);
  if (failed.length) process.exit(1);
}

main();
