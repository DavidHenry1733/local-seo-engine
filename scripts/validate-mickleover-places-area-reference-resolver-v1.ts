#!/usr/bin/env npx tsx
/**
 * Mickleover Places area-reference resolver.
 * Uses the saved collection response and fixtures only. No live Places, generation, or campaign resume.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveGeographicEvidenceContext } from "../src/pharmacy/contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import {
  buildUkLocalPageAreaReferenceQuery,
  parsePlacesProviderCoordinates,
  planUkLocalPageStraightLineDistance,
  resolveUkLocalPagePlacesAreaReference,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import { planPharmacyLocalEvidenceRequest } from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { preflightOneLocalPageCandidate } from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import { planOneLocalPageEvidencePreparation } from "../src/pharmacy/growthEngineLocalPageEvidencePreparationService.ts";
import { haversineKm } from "../src/pharmacy/masterAdminLocalCoverageGeoService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const ALLESTREE_POINT = { latitude: 52.952948899999996, longitude: -1.4925673000000002 };
const MICKLEOVER_FIXTURE_POINT = { latitude: 52.903412, longitude: -1.552198 };

const PROTECTED = [
  "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json",
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
  "data/pharmacy-local-page-evidence-budget/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
  "data/pharmacy-local-editorial-evidence-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
  "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/mickleover.json",
  "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/allestree.json",
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/allestree.json",
  "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
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

function brookGeo(areaName: string) {
  const request = planPharmacyLocalEvidenceRequest(BROOK, SERVICE);
  return resolveGeographicEvidenceContext({
    slug: BROOK,
    areaName,
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: request.pharmacyCoordinates,
  });
}

function main() {
  console.log("\n=== Mickleover Places area-reference resolver (saved response + fixtures) ===\n");
  const before = Object.fromEntries(PROTECTED.map((rel) => [rel, sha256File(rel)]));
  const liveMickleoverRef = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/mickleover.json",
  );
  const liveMickleoverRefBefore = fs.existsSync(liveMickleoverRef)
    ? createHash("sha256").update(fs.readFileSync(liveMickleoverRef)).digest("hex")
    : "absent";

  const run = JSON.parse(
    fs.readFileSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json"),
      "utf8",
    ),
  ) as {
    runId: string;
    calls: Array<{ id: string; query?: string; detail?: string; capturedAt?: string | null }>;
    placesHitsByCall: Record<string, unknown[]>;
    areaReferencePoint: unknown;
    distanceKm: number | null;
  };
  const areaCall = run.calls.find((row) => row.id === "places-area-reference");
  const savedHits = run.placesHitsByCall["places-area-reference"] || [];
  record(
    "saved-places-area-reference-hits",
    run.runId === "cf8b4949-1aa6-4d71-a883-bacf410f6603" && Array.isArray(savedHits),
    `hits=${savedHits.length} query=${areaCall?.query || ""} detail=${areaCall?.detail || ""}`,
  );

  const savedResolved = resolveUkLocalPagePlacesAreaReference({
    areaName: "Mickleover",
    county: "Derbyshire",
    countryCode: "GB",
    siblingAreaNames: ["Allestree", "Mickleover", "Littleover"],
    pharmacyCityHint: "Derby",
    hits: savedHits,
  });
  record(
    "saved-response-resolved-without-asserting-pharmacy-city",
    savedHits.length === 0
      ? savedResolved.ok === false && savedResolved.reason === "zero-results"
      : savedResolved.ok === true && savedResolved.name === "Mickleover",
    savedResolved.ok ? `${savedResolved.latitude},${savedResolved.longitude}` : `${savedResolved.reason} ${savedResolved.detail}`,
  );

  const mickleoverGeo = brookGeo("Mickleover");
  const query = buildUkLocalPageAreaReferenceQuery(mickleoverGeo);
  record(
    "query-uses-focused-area-locality-uk-context",
    query === "Mickleover locality, Derbyshire, UK" &&
      !/\bDerby\b/i.test(query) &&
      !/Mickleover locality in Mickleover/i.test(query),
    query,
  );
  const planned = planOneLocalPageEvidencePreparation(BROOK, SERVICE, "mickleover");
  const plannedAreaQuery = planned.proposedCalls.find((row) => row.id === "places-area-reference")?.query || "";
  record(
    "preparation-plan-uses-area-reference-query",
    plannedAreaQuery === query || planned.proposedCalls.every((row) => row.id !== "places-area-reference"),
    plannedAreaQuery || "places-area-reference not proposed because a verified reference already exists",
  );

  const allestreeRun = JSON.parse(
    fs.readFileSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/allestree.json"),
      "utf8",
    ),
  ) as { placesHitsByCall: { "places-area-reference"?: Array<Record<string, unknown>> } };
  const allestreeHit = (allestreeRun.placesHitsByCall["places-area-reference"] || [])[0];
  record("allestree-saved-hit-present", Boolean(allestreeHit?.name), String(allestreeHit?.name || ""));

  const mickleoverHit = {
    name: "Mickleover",
    address: "Mickleover, Derby DE3 0XX",
    types: ["sublocality_level_1", "sublocality", "political"],
    location: MICKLEOVER_FIXTURE_POINT,
    placeId: "fixture-mickleover-locality",
    locality: "Mickleover, Derby DE3 0XX",
    addressComponents: [
      { longText: "Mickleover", shortText: "Mickleover", types: ["sublocality_level_1", "sublocality", "political"] },
      { longText: "Derby", shortText: "Derby", types: ["postal_town"] },
      { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
    ],
  };
  const accepted = resolveUkLocalPagePlacesAreaReference({
    areaName: "Mickleover",
    parentTown: "Derby",
    countryCode: "GB",
    siblingAreaNames: ["Allestree", "Mickleover"],
    hits: [mickleoverHit],
  });
  record(
    "correct-mickleover-acceptance",
    accepted.ok === true &&
      Math.abs(accepted.latitude - MICKLEOVER_FIXTURE_POINT.latitude) < 1e-8 &&
      accepted.source === "places-area-reference" &&
      accepted.name === "Mickleover",
    accepted.ok ? `${accepted.latitude},${accepted.longitude}` : accepted.detail,
  );

  const nested = parsePlacesProviderCoordinates({ latLng: MICKLEOVER_FIXTURE_POINT });
  record(
    "nested-provider-coordinates-parse",
    Boolean(nested) && Math.abs((nested?.latitude || 0) - MICKLEOVER_FIXTURE_POINT.latitude) < 1e-8,
    nested ? `${nested.latitude},${nested.longitude}` : "null",
  );

  const ambiguous = resolveUkLocalPagePlacesAreaReference({
    areaName: "Mickleover",
    parentTown: "Derby",
    countryCode: "GB",
    hits: [
      mickleoverHit,
      { ...mickleoverHit, placeId: "fixture-mickleover-b", location: { latitude: 52.91, longitude: -1.54 } },
    ],
  });
  record(
    "ambiguity-rejection",
    ambiguous.ok === false && ambiguous.reason === "ambiguous",
    ambiguous.ok ? "accepted" : `${ambiguous.reason} ${ambiguous.detail}`,
  );

  const gpHit = {
    name: "Mickleover Medical Centre",
    address: "Vicarage Road, Mickleover, Derby DE3 0HA",
    types: ["doctor", "health", "point_of_interest"],
    location: MICKLEOVER_FIXTURE_POINT,
  };
  const gpRejected = resolveUkLocalPagePlacesAreaReference({
    areaName: "Mickleover",
    parentTown: "Derby",
    countryCode: "GB",
    hits: [gpHit],
  });
  record(
    "organisation-unsupported",
    gpRejected.ok === false && gpRejected.reason === "unsupported",
    gpRejected.ok ? "accepted" : `${gpRejected.reason} ${gpRejected.detail}`,
  );

  const allestreeAsMickleover = resolveUkLocalPagePlacesAreaReference({
    areaName: "Mickleover",
    parentTown: "Derby",
    countryCode: "GB",
    siblingAreaNames: ["Allestree", "Mickleover"],
    hits: [allestreeHit],
  });
  record(
    "cross-area-allestree-rejected-for-mickleover",
    allestreeAsMickleover.ok === false &&
      (allestreeAsMickleover.reason === "wrong-area" || allestreeAsMickleover.reason === "unsupported"),
    allestreeAsMickleover.ok ? `${allestreeAsMickleover.latitude},${allestreeAsMickleover.longitude}` : allestreeAsMickleover.reason,
  );

  const mickleoverAsAllestree = resolveUkLocalPagePlacesAreaReference({
    areaName: "Allestree",
    parentTown: "Derby",
    countryCode: "GB",
    siblingAreaNames: ["Allestree", "Mickleover"],
    hits: [mickleoverHit],
  });
  record(
    "cross-area-mickleover-rejected-for-allestree",
    mickleoverAsAllestree.ok === false,
    mickleoverAsAllestree.ok ? "leaked" : mickleoverAsAllestree.reason,
  );

  const allestreeAccepted = resolveUkLocalPagePlacesAreaReference({
    areaName: "Allestree",
    parentTown: "Derby",
    countryCode: "GB",
    siblingAreaNames: ["Allestree", "Mickleover"],
    hits: [allestreeHit],
  });
  record(
    "allestree-saved-hit-still-accepted-for-allestree",
    allestreeAccepted.ok === true &&
      Math.abs(allestreeAccepted.latitude - ALLESTREE_POINT.latitude) < 1e-8,
    allestreeAccepted.ok ? `${allestreeAccepted.latitude},${allestreeAccepted.longitude}` : allestreeAccepted.detail,
  );

  const yorkshire = resolveUkLocalPagePlacesAreaReference({
    areaName: "Wombwell",
    parentTown: "Barnsley",
    countryCode: "GB",
    hits: [mickleoverHit, allestreeHit],
  });
  record(
    "cross-tenant-isolation",
    yorkshire.ok === false,
    yorkshire.ok ? `${yorkshire.name} ${yorkshire.latitude}` : yorkshire.reason,
  );

  const pharmacy = planPharmacyLocalEvidenceRequest(BROOK, SERVICE).pharmacyCoordinates;
  const distance = accepted.ok
    ? planUkLocalPageStraightLineDistance({
        slug: BROOK,
        areaName: "Mickleover",
        pharmacyCoordinates: pharmacy,
        areaCentroid: { latitude: accepted.latitude, longitude: accepted.longitude, source: accepted.source },
      })
    : null;
  const expectedKm = pharmacy
    ? Number(haversineKm(MICKLEOVER_FIXTURE_POINT, pharmacy).toFixed(1))
    : null;
  record(
    "distance-production-from-accepted-reference",
    Boolean(distance) &&
      distance?.method === "haversine-straight-line" &&
      distance?.distanceKm === expectedKm &&
      distance?.distanceKm !== 4.1,
    `km=${distance?.distanceKm} expected=${expectedKm} method=${distance?.method || ""}`,
  );

  const preflight = preflightOneLocalPageCandidate(BROOK, SERVICE, "mickleover");
  record(
    "live-mickleover-keeps-saved-candidate",
    preflight.existingCandidate === true && preflight.canGenerate === false,
    `${preflight.editorialEvidence.status} ${preflight.distanceLabel} generate=${preflight.canGenerate}`,
  );

  const campaign = JSON.parse(
    fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, PROTECTED[0]), "utf8"),
  ) as { runId?: string; status?: string };
  record(
    "campaign-run-preserved",
    campaign.runId === "e23b2020-b520-453c-a7a5-45d301316229" && campaign.status === "stopped",
    `${campaign.runId} ${campaign.status}`,
  );

  for (const rel of PROTECTED) {
    record(`reload-safety:${path.basename(rel)}`, sha256File(rel) === before[rel], rel);
  }
  const liveMickleoverRefAfter = fs.existsSync(liveMickleoverRef)
    ? createHash("sha256").update(fs.readFileSync(liveMickleoverRef)).digest("hex")
    : "absent";
  record(
    "test-did-not-write-live-mickleover-reference",
    liveMickleoverRefAfter === liveMickleoverRefBefore && sha256File(PROTECTED[0]) === before[PROTECTED[0]],
    liveMickleoverRef,
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
    for (const row of failed) console.error(`FAIL  ${row.id} — ${row.detail}`);
  }
}

main();
