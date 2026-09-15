#!/usr/bin/env npx tsx
/**
 * Isolated validation — Pharmacy First local-candidate natural-language recovery (ticket 92).
 * Does not overwrite live local pages. Does not call Google. Does not approve or publish.
 *
 * Run: npx tsx src/pharmacy/contentEngine/validateLocalCandidateNaturalLanguageRecoveryV1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { assemblePharmacyFirstLocalPageCandidates } from "../pharmacyLocalPageCandidateAssembler.ts";
import {
  CANDIDATE_PREVIEW_BANNER,
  LOCAL_AREA_PAGE_CANDIDATE_ASSET,
  localPageCandidateHtmlPath,
} from "./pharmacyLocalPageCandidatePaths.ts";
import { localCandidateCopyInspectionPath } from "./pharmacyLocalCandidateCopyInspectionV1.ts";
import {
  attributableEntities,
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
  LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD,
  type PharmacyLocalEvidencePackV3,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  evaluateCandidateSemanticUniqueness,
  evaluateHeadingleyTemplateParity,
  extractCustomerVisibleBody,
  extractLocalityNarrativeHtml,
  extractTemplateBlock,
  LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import {
  evaluateAutomatedReadabilityPreflight,
  evaluateGrammarAndFragments,
  evaluateProhibitedCustomerLanguage,
  quotedPrompt91PhrasesFailPreflight,
  AUTOMATED_READABILITY_PREFLIGHT_LABEL,
} from "./pharmacyLocalCandidateReadabilityV1.ts";
import {
  composeEvidenceLedLocalityPassagesV1,
  selectPatientUsefulLocalEvidence,
} from "./pharmacyEvidenceLedLocalNarrativeV1.ts";
import { bindVerifiedLocalityEvidenceV1 } from "./pharmacyVerifiedLocalityEvidenceV1.ts";
import { buildContentGenerationContext } from "./buildContentGenerationContext.ts";
import { bindCurrentRegisteredApprovedBank } from "../pharmacyApprovedBankRunProvenance.ts";
import { renderReviewCentrePreviewAsset } from "../growthEngineReviewCentrePreviewService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const PHARMACY = "Yorkshire Pharmacy & Health Clinic";
const PHONE = "01226 210477";
const ADDRESS = "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK";
const TOWN = "Barnsley";
const CLINICAL = "sore throat, earache, impetigo, infected insect bites, shingles, sinusitis";
const FIXTURE = path.join(__dirname, "fixtures/prompt-91-darfield-candidate.html");

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
    path.join(ROOT, "data/pharmacy-local-relevance-packs", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-content-packages", YORKSHIRE),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-image-plan-pharmacy-first.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-review-centre.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-generation-context-pharmacy-first.json`),
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

const before = snapshotProtected();
const liveLocalBefore = new Map<string, string>();
for (const [file, hash] of before) {
  if (file.includes(`/pharmacy-content-ecosystem/${YORKSHIRE}/pharmacy-first/local/`) && file.endsWith("index.html") && !file.includes("/revisions/")) {
    liveLocalBefore.set(file, hash);
  }
}

const phraseGate = quotedPrompt91PhrasesFailPreflight();
record(
  "1-quoted-bad-phrases-fail-new-readability-validator",
  phraseGate.ok && fs.existsSync(FIXTURE) && evaluateAutomatedReadabilityPreflight(fs.readFileSync(FIXTURE, "utf8"), ["Darfield Library", "Upperwood Academy"], "Darfield").ok === false,
  phraseGate.ok
    ? "Prompt 91 phrases + Darfield fixture fail AUTOMATED READABILITY PREFLIGHT"
    : phraseGate.failures.slice(0, 3).join(" | "),
);

record(
  "2-equivalent-defensive-meta-wording-fails",
  phraseGate.ok,
  phraseGate.failures.slice(0, 3).join(" | ") || "equivalent defensive wording fails preflight",
);

const fetchCalls: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
  fetchCalls.push(String(args[0]));
  throw new Error("external fetch blocked in natural-language recovery validation");
}) as typeof fetch;

let assembled: ReturnType<typeof assemblePharmacyFirstLocalPageCandidates>;
try {
  assembled = assemblePharmacyFirstLocalPageCandidates(YORKSHIRE, SERVICE);
} finally {
  globalThis.fetch = originalFetch;
}

const plan = planPharmacyLocalEvidenceRequest(YORKSHIRE, SERVICE);
const areaNames = plan.areas.map((a) => a.areaName);
const packs = new Map(plan.areas.map((area) => [area.areaSlug, loadPack(area.areaSlug, area.areaName)]));
const ctx = bindCurrentRegisteredApprovedBank(buildContentGenerationContext(YORKSHIRE, SERVICE, {
  selectedAreasOverride: plan.areas.map((area, order) => ({
    areaName: area.areaName,
    areaSlug: area.areaSlug,
    selected: true,
    order: order + 1,
    priority: order + 1,
  })),
}));
const pages = (assembled.areas || []).map((area, idx) => {
  const html = fs.readFileSync(area.outputPath, "utf8");
  const pack = packs.get(area.areaSlug)!;
  const verified = bindVerifiedLocalityEvidenceV1({
    ctx,
    areaName: area.areaName,
    areaSlug: area.areaSlug,
    siblingLocalities: plan.areas.map((row) => ({ areaName: row.areaName, areaSlug: row.areaSlug })),
  });
  const passages = composeEvidenceLedLocalityPassagesV1({
    verified,
    pharmacyName: PHARMACY,
    serviceName: "Pharmacy First",
    displayPhone: PHONE,
    address: ADDRESS,
    areaIndex: idx,
  });
  return {
    areaSlug: area.areaSlug,
    areaName: area.areaName,
    pharmacyName: PHARMACY,
    telephone: PHONE,
    address: ADDRESS,
    identityTown: TOWN,
    distanceLabel: verified.distanceLabel,
    html,
    acceptedNames: attributableEntities(pack).map((e) => e.name),
    rejectedNames: (pack.rejected || []).map((e) => e.name),
    siblingAreaNames: areaNames.filter((n) => n !== area.areaName),
    pack,
    passages,
    verified,
  };
});

const uniqueness = evaluateCandidateSemanticUniqueness(pages);
const srcComposer = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyEvidenceLedLocalNarrativeV1.ts"), "utf8");
const srcNarrative = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyFirstLocalNarrative.ts"), "utf8");
const srcAssembler = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyLocalPageCandidateAssembler.ts"), "utf8");

const internalHits: string[] = [];
for (const page of pages) {
  const local = extractCustomerVisibleBody(`${extractLocalityNarrativeHtml(page.html)}\n${extractTemplateBlock(page.html, "faq")}\n${extractTemplateBlock(page.html, "local")}`);
  const hits = evaluateProhibitedCustomerLanguage(local);
  if (hits.length) internalHits.push(`${page.areaSlug}:${hits[0]}`);
}
record("3-internal-evidence-terminology-never-reaches-html", internalHits.length === 0, internalHits.slice(0, 3).join(" | ") || "none");

const darfield = pages.find((p) => p.areaSlug === "darfield");
record(
  "4-darfield-does-not-mention-upperwood-academy",
  Boolean(darfield) && !/upperwood academy/i.test(darfield!.html),
  darfield ? "Upperwood Academy omitted" : "missing Darfield candidate",
);

const schoolHits: string[] = [];
for (const page of pages) {
  const local = extractCustomerVisibleBody(`${extractLocalityNarrativeHtml(page.html)}\n${extractTemplateBlock(page.html, "faq")}\n${extractTemplateBlock(page.html, "local")}`);
  for (const name of page.acceptedNames) {
    const school = page.pack.schools?.some((e) => e.name === name);
    if (!school) continue;
    if (local.toLowerCase().includes(name.toLowerCase())) {
      schoolHits.push(`${page.areaSlug}:${name}`);
    }
  }
}
record("5-schools-omitted-unless-demonstrable-patient-value", schoolHits.length === 0, schoolHits.slice(0, 3).join(" | ") || "no school stuffing");

const routineHits: string[] = [];
for (const page of pages) {
  const local = extractCustomerVisibleBody(page.html);
  if (/weekday errands|after-school|weekend visits|school-run|shopping routine|inferred|grandparents, carers|shift workers/i.test(local)) {
    routineHits.push(page.areaSlug);
  }
}
record("6-no-imagined-routines-or-demographics", routineHits.length === 0, routineHits.join(" | ") || "none");

record(
  "7-evidence-entities-are-optional-not-mandatory",
  assembled.ok &&
    !srcAssembler.includes("pageContainsAttributableEvidence(claimed") &&
    srcComposer.includes("selectPatientUsefulLocalEvidence") &&
    pages.some((p) => p.passages.mentionedEntities.length === 0),
  `sparsePages=${pages.filter((p) => p.passages.mentionedEntities.length === 0).map((p) => p.areaSlug).join(",") || "none"}`,
);

const valueMisses: string[] = [];
for (const page of pages) {
  const local = extractCustomerVisibleBody(`${extractLocalityNarrativeHtml(page.html)}\n${extractTemplateBlock(page.html, "faq")}\n${extractTemplateBlock(page.html, "local")}`);
  for (const entity of page.passages.mentionedEntities) {
    if (!entity.patientValue.trim()) valueMisses.push(`${page.areaSlug}:${entity.name}:missing-reason`);
    if (!local.toLowerCase().includes(entity.name.toLowerCase())) valueMisses.push(`${page.areaSlug}:${entity.name}:not-in-copy`);
  }
  for (const name of page.acceptedNames) {
    if (name.length < 5) continue;
    if (areaNames.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    if (!local.toLowerCase().includes(name.toLowerCase())) continue;
    if (page.passages.mentionedEntities.some((e) => e.name.toLowerCase() === name.toLowerCase())) continue;
    valueMisses.push(`${page.areaSlug}:unselected-entity-in-copy:${name}`);
  }
}
record("8-every-retained-entity-has-stated-patient-benefit", valueMisses.length === 0, valueMisses.slice(0, 4).join(" | ") || "mapped");

const padded: string[] = [];
for (const page of pages) {
  const intro = extractCustomerVisibleBody(extractTemplateBlock(page.html, "service-definition"));
  const words = intro.split(/\s+/).filter(Boolean).length;
  if (page.passages.mentionedEntities.length === 0 && words > 220) padded.push(`${page.areaSlug}:${words}w`);
}
record("9-sparse-evidence-produces-concise-copy", padded.length === 0, padded.join(" | ") || "sparse pages stay concise");

const provenanceMisses: string[] = [];
for (const page of pages) {
  const local = extractCustomerVisibleBody(`${extractLocalityNarrativeHtml(page.html)}\n${extractTemplateBlock(page.html, "local")}`);
  for (const entity of page.passages.mentionedEntities) {
    if (!page.acceptedNames.some((n) => n.toLowerCase() === entity.name.toLowerCase())) {
      provenanceMisses.push(`${page.areaSlug}:unprovenanced:${entity.name}`);
    }
  }
  if (page.verified.distanceLabel && local.toLowerCase().includes(page.verified.distanceLabel.toLowerCase()) === false) {
    const access = extractCustomerVisibleBody(extractTemplateBlock(page.html, "local"));
    if (page.verified.distanceLabel && !access.toLowerCase().includes(page.verified.distanceLabel.toLowerCase()) && !local.toLowerCase().includes(page.verified.distanceLabel.toLowerCase())) {
      provenanceMisses.push(`${page.areaSlug}:missing-distance`);
    }
  }
}
record("10-all-local-factual-statements-retain-provenance", provenanceMisses.length === 0, provenanceMisses.slice(0, 3).join(" | ") || "mapped");

const clinicalOk = pages.every((page) => new RegExp(CLINICAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(page.html));
const clinicalSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyFirstLocalNarrative.ts"), "utf8");
record(
  "11-approved-clinical-copy-unchanged",
  clinicalOk &&
    clinicalSrc.includes(CLINICAL) &&
    /Your visit follows a structured consultation so decisions are clinically safe/.test(clinicalSrc),
  `clinicalShared=${clinicalOk}`,
);

const darfieldPreview = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, LOCAL_AREA_PAGE_CANDIDATE_ASSET, {
  areaSlug: "darfield",
});
record(
  "12-candidate-preview-remains-read-only-noindex",
  /noindex,\s*nofollow/i.test(darfieldPreview.html) &&
    darfieldPreview.html.includes(CANDIDATE_PREVIEW_BANNER) &&
    !/data-review-approve|Approve this asset/i.test(darfieldPreview.html),
  darfieldPreview.sourceRoute,
);

const after = snapshotProtected();
const liveMutations: string[] = [];
for (const [file, hash] of liveLocalBefore) {
  if (after.get(file) !== hash) liveMutations.push(file);
}
record(
  "13-authoritative-generated-pages-remain-unchanged",
  liveMutations.length === 0 && assembled.files.every((file) => file.includes("/pharmacy-local-page-candidates/")),
  liveMutations.slice(0, 3).join(" | ") || `${liveLocalBefore.size} live local pages unchanged`,
);

const packMutations = [...before.entries()].filter(([file, hash]) => file.includes("/pharmacy-local-relevance-packs/") && after.get(file) !== hash);
record("14-evidence-packs-remain-unchanged", packMutations.length === 0, packMutations.slice(0, 2).join(" | ") || "packs unchanged");

const stateMutations = [...before.entries()]
  .filter(([file, hash]) => /campaign-builder|review-centre|campaign-image-plan|campaign-generation-context/.test(file) && after.get(file) !== hash)
  .map(([file]) => path.relative(ROOT, file));
record("15-campaign-and-review-state-remain-unchanged", stateMutations.length === 0, stateMutations.slice(0, 3).join(" | ") || "unchanged");

const grammarFails = pages.flatMap((page) => {
  const local = extractCustomerVisibleBody(`${extractLocalityNarrativeHtml(page.html)}\n${extractTemplateBlock(page.html, "faq")}\n${extractTemplateBlock(page.html, "local")}`);
  return evaluateGrammarAndFragments(local).map((f) => `${page.areaSlug}:${f}`);
});
record("grammar-fragment-integrity", grammarFails.length === 0, grammarFails.slice(0, 4).join(" | ") || "ok");

const INSPECT_SLUGS = ["darfield", "wombwell", "chapeltown"];
function localSpecificCustomerCopy(html: string): string {
  return [
    extractCustomerVisibleBody(extractTemplateBlock(html, "hero")),
    extractCustomerVisibleBody(extractTemplateBlock(html, "service-definition")),
    extractCustomerVisibleBody(extractTemplateBlock(html, "local")),
    extractCustomerVisibleBody(extractTemplateBlock(html, "faq")),
  ]
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
console.log("\n===== THREE-AREA LOCAL-SPECIFIC CUSTOMER COPY (inspect before readability PASS) =====");
const inspectFails: string[] = [];
for (const slug of INSPECT_SLUGS) {
  const page = pages.find((p) => p.areaSlug === slug);
  const copy = page ? localSpecificCustomerCopy(page.html) : `(missing ${slug} candidate)`;
  console.log(`\n----- ${slug.toUpperCase()} -----\n${copy}\n`);
  if (!page) {
    inspectFails.push(`${slug}: missing candidate`);
    continue;
  }
  const sentences = copy.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  for (const sentence of sentences) {
    if (
      /\bis a recognis[ae]ble place in\b/i.test(sentence) ||
      /\bchoosing between\b/i.test(sentence) ||
      /\bwill already have a sense of\b/i.test(sentence) ||
      /\bKeep the journey simple\b/i.test(sentence) ||
      /\bBring the full address with you\b/i.test(sentence) ||
      /\barriving unannounced\b/i.test(sentence) ||
      /\bThe destination is\b/i.test(sentence) ||
      /\bcan help you place\b/i.test(sentence) ||
      /^Call\s+[\d\s]+\s+to ask\.?$/i.test(sentence)
    ) {
      inspectFails.push(`${slug}: ${sentence}`);
    }
  }
}
record(
  "three-area-copy-inspection",
  inspectFails.length === 0,
  inspectFails.length ? inspectFails.join(" | ") : "Darfield, Wombwell and Chapeltown local copy printed above",
);

const readabilityFails = pages.flatMap((page) =>
  evaluateAutomatedReadabilityPreflight(page.html, page.acceptedNames, page.areaName).failures.map((f) => `${page.areaSlug}:${f}`),
);
record(
  "automated-readability-preflight",
  readabilityFails.length === 0 && inspectFails.length === 0,
  readabilityFails.length
    ? readabilityFails.slice(0, 5).join(" | ")
    : inspectFails.length
      ? `FAIL with exact wording: ${inspectFails[0]}`
      : `${AUTOMATED_READABILITY_PREFLIGHT_LABEL} — not Product Owner approval`,
);

const structuralFails = pages.flatMap((page) =>
  evaluateHeadingleyTemplateParity(page.html).failures.map((f) => `${page.areaSlug}:${f}`),
);
record("headingley-template-parity", structuralFails.length === 0, structuralFails.slice(0, 3).join(" | ") || "ok");
record(
  "semantic-thresholds-unchanged",
  LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD === 0.8 && LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD === 0.85,
  `locality=${LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD} fullBody=${LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD}`,
);
record(
  "locality-similarity-within-0-80",
  uniqueness.maxLocality <= LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD &&
    uniqueness.failures.every((f) => !f.includes("locality similarity")),
  `maxLocality=${uniqueness.maxLocality.toFixed(3)} ${uniqueness.maxLocalityPair?.a}/${uniqueness.maxLocalityPair?.b} threshold=${LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD}`,
);
record(
  "full-body-similarity-honest-report",
  uniqueness.maxFullBody < LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD,
  `maxFullBody=${uniqueness.maxFullBody.toFixed(3)} ${uniqueness.maxFullBodyPair?.a}/${uniqueness.maxFullBodyPair?.b} threshold=${LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD}${
    uniqueness.maxFullBody >= LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD
      ? " — honest FAIL: shared approved clinical copy; prose not corrupted to obtain PASS"
      : ""
  }`,
);
record("external-calls-blocked", fetchCalls.length === 0 && assembled.ok, `fetchCalls=${fetchCalls.length} assembled=${assembled.ok} ${assembled.blockedReason || ""}`);

const inspectionPath = localCandidateCopyInspectionPath(YORKSHIRE, SERVICE);
record("copy-inspection-artefact", fs.existsSync(inspectionPath) && fs.statSync(inspectionPath).size > 200, inspectionPath);

console.log("\nPer-area retained / omitted entities:");
for (const page of pages) {
  const retained = page.passages.mentionedEntities.map((e) => `${e.name} (${e.category})`).join("; ") || "none";
  const omitted = page.passages.omittedEntities.map((e) => e.name).join("; ") || "none";
  console.log(`  ${page.areaSlug}: retained=${retained}`);
  console.log(`    omitted=${omitted}`);
  const selection = selectPatientUsefulLocalEvidence(page.verified, ADDRESS);
  void selection;
}
console.log("\nLocality similarity matrix:");
const slugs = uniqueness.perArea.map((r) => r.areaSlug);
console.log(["", ...slugs].join("\t"));
for (let i = 0; i < slugs.length; i++) {
  const row = uniqueness.localityMatrix[i]!.map((n, j) => (i === j ? "—" : n.toFixed(3)));
  console.log([slugs[i], ...row].join("\t"));
}
console.log("\nFull-body similarity matrix:");
console.log(["", ...slugs].join("\t"));
for (let i = 0; i < slugs.length; i++) {
  const row = uniqueness.fullBodyMatrix[i]!.map((n, j) => (i === j ? "—" : n.toFixed(3)));
  console.log([slugs[i], ...row].join("\t"));
}
console.log(
  `max locality pair: ${uniqueness.maxLocalityPair?.a}/${uniqueness.maxLocalityPair?.b} = ${uniqueness.maxLocality.toFixed(3)} (threshold ${LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD})`,
);
console.log(
  `max full-body pair: ${uniqueness.maxFullBodyPair?.a}/${uniqueness.maxFullBodyPair?.b} = ${uniqueness.maxFullBody.toFixed(3)} (threshold ${LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD})`,
);
console.log(`copy inspection: ${inspectionPath}`);
console.log(`thresholds unchanged: locality 0.80 / full-body 0.85`);
console.log(`fixture used for Prompt 91 Darfield fail: ${FIXTURE}`);
void localPageCandidateHtmlPath;
void srcNarrative;

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed.`);
if (failed.length) process.exitCode = 1;
