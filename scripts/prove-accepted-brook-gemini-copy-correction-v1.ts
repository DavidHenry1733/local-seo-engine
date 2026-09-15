#!/usr/bin/env npx tsx
/**
 * Provider-free proof that the restored Brook Gemini generator may send one
 * same-writer correction inside an area job when validation fails only for
 * correctable copy defects. Does not call Gemini, OpenAI, Places or DataForSEO.
 * Does not start a campaign, write candidates, publish, index, or change v4–v8.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  CAMPAIGN_NEW_CAMPAIGN_GENERATOR,
} from "../src/pharmacy/growthEngineCampaignBuilderRegenerationRunService.ts";
import { CB_UX_CONTINUE_V6_REGENERATION, CB_UX_REGENERATE_CAMPAIGN } from "../src/pharmacy/growthEngineCampaignBuilderUxV2.ts";
import type { AiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import type { BusinessLocalityCopyInputV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  canPersistAcceptedGeminiLocalCopy,
  evaluateAcceptedGeminiLocalCopyV1,
  shouldAttemptAcceptedGeminiCopyCorrection,
} from "../src/pharmacy/contentEngine/pharmacyGroundedGeminiLocalCopyValidationV1.ts";
import {
  buildUkLocalIntroductionCorrectionChatRequest,
  buildUkLocalIntroductionProseChatRequest,
  UK_LOCAL_INTRODUCTION_GEMINI_MODEL,
  UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE,
  UK_LOCAL_INTRODUCTION_WRITER_PROVIDER,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts";

const ROOT = path.join(import.meta.dirname, "..");
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256(rel: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function fail(connection: string): never {
  console.log(`ACCEPTED BROOK COPY CORRECTION BLOCKED\n${connection}`);
  process.exit(1);
}

const writerSrc = read("src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts");
const engineSrc = read("src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts");
const validationSrc = read("src/pharmacy/contentEngine/pharmacyGroundedGeminiLocalCopyValidationV1.ts");
const candidateSrc = read("src/pharmacy/growthEngineLocalPageCandidateService.ts");
const runSrc = read("src/pharmacy/growthEngineCampaignBuilderRegenerationRunService.ts");
const pageSrc = read("src/pharmacy/growthEngineCampaignBuilderPage.ts");
const routeSrc = read("artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts");

if (UK_LOCAL_INTRODUCTION_WRITER_PROVIDER !== "gemini") fail("Gemini is not the only local-copy writer.");
if (UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE !== false) fail("OpenAI local writer is active.");
if (UK_LOCAL_INTRODUCTION_GEMINI_MODEL !== "gemini-3.6-flash") fail("Active Gemini model is not the accepted Brook model.");
if (CAMPAIGN_NEW_CAMPAIGN_GENERATOR !== "accepted-brook-gemini-local-pages-v1") {
  fail(`Active generator is ${CAMPAIGN_NEW_CAMPAIGN_GENERATOR}.`);
}
if (!engineSrc.includes("shouldAttemptAcceptedGeminiCopyCorrection") || !engineSrc.includes("tryOnce(correction)")) {
  fail("Area job does not send one same-writer correction after correctable validation.");
}
if (!engineSrc.includes("persistAttempt(2") || /persistAttempt\(\s*3/.test(engineSrc)) {
  fail("Correction path is not capped at two Gemini calls for one area.");
}
if (!engineSrc.includes("canPersistAcceptedGeminiLocalCopy") || !candidateSrc.includes("writeRecord: true")) {
  fail("Only passing copy is not gated before the candidate-service save.");
}
if (engineSrc.includes("getOpenAiIntegrationClient") || writerSrc.includes("chat.completions.create")) {
  fail("OpenAI local-copy call is present.");
}
if (writerSrc.includes("google_search") || writerSrc.includes("tools: [")) {
  fail("Gemini request still includes Google Search tools.");
}
if (runSrc.includes("return resumeCampaignBuilderVersionedRegeneration") || routeSrc.includes("continue-generation")) {
  fail("Continuation route is present.");
}
if (!runSrc.includes("duplicate: true") || !runSrc.includes("inFlight")) {
  fail("Duplicate clicks are not blocked.");
}
if (!runSrc.includes("published: false") || !runSrc.includes("indexed: false")) {
  fail("Publication or indexing is not held false.");
}
if (pageSrc.includes("btnContinueV6Regeneration") || pageSrc.includes(CB_UX_CONTINUE_V6_REGENERATION)) {
  fail("Campaign Builder still exposes Continue v6.");
}
if (CB_UX_REGENERATE_CAMPAIGN !== "Create new campaign") {
  fail(`Campaign Builder action is “${CB_UX_REGENERATE_CAMPAIGN}”.`);
}

const goldthorpeLog = JSON.parse(
  read(
    "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/goldthorpe/2026-09-09T15-36-00-205Z-attempt-1.json",
  ),
) as {
  parsedCopy: AiLocalCopyV3;
  validationResult: { failures: string[] };
};
const leakingCopy = goldthorpeLog.parsedCopy;
const selectedAreas = [
  "Darfield",
  "Wombwell",
  "Worsbrough",
  "Thurnscoe",
  "Grimethorpe",
  "Goldthorpe",
  "Hoyland",
  "Cudworth",
  "Royston",
  "Chapeltown",
];
const input = {
  tenantSlug: SLUG,
  business: {
    name: "Yorkshire Pharmacy & Health Clinic",
    telephone: "",
    website: "",
    address: "Darfield",
    coordinates: null,
    marketTown: "Darfield",
  },
  offer: {
    serviceName: "Pharmacy First",
    serviceId: SERVICE,
    lockedClinicalFacts: { allowedCta: "" },
    allowedCta: "",
  },
  locality: {
    areaName: "Goldthorpe",
    areaSlug: "goldthorpe",
    distanceLabel: "approximately 4.8 km in a straight line",
    distanceKm: 4.8,
    cardinalDirection: "",
    pharmacyIsInArea: false,
    neighbouringSelectedAreas: selectedAreas.filter((name) => name !== "Goldthorpe"),
    evidenceLimitations: [],
    acceptedEntities: [],
  },
  style: { roles: [], tone: "" },
  varietyHints: [],
  editorialFacts: [],
  editorialSufficiency: "EVIDENCE LIMITED",
} as unknown as BusinessLocalityCopyInputV3;

const leaking = evaluateAcceptedGeminiLocalCopyV1({
  copy: leakingCopy,
  input,
  grounding: null,
  expectedSlug: SLUG,
  expectedServiceId: SERVICE,
  expectedAreaName: "Goldthorpe",
});
if (leaking.ok || !leaking.failures.includes("another-area leakage: Thurnscoe")) {
  fail(`Goldthorpe leakage fixture did not fail as another-area leakage: ${leaking.failures.join(" | ")}`);
}
if (
  !shouldAttemptAcceptedGeminiCopyCorrection({
    failures: leaking.failures,
    uncertain: false,
    providerError: false,
  })
) {
  fail("another-area leakage did not trigger one correction.");
}
if (
  shouldAttemptAcceptedGeminiCopyCorrection({
    failures: leaking.failures,
    uncertain: true,
    providerError: false,
  }) ||
  shouldAttemptAcceptedGeminiCopyCorrection({
    failures: leaking.failures,
    uncertain: false,
    providerError: true,
  })
) {
  fail("Provider, authentication, quota or network failures would be retried.");
}
if (
  shouldAttemptAcceptedGeminiCopyCorrection({
    failures: ["incorrect tenant: expected other-pharmacy", "another-area leakage: Thurnscoe"],
    uncertain: false,
    providerError: false,
  })
) {
  fail("Mixed non-correctable failures still trigger a correction.");
}

const rejectedCopy = [
  "HERO INTRODUCTION:",
  leakingCopy.heroIntroduction,
  "",
  "LOCAL INTRODUCTION:",
  leakingCopy.localIntroduction,
].join("\n");
const correction = buildUkLocalIntroductionCorrectionChatRequest(input, {
  rejectedCopy,
  defects: leaking.failures,
});
const normal = buildUkLocalIntroductionProseChatRequest(input);
if (correction.provider !== "gemini" || correction.model !== "gemini-3.6-flash") {
  fail("Correction is not the same Gemini writer.");
}
if ("tools" in correction || "tools" in normal) fail("Correction request carries tools.");
if (!correction.prompt.includes("Selected area: Goldthorpe")) {
  fail("Correction is not restricted to Goldthorpe.");
}
if (!correction.prompt.includes("Do not name these other selected campaign areas:")) {
  fail("Correction does not forbid other selected campaign areas.");
}
for (const sibling of selectedAreas.filter((name) => name !== "Goldthorpe")) {
  if (!correction.prompt.includes(sibling)) fail(`Correction omitted forbidden area ${sibling}.`);
}
if (!correction.prompt.includes("another-area leakage: Thurnscoe")) {
  fail("Correction does not include the exact validator defect.");
}
if (!correction.prompt.includes(rejectedCopy)) fail("Correction does not include the rejected copy.");
if (!correction.prompt.includes("rewrite this rejected copy once for the selected area only")) {
  fail("Correction is not a single selected-area rewrite.");
}
if (canPersistAcceptedGeminiLocalCopy({ ok: leaking.ok, copy: leakingCopy })) fail("Failing copy can be saved.");
const passingCopy: AiLocalCopyV3 = {
  ...leakingCopy,
  localIntroduction: leakingCopy.localIntroduction.replace(/\bThurnscoe\b/g, "the neighbouring settlement"),
};
const passing = evaluateAcceptedGeminiLocalCopyV1({
  copy: passingCopy,
  input,
  grounding: null,
  expectedSlug: SLUG,
  expectedServiceId: SERVICE,
  expectedAreaName: "Goldthorpe",
});
if (!passing.ok) fail(`Corrected Goldthorpe-only copy still fails: ${passing.failures.join(" | ")}`);
if (!canPersistAcceptedGeminiLocalCopy({ ok: passing.ok, copy: passingCopy })) fail("Passing copy cannot be saved.");
if (
  shouldAttemptAcceptedGeminiCopyCorrection({
    failures: passing.failures,
    uncertain: false,
    providerError: false,
  })
) {
  fail("Passing copy would still send a second Gemini call.");
}

const html = renderCampaignBuilderPage(SLUG, "choose");
if (!html.includes("Create new campaign")) fail("Create new campaign is not exposed.");
if (html.includes("Create new campaign version") || html.includes("Continue v6 regeneration") || html.includes("continue-generation")) {
  fail("Campaign Builder still exposes a continuation action.");
}

const expectedHistory: Record<string, string> = {
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/versioned-regeneration.json":
    "6cdd81299572db7df89d319a183c5fdf239f8a5d4b810c4e451d5f60648fd4bf",
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/current.json":
    "797d64533ed38bc83e5f8f7520d2b65adce4ffdc64a73eb696cbb59895462b4a",
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/campaigns/ccf61506-b909-4840-8344-4afaa091f43e.json":
    "d6fd205e3d6bb8d232d0cbd16a38049d767722e0e835a25995666adaab5f73bd",
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/campaigns/02df6dc9-2ec1-4d64-8601-32ae93a78475.json":
    "85634c49a4eefe9b7ba340a2ccbe3fb7539600b339d3edbde21a65e875a58883",
  "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/darfield.json":
    "f3ef9940c20101ed0ba9a85550bb55fd6de86edf384819af4f11d4d845d660ac",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/darfield/2026-09-09T09-33-20-010Z-attempt-1.json":
    "5e49f4ff21be93276baae46100300a36024e1ddb52b391e8a6a16dcf930107ac",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v5/darfield/2026-09-09T11-36-08-858Z-attempt-1.json":
    "ffb662e29ed55dab8e004e1a6445950e02315a3566b5d1eb0b4240310ab1ab8f",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v6/darfield/2026-09-09T12-16-05-900Z-attempt-1.json":
    "18a50a4dcc89c86e47358367de6883418721d7506dca39ecb8d41747517bd080",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v6/darfield/2026-09-09T13-01-04-848Z-attempt-1.json":
    "412f507a7dec139bb346ddd4c9dcd9e92f414e32b4b9841d8228b66077bfcbf5",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v7/darfield/2026-09-09T14-23-07-588Z-attempt-1.json":
    "642a73b09292e000c60a8286482091656c823274badd879513bd8070adb553a6",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/goldthorpe/2026-09-09T15-36-00-205Z-attempt-1.json":
    "7ad20b71333af81ab75a3239b2ea17cfc27ab18dbea9263d7804698a8d4fda0a",
  "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/darfield.json":
    "96f45b767ae98743aa1b2228e98ef9335fb4228c3d93cfb7f9ab13f52ede97f8",
  "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/grimethorpe.json":
    "d09e37f2e1c9efb1e4e67269c3ec1fa64105f364e7324138cecf80f9b4b04c53",
  "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/thurnscoe.json":
    "696a2d4ed6c0dec2d12e2e0c46e69a001bc01a0f2d672877e1b908cfc69b9216",
  "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/wombwell.json":
    "5306c531e4415c59e8ee95c1d5dc9e20e5c9bdc3caf87d69d29ddf19b0cde6e2",
  "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/worsbrough.json":
    "17c212142bde8dae26bc699af821796ee613ca3e757870820ec5e7d04ce9cad9",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/service/index.html":
    "8db8eddb4626d8f7290e114c13fb9490d799b2687013b83180e22bd5673862e4",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v5/service/index.html":
    "96f0bafeb320bf829b03c98fb4180e5e29d6e410aef09054a483caac88907896",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v6/service/index.html":
    "511bbb0134a64eae0e5d69790354fb8dea3f848a5995387a4340c7b0dabe0d62",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v7/service/index.html":
    "65019209ad86768312c1ec7387a4b6d77e14c24898809917d654e5b5add5f470",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/service/index.html":
    "693541ebe16bcf8490c70d09e9115ec9203341d29821c8d7c1c0721a4f843a21",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/local/darfield/index.html":
    "a30a6e231ad1b8d54537c981a51227e6c09b0381853bb166faeb1e1348fcd59a",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/local/grimethorpe/index.html":
    "4d5df27f9b9c5060829703eabf822f58d9dbbd7840fb91af76bce345538cd229",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/local/thurnscoe/index.html":
    "c2f24191b0cc3e6690b0724d5c1a93f35641a1983387f78f62d1cc7880f1a238",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/local/wombwell/index.html":
    "d6953c2d07c445fd10cbbbdfa77ad6bc388264c6a726322f45049935427ca4bc",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v8/local/worsbrough/index.html":
    "b16e1bd7903560ae94f7b4102a20a188aaa6c34fbd4d1bb6f52f136f85601c21",
};
for (const [rel, expected] of Object.entries(expectedHistory)) {
  if (sha256(rel) !== expected) fail(`Yorkshire history changed: ${rel}`);
}
void validationSrc;

console.log(
  [
    "ACCEPTED BROOK COPY CORRECTION PASS",
    `generator=${CAMPAIGN_NEW_CAMPAIGN_GENERATOR}`,
    `writer=${UK_LOCAL_INTRODUCTION_WRITER_PROVIDER}:${UK_LOCAL_INTRODUCTION_GEMINI_MODEL}`,
    "leakageTriggersOneCorrection=true",
    "correctionRestrictedToSelectedArea=true",
    "onlyPassingCopySaved=true",
    "duplicateClicksBlocked=true",
    "published=false",
    "indexed=false",
    `action=${CB_UX_REGENERATE_CAMPAIGN}`,
    "noGeminiCall=true",
    "noCandidateWrite=true",
    "v4toV8Unchanged=true",
    "v9NotStarted=true",
  ].join("\n"),
);
