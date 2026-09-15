/**
 * Pharmacy AI local-narrative engine V3 — editorial-evidence pilots only.
 * Reuses getOpenAiIntegrationClient(). Preview must never call this.
 * Must never write v1/v2 records or live pages.
 */
import fs from "node:fs";
import path from "node:path";

import {
  getOpenAiIntegrationClient,
  OPENAI_INTEGRATION_CHAT_MODEL,
} from "../../generator/generateClusterContent.ts";
import {
  loadPharmacyLocalEvidencePack,
  localEvidencePackPath,
  validatePharmacyLocalEvidencePack,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { parseAiLocalCopyV3, type AiLocalCopyV3, type AiSentencePurposeRowV2 } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
  buildAiLocalNarrativeSystemPromptV3,
  buildAiLocalNarrativeUserPromptV3,
  type BusinessLocalityCopyInputV3,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { groundAiLocalCopyClaimsV3, type AiLocalClaimMapRowV1 } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { evaluateAiLocalCopyQualityV3, formatCustomerFacingLocalCopyV3, localNarrativeFingerprint } from "./pharmacyAiLocalCopyQualityV1.ts";
import {
  analyseRepetitionV3,
  classifySentencePurposesV2,
  type AiRepetitionAnalysisV2,
} from "./pharmacyAiLocalCopyEditorialReviewV2.ts";
import {
  buildPharmacyAiLocalCopyInputV1,
  estimateGpt41CostUsd,
  hashFileSha256,
  hydrateOpenAiEnvIfNeeded,
  type AiGenerationLedger,
} from "./pharmacyAiLocalNarrativeEngineV1.ts";
import {
  AI_LOCAL_PILOT_V3_AREAS,
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  aiLocalCopyAttemptLogPath,
  aiLocalCopyPilotPath,
} from "./pharmacyAiLocalPageCandidatePaths.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import {
  LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD,
  stripIdentityTokens,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import {
  isCustomerAppropriateOrganisationName,
  type EditorialEvidencePackV3,
  type EditorialFactV3,
} from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import { loadEditorialEvidencePack } from "./pharmacyLocalEditorialEvidenceCollectorV3.ts";

export const AI_LOCAL_NARRATIVE_ENGINE_ID_V3 = "pharmacy-ai-local-narrative-engine-v3";
export const AI_LOCAL_NARRATIVE_PROVIDER_V3 = "openai";
export const AI_LOCAL_NARRATIVE_MODEL_V3 = OPENAI_INTEGRATION_CHAT_MODEL;
export const AI_LOCAL_PILOT_V3_MAX_SUCCESS = 3;
export const AI_LOCAL_PILOT_V3_MAX_COST_USD = 2;

export type AiLocalCopyPilotRecordV3 = {
  promptContractId: string;
  promptContractVersion: string;
  promptContractPath: string;
  provider: string;
  model: string;
  generatedAt: string;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  estimatedCostUsd: number;
  inputEvidencePackHash: string;
  editorialEvidencePackHash: string;
  areaSlug: string;
  areaName: string;
  editorialFactIdsUsed: string[];
  outputCopy: AiLocalCopyV3;
  claimMap: AiLocalClaimMapRowV1[];
  sentencePurposes: AiSentencePurposeRowV2[];
  repetitionAnalysis: AiRepetitionAnalysisV2;
  validationResult: { ok: boolean; failures: string[] };
  reviewStatus: "candidate";
  approved: false;
  rawOpenAiResponse?: string;
  rawOpenAiResponses?: string[];
};

const ledger: AiGenerationLedger = {
  attempted: 0,
  successful: 0,
  failed: 0,
  retried: 0,
  promptTokens: 0,
  completionTokens: 0,
  estimatedCostUsd: 0,
  failures: [],
};

export function resetAiPilotLedgerV3(initialCostUsd = 0): AiGenerationLedger {
  ledger.attempted = 0;
  ledger.successful = 0;
  ledger.failed = 0;
  ledger.retried = 0;
  ledger.promptTokens = 0;
  ledger.completionTokens = 0;
  ledger.estimatedCostUsd = initialCostUsd;
  ledger.failures = [];
  return getAiPilotLedgerV3();
}

export function getAiPilotLedgerV3(): AiGenerationLedger {
  return { ...ledger, failures: [...ledger.failures] };
}

export function buildPharmacyAiLocalCopyInputV3(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  editorial: EditorialEvidencePackV3;
}): BusinessLocalityCopyInputV3 {
  const rawPack = loadPharmacyLocalEvidencePack(opts.slug, opts.areaSlug);
  const checked = validatePharmacyLocalEvidencePack(rawPack, {
    slug: opts.slug,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
  });
  if (!checked.ok) throw new Error(checked.detail);
  const base = buildPharmacyAiLocalCopyInputV1({
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    pack: checked.pack,
  });
  base.locality.acceptedEntities = base.locality.acceptedEntities.filter((entity) =>
    isCustomerAppropriateOrganisationName(entity.name),
  );
  return {
    ...base,
    editorialFacts: opts.editorial.facts
      .filter((fact) => fact.validationStatus === "accepted")
      .filter((fact) => {
        const provided = fact.normalizedStatement.match(/provided from\s+(.+?)\.?$/i)?.[1]?.trim() || "";
        return !provided || isCustomerAppropriateOrganisationName(provided);
      })
      .map((fact) => ({
        factId: fact.factId,
        category: fact.category,
        normalizedStatement: fact.normalizedStatement,
        permittedCopyRole: fact.permittedCopyRole,
        prohibitedInference: fact.prohibitedInference,
        sourceClass: fact.sourceClass,
        publisher: fact.publisher,
      })),
    editorialSufficiency: opts.editorial.sufficiency.status,
  };
}

