#!/usr/bin/env npx tsx
/**
 * Provider-free preflight: area-reference resolver + generation readiness
 * aligned to the content-generation field policy. No Places, DataForSEO,
 * OpenAI, Resume, allowances, publication or commit.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  assessLocalPageGenerationReadiness,
  CONTENT_GENERATION_FIELD_POLICY_PATH,
  openaiMustNotReceiveField,
} from "../src/pharmacy/contentEngine/pharmacyContentGenerationFieldPolicyV1.ts";
import {
  buildUkLocalPageAreaReferenceQuery,
  resolveUkLocalPagePlacesAreaReference,
  planUkLocalPageStraightLineDistance,
  type PlacesAreaReferenceHit,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import { resolveGeographicEvidenceContext } from "../src/pharmacy/contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { planPharmacyLocalEvidenceRequest } from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import {
  assessSavedLocalPageGenerationReadiness,
  savedVerifiedAreaReferencePoint,
} from "../src/pharmacy/contentEngine/pharmacyLocalPageGenerationReadinessV1.ts";
import {
  applyRendererOwnedLocalCopyFieldsV3,
  fieldPlanForLocalNarrativeInputV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import {
  buildPharmacyAiLocalCopyInputV3,
  validateAiLocalCopyPilotV3,
  acceptedEditorialFactsForLocalGenerationV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { assertLocalNarrativeEvidenceBindingsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEvidenceBindingV3.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { inspectLocalRecognitionV3, inspectOffPremisesAccessCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { planRemainingLocalPagesCampaign } from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";
import { haversineKm } from "../src/pharmacy/masterAdminLocalCoverageGeoService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const REMAINING = ["duffield", "alvaston", "mackworth", "chaddesden", "spondon", "borrowash"] as const;
const PROTECTED = [
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/duffield.json",
  "data/pharmacy-local-page-evidence-budget/brook-pharmacy-demo-derby/pharmacy-first/v1/duffield.json",
  "data/pharmacy-local-editorial-evidence-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/duffield.json",
  "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/duffield.json",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/littleover.json",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston.json",
  "data/pharmacy-ai-local-generation-budget/brook-pharmacy-demo-derby/pharmacy-first/v3/brook-pharmacy-demo-derby:pharmacy-first:v3:one-local-page:chellaston.json",
] as const;
const LOCKED_CANDIDATES: Record<string, { generatedAt: string; sha256: string }> = {
  allestree: { generatedAt: "2026-09-07T10:01:29.015Z", sha256: "842b87a9d50756a60ab33dd9bdc87cd8c31a3fc7be09fef202475472dcdd2248" },
  mickleover: { generatedAt: "2026-09-07T10:32:29.938Z", sha256: "85a61fd84e6ae0eb8384ece53545792a1bc9ca174ee5d2a6c2e0b15378127c6d" },
  littleover: { generatedAt: "2026-09-07T10:32:33.472Z", sha256: "9e6bde9ce095c6f83d5a4ac72ca63c847f574c27c9d4fd2d7d9ef0e2ac1bdeb9" },
  chellaston: { generatedAt: "2026-09-07T10:32:36.707Z", sha256: "790377737b6d3f4dd59466267ee77b883273296db802bfeee2622c3a25f30881" },
};

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}
function sha256File(rel: string): string {
  return createHash("sha256").update(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel))).digest("hex");
}
function areaNameConditional(source: string): boolean {
  return /if\s*\([^)]*\b(chellaston|allestree|mickleover|littleover|duffield|alvaston|mackworth|chaddesden|spondon|borrowash|wombwell|darfield)\b/i.test(
    source,
  );
}

function main() {
  console.log("\n=== Local-page evidence readiness field-policy preflight (provider-free) ===\n");
  const before = Object.fromEntries(PROTECTED.map((rel) => [rel, sha256File(rel)]));

  const request = planPharmacyLocalEvidenceRequest(BROOK, SERVICE);
  const pharmacy = request.pharmacyCoordinates;
  const duffieldGeo = resolveGeographicEvidenceContext({
    slug: BROOK,
    areaName: "Duffield",
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: pharmacy,
  });
  const duffieldQuery = buildUkLocalPageAreaReferenceQuery(duffieldGeo);
  record(
    "query-does-not-assert-pharmacy-city",
    duffieldQuery === "Duffield locality, Derbyshire, UK" && !/\bDerby\b/i.test(duffieldQuery),
    duffieldQuery,
  );
  const innerGeo = resolveGeographicEvidenceContext({
    slug: BROOK,
    areaName: "Allestree",
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: pharmacy,
  });
  record(
    "inside-city-query-still-omits-pharmacy-city-parent",
    buildUkLocalPageAreaReferenceQuery(innerGeo) === "Allestree locality, Derbyshire, UK",
    buildUkLocalPageAreaReferenceQuery(innerGeo),
  );

  const duffieldRun = JSON.parse(
    fs.readFileSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/duffield.json"),
      "utf8",
    ),
  ) as { placesHitsByCall: Record<string, PlacesAreaReferenceHit[]>; areaReferencePoint: unknown };
  const savedHits = duffieldRun.placesHitsByCall["places-area-reference"] || [];
  const resolvedSaved = resolveUkLocalPagePlacesAreaReference({
    areaName: "Duffield",
    county: duffieldGeo.county,
    countryCode: duffieldGeo.countryCode,
    siblingAreaNames: duffieldGeo.siblingAreaNames,
    pharmacyCityHint: duffieldGeo.parentTown,
    hits: savedHits,
  });
  if (!resolvedSaved.ok) {
    record(
      "saved-duffield-places-hit",
      false,
      `SAVED-RESULT BLOCKER: ${resolvedSaved.reason} ${resolvedSaved.detail}`,
    );
  } else {
    const km = pharmacy ? Number(haversineKm(pharmacy, resolvedSaved).toFixed(1)) : null;
    const plan = planUkLocalPageStraightLineDistance({
      slug: BROOK,
      areaName: "Duffield",
      pharmacyCoordinates: pharmacy,
      areaCentroid: { latitude: resolvedSaved.latitude, longitude: resolvedSaved.longitude, source: resolvedSaved.source },
    });
    record(
      "saved-duffield-places-hit-accepted",
      resolvedSaved.name === "Duffield" &&
        resolvedSaved.types.includes("locality") &&
        plan.distanceKm === km &&
        km != null &&
        km > 0,
      `placeId=${resolvedSaved.placeId} ${resolvedSaved.latitude},${resolvedSaved.longitude} km=${plan.distanceKm}`,
    );
    const replayed = savedVerifiedAreaReferencePoint(BROOK, SERVICE, "Duffield", "duffield");
    record(
      "replay-saves-to-selected-area-only",
      Boolean(replayed) &&
        Math.abs((replayed?.latitude || 0) - resolvedSaved.latitude) < 1e-8 &&
        Math.abs((replayed?.longitude || 0) - resolvedSaved.longitude) < 1e-8 &&
        (duffieldRun.areaReferencePoint == null ||
          (Math.abs((duffieldRun.areaReferencePoint.latitude || 0) - resolvedSaved.latitude) < 1e-8 &&
            Math.abs((duffieldRun.areaReferencePoint.longitude || 0) - resolvedSaved.longitude) < 1e-8)),
      `replay=${replayed?.latitude},${replayed?.longitude} filePoint=${JSON.stringify(duffieldRun.areaReferencePoint)}`,
    );
  }

  const localityHit: PlacesAreaReferenceHit = {
    name: "Hillside",
    address: "Hillside, Northshire",
    types: ["locality", "political"],
    location: { latitude: 53.1, longitude: -1.5 },
    addressComponents: [
      { longText: "Hillside", shortText: "Hillside", types: ["locality", "political"] },
      { longText: "Northshire", shortText: "Northshire", types: ["administrative_area_level_2", "political"] },
      { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
    ],
  };
  const sublocalityHit: PlacesAreaReferenceHit = {
    ...localityHit,
    name: "Riverside",
    address: "Riverside, Portchester",
    types: ["sublocality_level_1", "sublocality", "political"],
    addressComponents: [
      { longText: "Riverside", shortText: "Riverside", types: ["sublocality", "political"] },
      { longText: "Portchester", shortText: "Portchester", types: ["postal_town"] },
      { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
    ],
  };
  const postalTownHit: PlacesAreaReferenceHit = {
    name: "Belper",
    address: "Belper, Derbyshire",
    types: ["postal_town"],
    location: { latitude: 53.02, longitude: -1.48 },
    addressComponents: [
      { longText: "Belper", shortText: "Belper", types: ["postal_town"] },
      { longText: "Derbyshire", shortText: "Derbyshire", types: ["administrative_area_level_2", "political"] },
      { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
    ],
  };
  const adminHit: PlacesAreaReferenceHit = {
    name: "Amber Valley",
    address: "Amber Valley, Derbyshire",
    types: ["administrative_area_level_2", "political"],
    location: { latitude: 53.04, longitude: -1.48 },
    addressComponents: [
      { longText: "Amber Valley", shortText: "Amber Valley", types: ["administrative_area_level_2", "political"] },
      { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
    ],
  };
  record(
    "accept-locality-outside-pharmacy-city",
    resolveUkLocalPagePlacesAreaReference({
      areaName: "Hillside",
      county: "Northshire",
      countryCode: "GB",
      pharmacyCityHint: "Portchester",
      hits: [localityHit],
    }).ok === true,
    "Hillside / Northshire",
  );
  record(
    "accept-sublocality-inside-pharmacy-city",
    resolveUkLocalPagePlacesAreaReference({
      areaName: "Riverside",
      county: "Northshire",
      countryCode: "GB",
      pharmacyCityHint: "Portchester",
      hits: [sublocalityHit],
    }).ok === true,
    "Riverside / Portchester",
  );
  const unitaryCityHit: PlacesAreaReferenceHit = {
    name: "Riverside",
    address: "Riverside, Portchester",
    types: ["sublocality_level_1", "sublocality", "political"],
    location: { latitude: 53.1, longitude: -1.5 },
    addressComponents: [
      { longText: "Riverside", shortText: "Riverside", types: ["sublocality", "political"] },
      { longText: "Portchester", shortText: "Portchester", types: ["postal_town"] },
      { longText: "Portchester", shortText: "Portchester", types: ["administrative_area_level_2", "political"] },
      { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
    ],
  };
  record(
    "accept-unitary-city-admin-with-pharmacy-city-hint",
    resolveUkLocalPagePlacesAreaReference({
      areaName: "Riverside",
      county: "Northshire",
      countryCode: "GB",
      pharmacyCityHint: "Portchester",
      hits: [unitaryCityHit],
    }).ok === true,
    "admin city may differ from requested county",
  );
  record(
    "reject-different-county-admin",
    resolveUkLocalPagePlacesAreaReference({
      areaName: "Riverside",
      county: "Northshire",
      countryCode: "GB",
      pharmacyCityHint: "Portchester",
      hits: [
        {
          ...unitaryCityHit,
          address: "Riverside, Othershire",
          addressComponents: [
            { longText: "Riverside", shortText: "Riverside", types: ["sublocality", "political"] },
            { longText: "Othershire", shortText: "Othershire", types: ["administrative_area_level_2", "political"] },
            { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
          ],
        },
      ],
    }).ok === false,
    "Othershire",
  );
  record(
    "accept-postal-town",
    resolveUkLocalPagePlacesAreaReference({ areaName: "Belper", county: "Derbyshire", countryCode: "GB", hits: [postalTownHit] }).ok ===
      true,
    "postal_town",
  );
  record(
    "accept-administrative-area",
    resolveUkLocalPagePlacesAreaReference({
      areaName: "Amber Valley",
      county: "Derbyshire",
      countryCode: "GB",
      hits: [adminHit],
    }).ok === true,
    "administrative_area_level_2",
  );
  const ambiguous = resolveUkLocalPagePlacesAreaReference({
    areaName: "Hillside",
    county: "Northshire",
    countryCode: "GB",
    hits: [localityHit, { ...localityHit, placeId: "other", location: { latitude: 54.2, longitude: -1.9 } }],
  });
  record("reject-ambiguous-same-name", ambiguous.ok === false && ambiguous.reason === "ambiguous", ambiguous.ok ? "accepted" : ambiguous.reason);
  const allestreeHit = {
    name: "Allestree",
    address: "Allestree, Derby",
    types: ["locality", "political"],
    location: { latitude: 52.952948899999996, longitude: -1.4925673000000002 },
  };
  const leaked = resolveUkLocalPagePlacesAreaReference({
    areaName: "Duffield",
    county: "Derbyshire",
    countryCode: "GB",
    siblingAreaNames: ["Allestree", "Duffield"],
    hits: [allestreeHit],
  });
  record("no-allestree-leakage", leaked.ok === false, leaked.ok ? `${leaked.latitude}` : leaked.reason);

  const sparseReady = assessLocalPageGenerationReadiness({
    areaName: "Hillside",
    selectedAreaConfirmed: true,
    areaIdentityAmbiguous: false,
    pharmacyName: "Example Pharmacy",
    premisesLocality: "Portchester",
    pharmacyCoordinatesPresent: true,
    areaReferenceStatus: "recorded",
    distanceKm: 7.5,
    clinicalCopyApproved: true,
    contaminatedLocalEvidence: false,
    editorialFactCount: 0,
    hasNonDistanceEditorialFact: false,
    verifiedGpPracticeCount: 0,
    blockedAuthoritativePages: true,
  });
  record(
    "zero-gp-and-blocked-page-do-not-block",
    sparseReady.canGenerate === true &&
      sparseReady.evidenceRichness === "distance-only" &&
      sparseReady.fieldPlan.mayRequestOpenAI === false &&
      sparseReady.omittedOptionalFields.includes("localContextParagraphs"),
    `${sparseReady.evidenceRichness} openai=${sparseReady.fieldPlan.mayRequestOpenAI} reasons=${sparseReady.reasons.join("; ")}`,
  );
  const missingRef = assessLocalPageGenerationReadiness({
    ...{
      areaName: "Hillside",
      selectedAreaConfirmed: true,
      areaIdentityAmbiguous: false,
      pharmacyName: "Example Pharmacy",
      premisesLocality: "Portchester",
      pharmacyCoordinatesPresent: true,
      areaReferenceStatus: "missing" as const,
      distanceKm: null,
      clinicalCopyApproved: true,
      contaminatedLocalEvidence: false,
      editorialFactCount: 4,
      hasNonDistanceEditorialFact: true,
      verifiedGpPracticeCount: 2,
      blockedAuthoritativePages: false,
    },
  });
  record(
    "missing-area-reference-blocks",
    missingRef.canGenerate === false && missingRef.blockReasons.includes("missing-area-reference"),
    missingRef.blockReasons.join(","),
  );
  const ambiguousRef = assessLocalPageGenerationReadiness({
    areaName: "Hillside",
    selectedAreaConfirmed: true,
    areaIdentityAmbiguous: true,
    pharmacyName: "Example Pharmacy",
    premisesLocality: "Portchester",
    pharmacyCoordinatesPresent: true,
    areaReferenceStatus: "ambiguous",
    distanceKm: null,
    clinicalCopyApproved: true,
    contaminatedLocalEvidence: false,
    editorialFactCount: 4,
    hasNonDistanceEditorialFact: true,
    verifiedGpPracticeCount: 2,
    blockedAuthoritativePages: false,
  });
  record(
    "ambiguous-identity-blocks",
    ambiguousRef.canGenerate === false && ambiguousRef.blockReasons.includes("ambiguous-area-identity"),
    ambiguousRef.blockReasons.join(","),
  );

  const duffieldReadiness = assessSavedLocalPageGenerationReadiness(BROOK, SERVICE, "Duffield", "duffield");
  record(
    "duffield-saved-minimum-ready",
    duffieldReadiness.canGenerate === true &&
      duffieldReadiness.areaReferenceStatus === "recorded" &&
      duffieldReadiness.fieldPlan.mayRequestOpenAI === true,
    `canGenerate=${duffieldReadiness.canGenerate} richness=${duffieldReadiness.evidenceRichness} ref=${duffieldReadiness.areaReferenceStatus} gp=${duffieldReadiness.optionalFacts.verifiedGpPractices}`,
  );
  const yorkshireReadiness = assessSavedLocalPageGenerationReadiness(YORKSHIRE, SERVICE, "Wombwell", "wombwell");
  record(
    "multi-tenant-isolation",
    yorkshireReadiness.editorial.slug === YORKSHIRE && duffieldReadiness.editorial.slug === BROOK,
    `${yorkshireReadiness.editorial.slug} / ${duffieldReadiness.editorial.slug}`,
  );

  const duffieldEditorial = loadEditorialEvidencePack(BROOK, SERVICE, "duffield");
  let duffieldInput: ReturnType<typeof buildPharmacyAiLocalCopyInputV3> | null = null;
  try {
    duffieldInput = duffieldEditorial
      ? buildPharmacyAiLocalCopyInputV3({
          slug: BROOK,
          serviceId: SERVICE,
          areaName: "Duffield",
          areaSlug: "duffield",
          editorial: duffieldEditorial,
        })
      : null;
  } catch (error) {
    record("duffield-sparse-input", false, error instanceof Error ? error.message : String(error));
  }
  if (duffieldInput) {
    const plan = fieldPlanForLocalNarrativeInputV3(duffieldInput);
    record(
      "deterministic-fields-not-requested",
      plan.deterministicFields.every((fieldId) => openaiMustNotReceiveField("local-area-page", fieldId)) &&
        !plan.openaiSchemaFields.includes("heroIntroduction") &&
        !plan.openaiSchemaFields.includes("relationshipToPharmacy") &&
        plan.openaiSchemaFields.includes("localIntroduction") &&
        !plan.deterministicFields.includes("localIntroduction") &&
        plan.mayRequestOpenAI === true,
      `${plan.evidenceRichness} schema=${plan.openaiSchemaFields.join(",")}`,
    );
    const parsed = parseAiLocalCopyV3({
      localIntroduction: "",
      localContextHeading: "",
      localContextParagraphs: [],
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
    });
    const assembled = parsed.ok ? applyRendererOwnedLocalCopyFieldsV3(parsed.copy, duffieldInput) : null;
    const emptyAccount = parsed.ok ? inspectLocalRecognitionV3(parsed.copy, duffieldInput) : ["parse-failed"];
    record(
      "empty-local-account-still-fails-before-deterministic-assembly",
      emptyAccount.some((row) => /missing-local-account/.test(row)),
      emptyAccount.join(" | ") || "missing-local-account not raised on empty copy",
    );
    const quality = assembled ? inspectOffPremisesAccessCopyV3(assembled, duffieldInput) : { failures: ["parse-failed"] };
    const factsForValidation = acceptedEditorialFactsForLocalGenerationV3({
      editorial: duffieldEditorial,
      areaName: "Duffield",
      areaSlug: "duffield",
      pharmacyName: duffieldInput.business.name,
      address: duffieldInput.business.address,
      pharmacyIsInArea: Boolean(duffieldInput.locality.pharmacyIsInArea),
      distanceKm: duffieldInput.distanceBasis?.distanceKm ?? duffieldInput.locality.distanceKm,
      areaReference: duffieldInput.distanceBasis?.areaReferencePoint,
      pharmacyCoordinates: duffieldInput.distanceBasis?.pharmacyCoordinates,
    });
    const validated = assembled
      ? validateAiLocalCopyPilotV3(assembled, duffieldInput, factsForValidation)
      : { ok: false, failures: ["parse-failed"], reviews: [] };
    const bindings = assembled
      ? assertLocalNarrativeEvidenceBindingsV3(assembled, { areaName: "Duffield" }, factsForValidation)
      : { ok: false, failures: ["parse-failed"] };
    const hard = [...validated.failures, ...bindings.failures].filter((row) => !/^REVIEW REQUIRED\b/i.test(row));
    record(
      "minimum-evidence-passes-hard-validators",
      parsed.ok &&
        Boolean(assembled?.relationshipToPharmacy) &&
        /straight line/.test(assembled?.relationshipToPharmacy || "") &&
        assembled?.localIntroduction === "" &&
        hard.some((row) => /missing-local-account/.test(row)) &&
        factsForValidation.some((fact) => fact.category === "pharmacy-relationship") &&
        !quality.failures.some((row) => /area-in-hero|premises-locality/.test(row)),
      [...hard, ...quality.failures, assembled?.localIntroduction || "", assembled?.relationshipToPharmacy || ""].join(" | ") || "ok",
    );
  }

  const productionFiles = [
    CONTENT_GENERATION_FIELD_POLICY_PATH,
    "src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts",
    "src/pharmacy/contentEngine/pharmacyLocalPageGenerationReadinessV1.ts",
    "src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts",
    "src/pharmacy/growthEngineLocalPageCandidateService.ts",
    "src/pharmacy/growthEngineLocalPageCampaignRunService.ts",
    "src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts",
    "src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts",
  ];
  const areaBranch = /if\s*\(\s*(?:opts\.)?area(?:Slug|Name)\s*===?\s*['"`]/i;
  record(
    "no-area-name-production-conditionals",
    productionFiles.every((rel) => !areaBranch.test(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), "utf8"))),
    productionFiles.join(", "),
  );

  const remainingPlan = planRemainingLocalPagesCampaign(BROOK, SERVICE);
  for (const areaSlug of REMAINING) {
    const row = remainingPlan.complete.find((item) => item.areaSlug === areaSlug);
    record(
      `remaining-${areaSlug}-plan`,
      Boolean(row) && row?.status === "skipped-complete",
      row ? `status=${row.status} ready=${row.evidenceReady}` : "missing",
    );
  }
  record(
    "duffield-not-blocked-by-optional-facts",
    remainingPlan.complete.find((row) => row.areaSlug === "duffield")?.status === "skipped-complete" &&
      remainingPlan.remaining.every((row) => row.areaSlug !== "duffield"),
    JSON.stringify(remainingPlan.complete.find((row) => row.areaSlug === "duffield") || remainingPlan.remaining.find((row) => row.areaSlug === "duffield")),
  );

  for (const [name, locked] of Object.entries(LOCKED_CANDIDATES)) {
    const rel = `data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/${name}.json`;
    const rec = JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), "utf8")) as { generatedAt?: string };
    record(
      `locked-candidate-${name}`,
      rec.generatedAt === locked.generatedAt && sha256File(rel) === locked.sha256,
      `${rec.generatedAt} ${sha256File(rel)}`,
    );
  }

  const qualitySrc = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts"), "utf8");
  const groundingSrc = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts"), "utf8");
  const engineSrc = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts"), "utf8");
  record(
    "validators-not-weakened",
    /area-in-hero/.test(qualitySrc) &&
      /premises-locality/.test(qualitySrc) &&
      /missing-local-account/.test(qualitySrc) &&
      /ungrounded/.test(groundingSrc) &&
      !/missing-local-account/.test(engineSrc),
    "area-in-hero, premises-locality, missing-local-account and ungrounded checks remain; engine does not suppress missing-local-account",
  );

  for (const rel of PROTECTED) {
    record(`unchanged-${path.basename(path.dirname(rel))}-${path.basename(rel)}`, sha256File(rel) === before[rel], rel);
  }
  const campaignRun = JSON.parse(
    fs.readFileSync(
      path.join(
        PHARMACY_WORKSPACE_ROOT,
        "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json",
      ),
      "utf8",
    ),
  ) as { runId?: string };
  record(
    "same-durable-run-id",
    campaignRun.runId === "e23b2020-b520-453c-a7a5-45d301316229",
    String(campaignRun.runId || ""),
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.length - failed.length}/${checks.length} checks`);
  if (failed.length) process.exit(1);
}

main();
