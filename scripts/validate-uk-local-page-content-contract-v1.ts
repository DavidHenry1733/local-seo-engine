#!/usr/bin/env npx tsx
/**
 * UK local-page content contract + targeted evidence plan.
 * Two pharmacies, two areas. No paid calls and no generation.
 */
import fs from "node:fs";
import path from "node:path";

import {
  buildAiLocalNarrativeUserPromptV3,
  PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
  type BusinessLocalityCopyInputV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  UK_LOCAL_PAGE_CONTENT_CONTRACT_ID,
  UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION,
  UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING,
  discoverableUkLocalPageContentContract,
  ukLocalPageContentContractArtifactPath,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import { buildEditorialSearchQueries } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { resolveGeographicEvidenceContext } from "../src/pharmacy/contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { validateAiLocalCopyPilotV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { groundAiLocalCopyClaimsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import type { AiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { planOneLocalPageEvidencePreparation } from "../src/pharmacy/growthEngineLocalPageEvidencePreparationService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";

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

function lockedOffer() {
  return {
    serviceName: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.serviceName,
    serviceId: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.serviceId,
    lockedClinicalFacts: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
    allowedCta: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.allowedCta,
  };
}

function brookAllestreeInput(): BusinessLocalityCopyInputV3 {
  return {
    vertical: "pharmacy",
    business: {
      name: "Brook Pharmacy Demo Derby",
      telephone: "01332 445 076",
      website: "https://pharmacy.inboxingproweb.com/",
      address: "56 West Burton Road, Derby, DA5 4NR — demonstration listing, postal address not verified",
      coordinates: { latitude: 52.91678930677714, longitude: -1.4825298233725033 },
      marketTown: "Derby",
    },
    offer: lockedOffer(),
    locality: {
      areaName: "Allestree",
      areaSlug: "allestree",
      distanceLabel: "",
      distanceKm: null,
      cardinalDirection: "",
      pharmacyIsInArea: false,
      neighbouringSelectedAreas: ["Mickleover"],
      evidenceLimitations: ["area-reference-missing"],
      acceptedEntities: [],
    },
    style: { roles: ["hero introduction", "local context"], tone: "calm professional British English" },
    editorialFacts: [
      {
        factId: "allestree:healthcare:park-farm",
        category: "healthcare",
        normalizedStatement: "Park Farm Medical Centre is an NHS GP practice in Allestree.",
        permittedCopyRole: "healthcare-context",
        prohibitedInference: "Does not imply referral, registration or partnership with the pharmacy.",
        sourceClass: "primary",
        publisher: "NHS",
      },
    ],
    editorialSufficiency: "EVIDENCE LIMITED",
  };
}

function yorkshireWombwellInput(): BusinessLocalityCopyInputV3 {
  return {
    vertical: "pharmacy",
    business: {
      name: "Yorkshire Pharmacy & Health Clinic",
      telephone: "01226 753 110",
      website: "https://yorkshirepharmacy.example",
      address: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
      coordinates: { latitude: 53.533, longitude: -1.37 },
      marketTown: "Barnsley",
    },
    offer: lockedOffer(),
    locality: {
      areaName: "Wombwell",
      areaSlug: "wombwell",
      distanceLabel: "1.7 km",
      distanceKm: 1.7,
      cardinalDirection: "",
      pharmacyIsInArea: false,
      neighbouringSelectedAreas: ["Darfield", "Worsbrough"],
      evidenceLimitations: [],
      acceptedEntities: [],
    },
    style: { roles: ["hero introduction", "local context"], tone: "calm professional British English" },
    editorialFacts: [
      {
        factId: "wombwell:healthcare:medical-centre",
        category: "healthcare",
        normalizedStatement: "Wombwell Medical Centre is an NHS GP practice in Wombwell.",
        permittedCopyRole: "healthcare-context",
        prohibitedInference: "Does not imply referral, registration or partnership with the pharmacy.",
        sourceClass: "primary",
        publisher: "NHS",
      },
    ],
    editorialSufficiency: "READY",
  };
}

function copyFor(
  area: string,
  pharmacyName: string,
  overrides: Partial<AiLocalCopyV3> = {},
): AiLocalCopyV3 {
  return {
    area,
    heroHeading: `Pharmacy First in ${area}`,
    heroIntroduction: `Pharmacy First can help people in ${area} with eligible common conditions.`,
    localIntroduction: `Pharmacy First can help people in ${area} with eligible common conditions.`,
    localContextHeading: `Why ${area} patients start with the pharmacist`,
    localContextParagraphs: [`${pharmacyName} provides Pharmacy First consultations for people in ${area}.`],
    relationshipToPharmacy: `Pharmacy First consultations take place at ${pharmacyName}.`,
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: [],
    ...overrides,
  };
}

function main() {
  console.log("\n=== UK local-page content contract v1 (no paid calls) ===\n");

  const artifact = JSON.parse(fs.readFileSync(ukLocalPageContentContractArtifactPath(), "utf8")) as {
    contractId: string;
    sourceToFieldMapping: unknown[];
  };
  const discovered = discoverableUkLocalPageContentContract();
  record(
    "contract-artifact-discoverable",
    artifact.contractId === UK_LOCAL_PAGE_CONTENT_CONTRACT_ID &&
      discovered.version === UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION &&
      artifact.sourceToFieldMapping.length === UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING.length,
    ukLocalPageContentContractArtifactPath().replace(`${PHARMACY_WORKSPACE_ROOT}/`, ""),
  );

  const allestree = planOneLocalPageEvidencePreparation(BROOK, SERVICE, "Allestree");
  const mickleover = planOneLocalPageEvidencePreparation(BROOK, SERVICE, "Mickleover");
  const wombwell = planOneLocalPageEvidencePreparation(YORKSHIRE, SERVICE, "Wombwell");

  record(
    "tenant-area-independence",
    allestree.slug === BROOK &&
      mickleover.slug === BROOK &&
      wombwell.slug === YORKSHIRE &&
      allestree.contentContractId === mickleover.contentContractId &&
      allestree.contentContractId === wombwell.contentContractId &&
      allestree.proposedCalls.some((row) => /Allestree/.test(row.query || "") || /Allestree/.test(row.purpose)) &&
      mickleover.proposedCalls.some((row) => /Mickleover/.test(row.query || "") || /Mickleover/.test(row.purpose)) &&
      !allestree.proposedCalls.some((row) => /Mickleover/.test(row.query || "")) &&
      !mickleover.proposedCalls.some((row) => /Allestree/.test(row.query || "")),
    `allestreeCalls=${allestree.proposedCalls.length} mickleoverCalls=${mickleover.proposedCalls.length} wombwellPaid=${wombwell.estimatedCostUsd}`,
  );

  record(
    "ambiguous-place-names-disambiguated",
    allestree.proposedCalls
      .filter((row) => row.query)
      .every((row) => /Allestree,.+(Derby|Derbyshire).+UK/i.test(row.query || "")) &&
      mickleover.proposedCalls
        .filter((row) => row.query)
        .every((row) => /Mickleover,.+(Derby|Derbyshire).+UK/i.test(row.query || "")),
    allestree.proposedCalls.find((row) => row.query)?.query || "no query",
  );

  record(
    "missing-optional-does-not-force-volume-searches",
    !allestree.proposedCalls.some((row) => /schools|retail|transport/i.test(row.id)) &&
      UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING.some((row) => row.contentRole === "recognisable-local-context" && row.required === false) &&
      UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING.some((row) => row.contentRole === "optional-local-questions" && row.required === false),
    `optionalUsd=${allestree.optionalEstimatedCostUsd} ids=${allestree.proposedCalls.map((r) => r.id).join(",")}`,
  );

  record(
    "yorkshire-cache-reuse-no-paid-calls",
    wombwell.cacheReuse.localPackPresent &&
      wombwell.cacheReuse.editorialPackPresent &&
      wombwell.estimatedCostUsd === 0 &&
      !wombwell.proposedCalls.some((row) => row.provider === "google-places" || row.provider === "dataforseo"),
    `local=${wombwell.cacheReuse.localPackPresent} editorial=${wombwell.cacheReuse.editorialPackPresent} usd=${wombwell.estimatedCostUsd}`,
  );

  const yorkshireGeo = resolveGeographicEvidenceContext({
    slug: YORKSHIRE,
    areaName: "Wombwell",
    areaSlug: "wombwell",
    siblingAreaNames: ["Darfield", "Worsbrough"],
  });
  const yorkshireQueries = buildEditorialSearchQueries({ geo: yorkshireGeo, pack: null });
  record(
    "yorkshire-editorial-queries-unchanged",
    yorkshireQueries.length === 3 && yorkshireQueries.some((row) => row.topic === "official-transport"),
    yorkshireQueries.map((row) => row.topic).join(","),
  );

  const previousPlanPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-plans/brook-pharmacy-demo-derby/pharmacy-first/v1/allestree.before-uk-content-contract-v1.json",
  );
  const previous = JSON.parse(fs.readFileSync(previousPlanPath, "utf8")) as { estimatedCostUsd: number; proposedCalls: Array<{ id: string }> };
  record(
    "previous-allestree-plan-preserved",
    previous.estimatedCostUsd === 0.198 && previous.proposedCalls.some((row) => row.id === "places-schools"),
    `previousUsd=${previous.estimatedCostUsd} previousCalls=${previous.proposedCalls.length}`,
  );

  const brookPrompt = buildAiLocalNarrativeUserPromptV3(brookAllestreeInput());
  const yorkshirePrompt = buildAiLocalNarrativeUserPromptV3(yorkshireWombwellInput());
  record(
    "writer-receives-contract-and-canonical-identity",
    brookPrompt.includes(UK_LOCAL_PAGE_CONTENT_CONTRACT_ID) &&
      brookPrompt.includes("canonicalPharmacyIdentity") &&
      brookPrompt.includes("Park Farm Medical Centre") &&
      brookPrompt.includes("allestree:healthcare:park-farm") &&
      /addressVerified.: false/.test(brookPrompt) &&
      yorkshirePrompt.includes("Yorkshire Pharmacy & Health Clinic") &&
      yorkshirePrompt.includes("wombwell:healthcare:medical-centre") &&
      /Do not invent the page’s requirements/.test(brookPrompt),
    "v3 entry point carries the UK local-page contract",
  );

  const brook = brookAllestreeInput();
  const york = yorkshireWombwellInput();
  const referralBrook = groundAiLocalCopyClaimsV3(
    copyFor("Allestree", brook.business.name, {
      localIntroduction: "The local GP practice refers patients to Brook Pharmacy Demo Derby.",
    }),
    brook,
    [],
  );
  const referralYork = groundAiLocalCopyClaimsV3(
    copyFor("Wombwell", york.business.name, {
      localIntroduction: "The local GP practice refers patients to Yorkshire Pharmacy & Health Clinic.",
    }),
    york,
    [],
  );
  record(
    "unsupported-gp-referrals-fail-both-pharmacies",
    referralBrook.ok === false &&
      referralYork.ok === false &&
      referralBrook.failures.some((row) => /implied-affiliation|referral/i.test(row)) &&
      referralYork.failures.some((row) => /implied-affiliation|referral/i.test(row)),
    `brook=${referralBrook.failures[0] || "none"} york=${referralYork.failures[0] || "none"}`,
  );

  const nearestBrook = groundAiLocalCopyClaimsV3(
    copyFor("Allestree", brook.business.name, {
      localFaqs: [{ question: "Where is the nearest GP?", answer: "Park Farm Medical Centre is the nearest practice." }],
    }),
    brook,
    [],
  );
  const nearestYork = groundAiLocalCopyClaimsV3(
    copyFor("Wombwell", york.business.name, {
      localFaqs: [{ question: "Where is the nearest Pharmacy First location to Wombwell?", answer: "The nearest listed premises are in Darfield." }],
    }),
    york,
    [],
  );
  record(
    "unsupported-nearest-claims-fail-both-areas",
    nearestBrook.failures.some((row) => /nearest or closest/i.test(row)) &&
      nearestYork.failures.some((row) => /nearest or closest/i.test(row)),
    `brook=${nearestBrook.failures.find((row) => /nearest/i.test(row)) || "none"} york=${nearestYork.failures.find((row) => /nearest/i.test(row)) || "none"}`,
  );

  const qualified = validateAiLocalCopyPilotV3(
    copyFor("Wombwell", york.business.name, {
      localContextParagraphs: [
        "Yorkshire Pharmacy & Health Clinic is in Darfield, approximately 1.7 km from Wombwell in a straight line.",
      ],
      relationshipToPharmacy:
        "Pharmacy First consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
    }),
    york,
    [],
  );
  record(
    "qualified-distance-does-not-fail-unlabelled-rule",
    !qualified.failures.some((row) => /unlabelled-distance/i.test(row)),
    qualified.failures.filter((row) => /distance/i.test(row)).join(" | ") || "no unlabelled-distance failure",
  );

  const repeated = validateAiLocalCopyPilotV3(
    copyFor("Wombwell", york.business.name, {
      localContextParagraphs: [
        "Yorkshire Pharmacy & Health Clinic is in Darfield, approximately 1.7 km from Wombwell in a straight line.",
      ],
      relationshipToPharmacy:
        "Yorkshire Pharmacy & Health Clinic is in Darfield, approximately 1.7 km from Wombwell in a straight line.",
    }),
    york,
    [],
  );
  record(
    "genuine-repetition-fails",
    repeated.failures.some((row) => /repeated distance guidance/i.test(row)),
    repeated.failures.filter((row) => /repeat/i.test(row)).join(" | ") || repeated.failures.join(" | "),
  );

  const restatedClinical = validateAiLocalCopyPilotV3(
    copyFor("Allestree", brook.business.name, {
      relationshipToPharmacy: "Pharmacy First consultations take place at Brook Pharmacy Demo Derby in Derby.",
      localFaqs: [
        {
          question: "What happens during a Pharmacy First consultation?",
          answer: "The pharmacist will review your symptoms.",
        },
      ],
    }),
    brook,
    [],
  );
  const clinicalLeftToRenderer = validateAiLocalCopyPilotV3(
    copyFor("Wombwell", york.business.name, {
      localFaqs: [],
      localAccessIntroduction: "",
      relationshipToPharmacy:
        "Pharmacy First consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
    }),
    york,
    [],
  );
  record(
    "unchanged-clinical-content-boundary",
    restatedClinical.failures.some((row) => /restates renderer-owned clinical copy/i.test(row)) &&
      !clinicalLeftToRenderer.failures.some((row) => /restates renderer-owned clinical copy/i.test(row)),
    `restated=${restatedClinical.failures.filter((row) => /renderer-owned clinical/i.test(row)).join(" | ") || restatedClinical.failures.join(" | ")} cleanHasClinicalRestate=${clinicalLeftToRenderer.failures.some((row) => /renderer-owned clinical/i.test(row))}`,
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