export function validateAiLocalCopyPilotV3(
  copy: AiLocalCopyV3,
  input: BusinessLocalityCopyInputV3,
  editorialFacts: EditorialFactV3[],
  previousFingerprints: string[] = [],
): {
  ok: boolean;
  failures: string[];
  claims: AiLocalClaimMapRowV1[];
  sentencePurposes: AiSentencePurposeRowV2[];
  repetitionAnalysis: AiRepetitionAnalysisV2;
} {
  const grounded = groundAiLocalCopyClaimsV3(copy, input, editorialFacts);
  const quality = evaluateAiLocalCopyQualityV3(copy, input);
  const repetitionAnalysis = analyseRepetitionV3(copy, input);
  const failures = [...grounded.failures, ...quality.failures, ...repetitionAnalysis.failures];
  const knownIds = new Set(
    editorialFacts.filter((f) => f.validationStatus === "accepted").map((f) => f.factId),
  );
  for (const id of copy.editorialFactIdsUsed || []) {
    if (!knownIds.has(id)) failures.push(`editorialFactIdsUsed contains unknown id ${id}`);
  }
  const fingerprint = stripIdentityTokens(localNarrativeFingerprint(copy), {
    pharmacyName: input.business.name,
    areaName: input.locality.areaName,
    telephone: input.business.telephone,
    address: input.business.address,
    distanceLabel: input.locality.distanceLabel,
    siblingAreaNames: input.locality.neighbouringSelectedAreas,
  });
  for (const prev of previousFingerprints) {
    const score = copySimilarityScore(fingerprint, prev);
    if (score > LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD) {
      failures.push(
        `local-narrative similarity ${score.toFixed(3)} > ${LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD} versus a previous area`,
      );
    }
  }
  const sentencePurposes = classifySentencePurposesV2(
    copy,
    grounded.claims.filter((row) => row.validationResult === "pass"),
  );
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    claims: grounded.claims,
    sentencePurposes,
    repetitionAnalysis,
  };
}

