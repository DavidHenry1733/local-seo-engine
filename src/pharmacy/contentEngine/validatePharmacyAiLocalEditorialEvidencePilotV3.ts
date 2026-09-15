#!/usr/bin/env npx tsx
/**
 * Focused tests — Pharmacy local editorial-evidence and AI v3 pilots (Prompt 95).
 * Run: npx tsx src/pharmacy/contentEngine/validatePharmacyAiLocalEditorialEvidencePilotV3.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
  buildAiLocalNarrativeSystemPromptV3,
  buildAiLocalNarrativeUserPromptV3,
  buildAiLocalNarrativeWritingBriefV3,
  buildRendererOwnedHeroIntroductionV3,
  buildRendererOwnedLocalIntroductionV3,
  buildRendererOwnedRelationshipToPharmacyV3,
  premisesLocalityFromCanonicalAddress,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3, type AiLocalCopyV3, flattenAiLocalCopyText, aiLocalContextRenderPartsV3, aiLocalCopyOverlay } from "./pharmacyAiLocalCopySchemaV1.ts";
import { groundAiLocalCopyClaimsV3 } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { evaluateAiLocalCopyQualityV3, inspectWombwellLocalRecognitionV3, localNarrativeFingerprint, sentenceIdentifiesApproximateStraightLineKm } from "./pharmacyAiLocalCopyQualityV1.ts";
import { evaluateGrammarAndFragments } from "./pharmacyLocalCandidateReadabilityV1.ts";
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
  placesEntityNormalizedStatement,
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
  authorizedTaskBudgetPathV3,
  loadAuthorizedTaskBudgetV3,
} from "./pharmacyAiLocalNarrativeEngineV3.ts";
import { runPharmacyAiLocalEditorialEvidencePilotV3 } from "./runPharmacyAiLocalEditorialEvidencePilotV3.ts";
import { renderAiLocalPagePilotHtmlInMemoryV3 } from "../pharmacyAiLocalPagePilotAssemblerV3.ts";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  AI_LOCAL_REVISION_COMPARISON_V3_ASSET,
  AI_LOCAL_REVISION_COMPARISON_BANNER,
  AI_LOCAL_STRATEGY_VARIANT_V3_ASSET,
  AI_LOCAL_STRATEGY_VARIANT_BANNER,
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
import { BROOK_SALES_DEMO_IDENTITY } from "../pharmacySalesDemoBrookServicePreview.ts";
import { salesDemoBrookDerbyAreaNames } from "../pharmacySalesDemoBrookDerbyAreaSelection.ts";
import { WOMBWELL_REVISION_COMPARISON_CATALOG } from "../pharmacyAiLocalRevisionComparisonPreviewV3.ts";
import { STRATEGY_VARIANT_COMPARISON_AREAS } from "../pharmacyAiLocalStrategyVariantPreviewV3.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import { stripIdentityTokens } from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { getContentPackageReviewSections } from "../pharmacyContentPackageService.ts";
import { loadEditorialEvidencePack } from "./pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { planPharmacyLocalEvidenceRequest } from "./pharmacyLocalEvidencePackContractV1.ts";
import { polishCommercialClusterPublicHtml } from "./pharmacyCommercialNarrativePolishV1.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const BROOK = "brook-pharmacy-demo-derby";
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
  const wombwellBrief = buildAiLocalNarrativeWritingBriefV3("Wombwell");
  const wombwellSystemPrompt = buildAiLocalNarrativeSystemPromptV3("pharmacy", "Wombwell");
  record(
    "8-ai-receives-only-verified-facts",
    AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3 === "pharmacy-ai-local-narrative-prompt-v3" &&
      AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3 === "v3" &&
      userPrompt.includes(fact.normalizedStatement) &&
      userPrompt.includes(fact.factId) &&
      !userPrompt.includes("Dr C Liley") &&
      /do not print fact IDs/i.test(systemPrompt),
    "v3 prompt contract sends verified facts only",
  );
  record(
    "8b-prompt-hero-leads-with-pharmacy-first",
    /Do not write heroIntroduction or relationshipToPharmacy/i.test(wombwellBrief) &&
      /Do not write heroIntroduction or relationshipToPharmacy/i.test(wombwellSystemPrompt) &&
      /deterministic and assembled from confirmed structured values/i.test(wombwellBrief) &&
      !/If the station fact is used/i.test(wombwellSystemPrompt) &&
      !/write only: the area has a National Rail station/i.test(wombwellSystemPrompt) &&
      !/write only: the area has a National Rail station/i.test(userPrompt),
    "v3 prompt does not ask OpenAI to compose renderer-owned hero or relationship fields",
  );
  record(
    "8b2-prompt-brief-corrections",
    !/travelling to Darfield/i.test(wombwellSystemPrompt) &&
      !/"travelling to Darfield"/.test(userPrompt) &&
      /Write connected local passages, not isolated sentences or a list of places/i.test(wombwellBrief) &&
      /Do not force every supplied fact into the page/i.test(wombwellBrief) &&
      /Do not write heroIntroduction or relationshipToPharmacy/i.test(wombwellBrief) &&
      /Do not invent travel, parking, opening-hours, availability or treatment promises/i.test(wombwellBrief) &&
      /Do not claim the author lives locally/i.test(wombwellBrief) &&
      /Keep named organisations, boards or groups from those statements/i.test(wombwellBrief) &&
      /distinct local identity/i.test(wombwellBrief) &&
      userPrompt.includes(buildAiLocalNarrativeWritingBriefV3("Darfield")) &&
      !/help readers recognise their area/i.test(wombwellSystemPrompt) &&
      !/There is no word quota/i.test(wombwellSystemPrompt),
    "v3 prompt is one coherent writing brief",
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
    !wombwellStationCopy.failures.some((f) => /does not help the reader understand the pharmacy/i.test(f)),
    wombwellStationCopy.failures.join(" | ") || "station as local character is not an access-only landmark failure",
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
    !/write a short pathway sentence/i.test(wombwellSystemPrompt) &&
      !/write a short pathway sentence/i.test(userPrompt) &&
      /Write localIntroduction as 150 to 250 words/i.test(wombwellBrief) &&
      /Why Wombwell patients start with the pharmacist/i.test(wombwellBrief) &&
      /evidenceClaims\.editorialFactId/i.test(wombwellSystemPrompt) &&
      /editorialFactId/i.test(userPrompt),
    "v3 prompt asks OpenAI to write localIntroduction from verified facts in the assigned structure",
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
    "8n2-empty-local-context-paragraphs-may-be-omitted",
    emptyRelationship.ok === true && emptyRelationship.copy.localContextParagraphs.length === 0,
    emptyRelationship.ok ? "empty localContextParagraphs omitted" : emptyRelationship.failures.join(" | "),
  );
  const minimalSource = {
    area: "Wombwell",
    heroHeading: "Pharmacy First in Wombwell",
    heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
    localIntroduction:
      "11,477 people live in Wombwell, about 5% of Barnsley's population. Almost half of homes are semi-detached houses or bungalows.",
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
      /Do not write clinical eligibility, suitability, process, safety, geographic access/i.test(systemPrompt) &&
      /Leave renderer-owned approved clinical content in the template/i.test(wombwellBrief) &&
      /No minimum/i.test(userPrompt),
    "v3 prompt preserves approved clinical content without forcing restatement",
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
  const mixedWardProfile =
    "Central ward profile The central ward is home to 11,115 people, or 4.8% of Barnsley’s total population. Wholesale and retail trades form the largest source of employment at 17.9%. Wombwell ward profile 11,477 people live in Wombwell, or 5% of Barnsley’s total population. Almost half of all homes are semi-detached houses or bungalows. Wholesale and retail trades employ the most workers at 19.8%, followed by construction at 13.2%. Worsbrough ward profile Worsbrough is home to 9,000 people.";
  const wombwellWardDrafts = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Ward profiles",
    text: mixedWardProfile,
    sourceClass: "primary",
    publisher: "barnsley.gov.uk",
    host: "www.barnsley.gov.uk",
  });
  const wombwellWardStatements = wombwellWardDrafts.map((d) => d.normalizedStatement).join(" | ");
  record(
    "8r-ward-profile-extractor-scopes-to-named-ward",
    wombwellWardDrafts.some((d) => /11,477/.test(d.normalizedStatement) && /5%/.test(d.normalizedStatement)) &&
      wombwellWardDrafts.some((d) => /19\.8%/.test(d.normalizedStatement) && /13\.2%/.test(d.normalizedStatement)) &&
      wombwellWardDrafts.some((d) => /semi-detached/.test(d.normalizedStatement)) &&
      !wombwellWardDrafts.some((d) => /11,115|17\.9%/.test(d.normalizedStatement)),
    wombwellWardStatements || "no ward-profile drafts",
  );
  const accessOnlyCopy = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "Yorkshire Pharmacy & Health Clinic is in Darfield, which, like Wombwell, is a ward in Barnsley's South Area Council.",
      localContextParagraphs: ["Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield."],
    }),
    wombwellInput,
  );
  record(
    "8s-wombwell-access-only-copy-fails-recognition",
    accessOnlyCopy.failures.some((f) => /access-only-local-copy|recognisable Wombwell setting/i.test(f)),
    accessOnlyCopy.failures.join(" | "),
  );
  const healthcareSetting = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "NHS general practice services in Wombwell are provided from Wombwell Medical Centre.",
      localContextParagraphs: [
        "11,477 people live in Wombwell, about 5% of Barnsley's population. Almost half of homes are semi-detached houses or bungalows.",
      ],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
    }),
    wombwellInput,
  );
  record(
    "8t-wombwell-healthcare-setting-medical-centre-allowed",
    healthcareSetting.ok &&
      !healthcareSetting.failures.some((f) => /does not help the reader|named GP used without patient value|unsupported route/i.test(f)),
    healthcareSetting.failures.join(" | ") || "healthcare setting accepted",
  );
  const demandClaim = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "11,477 people live in Wombwell. Residents often choose Pharmacy First because poor health means more need.",
      localContextParagraphs: ["Almost half of homes are semi-detached houses or bungalows."],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
    }),
    wombwellInput,
  );
  record(
    "8u-wombwell-demand-claim-fails",
    demandClaim.failures.some((f) => /healthcare demand or treatment choice/i.test(f)),
    demandClaim.failures.join(" | "),
  );
  const repeatedPremises = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "11,477 people live in Wombwell, about 5% of Barnsley's population.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is in Darfield."],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
    }),
    wombwellInput,
  );
  record(
    "8v-premises-locality-not-repeated-across-context-and-access",
    repeatedPremises.failures.some((f) => /premises locality repeated/i.test(f)),
    repeatedPremises.failures.join(" | "),
  );
  const recognisableAccount = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction:
        "11,477 people live in Wombwell, about 5% of Barnsley's population. Almost half of homes are semi-detached houses or bungalows.",
      localContextParagraphs: [
        "Among working adults in Wombwell, wholesale and retail trades are the largest source of employment at 19.8%, followed by construction at 13.2%. NHS general practice services in Wombwell are provided from Wombwell Medical Centre.",
      ],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
    }),
    wombwellInput,
  );
  record(
    "8w-wombwell-recognisable-local-account-passes",
    recognisableAccount.ok,
    recognisableAccount.failures.join(" | ") || "recognisable Wombwell account accepted",
  );
  const libraryFeatures = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "The area also features a public library as a local civic facility.",
      localContextParagraphs: [
        "NHS general practice services in Wombwell are provided from Wombwell Medical Centre.",
      ],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
    }),
    wombwellInput,
  );
  record(
    "8x-library-features-sentence-is-not-a-grammar-failure",
    libraryFeatures.ok && !libraryFeatures.failures.some((f) => /missing a clear verb/i.test(f)),
    libraryFeatures.failures.join(" | ") || "features-as-verb accepted",
  );
  const civicSuchAs = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "Community facilities such as the public library and Wombwell Medical Centre contribute to the area’s civic life.",
      localContextParagraphs: ["11,477 people live in Wombwell, about 5% of Barnsley's population."],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
    }),
    wombwellInput,
  );
  record(
    "8y-civic-such-as-library-and-medical-centre-is-not-gp-alternative",
    !civicSuchAs.failures.some((f) => /GP-alternative/i.test(f)),
    civicSuchAs.failures.join(" | ") || "civic such-as not treated as GP-alternative",
  );
  const roundedPopulation = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "Wombwell is a Barnsley ward with over 11,000 residents.",
      localContextParagraphs: [
        "NHS general practice services in Wombwell are provided from Wombwell Medical Centre.",
      ],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
    }),
    wombwellInput,
  );
  record(
    "8z-natural-rounding-of-supplied-population-is-not-automatic-failure",
    roundedPopulation.ok && !roundedPopulation.failures.some((f) => /generic filler|ungrounded/i.test(f)),
    roundedPopulation.failures.join(" | ") || "natural rounding accepted",
  );
  const sitsGrammar = evaluateGrammarAndFragments(
    "Wombwell sits within the Metropolitan Borough of Barnsley, giving the area a distinct South Yorkshire character.",
  );
  const benefitsGrammar = evaluateGrammarAndFragments(
    "The area also benefits from a public library.",
  );
  record(
    "8x2-sits-and-benefits-are-ordinary-verbs",
    !sitsGrammar.some((f) => /missing a clear verb/i.test(f)) &&
      !benefitsGrammar.some((f) => /missing a clear verb/i.test(f)),
    [...sitsGrammar, ...benefitsGrammar].join(" | ") || "ordinary verbs accepted",
  );
  const communityResourcesStillFiller = evaluateAiLocalCopyQualityV3(
    baseCopy({
      area: "Wombwell",
      heroIntroduction: "Pharmacy First can help people in Wombwell with eligible common conditions.",
      localIntroduction: "The area also benefits from community resources such as a public library.",
      localContextParagraphs: [
        "NHS general practice services in Wombwell are provided from Wombwell Medical Centre.",
      ],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
    }),
    wombwellInput,
  );
  record(
    "8x3-community-resources-filler-still-fails",
    communityResourcesStillFiller.failures.some((f) => /community resources/i.test(f)),
    communityResourcesStillFiller.failures.join(" | "),
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
      /Pharmacy First can help(?: with eligible common conditions)?(?: for)? people in Wombwell/.test(assembledHtml) &&
      /sore throat/i.test(assembledHtml) &&
      /id="faq-section"/.test(assembledHtml) &&
      /faq-q/.test(assembledHtml) &&
      /id="local-access"/.test(assembledHtml) &&
      /01226 210477/.test(assembledHtml) &&
      /pharmacy-first/.test(assembledHtml) &&
      !/<h2>\s*<\/h2>/.test(assembledHtml) &&
      !/<p class="local-intro-lead">\s*<\/p>/.test(assembledHtml) &&
      !/Patients in Wombwell can access NHS Pharmacy First at the pharmacy by calling/.test(assembledHtml) &&
      /Yorkshire Pharmacy &amp; Health Clinic(?: is)? in Darfield/.test(assembledHtml),
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
  record("12-generic-filler-fails", fillerCheck.failures.some((f) => /filler|empty-local-claim|healthcare landscape/i.test(f)), fillerCheck.failures.join(" | "));

  const fillerAmenities = evaluateAiLocalCopyQualityV3(
    baseCopy({
      localIntroduction: "Darfield has a public library, reflecting the area’s local amenities alongside healthcare services.",
    }),
    promptInput,
  );
  record(
    "12b-library-filler-fails",
    fillerAmenities.failures.some((f) => /filler|empty-local-claim|local amenities/i.test(f)),
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
    /Leave renderer-owned approved clinical content in the template/i.test(systemPrompt) &&
      /condition list/i.test(systemPrompt),
    "v3 prompt keeps clinical copy locked",
  );

  const engineSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts"), "utf8");
  record(
    "15-failed-enrichment-produces-no-ai-pilot",
    /assessSavedLocalPageGenerationReadiness/.test(engineSrc) &&
      /!readiness\.canGenerate/.test(engineSrc) &&
      /wrote: false/.test(engineSrc) &&
      !/sufficiency\.status !== "READY"/.test(engineSrc),
    "engine refuses generation when required deterministic facts are missing, not when optional editorial facts are LIMITED",
  );

  record(
    "16-failed-ai-validation-writes-no-pilot",
    /if \(!result\?\.ok \|\| !result\.copy/.test(engineSrc) &&
      /writeRecord/.test(engineSrc) &&
      engineSrc.indexOf("if (!result?.ok || !result.copy") < engineSrc.indexOf("fs.writeFileSync(file, JSON.stringify(record"),
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
  const yourGpKept = enforceEditorialDisciplineV3(
    baseCopy({
      localIntroduction: "Ask your GP if you are unsure.",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK."],
    }),
    promptInput,
  );
  record(
    "16g-discipline-does-not-rewrite-your-gp-or-address",
    yourGpKept.localIntroduction === "Ask your GP if you are unsure." &&
      yourGpKept.localContextParagraphs[0] === "Yorkshire Pharmacy & Health Clinic is at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK.",
    `${yourGpKept.localIntroduction} | ${yourGpKept.localContextParagraphs[0]}`,
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
      /blockingFailures/.test(engineSrc),
    "engine records the full validation failure list",
  );
  if (fs.existsSync(attemptFile)) fs.unlinkSync(attemptFile);

  const previewSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineReviewCentrePreviewService.ts"), "utf8");
  const assemblerSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts"), "utf8");
  const comparisonSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyAiLocalRevisionComparisonPreviewV3.ts"), "utf8");
  const variantSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyAiLocalStrategyVariantPreviewV3.ts"), "utf8");
  const reviewCentreHttpSrc = fs.readFileSync(
    path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngineReviewCentre.ts"),
    "utf8",
  );
  record(
    "17-preview-never-makes-external-calls",
    !/searchNationalGoogleOrganic|getOpenAiIntegrationClient|generateAiLocalCopyPilotV3|collectEditorialEvidence/.test(previewSrc) &&
      !/getOpenAiIntegrationClient|searchNationalGoogleOrganic/.test(assemblerSrc) &&
      !/searchNationalGoogleOrganic|getOpenAiIntegrationClient|generateAiLocalCopyPilotV3|collectEditorialEvidence/.test(comparisonSrc) &&
      !/searchNationalGoogleOrganic|getOpenAiIntegrationClient|generateAiLocalCopyPilotV3|collectEditorialEvidence/.test(variantSrc) &&
      !/assemblePharmacyAiLocalPagePilotsV3/.test(variantSrc),
    "preview, assembler, comparison and strategy-variant preview are read/render only",
  );

  const authoredHero = "Pharmacy First is available to people in Wombwell who need NHS advice or treatment for eligible common conditions.";
  const authoredWhy = "Wombwell Library hosts local history sessions run by Wombwell Heritage Group.";
  const authoredHtml = `<html><head></head><body><main id="main-content">
<section class="hero" data-template-block="hero"><p>${authoredHero}</p></section>
<section id="cluster-context"><div class="section-head"><h2>Why Wombwell patients start with the pharmacist</h2><p>${authoredWhy}</p></div></section>
<section class="soft" id="child-areas" data-template-block="child-areas"><div class="wrap"><div class="section-head center"><h2>How Pharmacy First can help</h2></div>
<p>Pharmacy First is an NHS community pharmacy service.
%%CONSULTATION%%
What happens during the consultation
The pharmacist reviews symptoms.
%%STRATEGY%%
patient-journey-led
%%SECTION_ORDER%%
why,how,conditions,consultation,travel,gp,faq,cta,nearby
%%NEARBY_INTRO%%
Nearby patients can also use the service.
%%TRAVEL%%
Consultations take place at Yorkshire Pharmacy &amp; Health Clinic in Darfield.
%%CTA_FRAME%%
Book An Appointment|||
%%HEADINGS%%
{"why":"Why Wombwell patients start with the pharmacist","how":"How Pharmacy First can help","consultation":"What happens during the consultation"}</p>
</div></section>
<section id="cluster-relevance"><h2>Conditions Pharmacy First may cover</h2><p>sore throat</p></section>
<section id="local-access"><h2>Travelling</h2><p class="local-intro-lead">placeholder</p></section>
</main></body></html>`;
  const preserved = polishCommercialClusterPublicHtml(authoredHtml, {
    areaName: "Wombwell",
    pharmacyName: PHARMACY,
    serviceName: "Pharmacy First",
    nearbyAreaNames: ["Darfield"],
    generationRevision: "ai-local-narrative-v3-pilot",
    preserveAuthoredLocalCopy: true,
  });
  record(
    "17b-preserve-authored-copy-still-splits-markers",
    preserved.includes(authoredHero) &&
      preserved.includes(authoredWhy) &&
      !/%%CONSULTATION%%|%%TRAVEL%%|%%HEADINGS%%/.test(preserved) &&
      /id="cluster-consultation"/.test(preserved) &&
      /Consultations take place at Yorkshire Pharmacy/.test(preserved),
    preserved.includes(authoredHero) && preserved.includes(authoredWhy)
      ? `markers=${/%%[A-Z_]+%%/.test(preserved)} consultSection=${/id="cluster-consultation"/.test(preserved)}`
      : "authored copy rewritten",
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
  const wardDrafts = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Your area council and ward",
    text: "There are six area councils in Barnsley. The Central Area Council covers the Central, Dodworth, Kingstone, Stairfoot and Worsbrough wards. The South Area Council covers the Darfield, Hoyland Milton, Rockingham and Wombwell wards. Email southteam@barnsley.gov.uk.",
    sourceClass: "primary",
    publisher: "barnsley.gov.uk",
    host: "barnsley.gov.uk",
  });
  record(
    "extract-area-council-ward-identity",
    wardDrafts.some((d) => d.normalizedStatement === "Wombwell is a ward in Barnsley's South Area Council.") &&
      !wardDrafts.some((d) => /Central Area Council/.test(d.normalizedStatement)),
    wardDrafts.map((d) => d.normalizedStatement).join(" | "),
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
    "extract-nhs-medical-practice-without-area-in-title",
    extractCustomerFacingNhsName("Appletree Medical Practice - NHS", "Duffield") === "Appletree Medical Practice",
    String(extractCustomerFacingNhsName("Appletree Medical Practice - NHS", "Duffield")),
  );
  const appletreeDrafts = extractEditorialFactDrafts({
    areaName: "Duffield",
    title: "Appletree Medical Practice - NHS",
    text: "Appletree Medical Practice 47A Town Street, Duffield, Belper, Derbyshire, DE56 4GG Information: This GP surgery is currently accepting new patients.",
    sourceClass: "primary",
    publisher: "NHS",
    host: "nhs.uk",
  });
  record(
    "extract-nhs-medical-practice-page-yields-gp-fact",
    appletreeDrafts.some((d) => d.normalizedStatement === "NHS general practice services in Duffield are provided from Appletree Medical Practice."),
    appletreeDrafts.map((d) => d.normalizedStatement).join(" | ") || "no drafts",
  );
  record(
    "places-typed-hospital-does-not-override-named-gp",
    placesEntityNormalizedStatement({
      name: "Appletree Medical Practice",
      category: "healthcare",
      types: ["medical_center", "hospital", "doctor"],
      areaName: "Duffield",
    }) === "NHS general practice services in Duffield are provided from Appletree Medical Practice.",
    placesEntityNormalizedStatement({
      name: "Appletree Medical Practice",
      category: "healthcare",
      types: ["medical_center", "hospital", "doctor"],
      areaName: "Duffield",
    }),
  );
  const parishDrafts = extractEditorialFactDrafts({
    areaName: "Duffield",
    title: "Duffield Parish Council",
    text: "Welcome to Duffield Parish Council. The Parish Council represents the civil parish.",
    sourceClass: "primary",
    publisher: "duffieldparishcouncil.gov.uk",
    host: "duffieldparishcouncil.gov.uk",
  });
  record(
    "extract-parish-council-from-gov-uk",
    parishDrafts.some((d) => d.normalizedStatement === "Duffield has a Parish Council."),
    parishDrafts.map((d) => d.normalizedStatement).join(" | ") || "no drafts",
  );
  const blockedParish = extractEditorialFactDrafts({
    areaName: "Duffield",
    title: "Security Challenge",
    text: "Security Challenge Duffield Parish Council Slide to verify",
    sourceClass: "primary",
    publisher: "duffieldparishcouncil.gov.uk",
    host: "duffieldparishcouncil.gov.uk",
  });
  record(
    "extract-parish-council-skips-security-challenge",
    !blockedParish.some((d) => /Parish Council/i.test(d.normalizedStatement)),
    blockedParish.map((d) => d.normalizedStatement).join(" | ") || "no drafts",
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
  const libraryDrafts = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Wombwell Library",
    text: "Wombwell Library Find us Station Road, Wombwell, Barnsley S73 0BA. Groups and activities Room bookings Local history sessions run by Wombwell Heritage Group. Citizens Advice run advice and welfare rights drop in sessions.",
    sourceClass: "primary",
    publisher: "barnsley.gov.uk",
    host: "barnsley.gov.uk",
  });
  record(
    "extract-library-heritage-group-from-official-body",
    libraryDrafts.some((d) => d.normalizedStatement === "Wombwell Library hosts local history sessions run by Wombwell Heritage Group.") &&
      libraryDrafts.some((d) => d.normalizedStatement === "Citizens Advice runs advice and welfare rights drop-in sessions at Wombwell Library."),
    libraryDrafts.map((d) => d.normalizedStatement).join(" | "),
  );
  const historySocietyDrafts = extractEditorialFactDrafts({
    areaName: "Exampleville",
    title: "Exampleville Library",
    text: "Exampleville Library Other services Exampleville History Society run local history group sessions.",
    sourceClass: "primary",
    publisher: "barnsley.gov.uk",
    host: "barnsley.gov.uk",
  });
  record(
    "extract-library-history-society-from-official-body",
    historySocietyDrafts.some((d) => d.normalizedStatement === "Exampleville History Society runs local history group sessions."),
    historySocietyDrafts.map((d) => d.normalizedStatement).join(" | "),
  );
  const libraryActivityDrafts = extractEditorialFactDrafts({
    areaName: "Exampleville",
    title: "Exampleville Library",
    text: "Exampleville Library Find us Church Street, Exampleville, Barnsley, S73 9LG We run a range of regular activities and special events for children and adults. Other services Exampleville History Society run local history group sessions.",
    sourceClass: "primary",
    publisher: "barnsley.gov.uk",
    host: "barnsley.gov.uk",
  });
  record(
    "extract-library-street-and-regular-activities",
    libraryActivityDrafts.some((d) => d.normalizedStatement === "Exampleville Library is on Church Street.") &&
      libraryActivityDrafts.some((d) => d.normalizedStatement === "Exampleville Library runs regular activities and special events for children and adults."),
    libraryActivityDrafts.map((d) => d.normalizedStatement).join(" | "),
  );
  const listedDrafts = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Church of St Mary, Wombwell, Barnsley - 1151174 | Historic England",
    text: "List Entry Number: 1151174 Grade II Church of St Mary This building is listed under the Planning (Listed Buildings and Conservation Areas) Act 1990. Location Wombwell, Barnsley.",
    sourceClass: "primary",
    publisher: "Historic England",
    host: "historicengland.org.uk",
  });
  record(
    "extract-listed-building-from-historic-england-listing",
    listedDrafts.some((d) => /listed building in Wombwell/.test(d.normalizedStatement) && /Church of St Mary/i.test(d.normalizedStatement)),
    listedDrafts.map((d) => d.normalizedStatement).join(" | "),
  );
  const hubDrafts = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Barnsley - Local Heritage Hub",
    text: "The former Elsecar New Colliery. Wombwell is nearby.",
    sourceClass: "primary",
    publisher: "Historic England",
    host: "historicengland.org.uk",
  });
  record(
    "extract-does-not-take-heritage-hub-as-wombwell-listing",
    !hubDrafts.some((d) => /listed building/.test(d.normalizedStatement)),
    hubDrafts.map((d) => d.normalizedStatement).join(" | ") || "no listing drafts",
  );
  const tsyDrafts = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: "Artwork at Wombwell Station",
    text: "Artwork at Wombwell Station An inspiring new artwork has been unveiled at Wombwell station following a collaboration between SYMCA, Barnsley Council and the town's community. Featuring the distinctive Wombwell “unicorn” emblem and references to the Roly Poly Hill and Wishing Tree at Wombwell Park.",
    sourceClass: "primary",
    publisher: "Travel South Yorkshire",
    host: "travelsouthyorkshire.com",
  });
  record(
    "extract-wombwell-station-artwork-community-facts",
    tsyDrafts.some((d) => /collaboration between SYMCA/.test(d.normalizedStatement)) &&
      tsyDrafts.some((d) => /Roly Poly Hill and Wishing Tree at Wombwell Park/.test(d.normalizedStatement)) &&
      tsyDrafts.some((d) => /unicorn emblem/.test(d.normalizedStatement)),
    tsyDrafts.map((d) => d.normalizedStatement).join(" | "),
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

  const liveWithRevisionIgnored = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET, {
    areaSlug: "wombwell",
    revision: "2026-09-01T14-21Z",
  });
  record(
    "preview-v3-ignores-revision-query",
    liveWithRevisionIgnored.sourceRoute === "ai-local-area-page-pilot-v3" &&
      liveWithRevisionIgnored.html.includes(AI_PILOT_V3_PREVIEW_BANNER) &&
      !liveWithRevisionIgnored.html.includes(AI_LOCAL_REVISION_COMPARISON_BANNER),
    "live Wombwell Preview stays file-based when revision is passed",
  );

  const unknownRevision = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_REVISION_COMPARISON_V3_ASSET, {
    revision: "not-a-saved-revision",
  });
  record(
    "preview-revision-comparison-exact-version",
    unknownRevision.sourceRoute === "review-preview-revision-comparison-unavailable" &&
      unknownRevision.html.includes(AI_LOCAL_REVISION_COMPARISON_BANNER) &&
      /noindex,\s*nofollow/i.test(unknownRevision.html) &&
      /revision:\s*revision/.test(reviewCentreHttpSrc),
    unknownRevision.sourceRoute,
  );

  const comparisonExcerpts: Record<string, string> = {
    "2026-09-01T14-21Z": "hosts local history sessions run by Wombwell Heritage Group",
    "2026-09-01T12-33-31-060Z": "distinct South Yorkshire character",
    "2026-09-01T12-35-43-358Z": "without waiting for a GP appointment",
    "2026-09-01T14-52-41-715Z": "professional help for common health concerns",
    "2026-09-01T14-52-50-988Z": "established routes to healthcare support",
    "leeds-headingley-reference": "Pharmacy First Headingley",
  };
  let comparisonOk = WOMBWELL_REVISION_COMPARISON_CATALOG.length === 6;
  const comparisonDetails: string[] = [];
  for (const row of WOMBWELL_REVISION_COMPARISON_CATALOG) {
    const preview = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_REVISION_COMPARISON_V3_ASSET, {
      revision: row.revisionId,
    });
    const excerpt = comparisonExcerpts[row.revisionId] || "";
    const pass =
      preview.sourceRoute === "ai-local-revision-comparison-v3" &&
      preview.html.includes(AI_LOCAL_REVISION_COMPARISON_BANNER) &&
      /noindex,\s*nofollow/i.test(preview.html) &&
      !preview.html.includes(AI_PILOT_V3_PREVIEW_BANNER) &&
      !/data-approval-control/i.test(preview.html) &&
      !/<button[^>]*>\s*(?:Approve|Publish)\b/i.test(preview.html) &&
      !/<form[^>]*(?:approve|publish)/i.test(preview.html) &&
      Boolean(excerpt) &&
      preview.html.includes(excerpt);
    comparisonOk = comparisonOk && pass;
    comparisonDetails.push(`${row.revisionId}:${pass ? "ok" : "fail"}`);
  }
  record("preview-revision-comparison-saved-drafts", comparisonOk, comparisonDetails.join(" "));
  record(
    "preview-revision-comparison-not-in-review-centre",
    !JSON.stringify(sections).includes(AI_LOCAL_REVISION_COMPARISON_V3_ASSET) &&
      !sections.some((sec) => String(sec.type || "").includes("revision-comparison")),
    "comparison asset is Preview-only",
  );

  function headingSequence(html: string): string[] {
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
    return [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((row) =>
      row[1]!.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
    );
  }
  const wombwellVariant = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_STRATEGY_VARIANT_V3_ASSET, {
    areaSlug: "wombwell",
  });
  const darfieldVariant = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_STRATEGY_VARIANT_V3_ASSET, {
    areaSlug: "darfield",
  });
  const unknownVariant = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_STRATEGY_VARIANT_V3_ASSET, {
    areaSlug: "worsbrough",
  });
  const wombwellHeadings = headingSequence(wombwellVariant.html);
  const darfieldHeadings = headingSequence(darfieldVariant.html);
  const wombwellWhyIdx = wombwellHeadings.findIndex((h) => /complements local primary care/i.test(h));
  const wombwellHowIdx = wombwellHeadings.findIndex((h) => /fits alongside GP care/i.test(h));
  const wombwellGpIdx = wombwellHeadings.findIndex((h) => /go back to your GP/i.test(h));
  const wombwellConditionsIdx = wombwellHeadings.findIndex((h) => /Pharmacy First conditions explained/i.test(h));
  const darfieldWhyIdx = darfieldHeadings.findIndex((h) => /practical pharmacy choice for the Darfield community/i.test(h));
  const darfieldConditionsIdx = darfieldHeadings.findIndex((h) => /Pharmacy First conditions explained/i.test(h));
  const darfieldHowIdx = darfieldHeadings.findIndex((h) => /Using Pharmacy First in Darfield/i.test(h));
  const darfieldGpIdx = darfieldHeadings.findIndex((h) => /GP and emergency guidance/i.test(h));
  record(
    "preview-strategy-variant-isolated-restore",
    wombwellVariant.sourceRoute === "ai-local-strategy-variant-v3" &&
      darfieldVariant.sourceRoute === "ai-local-strategy-variant-v3" &&
      unknownVariant.sourceRoute === "review-preview-strategy-variant-unavailable" &&
      wombwellVariant.html.includes(AI_LOCAL_STRATEGY_VARIANT_BANNER) &&
      darfieldVariant.html.includes(AI_LOCAL_STRATEGY_VARIANT_BANNER) &&
      /noindex,\s*nofollow/i.test(wombwellVariant.html) &&
      /noindex,\s*nofollow/i.test(darfieldVariant.html) &&
      !wombwellVariant.html.includes(AI_PILOT_V3_PREVIEW_BANNER) &&
      !darfieldVariant.html.includes(AI_PILOT_V3_PREVIEW_BANNER) &&
      !/data-approval-control/i.test(wombwellVariant.html) &&
      !/<button[^>]*>\s*(?:Approve|Publish)\b/i.test(darfieldVariant.html) &&
      STRATEGY_VARIANT_COMPARISON_AREAS.wombwell === "primary-care-led" &&
      STRATEGY_VARIANT_COMPARISON_AREAS.darfield === "community-led",
    `wombwell=${wombwellVariant.sourceRoute} darfield=${darfieldVariant.sourceRoute} unknown=${unknownVariant.sourceRoute}`,
  );
  record(
    "preview-strategy-variant-section-roles-differ",
    wombwellWhyIdx >= 0 &&
      wombwellHowIdx > wombwellWhyIdx &&
      wombwellGpIdx > wombwellHowIdx &&
      wombwellConditionsIdx > wombwellGpIdx &&
      darfieldWhyIdx >= 0 &&
      darfieldConditionsIdx > darfieldWhyIdx &&
      darfieldHowIdx > darfieldConditionsIdx &&
      darfieldGpIdx > darfieldHowIdx &&
      !wombwellVariant.html.includes("Why Wombwell patients start with the pharmacist") &&
      !darfieldVariant.html.includes("Why Darfield patients start with the pharmacist") &&
      wombwellVariant.html.includes("Pharmacy First is designed to sit alongside local primary care, not replace it") &&
      darfieldVariant.html.includes("It sits in community pharmacy as a structured NHS pathway with clinical limits") &&
      !darfieldVariant.html.includes("waiting for a routine GP slot") &&
      !darfieldVariant.html.includes("Using Pharmacy First from Darfield") &&
      !wombwellVariant.html.includes("regularly combine local errands") &&
      !darfieldVariant.html.includes("regularly combine local errands") &&
      !wombwellVariant.html.includes("clinically purposeful") &&
      !darfieldVariant.html.includes("clinically purposeful"),
    `wombwell=${wombwellHeadings.join(" | ")} || darfield=${darfieldHeadings.join(" | ")}`,
  );
  record(
    "preview-strategy-variant-facts-and-clinical",
    wombwellVariant.html.includes("Wombwell Heritage Group") &&
      wombwellVariant.html.includes("Wombwell Medical Centre") &&
      wombwellVariant.html.includes("1.7 km") &&
      darfieldVariant.html.includes("Darfield History Society") &&
      darfieldVariant.html.includes("Garland House Surgery") &&
      darfieldVariant.html.includes("Church Street") &&
      darfieldVariant.html.includes("regular activities and special events") &&
      !wombwellVariant.html.includes("Darfield History Society") &&
      !wombwellVariant.html.includes("Garland House Surgery") &&
      !darfieldVariant.html.includes("Wombwell Heritage Group") &&
      !darfieldVariant.html.includes("Wombwell Medical Centre") &&
      !darfieldVariant.html.includes("1.7 km") &&
      wombwellVariant.html.includes("sore throat") &&
      darfieldVariant.html.includes("sore throat") &&
      wombwellVariant.html.includes("Seek urgent medical care for breathing difficulties") &&
      darfieldVariant.html.includes("Seek urgent medical care for breathing difficulties") &&
      !JSON.stringify(sections).includes(AI_LOCAL_STRATEGY_VARIANT_V3_ASSET),
    "accepted local facts stay area-bound; clinical pathway copy is shared",
  );
  const acceptedWombwellPreview = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET, {
    areaSlug: "wombwell",
  });
  const acceptedDarfieldPreview = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET, {
    areaSlug: "darfield",
  });
  record(
    "preview-strategy-variant-does-not-overwrite-accepted",
    acceptedWombwellPreview.sourceRoute === "ai-local-area-page-pilot-v3" &&
      acceptedDarfieldPreview.sourceRoute === "ai-local-area-page-pilot-v3" &&
      acceptedWombwellPreview.html.includes("Why Wombwell patients start with the pharmacist") &&
      acceptedDarfieldPreview.html.includes("Why Darfield patients start with the pharmacist") &&
      !acceptedWombwellPreview.html.includes(AI_LOCAL_STRATEGY_VARIANT_BANNER) &&
      !acceptedDarfieldPreview.html.includes(AI_LOCAL_STRATEGY_VARIANT_BANNER),
    "file-based accepted Previews remain patient-journey-led",
  );

  const servicePreview = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, "service-page");
  const serviceAboutHref =
    servicePreview.html.match(/<nav[^>]*aria-label="Primary"[^>]*>[\s\S]*?href="(#[^"]+)"[^>]*>About/i)?.[1] || "";
  const serviceServicesHref =
    servicePreview.html.match(/<nav[^>]*aria-label="Primary"[^>]*>[\s\S]*?href="(#[^"]+)"[^>]*>Services/i)?.[1] || "";
  const serviceAboutId = serviceAboutHref.replace(/^#/, "");
  const serviceServicesId = serviceServicesHref.replace(/^#/, "");
  record(
    "sales-demo-service-preview-screenshot-fixes",
    servicePreview.sourceRoute === "review-wrapper-service-page" &&
      servicePreview.html.includes("Review preview — not published.") &&
      /noindex,\s*nofollow/i.test(servicePreview.html) &&
      /Contact the pharmacy/.test(servicePreview.html) &&
      /\.nav-links a\.nav-cta/.test(servicePreview.html) &&
      /color:#fff!important/.test(servicePreview.html) &&
      /\.pharmacy-review-preview-toolbar~\.site-header\{top:40px\}/.test(servicePreview.html) &&
      Boolean(serviceAboutId) &&
      servicePreview.html.includes(`id="${serviceAboutId}"`) &&
      Boolean(serviceServicesId) &&
      servicePreview.html.includes(`id="${serviceServicesId}"`) &&
      !servicePreview.html.includes('href="#trust"'),
    `about=${serviceAboutHref} services=${serviceServicesHref} route=${servicePreview.sourceRoute}`,
  );
  const treatmentCard =
    servicePreview.html.match(
      /data-step="4" aria-label="Step 4\. Treatment options">[\s\S]*?<p class="card-body">([\s\S]*?)<\/p>/,
    )?.[1] || "";
  const processSection = servicePreview.html.match(/data-template-block="process"[\s\S]*?<\/section>/)?.[0] || "";
  record(
    "sales-demo-service-preview-treatment-card-shortened",
    treatmentCard ===
      "The pharmacist may recommend self-care and advice, or supply medicines where appropriate under NHS clinical pathways. Treatment depends on your symptoms and eligibility." &&
      servicePreview.html.includes('<h3 class="card-title-line-1">Treatment options</h3>') &&
      servicePreview.html.includes("Patient identifies symptoms matching one of the seven conditions") &&
      servicePreview.html.includes("Patient checked in at pharmacy counter") &&
      servicePreview.html.includes("Structured questions from NHS clinical pathway checklist") &&
      !/phenoxymethylpenicillin|fusidic acid|aciclovir/.test(processSection) &&
      /body\[data-pharmacy-service="pharmacy-first"\] \.process-grid\.card-grid-equal \.card-body\{min-height:0/.test(
        servicePreview.html,
      ),
    treatmentCard.slice(0, 90),
  );

  const brookDemo = renderReviewCentrePreviewAsset(
    YORKSHIRE,
    SERVICE,
    "sales-demo-brook-service-page",
  );
  const brookProcess = brookDemo.html.match(/data-template-block="process"[\s\S]*?<\/section>/)?.[0] || "";
  const brookTreatment =
    brookDemo.html.match(
      /data-step="4" aria-label="Step 4\. Treatment options">[\s\S]*?<p class="card-body">([\s\S]*?)<\/p>/,
    )?.[1] || "";
  const brookProfileOnDisk = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/brook-pharmacy.json"), "utf8"),
  ) as { data?: { pharmacyName?: string; townCity?: string; addressLine1?: string } };
  record(
    "sales-demo-brook-identity-isolated-preview",
    brookDemo.sourceRoute === "sales-demo-brook-service-page" &&
      brookDemo.html.includes("Review preview — not published.") &&
      brookDemo.html.includes("Demonstration website — for presentation purposes only.") &&
      /noindex,\s*nofollow/i.test(brookDemo.html) &&
      brookDemo.html.includes("Brook Pharmacy") &&
      brookDemo.html.includes("56 West Burton Road, Derby, DA5 4NR") &&
      brookDemo.html.includes("01332 445 076") &&
      brookDemo.html.includes(BROOK_SALES_DEMO_IDENTITY.logoUrl) &&
      brookDemo.html.includes("maps/embed?pb=") &&
      brookTreatment ===
        "The pharmacist may recommend self-care and advice, or supply medicines where appropriate under NHS clinical pathways. Treatment depends on your symptoms and eligibility." &&
      brookProcess.includes("Patient identifies symptoms matching one of the seven conditions") &&
      brookDemo.html.includes("/assets/pharmacy-image-platform/services/pharmacy-first/roles/hero/") &&
      !/Yorkshire Pharmacy/i.test(brookDemo.html) &&
      !/Darfield|Wombwell|Snape Hill|01226 210477|1\.7\s*km/i.test(brookDemo.html) &&
      !/href="tel:/i.test(brookDemo.html) &&
      !/href="mailto:/i.test(brookDemo.html) &&
      !/broomlanepharmacy/i.test(brookDemo.html) &&
      !/href="https:\/\/yorkshirepharmacyhealthclinic/i.test(brookDemo.html) &&
      !/<a[^>]*class="[^"]*coverage-tag/.test(brookDemo.html) &&
      servicePreview.html.includes("Yorkshire Pharmacy") &&
      servicePreview.html.includes("91 Snape Hill Rd, Darfield") &&
      brookProfileOnDisk.data?.townCity === "Rotherham" &&
      /70 Broom Ln|70A Broom Lane/.test(String(brookProfileOnDisk.data?.addressLine1 || "")),
    `route=${brookDemo.sourceRoute} treatment=${brookTreatment.slice(0, 40)}`,
  );
  const derbyNames = salesDemoBrookDerbyAreaNames();
  const derbyLabelBlock = brookDemo.html.match(/data-sales-demo-localities="true"[\s\S]*?<\/div><\/div>/)?.[0] || "";
  const derbyLabelCount = (derbyLabelBlock.match(/<span class="coverage-tag" role="listitem">/g) || []).length;
  record(
    "sales-demo-brook-ten-derby-locality-labels",
    derbyNames.length === 10 &&
      derbyLabelCount === 10 &&
      derbyNames.every((name) => derbyLabelBlock.includes(`>${name}<`)) &&
      derbyLabelBlock.includes("Demonstration location — not a live pharmacy listing") &&
      derbyLabelBlock.includes("56 Burton Rd, Derby DE1 1TG") &&
      !/<a\b/i.test(derbyLabelBlock) &&
      !/href=/i.test(derbyLabelBlock) &&
      !/Darfield|Wombwell/.test(derbyLabelBlock) &&
      brookDemo.html.includes("Demonstration website — for presentation purposes only.") &&
      brookTreatment ===
        "The pharmacist may recommend self-care and advice, or supply medicines where appropriate under NHS clinical pathways. Treatment depends on your symptoms and eligibility." &&
      servicePreview.html.includes("Darfield") &&
      servicePreview.html.includes("Wombwell"),
    `labels=${derbyNames.join(",")}`,
  );

  const wombwellAboutHref =
    wombwellVariant.html.match(/<nav[^>]*aria-label="Primary"[^>]*>[\s\S]*?href="(#[^"]+)"[^>]*>About/i)?.[1] || "";
  const wombwellServicesHref =
    wombwellVariant.html.match(/<nav[^>]*aria-label="Primary"[^>]*>[\s\S]*?href="(#[^"]+)"[^>]*>Services/i)?.[1] || "";
  const wombwellAboutId = wombwellAboutHref.replace(/^#/, "");
  const wombwellServicesId = wombwellServicesHref.replace(/^#/, "");
  record(
    "sales-demo-wombwell-variant-screenshot-fixes",
    wombwellVariant.html.includes("Strategy variant comparison — not published") &&
      /noindex,\s*nofollow/i.test(wombwellVariant.html) &&
      wombwellVariant.html.includes("Wombwell is approximately 1.7 km in a straight line.") &&
      !/Saved coordinates and provenance/i.test(wombwellVariant.html) &&
      !/1\.7 km of the pharmacy/.test(wombwellVariant.html) &&
      !/travel times|travel distance|journey time/i.test(wombwellVariant.html) &&
      wombwellVariant.html.includes(
        'href="/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=service-page"',
      ) &&
      !/href="\/pharmacy-first\/?"/.test(wombwellVariant.html) &&
      /\.strategy-variant-toolbar~\.site-header\{top:40px\}/.test(wombwellVariant.html) &&
      Boolean(wombwellAboutId) &&
      wombwellVariant.html.includes(`id="${wombwellAboutId}"`) &&
      Boolean(wombwellServicesId) &&
      wombwellVariant.html.includes(`id="${wombwellServicesId}"`) &&
      !wombwellVariant.html.includes('href="#trust"') &&
      !wombwellVariant.html.includes('href="#service-definition"'),
    `about=${wombwellAboutHref} services=${wombwellServicesHref}`,
  );

  const protectedHashes: Array<[string, string]> = [
    [
      "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell.json",
      "c23580da7b8e9458de02fc2318f924c4802eebc550f4c8adeeb8a458da82aee3",
    ],
    [
      "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/local/wombwell/index.html",
      "79e6b8e5a06758d84c9e9d146fb505fc131bf595bd5c05bb2ddb9e798765c506",
    ],
    [
      "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/darfield.json",
      "c664a82fd212c880ad824d01e8dd68d02f7bd34dff88ecb5d7f84598258baf9c",
    ],
    [
      "data/pharmacy-ai-local-copy-checkpoints/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/darfield/2026-09-01T16-36Z-demo-standard/copy/darfield-candidate.json",
      "cef33fae649386b87826cce3f7087259a47c47cefb1310e8e8ec23119a6f2b26",
    ],
    [
      "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/local/darfield/index.html",
      "96f124c92089a1773dd29a0873d63c73eb53dba5d2df298498f385d3c199c9fd",
    ],
    [
      "data/pharmacy-ai-local-copy-checkpoints/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T14-52-50-988Z-source-corrected-demo/copy/before-parent.json",
      "20ddd044027c2a51a28908cd495d3159e488bc7ab47f7fb37ea77e13125c16a3",
    ],
    [
      "data/pharmacy-ai-local-copy-checkpoints/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T14-52-50-988Z-source-corrected-demo/MANIFEST.json",
      "3fbce3d0853b0983fcbd77eef31bf1175916768a3d0c961a14e4863e2c4dbe95",
    ],
    [
      "output/pharmacy-content-ecosystem/leeds-pharmacy/pharmacy-first/local/headingley/index.html",
      "184f330ead7d07b22c0ebcac44a7f21b5b82cf31dd546760797db073e65c41e9",
    ],
    [
      "output/pharmacy-content-ecosystem/yorkshire-pharmacy-and-health-clinic/pharmacy-first/local/wombwell/index.html",
      "534744be7db4b3288c4fea8bb568594b94f8caab827869df1690add447f2f5fa",
    ],
    [
      "data/pharmacy-local-editorial-evidence-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell.json",
      "9d7d4cf2cfa5841ffcb2587c1116bb16d4c91c7a8db67e5d3b34e0808c10f48d",
    ],
    [
      "data/pharmacy-local-editorial-evidence-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/darfield.json",
      "065e896a318589d4230f15670de7ff42f9594629b872507b4260ca15727239a9",
    ],
  ];
  const hashMismatches = protectedHashes
    .map(([rel, expected]) => {
      const file = path.join(ROOT, rel);
      if (!fs.existsSync(file)) return `${rel}: missing`;
      const actual = hashFile(file);
      return actual === expected ? "" : `${rel}: ${actual}`;
    })
    .filter(Boolean);
  record(
    "preview-strategy-variant-protected-hashes-unchanged",
    hashMismatches.length === 0,
    hashMismatches.join(" | ") || "accepted-reference and protected-output hashes unchanged",
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
      replayCopy.heroIntroduction === buildRendererOwnedHeroIntroductionV3("Wombwell") &&
      replayed.failures.some((f) => /repeated distance guidance/i.test(f)) &&
      !replayed.failures.some((f) => /distance must be identified as approximate straight-line/i.test(f)) &&
      replayed.ok === false,
    replayed.failures.join(" | "),
  );
  const suppliedFacts: EditorialFactV3[] = [
    sampleFact({
      area: "Wombwell",
      areaSlug: "wombwell",
      factId: "wombwell:access-transport:wombwell-has-a-national-rail-station",
      category: "access-transport",
      normalizedStatement: "Wombwell has a National Rail station.",
      permittedCopyRole: "access-context",
    }),
    sampleFact({
      area: "Wombwell",
      areaSlug: "wombwell",
      factId: "wombwell:pharmacy-relationship:distance",
      category: "pharmacy-relationship",
      normalizedStatement: "Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell, at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK.",
      permittedCopyRole: "access-context",
    }),
    sampleFact({
      area: "Wombwell",
      areaSlug: "wombwell",
      factId: "wombwell:healthcare:nhs-general-practice-services-in-wombwell-are-pr",
      category: "healthcare",
      normalizedStatement: "NHS general practice services in Wombwell are provided from Wombwell Medical Centre.",
      permittedCopyRole: "healthcare-context",
    }),
    sampleFact({
      area: "Wombwell",
      areaSlug: "wombwell",
      factId: "wombwell:area-identity:wombwell-is-in-the-metropolitan-borough-of-barns",
      category: "area-identity",
      normalizedStatement: "Wombwell is in the Metropolitan Borough of Barnsley, South Yorkshire.",
      permittedCopyRole: "area-introduction",
    }),
    sampleFact({
      area: "Wombwell",
      areaSlug: "wombwell",
      factId: "wombwell:community:wombwell-has-a-public-library",
      category: "community",
      normalizedStatement: "Wombwell has a public library.",
      permittedCopyRole: "neutral-community-context",
    }),
  ];
  const replayFactsInput = {
    ...wombwellInput,
    editorialFacts: suppliedFacts.map((fact) => ({
      factId: fact.factId,
      category: fact.category,
      normalizedStatement: fact.normalizedStatement,
      permittedCopyRole: fact.permittedCopyRole,
      prohibitedInference: fact.prohibitedInference,
      sourceClass: fact.sourceClass,
      publisher: fact.publisher,
    })),
    editorialSufficiency: "READY" as const,
  };
  const fourAttemptFiles = [
    "2026-09-01T12-33-31-060Z-attempt-1.json",
    "2026-09-01T12-33-35-374Z-attempt-2.json",
    "2026-09-01T12-35-39-845Z-attempt-1.json",
    "2026-09-01T12-35-43-358Z-attempt-2.json",
  ];
  const fourReplays = fourAttemptFiles.map((name) => {
    const file = path.join(ROOT, "data/pharmacy-ai-local-copy-attempt-logs", YORKSHIRE, SERVICE, "v3", "wombwell", name);
    const saved = JSON.parse(fs.readFileSync(file, "utf8")) as { rawResponse: string };
    const parsed = parseAiLocalCopyV3(saved.rawResponse);
    const copy = parsed.ok ? enforceEditorialDisciplineV3(parsed.copy, replayFactsInput) : null;
    const narrativeUnchanged =
      parsed.ok &&
      copy &&
      JSON.stringify(copy.localContextParagraphs) === JSON.stringify(parsed.copy.localContextParagraphs);
    const rendererOwnedApplied = Boolean(
      copy &&
        copy.heroIntroduction === buildRendererOwnedHeroIntroductionV3("Wombwell") &&
        copy.relationshipToPharmacy === buildRendererOwnedRelationshipToPharmacyV3(replayFactsInput),
    );
    const validated = parsed.ok && copy ? validateAiLocalCopyPilotV3(copy, replayFactsInput, suppliedFacts) : { ok: false, failures: ["parse-failed"], reviews: [] };
    return { name, parsedOk: parsed.ok, unchanged: narrativeUnchanged, rendererOwnedApplied, validated, copy, raw: saved.rawResponse };
  });
  const allStillRejected = fourReplays.every((row) => row.validated.ok === false);
  const grammarFalsePositivesGone = fourReplays.every((row) => !row.validated.failures.some((f) => /missing a clear verb/i.test(f)));
  const missedNowDetected = fourReplays.some((row) =>
    row.validated.failures.some((f) => /distinct(?:ive)?(?: south yorkshire)? character|familiar spot|another option|without waiting|community resources|known for|strong sense of place|strong community links/i.test(f)),
  );
  record(
    "23-replay-four-saved-1233-1235-responses-unchanged",
    fourReplays.every((row) => row.parsedOk && row.unchanged && row.rendererOwnedApplied) &&
      allStillRejected &&
      grammarFalsePositivesGone &&
      missedNowDetected,
    fourReplays
      .map((row) => `${row.name}: ok=${row.validated.ok} failures=${row.validated.failures.length} reviews=${row.validated.reviews?.length || 0}`)
      .join(" | "),
  );

  const keywordGone = !/11,?477|semi-detached|wholesale and retail|construction|public library|Medical Centre/.test(
    String(inspectWombwellLocalRecognitionV3.toString()),
  );
  const accessOnlyStillFails = inspectWombwellLocalRecognitionV3(
    baseCopy({
      area: "Hoyland",
      heroIntroduction: "Pharmacy First can help people in Hoyland with eligible common conditions.",
      localIntroduction: "",
      localContextParagraphs: ["Yorkshire Pharmacy & Health Clinic is approximately 3.2 km from Hoyland in a straight line."],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
    }),
    {
      ...wombwellInput,
      locality: { ...wombwellInput.locality, areaName: "Hoyland", areaSlug: "hoyland", distanceKm: 3.2, distanceLabel: "3.2 km" },
    },
  );
  const hoylandBoroughRecognisable = inspectWombwellLocalRecognitionV3(
    baseCopy({
      area: "Hoyland",
      heroIntroduction: "Pharmacy First can help people in Hoyland with eligible common conditions.",
      localIntroduction: "Hoyland is in the Metropolitan Borough of Barnsley, South Yorkshire.",
      localContextParagraphs: ["Hoyland has a public park beside the town centre streets."],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
    }),
    {
      ...wombwellInput,
      locality: { ...wombwellInput.locality, areaName: "Hoyland", areaSlug: "hoyland" },
    },
  );
  record(
    "24-local-recognition-is-not-a-wombwell-keyword-list",
    keywordGone &&
      accessOnlyStillFails.some((f) => /access-only-local-copy/i.test(f)) &&
      !hoylandBoroughRecognisable.some((f) => /access-only-local-copy|11,477|Medical Centre/i.test(f)),
    [...accessOnlyStillFails, ...hoylandBoroughRecognisable].join(" | ") || "generic recognition",
  );

  const hoylandGrounded = groundAiLocalCopyClaimsV3(
    baseCopy({
      area: "Hoyland",
      heroIntroduction: "Pharmacy First offers a way for people in Hoyland to get help with eligible common conditions.",
      localIntroduction: "Hoyland sits within the Metropolitan Borough of Barnsley, giving the area a distinctive character.",
      localContextParagraphs: ["Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield."],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
    }),
    {
      ...wombwellInput,
      locality: { ...wombwellInput.locality, areaName: "Hoyland", areaSlug: "hoyland" },
    },
    [
      sampleFact({
        area: "Hoyland",
        areaSlug: "hoyland",
        factId: "hoyland:area-identity:borough",
        category: "area-identity",
        normalizedStatement: "Hoyland is in the Metropolitan Borough of Barnsley, South Yorkshire.",
      }),
    ],
  );
  record(
    "25-grounding-rejects-extra-clause-for-a-second-area",
    hoylandGrounded.ok === false &&
      hoylandGrounded.failures.some((f) => /distinctive character|unsupported/i.test(f)) &&
      !hoylandGrounded.claims.some((row) => row.validationResult === "pass" && /distinctive character/i.test(row.exactSentence)),
    hoylandGrounded.failures.join(" | "),
  );

  const budgetDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3-ai-budget-"));
  const taskId = "durable-limit-fixture";
  let adapterCalls = 0;
  const mockRaw = JSON.stringify({
    area: "Alvaston",
    heroHeading: "Pharmacy First in Alvaston",
    heroIntroduction: "Pharmacy First can help people in Alvaston with eligible common conditions.",
    localIntroduction: "",
    localContextHeading: "",
    localContextParagraphs: ["Alvaston sits within the Metropolitan Borough of Barnsley, giving the area a distinctive character."],
    relationshipToPharmacy: "Consultations take place at Brook Pharmacy Demo Derby in Derby.",
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: [],
  });
  const generateOpts = {
    slug: BROOK,
    serviceId: SERVICE,
    areaName: "Alvaston",
    areaSlug: "alvaston",
    writeRecord: false,
    persistAttemptLogs: false,
    maxAttempts: 1,
    maxProviderCalls: 1,
    maxCostUsd: 0.2,
    authorizedTaskId: taskId,
    budgetDir,
    providerAdapter: async () => {
      adapterCalls += 1;
      return { raw: mockRaw, model: "mock", promptTokens: 10, completionTokens: 10 };
    },
  };
  resetAiPilotLedgerV3();
  await generateAiLocalCopyPilotV3(generateOpts);
  const afterFirst = adapterCalls;
  resetAiPilotLedgerV3();
  const second = await generateAiLocalCopyPilotV3(generateOpts);
  const afterSecond = adapterCalls;
  let uncertainCalls = 0;
  const uncertainDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3-ai-budget-uncertain-"));
  await generateAiLocalCopyPilotV3({
    ...generateOpts,
    authorizedTaskId: "uncertain-fixture",
    budgetDir: uncertainDir,
    maxAttempts: 2,
    maxProviderCalls: 2,
    providerAdapter: async () => {
      uncertainCalls += 1;
      return { raw: "", model: "mock", promptTokens: 1, completionTokens: 0, uncertain: true };
    },
  });
  const budgetAfter = loadAuthorizedTaskBudgetV3(authorizedTaskBudgetPathV3({ slug: BROOK, serviceId: SERVICE, taskId, budgetDir }));
  record(
    "26-durable-call-limit-survives-reset-and-does-not-replay-uncertain",
    afterFirst === 1 &&
      afterSecond === 1 &&
      second.ok === false &&
      /durable-call-limit-reached/.test(second.ok === false ? second.detail : "") &&
      uncertainCalls === 1 &&
      (budgetAfter?.consumed || 0) + (budgetAfter?.uncertain || 0) >= 1,
    `first=${afterFirst} secondTotal=${afterSecond} detail=${second.ok ? "ok" : second.detail} uncertainCalls=${uncertainCalls}`,
  );

  const hoylandInput = {
    ...wombwellInput,
    locality: {
      ...wombwellInput.locality,
      areaName: "Hoyland",
      areaSlug: "hoyland",
      pharmacyIsInArea: false,
      distanceKm: 3.2,
      distanceLabel: "3.2 km",
    },
  };
  const hoylandFacts: EditorialFactV3[] = [
    sampleFact({
      area: "Hoyland",
      areaSlug: "hoyland",
      factId: "hoyland:area-identity:borough",
      category: "area-identity",
      normalizedStatement: "Hoyland is in the Metropolitan Borough of Barnsley, South Yorkshire.",
    }),
    sampleFact({
      area: "Hoyland",
      areaSlug: "hoyland",
      factId: "hoyland:community:public-library-opened-2008",
      category: "community",
      normalizedStatement: "The public library in Hoyland opened in 2008.",
    }),
  ];
  const supportedShell = (area: string, overrides: Partial<AiLocalCopyV3> = {}): AiLocalCopyV3 =>
    baseCopy({
      area,
      heroHeading: `Pharmacy First in ${area}`,
      heroIntroduction: `Pharmacy First can help people in ${area} with eligible common conditions.`,
      localIntroduction: "",
      localContextHeading: "",
      localContextParagraphs: [`${area} is in the Metropolitan Borough of Barnsley, South Yorkshire.`],
      relationshipToPharmacy: "Consultations take place at Yorkshire Pharmacy & Health Clinic in Darfield.",
      localAccessIntroduction: "",
      localFaqs: [],
      localCtaBridge: "",
      evidenceClaims: [],
      evidenceEntityIdsUsed: [],
      editorialFactIdsUsed: [],
      ...overrides,
    });
  const sentenceOutcome = (
    grounded: { ok: boolean; failures: string[]; reviews?: string[]; claims: Array<{ exactSentence: string; validationResult: string; detail?: string }> },
    sentence: string,
  ) => {
    const fail = grounded.failures.filter((row) => row.includes(sentence));
    const review = (grounded.reviews || []).filter((row) => row.includes(sentence));
    const claim = grounded.claims.find((row) => row.exactSentence === sentence);
    const ruleMatch = [...fail, ...review].join(" ").match(/rule=([^\s|]+)/);
    if (fail.length) {
      return { outcome: "FAIL" as const, branch: claim?.detail || ruleMatch?.[1] || fail[0], rule: ruleMatch?.[1] || "", findings: fail, ok: grounded.ok };
    }
    if (review.length) {
      return { outcome: "REVIEW REQUIRED" as const, branch: claim?.detail || ruleMatch?.[1] || review[0], rule: ruleMatch?.[1] || "", findings: review, ok: grounded.ok };
    }
    if (claim?.validationResult === "pass") {
      return { outcome: "PASS" as const, branch: claim.detail || "clauseCoveredByFactV3", rule: "grounded", findings: [], ok: grounded.ok };
    }
    return { outcome: "NONE" as const, branch: "", rule: "", findings: [], ok: grounded.ok };
  };

  const naturalWombwellSentence = "Wombwell is in the Metropolitan Borough of Barnsley, South Yorkshire.";
  const naturalWombwellLibrary = "Wombwell has a public library.";
  const naturalCopy = supportedShell("Wombwell", {
    localIntroduction: naturalWombwellSentence,
    localContextParagraphs: [naturalWombwellLibrary],
  });
  const naturalGrounded = groundAiLocalCopyClaimsV3(naturalCopy, wombwellInput, suppliedFacts);
  const naturalValidated = validateAiLocalCopyPilotV3(naturalCopy, wombwellInput, suppliedFacts);
  const naturalIntro = sentenceOutcome(naturalGrounded, naturalWombwellSentence);
  const naturalLib = sentenceOutcome(naturalGrounded, naturalWombwellLibrary);
  record(
    "27-supported-natural-copy-passes",
    naturalIntro.outcome === "PASS" &&
      naturalLib.outcome === "PASS" &&
      naturalGrounded.ok === true &&
      naturalValidated.ok === true &&
      naturalValidated.reviews.length === 0,
    `intro=${naturalIntro.outcome}/${naturalIntro.branch} library=${naturalLib.outcome}/${naturalLib.branch} validate.ok=${naturalValidated.ok} failures=${naturalValidated.failures.join(" | ")} reviews=${naturalValidated.reviews.join(" | ")}`,
  );

  const wombwellParaphrase = "Wombwell sits within the Metropolitan Borough of Barnsley, South Yorkshire.";
  const hoylandParaphrase = "There is a public library in Hoyland.";
  const wombwellParaphraseGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Wombwell", { localIntroduction: wombwellParaphrase, localContextParagraphs: [naturalWombwellLibrary] }),
    wombwellInput,
    suppliedFacts,
  );
  const hoylandParaphraseGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Hoyland", {
      localIntroduction: "Hoyland is in the Metropolitan Borough of Barnsley, South Yorkshire.",
      localContextParagraphs: [hoylandParaphrase],
    }),
    hoylandInput,
    hoylandFacts,
  );
  const wombwellParaOut = sentenceOutcome(wombwellParaphraseGrounded, wombwellParaphrase);
  const hoylandParaOut = sentenceOutcome(hoylandParaphraseGrounded, hoylandParaphrase);
  record(
    "28-accurate-paraphrase-is-not-factual-fail",
    wombwellParaOut.outcome !== "FAIL" &&
      hoylandParaOut.outcome !== "FAIL" &&
      wombwellParaOut.outcome === "PASS" &&
      hoylandParaOut.outcome === "PASS",
    `wombwell=${wombwellParaOut.outcome}/${wombwellParaOut.branch} hoyland=${hoylandParaOut.outcome}/${hoylandParaOut.branch}`,
  );

  const extraClauseSentence = "Hoyland sits within the Metropolitan Borough of Barnsley, giving the area a distinctive character.";
  const extraClauseGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Hoyland", { localIntroduction: extraClauseSentence }),
    hoylandInput,
    hoylandFacts,
  );
  const extraClauseOut = sentenceOutcome(extraClauseGrounded, extraClauseSentence);
  record(
    "29-supported-sentence-with-invented-extra-clause-cannot-pass",
    extraClauseOut.outcome === "FAIL" &&
      extraClauseGrounded.ok === false &&
      /distinctive character/i.test(extraClauseOut.findings.join(" ")) &&
      /UNSUPPORTED_CHARACTER_V3|unsupported-character/i.test(`${extraClauseOut.branch} ${extraClauseOut.rule}`),
    `${extraClauseOut.outcome}/${extraClauseOut.rule}/${extraClauseOut.branch} ${extraClauseOut.findings.join(" | ")}`,
  );

  const numberSentence = "Hoyland has 12,500 residents.";
  const dateSentence = "The public library in Hoyland opened in 2012.";
  const localitySentence = "Hoyland is in the City of Sheffield.";
  const referralSentence = "The local GP practice refers patients to Yorkshire Pharmacy & Health Clinic.";
  const numberGrounded = groundAiLocalCopyClaimsV3(supportedShell("Hoyland", { localIntroduction: numberSentence }), hoylandInput, hoylandFacts);
  const dateGrounded = groundAiLocalCopyClaimsV3(supportedShell("Hoyland", { localIntroduction: dateSentence }), hoylandInput, hoylandFacts);
  const localityGrounded = groundAiLocalCopyClaimsV3(supportedShell("Hoyland", { localIntroduction: localitySentence }), hoylandInput, hoylandFacts);
  const referralGrounded = groundAiLocalCopyClaimsV3(supportedShell("Hoyland", { localIntroduction: referralSentence }), hoylandInput, hoylandFacts);
  const numberOut = sentenceOutcome(numberGrounded, numberSentence);
  const dateOut = sentenceOutcome(dateGrounded, dateSentence);
  const localityOut = sentenceOutcome(localityGrounded, localitySentence);
  const referralOut = sentenceOutcome(referralGrounded, referralSentence);
  const referralPageFail = referralGrounded.failures.some((row) => /implied-affiliation|refers patients/i.test(row));
  record(
    "30-numbers-dates-locality-referral-remain-checked",
    numberOut.outcome === "FAIL" &&
      /numbersUnsupportedV3|unsupported-number/i.test(`${numberOut.branch} ${numberOut.rule}`) &&
      dateOut.outcome === "FAIL" &&
      /datesUnsupportedV3|unsupported-date/i.test(`${dateOut.branch} ${dateOut.rule}`) &&
      localityOut.outcome === "FAIL" &&
      /localityContradictionV3|locality-contradiction/i.test(`${localityOut.branch} ${localityOut.rule}`) &&
      referralPageFail &&
      referralGrounded.ok === false,
    `number=${numberOut.outcome}/${numberOut.rule}/${numberOut.branch} date=${dateOut.outcome}/${dateOut.rule}/${dateOut.branch} locality=${localityOut.outcome}/${localityOut.rule}/${localityOut.branch} referralFail=${referralPageFail} referralSentence=${referralOut.outcome}`,
  );

  const boardFact = sampleFact({
    area: "Hoyland",
    areaSlug: "hoyland",
    factId: "hoyland:community:neighbourhood-board",
    category: "community",
    normalizedStatement:
      "Hoyland has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services.",
  });
  const gpFact = sampleFact({
    area: "Hoyland",
    areaSlug: "hoyland",
    factId: "hoyland:healthcare:gp",
    category: "healthcare",
    normalizedStatement: "NHS general practice services in Hoyland are provided from Hoyland Medical Centre.",
  });
  const relativeWhichSentence =
    "The area is served by a Neighbourhood Board, which includes local councillors, residents, and representatives from public services as well as community organisations.";
  const connectiveSentence = "Healthcare provision in the area centres on general practice medical services.";
  const wrapSentence = "Both facilities form part of the local healthcare provision for the ward.";
  const inventedNamedPlace = "Hoyland Country Park is a large woodland with lakes.";
  const whichCharacterSentence =
    "Hoyland is in the Metropolitan Borough of Barnsley, which is known for its distinctive character.";
  const proseFacts = [...hoylandFacts, boardFact, gpFact];
  const relativeWhichGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Hoyland", { localIntroduction: relativeWhichSentence }),
    hoylandInput,
    proseFacts,
  );
  const connectiveGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Hoyland", { localIntroduction: connectiveSentence }),
    hoylandInput,
    proseFacts,
  );
  const wrapGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Hoyland", { localIntroduction: wrapSentence }),
    hoylandInput,
    proseFacts,
  );
  const inventedPlaceGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Hoyland", { localIntroduction: inventedNamedPlace }),
    hoylandInput,
    proseFacts,
  );
  const whichCharacterGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Hoyland", { localIntroduction: whichCharacterSentence }),
    hoylandInput,
    proseFacts,
  );
  const relativeWhichOut = sentenceOutcome(relativeWhichGrounded, relativeWhichSentence);
  const connectiveOut = sentenceOutcome(connectiveGrounded, connectiveSentence);
  const wrapOut = sentenceOutcome(wrapGrounded, wrapSentence);
  const inventedPlaceOut = sentenceOutcome(inventedPlaceGrounded, inventedNamedPlace);
  const whichCharacterOut = sentenceOutcome(whichCharacterGrounded, whichCharacterSentence);
  record(
    "32-relative-which-clause-is-one-grounded-claim",
    relativeWhichOut.outcome !== "FAIL" && relativeWhichGrounded.failures.length === 0,
    `${relativeWhichOut.outcome}/${relativeWhichOut.rule}/${relativeWhichOut.branch} ${relativeWhichOut.findings.join(" | ")}`,
  );
  record(
    "33-neutral-connective-wording-is-not-a-local-fact",
    connectiveOut.outcome !== "FAIL" &&
      wrapOut.outcome !== "FAIL" &&
      connectiveGrounded.failures.length === 0 &&
      wrapGrounded.failures.length === 0,
    `connective=${connectiveOut.outcome}/${connectiveOut.rule} wrap=${wrapOut.outcome}/${wrapOut.rule}`,
  );
  const healthcareTopicSentence =
    "Healthcare needs in the area are supported by primary care establishments located directly within the ward.";
  const healthcareTopicGrounded = groundAiLocalCopyClaimsV3(
    supportedShell("Hoyland", { localIntroduction: healthcareTopicSentence }),
    hoylandInput,
    proseFacts,
  );
  const healthcareTopicOut = sentenceOutcome(healthcareTopicGrounded, healthcareTopicSentence);
  record(
    "33b-healthcare-topic-sentence-is-connective",
    healthcareTopicOut.outcome !== "FAIL" && healthcareTopicGrounded.failures.length === 0,
    `${healthcareTopicOut.outcome}/${healthcareTopicOut.rule}/${healthcareTopicOut.branch}`,
  );
  record(
    "34-named-place-and-character-claims-still-fail",
    inventedPlaceOut.outcome === "FAIL" &&
      inventedPlaceGrounded.ok === false &&
      whichCharacterOut.outcome === "FAIL" &&
      whichCharacterGrounded.ok === false &&
      /ungrounded-clause|no-covering-support/i.test(`${inventedPlaceOut.rule} ${inventedPlaceOut.branch}`) &&
      /unsupported-character|UNSUPPORTED_CHARACTER_V3/i.test(`${whichCharacterOut.rule} ${whichCharacterOut.branch}`),
    `invented=${inventedPlaceOut.outcome}/${inventedPlaceOut.rule} character=${whichCharacterOut.outcome}/${whichCharacterOut.rule}/${whichCharacterOut.branch}`,
  );

  const leftoverTokenFailGone = fourReplays.every(
    (row) => !row.validated.failures.some((f) => /unsupported assertion: (assessment|support|refer|benefits|facilities)/i.test(f)),
  );
  const genuineStillInRaw = [
    fourReplays.some((row) => /distinct(?:ive)?(?: south yorkshire)? character/i.test(row.raw)),
    fourReplays.some((row) => /familiar spot/i.test(row.raw)),
    fourReplays.some((row) => /community resources/i.test(row.raw)),
    fourReplays.some((row) => /another option/i.test(row.raw)),
    fourReplays.some((row) => /without waiting|without needing|do not need to see a gp/i.test(row.raw)),
    fourReplays.some((row) => /known for|strong sense of place|strong community links/i.test(row.raw)),
  ];
  const remainingOptionalFieldDefects = [
    fourReplays.some((row) => row.validated.failures.some((f) => /another option/i.test(f))),
    fourReplays.some((row) => row.validated.failures.some((f) => /without waiting|without needing|do not need to see a gp/i.test(f))),
  ];
  record(
    "31-saved-draft-genuine-defects-remain",
    leftoverTokenFailGone &&
      allStillRejected &&
      genuineStillInRaw.every(Boolean) &&
      remainingOptionalFieldDefects.every(Boolean) &&
      fourReplays.every((row) => row.validated.ok === false),
    `leftoverTokenFailGone=${leftoverTokenFailGone} raw=${genuineStillInRaw.join(",")} optional=${remainingOptionalFieldDefects.join(",")} ${fourReplays.map((row) => `${row.name}: fail=${row.validated.failures.length} review=${row.validated.reviews?.length || 0}`).join(" | ")}`,
  );

  const uncertainSentence = "Pharmacy First offers assessment and treatment for eligible common conditions to people in Wombwell.";
  const uncertainCopy = supportedShell("Wombwell", {
    localIntroduction: naturalWombwellSentence,
    localContextParagraphs: [naturalWombwellLibrary],
    heroIntroduction: uncertainSentence,
  });
  const uncertainGrounded = groundAiLocalCopyClaimsV3(uncertainCopy, wombwellInput, suppliedFacts);
  const uncertainValidated = validateAiLocalCopyPilotV3(uncertainCopy, wombwellInput, suppliedFacts);
  const uncertainOut = sentenceOutcome(uncertainGrounded, uncertainSentence);
  record(
    "32-uncertain-paraphrase-is-review-required",
    uncertainOut.outcome === "REVIEW REQUIRED" &&
      /uncertain-paraphrase/i.test(`${uncertainOut.rule} ${uncertainOut.branch}`) &&
      /assessment/i.test(uncertainOut.findings.join(" ")) &&
      uncertainValidated.ok === false &&
      uncertainValidated.reviews.some((row) => /REVIEW REQUIRED/.test(row) && /assessment/i.test(row)) &&
      !uncertainValidated.failures.some((row) => /unsupported assertion: assessment/i.test(row)),
    `${uncertainOut.outcome}/${uncertainOut.rule}/${uncertainOut.branch} validate.ok=${uncertainValidated.ok} reviews=${uncertainValidated.reviews.join(" | ")} failures=${uncertainValidated.failures.join(" | ")}`,
  );

  const validatorCorrectionCases = [
    { id: "27", area: "Wombwell", sentence: naturalWombwellSentence, expected: "PASS", actual: naturalIntro.outcome, branch: naturalIntro.branch, rule: naturalIntro.rule },
    { id: "27", area: "Wombwell", sentence: naturalWombwellLibrary, expected: "PASS", actual: naturalLib.outcome, branch: naturalLib.branch, rule: naturalLib.rule },
    { id: "28", area: "Wombwell", sentence: wombwellParaphrase, expected: "PASS", actual: wombwellParaOut.outcome, branch: wombwellParaOut.branch, rule: wombwellParaOut.rule },
    { id: "28", area: "Hoyland", sentence: hoylandParaphrase, expected: "PASS", actual: hoylandParaOut.outcome, branch: hoylandParaOut.branch, rule: hoylandParaOut.rule },
    { id: "29", area: "Hoyland", sentence: extraClauseSentence, expected: "FAIL", actual: extraClauseOut.outcome, branch: extraClauseOut.branch, rule: extraClauseOut.rule },
    { id: "30", area: "Hoyland", sentence: numberSentence, expected: "FAIL", actual: numberOut.outcome, branch: numberOut.branch, rule: numberOut.rule },
    { id: "30", area: "Hoyland", sentence: dateSentence, expected: "FAIL", actual: dateOut.outcome, branch: dateOut.branch, rule: dateOut.rule },
    { id: "30", area: "Hoyland", sentence: localitySentence, expected: "FAIL", actual: localityOut.outcome, branch: localityOut.branch, rule: localityOut.rule },
    { id: "30", area: "Hoyland", sentence: referralSentence, expected: "FAIL", actual: referralPageFail ? "FAIL" : referralOut.outcome, branch: "AFFILIATION / implied-affiliation", rule: "implied-affiliation" },
    { id: "32", area: "Wombwell", sentence: uncertainSentence, expected: "REVIEW REQUIRED", actual: uncertainOut.outcome, branch: uncertainOut.branch, rule: uncertainOut.rule },
  ];
  const correctionResultsPath = path.join(
    ROOT,
    "data/pharmacy-ai-local-copy-checkpoints/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T13-40Z-writing-contract-defects/replay/validator-correction-cases.json",
  );
  fs.mkdirSync(path.dirname(correctionResultsPath), { recursive: true });
  fs.writeFileSync(
    correctionResultsPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), naturalValidatedOk: naturalValidated.ok, uncertainBlocksAcceptance: uncertainValidated.ok === false, cases: validatorCorrectionCases, fourSavedDrafts: fourReplays.map((row) => ({ file: row.name, ok: row.validated.ok, failures: row.validated.failures, reviews: row.validated.reviews })) }, null, 2)}\n`,
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
