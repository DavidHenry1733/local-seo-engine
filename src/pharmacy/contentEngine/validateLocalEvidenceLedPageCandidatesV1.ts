#!/usr/bin/env npx tsx
/**
 * Isolated validation — evidence-led Pharmacy First local-page candidates (ticket 91).
 * Does not overwrite live local pages. Does not call Google. Does not approve or publish.
 *
 * Run: npx tsx src/pharmacy/contentEngine/validateLocalEvidenceLedPageCandidatesV1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  assemblePharmacyFirstLocalPageCandidates,
  CANDIDATE_ASSEMBLY_CHAIN,
  PHARMACY_LOCAL_PAGE_CANDIDATE_ASSEMBLER,
} from "../pharmacyLocalPageCandidateAssembler.ts";
import {
  CANDIDATE_PREVIEW_BANNER,
  LOCAL_AREA_PAGE_CANDIDATE_ASSET,
  localPageCandidateHtmlPath,
} from "./pharmacyLocalPageCandidatePaths.ts";
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
  rejectedEntityReachedCustomerCopy,
  acceptedEntityCoversName,
  textWithoutCanonicalIdentity,
  LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD,
  LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD,
  type CandidatePageUniquenessInput,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { evaluateAutomatedReadabilityPreflight } from "./pharmacyLocalCandidateReadabilityV1.ts";
import {
  composeEvidenceLedLocalityPassagesV1,
  looksLikeRawEvidenceList,
} from "./pharmacyEvidenceLedLocalNarrativeV1.ts";
import type { NamedLocalityFact, VerifiedLocalityEvidence } from "./pharmacyVerifiedLocalityEvidenceV1.ts";
import { renderReviewCentrePreviewAsset } from "../growthEngineReviewCentrePreviewService.ts";

void localPageCandidateHtmlPath;
void LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD;
void LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD;

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

function pageHtml(areaName: string, body: string, extra = ""): string {
  return `<!DOCTYPE html><html lang="en-GB"><head><title>Pharmacy First in ${areaName} | ${PHARMACY}</title></head>
<body><header>${PHARMACY}</header><main>
<section data-template-block="hero"><h1>Pharmacy First — ${areaName}</h1><p>${body}</p></section>
<section data-template-block="service-definition"><h2>Why</h2><p>${body}</p></section>
<section data-template-block="local" id="local-access"><p class="local-intro-lead">${extra || body}</p></section>
<section data-template-block="faq"><div class="cluster-faq-item faq-card"><h3 class="faq-q">FAQ</h3><p class="faq-a">${body}</p></div></section>
</main><footer>${PHARMACY} ${ADDRESS} ${PHONE}</footer></body></html>`;
}

const RAW_LIST_PLACES = ["Place A", "Place B", "Place C"];
record(
  "raw-list-single-civic-centre-in-prose",
  looksLikeRawEvidenceList(
    "Braunstone Civic Centre is a recognised local reference point for patients in the area.",
    ["Braunstone Civic Centre"],
  ) === false,
  "one named entity in a sentence is not a list",
);
record(
  "raw-list-named-place-embedded-in-sentence",
  looksLikeRawEvidenceList(
    "If you would usually use Riverside Health Centre for a routine appointment, call first to ask about Pharmacy First.",
    ["Riverside Health Centre"],
  ) === false,
  "named place naturally embedded in prose is not a list",
);
record(
  "raw-list-comma-separated-names",
  looksLikeRawEvidenceList("Place A, Place B, Place C", RAW_LIST_PLACES) === true,
  "comma-separated entity names are a raw list",
);
record(
  "raw-list-bullet-newline-dump",
  looksLikeRawEvidenceList("<ul><li>Place A</li><li>Place B</li><li>Place C</li></ul>", RAW_LIST_PLACES) ===
    true &&
    looksLikeRawEvidenceList("Place A\nPlace B\nPlace C", RAW_LIST_PLACES) === true,
  "bullet and newline name dumps are raw lists",
);
record(
  "raw-list-label-value-dump",
  looksLikeRawEvidenceList("Local evidence: Place A, Place B, Place C", RAW_LIST_PLACES) === true,
  "labelled evidence inventories are raw lists",
);
record(
  "raw-list-two-names-in-grammatical-sentence",
  looksLikeRawEvidenceList(
    "Patients who normally use Place A can still ask about Pharmacy First, and the area includes Place B.",
    ["Place A", "Place B"],
  ) === false,
  "two named entities in a grammatical sentence are not a list",
);
record(
  "raw-list-existing-dump-shapes-fail-closed",
  looksLikeRawEvidenceList("Place A, Place B", ["Place A", "Place B"]) === true &&
    looksLikeRawEvidenceList("Place A / Place B / Place C", RAW_LIST_PLACES) === true &&
    looksLikeRawEvidenceList("Place A and Place B", ["Place A", "Place B"]) === true &&
    looksLikeRawEvidenceList(
      "<p>The area includes Place A. The area includes Place B in the same neighbourhood.</p>",
      ["Place A", "Place B"],
    ) === false,
  "concatenated dumps fail closed; separate prose sentences do not",
);

function namedFact(name: string, category: string): NamedLocalityFact {
  return { name, provenance: "test-fixture", category };
}

function composeHealthcarePassages(opts: {
  healthcare?: NamedLocalityFact[];
  community?: NamedLocalityFact[];
  landmarks?: NamedLocalityFact[];
  areaIndex: number;
}) {
  const verified = {
    areaName: "Riverside",
    areaSlug: "riverside",
    evidenceLimited: false,
    latitude: null,
    longitude: null,
    coordinateProvenance: "",
    distanceKm: 3.1,
    distanceLabel: "about 3.1 km",
    distanceProvenance: "test-fixture",
    cardinalDirection: "north",
    directionProvenance: "",
    landmarks: opts.landmarks || [],
    healthcare: opts.healthcare || [],
    community: opts.community || [],
    transport: [],
    schools: [],
    retail: [],
    nearbyLocalities: [],
    discoveryReason: "",
    discoveryEvidence: [],
    relationship: "",
    pharmacyAddress: "12 High Street, Riverside, UK",
    sectionEvidence: {},
  } as VerifiedLocalityEvidence;
  return composeEvidenceLedLocalityPassagesV1({
    verified,
    pharmacyName: "Example Pharmacy",
    serviceName: "Pharmacy First",
    displayPhone: "0121 000 0000",
    address: "12 High Street, Riverside, UK",
    areaIndex: opts.areaIndex,
  });
}

function gpPracticeWording(text: string, name: string): boolean {
  const body = String(text || "");
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`usually use ${escaped} for a routine GP appointment`, "i").test(body) ||
    new RegExp(`${escaped} is your usual GP practice`, "i").test(body) ||
    /usual GP practice/i.test(body)
  );
}

const gpPracticeCopy = composeHealthcarePassages({
  healthcare: [namedFact("Riverside Medical Practice", "healthcare")],
  areaIndex: 2,
});
record(
  "healthcare-gp-practice-wording-allowed",
  /Riverside Medical Practice is your usual GP practice/i.test(gpPracticeCopy.localContextBody) &&
    gpPracticeCopy.mentionedEntities.some((row) => row.name === "Riverside Medical Practice"),
  "named GP practice may use GP-practice wording",
);

const hospitalFrames = [0, 1, 2].map((areaIndex) =>
  composeHealthcarePassages({
    healthcare: [namedFact("Riverside General Hospital", "healthcare")],
    areaIndex,
  }).localContextBody,
);
record(
  "healthcare-hospital-never-usual-gp-practice",
  hospitalFrames.every(
    (body) =>
      /Riverside General Hospital/i.test(body) &&
      !gpPracticeWording(body, "Riverside General Hospital") &&
      !/usual GP practice/i.test(body),
  ),
  "named hospital is never rendered as a usual GP practice",
);

const urgentCareFrames = [0, 1, 2].map((areaIndex) =>
  composeHealthcarePassages({
    healthcare: [namedFact("Riverside Urgent Care Centre", "healthcare")],
    areaIndex,
  }).localContextBody,
);
record(
  "healthcare-urgent-care-never-gp-practice",
  urgentCareFrames.every(
    (body) =>
      /Riverside Urgent Care Centre/i.test(body) &&
      !gpPracticeWording(body, "Riverside Urgent Care Centre") &&
      !/usual GP practice/i.test(body),
  ),
  "urgent-care centre is never rendered as a GP practice",
);

const medicalCentreCopy = composeHealthcarePassages({
  healthcare: [namedFact("Riverside Medical Centre", "healthcare")],
  areaIndex: 2,
});
record(
  "healthcare-medical-centre-gp-wording-allowed",
  /Riverside Medical Centre is your usual GP practice/i.test(medicalCentreCopy.localContextBody),
  "medical centre classified as a GP practice may use GP wording",
);

const landmarkCopy = composeHealthcarePassages({
  community: [namedFact("Riverside Civic Centre", "community")],
  landmarks: [namedFact("Riverside Park", "landmarks")],
  areaIndex: 2,
});
record(
  "healthcare-landmark-community-no-gp-wording",
  /Riverside Civic Centre|Riverside Park/i.test(landmarkCopy.localContextBody) &&
    !/usual GP practice/i.test(landmarkCopy.localContextBody) &&
    !/routine GP appointment/i.test(landmarkCopy.localContextBody) &&
    landmarkCopy.mentionedEntities.every((row) => row.category !== "healthcare"),
  "community/landmark entities do not receive healthcare-practice wording",
);

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

const fetchCalls: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
  fetchCalls.push(String(args[0]));
  throw new Error("external fetch blocked in candidate validation");
}) as typeof fetch;

let assembled: ReturnType<typeof assemblePharmacyFirstLocalPageCandidates>;
try {
  assembled = assemblePharmacyFirstLocalPageCandidates(YORKSHIRE, SERVICE);
} finally {
  globalThis.fetch = originalFetch;
}

record(
  "15-candidate-generation-makes-no-external-call",
  fetchCalls.length === 0 && assembled.ok === true,
  `fetchCalls=${fetchCalls.length} assembled=${assembled.ok} ${assembled.blockedReason || ""}`,
);

const plan = planPharmacyLocalEvidenceRequest(YORKSHIRE, SERVICE);
const areaNames = plan.areas.map((a) => a.areaName);
const packs = new Map(plan.areas.map((area) => [area.areaSlug, loadPack(area.areaSlug, area.areaName)]));
const pages = (assembled.areas || []).map((area) => {
  const html = fs.readFileSync(area.outputPath, "utf8");
  const pack = packs.get(area.areaSlug)!;
  return {
    areaSlug: area.areaSlug,
    areaName: area.areaName,
    pharmacyName: PHARMACY,
    telephone: PHONE,
    address: ADDRESS,
    identityTown: TOWN,
    distanceLabel: "",
    html,
    acceptedNames: attributableEntities(pack).map((e) => e.name),
    rejectedNames: (pack.rejected || []).map((e) => e.name),
    siblingAreaNames: areaNames.filter((n) => n !== area.areaName),
    pack,
  };
});

const uniqueness = evaluateCandidateSemanticUniqueness(pages);
const srcAssembler = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyLocalPageCandidateAssembler.ts"), "utf8");
const srcPreview = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineReviewCentrePreviewService.ts"), "utf8");
const srcNarrative = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyFirstLocalNarrative.ts"), "utf8");
const srcReviewModel = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineReviewCentreModel.ts"), "utf8");

record(
  "1-all-ten-candidates-use-corresponding-pack",
  assembled.ok &&
    assembled.areas.length === 10 &&
    assembled.areas.every((area) => fs.existsSync(area.outputPath) && area.evidenceNames.length >= 0) &&
    CANDIDATE_ASSEMBLY_CHAIN.length === 4 &&
    srcAssembler.includes("bindVerifiedLocalityEvidenceV1") &&
    srcAssembler.includes("composeCommercialClusterNarrativeV1") &&
    srcAssembler.includes("buildPharmacyFirstLocalNarrative") &&
    srcAssembler.includes("renderLocalLocationClusterFullPage") &&
    srcNarrative.includes("composeEvidenceLedLocalityPassagesV1") &&
    !srcAssembler.includes("pageContainsAttributableEvidence(claimed"),
  `files=${assembled.files.length} chain=${CANDIDATE_ASSEMBLY_CHAIN.join("→")} evidence-optional`,
);

const crossHits: string[] = [];
for (const page of pages) {
  const visible = extractCustomerVisibleBody(page.html);
  for (const other of pages) {
    if (other.areaSlug === page.areaSlug) continue;
    for (const name of other.acceptedNames) {
      if (areaNames.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
      if (name.length < 5) continue;
      if (visible.toLowerCase().includes(name.toLowerCase())) {
        crossHits.push(`${page.areaSlug} contains ${other.areaSlug}:${name}`);
      }
    }
  }
}
record("2-no-candidate-consumes-another-area-evidence", crossHits.length === 0, crossHits.slice(0, 4).join(" | ") || "none");

const rejectedHits: string[] = [];
for (const page of pages) {
  const visible = extractCustomerVisibleBody(page.html);
  for (const name of page.rejectedNames) {
    if (acceptedEntityCoversName(page.acceptedNames, name, page.areaName)) continue;
    if (
      rejectedEntityReachedCustomerCopy(visible, name, {
        pharmacyName: PHARMACY,
        address: ADDRESS,
        telephone: PHONE,
        identityTown: TOWN,
      })
    ) {
      rejectedHits.push(`${page.areaSlug}:${name}`);
    }
  }
}
record("3-rejected-evidence-never-reaches-html", rejectedHits.length === 0, rejectedHits.slice(0, 3).join(" | ") || "none");

const barnsleyFails: string[] = [];
const identity = { pharmacyName: PHARMACY, address: ADDRESS, telephone: PHONE, identityTown: TOWN };
for (const page of pages) {
  const visible = extractCustomerVisibleBody(page.html);
  if (!/barnsley/i.test(page.html) || !page.html.includes(ADDRESS)) {
    barnsleyFails.push(`${page.areaSlug}: missing canonical Barnsley address/identity`);
  }
  const remainder = textWithoutCanonicalIdentity(visible, identity);
  const parentTownOnly = /\bbarnsley\b/i.test(remainder) && !page.acceptedNames.some((n) => /\bbarnsley\b/i.test(n));
  if (parentTownOnly) barnsleyFails.push(`${page.areaSlug}: parent-town Barnsley used outside canonical identity chrome`);
  for (const name of page.rejectedNames) {
    if (!/^barnsley\b/i.test(name) || name.trim().split(/\s+/).length < 2) continue;
    if (acceptedEntityCoversName(page.acceptedNames, name, page.areaName)) continue;
    if (rejectedEntityReachedCustomerCopy(visible, name, identity)) {
      barnsleyFails.push(`${page.areaSlug}: rejected ${name}`);
    }
  }
}
record(
  "barnsley-canonical-parent-town",
  barnsleyFails.length === 0,
  barnsleyFails.slice(0, 3).join(" | ") || "parent-town retained in address/identity only",
);

const directionFails: string[] = [];
for (const page of pages) {
  const answers = [...page.html.matchAll(/<p class="faq-a">([\s\S]*?)<\/p>/gi)].map((m) =>
    (m[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );
  const howFar = answers.filter((a) => /how far|from the pharmacy|km\b/i.test(a));
  void howFar;
  for (const answer of answers) {
    if (/\bfrom\s+to\b/i.test(answer)) directionFails.push(`${page.areaSlug}: empty from-place (${answer.slice(0, 80)})`);
    if (/^call\b[\s\S]{0,80}for directions from\b[\s\S]+to\b[\s\S]+$/i.test(answer) && !/\bkm\b|\bfrom the pharmacy\b/i.test(answer)) {
      directionFails.push(`${page.areaSlug}: directions-only FAQ used as the complete answer`);
    }
  }
}
record(
  "directions-faq-area-address",
  directionFails.length === 0,
  directionFails.slice(0, 3).join(" | ") || "no directions-only complete FAQ answers",
);

const localInPage = uniqueness.inPageDuplicates.filter(
  (row) => row.kind === "duplicated-local-narrative" || row.kind === "accidental-within-page",
);
record(
  "duplicate-paragraph-classification",
  localInPage.length === 0,
  localInPage.length
    ? localInPage.map((r) => `${r.areaSlug}:${r.kind}`).join(" | ")
    : "no within-page local/accidental duplicates; FAQ <p> not double-counted",
);

record(
  "4-evidence-woven-into-prose-not-raw-list",
  pages.every((page) => !looksLikeRawEvidenceList(page.html, page.acceptedNames)),
  "no comma-dump or adjacent evidence-only list items",
);

record(
  "5-sparse-pages-may-use-one-useful-local-passage",
  uniqueness.perArea.every((row) => row.visibleWords > 80),
  uniqueness.perArea.map((row) => `${row.areaSlug}:${row.uniqueLocalParagraphs}paras/${row.evidenceMentions.length}entities`).join(", "),
);

const clinicalShared = pages.every((page) =>
  /sore throat, earache, impetigo, infected insect bites, shingles, sinusitis/i.test(page.html),
);
record(
  "6-shared-clinical-copy-distinguished-from-duplicate-local-copy",
  clinicalShared && uniqueness.failures.every((f) => !f.includes("locality similarity")),
  `clinicalShared=${clinicalShared} uniquenessOk=${uniqueness.ok}`,
);

const clonePages: CandidatePageUniquenessInput[] = [
  {
    areaSlug: "darfield",
    areaName: "Darfield",
    pharmacyName: PHARMACY,
    telephone: PHONE,
    address: ADDRESS,
    distanceLabel: "about 1 km",
    html: pageHtml("Darfield", "Patients in Darfield can use Pharmacy First. Darfield is about 1 km from the pharmacy.", "Call for directions from Darfield."),
    acceptedNames: ["Darfield Library"],
    rejectedNames: [],
    siblingAreaNames: ["Wombwell"],
  },
  {
    areaSlug: "wombwell",
    areaName: "Wombwell",
    pharmacyName: PHARMACY,
    telephone: PHONE,
    address: ADDRESS,
    distanceLabel: "about 3 km",
    html: pageHtml("Wombwell", "Patients in Wombwell can use Pharmacy First. Wombwell is about 3 km from the pharmacy.", "Call for directions from Wombwell."),
    acceptedNames: ["Wombwell Medical Centre"],
    rejectedNames: [],
    siblingAreaNames: ["Darfield"],
  },
];
const cloneGate = evaluateCandidateSemanticUniqueness(clonePages);
record(
  "7-name-distance-link-substitutions-do-not-satisfy-uniqueness",
  cloneGate.ok === false,
  cloneGate.failures[0] || "expected failure",
);

record(
  "8-pairwise-locality-similarity-above-0-80-fails",
  cloneGate.maxLocality > 0.8 && cloneGate.failures.some((f) => f.includes("locality similarity")),
  `maxLocality=${cloneGate.maxLocality.toFixed(3)}`,
);

const dupAll = evaluateCandidateSemanticUniqueness(
  plan.areas.map((area) => ({
    areaSlug: area.areaSlug,
    areaName: area.areaName,
    pharmacyName: PHARMACY,
    html: pageHtml(
      area.areaName,
      `${area.areaName} Library is a recognizable community place in ${area.areaName}. That recognition is local context only — not a commercial relationship with the pharmacy.`,
      `${area.areaName} is about 2 km from the pharmacy.`,
    ),
    acceptedNames: [`${area.areaName} Library`],
    rejectedNames: [],
    siblingAreaNames: areaNames.filter((n) => n !== area.areaName),
  })),
);
record(
  "9-duplicate-non-clinical-paragraphs-fail",
  dupAll.failures.some((f) => f.includes("duplicated across all")),
  dupAll.failures.find((f) => f.includes("duplicated")) || dupAll.failures[0] || "expected duplicate failure",
);

const provenanceMisses: string[] = [];
for (const page of pages) {
  const localText = extractCustomerVisibleBody(extractLocalityNarrativeHtml(page.html));
  for (const name of page.acceptedNames) {
    if (localText.toLowerCase().includes(name.toLowerCase()) && !page.acceptedNames.includes(name)) {
      provenanceMisses.push(`${page.areaSlug}:${name}`);
    }
  }
  const allOther = pages.flatMap((other) =>
    other.areaSlug === page.areaSlug ? [] : other.acceptedNames.concat(other.rejectedNames),
  );
  for (const name of allOther) {
    if (name.length < 8) continue;
    if (page.acceptedNames.some((accepted) => accepted.toLowerCase() === name.toLowerCase())) continue;
    if (acceptedEntityCoversName(page.acceptedNames, name, page.areaName)) continue;
    if (areaNames.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    if (
      !rejectedEntityReachedCustomerCopy(localText, name, {
        pharmacyName: PHARMACY,
        address: ADDRESS,
        telephone: PHONE,
        identityTown: TOWN,
      })
    ) {
      continue;
    }
    provenanceMisses.push(`${page.areaSlug}:unprovenanced:${name}`);
  }
}
record("10-every-factual-local-mention-has-evidence-provenance", provenanceMisses.length === 0, provenanceMisses.slice(0, 3).join(" | ") || "mapped");

const unknown = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, LOCAL_AREA_PAGE_CANDIDATE_ASSET, {
  areaSlug: "headingley",
});
const darfieldPreview = renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, LOCAL_AREA_PAGE_CANDIDATE_ASSET, {
  areaSlug: "darfield",
});
record(
  "11-unknown-candidate-area-cannot-fall-back",
  unknown.sourceRoute === "review-preview-candidate-unavailable" &&
    /not available/i.test(unknown.html) &&
    !/Upperwood Academy/i.test(unknown.html) &&
    !/Darfield Library/i.test(unknown.html) &&
    darfieldPreview.sourceRoute === "local-area-page-candidate",
  unknown.sourceRoute,
);

record(
  "12-preview-is-read-only-and-noindex",
  /noindex,\s*nofollow/i.test(darfieldPreview.html) &&
    darfieldPreview.html.includes(CANDIDATE_PREVIEW_BANNER) &&
    !/data-review-approve|Approve this asset|review-centre-approve/i.test(darfieldPreview.html) &&
    !srcPreview.includes("assemblePharmacyFirstLocalPageCandidates") &&
    !srcPreview.includes("runPharmacyLocalEvidenceDiscovery") &&
    !srcReviewModel.includes(LOCAL_AREA_PAGE_CANDIDATE_ASSET),
  "banner+noindex+not in Review Centre groups",
);

const after = snapshotProtected();
const liveMutations: string[] = [];
for (const [file, hash] of liveLocalBefore) {
  if (after.get(file) !== hash) liveMutations.push(file);
}
record(
  "13-current-generated-pages-remain-unchanged",
  liveMutations.length === 0 && assembled.files.every((file) => file.includes("/pharmacy-local-page-candidates/")),
  liveMutations.slice(0, 3).join(" | ") || "live local pages unchanged",
);

const protectedMutations: string[] = [];
for (const [file, hash] of before) {
  if (after.get(file) !== hash) protectedMutations.push(path.relative(ROOT, file));
}
const previewStateBefore = snapshotProtected();
renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, LOCAL_AREA_PAGE_CANDIDATE_ASSET, { areaSlug: "wombwell" });
renderReviewCentrePreviewAsset(YORKSHIRE, SERVICE, LOCAL_AREA_PAGE_CANDIDATE_ASSET, { areaSlug: "missing-area" });
const previewStateAfter = snapshotProtected();
const previewMutations: string[] = [];
for (const [file, hash] of previewStateBefore) {
  if (previewStateAfter.get(file) !== hash) previewMutations.push(path.relative(ROOT, file));
}
record(
  "14-opening-preview-changes-no-state",
  previewMutations.length === 0,
  previewMutations.slice(0, 3).join(" | ") || "no campaign/review/pack mutation",
);

const structuralFails = pages.flatMap((page) =>
  evaluateHeadingleyTemplateParity(page.html).failures.map((f) => `${page.areaSlug}:${f}`),
);
record("headingley-template-parity", structuralFails.length === 0, structuralFails.length ? structuralFails[0]! : "ok");
const readabilityFails = pages.flatMap((page) =>
  evaluateAutomatedReadabilityPreflight(page.html, page.acceptedNames, page.areaName).failures.map((f) => `${page.areaSlug}:${f}`),
);
record(
  "automated-readability-preflight",
  readabilityFails.length === 0,
  readabilityFails.slice(0, 5).join(" | ") || "AUTOMATED READABILITY PREFLIGHT — not Product Owner approval",
);
record(
  "ten-candidate-semantic-uniqueness",
  uniqueness.maxLocality <= LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD &&
    uniqueness.failures.every((f) => !f.includes("locality similarity") && !f.includes("in-page") && !f.includes("rejected")),
  `maxLocality=${uniqueness.maxLocality.toFixed(3)} maxFullBody=${uniqueness.maxFullBody.toFixed(3)} (full-body threshold ${LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD} unchanged; honest shared-clinical remainder reported separately)`,
);
record(
  "current-page-non-mutation",
  liveMutations.length === 0,
  `${liveLocalBefore.size} live local pages hashed`,
);
record(
  "evidence-pack-non-mutation",
  [...before.entries()].filter(([file]) => file.includes("/pharmacy-local-relevance-packs/")).every(([file, hash]) => after.get(file) === hash),
  "packs unchanged",
);
record(
  "campaign-review-state-integrity",
  protectedMutations.filter((f) => f.includes("campaign-builder") || f.includes("review-centre") || f.includes("campaign-image-plan") || f.includes("campaign-generation-context")).length === 0,
  protectedMutations.slice(0, 4).join(" | ") || "unchanged",
);

console.log("\nPer-area evidence woven / words / unique local paragraphs:");
for (const row of uniqueness.perArea) {
  const page = pages.find((p) => p.areaSlug === row.areaSlug)!;
  console.log(`  ${row.areaSlug}: words=${row.visibleWords} uniqueLocalParas=${row.uniqueLocalParagraphs} mentions=${row.evidenceMentions.join("; ")}`);
  void page;
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
console.log("\nDuplicate-paragraph findings:");
if (!uniqueness.inPageDuplicates.length) {
  console.log("  none within-page (after excluding double-counted faq-a tags)");
} else {
  for (const row of uniqueness.inPageDuplicates) {
    console.log(`  ${row.areaSlug} [${row.kind}] ${row.excerpt}`);
  }
}
console.log("\nFull-body comparison method:");
console.log("  locality: copySimilarityScore(identity-stripped locality narrative; hero + local-context + relationship + first evidence FAQ)");
console.log("  documented full-body: copySimilarityScore(identityStrippedLocalityBody) — strips pharmacy/area/phone/address/distance/URLs and SHARED_CLINICAL_PATTERNS; threshold", LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD);
console.log("  honest full-body: copySimilarityScore(identity tokens only; clinical retained)");
console.log(
  `  max locality pair: ${uniqueness.maxLocalityPair?.a}/${uniqueness.maxLocalityPair?.b} = ${uniqueness.maxLocality.toFixed(3)}`,
);
console.log(
  `  max documented full-body pair: ${uniqueness.maxFullBodyPair?.a}/${uniqueness.maxFullBodyPair?.b} = ${uniqueness.maxFullBody.toFixed(3)}`,
);
console.log(
  `  max honest full-body pair (clinical retained): ${uniqueness.maxHonestFullBodyPair?.a}/${uniqueness.maxHonestFullBodyPair?.b} = ${uniqueness.maxHonestFullBody.toFixed(3)}`,
);
console.log(`max pairwise locality similarity: ${uniqueness.maxLocality.toFixed(3)}`);
console.log(`max pairwise full-body similarity: ${uniqueness.maxFullBody.toFixed(3)}`);
console.log(`assembler: ${PHARMACY_LOCAL_PAGE_CANDIDATE_ASSEMBLER}`);
const liveHashes = [...liveLocalBefore.entries()].map(([file, hash]) => `${path.basename(path.dirname(file))}:${hash.slice(0, 12)}`);
console.log(`authoritative local pages hashed: ${liveLocalBefore.size} unchanged=${liveMutations.length === 0}`);
for (const row of liveHashes) console.log(`  live ${row}`);
const packFiles = [...before.keys()].filter((f) => f.includes("/pharmacy-local-relevance-packs/"));
console.log(`evidence packs hashed: ${packFiles.length} unchanged=${packFiles.every((f) => after.get(f) === before.get(f))}`);
const stateFiles = [...before.keys()].filter((f) => /campaign-builder|review-centre|campaign-image-plan|campaign-generation-context/.test(f));
console.log(`campaign/review state hashed: ${stateFiles.length} unchanged=${stateFiles.every((f) => after.get(f) === before.get(f))}`);
console.log(`protected mutations (non-candidate): ${protectedMutations.join(", ") || "none"}`);

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed.`);
if (failed.length) {
  process.exitCode = 1;
}
