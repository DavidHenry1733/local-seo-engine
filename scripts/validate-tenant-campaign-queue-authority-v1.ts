#!/usr/bin/env npx tsx
/**
 * Generate Next — tenant-enabled registered-service queue authority.
 * Fixtures for A–D. Vision checks are read-only and do not generate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE,
  GENERATE_NEXT_OVERWRITE_REFUSED,
  refuseGenerateNextOverwriteIfCampaignExists,
  resolveTenantGenerateNextQueue,
  tenantHasExistingCampaign,
} from "../src/pharmacy/pharmacyGenerateNextCampaignAuthority.ts";
import {
  buildAuthoritativeCampaignProgramme,
  listApprovedRegisteredCampaignQueue,
  listTenantEnabledRegisteredCampaignQueue,
  selectNextApprovedRegisteredCampaign,
} from "../src/pharmacy/pharmacyAuthoritativeCampaignProgrammeService.ts";
import { runProductOwnerNextCampaignWorkflow, PRODUCT_OWNER_NEXT_CAMPAIGN_DEFAULT_INTENT } from "../src/pharmacy/pharmacyProductOwnerNextCampaignWorkflow.ts";
import { generateContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { explicitConfirmedLocalityNames } from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { renderGrowthPlanV1Page } from "../src/pharmacy/growthEngineGrowthPlanPage.ts";

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

async function main() {
  console.log("\n=== Tenant Generate Next campaign queue authority ===\n");

  const registered = ["service-a", "service-b", "service-c", "service-d"];

  const caseA = resolveTenantGenerateNextQueue({
    enabledServiceIds: ["service-a"],
    registeredQueue: registered,
    existingCampaignServiceIds: ["service-a"],
  });
  record("case-a-one-enabled-already-generated", caseA.nextServiceId === null && caseA.exhausted && caseA.enabledQueue.join() === "service-a", `next=${caseA.nextServiceId || "NONE"} queue=${caseA.enabledQueue.join(",")}`);

  const caseB = resolveTenantGenerateNextQueue({
    enabledServiceIds: ["service-a", "service-b", "service-c"],
    registeredQueue: registered,
    existingCampaignServiceIds: ["service-a"],
  });
  record(
    "case-b-next-enabled-without-campaign",
    caseB.nextServiceId === "service-b" && caseB.enabledQueue.join() === "service-a,service-b,service-c",
    `next=${caseB.nextServiceId} queue=${caseB.enabledQueue.join(",")}`,
  );

  const caseC = resolveTenantGenerateNextQueue({
    enabledServiceIds: ["service-a"],
    registeredQueue: registered,
    existingCampaignServiceIds: ["service-a"],
  });
  record(
    "case-c-global-not-tenant-enabled",
    caseC.nextServiceId === null && !caseC.enabledQueue.includes("service-d") && caseC.enabledQueue.join() === "service-a",
    `next=${caseC.nextServiceId || "NONE"} enabled=${caseC.enabledQueue.join(",")}`,
  );

  const caseD = resolveTenantGenerateNextQueue({
    enabledServiceIds: ["service-a", "service-b"],
    registeredQueue: registered,
    existingCampaignServiceIds: ["service-a"],
  });
  record(
    "case-d-generated-not-approved-locked-still-excluded",
    caseD.nextServiceId === "service-b" && !caseD.enabledQueue.filter((id) => id === "service-a").every(() => caseD.nextServiceId === "service-a"),
    `existing generated A excluded; next=${caseD.nextServiceId}`,
  );

  const engineFiles = [
    "src/pharmacy/pharmacyGenerateNextCampaignAuthority.ts",
    "src/pharmacy/pharmacyAuthoritativeCampaignProgrammeService.ts",
    "src/pharmacy/pharmacyProductOwnerNextCampaignWorkflow.ts",
  ];
  record(
    "generic-no-vision-hardcode",
    !engineFiles.some((rel) => /vision-pharmacy/.test(fs.readFileSync(path.join(ROOT, rel), "utf8"))),
    "no Vision hardcoding in queue authority",
  );

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/growth-engine/vision-pharmacy-campaign-generation-context-pharmacy-first.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
    "data/growth-engine/vision-pharmacy-review-centre.json",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));

  const visionEnabled = listTenantEnabledRegisteredCampaignQueue("vision-pharmacy");
  const visionNext = selectNextApprovedRegisteredCampaign("vision-pharmacy");
  const visionProgramme = buildAuthoritativeCampaignProgramme("vision-pharmacy");
  const visionExisting = tenantHasExistingCampaign("vision-pharmacy", "pharmacy-first");
  const profile = readSetupProfile("vision-pharmacy");
  const confirmed = explicitConfirmedLocalityNames(profile.selectedAreas);
  const session = loadCampaignBuilderSession("vision-pharmacy");
  const html = renderGrowthPlanV1Page("vision-pharmacy");
  const overwrite = refuseGenerateNextOverwriteIfCampaignExists("vision-pharmacy", "pharmacy-first");
  const packageGuard = await generateContentPackage("vision-pharmacy", "pharmacy-first", {
    scope: "mvp-core-pages",
    protectExistingCampaign: true,
  });
  const workflow = await runProductOwnerNextCampaignWorkflow({
    tenantSlug: "vision-pharmacy",
    intent: PRODUCT_OWNER_NEXT_CAMPAIGN_DEFAULT_INTENT,
  });

  record("vision-enabled-queue", visionEnabled.join() === "pharmacy-first", `enabled=${visionEnabled.join(",") || "none"}`);
  record("vision-existing-pharmacy-first", visionExisting === true, `existing=${visionExisting}`);
  record("vision-next-none", visionNext === null && visionProgramme.nextCampaign === null, `next=${visionNext?.serviceId || "NONE"}`);
  record(
    "vision-exhausted-message",
    visionProgramme.exhausted === true && visionProgramme.exhaustedMessage === GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE,
    visionProgramme.exhaustedMessage || "missing exhausted message",
  );
  record(
    "vision-ui-exhausted-no-generate-button",
    html.includes(GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE) && !html.includes('id="gpGenerateNext"'),
    html.includes('id="gpGenerateNext"') ? "Generate Next button still rendered" : "exhausted copy, no generate button",
  );
  record(
    "vision-overwrite-guard",
    overwrite.ok === false && overwrite.error === GENERATE_NEXT_OVERWRITE_REFUSED,
    overwrite.ok ? "guard allowed overwrite" : overwrite.error,
  );
  record(
    "vision-package-guard-no-write",
    packageGuard.ok === false && packageGuard.error === GENERATE_NEXT_OVERWRITE_REFUSED,
    packageGuard.ok ? "package generation started" : packageGuard.error,
  );
  record(
    "vision-workflow-exhausted",
    workflow.ok === false && workflow.error === GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE && !workflow.serviceId,
    workflow.error || "unexpected success",
  );
  record(
    "vision-areas-still-eight",
    confirmed.length === 8 && JSON.stringify(session.targetAreaNames) === JSON.stringify(confirmed),
    `areas=${confirmed.join(", ")}`,
  );
  record(
    "vision-global-bank-not-selected",
    !listApprovedRegisteredCampaignQueue().filter((id) => id !== "pharmacy-first").some((id) => visionEnabled.includes(id)),
    "Blood Pressure / Flu / Travel not in Vision enabled queue",
  );

  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  record(
    "vision-hashes-unchanged",
    hashed.every((rel) => before[rel] === after[rel]),
    hashed.every((rel) => before[rel] === after[rel]) ? "content/approval hashes preserved" : "HASH CHANGED",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length} checks\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
