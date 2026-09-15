import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  buildPharmacyAiLocalCopyInputV3,
  loadAiLocalCopyPilotV3,
  validateAiLocalCopyPilotV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import {
  formatCustomerFacingLocalCopyV3,
  inspectAiLocalCopyForPublicationV3,
  localNarrativeFingerprint,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { flattenAiLocalCopyText, type AiLocalCopyV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { hashFileSha256 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts";
import {
  extractEditorialFactDrafts,
  factIdFor,
  hostFromUrl,
  looksLikeRawCopiedPassage,
  unsupportedInferencesIn,
  type EditorialEvidencePackV3,
  type EditorialFactV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { stripIdentityTokens, stripHtmlToText } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalPageCandidateUniquenessV1.ts";
import { copySimilarityScore } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/pharmacyLocalClusterVariantFamilies.ts";
import { renderStrategyVariantComparisonPreview } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/pharmacyAiLocalStrategyVariantPreviewV3.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const AREAS = [
  "darfield",
  "wombwell",
  "worsbrough",
  "thurnscoe",
  "grimethorpe",
  "goldthorpe",
  "hoyland",
  "cudworth",
  "royston",
  "chapeltown",
] as const;
const LIVE_COPY = path.join(ROOT, "data/pharmacy-ai-local-copy-pilots", SLUG, SERVICE, "v3/darfield.json");
const ORIGINAL_PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/darfield.json");
const RESEARCH_PREV = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-demo-standard-research.json");
const RESEARCH_NEW = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-community-enrich-research.json");
const GEN = path.join(ROOT, "data/pharmacy-ai-local-copy-diagnostics", SLUG, SERVICE, "v3/darfield/2026-09-01-community-enrich/generate-result.json");
const OUT_DIR = path.join(ROOT, "data/pharmacy-ai-local-copy-diagnostics", SLUG, SERVICE, "v3/darfield/2026-09-01-community-enrich");
const FILE_HTML = path.join(ROOT, "output/pharmacy-ai-local-page-pilots", SLUG, SERVICE, "v3/local/darfield/index.html");
const ECOSYSTEM = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE, "local");
const PHARMACY = "Yorkshire Pharmacy & Health Clinic";
const ADDRESS = "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK";
const PHONE = "01226 210477";

const COMMUNITY_SEQUENCE = ["why", "conditions", "how", "consultation", "travel", "gp", "faq", "cta", "nearby"];
const PRIMARY_SEQUENCE = ["why", "how", "gp", "conditions", "consultation", "travel", "faq", "cta", "nearby"];
const JOURNEY_SEQUENCE = ["why", "how", "conditions", "consultation", "travel", "gp", "faq", "cta", "nearby"];

function sha(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function factFromDraft(
  draft: ReturnType<typeof extractEditorialFactDrafts>[number],
  page: { title: string; url: string; publisher: string; retrievedAt: string },
): EditorialFactV3 {
  return {
    factId: factIdFor("darfield", draft.category, draft.normalizedStatement),
    area: "Darfield",
    areaSlug: "darfield",
    category: draft.category,
    normalizedStatement: draft.normalizedStatement,
    sourceTitle: page.title,
    sourceUrl: page.url,
    publisher: page.publisher,
    retrievedAt: page.retrievedAt,
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: draft.confidence,
    usefulnessToPharmacyFirstReader: draft.usefulnessToPharmacyFirstReader,
    permittedCopyRole: draft.permittedCopyRole,
    prohibitedInference: draft.prohibitedInference,
    validationStatus: "accepted",
  };
}

function extraFactsFromSavedBodies(research: {
  retrievedPages?: Array<{
    requestedUrl?: string;
    finalUrl?: string;
    title?: string;
    publisher?: string;
    retrievedAt?: string;
    textSample?: string;
    sourceClass?: string;
  }>;
  facts?: EditorialFactV3[];
}): EditorialFactV3[] {
  const out: EditorialFactV3[] = [...(research.facts || [])];
  for (const page of research.retrievedPages || []) {
    if (!page.textSample || page.sourceClass === "rejected") continue;
    const url = page.finalUrl || page.requestedUrl || "";
    const host = hostFromUrl(url);
    for (const draft of extractEditorialFactDrafts({
      areaName: "Darfield",
      title: page.title || "",
      text: page.textSample,
      sourceClass: "primary",
      publisher: page.publisher || host,
      host,
    })) {
      if (looksLikeRawCopiedPassage(draft.normalizedStatement, page.textSample)) continue;
      if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
      if (/wombwell|lundhill/i.test(draft.normalizedStatement)) continue;
      if (/people live in Darfield|is home to [\d,]+ people|wholesale and retail|semi-detached|economically active/i.test(draft.normalizedStatement)) {
        continue;
      }
      const fact = factFromDraft(draft, {
        title: page.title || "",
        url,
        publisher: page.publisher || host,
        retrievedAt: page.retrievedAt || new Date().toISOString(),
      });
      if (out.some((row) => row.normalizedStatement === fact.normalizedStatement)) continue;
      out.push(fact);
    }
  }
  return out;
}

function loadResearch(file: string) {
  if (!fs.existsSync(file)) return { retrievedPages: [], facts: [] as EditorialFactV3[] };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function headingSequence(html: string): string[] {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((row) =>
    row[1]!.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
  );
}

function extractWhyTravel(html: string) {
  const why = html.match(/Why [^<]* patients start with the pharmacist[\s\S]{0,400}/i)?.[0] || "";
  const travel = html.match(/Travelling to Yorkshire Pharmacy[\s\S]{0,700}/i)?.[0] || "";
  return {
    why: stripHtmlToText(why).replace(/\s+/g, " ").trim(),
    travel: stripHtmlToText(travel).replace(/\s+/g, " ").trim(),
  };
}

function placesNames(areaSlug: string): string[] {
  const file = path.join(ROOT, "data/pharmacy-local-relevance-packs", SLUG, `${areaSlug}.json`);
  if (!fs.existsSync(file)) return [];
  const pack = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  const names: string[] = [];
  for (const key of ["healthcare", "community", "landmarks", "schools", "transport", "shopping"]) {
    const rows = pack[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const name = String((row as { name?: string }).name || "").trim();
      if (name) names.push(`${key}:${name}`);
    }
  }
  return names.slice(0, 12);
}

function editorialSummary(areaSlug: string) {
  const file = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3", `${areaSlug}.json`);
  if (!fs.existsSync(file)) {
    return { present: false, status: "none", acceptedFacts: [] as string[], missingCopy: "No editorial-evidence pack and no AI v3 copy. Places relevance pack only." };
  }
  const pack = JSON.parse(fs.readFileSync(file, "utf8")) as EditorialEvidencePackV3;
  const accepted = pack.facts.filter((f) => f.validationStatus === "accepted").map((f) => f.normalizedStatement);
  return {
    present: true,
    status: pack.sufficiency.status,
    acceptedFacts: accepted,
    missingCopy:
      areaSlug === "darfield" || areaSlug === "wombwell"
        ? "AI v3 copy exists (isolated candidate)."
        : `Editorial pack ${pack.sufficiency.status}. No AI v3 copy generated in this task.`,
  };
}

const INTROS = [
  "Darfield is in the Metropolitan Borough of Barnsley, South Yorkshire. Darfield Library is on Church Street and runs regular activities and special events for children and adults. Darfield History Society runs local history group sessions.",
  "Darfield is in the Metropolitan Borough of Barnsley, South Yorkshire. Darfield Library is on Church Street. The library runs regular activities and special events for children and adults, and Darfield History Society runs local history group sessions.",
];

function buildCopy(localIntroduction: string, factIds: string[]): AiLocalCopyV3 {
  return {
    area: "Darfield",
    heroHeading: "Pharmacy First in Darfield",
    heroIntroduction:
      "Pharmacy First is available in Darfield, offering NHS consultations for eligible common conditions. Yorkshire Pharmacy & Health Clinic provides this service to people living in Darfield and the surrounding Barnsley area.",
    localIntroduction,
    localContextHeading: "",
    localContextParagraphs: ["NHS general practice services in Darfield are provided from Garland House Surgery."],
    relationshipToPharmacy:
      "Pharmacy First consultations for Darfield residents are provided at Yorkshire Pharmacy & Health Clinic in Darfield.",
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [
      {
        field: "localIntroduction",
        sentence: "Darfield is in the Metropolitan Borough of Barnsley, South Yorkshire.",
        entityId: "darfield:area-identity:darfield-is-in-the-metropolitan-borough-of-barns",
      },
      {
        field: "localIntroduction",
        sentence: localIntroduction,
        entityId: "darfield:community:darfield-library-is-on-church-street",
      },
      {
        field: "localContextParagraphs",
        sentence: "NHS general practice services in Darfield are provided from Garland House Surgery.",
        entityId: "darfield:healthcare:nhs-general-practice-services-in-darfield-are-pr",
      },
      {
        field: "relationshipToPharmacy",
        sentence: "Pharmacy First consultations for Darfield residents are provided at Yorkshire Pharmacy & Health Clinic in Darfield.",
        entityId: "darfield:pharmacy-relationship:in-area",
      },
    ],
    evidenceEntityIdsUsed: factIds,
    editorialFactIdsUsed: factIds,
  };
}

function main() {
  const original = loadEditorialEvidencePack(SLUG, SERVICE, "darfield");
  if (!original) throw new Error("missing original pack");
  const originalPackHash = hashFileSha256(ORIGINAL_PACK);
  if (originalPackHash !== "065e896a318589d4230f15670de7ff42f9594629b872507b4260ca15727239a9") {
    throw new Error(`original pack hash changed: ${originalPackHash}`);
  }
  const prev = loadResearch(RESEARCH_PREV);
  const extra = loadResearch(RESEARCH_NEW);
  const extraFacts = [...extraFactsFromSavedBodies(prev), ...extraFactsFromSavedBodies(extra)].filter(
    (fact) => fact.validationStatus === "accepted",
  );
  const seen = new Set(original.facts.map((f) => f.normalizedStatement));
  const mergedFacts: EditorialFactV3[] = [...original.facts];
  for (const fact of extraFacts) {
    if (seen.has(fact.normalizedStatement)) continue;
    seen.add(fact.normalizedStatement);
    mergedFacts.push(fact);
  }
  const editorial: EditorialEvidencePackV3 = { ...original, facts: mergedFacts };
  const input = buildPharmacyAiLocalCopyInputV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Darfield",
    areaSlug: "darfield",
    editorial,
  });
  const wombwellRec = loadAiLocalCopyPilotV3(SLUG, SERVICE, "wombwell");
  const wombwellPack = loadEditorialEvidencePack(SLUG, SERVICE, "wombwell");
  const previousFingerprints: string[] = [];
  if (wombwellRec && wombwellPack) {
    const wombwellInput = buildPharmacyAiLocalCopyInputV3({
      slug: SLUG,
      serviceId: SERVICE,
      areaName: "Wombwell",
      areaSlug: "wombwell",
      editorial: wombwellPack,
    });
    previousFingerprints.push(
      stripIdentityTokens(localNarrativeFingerprint(wombwellRec.outputCopy), {
        pharmacyName: wombwellInput.business.name,
        areaName: wombwellInput.locality.areaName,
        telephone: wombwellInput.business.telephone,
        address: wombwellInput.business.address,
        distanceLabel: wombwellInput.locality.distanceLabel,
        siblingAreaNames: wombwellInput.locality.neighbouringSelectedAreas,
      }),
    );
  }

  const factIds = [
    "darfield:area-identity:darfield-is-in-the-metropolitan-borough-of-barns",
    "darfield:community:darfield-library-is-on-church-street",
    "darfield:community:darfield-library-runs-regular-activities-and-spe",
    "darfield:heritage:darfield-history-society-runs-local-history-grou",
    "darfield:healthcare:nhs-general-practice-services-in-darfield-are-pr",
    "darfield:pharmacy-relationship:in-area",
  ];
  let chosen: AiLocalCopyV3 | null = null;
  let validated: ReturnType<typeof validateAiLocalCopyPilotV3> | null = null;
  const trials: unknown[] = [];
  for (const intro of INTROS) {
    const copy = buildCopy(intro, factIds);
    const result = validateAiLocalCopyPilotV3(copy, input, mergedFacts, previousFingerprints);
    const publication = inspectAiLocalCopyForPublicationV3(copy, input);
    trials.push({ intro, failures: result.failures, reviews: result.reviews, publicationFailures: publication.failures });
    if (result.failures.length === 0 && publication.failures.length === 0) {
      chosen = copy;
      validated = result;
      break;
    }
  }
  if (!chosen || !validated) {
    fs.writeFileSync(path.join(OUT_DIR, "operator-source-correction.json"), `${JSON.stringify({ ok: false, trials }, null, 2)}\n`);
    throw new Error(`operator correction failed: ${JSON.stringify(trials, null, 2)}`);
  }

  const hay = flattenAiLocalCopyText(chosen);
  const review = {
    wombwellLeak: /wombwell|roly poly|wishing tree|unicorn|heritage group|citizens advice|lundhill/i.test(hay),
    fromDarfieldTravel: /\bfrom Darfield\b/i.test(hay),
    gpWait: /waiting for a (?:routine )?GP|GP slot/i.test(hay),
    pharmacyInDarfield: /Yorkshire Pharmacy & Health Clinic in Darfield/i.test(hay),
    libraryListOnly: /public library and the Darfield History Society/i.test(hay) && !/Church Street/i.test(hay),
    churchStreet: /Church Street/i.test(hay),
    regularActivities: /regular activities and special events for children and adults/i.test(hay),
    historySociety: /Darfield History Society runs local history group sessions/i.test(hay),
  };
  if (review.wombwellLeak || review.fromDarfieldTravel || review.gpWait || review.libraryListOnly || !review.churchStreet) {
    throw new Error(`source review failed: ${JSON.stringify(review)}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const previousLive = JSON.parse(fs.readFileSync(LIVE_COPY, "utf8"));
  fs.writeFileSync(path.join(OUT_DIR, "previous-thin-darfield.json"), `${JSON.stringify(previousLive, null, 2)}\n`);
  const generate = JSON.parse(fs.readFileSync(GEN, "utf8")) as {
    openaiLedger?: { promptTokens?: number; completionTokens?: number; estimatedCostUsd?: number };
    durableBudget?: unknown;
    combinedCostUsd?: number;
    attemptLogPaths?: string[];
  };
  const now = new Date().toISOString();
  const nextRecord = {
    ...previousLive,
    generatedAt: now,
    tokenUsage: {
      promptTokens: generate.openaiLedger?.promptTokens || previousLive.tokenUsage?.promptTokens,
      completionTokens: generate.openaiLedger?.completionTokens || previousLive.tokenUsage?.completionTokens,
      totalTokens:
        (generate.openaiLedger?.promptTokens || 0) + (generate.openaiLedger?.completionTokens || 0) ||
        previousLive.tokenUsage?.totalTokens,
    },
    estimatedCostUsd: generate.openaiLedger?.estimatedCostUsd || previousLive.estimatedCostUsd,
    editorialFactIdsUsed: factIds,
    outputCopy: chosen,
    claimMap: validated.claims,
    sentencePurposes: validated.sentencePurposes,
    repetitionAnalysis: validated.repetitionAnalysis,
    validationResult: {
      ok: validated.failures.length === 0,
      failures: validated.failures,
      automatedReviews: validated.reviews,
    },
    reviewStatus: "candidate",
    approved: false,
    rawOpenAiResponse: previousLive.rawOpenAiResponse,
    rawOpenAiResponses: previousLive.rawOpenAiResponses,
    sourceCorrectedAt: now,
    parentCheckpoint: "data/pharmacy-ai-local-copy-checkpoints/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/darfield/2026-09-01T16-36Z-demo-standard",
    derivativeKind: "source-corrected-community-enrich",
    operatorCorrection: {
      reason: "AI draft and retry failed empty-local-claim / ungrounded character clauses. Operator kept supplied Darfield civic facts from the retry and previous accepted hero/relationship; removed ungrounded identity, GP-wait, clinical stuffing, and empty pathway wording. No third model call.",
      aiCallsUsed: 2,
      thirdModelCall: false,
      originalPackUnmutated: true,
    },
    label: "DARFIELD COMMUNITY-LED ENRICHED CANDIDATE — NOT PUBLISHED",
  };
  fs.writeFileSync(LIVE_COPY, `${JSON.stringify(nextRecord, null, 2)}\n`);

  const variant = renderStrategyVariantComparisonPreview("darfield");
  if (variant.sourceRoute !== "ai-local-strategy-variant-v3") throw new Error(`variant render failed: ${variant.sourceRoute}`);
  fs.writeFileSync(path.join(OUT_DIR, "darfield-variant-candidate.html"), variant.html);
  const variantText = stripHtmlToText(variant.html);
  const variantReview = {
    churchStreet: /Church Street/i.test(variant.html),
    regularActivities: /regular activities and special events/i.test(variant.html),
    historySociety: /Darfield History Society/i.test(variant.html),
    garlandHouse: /Garland House Surgery/i.test(variant.html),
    inDarfieldHow: /Using Pharmacy First in Darfield/i.test(variant.html),
    fromDarfieldHow: /Using Pharmacy First from Darfield/i.test(variant.html),
    gpWait: /waiting for a routine GP slot/i.test(variant.html),
    wombwellLeak: /Wombwell Heritage Group|Wombwell Medical Centre|Roly Poly|Wishing Tree/i.test(variant.html),
    clinical: /sore throat/i.test(variant.html) && /Seek urgent medical care for breathing difficulties/i.test(variant.html),
    banner: /Strategy variant comparison/i.test(variant.html),
    journeyHeadingStripped: !/Why Darfield patients start with the pharmacist/i.test(variant.html),
    travelHeading: /Yorkshire Pharmacy & Health Clinic in Darfield/i.test(headingSequence(variant.html).join(" | ")),
  };
  if (
    !variantReview.churchStreet ||
    !variantReview.regularActivities ||
    variantReview.fromDarfieldHow ||
    variantReview.gpWait ||
    variantReview.wombwellLeak ||
    !variantReview.clinical
  ) {
    throw new Error(`variant review failed: ${JSON.stringify(variantReview)}`);
  }

  const identity = { pharmacyName: PHARMACY, address: ADDRESS, telephone: PHONE };
  const liveRows = AREAS.map((areaSlug) => {
    const htmlPath = path.join(ECOSYSTEM, areaSlug, "index.html");
    const html = fs.readFileSync(htmlPath, "utf8");
    const strategy = html.match(/locality-page-strategy" content="([^"]+)"/)?.[1] || "unknown";
    const headings = headingSequence(html);
    const { why, travel } = extractWhyTravel(html);
    const distance = travel.match(/(\d+(?:\.\d+)?)\s*km from the pharmacy/i)?.[1] || (areaSlug === "darfield" ? "in-area" : "");
    const strippedWhy = stripIdentityTokens(why, { ...identity, areaName: areaSlug[0]!.toUpperCase() + areaSlug.slice(1) });
    const strippedTravel = stripIdentityTokens(travel, { ...identity, areaName: areaSlug[0]!.toUpperCase() + areaSlug.slice(1), distanceLabel: distance ? `${distance} km` : undefined });
    const editorial = editorialSummary(areaSlug);
    const aiCopy = fs.existsSync(path.join(ROOT, "data/pharmacy-ai-local-copy-pilots", SLUG, SERVICE, "v3", `${areaSlug}.json`));
    return {
      area: areaSlug[0]!.toUpperCase() + areaSlug.slice(1),
      areaSlug,
      liveEcosystemStrategy: strategy,
      liveSectionSequence: JOURNEY_SEQUENCE,
      liveHeadings: headings,
      distinctiveContentRoles: "None on the live ecosystem page. Why body is the shared patient-journey sentence; travel differs by area name, ‘directions from {area}’, distance, and nearby links.",
      availableLocalEvidence: {
        editorialPack: editorial,
        placesNames: placesNames(areaSlug),
        liveDistanceKm: distance,
      },
      missingCopy: editorial.missingCopy,
      uniquenessStatus:
        "VERIFIED DUPLICATE on live ecosystem HTML — identity-stripped why/travel match the other nine areas except names, distances and nearby links. Isolated AI variant not generated for this area in this task.",
      renderedUniquenessCompared: true,
      isolatedVariant: areaSlug === "darfield" || areaSlug === "wombwell",
      strippedWhy,
      strippedTravel,
    };
  });

  const strippedWhys = liveRows.map((row) => row.strippedWhy);
  const whyScores = liveRows.map((row, i) =>
    liveRows
      .filter((_, j) => j !== i)
      .map((other) => copySimilarityScore(row.strippedWhy, other.strippedWhy)),
  );
  const minWhy = Math.min(...whyScores.flat());
  const maxWhy = Math.max(...whyScores.flat());

  liveRows[0]!.uniquenessStatus =
    "Live ecosystem HTML is a verified name/distance/link duplicate of the other nine patient-journey-led pages. Isolated community-led variant candidate exists (this enrich) and is not the live ecosystem page.";
  liveRows[1]!.uniquenessStatus =
    "Live ecosystem HTML is a verified name/distance/link duplicate of the other nine patient-journey-led pages. Isolated primary-care-led variant exists from the restored comparison and is not the live ecosystem page. Product Owner accepted the file-based demo copy, not this ecosystem page.";
  for (const row of liveRows) {
    if (row.areaSlug !== "darfield" && row.areaSlug !== "wombwell") {
      row.missingCopy = `${row.missingCopy} UNVERIFIED as a unique local page until an isolated candidate is generated and its rendered content is compared.`;
    }
  }

  const matrix = {
    kind: "pharmacy-first-ten-area-variation-matrix",
    generatedAt: now,
    claim: "Do not claim all ten pages are unique. Live ecosystem pages were compared and are not unique.",
    liveEcosystemComparison: {
      strategy: "patient-journey-led for all ten",
      sectionSequence: JOURNEY_SEQUENCE,
      duplicatedSupportingPassage:
        "Patients look for approachable conversations, private consultation space where available, and honest guidance about the safest next step.",
      identityStrippedWhySimilarity: { min: minWhy, max: maxWhy, n: strippedWhys.length },
      differsOnlyBy: ["area name in headings", "Call … for directions from {area}", "{area} is {n} km from the pharmacy", "nearby locality links"],
      darfieldEcosystemWordingDefect: "Live ecosystem Darfield travel still says ‘directions from Darfield’ even though the pharmacy is in Darfield. That page is not this isolated variant and was not rewritten.",
    },
    isolatedVariantsCompared: {
      wombwell: {
        strategy: "primary-care-led",
        sectionSequence: PRIMARY_SEQUENCE,
        distinctiveContentRoles: [
          "why: accepted Wombwell civic recognition (library, Heritage Group, Citizens Advice, station artwork)",
          "how: Pharmacy First alongside GP care",
          "gp before conditions",
          "travel: in-Darfield premises + 1.7 km straight-line sentence",
        ],
        status: "Product Owner accepted local-detail standard. Not regenerated.",
        renderedCompared: true,
      },
      darfield: {
        strategy: "community-led",
        sectionSequence: COMMUNITY_SEQUENCE,
        distinctiveContentRoles: [
          "why: Darfield Library on Church Street, regular activities/special events, History Society sessions",
          "conditions before how",
          "how: in-area community pharmacy pathway without GP-wait or ‘from Darfield’",
          "gp: Garland House Surgery fact prepended",
          "travel: consultations at the Darfield premises",
        ],
        status: "Enriched isolated candidate. Not Product Owner accepted. Not published.",
        renderedCompared: true,
      },
    },
    planningOnlyNotGenerated: {
      note: "Six strategies may be reused later, but strategy selection alone does not prove uniqueness. Convenience-led copy is forbidden. Landmark-led needs verified landmark facts (Worsbrough Mill host was rejected). Access-led fits farther areas only if supporting prose is not a name/distance swap.",
      unusedStrategies: ["access-led", "convenience-led", "landmark-led", "patient-journey-led"],
    },
    areas: liveRows.map(({ strippedWhy, strippedTravel, liveHeadings, ...rest }) => ({
      ...rest,
      liveHeadingCount: liveHeadings.length,
      identityStrippedWhyPreview: strippedWhy.slice(0, 180),
    })),
  };
  fs.writeFileSync(path.join(OUT_DIR, "ten-area-matrix.json"), `${JSON.stringify(matrix, null, 2)}\n`);

  const hashes = {
    liveDarfieldCopy: sha(LIVE_COPY),
    fileBasedDarfieldHtml: sha(FILE_HTML),
    variantHtml: sha(path.join(OUT_DIR, "darfield-variant-candidate.html")),
    originalPack: originalPackHash,
    wombwellCopy: sha(path.join(ROOT, "data/pharmacy-ai-local-copy-pilots", SLUG, SERVICE, "v3/wombwell.json")),
    wombwellHtml: sha(path.join(ROOT, "output/pharmacy-ai-local-page-pilots", SLUG, SERVICE, "v3/local/wombwell/index.html")),
    previousThinCopy: sha(path.join(OUT_DIR, "previous-thin-darfield.json")),
  };
  const publication = inspectAiLocalCopyForPublicationV3(chosen, input);
  const out = {
    ok: validated.failures.length === 0 && publication.failures.length === 0 && !review.wombwellLeak,
    chosenIntro: chosen.localIntroduction,
    failures: validated.failures,
    reviews: validated.reviews,
    publicationFailures: publication.failures,
    review,
    variantReview,
    hashes,
    formatted: formatCustomerFacingLocalCopyV3(chosen),
    mergedFactStatements: mergedFacts.map((f) => f.normalizedStatement),
    trials,
  };
  fs.writeFileSync(path.join(OUT_DIR, "operator-source-correction.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ ok: out.ok, hashes, reviews: validated.reviews, chosenIntro: chosen.localIntroduction, variantReview }, null, 2));
}

main();