function stripStreet(text: string, address: string): string {
  const street = String(address || "").split(",")[0]?.trim() || "";
  let out = text;
  if (address) out = out.replace(address, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",");
  if (street && street.length > 6) out = out.replace(new RegExp(street.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  return out.replace(/\s{2,}/g, " ").replace(/\s+at\s*\./g, ".").replace(/\s+at\s*$/g, "").trim();
}

export function enforceEditorialDisciplineV3(
  copy: AiLocalCopyV3,
  input: BusinessLocalityCopyInputV3,
): AiLocalCopyV3 {
  const next: AiLocalCopyV3 = {
    ...copy,
    localContextParagraphs: [...copy.localContextParagraphs],
    localFaqs: copy.localFaqs.map((faq) => ({ ...faq })),
  };
  const fields: Array<keyof Pick<AiLocalCopyV3, "heroIntroduction" | "localIntroduction" | "relationshipToPharmacy" | "localAccessIntroduction" | "localCtaBridge">> = [
    "heroIntroduction",
    "localIntroduction",
    "relationshipToPharmacy",
    "localAccessIntroduction",
    "localCtaBridge",
  ];
  for (const field of fields) next[field] = stripStreet(next[field], input.business.address);
  next.localContextParagraphs = next.localContextParagraphs.map((para) => stripStreet(para, input.business.address));
  next.localFaqs = next.localFaqs.map((faq) => ({
    question: stripStreet(faq.question, input.business.address),
    answer: stripStreet(faq.answer, input.business.address),
  }));

  next.heroIntroduction = next.heroIntroduction.replace(/\byour gp\b/gi, "a GP");
  next.localIntroduction = next.localIntroduction.replace(/\byour gp\b/gi, "a GP");
  next.relationshipToPharmacy = next.relationshipToPharmacy.replace(/\byour gp\b/gi, "a GP");
  next.localAccessIntroduction = next.localAccessIntroduction.replace(/\byour gp\b/gi, "a GP");
  next.localCtaBridge = next.localCtaBridge.replace(/\byour gp\b/gi, "a GP");
  next.localContextParagraphs = next.localContextParagraphs.map((para) => para.replace(/\byour gp\b/gi, "a GP"));
  next.localFaqs = next.localFaqs.map((faq) => ({
    question: faq.question.replace(/\byour gp\b/gi, "a GP"),
    answer: faq.answer.replace(/\byour gp\b/gi, "a GP"),
  }));
  return next;
}

export function sanitizeAiLocalAttemptPayloadV3(value: unknown): unknown {
  const secretKey =
    /^(api[_-]?key|authorization|token|password|secret|credentials?|openai_api_key|ai_integrations_openai_api_key)$/i;
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      return node.replace(/sk-[A-Za-z0-9_\-]+/g, "[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(node as Record<string, unknown>)) {
        if (secretKey.test(key) || /api[-_]?key/i.test(key)) continue;
        out[key] = walk(nested);
      }
      return out;
    }
    return node;
  };
  return walk(value);
}

export function persistAiLocalAttemptLogV3(opts: {
  slug: string;
  serviceId: string;
  areaSlug: string;
  attemptNumber: number;
  request: unknown;
  rawResponse: string;
  validationResult: { ok: boolean; failures: string[] };
  copy: AiLocalCopyV3 | null;
}): string {
  const savedAt = new Date().toISOString();
  const attemptId = `${savedAt.replace(/[:.]/g, "-")}-attempt-${opts.attemptNumber}`;
  const logFile = aiLocalCopyAttemptLogPath(
    opts.slug,
    opts.serviceId,
    opts.areaSlug,
    attemptId,
    AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  );
  if (logFile.includes("/pharmacy-ai-local-copy-candidates/") || logFile.includes("/v2/") || /(?:^|\/)wombwell\.json$/.test(logFile)) {
    throw new Error("refusing to write an attempt log onto a candidate or v2 path");
  }
  const payload = sanitizeAiLocalAttemptPayloadV3({
    savedAt,
    areaSlug: opts.areaSlug,
    attemptNumber: opts.attemptNumber,
    promptContractId: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
    promptContractVersion: AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
    sanitizedRequest: opts.request,
    rawResponse: opts.rawResponse,
    validationResult: opts.validationResult,
    parsedCopy: opts.copy,
    candidateRecordWritten: false,
  });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return logFile;
}

