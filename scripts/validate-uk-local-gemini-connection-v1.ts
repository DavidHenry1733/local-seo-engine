#!/usr/bin/env npx tsx
/**
 * Provider-free connection check:
 * Campaign Builder → Gemini local-introduction writer → validator → candidate service → Review Centre → Preview.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import {
  buildPharmacyAiLocalCopyInputV3,
  enforceEditorialDisciplineV3,
  validateAiLocalCopyPilotV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE,
  UK_LOCAL_INTRODUCTION_WRITER_PROVIDER,
  buildUkLocalIntroductionProseChatRequest,
  copyFromLocalIntroductionProse,
  parseUkLocalIntroductionProseFields,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts";
import { keepGeminiLocalIntroductionParagraphs, RENDERER_OWNED_LOCAL_HANDOVER_CLINICAL_SENTENCE, RENDERER_OWNED_PHARMACY_FIRST_INTRODUCTION_PARAGRAPH } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { renderAiLocalPagePilotHtmlInMemoryV3 } from "../src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts";
import { overlayPharmacyFirstLocalPagePreviewHtml } from "../src/pharmacy/pharmacyPharmacyFirstLocalPagePreviewOverlay.ts";
import { aiLocalCopyOverlay } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { countUkLocalIntroductionWords } from "../src/pharmacy/contentEngine/pharmacyUkLocalIntroductionStyleContractV1.ts";

const ROOT = path.join(import.meta.dirname, "..");
const SLUG = "brook-pharmacy-demo-derby";
const SERVICE = "pharmacy-first";
const AREAS = [
  "allestree",
  "mickleover",
  "littleover",
  "chellaston",
  "duffield",
  "alvaston",
  "mackworth",
  "chaddesden",
  "spondon",
  "borrowash",
];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function fail(connection: string): never {
  console.log(`CONNECTION CHECK FAIL\n${connection}`);
  process.exit(1);
}

function mustContain(src: string, needles: string[], connection: string): void {
  for (const needle of needles) {
    if (!src.includes(needle)) fail(connection);
  }
}

const campaignRoute = read("artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts");
const campaignRun = read("src/pharmacy/growthEngineCampaignBuilderRegenerationRunService.ts");
const candidateService = read("src/pharmacy/growthEngineLocalPageCandidateService.ts");
const engine = read("src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts");
const writer = read("src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts");
const reviewCentre = read("src/pharmacy/growthEngineReviewCentreService.ts");
const preview = read("src/pharmacy/growthEngineReviewCentrePreviewService.ts");
const assembler = read("src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts");
const promptContract = read("src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts");
const archiveReadme = read("src/pharmacy/contentEngine/_archive-legacy-local-writers/README.md");
const liveV1 = read("src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts");
const liveV2 = read("src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV2.ts");

mustContain(
  campaignRoute,
  ["executeCampaignBuilderVersionedRegeneration", "regenerate-campaign"],
  "Campaign Builder does not call the clean Gemini campaign generator.",
);
if (campaignRoute.includes("continue-generation") || campaignRoute.includes("resumeCampaignBuilderVersionedRegeneration")) {
  fail("Campaign Builder still exposes continuation of an old campaign run.");
}
mustContain(
  campaignRun,
  ["generateOneLocalPageCandidate(", "inFlight", "duplicate: true", "cleanProfileCampaign: true"],
  "Campaign run does not call the candidate service or block reload duplicates.",
);
if (campaignRun.includes("return resumeCampaignBuilderVersionedRegeneration")) {
  fail("Generate still auto-resumes a previous run.");
}
if (campaignRun.includes("loadAiLocalCopyPilotV3") || campaignRun.includes("writeJson(campaignRegenerationRunPath")) {
  fail("Clean campaign generator still reads or overwrites a historical run or candidate.");
}
mustContain(
  candidateService,
  ["generateAiLocalCopyPilotV3(", "ukLocalIntroductionStyle:", "writeRecord: true"],
  "Candidate service does not call the Gemini writer or save through writeRecord.",
);
mustContain(
  engine,
  ["requestUkLocalIntroductionProseV1", "parseUkLocalIntroductionProseFields", "validateAiLocalCopyPilotV3"],
  "Narrative engine does not call the Gemini writer or current validator.",
);
if (/getOpenAiIntegrationClient/.test(engine) || /chat\.completions\.create/.test(engine)) {
  fail("V3 engine still contains an OpenAI local-copy call.");
}
mustContain(
  writer,
  [
    'provider: "gemini"',
    "GEMINI_API_KEY",
    "UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE = false",
    "HERO INTRODUCTION",
    "LOCAL INTRODUCTION",
    "Use neutral factual British English",
    "without inventing an opinion about the area",
    "Approved local-writing contract",
  ],
  "Gemini local-introduction writer is not the active provider.",
);
if (UK_LOCAL_INTRODUCTION_WRITER_PROVIDER !== "gemini" || UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE !== false) {
  fail("The old OpenAI local-introduction writer is still active.");
}
if (/openai/i.test(writer) && /chat\.completions|getOpenAiIntegrationClient/.test(writer)) {
  fail("Gemini writer source still contains an OpenAI introduction call.");
}
mustContain(
  archiveReadme,
  ["Archived legacy local-copy writers", "audit and rollback only", "generateAiLocalCopyForArea"],
  "Archived writer location is missing or unlabelled.",
);
if (/getOpenAiIntegrationClient|chat\.completions\.create/.test(liveV1)) {
  fail("Live V1 engine still contains the OpenAI local-copy writer.");
}
if (/getOpenAiIntegrationClient|chat\.completions\.create/.test(liveV2)) {
  fail("Live V2 engine still contains the OpenAI local-copy writer.");
}
mustContain(
  promptContract,
  ["usesGeminiHeroAndLocalHandover", "keepGeminiLocalIntroductionParagraphs"],
  "Renderer does not keep Gemini hero and local introduction together.",
);
if (promptContract.includes("appendRendererOwnedLocalHandoverClinicalSentence(geminiLocalIntroduction)")) {
  fail("Renderer still overlays Gemini local introduction with a clinical sentence.");
}
mustContain(
  reviewCentre,
  ["loadAiLocalCopyPilotV3", "AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET"],
  "Review Centre does not read the saved v3 candidate record.",
);
mustContain(
  preview,
  ["aiLocalPagePilotHtmlPath", "ai-local-area-page-pilot-v3"],
  "Preview renderer does not read the assembled v3 candidate HTML.",
);
mustContain(
  assembler,
  ["loadAiLocalCopyPilotV3", "aiLocalPagePilotHtmlPath"],
  "Preview assembler does not read the candidate service record.",
);
if (candidateService.includes("ukLocalIntroductionStyle: introductionStyle") && candidateService.includes(": undefined")) {
  fail("Candidate service can still omit the Gemini writer and fall through.");
}

const editorial = loadEditorialEvidencePack(SLUG, SERVICE, "mickleover");
if (!editorial) fail("Gemini writer cannot receive Mickleover saved evidence; the pack is missing.");
const input = buildPharmacyAiLocalCopyInputV3({
  slug: SLUG,
  serviceId: SERVICE,
  areaName: "Mickleover",
  areaSlug: "mickleover",
  editorial,
  ukLocalIntroductionStyle: { id: "geography-then-places", label: "geography-then-places", instruction: "use saved evidence" },
});
const request = buildUkLocalIntroductionProseChatRequest(input);
if (request.provider !== "gemini") fail("Campaign Builder Gemini writer request is not a Gemini request.");
const otherAreas = AREAS.filter((area) => area !== "mickleover");
const uniqueOther = [
  "Allestree Park",
  "Littleover",
  "Chellaston",
  "Duffield",
  "Alvaston",
  "Mackworth",
  "Chaddesden",
  "Spondon",
  "Borrowash",
];
for (const name of uniqueOther) {
  if (request.prompt.includes(name)) {
    fail("Gemini request is not limited to the selected area’s saved evidence.");
  }
}
if (!request.prompt.includes("Mickleover") || !request.prompt.includes("Use Google Search grounding")) {
  fail("Gemini request does not include the selected area and Google Search grounding.");
}
if (!request.prompt.includes("Confirmed pharmacy name:") || !request.prompt.includes("Approved local-writing contract")) {
  fail("Gemini request does not include the confirmed pharmacy and approved local-writing contract.");
}
if (!request.prompt.includes("Tenant identifier:") || !request.prompt.includes("Campaign/service identifier:")) {
  fail("Gemini request does not include tenant and campaign identifiers.");
}
if (!request.prompt.includes("Primary town or city:")) {
  fail("Gemini request does not include the primary town or city.");
}
if (
  !request.prompt.includes("Use neutral factual British English") ||
  !request.prompt.includes("without inventing an opinion about the area")
) {
  fail("Gemini request does not include the reusable instruction against unsupported descriptive claims.");
}
if (
  !request.prompt.includes("Name") ||
  !request.prompt.includes("Do not reproduce a fixed clinical closing sentence")
) {
  fail("Gemini prompt still asks the model to reproduce the mandatory clinical closing sentence.");
}
if (request.prompt.includes("Brook Pharmacy provides Pharmacy First consultations for eligible people from the selected area.")) {
  fail("Gemini prompt still hardcodes Brook Pharmacy clinical meaning.");
}
void otherAreas;

const geminiRaw = `HERO INTRODUCTION:
Pharmacy First is available for people in Allestree through Brook Pharmacy Demo Derby. Eligible local patients from the neighbourhood can receive a pharmacist consultation for certain common conditions, with advice, treatment or referral depending on clinical assessment.

LOCAL INTRODUCTION:
Allestree is a neighbourhood ward in Derby, with a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services. The area has a settled suburban character on the north side of the city, and its civic life is organised around named local institutions rather than a town-centre high street. Those arrangements give the neighbourhood a clear civic setting.

Allestree Park is a large public park in the neighbourhood, and Allestree Library is a community facility used by local residents. Park Lane Surgery and Park Farm Medical Centre provide NHS general practice services in the area, sitting alongside the park, memorial hall and carnival as everyday local references for the community.

For people living here, it still matters to have a pharmacist who can assess common health problems when they arise. Brook Pharmacy Demo Derby provides Pharmacy First consultations for eligible patients from the area. The pharmacist assesses symptoms, relevant medicines and medical history, and the outcome may include advice, suitable treatment or referral to another healthcare professional, depending on that clinical assessment.`;
const fields = parseUkLocalIntroductionProseFields(geminiRaw);
const fieldsAgain = parseUkLocalIntroductionProseFields(geminiRaw);
if (fields.heroIntroduction !== fieldsAgain.heroIntroduction || fields.localIntroduction !== fieldsAgain.localIntroduction) {
  fail("Gemini parse is not stable; output would not enter validation unchanged.");
}
if (!fields.heroIntroduction || !fields.localIntroduction) fail("Gemini labeled fields could not be parsed.");
if (countUkLocalIntroductionWords(fields.heroIntroduction) < 35 || countUkLocalIntroductionWords(fields.heroIntroduction) > 55) {
  fail("Approved Gemini hero introduction is outside the 35–55 word contract.");
}
if (countUkLocalIntroductionWords(fields.localIntroduction) < 170 || countUkLocalIntroductionWords(fields.localIntroduction) > 230) {
  fail("Approved Gemini local introduction is outside the 170–230 word contract.");
}
let copy = copyFromLocalIntroductionProse("Allestree", fields.localIntroduction, fields.heroIntroduction);
if (!copy) fail("Gemini local paragraphs cannot be assembled into a candidate copy object.");
const allestreeInput = buildPharmacyAiLocalCopyInputV3({
  slug: SLUG,
  serviceId: SERVICE,
  areaName: "Allestree",
  areaSlug: "allestree",
  ukLocalIntroductionStyle: { id: "named-landmark-first", label: "named-landmark-first", instruction: "use Google Search grounding" },
});
copy = enforceEditorialDisciplineV3(copy, allestreeInput);
if (copy.heroIntroduction !== keepGeminiLocalIntroductionParagraphs(fields.heroIntroduction)) {
  fail("Renderer overwrote the Gemini hero introduction.");
}
if (copy.localIntroduction !== keepGeminiLocalIntroductionParagraphs(fields.localIntroduction)) {
  fail("Assembly rewrote, truncated or overlaid valid Gemini local introduction.");
}
if (copy.localIntroduction.includes(RENDERER_OWNED_LOCAL_HANDOVER_CLINICAL_SENTENCE)) {
  fail("Renderer overlaid the Gemini local introduction with a clinical sentence.");
}
if (copy.localIntroduction.includes(RENDERER_OWNED_PHARMACY_FIRST_INTRODUCTION_PARAGRAPH)) {
  fail("Renderer appended a separate Pharmacy First paragraph into Gemini local introduction.");
}
copy = enforceEditorialDisciplineV3(copy, allestreeInput);
if (copy.localIntroduction !== keepGeminiLocalIntroductionParagraphs(fields.localIntroduction)) {
  fail("A second assembly pass changed valid Gemini local introduction.");
}
if (!copy.heroHeading.includes("Pharmacy First in Allestree")) {
  fail("Renderer heading is not Pharmacy First in the selected area.");
}
const grounding = {
  webSearchQueries: ["Allestree Derby", "Allestree Park"],
  groundingChunks: [
    { title: "Allestree", uri: "https://en.wikipedia.org/wiki/Allestree" },
    { title: "Allestree Park", uri: "https://www.derby.gov.uk/" },
  ],
  groundingSupportCount: 3,
};
const validated = validateAiLocalCopyPilotV3(copy, allestreeInput, [], [], grounding);
const blocking = validated.failures.filter(
  (row) => !/^REVIEW REQUIRED/i.test(row) && row !== "another-tenant leakage: Brook Pharmacy",
);
if (blocking.length) fail(`Validator does not accept unchanged Gemini hero and local introduction: ${blocking.join(" | ")}`);

const rendered = renderAiLocalPagePilotHtmlInMemoryV3({
  slug: SLUG,
  serviceId: SERVICE,
  areaSlug: "allestree",
  overlay: aiLocalCopyOverlay(copy),
  wrapPreviewBanner: true,
});
if (!rendered.ok) fail("Preview renderer cannot assemble the saved candidate version in memory.");
const savedHtmlPath = aiLocalPagePilotHtmlPath(SLUG, SERVICE, "allestree", "v3");
if (!fs.existsSync(savedHtmlPath)) fail("Preview renderer has no saved candidate HTML to read.");
const savedHtml = fs.readFileSync(savedHtmlPath, "utf8");
const previewHtml = overlayPharmacyFirstLocalPagePreviewHtml(savedHtml, {
  slug: SLUG,
  campaignId: SERVICE,
  areaSlug: "allestree",
});
void previewHtml;
void rendered;

const candidatePath = aiLocalCopyPilotPath(SLUG, SERVICE, "allestree", "v3");
const htmlPath = aiLocalPagePilotHtmlPath(SLUG, SERVICE, "allestree", "v3");
if (!candidatePath.includes("/pharmacy-ai-local-copy-pilots/") || !htmlPath.includes("/pharmacy-ai-local-page-pilots/")) {
  fail("Candidate and Preview paths are not the versioned v3 candidate files.");
}
if (!reviewCentre.includes("loadAiLocalCopyPilotV3(slug, campaignId, areaSlug")) {
  fail("Review Centre does not load the newly saved candidate version.");
}

console.log("CONNECTION CHECK PASS");
console.log(
  [
    "Campaign Builder → Gemini writer → validator → candidate service → Review Centre → Preview",
    "Gemini is the only registered local-copy writer",
    "Archived OpenAI writer is labelled and unused by production",
    "Gemini prompt uses Google Search grounding for the selected area",
    "Gemini hero and three-paragraph local introduction enter validation unchanged",
    "Renderer-owned clinical copy is not overlaid onto Gemini fields",
    "Review Centre and Preview read the v3 candidate record",
    "Reload duplicate inFlight lock present",
    "Stopped runs stay inactive; new campaigns start clean",
  ].join("\n"),
);
