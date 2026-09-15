#!/usr/bin/env npx tsx
/**
 * Focused tests — Pharmacy AI local-narrative engine V1 (Prompt 93).
 * Does not overwrite live pages. Does not approve, publish, deploy or commit.
 *
 * Run: npx tsx src/pharmacy/contentEngine/validatePharmacyAiLocalNarrativeEngineV1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID,
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION,
  buildAiLocalNarrativeSystemPromptV1,
  PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  AI_LOCAL_COPY_ALLOWED_FIELDS,
  parseAiLocalCopyV1,
  type AiLocalCopyV1,
} from "./pharmacyAiLocalCopySchemaV1.ts";
import { groundAiLocalCopyClaimsV1 } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { evaluateAiLocalCopyQualityV1 } from "./pharmacyAiLocalCopyQualityV1.ts";
import {
  AI_LOCAL_NARRATIVE_ENGINE_ID,
  AI_LOCAL_NARRATIVE_MODEL,
  AI_LOCAL_NARRATIVE_PROVIDER,
  buildPharmacyAiLocalCopyInputV1,
  generateAiLocalCopyForArea,
  loadAiLocalCopyRecord,
  validateAiLocalCopyAgainstInput,
  type AiLocalCopyRecordV1,
} from "./_archive-legacy-local-writers/pharmacyAiLocalNarrativeEngineV1.ts";
import {
  AUTH_CHECK_COST_USD,
  runPharmacyAiLocalNarrativeGenerationV1,
} from "./_archive-legacy-local-writers/runPharmacyAiLocalNarrativeGenerationV1.ts";
import {
  AI_CANDIDATE_PREVIEW_BANNER,
  AI_LOCAL_AREA_PAGE_CANDIDATE_ASSET,
  aiLocalCopyRecordPath,
  aiLocalPageCandidateHtmlPath,
} from "./pharmacyAiLocalPageCandidatePaths.ts";
import {
  attributableEntities,
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
  type PharmacyLocalEvidencePackV3,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  evaluateCandidateSemanticUniqueness,
  evaluateHeadingleyTemplateParity,
  extractCustomerVisibleBody,
  extractLocalityNarrativeHtml,
  extractSharedClinicalHtml,
  LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD,
  stripHtmlToText,
  type CandidatePageUniquenessInput,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { evaluateAutomatedReadabilityPreflight } from "./pharmacyLocalCandidateReadabilityV1.ts";
import { renderReviewCentrePreviewAsset } from "../growthEngineReviewCentrePreviewService.ts";
import { assemblePharmacyAiLocalPageCandidates } from "../pharmacyAiLocalPageCandidateAssembler.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import { localNarrativeFingerprint } from "./pharmacyAiLocalCopyQualityV1.ts";
import { stripIdentityTokens } from "./pharmacyLocalPageCandidateUniquenessV1.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const PHARMACY = "Yorkshire Pharmacy & Health Clinic";
const PHONE = "01226 210477";
const ADDRESS = "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK";
const TOWN = "Barnsley";

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
    path.join(ROOT, "data/pharmacy-local-relevance-packs", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-content-packages", YORKSHIRE),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-image-plan-pharmacy-first.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-review-centre.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-generation-context-pharmacy-first.json`),
    path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", YORKSHIRE, "pharmacy-first.json"),
    path.join(ROOT, "data/pharmacy-approved-service-banks/banks/pharmacy-first"),
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

function loadPack(areaSlug: string, areaName: string): PharmacyLocalEvidencePackV3 {
  const raw = loadPharmacyLocalEvidencePack(YORKSHIRE, areaSlug);
  const checked = validatePharmacyLocalEvidencePack(raw, { slug: YORKSHIRE, areaName, areaSlug });
  if (!checked.ok) throw new Error(`${areaSlug}: ${checked.detail}`);
  return checked.pack;
}

function faqs(): AiLocalCopyV1["localFaqs"] {
  return [
    {
      question: "How far is the pharmacy from this area?",
      answer: "Use the address 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK and call 01226 210477 if you want to check how a visit is being arranged.",
    },
    {
      question: "Should I call before visiting?",
      answer: "Yes. Call 01226 210477 so the pharmacy can tell you how a consultation is being arranged.",
    },
    {
      question: "What if Pharmacy First is not suitable?",
      answer: "The pharmacist will advise on self-care, safety-netting or another NHS route, including urgent care when symptoms are severe.",
    },
  ];
}

function baseCopy(area: string, extra: Partial<AiLocalCopyV1> = {}): AiLocalCopyV1 {
  return {
    area,
    heroHeading: `Pharmacy First in ${area}`,
    heroIntroduction: `${PHARMACY} provides Pharmacy First for people in ${area}. Call ${PHONE} if a pharmacist consultation may help.`,
    localIntroduction: `${PHARMACY} is at ${ADDRESS}.`,
    localContextHeading: `Pharmacy First for people in ${area}`,
    localContextParagraphs: [
      `Pharmacy First can help with eligible common conditions. The pharmacist confirms what can be assessed on the day.`,
    ],
    relationshipToPharmacy: `${PHARMACY} is the Pharmacy First premises for people in ${area}, at ${ADDRESS}.`,
    localAccessIntroduction: `Telephone ${PHONE} to ask how consultations are being arranged on the day you want to come in.`,
    localFaqs: faqs(),
    localCtaBridge: `Book an appointment or call ${PHONE} if you think Pharmacy First may be suitable.`,
    evidenceClaims: [
      { field: "localIntroduction", sentence: `${PHARMACY} is at ${ADDRESS}.` },
    ],
    evidenceEntityIdsUsed: [],
    ...extra,
  };
}

async function main() {
const plan = planPharmacyLocalEvidenceRequest(YORKSHIRE, SERVICE);
const darfieldInput = buildPharmacyAiLocalCopyInputV1({
  slug: YORKSHIRE,
  serviceId: SERVICE,
  areaName: "Darfield",
  areaSlug: "darfield",
  pack: loadPack("darfield", "Darfield"),
});
const wombwellInput = buildPharmacyAiLocalCopyInputV1({
  slug: YORKSHIRE,
  serviceId: SERVICE,
  areaName: "Wombwell",
  areaSlug: "wombwell",
  pack: loadPack("wombwell", "Wombwell"),
});

const srcEngine = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts"), "utf8");
const srcAdapter = fs.readFileSync(path.join(ROOT, "src/generator/generateClusterContent.ts"), "utf8");
const srcPreview = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineReviewCentrePreviewService.ts"), "utf8");
const srcAssembler = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyAiLocalPageCandidateAssembler.ts"), "utf8");
const srcReviewModel = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineReviewCentreModel.ts"), "utf8");
const srcPrompt = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts"), "utf8");

async function main(): Promise<void> {
record(
  "adapter-reuses-generateClusterContent-client",
  srcEngine.includes("getOpenAiIntegrationClient") &&
    srcEngine.includes('from "../../generator/generateClusterContent.ts"') &&
    srcAdapter.includes("function getClient()") &&
    srcAdapter.includes("chat.completions.create") &&
    srcEngine.includes("response_format: { type: \"json_object\" }") &&
    AI_LOCAL_NARRATIVE_PROVIDER === "openai" &&
    AI_LOCAL_NARRATIVE_MODEL === "gpt-4.1",
  `${AI_LOCAL_NARRATIVE_ENGINE_ID} ${AI_LOCAL_NARRATIVE_PROVIDER}/${AI_LOCAL_NARRATIVE_MODEL}`,
);

const systemPrompt = buildAiLocalNarrativeSystemPromptV1("pharmacy");
record(
  "prompt-contract-versioned-and-complete",
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID === "pharmacy-ai-local-narrative-prompt-v1" &&
    AI_LOCAL_NARRATIVE_PROMPT_VERSION === "v1" &&
    AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH.endsWith("pharmacyAiLocalNarrativePromptContractV1.ts") &&
    /professional British English/i.test(systemPrompt) &&
    /Do not invent facts/i.test(systemPrompt) &&
    /Do not force schools/i.test(systemPrompt) &&
    /Do not rewrite locked clinical facts/i.test(systemPrompt) &&
    srcPrompt.includes("lockedClinicalFacts") &&
    PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.conditionSet.includes("sore throat"),
  `${AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH} ${AI_LOCAL_NARRATIVE_PROMPT_VERSION}`,
);

record(
  "1-only-campaign-builder-selected-areas",
  plan.areas.length === 10 &&
    plan.areas.every((area) => Boolean(area.areaName && area.areaSlug)) &&
    plan.areas.map((a) => a.areaSlug).sort().join(",") ===
      ["chapeltown", "cudworth", "darfield", "goldthorpe", "grimethorpe", "hoyland", "royston", "thurnscoe", "wombwell", "worsbrough"].sort().join(","),
  plan.areas.map((a) => a.areaSlug).join(","),
);

const darfieldAccepted = new Set(darfieldInput.locality.acceptedEntities.map((e) => e.name));
const wombwellAccepted = new Set(wombwellInput.locality.acceptedEntities.map((e) => e.name));
record(
  "2-each-request-receives-only-its-own-evidence",
  darfieldAccepted.has("Darfield Library") &&
    !darfieldAccepted.has("Wombwell Medical Centre") &&
    wombwellAccepted.has("Wombwell Medical Centre") &&
    !wombwellAccepted.has("Darfield Library"),
  `darfield=${darfieldAccepted.size} wombwell=${wombwellAccepted.size}`,
);

const darfieldPack = loadPack("darfield", "Darfield");
const rejectedNames = (darfieldPack.rejected || []).map((e) => e.name);
record(
  "3-rejected-evidence-is-excluded",
  rejectedNames.length > 0 && rejectedNames.every((name) => !darfieldAccepted.has(name)),
  `rejected=${rejectedNames.length} excluded-from-input`,
);

const htmlParse = parseAiLocalCopyV1({
  ...baseCopy("Darfield"),
  heroIntroduction: "<p>HTML</p>",
});
record("4-ai-returns-strict-structured-copy-not-html", !htmlParse.ok && htmlParse.failures.some((f) => /HTML/i.test(f)), htmlParse.ok ? "accepted html" : htmlParse.failures[0]!);

const unknownParse = parseAiLocalCopyV1({ ...baseCopy("Darfield"), extraField: "nope" });
record(
  "5-unknown-fields-fail",
  !unknownParse.ok && unknownParse.failures.some((f) => /unknown fields/i.test(f)) && AI_LOCAL_COPY_ALLOWED_FIELDS.includes("heroHeading"),
  unknownParse.ok ? "accepted unknown" : unknownParse.failures[0]!,
);

const parking = groundAiLocalCopyClaimsV1(
  baseCopy("Darfield", { localContextParagraphs: ["There is free parking outside the pharmacy all day."] }),
  darfieldInput,
);
record("6-unsupported-factual-claims-fail", !parking.ok && parking.failures.some((f) => /parking|journey|opening/i.test(f)), parking.failures[0] || "expected parking fail");

const invented = groundAiLocalCopyClaimsV1(
  baseCopy("Darfield", { localContextParagraphs: ["Visit Faketown Surgery on High Street before you travel."] }),
  darfieldInput,
);
record("7-invented-entities-fail", !invented.ok && invented.failures.some((f) => /ungrounded named entity/i.test(f)), invented.failures[0] || "expected invented fail");

const affiliation = groundAiLocalCopyClaimsV1(
  baseCopy("Wombwell", {
    localContextParagraphs: ["We are affiliated with Wombwell Medical Centre as a referral partner."],
  }),
  wombwellInput,
);
record("8-implied-gp-affiliation-fails", !affiliation.ok, affiliation.failures[0] || "expected affiliation fail");

const waiting = groundAiLocalCopyClaimsV1(
  baseCopy("Wombwell", {
    localContextParagraphs: ["GP waiting times in Wombwell are long, so use Pharmacy First instead."],
  }),
  wombwellInput,
);
record("9-assumed-gp-waiting-times-fail", !waiting.ok, waiting.failures[0] || "expected waiting fail");

const internal = evaluateAiLocalCopyQualityV1(
  baseCopy("Darfield", { localContextParagraphs: ["This uses recorded school context from the evidence pack."] }),
  darfieldInput,
);
record("10-internal-evidence-terminology-fails", !internal.ok, internal.failures[0] || "expected internal fail");

const defensive = evaluateAiLocalCopyQualityV1(
  baseCopy("Darfield", {
    localContextParagraphs: ["Darfield Library should not be read as a recommendation, drop-off arrangement, or referral route."],
  }),
  darfieldInput,
);
record("11-defensive-recommendation-disclaimers-fail", !defensive.ok, defensive.failures[0] || "expected defensive fail");

const stuffing = evaluateAiLocalCopyQualityV1(
  baseCopy("Darfield", {
    localContextParagraphs: ["Families around Upperwood Academy and the supermarket will recognise this service."],
  }),
  darfieldInput,
);
record("12-school-retail-stuffing-fails", !stuffing.ok, stuffing.failures[0] || "expected stuffing fail");

const repeated = evaluateAiLocalCopyQualityV1(
  baseCopy("Darfield", {
    heroIntroduction: "Call 01226 210477 before visiting to check how it is being arranged today.",
    localAccessIntroduction: "Call 01226 210477 before visiting to check how it is being arranged today.",
    localCtaBridge: "Call 01226 210477 before visiting to check how it is being arranged today.",
  }),
  darfieldInput,
);
record("13-fragments-and-repeated-sentences-fail", !repeated.ok, repeated.failures[0] || "expected repeat fail");

const clinical = evaluateAiLocalCopyQualityV1(
  baseCopy("Darfield", {
    localContextParagraphs: ["We also provide chickenpox treatment, covid antivirals and flu jabs on this page."],
  }),
  darfieldInput,
);
record("14-approved-clinical-copy-cannot-be-changed", !clinical.ok, clinical.failures[0] || "expected clinical fail");

const groundedOk = validateAiLocalCopyAgainstInput(baseCopy("Darfield"), darfieldInput);
record(
  "15-claim-maps-cover-local-factual-sentences",
  groundedOk.ok && groundedOk.claims.length > 0 && groundedOk.claims.every((c) => c.validationResult === "pass"),
  `claims=${groundedOk.claims.length} ok=${groundedOk.ok} ${groundedOk.failures[0] || ""}`,
);

const missingFile = aiLocalCopyRecordPath(YORKSHIRE, SERVICE, "headingley-does-not-exist");
const beforeMissing = fs.existsSync(missingFile);
const failedGen = await generateAiLocalCopyForArea({
  slug: YORKSHIRE,
  serviceId: SERVICE,
  areaName: "Headingley",
  areaSlug: "headingley-does-not-exist",
  writeRecord: true,
});
record(
  "16-failed-ai-validation-does-not-write-candidate",
  !failedGen.ok && !fs.existsSync(missingFile) && beforeMissing === false,
  failedGen.detail,
);

record(
  "17-preview-source-never-calls-ai",
  !srcPreview.includes("generateAiLocalCopyForArea") &&
    !srcPreview.includes("runPharmacyAiLocalNarrativeGenerationV1") &&
    !srcPreview.includes("assemblePharmacyAiLocalPageCandidates") &&
    srcAssembler.includes("Never calls OpenAI") &&
    !srcReviewModel.includes(AI_LOCAL_AREA_PAGE_CANDIDATE_ASSET),
  "preview reads isolated HTML only",
);

const unitFailed = checks.filter((c) => !c.pass);
if (unitFailed.length) {
  console.log(`\n${unitFailed.length} unit test(s) failed before AI generation. Stopping.`);
  process.exit(1);
}

const before = snapshotProtected();
const liveLocalBefore = new Map<string, string>();
for (const [file, hash] of before) {
  if (file.includes(`/pharmacy-content-ecosystem/${YORKSHIRE}/pharmacy-first/local/`) && file.endsWith("index.html") && !file.includes("/revisions/")) {
    liveLocalBefore.set(file, hash);
  }
}

const originalFetch = globalThis.fetch;
const blocked: string[] = [];
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = String(input);
  if (/googleapis|maps\.google|dataforseo|ideogram/i.test(url)) {
    blocked.push(url);
    throw new Error(`blocked external call: ${url.slice(0, 80)}`);
  }
  return originalFetch(input, init);
}) as typeof fetch;

let generation: Awaited<ReturnType<typeof runPharmacyAiLocalNarrativeGenerationV1>>;
try {
  generation = await runPharmacyAiLocalNarrativeGenerationV1({
    initialCostUsd: AUTH_CHECK_COST_USD,
  });
} finally {
  globalThis.fetch = originalFetch;
}

record(
  "generation-openai-only-no-places-dataforseo",
  generation.providerConfigured && blocked.length === 0 && generation.ledger.successful <= 10,
  `successful=${generation.ledger.successful} blocked=${blocked.length} cost=${generation.ledger.estimatedCostUsd.toFixed(6)}`,
);

const records = generation.records;
const pages: CandidatePageUniquenessInput[] = (generation.files.length ? generation.files : []).map((file) => {
  const areaSlug = path.basename(path.dirname(file));
  const rec = records.find((row) => row.areaSlug === areaSlug);
  const html = fs.readFileSync(file, "utf8");
  const pack = loadPack(areaSlug, rec?.areaName || areaSlug);
  return {
    areaSlug,
    areaName: rec?.areaName || areaSlug,
    pharmacyName: PHARMACY,
    telephone: PHONE,
    address: ADDRESS,
    identityTown: TOWN,
    distanceLabel: "",
    html,
    acceptedNames: attributableEntities(pack).map((e) => e.name),
    rejectedNames: (pack.rejected || []).map((e) => e.name),
    siblingAreaNames: plan.areas.filter((a) => a.areaSlug !== areaSlug).map((a) => a.areaName),
  };
});

const uniqueness = pages.length ? evaluateCandidateSemanticUniqueness(pages) : null;
const fingerprints = records.map((row) => {
  const input = buildPharmacyAiLocalCopyInputV1({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaName: row.areaName,
    areaSlug: row.areaSlug,
    pack: loadPack(row.areaSlug, row.areaName),
  });
  return stripIdentityTokens(localNarrativeFingerprint(row.outputCopy), {
    pharmacyName: input.business.name,
    areaName: input.locality.areaName,
    telephone: input.business.telephone,
    address: input.business.address,
    distanceLabel: input.locality.distanceLabel,
    siblingAreaNames: input.locality.neighbouringSelectedAreas,
  });
});
let maxCopySim = 0;
let maxCopyPair = "n/a";
for (let i = 0; i < fingerprints.length; i++) {
  for (let j = i + 1; j < fingerprints.length; j++) {
    const score = copySimilarityScore(fingerprints[i]!, fingerprints[j]!);
    if (score > maxCopySim) {
      maxCopySim = score;
      maxCopyPair = `${records[i]?.areaName} / ${records[j]?.areaName}`;
    }
  }
}

const claimPass = records.every((row) => row.claimMap.length > 0 && row.claimMap.every((c) => c.validationResult === "pass"));
const qualityPass = records.every((row) => {
  const input = buildPharmacyAiLocalCopyInputV1({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaName: row.areaName,
    areaSlug: row.areaSlug,
    pack: loadPack(row.areaSlug, row.areaName),
  });
  return evaluateAiLocalCopyQualityV1(row.outputCopy, input).ok && validateAiLocalCopyAgainstInput(row.outputCopy, input).ok;
});
const readability = pages.map((page) => evaluateAutomatedReadabilityPreflight(page.html, page.acceptedNames, page.areaName));
const clinicalBlocks = pages.map((page) => stripHtmlToText(extractSharedClinicalHtml(page.html)));
const clinicalIntact =
  clinicalBlocks.length >= 2 &&
  clinicalBlocks.every((text) => /sore throat/i.test(text) && /pharmacist confirms what can be assessed/i.test(text));

record(
  "natural-language-quality",
  qualityPass && readability.every((r) => r.ok) && records.length > 0,
  `records=${records.length} readabilityFails=${readability.filter((r) => !r.ok).length}`,
);
record(
  "claim-grounding-and-claim-map",
  claimPass && qualityPass,
  `records=${records.length} claimPass=${claimPass}`,
);
record(
  "approved-clinical-copy-integrity-rendered",
  clinicalIntact,
  clinicalIntact ? "shared clinical blocks retained" : "clinical blocks missing or rewritten",
);
record(
  "semantic-locality-similarity-below-0.80",
  records.length >= 2 && maxCopySim < LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD,
  `max=${maxCopySim.toFixed(3)} pair=${maxCopyPair} htmlMax=${uniqueness?.maxLocality?.toFixed(3) || "n/a"}`,
);
record(
  "full-page-similarity-reported-honestly",
  Boolean(uniqueness),
  uniqueness
    ? `maxFullBody=${uniqueness.maxFullBody.toFixed(3)} pair=${uniqueness.maxFullBodyPair?.a}/${uniqueness.maxFullBodyPair?.b}`
    : "no pages",
);

const unknownPreview = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_CANDIDATE_ASSET, {
  areaSlug: "headingley",
});
const previewOk = records.filter((row) => {
  const preview = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, AI_LOCAL_AREA_PAGE_CANDIDATE_ASSET, {
    areaSlug: row.areaSlug,
  });
  return (
    preview.sourceRoute === "ai-local-area-page-candidate" &&
    preview.html.includes(AI_CANDIDATE_PREVIEW_BANNER) &&
    /noindex,\s*nofollow/i.test(preview.html) &&
    !/data-review-approve|Approve this asset|review-centre-approve/i.test(preview.html) &&
    !/claim-map|evidenceEntityIdsUsed|promptContract/i.test(preview.html)
  );
});
record(
  "preview-read-only-no-fallback-noindex",
  unknownPreview.sourceRoute === "review-preview-ai-candidate-unavailable" &&
    /not available/i.test(unknownPreview.html) &&
    previewOk.length === records.length,
  `previewOk=${previewOk.length}/${records.length} unknown=${unknownPreview.sourceRoute}`,
);

for (const page of pages) {
  const parity = evaluateHeadingleyTemplateParity(page.html);
  record(`template-parity-${page.areaSlug}`, parity.ok, parity.failures[0] || "local-cluster-v1");
}

const after = snapshotProtected();
const liveMutations: string[] = [];
for (const [file, hash] of liveLocalBefore) {
  if (after.get(file) !== hash) liveMutations.push(file);
}
record(
  "18-current-generated-pages-remain-unchanged",
  liveMutations.length === 0,
  liveMutations.slice(0, 3).join(" | ") || "live local pages unchanged",
);

const evidenceMutations = [...before.keys()].filter(
  (file) => file.includes("/pharmacy-local-relevance-packs/") && after.get(file) !== before.get(file),
);
record("19-evidence-packs-remain-unchanged", evidenceMutations.length === 0, evidenceMutations.slice(0, 3).join(" | ") || "packs unchanged");

const protectedMutations: string[] = [];
for (const [file, hash] of before) {
  if (file.includes("/pharmacy-ai-local-")) continue;
  if (after.get(file) !== hash) protectedMutations.push(file);
}
record(
  "20-campaign-review-approval-package-unchanged",
  protectedMutations.length === 0,
  protectedMutations.slice(0, 4).join(" | ") || "campaign/review/approvals/package/images unchanged",
);

const p91Mutations = [...before.keys()].filter(
  (file) => file.includes("/pharmacy-local-page-candidates/") && after.get(file) !== before.get(file),
);
record("prompt-91-92-candidates-unchanged", p91Mutations.length === 0, p91Mutations.slice(0, 3).join(" | ") || "unchanged");

const reassemble = assemblePharmacyAiLocalPageCandidates(
  YORKSHIRE,
  SERVICE,
  records.map((row) => row.areaSlug),
);
record(
  "assembler-does-not-call-ai",
  srcAssembler.includes("Never calls OpenAI") && reassemble.areas.length === records.length,
  `reassembled=${reassemble.areas.length}`,
);

void generateAiLocalCopyForArea;
void loadAiLocalCopyRecord;
void extractCustomerVisibleBody;
void extractLocalityNarrativeHtml;
void aiLocalPageCandidateHtmlPath;

console.log("\n===== THREE-AREA AI LOCAL COPY (inspect before PASS) =====");
const inspectFails: string[] = [];
for (const slug of ["darfield", "wombwell", "chapeltown"]) {
  const rec = records.find((row) => row.areaSlug === slug);
  if (!rec) {
    inspectFails.push(`${slug}: missing copy record`);
    console.log(`\n----- ${slug.toUpperCase()} -----\nMISSING\n`);
    continue;
  }
  const copy = rec.outputCopy;
  const text = [
    copy.heroHeading,
    copy.heroIntroduction,
    copy.localContextHeading,
    copy.localIntroduction,
    ...copy.localContextParagraphs,
    copy.relationshipToPharmacy,
    copy.localAccessIntroduction,
    ...copy.localFaqs.flatMap((faq) => [`Q: ${faq.question}`, `A: ${faq.answer}`]),
    copy.localCtaBridge,
  ].join("\n");
  console.log(`\n----- ${slug.toUpperCase()} -----\n${text}\n`);
  const input = buildPharmacyAiLocalCopyInputV1({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaName: rec.areaName,
    areaSlug: rec.areaSlug,
    pack: loadPack(rec.areaSlug, rec.areaName),
  });
  const quality = evaluateAiLocalCopyQualityV1(copy, input);
  if (!quality.ok) inspectFails.push(`${slug}: ${quality.failures[0]}`);
}
record("three-area-copy-inspection", inspectFails.length === 0, inspectFails[0] || "quoted above");

const failed = checks.filter((c) => !c.pass);
console.log("");
console.log(`FOCUSED TESTS ${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length}`);
console.log(
  JSON.stringify(
    {
      generation: {
        providerConfigured: generation.providerConfigured,
        successful: generation.ledger.successful,
        attempted: generation.ledger.attempted,
        failed: generation.ledger.failed,
        retried: generation.ledger.retried,
        promptTokens: generation.ledger.promptTokens,
        completionTokens: generation.ledger.completionTokens,
        estimatedCostUsd: Number(generation.ledger.estimatedCostUsd.toFixed(6)),
        skipped: generation.skipped,
        records: records.map((r) => r.areaSlug),
        files: generation.files,
        inspectionPath: generation.inspectionPath,
      },
      similarity: {
        maxCopySim,
        maxCopyPair,
        maxLocality: uniqueness?.maxLocality ?? null,
        maxFullBody: uniqueness?.maxFullBody ?? null,
      },
    },
    null,
    2,
  ),
);

if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/sk-[A-Za-z0-9._-]+/g, "[redacted]").slice(0, 400));
  process.exit(1);
});
}

void main();
