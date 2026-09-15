#!/usr/bin/env npx tsx
/**
 * Focused tests — Pharmacy local editorial-evidence and AI v3 pilots (Prompt 95).
 * Run: npx tsx src/pharmacy/contentEngine/validatePharmacyAiLocalEditorialEvidencePilotV3.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
  buildAiLocalNarrativeSystemPromptV3,
  buildAiLocalNarrativeUserPromptV3,
  premisesLocalityFromCanonicalAddress,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3, type AiLocalCopyV3, flattenAiLocalCopyText, aiLocalContextRenderPartsV3, aiLocalCopyOverlay } from "./pharmacyAiLocalCopySchemaV1.ts";
import { groundAiLocalCopyClaimsV3 } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { evaluateAiLocalCopyQualityV3, localNarrativeFingerprint, sentenceIdentifiesApproximateStraightLineKm } from "./pharmacyAiLocalCopyQualityV1.ts";
import { analyseRepetitionV3 } from "./pharmacyAiLocalCopyEditorialReviewV2.ts";
import {
  assessEditorialSufficiency,
  buildEditorialSearchQueries,
  classifyEditorialSource,
  decodeHtmlEntities,
  extractCustomerFacingNhsName,
  extractEditorialFactDrafts,
  isOfficialNamedMillHost,
  isQueryGeographicallyDisambiguated,
  looksLikeRawCopiedPassage,
  unsupportedInferencesIn,
  EDITORIAL_PILOT_AREAS,
  type EditorialFactV3,
} from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import {
  buildPharmacyAiLocalCopyInputV3,
  enforceEditorialDisciplineV3,
  generateAiLocalCopyPilotV3,
  loadAiLocalCopyPilotV3,
  persistAiLocalAttemptLogV3,
  resetAiPilotLedgerV3,
  sanitizeAiLocalAttemptPayloadV3,
  validateAiLocalCopyPilotV3,
} from "./pharmacyAiLocalNarrativeEngineV3.ts";
import { runPharmacyAiLocalEditorialEvidencePilotV3 } from "./runPharmacyAiLocalEditorialEvidencePilotV3.ts";
import { renderAiLocalPagePilotHtmlInMemoryV3 } from "../pharmacyAiLocalPagePilotAssemblerV3.ts";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  AI_PILOT_V3_PREVIEW_BANNER,
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  AI_LOCAL_COPY_ATTEMPT_LOG_DIRNAME,
  aiLocalCopyAttemptLogPath,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
  aiLocalCopyRecordPath,
} from "./pharmacyAiLocalPageCandidatePaths.ts";
import {
  loadPharmacyLocalEvidencePack,
  validatePharmacyLocalEvidencePack,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { resolveGeographicEvidenceContext } from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { renderReviewCentrePreviewAsset } from "../growthEngineReviewCentrePreviewService.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import { stripIdentityTokens } from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { getContentPackageReviewSections } from "../pharmacyContentPackageService.ts";
import { loadEditorialEvidencePack } from "./pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { planPharmacyLocalEvidenceRequest } from "./pharmacyLocalEvidencePackContractV1.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const PHARMACY = "Yorkshire Pharmacy & Health Clinic";
const PHONE = "01226 210477";
const ADDRESS = "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK";

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function snapshotProtected(): Map<string, string> {
  const out = new Map<string, string>();
  const roots = [
    path.join(ROOT, "output/pharmacy-content-ecosystem", YORKSHIRE),
    path.join(ROOT, "output/pharmacy-visual-experience", YORKSHIRE),
    path.join(ROOT, "output/pharmacy-local-page-candidates", YORKSHIRE),
    path.join(ROOT, "output/pharmacy-ai-local-page-candidates", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-ai-local-copy-candidates", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-ai-local-copy-pilots", YORKSHIRE, SERVICE, "v2"),
    path.join(ROOT, "output/pharmacy-ai-local-page-pilots", YORKSHIRE, SERVICE, "v2"),
    path.join(ROOT, "data/pharmacy-local-relevance-packs", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-content-packages", YORKSHIRE),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-review-centre.json`),
    path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", YORKSHIRE, "pharmacy-first.json"),
    path.join(ROOT, "package.json"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stat = fs.statSync(root);
    if (stat.isFile()) out.set(root, hashFile(root));
    else for (const file of walkFiles(root)) out.set(file, hashFile(file));
  }
  return out;
}

function sampleFact(partial: Partial<EditorialFactV3> & Pick<EditorialFactV3, "factId" | "normalizedStatement" | "category">): EditorialFactV3 {
  return {
    area: "Darfield",
    areaSlug: "darfield",
    sourceTitle: "Test",
    sourceUrl: "https://www.barnsley.gov.uk/example",
    publisher: "barnsley.gov.uk",
    retrievedAt: "2026-09-01T00:00:00.000Z",
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: "high",
    usefulnessToPharmacyFirstReader: "identity",
    permittedCopyRole: "area-introduction",
    prohibitedInference: "no routes",
    validationStatus: "accepted",
    ...partial,
  };
}

function baseCopy(overrides: Partial<AiLocalCopyV3> = {}): AiLocalCopyV3 {
  return {
    area: "Darfield",
    heroHeading: "Pharmacy First in Darfield",
    heroIntroduction: "Pharmacy First is available in Darfield at Yorkshire Pharmacy & Health Clinic.",
    localIntroduction: "Darfield is a village in the Metropolitan Borough of Barnsley, South Yorkshire.",
    localContextHeading: "Using Pharmacy First from Darfield",
    localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK."],
    relationshipToPharmacy: "Call the pharmacy before visiting so the pharmacist can confirm what can be assessed.",
    localAccessIntroduction: "If Pharmacy First is not suitable, the pharmacist may advise referral or urgent care.",
    localFaqs: [
      { question: "How far is the pharmacy from Darfield?", answer: "The pharmacy is in Darfield." },
      { question: "What if Pharmacy First is not right for me?", answer: "The pharmacist confirms what can be assessed and may advise referral." },
      { question: "Should I call ahead?", answer: "Call before visiting to check how a consultation is being arranged." },
    ],
    localCtaBridge: "Book an appointment or call the pharmacy to discuss your symptoms.",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: ["darfield:area-identity:village"],
    ...overrides,
  };
}

async function main() {
  const before = snapshotProtected();

  record(
    "1-only-three-areas-researched",
    EDITORIAL_PILOT_AREAS.length === 3 &&
      EDITORIAL_PILOT_AREAS.join(",") === "darfield,wombwell,worsbrough",
    EDITORIAL_PILOT_AREAS.join(","),
  );

  const geo = resolveGeographicEvidenceContext({
    slug: YORKSHIRE,
    areaName: "Darfield",
    areaSlug: "darfield",
    siblingAreaNames: ["Wombwell", "Worsbrough"],
  });
  const pack = loadPharmacyLocalEvidencePack(YORKSHIRE, "darfield");
  const checked = validatePharmacyLocalEvidencePack(pack, { slug: YORKSHIRE, areaName: "Darfield", areaSlug: "darfield" });
  const queries = buildEditorialSearchQueries({ geo, pack: checked.ok ? checked.pack : null });
  record(
    "2-queries-geographically-disambiguated",
    queries.length === 3 &&
      queries.every((q) => isQueryGeographicallyDisambiguated(q.query, geo)) &&
      queries.every((q) => q.query.toLowerCase() !== "darfield"),
    queries.map((q) => q.query).join(" | "),
  );

  const nhs = classifyEditorialSource("https://www.nhs.uk/services/gp-surgery/wombwell-medical-centre", "Wombwell Medical Centre");
  const gov = classifyEditorialSource("https://www.barnsley.gov.uk/services/libraries/darfield-library", "Darfield Library");
  const rail = classifyEditorialSource("https://www.nationalrail.co.uk/stations/wmb/", "Wombwell");
  const wiki = classifyEditorialSource("https://en.wikipedia.org/wiki/Darfield,_South_Yorkshire", "Darfield");
  const yell = classifyEditorialSource("https://www.yell.com/biz/darfield", "Darfield pharmacies");
  const mill = classifyEditorialSource("https://www.worsbrough-mill.com/country-park", "Worsbrough Mill Country Park");
  record(
    "3-only-allowed-source-types",
    nhs.class === "primary" &&
      gov.class === "primary" &&
      rail.class === "primary" &&
      mill.class === "rejected" &&
      wiki.class === "rejected" &&
      yell.class === "rejected",
    `nhs=${nhs.class} gov=${gov.class} rail=${rail.class} mill=${mill.class} wiki=${wiki.class} yell=${yell.class}`,
  );

  const fact = sampleFact({
    factId: "darfield:area-identity:village",
    category: "area-identity",
    normalizedStatement: "Darfield is a village in the Metropolitan Borough of Barnsley, South Yorkshire.",
  });
  record(
    "4-every-editorial-fact-has-provenance",
    Boolean(fact.area && fact.category && fact.normalizedStatement && fact.sourceTitle && fact.sourceUrl && fact.publisher && fact.retrievedAt && fact.sourceClass && fact.confidence && fact.usefulnessToPharmacyFirstReader && fact.permittedCopyRole && fact.prohibitedInference && fact.validationStatus),
    "required provenance fields present",
  );

  record(
    "5-unsupported-inference-fails",
    unsupportedInferencesIn("This route to the pharmacy takes 10 minutes and parking is free.").includes("route") &&
      unsupportedInferencesIn("This route to the pharmacy takes 10 minutes and parking is free.").includes("journey-time") &&
      unsupportedInferencesIn("This route to the pharmacy takes 10 minutes and parking is free.").includes("parking"),
    "route, journey-time and parking rejected",
  );

  record(
    "6-raw-copied-source-passages-fail",
    looksLikeRawCopiedPassage(
      "Darfield is a former mining village situated in the Dearne Valley with a long industrial history.",
      "Welcome. Darfield is a former mining village situated in the Dearne Valley with a long industrial history. Visit us.",
    ) &&
      !looksLikeRawCopiedPassage("Darfield has a public library.", "The council provides Darfield Library on Church Street for residents."),
    "long copied passage rejected; short paraphrase accepted",
  );

  const entityHeavy = assessEditorialSufficiency({
    facts: [
      sampleFact({
        factId: "x:pharmacy-relationship:in-area",
        category: "pharmacy-relationship",
        normalizedStatement: "The pharmacy is in Darfield.",
        permittedCopyRole: "access-context",
        sourceUrl: "canonical://pharmacy-profile",
        publisher: "canonical-pharmacy-profile",
      }),
    ],
    placesEntityCount: 12,
    pharmacyIsInArea: true,
    hasVerifiedDistance: true,
  });
  record(
    "7-sufficiency-not-entity-count",
    entityHeavy.status === "EVIDENCE LIMITED" && entityHeavy.placesEntityCount === 12,
    entityHeavy.reasons.join("; "),
  );

  const promptInput = buildPharmacyAiLocalCopyInputV3({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaName: "Darfield",
    areaSlug: "darfield",
    editorial: {
      contractId: "pharmacy-local-editorial-evidence-v3",
      version: "v3",
      slug: YORKSHIRE,
      area: "Darfield",
      areaSlug: "darfield",
      collectedAt: "2026-09-01T00:00:00.000Z",
      geographicContext: {
        areaName: "Darfield",
        parentTown: geo.parentTown,
        county: geo.county,
        country: geo.country,
        queryPlaceLabel: geo.queryPlaceLabel,
      },
      searches: [],
      retrievedPages: [],
      rejectedSources: [],
      facts: [fact],
      sufficiency: {
        status: "READY",
        intro: true,
        localContext: true,
        relationshipAccess: true,
        faq: true,
        reasons: [],
        acceptedFactCount: 1,
        placesEntityCount: 1,
      },
      costUsd: 0,
    },
  });
  const userPrompt = buildAiLocalNarrativeUserPromptV3(promptInput);
  const systemPrompt = buildAiLocalNarrativeSystemPromptV3();
  record(
    "8-ai-receives-only-verified-facts",
    AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3 === "pharmacy-ai-local-narrative-prompt-v3" &&
      AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3 === "v3" &&
      userPrompt.includes(fact.normalizedStatement) &&
      userPrompt.includes(fact.factId) &&
      !userPrompt.includes("Dr C Liley") &&
      /do not narrate evidence records/i.test(systemPrompt),
    "v3 prompt contract sends verified facts only",
  );
  record(
    "8b-prompt-hero-leads-with-pharmacy-first",
    /The hero must lead with Pharmacy First/i.test(systemPrompt) &&
      /Do not require every field to contain a unique local fact/i.test(systemPrompt) &&
      !/If the station fact is used/i.test(systemPrompt) &&
      !/write only: the area has a National Rail station/i.test(systemPrompt) &&
      !/write only: the area has a National Rail station/i.test(userPrompt),
    "v3 prompt no longer forces a station-only hero",
  );
  record(
    "8b2-prompt-brief-corrections",
    !/travelling to Darfield/i.test(systemPrompt) &&
      !/"travelling to Darfield"/.test(userPrompt) &&
      /Do not force either into the copy/i.test(systemPrompt) &&
      /straight-line/i.test(systemPrompt) &&
      /A clear, useful factual sentence is acceptable/i.test(systemPrompt) &&
      /page template already prints the address and telephone/i.test(systemPrompt) &&
      /canonical premises locality/i.test(systemPrompt) &&
      /from Wombwell to Darfield/i.test(systemPrompt) &&
      /Do not force a station, Medical Centre or numeric distance/i.test(systemPrompt),
    "v3 prompt carries the five brief corrections",
  );
  const stationHero = evaluateAiLocalCopyQualityV3(
    baseCopy({ heroIntroduction: "Wombwell has a National Rail station." }),
    promptInput,
  );
  record(
    "8c-bare-station-hero-fails",
    stationHero.failures.some((f) => /bare local fact|does not lead with Pharmacy First|station, landmark/i.test(f)),
    stationHero.failures.join(" | "),
  );
  const darfieldHeroGate = evaluateAiLocalCopyQualityV3(baseCopy(), promptInput);
  record(
    "8d-darfield-pharmacy-first-hero-gate",
    !darfieldHeroGate.failures.some((f) => /bare local fact|does not lead with Pharmacy First|station, landmark/i.test(f)),
    darfieldHeroGate.failures.filter((f) => /hero|Pharmacy First|landmark/i.test(f)).join(" | ") || "hero gate clear",
  );
  const wombwellInput = {
    ...promptInput,
    locality: {
      ...promptInput.locality,
      areaName: "Wombwell",
      areaSlug: "wombwell",
      pharmacyIsInArea: false,
      distanceKm: 1.7,
      distanceLabel: "1.7 km",
      neighbouringSelectedAreas: ["Darfield", "Worsbrough"],
    },
  };
  const wombwellStationCopy = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "Wombwell has a National Rail station.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell."],
    }),
    wombwellInput,
  );
  record(
    "8e-wombwell-station-existence-does-not-help",
    wombwellStationCopy.failures.some((f) => /does not help the reader understand the pharmacy/i.test(f)) &&
      !wombwellStationCopy.failures.some((f) => /listed rather than woven/i.test(f)),
    wombwellStationCopy.failures.join(" | "),
  );
  const paddedStation = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction:
        "Wombwell has a National Rail station as a recognisable local setting for people arranging Pharmacy First.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell."],
    }),
    wombwellInput,
  );
  record(
    "8e2-wombwell-padded-station-does-not-help",
    paddedStation.failures.some((f) => /does not help the reader understand the pharmacy/i.test(f)),
    paddedStation.failures.join(" | "),
  );
  const stationRoute = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "The National Rail station can help you reach the pharmacy.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell."],
    }),
    wombwellInput,
  );
  record(
    "8e3-wombwell-station-as-route-still-fails",
    stationRoute.failures.some((f) => /unsupported route|station used as an unsupported route/i.test(f)),
    stationRoute.failures.join(" | "),
  );
  const paddedGp = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction:
        "NHS general practice in Wombwell is provided from Wombwell Medical Centre, which is local place context rather than a Pharmacy First booking route.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell."],
    }),
    wombwellInput,
  );
  record(
    "8e4-wombwell-padded-medical-centre-does-not-help",
    paddedGp.failures.some((f) => /does not help the reader understand the pharmacy/i.test(f)),
    paddedGp.failures.join(" | "),
  );
  const omitLandmarks = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield."],
    }),
    wombwellInput,
  );
  record(
    "8e5-wombwell-omitting-station-and-medical-centre-is-allowed",
    !omitLandmarks.failures.some((f) => /station|Medical Centre|does not help the reader/i.test(f)),
    omitLandmarks.failures.join(" | ") || "omission allowed",
  );
  const usefulGp = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction:
        "Pharmacy First is a pharmacist consultation, not a GP appointment at Wombwell Medical Centre.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield."],
    }),
    wombwellInput,
  );
  record(
    "8e6-wombwell-useful-medical-centre-service-distinction-allowed",
    !usefulGp.failures.some((f) => /does not help the reader|named GP used without patient value|unsupported route/i.test(f)),
    usefulGp.failures.join(" | ") || "useful service distinction accepted",
  );
  const clearKm = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield, 1.7 km from Wombwell as an approximate straight-line distance."],
    }),
    wombwellInput,
  );
  record(
    "8e7-clear-distance-sentence-is-not-an-automatic-failure",
    !clearKm.failures.some((f) => /listed rather than woven|bare local fact|distance must be identified/i.test(f)),
    clearKm.failures.join(" | ") || "clear factual sentence accepted",
  );
  const darfieldLocation = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield, 1.7 km from Wombwell."],
    }),
    wombwellInput,
  );
  record(
    "8f-canonical-darfield-location-not-blanket-banned",
    !darfieldLocation.failures.some((f) => /forced place names|generic filler|unsupported route/i.test(f)),
    darfieldLocation.failures.join(" | ") || "canonical location accepted",
  );
  const travellingClaim = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: ["People in Wombwell reach the pharmacy by travelling to Darfield."],
    }),
    wombwellInput,
  );
  record(
    "8g-unsupported-travelling-journey-still-fails",
    travellingClaim.failures.some((f) => /unsupported route|journey/i.test(f)),
    travellingClaim.failures.join(" | "),
  );
  const travelKm = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is a 1.7 km drive from the centre of Wombwell."],
    }),
    wombwellInput,
  );
  record(
    "8h-straight-line-km-not-travel-or-town-centre",
    travelKm.failures.some((f) => /travel-distance or town-centre/i.test(f)),
    travelKm.failures.join(" | "),
  );
  const originDest = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: ["Pharmacy First for people from Wombwell to Darfield is provided at Yorkshire Pharmacy & Health Clinic."],
    }),
    wombwellInput,
  );
  record(
    "8g2-origin-and-destination-naming-is-allowed",
    !originDest.failures.some((f) => /unsupported route/i.test(f)),
    originDest.failures.join(" | ") || "origin and destination naming accepted",
  );
  const unlabelledKm = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell."],
    }),
    wombwellInput,
  );
  record(
    "8i-unlabelled-km-fails",
    unlabelledKm.failures.some((f) => /approximate straight-line/i.test(f)),
    unlabelledKm.failures.join(" | "),
  );
  const aroundStraightLine = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: [
        "Yorkshire Pharmacy & Health Clinic is in Darfield, around 1.7 km from Wombwell in a straight line.",
      ],
    }),
    wombwellInput,
  );
  record(
    "8i2-around-in-a-straight-line-is-accepted-distance-wording",
    !aroundStraightLine.failures.some((f) => /approximate straight-line/i.test(f)) &&
      sentenceIdentifiesApproximateStraightLineKm(
        "The pharmacy is located in Darfield, around 1.7 km from Wombwell in a straight line.",
      ) &&
      sentenceIdentifiesApproximateStraightLineKm(
        "Yorkshire Pharmacy & Health Clinic is in Darfield, approximately 1.7 km from Wombwell in a straight line.",
      ) &&
      !sentenceIdentifiesApproximateStraightLineKm("Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell.") &&
      !sentenceIdentifiesApproximateStraightLineKm("Yorkshire Pharmacy & Health Clinic is around 1.7 km from Wombwell."),
    aroundStraightLine.failures.join(" | ") || "around … in a straight line accepted",
  );
  const unhelpfulFaq = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield."],
      localFaqs: [
        { question: "Is Yorkshire Pharmacy & Health Clinic located in Wombwell?", answer: "The pharmacy is not in Wombwell." },
        { question: "What happens during a Pharmacy First consultation?", answer: "The pharmacist will review your symptoms." },
        { question: "When should I seek urgent medical care instead?", answer: "Seek urgent medical care for chest pain." },
      ],
    }),
    wombwellInput,
  );
  record(
    "8j-unhelpful-not-in-area-answer-fails",
    unhelpfulFaq.failures.some((f) => /unhelpful location answer/i.test(f)),
    unhelpfulFaq.failures.join(" | "),
  );

  const genericAddress = "10 Church Lane, Otherton, Marketville XY1 2AB, UK";
  const genericFactStatement = `Example Pharmacy is 2 km from Westfield, at ${genericAddress}.`;
  const genericPrompt = JSON.parse(
    buildAiLocalNarrativeUserPromptV3({
      ...promptInput,
      business: {
        ...promptInput.business,
        address: genericAddress,
        marketTown: "Marketville",
      },
      locality: {
        ...promptInput.locality,
        areaName: "Westfield",
        areaSlug: "westfield",
        pharmacyIsInArea: false,
      },
      editorialFacts: [
        {
          factId: "westfield:pharmacy-relationship:distance",
          category: "pharmacy-relationship",
          normalizedStatement: genericFactStatement,
          permittedCopyRole: "pharmacy-relationship",
          prohibitedInference: "not a route",
          sourceClass: "primary",
          publisher: "canonicalPharmacyFacts",
        },
      ],
    }),
  ) as {
    business: { address: string; premisesLocality: string; marketTown: string };
    locality: { areaName: string; selectedReaderArea: string };
    verifiedEditorialFacts: Array<{ statement: string }>;
  };
  record(
    "8k-prompt-sends-canonical-address-and-premises-locality",
    premisesLocalityFromCanonicalAddress(genericAddress) === "Otherton" &&
      genericPrompt.business.address === genericAddress &&
      genericPrompt.business.premisesLocality === "Otherton" &&
      genericPrompt.business.marketTown === "Marketville" &&
      genericPrompt.locality.areaName === "Westfield" &&
      genericPrompt.locality.selectedReaderArea === "Westfield" &&
      genericPrompt.business.premisesLocality !== genericPrompt.business.marketTown &&
      genericPrompt.business.premisesLocality !== genericPrompt.locality.areaName &&
      genericPrompt.verifiedEditorialFacts[0]?.statement === genericFactStatement &&
      genericPrompt.verifiedEditorialFacts[0]?.statement.includes(genericAddress) &&
      !/redactAddressFromStatement/.test(JSON.stringify(genericPrompt)),
    `premises=${genericPrompt.business.premisesLocality} market=${genericPrompt.business.marketTown} area=${genericPrompt.locality.areaName}`,
  );
  const missingPremises = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroHeading: "Pharmacy First in Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "If you are in Wombwell and need help with a minor health concern, Pharmacy First can support you through a pharmacist consultation.",
      localContextHeading: "Access from Wombwell",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell as an approximate straight-line distance."],
      localFaqs: [
        { question: "What happens during a Pharmacy First consultation?", answer: "The pharmacist will review your symptoms." },
        { question: "When should I seek urgent medical care instead?", answer: "Seek urgent medical care for chest pain." },
        { question: "How is a consultation arranged?", answer: "The pharmacist confirms what can be assessed on the day." },
      ],
    }),
    wombwellInput,
  );
  record(
    "8l-wombwell-requires-premises-locality",
    missingPremises.failures.some((f) => /premises locality/i.test(f)),
    missingPremises.failures.join(" | "),
  );
  record(
    "8m-prompt-does-not-force-local-introduction",
    !/write a short pathway sentence/i.test(systemPrompt) &&
      !/write a short pathway sentence/i.test(userPrompt) &&
      /Omit localIntroduction/i.test(systemPrompt) &&
      /omit this field or return an empty string/i.test(userPrompt),
    "v3 prompt allows omitting unused localIntroduction",
  );

  const omittedIntroSource = {
    area: "Wombwell",
    heroHeading: "Pharmacy First in Wombwell",
    heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
    localContextHeading: "Access from Wombwell",
    localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield."],
    relationshipToPharmacy: "The pharmacist confirms what can be assessed on the day.",
    localAccessIntroduction: "If Pharmacy First is not suitable, the pharmacist may advise referral or urgent care.",
    localFaqs: [
      { question: "What happens during a Pharmacy First consultation?", answer: "The pharmacist will review your symptoms." },
      { question: "When should I seek urgent medical care instead?", answer: "Seek urgent medical care for chest pain." },
      { question: "How is a consultation arranged?", answer: "The pharmacist confirms what can be assessed on the day." },
    ],
    localCtaBridge: "Book an appointment or call the pharmacy to discuss your symptoms.",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: [],
  };
  const omittedParsed = parseAiLocalCopyV3(omittedIntroSource);
  const emptyIntroParsed = parseAiLocalCopyV3({ ...omittedIntroSource, localIntroduction: "" });
  const omittedParts = omittedParsed.ok ? aiLocalContextRenderPartsV3(omittedParsed.copy) : { heading: "", bodyParts: [] };
  const omittedHead = omittedParts.heading
    ? `<div class="section-head center"><h2>${omittedParts.heading}</h2><p>${omittedParts.bodyParts[0] || ""}</p></div>`
    : "";
  const omittedRest = omittedParts.bodyParts.slice(1).map((p) => `<p>${p}</p>`).join("");
  const omittedHtml = `${omittedHead}${omittedRest}`;
  record(
    "8n-optional-local-introduction-omitted-cleanly",
    omittedParsed.ok &&
      emptyIntroParsed.ok &&
      omittedParsed.copy.localIntroduction === "" &&
      emptyIntroParsed.copy.localIntroduction === "" &&
      omittedParts.bodyParts.length === 1 &&
      omittedParts.bodyParts[0] === "Yorkshire Pharmacy & Health Clinic is in Darfield." &&
      omittedParts.heading === "Access from Wombwell" &&
      Boolean(omittedHtml) &&
      !/<p>\s*<\/p>/.test(omittedHtml) &&
      !/<h2>\s*<\/h2>/.test(omittedHtml) &&
      !/<div class="section-head center"><\/div>/.test(omittedHtml) &&
      /Yorkshire Pharmacy & Health Clinic is in Darfield/.test(omittedHtml) &&
      /Access from Wombwell/.test(omittedHtml),
    omittedParsed.ok ? `bodyParts=${omittedParts.bodyParts.length}` : omittedParsed.failures.join(" | "),
  );
  const emptyRelationship = parseAiLocalCopyV3({ ...omittedIntroSource, localContextParagraphs: [] });
  record(
    "8n2-pharmacy-relationship-paragraphs-remain-required",
    !emptyRelationship.ok && emptyRelationship.failures.some((f) => /localContextParagraphs/i.test(f)),
    emptyRelationship.ok ? "incorrectly accepted empty relationship" : emptyRelationship.failures.join(" | "),
  );
  const minimalSource = {
    area: "Wombwell",
    heroHeading: "Pharmacy First in Wombwell",
    heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
    localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield, around 1.7 km from Wombwell in a straight line."],
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: ["wombwell:pharmacy-relationship:distance"],
  };
  const minimalParsed = parseAiLocalCopyV3(minimalSource);
  const minimalQuality = minimalParsed.ok ? evaluateAiLocalCopyQualityV3(minimalParsed.copy, wombwellInput) : { ok: false, failures: minimalParsed.failures };
  const emptyFaqsParsed = parseAiLocalCopyV3({ ...minimalSource, localFaqs: [] });
  const omittedSupplemental = parseAiLocalCopyV3(minimalSource);
  record(
    "8q-prompt-does-not-require-clinical-restatement",
    !/Use approved clinical wording: the pharmacist confirms what can be assessed/i.test(userPrompt) &&
      !/3–5 useful local FAQs/i.test(userPrompt) &&
      !/Include when another healthcare route is better/i.test(userPrompt) &&
      /Do not restate consultation process/i.test(systemPrompt) &&
      /Omit relationshipToPharmacy/i.test(systemPrompt) &&
      /No minimum/i.test(userPrompt),
    "v3 prompt no longer forces renderer-owned clinical restatement",
  );
  record(
    "8q2-minimal-local-copy-omitting-supplemental-fields-passes",
    omittedSupplemental.ok &&
      emptyFaqsParsed.ok &&
      emptyFaqsParsed.copy.localFaqs.length === 0 &&
      omittedSupplemental.copy.relationshipToPharmacy === "" &&
      omittedSupplemental.copy.localAccessIntroduction === "" &&
      omittedSupplemental.copy.localFaqs.length === 0 &&
      minimalQuality.ok,
    minimalQuality.ok ? "minimal copy accepted" : minimalQuality.failures.join(" | "),
  );
  const clinicalRestate = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield."],
      relationshipToPharmacy: "The pharmacist confirms what can be assessed on the day.",
      localAccessIntroduction: "If Pharmacy First is not suitable, the pharmacist may advise referral or urgent care.",
      localFaqs: [
        { question: "What happens during a Pharmacy First consultation?", answer: "The pharmacist will review your symptoms." },
      ],
    }),
    wombwellInput,
  );
  record(
    "8q3-renderer-owned-clinical-restatement-fails",
    clinicalRestate.failures.some((f) => /restates renderer-owned clinical copy/i.test(f)),
    clinicalRestate.failures.join(" | "),
  );
  const duplicateKm = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield, around 1.7 km from Wombwell in a straight line."],
      relationshipToPharmacy: "",
      localAccessIntroduction: "",
      localFaqs: [
        { question: "Is the pharmacy in Wombwell?", answer: "The pharmacy is located in Darfield, around 1.7 km from Wombwell in a straight line." },
      ],
      localCtaBridge: "",
    }),
    wombwellInput,
  );
  record(
    "8q4-duplicated-distance-still-fails",
    duplicateKm.failures.some((f) => /repeated distance/i.test(f)),
    duplicateKm.failures.join(" | "),
  );
  const accessSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyServicePageTrustInjection.ts"), "utf8");
  const assembledMinimal =
    minimalParsed.ok
      ? renderAiLocalPagePilotHtmlInMemoryV3({
          slug: YORKSHIRE,
          serviceId: SERVICE,
          areaSlug: "wombwell",
          overlay: aiLocalCopyOverlay(minimalParsed.copy),
        })
      : { ok: false as const, detail: "minimal parse failed", html: "" };
  const assembledHtml = assembledMinimal.ok ? assembledMinimal.html : "";
  record(
    "8q5-assembled-minimal-page-preserves-clinical-and-avoids-empty-gaps",
    assembledMinimal.ok &&
      /options.intro === undefined \? fallbackIntro/.test(accessSrc) &&
      /Pharmacy First can help people in Wombwell/.test(assembledHtml) &&
      /sore throat/i.test(assembledHtml) &&
      /id="faq-section"/.test(assembledHtml) &&
      /faq-q/.test(assembledHtml) &&
      /id="local-access"/.test(assembledHtml) &&
      /01226 210477/.test(assembledHtml) &&
      /pharmacy-first/.test(assembledHtml) &&
      !/<h2>\s*<\/h2>/.test(assembledHtml) &&
      !/<p class="local-intro-lead">\s*<\/p>/.test(assembledHtml) &&
      !/Patients in Wombwell can access NHS Pharmacy First at the pharmacy by calling/.test(assembledHtml) &&
      /Yorkshire Pharmacy &amp; Health Clinic is in Darfield/.test(assembledHtml),
    assembledMinimal.ok
      ? `htmlChars=${assembledHtml.length} faqs=${(assembledHtml.match(/faq-q/g) || []).length}`
      : assembledMinimal.detail,
  );

  const nearestCopy = baseCopy({
    area: "Wombwell",
    heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
    localIntroduction: "",
    localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield."],
    localFaqs: [
      {
        question: "Where is the nearest Pharmacy First location to Wombwell?",
        answer: "Yorkshire Pharmacy & Health Clinic is the closest Pharmacy First site.",
      },
      { question: "What happens during a Pharmacy First consultation?", answer: "The pharmacist will review your symptoms." },
      { question: "When should I seek urgent medical care instead?", answer: "Seek urgent medical care for chest pain." },
    ],
  });
  const nearestGround = groundAiLocalCopyClaimsV3(nearestCopy, wombwellInput, []);
  record(
    "8o-unsupported-nearest-closest-claims-fail",
    nearestGround.failures.some((f) => /nearest or closest/i.test(f)),
    nearestGround.failures.join(" | "),
  );

  const stackedDefects = validateAiLocalCopyPilotV3(
    baseCopy({
      area: "Wombwell",
      heroHeading: "Pharmacy First in Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "Wombwell has a National Rail station.",
      localContextHeading: "Access from Wombwell",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell."],
      localFaqs: [
        {
          question: "Where is the nearest Pharmacy First location to Wombwell?",
          answer: "Yorkshire Pharmacy & Health Clinic is the closest Pharmacy First site.",
        },
        { question: "What happens during a Pharmacy First consultation?", answer: "The pharmacist will review your symptoms." },
        { question: "When should I seek urgent medical care instead?", answer: "Seek urgent medical care for chest pain." },
      ],
    }),
    wombwellInput,
    [],
  );
  record(
    "8p-rejection-records-include-all-detected-defects",
    !stackedDefects.ok &&
      stackedDefects.failures.some((f) => /does not help the reader understand the pharmacy/i.test(f)) &&
      stackedDefects.failures.some((f) => /nearest or closest/i.test(f)) &&
      stackedDefects.failures.some((f) => /approximate straight-line/i.test(f)),
    stackedDefects.failures.join(" | "),
  );

  const rawLabel = baseCopy({
    localIntroduction: "Dr C Liley - Worsbrough Health Centre the Dove Valley Practice is nearby.",
  });
  const rawCheck = evaluateAiLocalCopyQualityV3(rawLabel, promptInput);
  record("9-raw-provider-labels-fail", rawCheck.failures.some((f) => /raw provider/i.test(f)), rawCheck.failures.join(" | "));

  const routeCopy = baseCopy({
    localContextParagraphs: ["The station can help orient you towards Darfield."],
  });
  const routeCheck = evaluateAiLocalCopyQualityV3(routeCopy, promptInput);
  const routeGround = groundAiLocalCopyClaimsV3(routeCopy, promptInput, [fact]);
  record(
    "10-route-implications-fail",
    routeCheck.failures.some((f) => /route/i.test(f)) || routeGround.failures.some((f) => /route/i.test(f)),
    [...routeCheck.failures, ...routeGround.failures].join(" | "),
  );

  const listCopy = baseCopy({
    localIntroduction:
      "Wombwell Medical Centre, Chapelfield Medical Centre and another Health Centre sit around the town with the Library nearby.",
  });
  const listCheck = evaluateAiLocalCopyQualityV3(listCopy, promptInput);
  record("11-entity-lists-fail", listCheck.failures.some((f) => /entity list/i.test(f)), listCheck.failures.join(" | "));

  const fillerCopy = baseCopy({
    localIntroduction: "These practices help shape the healthcare landscape for residents.",
  });
  const fillerCheck = evaluateAiLocalCopyQualityV3(fillerCopy, promptInput);
  record("12-generic-filler-fails", fillerCheck.failures.some((f) => /filler/i.test(f)), fillerCheck.failures.join(" | "));

  const fillerAmenities = evaluateAiLocalCopyQualityV3(
    baseCopy({
      localIntroduction: "Darfield has a public library, reflecting the area’s local amenities alongside healthcare services.",
    }),
    promptInput,
  );
  record(
    "12b-library-filler-fails",
    fillerAmenities.failures.some((f) => /filler/i.test(f)),
    fillerAmenities.failures.join(" | "),
  );
  const gpAlt = evaluateAiLocalCopyQualityV3(
    baseCopy({
      localFaqs: [
        { question: "When should I use my GP practice instead?", answer: "Contact a GP practice such as Wombwell Medical Centre." },
        { question: "What happens during a Pharmacy First consultation?", answer: "The pharmacist confirms what can be assessed." },
        { question: "Should I call ahead?", answer: "Call before visiting to check how a consultation is being arranged." },
      ],
    }),
    promptInput,
  );
  record(
    "12c-gp-alternative-fails",
    gpAlt.failures.some((f) => /GP-alternative/i.test(f)),
    gpAlt.failures.join(" | "),
  );
  const repeatFacts = evaluateAiLocalCopyQualityV3(
    baseCopy({
      heroIntroduction: "Wombwell is served by a National Rail station and NHS general practice services are available from Wombwell Medical Centre.",
      localIntroduction: "Wombwell Medical Centre delivers NHS general practice services locally, and the area is also connected by its own National Rail station.",
    }),
    promptInput,
  );
  record(
    "12d-repeated-local-facts-fail",
    repeatFacts.failures.some((f) => /repetitive facts/i.test(f)),
    repeatFacts.failures.join(" | "),
  );

  const repeatCopy = baseCopy({
    heroIntroduction: "Visit Yorkshire Pharmacy & Health Clinic at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK.",
    localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK."],
  });
  const repeatCheck = evaluateAiLocalCopyQualityV3(repeatCopy, promptInput);
  record(
    "13-repeated-address-contact-distance-fails",
    repeatCheck.failures.some((f) => /repeated address/i.test(f)),
    repeatCheck.failures.join(" | "),
  );
  const phoneOnce = evaluateAiLocalCopyQualityV3(
    baseCopy({
      localAccessIntroduction: `Call ${PHONE} before visiting to check how a consultation is being arranged.`,
      localFaqs: [
        { question: "How far is the pharmacy from Darfield?", answer: "The pharmacy is in Darfield." },
        { question: "What if Pharmacy First is not right for me?", answer: "The pharmacist confirms what can be assessed and may advise referral." },
        { question: "What happens during a consultation?", answer: "The pharmacist will review your symptoms." },
      ],
    }),
    promptInput,
  );
  const assembledRepeat = analyseRepetitionV3(
    baseCopy({
      localAccessIntroduction: `Call ${PHONE} before visiting to check how a consultation is being arranged.`,
      localFaqs: [
        { question: "How far is the pharmacy from Darfield?", answer: "The pharmacy is in Darfield." },
        { question: "What if Pharmacy First is not right for me?", answer: "The pharmacist confirms what can be assessed and may advise referral." },
        { question: "What happens during a consultation?", answer: "The pharmacist will review your symptoms." },
      ],
    }),
    promptInput,
  );
  record(
    "13b-assembled-page-counts-renderer-contact",
    phoneOnce.failures.some((f) => /repeated contact/i.test(f)) &&
      assembledRepeat.failures.some((f) => /repeated contact/i.test(f)) &&
      assembledRepeat.telephoneMentions >= 2,
    [...phoneOnce.failures, ...assembledRepeat.failures].join(" | "),
  );

  record(
    "14-clinical-copy-outside-ai-control",
    /do not rewrite locked clinical facts/i.test(systemPrompt) &&
      /seven conditions|condition set/i.test(systemPrompt),
    "v3 prompt keeps clinical copy locked",
  );

  const engineSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts"), "utf8");
  record(
    "15-failed-enrichment-produces-no-ai-pilot",
    /sufficiency\.status !== "READY"/.test(engineSrc) && /EVIDENCE LIMITED/.test(engineSrc) && /wrote: false/.test(engineSrc),
    "engine refuses generation when editorial sufficiency is limited",
  );

  record(
    "16-failed-ai-validation-writes-no-pilot",
    /if \(!result\?\.ok \|\| !result\.copy/.test(engineSrc) &&
      /writeRecord/.test(engineSrc) &&
      engineSrc.indexOf("if (!result?.ok") < engineSrc.indexOf("fs.writeFileSync(file"),
    "validation failure returns before write",
  );
  record(
    "16b-raw-openai-response-stored-on-record",
    /rawOpenAiResponse: result\.raw/.test(engineSrc) && /rawOpenAiResponses: capturedRaws/.test(engineSrc),
    "engine persists the raw OpenAI response on the pilot record",
  );
  record(
    "16c-discipline-does-not-rewrite-location-sentences",
    !/The pharmacy is not in \$\{input\.locality\.areaName\}/.test(engineSrc) &&
      !/dropLaterKm/.test(engineSrc) &&
      !/dropLaterCall/.test(engineSrc),
    "v3 discipline no longer silently rewrites kilometre or call-ahead sentences",
  );
  const kmKept = enforceEditorialDisciplineV3(
    baseCopy({
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell."],
      localFaqs: [
        {
          question: "Is Yorkshire Pharmacy & Health Clinic located in Wombwell?",
          answer: "Yorkshire Pharmacy & Health Clinic is not in Wombwell, but is 1.7 km away.",
        },
        { question: "What happens during a Pharmacy First consultation?", answer: "The pharmacist will review your symptoms." },
        { question: "When should I seek urgent medical care instead?", answer: "Seek urgent medical care for chest pain." },
      ],
    }),
    promptInput,
  );
  record(
    "16d-later-km-sentence-preserved-for-rejection",
    /1\.7 km away/.test(kmKept.localFaqs[0]!.answer),
    kmKept.localFaqs[0]!.answer,
  );

  const sanitizedAttempt = sanitizeAiLocalAttemptPayloadV3({
    model: "gpt-test",
    apiKey: "sk-secretvalue0001",
    authorization: "Bearer sk-secretvalue0001",
    messages: [{ role: "user", content: "plain prompt without secrets" }],
  });
  const sanitizedText = JSON.stringify(sanitizedAttempt);
  const attemptFile = persistAiLocalAttemptLogV3({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaSlug: "wombwell",
    attemptNumber: 99,
    request: {
      model: "gpt-test",
      apiKey: "sk-secretvalue0001",
      messages: [{ role: "user", content: "plain prompt without secrets" }],
    },
    rawResponse: "{\"area\":\"Wombwell\"}",
    validationResult: { ok: false, failures: ["fixture-validation"] },
    copy: null,
  });
  const attemptBody = fs.existsSync(attemptFile) ? fs.readFileSync(attemptFile, "utf8") : "";
  const candidateUnchangedByAttemptLog =
    !attemptFile.includes("/pharmacy-ai-local-copy-pilots/") &&
    attemptFile.includes(AI_LOCAL_COPY_ATTEMPT_LOG_DIRNAME) &&
    attemptFile !== aiLocalCopyPilotPath(YORKSHIRE, SERVICE, "wombwell", AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
  record(
    "16e-failed-attempts-persist-sanitized-request",
    /sanitizeAiLocalAttemptPayloadV3/.test(engineSrc) &&
      /persistAiLocalAttemptLogV3/.test(engineSrc) &&
      engineSrc.includes("persistAiLocalAttemptLogV3") &&
      /if \(!result\?\.ok \|\| !result\.copy/.test(engineSrc) &&
      engineSrc.indexOf("persistAiLocalAttemptLogV3") < engineSrc.indexOf("if (!result?.ok") &&
      !sanitizedText.includes("sk-secretvalue0001") &&
      !sanitizedText.includes("apiKey") &&
      sanitizedText.includes("plain prompt without secrets") &&
      candidateUnchangedByAttemptLog &&
      attemptFile.startsWith(path.dirname(aiLocalCopyAttemptLogPath(YORKSHIRE, SERVICE, "wombwell", "placeholder"))) &&
      attemptBody.includes("fixture-validation") &&
      attemptBody.includes("rawResponse") &&
      attemptBody.includes("sanitizedRequest") &&
      !attemptBody.includes("sk-secretvalue0001") &&
      !attemptBody.includes("apiKey"),
    attemptFile.replace(`${ROOT}/`, ""),
  );
  record(
    "16f-failed-attempts-keep-all-validation-failures",
    !/const human = inspectWombwellHeroCopyFix/.test(engineSrc) &&
      /validateAiLocalCopyPilotV3\(/.test(engineSrc) &&
      engineSrc.indexOf("const validated = validateAiLocalCopyPilotV3") < engineSrc.indexOf("Wombwell copy rejected before accept"),
    "engine records the full validation failure list",
  );
  if (fs.existsSync(attemptFile)) fs.unlinkSync(attemptFile);

  const previewSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineReviewCentrePreviewService.ts"), "utf8");
  const assemblerSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts"), "utf8");
  record(
    "17-preview-never-makes-external-calls",
    !/searchNationalGoogleOrganic|getOpenAiIntegrationClient|generateAiLocalCopyPilotV3|collectEditorialEvidence/.test(previewSrc) &&
      !/getOpenAiIntegrationClient|searchNationalGoogleOrganic/.test(assemblerSrc),
    "preview and assembler are read/render only",
  );

  const parsedOk = parseAiLocalCopyV3(baseCopy());
  record("schema-v3-parses", parsedOk.ok, parsedOk.ok ? "ok" : parsedOk.failures.join(" | "));

  const drafts = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Wombwell | National Rail",
    text: "Wombwell station is a National Rail station in South Yorkshire.",
    sourceClass: "primary",
    publisher: "National Rail",
    host: "nationalrail.co.uk",
  });
  record(
    "extract-station-fact",
    drafts.some((d) => /National Rail station/.test(d.normalizedStatement)),
    drafts.map((d) => d.normalizedStatement).join(" | "),
  );

  record(
    "extract-html-entities-decoded",
    decodeHtmlEntities("Barnsley &#x2013; the place of possibilities") === "Barnsley – the place of possibilities",
    decodeHtmlEntities("Barnsley &#x2013; the place of possibilities"),
  );
  const homepageNoArea = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Barnsley &#x2013; the place of possibilities",
    text: "Welcome to Barnsley Council.",
    sourceClass: "primary",
    publisher: "barnsley.gov.uk",
    host: "barnsley.gov.uk",
  });
  record(
    "extract-geographic-match-still-requires-area",
    homepageNoArea.length === 0,
    homepageNoArea.map((d) => d.normalizedStatement).join(" | ") || "no drafts",
  );
  record(
    "extract-nhs-home-dash-title",
    extractCustomerFacingNhsName("Home - Wombwell Medical Centre", "Wombwell") === "Wombwell Medical Centre",
    String(extractCustomerFacingNhsName("Home - Wombwell Medical Centre", "Wombwell")),
  );
  record(
    "extract-nhs-prefers-health-centre",
    extractCustomerFacingNhsName("The Kakoty Practice Worsbrough Health Centre - NHS", "Worsbrough") ===
      "Worsbrough Health Centre",
    String(extractCustomerFacingNhsName("The Kakoty Practice Worsbrough Health Centre - NHS", "Worsbrough")),
  );
  record(
    "extract-hyphenated-mill-host-is-not-authority",
    mill.class === "rejected" && mill.reason === "not-authoritative-primary" && isOfficialNamedMillHost("worsbrough-mill.com"),
    `${mill.class}:${mill.reason}`,
  );
  const millComDrafts = extractEditorialFactDrafts({
    areaName: "Worsbrough",
    title: "Country Park",
    text: "Worsbrough Mill Country Park is a working mill and museum in Worsbrough.",
    sourceClass: "primary",
    publisher: "worsbrough-mill.com",
    host: "worsbrough-mill.com",
  });
  record(
    "extract-mill-com-host-does-not-authorise-fact",
    millComDrafts.length === 0,
    millComDrafts.map((d) => d.normalizedStatement).join(" | ") || "no drafts",
  );
  const millGovDrafts = extractEditorialFactDrafts({
    areaName: "Worsbrough",
    title: "Worsbrough Mill",
    text: "Worsbrough Mill Country Park is a working mill and museum in Worsbrough.",
    sourceClass: "primary",
    publisher: "historicengland.org.uk",
    host: "historicengland.org.uk",
  });
  record(
    "extract-mill-from-verified-heritage-publisher",
    millGovDrafts.some((d) => /Worsbrough Mill Country Park/.test(d.normalizedStatement)),
    millGovDrafts.map((d) => d.normalizedStatement).join(" | "),
  );
  const titleOnly = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Home - Wombwell Medical Centre",
    text: "Home - Wombwell Medical Centre",
    sourceClass: "primary",
    publisher: "NHS",
    host: "wombwellmedicalcentre.nhs.uk",
  });
  record(
    "extract-requires-page-body-not-title-alone",
    titleOnly.length === 0,
    titleOnly.map((d) => d.normalizedStatement).join(" | ") || "no drafts from title-only",
  );
  const millFromUrlOnly = extractEditorialFactDrafts({
    areaName: "Worsbrough",
    title: "https://www.worsbrough-mill.com/",
    text: "",
    sourceClass: "primary",
    publisher: "worsbrough-mill.com",
    host: "worsbrough-mill.com",
  });
  record(
    "extract-does-not-invent-mill-from-url-only",
    !millFromUrlOnly.some((d) => /Mill Country Park/.test(d.normalizedStatement)),
    millFromUrlOnly.map((d) => d.normalizedStatement).join(" | ") || "no mill fact from URL-only title",
  );

  const genResult = await runPharmacyAiLocalEditorialEvidencePilotV3({
    force: false,
    assembleAreaSlugs: [],
    skipGeneration: true,
    skipCollection: true,
    areaSlugs: ["darfield", "wombwell", "worsbrough"],
  });
  const packs = genResult.collection.packs;
  record(
    "collection-three-areas-only",
    packs.every((p) => (EDITORIAL_PILOT_AREAS as readonly string[]).includes(p.areaSlug)) &&
      !packs.some((p) => !["darfield", "wombwell", "worsbrough"].includes(p.areaSlug)),
    packs.map((p) => `${p.areaSlug}:${p.sufficiency.status}`).join(", "),
  );
  record(
    "collection-queries-disambiguated",
    packs.every((p) => p.searches.every((s) => s.disambiguated && s.query.toLowerCase() !== p.area.toLowerCase())),
    `searches=${packs.reduce((n, p) => n + p.searches.length, 0)}`,
  );
  record(
    "collection-provenance",
    packs.every((p) =>
      p.facts.filter((f) => f.validationStatus === "accepted").every((f) => f.sourceUrl && f.publisher && f.retrievedAt && f.prohibitedInference),
    ),
    `facts=${packs.map((p) => p.facts.length).join(",")}`,
  );
  record(
    "collection-pages-capped",
    packs.every((p) => p.retrievedPages.length <= 3 && p.searches.length <= 3),
    packs.map((p) => `${p.areaSlug}:s${p.searches.length}/p${p.retrievedPages.length}`).join(" "),
  );

  const ready = packs.filter((p) => p.sufficiency.status === "READY");
  const records = genResult.records;
  record(
    "ready-areas-have-pilots-or-skip",
    ready.every((p) => records.some((r) => r.areaSlug === p.areaSlug) || genResult.skipped.some((s) => s.areaSlug === p.areaSlug)),
    `ready=${ready.length} records=${records.length}`,
  );
  record(
    "limited-areas-have-no-pilot",
    packs
      .filter((p) => p.sufficiency.status === "EVIDENCE LIMITED")
      .every((p) => !fs.existsSync(aiLocalCopyPilotPath(YORKSHIRE, SERVICE, p.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3))),
    packs.filter((p) => p.sufficiency.status === "EVIDENCE LIMITED").map((p) => p.areaSlug).join(",") || "none limited",
  );

  for (const row of records) {
    const hay = flattenAiLocalCopyText(row.outputCopy);
    record(
      `pilot-${row.areaSlug}-quality`,
      row.validationResult.ok &&
        !/Dr C Liley|healthcare landscape|orient you towards|residents can access/i.test(hay),
      `factsUsed=${row.outputCopy.editorialFactIdsUsed.length}`,
    );
  }
  const wombwellPilot = records.find((row) => row.areaSlug === "wombwell") || loadAiLocalCopyPilotV3(YORKSHIRE, SERVICE, "wombwell");
  record(
    "wombwell-raw-openai-response-retained",
    Boolean(wombwellPilot?.rawOpenAiResponse && wombwellPilot.rawOpenAiResponse.includes("{") && wombwellPilot.rawOpenAiResponse.length > 40),
    wombwellPilot?.rawOpenAiResponse ? `rawChars=${wombwellPilot.rawOpenAiResponse.length}` : "missing wombwell pilot raw response",
  );

  const fps = records.map((row) =>
    stripIdentityTokens(localNarrativeFingerprint(row.outputCopy), {
      pharmacyName: PHARMACY,
      areaName: row.areaName,
      telephone: PHONE,
      address: ADDRESS,
      distanceLabel: "",
      siblingAreaNames: [],
    }),
  );
  const pairs: string[] = [];
  let semanticOk = records.length >= 2;
  for (let i = 0; i < fps.length; i += 1) {
    for (let j = i + 1; j < fps.length; j += 1) {
      const score = copySimilarityScore(fps[i]!, fps[j]!);
      pairs.push(`${records[i]!.areaSlug}/${records[j]!.areaSlug}=${score.toFixed(3)}`);
      if (score > 0.8) semanticOk = false;
    }
  }
  record("semantic-differentiation", semanticOk || records.length < 2, pairs.join(" ") || "insufficient pilots");

  const previewResults = ["darfield", "wombwell", "worsbrough"].map((area) =>
    renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET, { areaSlug: area }),
  );
  const unknown = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET, {
    areaSlug: "chapeltown",
  });
  const sections = getContentPackageReviewSections(YORKSHIRE, SERVICE);
  const previewOk = records.every((row) => {
    const p = previewResults.find((_, i) => ["darfield", "wombwell", "worsbrough"][i] === row.areaSlug);
    return p && p.sourceRoute === "ai-local-area-page-pilot-v3" && p.html.includes(AI_PILOT_V3_PREVIEW_BANNER) && /noindex,\s*nofollow/i.test(p.html);
  });
  record(
    "preview-v3-read-only",
    previewOk &&
      unknown.sourceRoute === "review-preview-ai-pilot-v3-unavailable" &&
      !sections.some((sec) => String(sec.type || "").includes("pilot-v3")),
    `unknown=${unknown.sourceRoute} banner=${AI_PILOT_V3_PREVIEW_BANNER}`,
  );

  const savedAttemptPath = path.join(
    ROOT,
    "data/pharmacy-ai-local-copy-attempt-logs",
    YORKSHIRE,
    SERVICE,
    "v3",
    "wombwell",
    "2026-09-01T09-49-22-866Z-attempt-1.json",
  );
  const savedAttempt = fs.existsSync(savedAttemptPath)
    ? (JSON.parse(fs.readFileSync(savedAttemptPath, "utf8")) as { rawResponse?: string })
    : { rawResponse: "" };
  const wombwellEditorial = loadEditorialEvidencePack(YORKSHIRE, SERVICE, "wombwell");
  const replayInput = wombwellEditorial
    ? buildPharmacyAiLocalCopyInputV3({
        slug: YORKSHIRE,
        serviceId: SERVICE,
        areaName: "Wombwell",
        areaSlug: "wombwell",
        editorial: wombwellEditorial,
      })
    : null;
  const replayParsed = parseAiLocalCopyV3(savedAttempt.rawResponse || "");
  const replayCopy =
    replayParsed.ok && replayInput ? enforceEditorialDisciplineV3(replayParsed.copy, replayInput) : null;
  const replayed =
    replayCopy && replayInput && wombwellEditorial
      ? validateAiLocalCopyPilotV3(replayCopy, replayInput, wombwellEditorial.facts)
      : { ok: false, failures: ["replay-setup-failed"] };
  record(
    "21-replay-saved-wombwell-attempt-without-editing-response",
    Boolean(replayParsed.ok && replayCopy) &&
      String(savedAttempt.rawResponse).includes("around 1.7 km from Wombwell in a straight line") &&
      String(savedAttempt.rawResponse).includes("You do not need to see a GP to use this NHS service.") &&
      replayed.failures.includes("ungrounded factual sentence: You do not need to see a GP to use this NHS service.") &&
      replayed.failures.includes("repeated distance guidance") &&
      !replayed.failures.some((f) => /distance must be identified as approximate straight-line/i.test(f)) &&
      replayed.ok === false,
    replayed.failures.join(" | "),
  );
  const appSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/app.ts"), "utf8");
  const healthSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/health.ts"), "utf8");
  record(
    "22-health-json-handler-registered-before-spa",
    /res\.json\(\{\s*status:\s*"ok"\s*\}\)/.test(healthSrc) &&
      /app\.use\(healthRouter\)/.test(appSrc) &&
      appSrc.indexOf("app.use(healthRouter)") < appSrc.indexOf("/*splat") &&
      !/res\.redirect\(302, "\/health"/.test(appSrc),
    "GET /health uses registered JSON handler, not SPA fallback",
  );

  const after = snapshotProtected();
  const mutated: string[] = [];
  for (const [file, hash] of before) {
    if (!after.has(file) || after.get(file) !== hash) mutated.push(path.relative(ROOT, file));
  }
  for (const [file] of after) {
    if (
      !before.has(file) &&
      !file.includes("/pharmacy-ai-local-page-pilots/") &&
      !file.includes("/pharmacy-ai-local-copy-pilots/") &&
      !file.includes("/pharmacy-local-editorial-evidence-pilots/")
    ) {
      mutated.push(path.relative(ROOT, file));
    }
  }
  record(
    "18-existing-candidates-unchanged",
    mutated.filter((f) => f.includes("pharmacy-ai-local-copy-candidates") || f.includes("pharmacy-ai-local-page-candidates") || f.includes("/v2/")).length === 0,
    mutated.filter((f) => f.includes("pharmacy-ai-local")).join(",") || "candidates unchanged",
  );
  record(
    "19-authoritative-outputs-unchanged",
    mutated.filter((f) => f.includes("pharmacy-content-ecosystem") || f.includes("pharmacy-visual-experience") || f.includes("pharmacy-local-page-candidates")).length === 0,
    mutated.filter((f) => f.includes("output/")).join(",") || "authoritative unchanged",
  );
  record(
    "20-campaign-review-approval-unchanged",
    mutated.filter((f) => f.includes("campaign-builder") || f.includes("review-centre") || f.includes("campaign-approvals") || f.endsWith("package.json")).length === 0,
    mutated.filter((f) => f.includes("growth-engine") || f.includes("approvals") || f.includes("package.json")).join(",") || "state unchanged",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\nFOCUSED TESTS ${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length}`);
  if (failed.length) {
    for (const row of failed) console.error(`  ${row.id}: ${row.detail}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg.replace(/sk-[A-Za-z0-9_\-]+/g, "[redacted]"));
  process.exit(1);
});
