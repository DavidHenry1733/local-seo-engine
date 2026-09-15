#!/usr/bin/env npx tsx
/**
 * Provider-free proof that the accepted Brook Gemini generator is the active
 * Create new campaign path. Does not call Gemini, OpenAI, Places or DataForSEO.
 * Does not start a campaign, write candidates, publish or index.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  CAMPAIGN_HISTORICAL_RUN_FILENAME,
  CAMPAIGN_NEW_CAMPAIGN_GENERATOR,
  loadCampaignRegenerationRun,
} from "../src/pharmacy/growthEngineCampaignBuilderRegenerationRunService.ts";
import {
  buildCampaignRegenerationPreview,
  nextCandidateVersion,
  listExistingCandidateVersions,
} from "../src/pharmacy/growthEngineCampaignBuilderRegenerationService.ts";
import { CB_UX_CONTINUE_V6_REGENERATION, CB_UX_REGENERATE_CAMPAIGN } from "../src/pharmacy/growthEngineCampaignBuilderUxV2.ts";
import {
  UK_LOCAL_INTRODUCTION_GEMINI_MODEL,
  UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE,
  UK_LOCAL_INTRODUCTION_WRITER_PROVIDER,
  buildUkLocalIntroductionProseChatRequest,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts";

const ROOT = path.join(import.meta.dirname, "..");
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const CHECKPOINT =
  "data/pharmacy-ai-local-copy-checkpoints/brook-pharmacy-demo-derby/pharmacy-first/v3/accepted-gemini-local-pages-2026-09-08T16-59Z";

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256(rel: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function fail(connection: string): never {
  console.log(`ACCEPTED BROOK GENERATOR RESTORE BLOCKED\n${connection}`);
  process.exit(1);
}

const writerSrc = read("src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts");
const engineSrc = read("src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts");
const candidateSrc = read("src/pharmacy/growthEngineLocalPageCandidateService.ts");
const runSrc = read("src/pharmacy/growthEngineCampaignBuilderRegenerationRunService.ts");
const previewSrc = read("src/pharmacy/growthEngineCampaignBuilderRegenerationService.ts");
const pageSrc = read("src/pharmacy/growthEngineCampaignBuilderPage.ts");
const routeSrc = read("artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts");
const validationSrc = read("src/pharmacy/contentEngine/pharmacyGroundedGeminiLocalCopyValidationV1.ts");
const assemblerSrc = read("src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts");
const rendererSrc = read("src/pharmacy/pharmacyFirstLocalNarrative.ts");
const promptSrc = read("src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts");
const checkpointWriter = read(`${CHECKPOINT}/source/src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts`);

if (UK_LOCAL_INTRODUCTION_WRITER_PROVIDER !== "gemini") {
  fail("Gemini is not the only local-copy writer.");
}
if (UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE !== false) {
  fail("OpenAI local writer is active.");
}
if (UK_LOCAL_INTRODUCTION_GEMINI_MODEL !== "gemini-3.6-flash") {
  fail("Active Gemini model is not the accepted Brook model.");
}
if (!writerSrc.includes('provider: "gemini"') || !engineSrc.includes("requestUkLocalIntroductionProseV1")) {
  fail("Campaign generator is not wired to the accepted Gemini local writer.");
}
if (writerSrc.includes("google_search") || writerSrc.includes("tools: [") || /"tools"\s*:/.test(writerSrc)) {
  fail("Accepted Gemini request still includes Google Search tools.");
}
if (checkpointWriter.includes("google_search") || checkpointWriter.includes("tools:")) {
  fail("Checkpoint writer was modified or no longer matches the accepted no-tools call.");
}
if (!writerSrc.includes("acceptedUkLocalIntroductionWritingContract") || !writerSrc.includes("Write 35–55 words") || !writerSrc.includes("Write 170–230 words in three fluent British-English paragraphs")) {
  fail("Accepted Brook prompt contract is not the active Gemini prompt.");
}
if (!writerSrc.includes("Move naturally from the area and its local healthcare needs")) {
  fail("Accepted local-introduction transition contract is missing.");
}
if (/getOpenAiIntegrationClient|chat\.completions\.create/.test(engineSrc) || /getOpenAiIntegrationClient|chat\.completions\.create/.test(writerSrc)) {
  fail("OpenAI or legacy local-copy call is still present.");
}
if (candidateSrc.includes("cleanProfileCampaign") || runSrc.includes("cleanProfileCampaign")) {
  fail("Clean-generator path is still on the active generation sequence.");
}
if (validationSrc.includes("Gemini grounding metadata missing") || engineSrc.includes("Gemini grounding metadata missing")) {
  fail("Grounding-metadata gate is still an active candidate blocker.");
}
if (!engineSrc.includes("evaluateAcceptedGeminiLocalCopyV1") || !engineSrc.includes("validateAiLocalCopyPilotV3")) {
  fail("Accepted validation is not on the generation path.");
}
if (!candidateSrc.includes("writeRecord: true") || !candidateSrc.includes("generateAiLocalCopyPilotV3(")) {
  fail("Candidates are not saved through the candidate service.");
}
if (!candidateSrc.includes("assemblePharmacyAiLocalPagePilotsV3") || !assemblerSrc.includes("assemblePharmacyAiLocalPagePilotsV3")) {
  fail("Approved service-content assembly is not on the generation path.");
}
if (!rendererSrc.includes("Following the consultation, the pharmacist will explain whether advice, suitable treatment or referral to another healthcare professional is appropriate.")) {
  fail("Renderer-owned clinical sentence is not present.");
}
if (!promptSrc.includes("applyRendererOwnedLocalCopyFieldsV3") || !engineSrc.includes("enforceEditorialDisciplineV3")) {
  fail("Renderer-owned field assembly is not applied once after Gemini copy.");
}
if (!runSrc.includes("campaigns") || !runSrc.includes("current.json") || !runSrc.includes("refusing to overwrite a historical campaign run")) {
  fail("New campaigns are not saved to unique run files.");
}
if (runSrc.includes("writeJson(campaignRegenerationRunPath")) {
  fail("saveRun still writes the historical versioned-regeneration.json file.");
}
if (runSrc.includes("return resumeCampaignBuilderVersionedRegeneration") || routeSrc.includes("continue-generation")) {
  fail("v4–v7 continuation execution is still active.");
}
if (!runSrc.includes("duplicate: true") || !runSrc.includes("inFlight")) {
  fail("Double-click protection does not prevent duplicate runs.");
}
if (!runSrc.includes("published: false") || !runSrc.includes("indexed: false")) {
  fail("New campaign path does not keep publishing and indexing off.");
}
if (CAMPAIGN_NEW_CAMPAIGN_GENERATOR !== "accepted-brook-gemini-local-pages-v1") {
  fail(`Active generator is ${CAMPAIGN_NEW_CAMPAIGN_GENERATOR}, expected accepted-brook-gemini-local-pages-v1.`);
}
if (pageSrc.includes("btnContinueV6Regeneration") || pageSrc.includes("continue-generation") || pageSrc.includes(CB_UX_CONTINUE_V6_REGENERATION)) {
  fail("Campaign Builder still exposes Continue v6.");
}
if (CB_UX_REGENERATE_CAMPAIGN !== "Create new campaign") {
  fail(`Campaign Builder action is “${CB_UX_REGENERATE_CAMPAIGN}”, expected Create new campaign.`);
}
if (!pageSrc.includes("requireExistingCampaign: false") || !pageSrc.includes("CB_UX_REGENERATE_CAMPAIGN")) {
  fail("Create new campaign is not exposed for both existing and new pharmacies.");
}
if (!routeSrc.includes("executeCampaignBuilderVersionedRegeneration")) {
  fail("Authenticated Create new campaign route is not connected.");
}

const request = buildUkLocalIntroductionProseChatRequest({
  vertical: "pharmacy",
  business: { name: "Yorkshire Pharmacy and Health Clinic", telephone: "", website: "", address: "test", coordinates: null, marketTown: "" },
  offer: { serviceName: "Pharmacy First", serviceId: "pharmacy-first", lockedClinicalFacts: { allowedCta: "" } as never, allowedCta: "" },
  locality: {
    areaName: "Darfield",
    areaSlug: "darfield",
    distanceLabel: "approximately 1.2 km in a straight line",
    distanceKm: 1.2,
    cardinalDirection: "",
    pharmacyIsInArea: false,
    neighbouringSelectedAreas: [],
    evidenceLimitations: [],
    acceptedEntities: [],
  },
  style: { roles: [], tone: "" },
  varietyHints: [],
  tenantSlug: SLUG,
  editorialFacts: [],
  editorialSufficiency: "EVIDENCE LIMITED",
  ukLocalIntroductionStyle: { id: "gemini-local-introduction", label: "Gemini local introduction", instruction: "" },
} as never);
if (request.provider !== "gemini" || request.model !== "gemini-3.6-flash") {
  fail("Active Gemini request is not the accepted Brook request type.");
}
if ("tools" in request) {
  fail("Active Gemini request still carries a tools field.");
}
if (!request.prompt.includes("Yorkshire Pharmacy and Health Clinic") || request.prompt.includes("Brook Pharmacy")) {
  fail("Prompt contract is not using the confirmed pharmacy name.");
}
if (!request.prompt.includes("HERO INTRODUCTION") || !request.prompt.includes("LOCAL INTRODUCTION")) {
  fail("Accepted hero/local prompt layout is missing.");
}

const versions = listExistingCandidateVersions(SLUG, SERVICE);
const preview = buildCampaignRegenerationPreview(SLUG, SERVICE, null, { requireExistingCampaign: false });
if (!preview) fail("Yorkshire Pharmacy First has no saved profile to create a new campaign from.");
if (preview.newCandidateVersion !== nextCandidateVersion(versions) || preview.newCandidateVersion === "v4" || preview.newCandidateVersion === "v5" || preview.newCandidateVersion === "v6" || preview.newCandidateVersion === "v7") {
  fail(`New campaign would write ${preview.newCandidateVersion}, which is not a fresh folder.`);
}
if (preview.candidateJobs.length !== 10) {
  fail(`Saved profile did not yield 10 local pages; got ${preview.candidateJobs.length}.`);
}
if (preview.savedEvidenceReused.length || preview.candidateJobs.some((job) => job.reuseSavedEvidence)) {
  fail("Preview still reuses a previous campaign or saved evidence.");
}
if (loadCampaignRegenerationRun(SLUG, SERVICE)) {
  fail("An old Yorkshire campaign run is still loaded as the active run.");
}

const html = renderCampaignBuilderPage(SLUG, "choose");
if (!html.includes("Create new campaign")) {
  fail("Campaign Builder choose step does not expose Create new campaign.");
}
if (html.includes("Create new campaign version") || html.includes("Continue v6 regeneration") || html.includes("continue-generation")) {
  fail("Campaign Builder still exposes a v4–v7 continuation or clean-generator action.");
}

const expectedHistory: Record<string, string> = {
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/versioned-regeneration.json":
    "6cdd81299572db7df89d319a183c5fdf239f8a5d4b810c4e451d5f60648fd4bf",
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/current.json":
    "da0feb99fca4a7124bf3b01885a3d3528dabbd84307693d5dee9ba04893327ee",
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/campaigns/ccf61506-b909-4840-8344-4afaa091f43e.json":
    "d6fd205e3d6bb8d232d0cbd16a38049d767722e0e835a25995666adaab5f73bd",
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
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/service/index.html":
    "8db8eddb4626d8f7290e114c13fb9490d799b2687013b83180e22bd5673862e4",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v5/service/index.html":
    "96f0bafeb320bf829b03c98fb4180e5e29d6e410aef09054a483caac88907896",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v6/service/index.html":
    "511bbb0134a64eae0e5d69790354fb8dea3f848a5995387a4340c7b0dabe0d62",
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v7/service/index.html":
    "65019209ad86768312c1ec7387a4b6d77e14c24898809917d654e5b5add5f470",
};
for (const [rel, expected] of Object.entries(expectedHistory)) {
  if (sha256(rel) !== expected) fail(`Yorkshire history changed: ${rel}`);
}

const manifest = JSON.parse(read(`${CHECKPOINT}/MANIFEST.json`)) as {
  sourceWorkflowSha256: Record<string, string>;
  candidateCopyHashes: Record<string, { path: string; sha256: string }>;
  candidateHtmlHashes: Record<string, { path: string; sha256: string }>;
  campaignRun: { path: string; sha256: string };
};
for (const [rel, expected] of Object.entries(manifest.sourceWorkflowSha256)) {
  const checkpointRel = `${CHECKPOINT}/source/${rel}`;
  if (sha256(checkpointRel) !== expected) fail(`Checkpoint was modified: ${rel}`);
}
for (const row of Object.values(manifest.candidateCopyHashes)) {
  if (sha256(row.path) !== row.sha256) fail(`Brook accepted candidate copy changed: ${row.path}`);
}
for (const row of Object.values(manifest.candidateHtmlHashes)) {
  if (sha256(row.path) !== row.sha256) fail(`Brook accepted candidate html changed: ${row.path}`);
}
if (sha256(manifest.campaignRun.path) !== manifest.campaignRun.sha256) {
  fail("Brook accepted campaign run changed.");
}

const historicalPath = path.join(
  ROOT,
  "data/pharmacy-local-page-campaign-runs",
  SLUG,
  SERVICE,
  CAMPAIGN_HISTORICAL_RUN_FILENAME,
);
if (!fs.existsSync(historicalPath)) fail("Yorkshire v6 historical run file is missing.");

console.log(
  [
    "ACCEPTED BROOK GENERATOR RESTORE PASS",
    `generator=${CAMPAIGN_NEW_CAMPAIGN_GENERATOR}`,
    `writer=${UK_LOCAL_INTRODUCTION_WRITER_PROVIDER}:${UK_LOCAL_INTRODUCTION_GEMINI_MODEL}`,
    `action=${CB_UX_REGENERATE_CAMPAIGN}`,
    `nextVersion=${preview.newCandidateVersion}`,
    `areas=${preview.candidateJobs.length}`,
    "noGeminiCall=true",
    "noCandidateWrite=true",
    "noPublish=true",
    "noIndex=true",
  ].join("\n"),
);
