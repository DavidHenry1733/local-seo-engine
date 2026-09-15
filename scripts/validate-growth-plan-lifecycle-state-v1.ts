#!/usr/bin/env npx tsx
/**
 * Growth Plan lifecycle presentation — ungenerated vs existing vs exhausted queue.
 * Fixtures plus read-only Vision HTML. Does not generate, publish, or write tenant data.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE } from "../src/pharmacy/pharmacyGenerateNextCampaignAuthority.ts";
import { resolveGrowthPlanLifecyclePresentation } from "../src/pharmacy/growthEngineGrowthPlanLifecycle.ts";
import { renderGrowthPlanV1Page } from "../src/pharmacy/growthEngineGrowthPlanPage.ts";
import { explicitConfirmedLocalityNames } from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildGrowthPlanCommercialView } from "../src/pharmacy/growthEngineGrowthPlanPresentationView.ts";
import { buildGrowthPlanForSelectedService } from "../src/pharmacy/growthEngineCampaignRecommendationEngine.ts";
import { resolveAuthoritativeCampaignPriority } from "../src/pharmacy/growthEngineGrowthPlanResolver.ts";

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
  console.log("\n=== Growth Plan lifecycle presentation ===\n");

  const ungenerated = resolveGrowthPlanLifecyclePresentation({
    prerequisitesReady: true,
    selectedServiceId: "service-a",
    selectedServiceName: "Service A",
    selectedServiceHasExistingCampaign: false,
    nextServiceId: "service-a",
    nextServiceName: "Service A",
  });
  record(
    "ungenerated-ready-to-generate",
    ungenerated.kind === "ready-to-generate" &&
      ungenerated.showReadyToGenerate &&
      ungenerated.showInitialPlanApproval &&
      ungenerated.readinessStatus === "Ready to Generate",
    `${ungenerated.kind} status=${ungenerated.readinessStatus}`,
  );

  const exhausted = resolveGrowthPlanLifecyclePresentation({
    prerequisitesReady: true,
    selectedServiceId: "service-a",
    selectedServiceName: "Service A",
    selectedServiceHasExistingCampaign: true,
    nextServiceId: null,
    exhausted: true,
    exhaustedMessage: GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE,
  });
  record(
    "existing-exhausted-no-generate",
    exhausted.kind === "existing-exhausted" &&
      !exhausted.showReadyToGenerate &&
      !exhausted.showInitialPlanApproval &&
      !exhausted.showGenerateNext &&
      exhausted.readinessStatus === "Campaign generated" &&
      exhausted.exhaustedMessage === GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE,
    `${exhausted.kind} status=${exhausted.readinessStatus}`,
  );

  const nextEligible = resolveGrowthPlanLifecyclePresentation({
    prerequisitesReady: true,
    selectedServiceId: "service-a",
    selectedServiceName: "Service A",
    selectedServiceHasExistingCampaign: true,
    nextServiceId: "service-b",
    nextServiceName: "Service B",
  });
  record(
    "existing-plus-next-relates-to-next-service",
    nextEligible.kind === "ready-to-generate-next" &&
      !nextEligible.showReadyToGenerate &&
      !nextEligible.showInitialPlanApproval &&
      nextEligible.showGenerateNext &&
      nextEligible.generateNextServiceName === "Service B" &&
      nextEligible.readinessStatus.includes("Service B") &&
      /not regenerate/i.test(nextEligible.readinessNote) &&
      nextEligible.readinessStatus !== "Ready to Generate",
    `${nextEligible.kind} status=${nextEligible.readinessStatus}`,
  );

  const engine = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineGrowthPlanLifecycle.ts"), "utf8");
  record("generic-no-vision-hardcode", !/vision-pharmacy|Pharmacy First/.test(engine), "no Vision hardcoding");

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));

  const html = renderGrowthPlanV1Page("vision-pharmacy");
  const serviceId = resolveAuthoritativeCampaignPriority("vision-pharmacy");
  const selectedPlan = serviceId ? buildGrowthPlanForSelectedService("vision-pharmacy", serviceId) : null;
  const packageItems = selectedPlan
    ? buildGrowthPlanCommercialView("vision-pharmacy", selectedPlan.campaign).packageItems
    : [];
  const localPages = packageItems.find((item) => /Local area/i.test(item.label));
  const packageTotal = packageItems.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const areas = explicitConfirmedLocalityNames(readSetupProfile("vision-pharmacy").selectedAreas);

  record(
    "vision-no-ready-to-generate",
    !html.includes("Ready to Generate") && html.includes("Campaign generated"),
    html.includes("Ready to Generate") ? "Ready to Generate still present" : "Campaign generated",
  );
  record(
    "vision-no-initial-approve-plan",
    !html.includes("Approve plan &amp; continue") && !html.includes("Approve plan & continue"),
    html.includes("Approve plan") ? "Approve plan still present" : "initial approval action absent",
  );
  record(
    "vision-exhausted-copy-preserved",
    html.includes(GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE) && !html.includes('id="gpGenerateNext"'),
    "exhausted copy, no Generate Next button",
  );
  record(
    "vision-existing-management-nav",
    html.includes("Open Dashboard") && html.includes("Content Review") && html.includes("Ready To Publish"),
    "Dashboard / Content Review / Ready To Publish",
  );
  record(
    "vision-package-and-areas-unchanged",
    localPages?.count === 8 && packageTotal === 51 && areas.length === 8,
    `local=${localPages?.count} total=${packageTotal} areas=${areas.length}`,
  );

  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  record(
    "vision-hashes-unchanged",
    hashed.every((rel) => before[rel] === after[rel]),
    hashed.every((rel) => before[rel] === after[rel]) ? "no Vision data writes" : "HASH CHANGED",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length} checks\n`);
  if (failed.length) process.exit(1);
}

main();
