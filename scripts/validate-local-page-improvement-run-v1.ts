#!/usr/bin/env npx tsx
/**
 * Provider-free regression for the campaign-level V2 local-page improvement run.
 * Does not call Places, DataForSEO or OpenAI.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  confirmLocalPageImprovementCampaign,
  IMPROVE_LOCAL_PAGES_LABEL,
  LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD,
  planLocalPageImprovementCampaign,
  snapshotRejectedV1LocalPages,
} from "../src/pharmacy/growthEngineLocalPageImprovementRunService.ts";
import { planRemainingLocalPagesCampaign } from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";
import {
  improvedLocalPageGenerationBlocker,
  LOCAL_PAGE_OPENAI_CALL_LIMIT_EXHAUSTED,
  preflightOneLocalPageCandidate,
} from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import {
  resolveUkLocalPagePlacesAreaReference,
  ukLocalPagePlacesSearchSpecs,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import { resolveGeographicEvidenceContext } from "../src/pharmacy/contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import {
  evaluateAiLocalCopyQualityV3,
  evaluateImprovedLocalPageCandidateQualityV1,
  MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import type { AiLocalCopyV1 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import type { EditorialFactV3 } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1, PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3, buildAiLocalNarrativeWritingBriefV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { selectLocalNarrativePromptFactsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { assertLocalNarrativeEvidenceBindingsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEvidenceBindingV3.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SERVICE = "pharmacy-first";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";

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

function emptyCopy(area: string, extras: Partial<AiLocalCopyV1> = {}): AiLocalCopyV1 {
  return {
    area,
    heroHeading: `Pharmacy First in ${area}`,
    heroIntroduction: `Pharmacy First for people in ${area} is provided by Brook Pharmacy Demo Derby.`,
    localIntroduction: `Pharmacy First for people in ${area} is provided by Brook Pharmacy Demo Derby.`,
    localContextHeading: `${area} local context`,
    localContextParagraphs: [],
    relationshipToPharmacy: `Brook Pharmacy Demo Derby is not in ${area}.`,
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    ...extras,
  };
}

function fact(areaSlug: string, id: string, statement: string, category: EditorialFactV3["category"] = "community"): EditorialFactV3 {
  return {
    factId: `${areaSlug}:${category}:${id}`,
    area: areaSlug,
    areaSlug,
    category,
    normalizedStatement: statement,
    sourceTitle: "Council",
    sourceUrl: "https://example.gov.uk/page",
    publisher: "Council",
    retrievedAt: "2026-09-07T00:00:00.000Z",
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: "high",
    usefulnessToPharmacyFirstReader: "local",
    permittedCopyRole: "neutral-community-context",
    prohibitedInference: "none",
    validationStatus: "accepted",
  };
}

const input = {
  vertical: "pharmacy",
  business: {
    name: "Brook Pharmacy Demo Derby",
    telephone: "01332 445 076",
    website: "https://example.com",
    address: "56 West Burton Road, Derby",
    coordinates: { latitude: 52.9, longitude: -1.48 },
    marketTown: "Derby",
  },
  offer: {
    serviceName: "Pharmacy First",
    serviceId: SERVICE,
    lockedClinicalFacts: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
    allowedCta: ["Book An Appointment"],
  },
  locality: {
    areaName: "Allestree",
    areaSlug: "allestree",
    distanceLabel: "4.1 km",
    distanceKm: 4.1,
    cardinalDirection: "",
    pharmacyIsInArea: false,
    neighbouringSelectedAreas: ["Mickleover"],
    evidenceLimitations: [],
    acceptedEntities: [],
  },
  style: { roles: ["local context"], tone: "calm" },
};

const plan = planLocalPageImprovementCampaign(BROOK_DERBY_DEMO_SLUG, SERVICE);
record(
  "plan-covers-ten-areas-none-skipped",
  plan.areas.length === 10 && plan.maxGenerationCalls === 10,
  `areas=${plan.areas.length} openai=${plan.maxGenerationCalls}`,
);
record(
  "plan-within-hard-maximum",
  plan.maxTotalCostUsd <= LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD && plan.exceedsHardMaximum === false,
  `maxTotal=${plan.maxTotalCostUsd} hard=${LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD}`,
);
record(
  "plan-counts-saved-evidence-and-additional-calls",
  plan.evidenceAlreadySavedCount >= 9 && plan.additionalProviderCalls > 0 && plan.maxEvidenceCalls === plan.additionalProviderCalls,
  `saved=${plan.evidenceAlreadySavedCount} additional=${plan.additionalProviderCalls}`,
);

const html = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "allestree" });
record(
  "confirmation-panel-shows-ten-areas-and-ceiling",
  html.includes('data-improve-local-pages="true"') &&
    html.includes(IMPROVE_LOCAL_PAGES_LABEL) &&
    html.includes("data-area-count=\"10\"") &&
    html.includes("Evidence already saved") &&
    html.includes("Proposed additional provider calls") &&
    html.includes("Maximum OpenAI calls") &&
    html.includes("Maximum total cost") &&
    /data-max-generation-calls="10"/.test(html) &&
    html.includes(`$${LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD.toFixed(3)}`),
  "authenticated confirmation panel lists all ten areas, saved evidence, additional calls, ten OpenAI calls and the cost ceiling",
);

const remaining = planRemainingLocalPagesCampaign(BROOK_DERBY_DEMO_SLUG, SERVICE);
record(
  "remaining-campaign-still-skips-valid-v1",
  remaining.remaining.length === 0 && remaining.complete.length === 10,
  `remaining=${remaining.remaining.length} complete=${remaining.complete.length}`,
);

const allestreePreflight = preflightOneLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree");
record(
  "remaining-preflight-still-blocks-saved-or-exhausted",
  allestreePreflight.existingCandidate === true && allestreePreflight.canGenerate === false,
  `existing=${allestreePreflight.existingCandidate} canGenerate=${allestreePreflight.canGenerate} blocker=${allestreePreflight.blocker || "none"}`,
);
record(
  "improvement-generation-allows-saved-v1-and-exhausted-calls",
  improvedLocalPageGenerationBlocker(allestreePreflight) === null &&
    (allestreePreflight.blocker === null || allestreePreflight.blocker === LOCAL_PAGE_OPENAI_CALL_LIMIT_EXHAUSTED),
  `improvementBlocker=${improvedLocalPageGenerationBlocker(allestreePreflight) || "none"} remainingCalls=${allestreePreflight.generationAllowance.remainingCalls}`,
);
const candidateSrc = fs.readFileSync(
  path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/growthEngineLocalPageCandidateService.ts"),
  "utf8",
);
record(
  "improvement-generate-uses-grant-and-quality-flag",
  /requireImprovedLocalQuality/.test(candidateSrc) &&
    /improvedLocalPageGenerationBlocker/.test(candidateSrc) &&
    /grantOneLocalPageGenerateCallIfNeededV3/.test(candidateSrc),
  "generateOneLocalPageCandidate grants one extra OpenAI call and skips saved-candidate/exhausted-call blockers only for the improvement path",
);

const geo = resolveGeographicEvidenceContext({
  slug: BROOK_DERBY_DEMO_SLUG,
  areaName: "Allestree",
  areaSlug: "allestree",
  siblingAreaNames: ["Mickleover"],
});
const specs = ukLocalPagePlacesSearchSpecs(geo);
record(
  "places-specs-recover-hospital-landmark-community",
  specs.some((row) => row.id === "places-gp-practices" && row.required) &&
    specs.some((row) => row.id === "places-hospitals" && row.required === false) &&
    specs.some((row) => row.id === "places-landmarks" && row.required === false) &&
    specs.some((row) => row.id === "places-community" && row.required === false) &&
    !specs.some((row) => /schools|retail|transport/i.test(row.id)),
  specs.map((row) => row.id).join(","),
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "local-page-improvement-"));
const snapshot = snapshotRejectedV1LocalPages(
  BROOK_DERBY_DEMO_SLUG,
  SERVICE,
  plan.areas,
  tmp,
);
const liveAllestree = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
);
record(
  "v1-snapshot-preserves-live-hash",
  Boolean(snapshot.copyHashes.allestree) &&
    snapshot.copyHashes.allestree === createHash("sha256").update(fs.readFileSync(liveAllestree)).digest("hex"),
  `allestree=${snapshot.copyHashes.allestree}`,
);

const facts = [
  fact("allestree", "park", "Allestree Park is named on the local-authority page."),
  fact("allestree", "board", "Allestree has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services."),
  fact("allestree", "gp", "NHS general practice services in Allestree are provided from Park Farm Medical Centre.", "healthcare"),
];
const good = evaluateImprovedLocalPageCandidateQualityV1(
  emptyCopy("Allestree", {
    localContextParagraphs: [
      "Allestree Park is named on the local-authority page, and Allestree has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services.",
      "NHS general practice services in Allestree are provided from Park Farm Medical Centre.",
    ],
    evidenceClaims: [
      { field: "localContextParagraphs", sentence: "Allestree Park is named on the local-authority page, and Allestree has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services.", editorialFactId: "allestree:community:park" },
      { field: "localContextParagraphs", sentence: "NHS general practice services in Allestree are provided from Park Farm Medical Centre.", editorialFactId: "allestree:healthcare:gp" },
    ],
    editorialFactIdsUsed: ["allestree:community:park", "allestree:community:board", "allestree:healthcare:gp"],
  } as AiLocalCopyV1 & { editorialFactIdsUsed: string[] }),
  input,
  facts,
);
record(
  "quality-accepts-three-distinct-refs",
  good.ok && good.localReferences.length >= MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2,
  `ok=${good.ok} refs=${good.localReferences.join(" | ")} failures=${good.failures.join(" | ")}`,
);

const dup = evaluateImprovedLocalPageCandidateQualityV1(
  emptyCopy("Allestree", {
    localContextParagraphs: [
      "Allestree Park is named on the local-authority page.",
      "Allestree Park is named on the local-authority page.",
    ],
    evidenceClaims: [
      { field: "localContextParagraphs", sentence: "Allestree Park is named on the local-authority page.", editorialFactId: "allestree:community:park" },
    ],
    editorialFactIdsUsed: ["allestree:community:park"],
  } as AiLocalCopyV1 & { editorialFactIdsUsed: string[] }),
  input,
  facts,
);
record("quality-rejects-repeated-sentence", dup.ok === false && dup.failures.some((row) => /repeated sentence/i.test(row)), dup.failures.join(" | "));

const twice = evaluateImprovedLocalPageCandidateQualityV1(
  emptyCopy("Allestree", {
    localContextParagraphs: [
      "Allestree Park is named on the local-authority page.",
      "Allestree has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services.",
    ],
    evidenceClaims: [
      { field: "localContextParagraphs", sentence: "Allestree Park is named on the local-authority page.", editorialFactId: "allestree:community:park" },
      { field: "localContextParagraphs", sentence: "Allestree has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services.", editorialFactId: "allestree:community:park" },
    ],
    editorialFactIdsUsed: ["allestree:community:park"],
  } as AiLocalCopyV1 & { editorialFactIdsUsed: string[] }),
  input,
  facts,
);
record("quality-rejects-fact-used-twice", twice.ok === false && twice.failures.some((row) => /more than once/i.test(row)), twice.failures.join(" | "));

const thin = evaluateImprovedLocalPageCandidateQualityV1(
  emptyCopy("Allestree", {
    localContextParagraphs: ["Allestree Park is named on the local-authority page."],
    evidenceClaims: [
      { field: "localContextParagraphs", sentence: "Allestree Park is named on the local-authority page.", editorialFactId: "allestree:community:park" },
    ],
    editorialFactIdsUsed: ["allestree:community:park"],
  } as AiLocalCopyV1 & { editorialFactIdsUsed: string[] }),
  input,
  facts,
);
record(
  "quality-rejects-fewer-than-three-refs",
  thin.ok === false && thin.failures.some((row) => /fewer than 3/i.test(row)),
  thin.failures.join(" | "),
);

const emptyIntro = evaluateAiLocalCopyQualityV3(
  emptyCopy("Allestree", { localIntroduction: "", localContextParagraphs: [] }),
  input,
);
record(
  "missing-local-account-still-fails",
  emptyIntro.ok === false && emptyIntro.failures.some((row) => /missing-local-account/i.test(row)),
  emptyIntro.failures.join(" | ") || "no failures",
);

const ceiling = await confirmLocalPageImprovementCampaign({
  slug: BROOK_DERBY_DEMO_SLUG,
  serviceId: SERVICE,
  confirmAuthorise: true,
  authenticatedSlug: BROOK_DERBY_DEMO_SLUG,
  processInline: true,
  deps: {
    runRoot: tmp,
    snapshotRoot: tmp,
    listSelectedAreas: () => plan.areas.map((row) => ({ areaName: row.areaName, areaSlug: row.areaSlug })),
    processArea: async () => ({ ok: true, stage: "save" }),
  },
});
record(
  "confirm-within-ceiling-authorises-ten-openai",
  ceiling.ok === true && ceiling.ok && ceiling.plan.maxGenerationCalls === 10 && ceiling.plan.maxTotalCostUsd <= LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD,
  ceiling.ok ? `run=${ceiling.run.runId} status=${ceiling.run.status} total=${ceiling.plan.maxTotalCostUsd}` : ceiling.error,
);

record(
  "writer-forbids-evaluative-identity-colour",
  PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3.includes("distinct local identity") &&
    PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3.includes("residents and visitors alike") &&
    /Restate each used verified fact in close wording of its normalizedStatement/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")) &&
    /at most three localContextParagraphs/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")) &&
    /If a verified fact only states that the area is a ward/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")) &&
    /Do not write localContextHeading/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")) &&
    /Name at most one Medical Centre, Health Centre, Surgery or Practice/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")) &&
    /Open localContextParagraphs with a named civic, landmark or community fact unique to this area/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")) &&
    /Do not include the locked clinical sentence in localContextParagraphs/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")) &&
    PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3.includes("recognised resource") &&
    /If a verified fact says a place is listed as a community facility or landmark, copy that statement and stop/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")) &&
    /Use three distinct named local references. Leave unused facts unused/i.test(buildAiLocalNarrativeWritingBriefV3("Allestree")),
  "improvement writer restates verified facts, caps paragraphs, and bans ungrounded identity colour",
);

function stubFact(partial: Pick<EditorialFactV3, "factId" | "category" | "normalizedStatement">): EditorialFactV3 {
  return {
    area: "Wombwell",
    areaSlug: "wombwell",
    sourceTitle: "stub",
    sourceUrl: "https://example.test",
    publisher: "NHS",
    retrievedAt: "2026-09-07T00:00:00.000Z",
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: "high",
    usefulnessToPharmacyFirstReader: "stub",
    permittedCopyRole: "neutral-community-context",
    prohibitedInference: "stub",
    validationStatus: "accepted",
    ...partial,
  };
}
const selectedPromptFacts = selectLocalNarrativePromptFactsV3(
  [
    stubFact({ factId: "wombwell:healthcare:gp-a", category: "healthcare", normalizedStatement: "NHS general practice services in Wombwell are provided from Wombwell Medical Centre." }),
    stubFact({ factId: "wombwell:healthcare:gp-b", category: "healthcare", normalizedStatement: "NHS general practice services in Wombwell are provided from Park Street Health Centre." }),
    stubFact({ factId: "wombwell:community:library", category: "community", normalizedStatement: "Wombwell Library is listed as a community facility in Wombwell." }),
    stubFact({ factId: "wombwell:community:public-library", category: "community", normalizedStatement: "Wombwell has a public library." }),
    stubFact({ factId: "wombwell:heritage:park", category: "heritage", normalizedStatement: "Wombwell Park is listed as a landmark in Wombwell." }),
    stubFact({ factId: "wombwell:heritage:other-castle", category: "heritage", normalizedStatement: "Elvaston Castle is listed as a landmark in Wombwell." }),
    stubFact({ factId: "wombwell:community:centre", category: "community", normalizedStatement: "Wombwell Community Centre is listed as a community facility in Wombwell." }),
    stubFact({ factId: "wombwell:healthcare:hospital", category: "healthcare", normalizedStatement: "Lister House at Coleman Street is listed as a hospital in Wombwell." }),
  ],
  "Wombwell",
);
record(
  "prompt-facts-cap-three-and-prefer-named-civic",
  selectedPromptFacts.length === 3 &&
    selectedPromptFacts.filter((fact) => /Medical Centre|Health Centre|hospital/i.test(fact.normalizedStatement)).length <= 1 &&
    selectedPromptFacts.some((fact) => /Wombwell Park|Wombwell Library|Wombwell Community Centre/i.test(fact.normalizedStatement)) &&
    selectedPromptFacts.every((fact) => !/Elvaston Castle/i.test(fact.normalizedStatement)),
  selectedPromptFacts.map((fact) => fact.normalizedStatement).join(" | "),
);

const deterministicKmCopy = emptyCopy("Wombwell", {
  localIntroduction: "Pharmacy First for people in Wombwell is provided by Brook Pharmacy Demo Derby.",
  localContextParagraphs: ["Wombwell Park is listed as a landmark in Wombwell."],
  relationshipToPharmacy:
    "Consultations take place at Brook Pharmacy Demo Derby in Derby. Brook Pharmacy Demo Derby is approximately 4.4 km in a straight line from Wombwell.",
  evidenceClaims: [
    {
      field: "localContextParagraphs",
      sentence: "Wombwell Park is listed as a landmark in Wombwell.",
      editorialFactId: "wombwell:heritage:wombwell-park-is-listed-as-a-landmark-in-wombwe",
    },
  ],
});
const deterministicKmBindings = assertLocalNarrativeEvidenceBindingsV3(
  deterministicKmCopy,
  { areaName: "Wombwell" },
  [
    stubFact({
      factId: "wombwell:heritage:wombwell-park-is-listed-as-a-landmark-in-wombwe",
      category: "heritage",
      normalizedStatement: "Wombwell Park is listed as a landmark in Wombwell.",
    }),
  ],
);
record(
  "deterministic-distance-does-not-need-openai-fact-id",
  deterministicKmBindings.ok === true,
  deterministicKmBindings.failures.join(" | ") || "ok",
);

const duffieldRun = JSON.parse(
  fs.readFileSync(
    path.join(
      PHARMACY_WORKSPACE_ROOT,
      "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/duffield.json",
    ),
    "utf8",
  ),
);
const duffieldRef = resolveUkLocalPagePlacesAreaReference({
  areaName: "Duffield",
  county: "Derbyshire",
  countryCode: "GB",
  siblingAreaNames: plan.areas.map((row) => row.areaName),
  pharmacyCityHint: "Derby",
  hits: duffieldRun.placesHitsByCall["places-area-reference"],
});
record(
  "saved-unique-locality-hit-resolves-area-reference",
  duffieldRef.ok === true && Number.isFinite(duffieldRef.ok ? duffieldRef.latitude : NaN),
  duffieldRef.ok
    ? `${duffieldRef.latitude},${duffieldRef.longitude}`
    : `${duffieldRef.reason}: ${duffieldRef.detail}`,
);

const collectionSrc = fs.readFileSync(
  path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts"),
  "utf8",
);
record(
  "places-facts-do-not-reference-undefined-hospital",
  /placesEntityNormalizedStatement/.test(collectionSrc) && !/&& !hospital &&/.test(collectionSrc),
  "Places editorial facts use the shared statement helper without an undefined hospital flag",
);

const yorkshire = planLocalPageImprovementCampaign(YORKSHIRE, SERVICE, {
  listSelectedAreas: () => [],
});
record("yorkshire-has-no-brook-improvement-areas", yorkshire.areas.length === 0, `areas=${yorkshire.areas.length}`);

const failed = checks.filter((row) => !row.pass);
console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((row) => row.pass).length}/${checks.length} checks`);
if (failed.length) process.exit(1);