export function buildStructuredPilotChatRequestV3(
  input: BusinessLocalityCopyInputV3,
  retryFailures: string[] = [],
): {
  model: string;
  temperature: number;
  max_tokens: number;
  response_format: { type: "json_object" };
  messages: Array<{ role: "system" | "user"; content: string }>;
} {
  const user = buildAiLocalNarrativeUserPromptV3(input);
  const retryNote = retryFailures.length
    ? `\n\nThe previous JSON failed validation. Fix these issues and return a complete new JSON object. Do not explain the issues in the copy:\n- ${retryFailures.slice(0, 8).join("\n- ")}`
    : "";
  return {
    model: AI_LOCAL_NARRATIVE_MODEL_V3,
    temperature: retryFailures.length ? 0.3 : 0.4,
    max_tokens: 2200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildAiLocalNarrativeSystemPromptV3(input.vertical) },
      { role: "user", content: user + retryNote },
    ],
  };
}

async function requestStructuredPilotCopyV3(
  input: BusinessLocalityCopyInputV3,
  retryFailures: string[] = [],
): Promise<{
  raw: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  request: ReturnType<typeof buildStructuredPilotChatRequestV3>;
}> {
  const client = getOpenAiIntegrationClient();
  const request = buildStructuredPilotChatRequestV3(input, retryFailures);
  const response = await client.chat.completions.create(request);
  const raw = response.choices[0]?.message?.content ?? "";
  const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };
  return {
    raw,
    model: response.model || AI_LOCAL_NARRATIVE_MODEL_V3,
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    request,
  };
}

function recordUsage(promptTokens: number, completionTokens: number): number {
  const cost = estimateGpt41CostUsd(promptTokens, completionTokens);
  ledger.promptTokens += promptTokens;
  ledger.completionTokens += completionTokens;
  ledger.estimatedCostUsd += cost;
  return cost;
}

export async function generateAiLocalCopyPilotV3(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  previousFingerprints?: string[];
  writeRecord?: boolean;
  maxCostUsd?: number;
  maxAttempts?: number;
}): Promise<
  | { ok: true; record: AiLocalCopyPilotRecordV3; fingerprint: string; attemptLogPaths: string[] }
  | {
      ok: false;
      areaSlug: string;
      detail: string;
      failures: string[];
      wrote: false;
      copy: AiLocalCopyV3 | null;
      raw: string;
      attemptLogPaths: string[];
    }
