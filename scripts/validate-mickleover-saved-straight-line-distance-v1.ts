#!/usr/bin/env npx tsx
/**
 * Mickleover saved-evidence straight-line distance.
 * Fixture + read-only live inspection. No collection, generation, publication, or live apply-with-write.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { clauseStatesSuppliedApproximateStraightLineDistanceV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import { PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1, type BusinessLocalityCopyInputV1 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { planUkLocalPageStraightLineDistance } from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { preflightOneLocalPageCandidate } from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import {
  applySavedLocalPageStraightLineDistanceFromEvidence,
  inspectSavedLocalPageDistanceEndpoints,
  planSavedLocalPageStraightLineDistance,
  recordedAreaReferencePath,
  resetEvidenceCollectionTestHarness,
  setEvidenceCollectionTestHarness,
} from "../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";
import { haversineKm } from "../src/pharmacy/masterAdminLocalCoverageGeoService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const PHARMACY_NAME = "Brook Pharmacy Demo Derby";
const ALLESTREE_AREA = {
  latitude: 52.952948899999996,
  longitude: -1.4925673000000002,
};
const FIXTURE_MICKLEOVER_AREA = {
  latitude: 52.9015,
  longitude: -1.552,
  source: "fixture-mickleover-area-reference",
};

const PROTECTED = [
  "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
  "data/growth-engine/brook-pharmacy-demo-derby-campaign-builder.json",
  "data/pharmacy-ai-local-generation-budget/brook-pharmacy-demo-derby/pharmacy-first/v3/brook-pharmacy-demo-derby:pharmacy-first:v3:one-local-page:allestree.json",
  "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json",
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
  "data/pharmacy-local-page-evidence-budget/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
  "data/pharmacy-local-editorial-evidence-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
  "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/mickleover.json",
  "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/allestree.json",
  "data/pharmacy-local-editorial-evidence-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/allestree.json",
];

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

function sha256File(rel: string): string {
  const full = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  return createHash("sha256").update(fs.readFileSync(full)).digest("hex");
}

function samePoint(
  a: { latitude: number; longitude: number } | null | undefined,
  b: { latitude: number; longitude: number },
): boolean {
  if (!a) return false;
  return Math.abs(a.latitude - b.latitude) < 1e-8 && Math.abs(a.longitude - b.longitude) < 1e-8;
}

function groundingInput(km: number): BusinessLocalityCopyInputV1 {
  return {
    vertical: "pharmacy",
    business: {
      name: PHARMACY_NAME,
      telephone: "01332 000000",
      website: "https://example.invalid",
      address: "Demo premises",
      coordinates: { latitude: 52.91678930677714, longitude: -1.4825298233725033 },
      marketTown: "Derby",
    },
    offer: {
      serviceName: "Pharmacy First",
      serviceId: SERVICE,
      lockedClinicalFacts: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
      allowedCta: [...PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.allowedCta],
    },
    locality: {
      areaName: "Mickleover",
      areaSlug: "mickleover",
      distanceLabel: `approximately ${km.toFixed(1)} km straight-line`,
      distanceKm: km,
      cardinalDirection: "",
      pharmacyIsInArea: false,
      neighbouringSelectedAreas: [],
      evidenceLimitations: [],
      acceptedEntities: [],
    },
    style: { roles: ["location-and-access"], tone: "professional" },
  };
}

function main() {
  console.log("\n=== Mickleover saved straight-line distance (no collection, no generation) ===\n");
  const before = Object.fromEntries(PROTECTED.map((rel) => [rel, sha256File(rel)]));
  const liveMickleoverRef = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/mickleover.json",
  );
  record("live-mickleover-area-reference-absent", !fs.existsSync(liveMickleoverRef), liveMickleoverRef);

  const mickleover = inspectSavedLocalPageDistanceEndpoints(BROOK, SERVICE, "mickleover");
  record(
    "endpoints-from-saved-evidence-pharmacy",
    Boolean(mickleover.pharmacy) &&
      mickleover.pharmacySourceKind === "area-local-pack" &&
      Math.abs((mickleover.pharmacy?.latitude || 0) - 52.91678930677714) < 1e-8 &&
      Math.abs((mickleover.pharmacy?.longitude || 0) - -1.4825298233725033) < 1e-8,
    `kind=${mickleover.pharmacySourceKind} ${mickleover.pharmacy?.latitude},${mickleover.pharmacy?.longitude} source=${mickleover.pharmacy?.source || ""}`,
  );
  record(
    "endpoints-from-saved-evidence-area-missing",
    mickleover.area == null && mickleover.areaSourceKind === "missing",
    `kind=${mickleover.areaSourceKind}`,
  );

  const livePlan = planSavedLocalPageStraightLineDistance(BROOK, SERVICE, "Mickleover", "mickleover");
  record(
    "missing-endpoints-remain-blocked",
    livePlan.distanceKm == null &&
      livePlan.method === "haversine-straight-line" &&
      livePlan.areaReferenceStatus === "missing" &&
      /reference point/i.test(livePlan.detail),
    `km=${livePlan.distanceKm} status=${livePlan.areaReferenceStatus} ${livePlan.detail}`,
  );

  const liveApply = applySavedLocalPageStraightLineDistanceFromEvidence({
    slug: BROOK,
    serviceId: SERVICE,
    areaName: "Mickleover",
    areaSlug: "mickleover",
  });
  record(
    "live-apply-blocked-without-area-endpoint",
    liveApply.ok === false && liveApply.applied === false && liveApply.plan.distanceKm == null,
    liveApply.ok ? `km=${liveApply.distanceKm}` : liveApply.error,
  );
  record("live-apply-did-not-create-mickleover-reference", !fs.existsSync(liveMickleoverRef), "no live mickleover area-reference file");

  record(
    "no-allestree-coordinate-leak",
    !samePoint(mickleover.area, ALLESTREE_AREA) &&
      !samePoint(mickleover.pharmacy, ALLESTREE_AREA) &&
      livePlan.distanceKm !== 4.1,
    `area=${mickleover.area ? `${mickleover.area.latitude},${mickleover.area.longitude}` : "null"} km=${livePlan.distanceKm}`,
  );

  const allestree = inspectSavedLocalPageDistanceEndpoints(BROOK, SERVICE, "allestree");
  const allestreePlan = planSavedLocalPageStraightLineDistance(BROOK, SERVICE, "Allestree", "allestree");
  const allestreeExpected = allestree.pharmacy && allestree.area
    ? Number(haversineKm(allestree.area, allestree.pharmacy).toFixed(1))
    : null;
  record(
    "allestree-saved-endpoints-unchanged",
    Boolean(allestree.pharmacy) &&
      Boolean(allestree.area) &&
      samePoint(allestree.area, ALLESTREE_AREA) &&
      allestree.areaSourceKind !== "missing",
    `areaKind=${allestree.areaSourceKind} ${allestree.area?.latitude},${allestree.area?.longitude}`,
  );
  record(
    "allestree-distance-uses-straight-line-method",
    allestreePlan.method === "haversine-straight-line" &&
      allestreePlan.distanceKm === 4.1 &&
      allestreePlan.distanceKm === allestreeExpected,
    `method=${allestreePlan.method} km=${allestreePlan.distanceKm} expected=${allestreeExpected}`,
  );

  const fixtureExpected = mickleover.pharmacy
    ? Number(haversineKm(FIXTURE_MICKLEOVER_AREA, mickleover.pharmacy).toFixed(1))
    : null;
  const reusablePlan = planUkLocalPageStraightLineDistance({
    slug: BROOK,
    areaName: "Mickleover",
    pharmacyCoordinates: mickleover.pharmacy,
    areaCentroid: FIXTURE_MICKLEOVER_AREA,
  });
  record(
    "distance-uses-existing-straight-line-method",
    reusablePlan.method === "haversine-straight-line" &&
      reusablePlan.distanceKm != null &&
      reusablePlan.distanceKm === fixtureExpected &&
      reusablePlan.distanceKm !== 4.1 &&
      /straight-line/i.test(reusablePlan.detail) &&
      /Not travel distance/i.test(reusablePlan.detail),
    `method=${reusablePlan.method} km=${reusablePlan.distanceKm} expected=${fixtureExpected} ${reusablePlan.detail}`,
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mickleover-saved-distance-"));
  setEvidenceCollectionTestHarness({ storageRoot: tmp, persistPacks: false, liveProvidersForbidden: true });
  try {
    const harnessRef = recordedAreaReferencePath(BROOK, "mickleover");
    fs.mkdirSync(path.dirname(harnessRef), { recursive: true });
    fs.writeFileSync(
      harnessRef,
      `${JSON.stringify(
        {
          slug: BROOK,
          areaSlug: "mickleover",
          latitude: FIXTURE_MICKLEOVER_AREA.latitude,
          longitude: FIXTURE_MICKLEOVER_AREA.longitude,
          source: FIXTURE_MICKLEOVER_AREA.source,
        },
        null,
        2,
      )}\n`,
    );
    const fixtureInspect = inspectSavedLocalPageDistanceEndpoints(BROOK, SERVICE, "mickleover");
    const fixturePlan = planSavedLocalPageStraightLineDistance(BROOK, SERVICE, "Mickleover", "mickleover");
    record(
      "fixture-endpoints-stay-on-saved-path",
      fixtureInspect.pharmacySourceKind === "area-local-pack" &&
        fixtureInspect.areaSourceKind === "recorded-area-reference" &&
        samePoint(fixtureInspect.area, FIXTURE_MICKLEOVER_AREA) &&
        !samePoint(fixtureInspect.area, ALLESTREE_AREA),
      `pharmacy=${fixtureInspect.pharmacySourceKind} area=${fixtureInspect.areaSourceKind}`,
    );
    record(
      "fixture-distance-matches-haversine",
      fixturePlan.method === "haversine-straight-line" && fixturePlan.distanceKm === fixtureExpected,
      `km=${fixturePlan.distanceKm} expected=${fixtureExpected}`,
    );
    const fixtureApply = applySavedLocalPageStraightLineDistanceFromEvidence({
      slug: BROOK,
      serviceId: SERVICE,
      areaName: "Mickleover",
      areaSlug: "mickleover",
    });
    record(
      "fixture-apply-does-not-write-live-mickleover",
      fixtureApply.ok === true && fixtureApply.applied === true && !fs.existsSync(liveMickleoverRef),
      fixtureApply.ok ? `km=${fixtureApply.distanceKm} liveRef=${fs.existsSync(liveMickleoverRef)}` : fixtureApply.error,
    );

    const mismatched = recordedAreaReferencePath(BROOK, "mickleover");
    fs.writeFileSync(
      mismatched,
      `${JSON.stringify(
        {
          slug: BROOK,
          areaSlug: "allestree",
          latitude: ALLESTREE_AREA.latitude,
          longitude: ALLESTREE_AREA.longitude,
          source: "places-area-reference",
        },
        null,
        2,
      )}\n`,
    );
    const rejected = inspectSavedLocalPageDistanceEndpoints(BROOK, SERVICE, "mickleover");
    record(
      "mismatched-allestree-file-rejected-for-mickleover",
      rejected.area == null && rejected.areaSourceKind === "missing",
      `kind=${rejected.areaSourceKind} area=${rejected.area ? `${rejected.area.latitude},${rejected.area.longitude}` : "null"}`,
    );
  } finally {
    resetEvidenceCollectionTestHarness();
  }

  record(
    "harness-reset-restores-live-mickleover-block",
    inspectSavedLocalPageDistanceEndpoints(BROOK, SERVICE, "mickleover").area == null &&
      planSavedLocalPageStraightLineDistance(BROOK, SERVICE, "Mickleover", "mickleover").distanceKm == null,
    "live Mickleover area endpoint still missing after fixture harness reset",
  );

  const km = fixtureExpected || 5.2;
  const about = `${PHARMACY_NAME} is about ${km.toFixed(1)} km in a straight line from Mickleover.`;
  const approx = `${PHARMACY_NAME} is approximately ${km.toFixed(1)} km straight-line from Mickleover.`;
  const travel = `${PHARMACY_NAME} is about ${km.toFixed(1)} km travel distance from Mickleover.`;
  const input = groundingInput(km);
  record(
    "approximate-equivalent-wording-accepted",
    clauseStatesSuppliedApproximateStraightLineDistanceV3(about, input) &&
      clauseStatesSuppliedApproximateStraightLineDistanceV3(approx, input) &&
      !clauseStatesSuppliedApproximateStraightLineDistanceV3(travel, input),
    `about=${clauseStatesSuppliedApproximateStraightLineDistanceV3(about, input)} approx=${clauseStatesSuppliedApproximateStraightLineDistanceV3(approx, input)} travel=${clauseStatesSuppliedApproximateStraightLineDistanceV3(travel, input)}`,
  );

  const mickleoverPreflight = preflightOneLocalPageCandidate(BROOK, SERVICE, "mickleover");
  record(
    "mickleover-panel-distance-unavailable",
    mickleoverPreflight.distanceKm == null &&
      mickleoverPreflight.distanceStatus === "missing" &&
      mickleoverPreflight.distanceLabel === "Distance unavailable" &&
      /no verified pharmacy relationship or access fact/i.test(mickleoverPreflight.editorialEvidence.detail) &&
      mickleoverPreflight.canGenerate === false,
    `status=${mickleoverPreflight.editorialEvidence.status} ${mickleoverPreflight.distanceLabel} generate=${mickleoverPreflight.canGenerate}`,
  );
  const allestreePreflight = preflightOneLocalPageCandidate(BROOK, SERVICE, "allestree");
  record(
    "allestree-panel-distance-unchanged",
    allestreePreflight.distanceKm === 4.1 && /approximately 4\.1 km straight-line/.test(allestreePreflight.distanceLabel),
    allestreePreflight.distanceLabel,
  );
  const littleover = preflightOneLocalPageCandidate(BROOK, SERVICE, "littleover");
  record(
    "other-selected-area-still-isolated",
    littleover.areaSlug === "littleover" && littleover.distanceKm == null && littleover.distanceLabel === "Distance unavailable",
    `${littleover.areaSlug} ${littleover.distanceLabel}`,
  );
  const yorkshire = inspectSavedLocalPageDistanceEndpoints(YORKSHIRE, "pharmacy-first", "barnsley");
  record("other-pharmacy-not-rewritten", yorkshire.slug === YORKSHIRE, `slug=${yorkshire.slug} areaKind=${yorkshire.areaSourceKind}`);

  const html = renderCampaignBuilderPage(BROOK, "areas", { area: "mickleover" });
  const panelStart = html.indexOf('data-one-local-page="mickleover"');
  const panelFrom = panelStart >= 0 ? html.lastIndexOf("<div", panelStart) : -1;
  const generateAt = panelFrom >= 0 ? html.indexOf('id="btnGenerateOneLocalPage"', panelFrom) : -1;
  const mickleoverPanel =
    panelFrom >= 0 && generateAt >= panelFrom
      ? html.slice(panelFrom, generateAt + 220)
      : panelFrom >= 0
        ? html.slice(panelFrom, panelFrom + 16000)
        : "";
  record(
    "ui-resume-present-but-create-remaining-stays-disabled",
    /data-run-status="stopped"/.test(html) &&
      /id="confirmCreateRemainingLocalPages" disabled/.test(html) &&
      /id="btnCreateRemainingLocalPages" disabled/.test(html) &&
      /id="btnResumeRemainingLocalPages" disabled/.test(html) &&
      /id="confirmResumeRemainingLocalPages"/.test(html),
    "stopped campaign run keeps Create remaining disabled; Resume stays disabled until confirmation",
  );
  record(
    "ui-mickleover-limited-and-distance-unavailable",
    /EVIDENCE LIMITED/i.test(mickleoverPanel) &&
      /Distance unavailable/.test(mickleoverPanel) &&
      /no verified pharmacy relationship or access fact/i.test(html) &&
      /id="btnGenerateOneLocalPage" disabled/.test(mickleoverPanel),
    "Mickleover panel stays LIMITED with Generate disabled",
  );

  const campaignRun = JSON.parse(
    fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, PROTECTED[4]), "utf8"),
  ) as { runId?: string; status?: string };
  record(
    "campaign-run-preserved",
    campaignRun.runId === "e23b2020-b520-453c-a7a5-45d301316229" && campaignRun.status === "stopped",
    `runId=${campaignRun.runId} status=${campaignRun.status}`,
  );

  for (const rel of PROTECTED) {
    record(`unchanged:${path.basename(rel)}`, sha256File(rel) === before[rel], rel);
  }
  record("live-mickleover-area-reference-still-absent", !fs.existsSync(liveMickleoverRef), "no live Mickleover area-reference after tests");

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
    for (const row of failed) console.error(`FAIL  ${row.id} — ${row.detail}`);
  }
}

main();
