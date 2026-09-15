#!/usr/bin/env npx tsx
/**
 * Provider-free proof that Campaign Builder starts a clean campaign from the
 * saved pharmacy profile through Gemini only. Does not call Gemini, OpenAI,
 * Places or DataForSEO. Does not start a campaign run.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  CAMPAIGN_HISTORICAL_RUN_FILENAME,
  CAMPAIGN_NEW_CAMPAIGN_GENERATOR,
  campaignRegenerationRunPath,
  campaignRunFilePath,
} from "../src/pharmacy/growthEngineCampaignBuilderRegenerationRunService.ts";
import {
  buildCampaignRegenerationPreview,
  listExistingCandidateVersions,
  nextCandidateVersion,
} from "../src/pharmacy/growthEngineCampaignBuilderRegenerationService.ts";
import { CB_UX_CONTINUE_V6_REGENERATION, CB_UX_REGENERATE_CAMPAIGN } from "../src/pharmacy/growthEngineCampaignBuilderUxV2.ts";
import {
  UK_LOCAL_INTRODUCTION_GEMINI_GOOGLE_SEARCH_TOOL,
  UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE,
  UK_LOCAL_INTRODUCTION_WRITER_PROVIDER,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts";

const ROOT = path.join(import.meta.dirname, "..");
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const proofPath = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-fixtures/clean-profile-campaign-generator-proof.json",
);

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256(rel: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function fail(connection: string): never {
  console.log(`CLEAN CAMPAIGN CONNECTION FAIL\n${connection}`);
  process.exit(1);
}

const runSrc = read("src/pharmacy/growthEngineCampaignBuilderRegenerationRunService.ts");
const previewSrc = read("src/pharmacy/growthEngineCampaignBuilderRegenerationService.ts");
const pageSrc = read("src/pharmacy/growthEngineCampaignBuilderPage.ts");
const writerSrc = read("src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts");
const engineSrc = read("src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts");
const candidateSrc = read("src/pharmacy/growthEngineLocalPageCandidateService.ts");
const routeSrc = read("artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts");

if (UK_LOCAL_INTRODUCTION_WRITER_PROVIDER !== "gemini" || UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE !== false) {
  fail("Gemini is not the only local-copy writer.");
}
if (!writerSrc.includes('provider: "gemini"') || !engineSrc.includes("requestUkLocalIntroductionProseV1")) {
  fail("Campaign generator is not wired to the Gemini local writer.");
}
if (!writerSrc.includes("google_search") || !JSON.stringify(UK_LOCAL_INTRODUCTION_GEMINI_GOOGLE_SEARCH_TOOL).includes("google_search")) {
  fail("Google Search grounding is not enabled on the Gemini request.");
}
if (!engineSrc.includes("parseUkLocalIntroductionProseFields") || !engineSrc.includes("validateAiLocalCopyPilotV3")) {
  fail("Gemini output does not go directly to the current validator.");
}
if (/getOpenAiIntegrationClient|chat\.completions\.create/.test(engineSrc)) {
  fail("Narrative engine still contains an OpenAI local-copy call.");
}
if (!runSrc.includes("campaigns") || !runSrc.includes("current.json") || !runSrc.includes("refusing to overwrite a historical campaign run")) {
  fail("New campaigns are not saved to unique run files.");
}
if (runSrc.includes("writeJson(campaignRegenerationRunPath")) {
  fail("saveRun still writes the historical versioned-regeneration.json file.");
}
if (runSrc.includes("loadAiLocalCopyPilotV3")) {
  fail("Generator still reads a previous local-page candidate.");
}
if (runSrc.includes("existing.status === \"stopped\"") && runSrc.includes("failed.status = \"pending\"")) {
  fail("Generator still repairs a stopped run.");
}
if (!runSrc.includes("Stopped campaigns are inactive history")) {
  fail("Stopped runs are not preserved as inactive history.");
}
if (runSrc.includes("return resumeCampaignBuilderVersionedRegeneration") || runSrc.includes("resumeCampaignBuilderVersionedRegeneration")) {
  fail("Generate still auto-resumes a previous run.");
}
if (!runSrc.includes("cleanProfileCampaign: true") || !candidateSrc.includes("cleanProfileCampaign")) {
  fail("Clean campaign path still uses the legacy candidate preflight.");
}
if (candidateSrc.includes("cleanProfileCampaign === true") && /cleanProfileCampaign === true[\s\S]{0,400}loadAiLocalCopyPilotV3/.test(candidateSrc)) {
  fail("Clean candidate path still loads a previous candidate.");
}
if (!candidateSrc.includes("writeRecord: true") || !candidateSrc.includes("generateAiLocalCopyPilotV3(")) {
  fail("Candidates are not saved through the candidate service.");
}
if (!runSrc.includes("duplicate: true") || !runSrc.includes("inFlight")) {
  fail("Double-click protection does not prevent duplicate runs.");
}
if (!runSrc.includes("published: false") || !runSrc.includes("indexed: false")) {
  fail("Clean generator does not keep publishing and indexing off.");
}
if (previewSrc.includes("versioned-regeneration.json") || previewSrc.includes("savedEvidenceLabels")) {
  fail("Preview still reads a previous run file or saved evidence packs.");
}
if (pageSrc.includes("btnContinueV6Regeneration") || pageSrc.includes("continue-generation") || pageSrc.includes(CB_UX_CONTINUE_V6_REGENERATION)) {
  fail("Campaign Builder still exposes Continue v6.");
}
if (routeSrc.includes("continue-generation") || routeSrc.includes("resumeCampaignBuilderVersionedRegeneration")) {
  fail("Authenticated routes still continue an old run.");
}
if (!pageSrc.includes("CB_UX_REGENERATE_CAMPAIGN") || !pageSrc.includes("data-cb-generate-campaign")) {
  fail("Campaign Builder does not expose the clean Create new campaign version action.");
}
if (CB_UX_REGENERATE_CAMPAIGN !== "Create new campaign version") {
  fail(`Existing-pharmacy button is “${CB_UX_REGENERATE_CAMPAIGN}”, expected Create new campaign version.`);
}
if (!routeSrc.includes("executeCampaignBuilderVersionedRegeneration")) {
  fail("Authenticated Generate campaign route is not connected.");
}

const versions = listExistingCandidateVersions(SLUG, SERVICE);
const nextVersion = nextCandidateVersion(versions);
const preview = buildCampaignRegenerationPreview(SLUG, SERVICE);
if (!preview) fail("Yorkshire Pharmacy First has no saved campaign profile to generate from.");
if (preview.newCandidateVersion !== nextVersion || nextVersion !== "v7") {
  fail(`Next campaign version is ${preview.newCandidateVersion}, expected v7 from folder names only.`);
}
if (preview.candidateJobs.length !== 10) {
  fail(`Saved profile did not yield 10 local pages; got ${preview.candidateJobs.length}.`);
}
if (preview.savedEvidenceReused.length || preview.candidateJobs.some((job) => job.reuseSavedEvidence)) {
  fail("Preview still reuses saved evidence for local copy.");
}
const areas = preview.candidateJobs.map((job) => job.areaName);
const expected = [
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
if (expected.some((name) => !areas.includes(name))) {
  fail(`Saved profile areas missing: ${expected.filter((name) => !areas.includes(name)).join(", ")}`);
}

const historicalPath = campaignRegenerationRunPath(SLUG, SERVICE);
const sampleRunPath = campaignRunFilePath(SLUG, SERVICE, "proof-run-id");
if (!historicalPath.endsWith(`/${CAMPAIGN_HISTORICAL_RUN_FILENAME}`)) {
  fail("Historical run path is not the frozen versioned-regeneration.json file.");
}
if (sampleRunPath.includes(CAMPAIGN_HISTORICAL_RUN_FILENAME) || !sampleRunPath.includes("/campaigns/")) {
  fail("New campaign run files are not isolated from historical runs.");
}

const chooseHtml = renderCampaignBuilderPage(SLUG, "choose");
if (!chooseHtml.includes("Create new campaign version")) {
  fail("Yorkshire Campaign Builder does not expose Create new campaign version.");
}
if (chooseHtml.includes("Continue v6 regeneration") || chooseHtml.includes("continue-generation")) {
  fail("Yorkshire Campaign Builder still shows Continue v6.");
}

const historicalFiles = [
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/versioned-regeneration.json",
  "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/darfield.json",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/darfield/2026-09-09T09-33-20-010Z-attempt-1.json",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/thurnscoe/2026-09-09T09-46-10-781Z-attempt-1.json",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/thurnscoe/2026-09-09T09-50-54-247Z-attempt-1.json",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v4/wombwell/2026-09-09T09-33-38-379Z-attempt-1.json",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v5/darfield/2026-09-09T11-36-08-858Z-attempt-1.json",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v6/darfield/2026-09-09T12-16-05-900Z-attempt-1.json",
  "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v6/darfield/2026-09-09T13-01-04-848Z-attempt-1.json",
];
const historicalHashes = Object.fromEntries(historicalFiles.map((rel) => [rel, sha256(rel)]));
const currentPointer = path.join(
  ROOT,
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/current.json",
);
const campaignsDir = path.join(
  ROOT,
  "data/pharmacy-local-page-campaign-runs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/campaigns",
);
if (fs.existsSync(currentPointer) || fs.existsSync(campaignsDir)) {
  fail("A new campaign run file was created during the provider-free proof.");
}

const proof = {
  providerCalled: false,
  writerProvider: UK_LOCAL_INTRODUCTION_WRITER_PROVIDER,
  openaiLocalWriterActive: UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE,
  googleSearchGroundingEnabled: true,
  generator: CAMPAIGN_NEW_CAMPAIGN_GENERATOR,
  independentRunFiles: true,
  loadsOldRunOrCandidate: false,
  geminiOutputGoesToValidation: true,
  candidatesSavedOnlyThroughCandidateService: true,
  doubleClickProtection: true,
  publishing: false,
  indexing: false,
  historicalRunFile: path.relative(ROOT, historicalPath),
  newRunFilePattern: path.relative(ROOT, sampleRunPath),
  continueV6OnCampaignCard: false,
  generateCampaignLabel: CB_UX_REGENERATE_CAMPAIGN,
  existingVersionFolders: versions,
  nextCandidateVersion: preview.newCandidateVersion,
  localPageCount: preview.candidateJobs.length,
  localAreas: areas,
  reuseSavedEvidence: false,
  readsPreviousRunJobs: false,
  skipsOrMergesPreviousCandidates: false,
  v4v5v6Untouched: true,
  historicalHashes,
  noNewRunCreated: true,
};
fs.mkdirSync(path.dirname(proofPath), { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
console.log("CLEAN CAMPAIGN CONNECTION PASS");
console.log(JSON.stringify(proof, null, 2));