> {
  const maxCostUsd = opts.maxCostUsd ?? AI_LOCAL_PILOT_V3_MAX_COST_USD;
  if (!(AI_LOCAL_PILOT_V3_AREAS as readonly string[]).includes(opts.areaSlug)) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "area not in authorised v3 pilot set", failures: ["area"], wrote: false, copy: null, raw: "", attemptLogPaths: [] };
  }
  if (ledger.successful >= AI_LOCAL_PILOT_V3_MAX_SUCCESS) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "successful-generation limit reached", failures: ["limit"], wrote: false, copy: null, raw: "", attemptLogPaths: [] };
  }
  if (ledger.estimatedCostUsd >= maxCostUsd) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "cost limit reached", failures: ["cost"], wrote: false, copy: null, raw: "", attemptLogPaths: [] };
  }

  const editorial = loadEditorialEvidencePack(opts.slug, opts.serviceId, opts.areaSlug);
  if (!editorial || editorial.sufficiency.status !== "READY") {
    return {
      ok: false,
      areaSlug: opts.areaSlug,
      detail: "EVIDENCE LIMITED",
      failures: editorial?.sufficiency.reasons || ["missing editorial pack"],
      wrote: false,
      copy: null,
      raw: "",
      attemptLogPaths: [],
    };
  }

  const rawPack = loadPharmacyLocalEvidencePack(opts.slug, opts.areaSlug);
  const checked = validatePharmacyLocalEvidencePack(rawPack, {
    slug: opts.slug,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
  });
  if (!checked.ok) {
    ledger.failed += 1;
    return { ok: false, areaSlug: opts.areaSlug, detail: checked.detail, failures: [checked.detail], wrote: false, copy: null, raw: "", attemptLogPaths: [] };
  }
  const packHash = hashFileSha256(localEvidencePackPath(opts.slug, opts.areaSlug));
  const editorialPath = path.join(
    process.cwd(),
    "data/pharmacy-local-editorial-evidence-pilots",
    opts.slug,
    opts.serviceId,
    "v3",
    `${opts.areaSlug}.json`,
  );
  const editorialHash = fs.existsSync(editorialPath) ? hashFileSha256(editorialPath) : "";
  const input = buildPharmacyAiLocalCopyInputV3({
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    editorial,
  });

  const capturedRaws: string[] = [];
  const attemptLogPaths: string[] = [];
  const tryOnce = async (retryFailures: string[]) => {
    if (ledger.estimatedCostUsd + 0.04 >= maxCostUsd) throw new Error("cost-limit-precheck");
    ledger.attempted += 1;
    if (retryFailures.length) ledger.retried += 1;
    const response = await requestStructuredPilotCopyV3(input, retryFailures);
    capturedRaws.push(response.raw);
    recordUsage(response.promptTokens, response.completionTokens);
    const parsed = parseAiLocalCopyV3(response.raw);
    if (!parsed.ok) {
      return {
        ok: false as const,
        failures: parsed.failures,
        copy: null,
        claims: [] as AiLocalClaimMapRowV1[],
        sentencePurposes: [] as AiSentencePurposeRowV2[],
        repetitionAnalysis: null as AiRepetitionAnalysisV2 | null,
        raw: response.raw,
        request: response.request,
        model: response.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
      };
    }
    const copy = enforceEditorialDisciplineV3(parsed.copy, input);
    if (opts.areaSlug === "wombwell") {
      console.log(`\n===== WOMBWELL CUSTOMER-FACING LOCAL COPY (${retryFailures.length ? "retry" : "attempt"}) =====\n${formatCustomerFacingLocalCopyV3(copy)}\n===== END WOMBWELL COPY =====\n`);
    }
    const validated = validateAiLocalCopyPilotV3(
      copy,
      input,
      editorial.facts,
      opts.previousFingerprints || [],
    );
    if (!validated.ok && opts.areaSlug === "wombwell") {
      console.error(`Wombwell copy rejected before accept: ${validated.failures.join(" | ")}`);
    }
    return {
      ok: validated.ok,
      failures: validated.failures,
      copy,
      claims: validated.claims,
      sentencePurposes: validated.sentencePurposes,
      repetitionAnalysis: validated.repetitionAnalysis,
      raw: response.raw,
      request: response.request,
      model: response.model,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
    };
  };

  let result: Awaited<ReturnType<typeof tryOnce>> | null = null;
  let lastFailures: string[] = [];
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const isRetry = attempt > 0;
    try {
      result = await tryOnce(isRetry ? lastFailures : []);
      attemptLogPaths.push(
        persistAiLocalAttemptLogV3({
          slug: opts.slug,
          serviceId: opts.serviceId,
          areaSlug: opts.areaSlug,
          attemptNumber: attempt + 1,
          request: result.request,
          rawResponse: result.raw,
          validationResult: { ok: result.ok, failures: result.failures },
          copy: result.copy,
        }),
      );
      if (result.ok && result.copy) break;
      lastFailures = result.failures;
      if (result.failures.length) {
        console.error(`AI v3 pilot ${opts.areaSlug}${isRetry ? " retry" : ""}: ${result.failures.slice(0, 6).join(" | ")}`);
        if (result.copy) {
          console.error(`\n===== FAILED ${opts.areaSlug.toUpperCase()} WORDING =====\n${formatCustomerFacingLocalCopyV3(result.copy)}\n===== END FAILED WORDING =====\n`);
        }
        if (result.raw) console.error(`===== FAILED RAW RESPONSE =====\n${result.raw}\n===== END FAILED RAW =====\n`);
      }
      if (maxAttempts === 1) break;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "ai-request-failed";
      lastFailures = [detail];
      result = {
        ok: false as const,
        failures: lastFailures,
        copy: null,
        claims: [] as AiLocalClaimMapRowV1[],
        sentencePurposes: [] as AiSentencePurposeRowV2[],
        repetitionAnalysis: null,
        raw: "",
        request: { unsent: true, reason: detail },
      };
      attemptLogPaths.push(
        persistAiLocalAttemptLogV3({
          slug: opts.slug,
          serviceId: opts.serviceId,
          areaSlug: opts.areaSlug,
          attemptNumber: attempt + 1,
          request: result.request,
          rawResponse: "",
          validationResult: { ok: false, failures: lastFailures },
          copy: null,
        }),
      );
      if (maxAttempts === 1 || attempt === maxAttempts - 1) break;
    }
  }

  if (!result?.ok || !result.copy || !result.repetitionAnalysis) {
    ledger.failed += 1;
    ledger.failures.push({ areaSlug: opts.areaSlug, detail: lastFailures[0] || "validation-failed" });
    return {
      ok: false,
      areaSlug: opts.areaSlug,
      detail: lastFailures[0] || "validation-failed",
      failures: lastFailures,
      wrote: false,
      copy: result?.copy || null,
      raw: result?.raw || capturedRaws[capturedRaws.length - 1] || "",
      attemptLogPaths,
    };
  }

  const record: AiLocalCopyPilotRecordV3 = {
    promptContractId: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
    promptContractVersion: AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
    promptContractPath: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
    provider: AI_LOCAL_NARRATIVE_PROVIDER_V3,
    model: result.model || AI_LOCAL_NARRATIVE_MODEL_V3,
    generatedAt: new Date().toISOString(),
    tokenUsage: {
      promptTokens: result.promptTokens || 0,
      completionTokens: result.completionTokens || 0,
      totalTokens: (result.promptTokens || 0) + (result.completionTokens || 0),
    },
    estimatedCostUsd: estimateGpt41CostUsd(result.promptTokens || 0, result.completionTokens || 0),
    inputEvidencePackHash: packHash,
    editorialEvidencePackHash: editorialHash,
    areaSlug: opts.areaSlug,
    areaName: opts.areaName,
    editorialFactIdsUsed: result.copy.editorialFactIdsUsed,
    outputCopy: result.copy,
    claimMap: result.claims,
    sentencePurposes: result.sentencePurposes,
    repetitionAnalysis: result.repetitionAnalysis,
    validationResult: { ok: true, failures: [] },
    reviewStatus: "candidate",
    approved: false,
    rawOpenAiResponse: result.raw || capturedRaws[capturedRaws.length - 1] || "",
    rawOpenAiResponses: capturedRaws,
  };
  if (opts.writeRecord !== false) {
    const file = aiLocalCopyPilotPath(opts.slug, opts.serviceId, opts.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
    if (file.includes("/pharmacy-ai-local-copy-candidates/") || file.includes("/v2/")) {
      throw new Error("refusing to write a v3 pilot into v1/v2 paths");
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(record, null, 2), "utf8");
  }
  ledger.successful += 1;
  const fingerprint = stripIdentityTokens(localNarrativeFingerprint(result.copy), {
    pharmacyName: input.business.name,
    areaName: input.locality.areaName,
    telephone: input.business.telephone,
    address: input.business.address,
    distanceLabel: input.locality.distanceLabel,
    siblingAreaNames: input.locality.neighbouringSelectedAreas,
  });
  return { ok: true, record, fingerprint, attemptLogPaths };
}

export function loadAiLocalCopyPilotV3(
  slug: string,
  serviceId: string,
  areaSlug: string,
): AiLocalCopyPilotRecordV3 | null {
  const file = aiLocalCopyPilotPath(slug, serviceId, areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as AiLocalCopyPilotRecordV3;
  } catch {
    return null;
  }
}

export { hydrateOpenAiEnvIfNeeded };
