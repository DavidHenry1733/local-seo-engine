import fs from "node:fs";
import path from "node:path";

import { getOpenAiIntegrationClient } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/generator/generateClusterContent.ts";
import {
  AI_LOCAL_NARRATIVE_MODEL_V3,
  buildPharmacyAiLocalCopyInputV3,
  generateAiLocalCopyPilotV3,
  getAiPilotLedgerV3,
  hydrateOpenAiEnvIfNeeded,
  loadAiLocalCopyPilotV3,
  loadAuthorizedTaskBudgetV3,
  authorizedTaskBudgetPathV3,
  validateAiLocalCopyPilotV3,
  type PilotProviderAdapterV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  buildAiLocalNarrativeSystemPromptV3,
  buildAiLocalNarrativeUserPromptV3,
  buildAiLocalNarrativeWritingBriefV3,
  PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  formatCustomerFacingLocalCopyV3,
  inspectAiLocalCopyForPublicationV3,
  localNarrativeFingerprint,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { flattenAiLocalCopyText } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { stripIdentityTokens } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalPageCandidateUniquenessV1.ts";
import { loadEditorialEvidencePack } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
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

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const TASK_ID = "darfield-v3-community-enrich-2026-09-01";
const COMBINED_BUDGET_USD = 1;
const ORIGINAL_PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/darfield.json");
const RESEARCH_PREV = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-demo-standard-research.json");
const RESEARCH_NEW = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-community-enrich-research.json");
const RESEARCH_LEDGER = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-community-enrich-cost-ledger.json");
const OUT_DIR = path.join(ROOT, "data/pharmacy-ai-local-copy-diagnostics", SLUG, SERVICE, "v3/darfield/2026-09-01-community-enrich");
const LEDGER = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-community-enrich-generation-cost-ledger.json");

const WOMBWELL_STYLE_REFERENCE = [
  "STYLE REFERENCE ONLY. Copy the content roles, calm British patient-facing tone, service-led opening, and how sourced local recognition is woven into connected prose. Do not copy any Wombwell fact.",
  "Do not mention Wombwell, Wombwell Heritage Group, Citizens Advice, Roly Poly Hill, Wishing Tree, unicorn emblem, Wombwell station, Wombwell Park, Wombwell Medical Centre, or Lundhill.",
  "The pharmacy premises are physically in Darfield. State that clearly. Do not describe Darfield readers as travelling from Darfield to the pharmacy, and do not use “from Darfield” as if the pharmacy were in another town.",
  "Do not invent resident habits, present-day employment, healthcare demand, referral relationships, GP waiting times, or travel claims.",
  "Do not write another short list that only names a library and a GP. Weave the supplied Darfield civic facts into connected local-recognition prose in localIntroduction. Put the named GP fact in localContextParagraphs, not as a bullet list beside the library.",
  "Example of roles and tone from a different town (facts must not be reused):",
  "heroIntroduction: Pharmacy First is available to people in Wombwell, offering NHS consultations for eligible common conditions. This service is provided by Yorkshire Pharmacy & Health Clinic in Darfield, supporting residents of Wombwell and the wider Barnsley area.",
  "localIntroduction: Wombwell is in the Metropolitan Borough of Barnsley, South Yorkshire. The area features a public library, which hosts local history sessions run by Wombwell Heritage Group. Citizens Advice also holds advice and welfare rights drop-in sessions at the library. Artwork at Wombwell station refers to the Roly Poly Hill and Wishing Tree at Wombwell Park, and features the Wombwell unicorn emblem.",
  "For Darfield, invert the premises relationship: consultations take place in Darfield because the premises are in Darfield.",
].join("\n");

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
    usableBody?: boolean;
  }>;
  facts?: EditorialFactV3[];
}): EditorialFactV3[] {
  const out: EditorialFactV3[] = [...(research.facts || [])];
  for (const page of research.retrievedPages || []) {
    if (!page.textSample || page.sourceClass === "rejected") continue;
    const url = page.finalUrl || page.requestedUrl || "";
    const host = hostFromUrl(url);
    const drafts = extractEditorialFactDrafts({
      areaName: "Darfield",
      title: page.title || "",
      text: page.textSample,
      sourceClass: "primary",
      publisher: page.publisher || host,
      host,
    });
    for (const draft of drafts) {
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
  if (!fs.existsSync(file)) return { retrievedPages: [], facts: [] };
  return JSON.parse(fs.readFileSync(file, "utf8")) as {
    dataForSeoCostUsd?: number;
    pageFetches?: number;
    retrievedPages?: Array<{
      requestedUrl?: string;
      finalUrl?: string;
      title?: string;
      publisher?: string;
      retrievedAt?: string;
      textSample?: string;
      sourceClass?: string;
      usableBody?: boolean;
    }>;
    facts?: EditorialFactV3[];
  };
}

async function main() {
  process.chdir(ROOT);
  const openai = hydrateOpenAiEnvIfNeeded();
  if (!openai.ok) throw new Error(openai.detail);
  const original = loadEditorialEvidencePack(SLUG, SERVICE, "darfield");
  if (!original) throw new Error("missing original pack");
  const originalPackHash = hashFileSha256(ORIGINAL_PACK);
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

  const previousFingerprints: string[] = [];
  for (const area of ["wombwell", "darfield"] as const) {
    const rec = loadAiLocalCopyPilotV3(SLUG, SERVICE, area);
    const pack = loadEditorialEvidencePack(SLUG, SERVICE, area);
    if (!rec || !pack) continue;
    const input = buildPharmacyAiLocalCopyInputV3({
      slug: SLUG,
      serviceId: SERVICE,
      areaName: area === "wombwell" ? "Wombwell" : "Darfield",
      areaSlug: area,
      editorial: pack,
    });
    previousFingerprints.push(
      stripIdentityTokens(localNarrativeFingerprint(rec.outputCopy), {
        pharmacyName: input.business.name,
        areaName: input.locality.areaName,
        telephone: input.business.telephone,
        address: input.business.address,
        distanceLabel: input.locality.distanceLabel,
        siblingAreaNames: input.locality.neighbouringSelectedAreas,
      }),
    );
  }

  const input = buildPharmacyAiLocalCopyInputV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Darfield",
    areaSlug: "darfield",
    editorial,
  });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "writing-brief.txt"), `${buildAiLocalNarrativeWritingBriefV3("Darfield")}\n`);
  fs.writeFileSync(path.join(OUT_DIR, "system-prompt-v3.txt"), `${buildAiLocalNarrativeSystemPromptV3(input.vertical, input.locality.areaName)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, "user-prompt-v3.json.txt"), `${buildAiLocalNarrativeUserPromptV3(input)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, "style-reference.txt"), `${WOMBWELL_STYLE_REFERENCE}\n`);
  fs.writeFileSync(path.join(OUT_DIR, "locked-clinical-facts.json"), `${JSON.stringify(PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1, null, 2)}\n`);
  fs.writeFileSync(
    path.join(OUT_DIR, "merged-facts.json"),
    `${JSON.stringify(mergedFacts.map((f) => ({ factId: f.factId, statement: f.normalizedStatement, sourceUrl: f.sourceUrl })), null, 2)}\n`,
  );

  let providerCall = 0;
  const providerAdapter: PilotProviderAdapterV3 = async (request) => {
    providerCall += 1;
    const next = {
      ...request,
      messages: request.messages.map((message) =>
        message.role === "user"
          ? { ...message, content: `${message.content}\n\n${WOMBWELL_STYLE_REFERENCE}` }
          : message,
      ),
    };
    fs.writeFileSync(path.join(OUT_DIR, `provider-request-${providerCall}.json`), `${JSON.stringify(next, null, 2)}\n`);
    const client = getOpenAiIntegrationClient();
    const response = await client.chat.completions.create(next);
    const raw = response.choices[0]?.message?.content ?? "";
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };
    return {
      raw,
      model: response.model || AI_LOCAL_NARRATIVE_MODEL_V3,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      uncertain: !String(raw || "").trim(),
    };
  };

  const researchCost = Number(extra.dataForSeoCostUsd || 0);
  const generated = await generateAiLocalCopyPilotV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Darfield",
    areaSlug: "darfield",
    previousFingerprints,
    writeRecord: false,
    persistAttemptLogs: true,
    maxAttempts: 2,
    maxProviderCalls: 2,
    maxCostUsd: Math.max(0.01, COMBINED_BUDGET_USD - researchCost),
    authorizedTaskId: TASK_ID,
    editorial,
    providerAdapter,
  });

  const copy = generated.ok ? generated.record.outputCopy : generated.copy;
  const validated = copy ? validateAiLocalCopyPilotV3(copy, input, editorial.facts, previousFingerprints) : null;
  const publication = copy ? inspectAiLocalCopyForPublicationV3(copy, input) : null;
  const hay = copy ? flattenAiLocalCopyText(copy) : "";
  const sourceReview = {
    wombwellLeak: /wombwell|roly poly|wishing tree|unicorn emblem|heritage group|citizens advice|lundhill/i.test(hay),
    pharmacyInDarfield: /in Darfield/i.test(hay) && /yorkshire pharmacy/i.test(hay),
    travellingFromDarfield: /from Darfield/i.test(hay) && /travel|journey|reach|directions/i.test(hay),
    gpWait: /waiting for a (?:routine )?GP|GP slot|without waiting for a GP/i.test(hay),
    inventedHabits: /residents (?:often|typically|usually)|same-day availability/i.test(hay),
    libraryListOnly: /has a public library/.test(hay) && !/History Society|Church Street|regular activities/i.test(hay),
    factsUsed: copy?.editorialFactIdsUsed || [],
    knownFactIds: mergedFacts.map((f) => f.factId),
  };
  const openaiLedger = getAiPilotLedgerV3();
  const durable = loadAuthorizedTaskBudgetV3(authorizedTaskBudgetPathV3({ slug: SLUG, serviceId: SERVICE, taskId: TASK_ID }));
  const openaiCost = Number(durable?.estimatedCostUsd || openaiLedger.estimatedCostUsd || 0);
  const costLedger = {
    taskId: TASK_ID,
    dataForSeoCostUsd: researchCost,
    newRetrievals: Number(extra.pageFetches || 0),
    openaiCostUsd: openaiCost,
    combinedCostUsd: researchCost + openaiCost,
    events: [
      { at: new Date().toISOString(), kind: "openai-generation", authorizedTaskId: TASK_ID, estimatedCostUsd: openaiCost, ok: generated.ok },
    ],
  };
  fs.writeFileSync(LEDGER, `${JSON.stringify(costLedger, null, 2)}\n`);
  if (fs.existsSync(RESEARCH_LEDGER)) {
    const researchLedger = JSON.parse(fs.readFileSync(RESEARCH_LEDGER, "utf8")) as Record<string, unknown>;
    researchLedger.openaiCostUsd = openaiCost;
    researchLedger.combinedCostUsd = researchCost + openaiCost;
    (researchLedger.events as Array<Record<string, unknown>>).push(costLedger.events[0]!);
    fs.writeFileSync(RESEARCH_LEDGER, `${JSON.stringify(researchLedger, null, 2)}\n`);
  }

  const payload = {
    ok: generated.ok,
    originalPackHash,
    originalPackUnchanged: hashFileSha256(ORIGINAL_PACK) === originalPackHash,
    lockedClinicalFactsSupplied: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
    mergedFactStatements: mergedFacts.map((f) => f.normalizedStatement),
    openaiLedger,
    durableBudget: durable,
    combinedCostUsd: costLedger.combinedCostUsd,
    attemptLogPaths: generated.attemptLogPaths,
    detail: generated.ok ? undefined : generated.detail,
    failures: generated.ok ? [] : generated.failures,
    validator: validated
      ? { ok: validated.ok, failures: validated.failures, reviews: validated.reviews, claims: validated.claims }
      : null,
    publicationGate: publication,
    sourceReview,
    formatted: copy ? formatCustomerFacingLocalCopyV3(copy) : "",
    copy,
    generatedAt: generated.ok ? generated.record.generatedAt : null,
    tokenUsage: generated.ok ? generated.record.tokenUsage : null,
    estimatedCostUsd: generated.ok ? generated.record.estimatedCostUsd : openaiCost,
    raw: generated.ok ? generated.record.rawOpenAiResponse : generated.raw,
    raws: generated.ok ? generated.record.rawOpenAiResponses : undefined,
    record: generated.ok ? generated.record : null,
  };
  fs.writeFileSync(path.join(OUT_DIR, "generate-result.json"), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        ok: generated.ok,
        originalPackUnchanged: payload.originalPackUnchanged,
        mergedFactStatements: payload.mergedFactStatements,
        durable,
        combinedCostUsd: payload.combinedCostUsd,
        attemptLogPaths: generated.attemptLogPaths,
        failures: payload.failures,
        reviews: validated?.reviews || [],
        publicationFailures: publication?.failures || [],
        sourceReview,
        formatted: payload.formatted,
      },
      null,
      2,
    ),
  );
  if (!generated.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
