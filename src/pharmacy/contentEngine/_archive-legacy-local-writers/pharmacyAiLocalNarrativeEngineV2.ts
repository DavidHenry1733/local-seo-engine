/**
 * Pharmacy AI local-narrative engine V2 — editorial pilots only.
 * Reuses getOpenAiIntegrationClient() from src/generator/generateClusterContent.ts.
 * Preview must never call generateAiLocalCopyPilotV2.
 * Must never write Prompt 93 candidate paths.
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
import { parseAiLocalCopyV2, type AiLocalCopyV2, type AiSentencePurposeRowV2 } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V2,
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION_V2,
  buildAiLocalNarrativeSystemPromptV2,
  buildAiLocalNarrativeUserPromptV2,
  type BusinessLocalityCopyInputV1,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { acceptedEntityId, groundAiLocalCopyClaimsV2, type AiLocalClaimMapRowV1 } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { evaluateAiLocalCopyQualityV2, localNarrativeFingerprint } from "./pharmacyAiLocalCopyQualityV1.ts";
import {
  analyseRepetitionV2,
  classifySentencePurposesV2,
  looksLikeGenericAreaSubstitutionV2,
  validateEvidenceSelectionV2,
  type AiRepetitionAnalysisV2,
} from "./pharmacyAiLocalCopyEditorialReviewV2.ts";
import {
  buildPharmacyAiLocalCopyInputV1,
  estimateGpt41CostUsd,
  hashFileSha256,
  hydrateOpenAiEnvIfNeeded,
  resetAiGenerationLedger,
  getAiGenerationLedger,
  type AiGenerationLedger,
} from "./pharmacyAiLocalNarrativeEngineV1.ts";
import {
  AI_LOCAL_PILOT_V2_AREAS,
  aiLocalCopyPilotPath,
} from "./pharmacyAiLocalPageCandidatePaths.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import {
  LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD,
  stripIdentityTokens,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";

export const AI_LOCAL_NARRATIVE_ENGINE_ID_V2 = "pharmacy-ai-local-narrative-engine-v2";
export const AI_LOCAL_NARRATIVE_PROVIDER_V2 = "openai";
export const AI_LOCAL_NARRATIVE_MODEL_V2 = OPENAI_INTEGRATION_CHAT_MODEL;
export const AI_LOCAL_PILOT_MAX_SUCCESS = 3;
export const AI_LOCAL_PILOT_MAX_COST_USD = 1;
export const AI_LOCAL_PILOT_AREAS = [...AI_LOCAL_PILOT_V2_AREAS];

export type AiLocalCopyPilotRecordV2 = {
  promptContractId: string;
  promptContractVersion: string;
  promptContractPath: string;
  provider: string;
  model: string;
  generatedAt: string;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  estimatedCostUsd: number;
  inputEvidencePackHash: string;
  areaSlug: string;
  areaName: string;
  evidenceSelection: AiLocalCopyV2["evidenceSelection"];
  outputCopy: AiLocalCopyV2;
  claimMap: AiLocalClaimMapRowV1[];
  sentencePurposes: AiSentencePurposeRowV2[];
  repetitionAnalysis: AiRepetitionAnalysisV2;
  validationResult: { ok: boolean; failures: string[] };
  reviewStatus: "candidate";
  approved: false;
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

export function resetAiPilotLedger(initialCostUsd = 0): AiGenerationLedger {
  ledger.attempted = 0;
  ledger.successful = 0;
  ledger.failed = 0;
  ledger.retried = 0;
  ledger.promptTokens = 0;
  ledger.completionTokens = 0;
  ledger.estimatedCostUsd = initialCostUsd;
  ledger.failures = [];
  return getAiPilotLedger();
}

export function getAiPilotLedger(): AiGenerationLedger {
  return { ...ledger, failures: [...ledger.failures] };
}

export function hydrateEvidenceSelectionFromInput(
  copy: AiLocalCopyV2,
  input: BusinessLocalityCopyInputV1,
): AiLocalCopyV2 {
  const byId = new Map(input.locality.acceptedEntities.map((entity) => [acceptedEntityId(entity), entity]));
  const byName = new Map(input.locality.acceptedEntities.map((entity) => [entity.name.trim().toLowerCase(), entity]));
  copy.evidenceSelection = copy.evidenceSelection.map((row) => {
    const match = byId.get(row.entityId) || byName.get(row.name.trim().toLowerCase());
    if (!match) return row;
    return {
      ...row,
      entityId: row.entityId || acceptedEntityId(match),
      name: row.name || match.name,
      category: row.category || match.category,
      reason: row.reason || "classified during evidence selection",
    };
  });
  const selectedIds = new Set(copy.evidenceSelection.map((row) => row.entityId));
  for (const entity of input.locality.acceptedEntities) {
    const id = acceptedEntityId(entity);
    if (selectedIds.has(id)) continue;
    copy.evidenceSelection.push({
      entityId: id,
      name: entity.name,
      category: entity.category,
      classification: entity.category === "schools" || entity.category === "retail"
        ? "irrelevant-to-patient-decision"
        : "unsafe-or-ambiguous",
      useInCopy: false,
      reason: "added to cover a supplied entity that the model omitted from evidenceSelection",
    });
  }
  return copy;
}

export function validateAiLocalCopyPilotV2(
  copy: AiLocalCopyV2,
  input: BusinessLocalityCopyInputV1,
  previousFingerprints: string[] = [],
): {
  ok: boolean;
  failures: string[];
  claims: AiLocalClaimMapRowV1[];
  sentencePurposes: AiSentencePurposeRowV2[];
  repetitionAnalysis: AiRepetitionAnalysisV2;
} {
  const grounded = groundAiLocalCopyClaimsV2(copy, input);
  const quality = evaluateAiLocalCopyQualityV2(copy, input);
  const selection = validateEvidenceSelectionV2(copy, input);
  const repetitionAnalysis = analyseRepetitionV2(copy, input);
  const failures = [
    ...grounded.failures,
    ...quality.failures,
    ...selection.failures,
    ...repetitionAnalysis.failures,
  ];
  if (looksLikeGenericAreaSubstitutionV2(copy)) {
    failures.push("generic area-substitution copy");
  }
  if (grounded.claims.some((row) => row.supportingCanonicalFieldOrEntity === "non-factual-prose")) {
    failures.push("non-factual-prose cannot bypass grounding");
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
  const sentencePurposes = classifySentencePurposesV2(copy, grounded.claims.filter((row) => row.validationResult === "pass"));
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    claims: grounded.claims,
    sentencePurposes,
    repetitionAnalysis,
  };
}

async function requestStructuredPilotCopy(
  input: BusinessLocalityCopyInputV1,
  retryFailures: string[] = [],
): Promise<{
  raw: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}> {
  const client = getOpenAiIntegrationClient();
  const user = buildAiLocalNarrativeUserPromptV2(input);
  const retryNote = retryFailures.length
    ? `\n\nThe previous JSON failed validation. Fix these issues and return a complete new JSON object. Do not explain the issues in the copy:\n- ${retryFailures.slice(0, 8).join("\n- ")}`
    : "";
  const response = await client.chat.completions.create({
    model: AI_LOCAL_NARRATIVE_MODEL_V2,
    temperature: retryFailures.length ? 0.35 : 0.4,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildAiLocalNarrativeSystemPromptV2(input.vertical) },
      { role: "user", content: user + retryNote },
    ],
  });
  const raw = response.choices[0]?.message?.content ?? "";
  const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };
  return {
    raw,
    model: response.model || AI_LOCAL_NARRATIVE_MODEL_V2,
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
  };
}

function recordUsage(promptTokens: number, completionTokens: number): number {
  const cost = estimateGpt41CostUsd(promptTokens, completionTokens);
  ledger.promptTokens += promptTokens;
  ledger.completionTokens += completionTokens;
  ledger.estimatedCostUsd += cost;
  return cost;
}

export async function generateAiLocalCopyPilotV2(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  previousFingerprints?: string[];
  writeRecord?: boolean;
}): Promise<
  | { ok: true; record: AiLocalCopyPilotRecordV2; fingerprint: string }
  | { ok: false; areaSlug: string; detail: string; failures: string[] }
> {
  if (!AI_LOCAL_PILOT_AREAS.includes(opts.areaSlug)) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "area not in authorised v2 pilot set", failures: ["area"] };
  }
  if (ledger.successful >= AI_LOCAL_PILOT_MAX_SUCCESS) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "successful-generation limit reached", failures: ["limit"] };
  }
  if (ledger.estimatedCostUsd >= AI_LOCAL_PILOT_MAX_COST_USD) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "cost limit reached", failures: ["cost"] };
  }

  const rawPack = loadPharmacyLocalEvidencePack(opts.slug, opts.areaSlug);
  const checked = validatePharmacyLocalEvidencePack(rawPack, {
    slug: opts.slug,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
  });
  if (!checked.ok) {
    ledger.failed += 1;
    ledger.failures.push({ areaSlug: opts.areaSlug, detail: checked.detail });
    return { ok: false, areaSlug: opts.areaSlug, detail: checked.detail, failures: [checked.detail] };
  }
  const packHash = hashFileSha256(localEvidencePackPath(opts.slug, opts.areaSlug));
  const input = buildPharmacyAiLocalCopyInputV1({
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    pack: checked.pack,
  });

  const tryOnce = async (retryFailures: string[]) => {
    if (ledger.estimatedCostUsd + 0.08 >= AI_LOCAL_PILOT_MAX_COST_USD) throw new Error("cost-limit-precheck");
    ledger.attempted += 1;
    if (retryFailures.length) ledger.retried += 1;
    const response = await requestStructuredPilotCopy(input, retryFailures);
    recordUsage(response.promptTokens, response.completionTokens);
    const parsed = parseAiLocalCopyV2(response.raw);
    if (!parsed.ok) {
      return { ok: false as const, failures: parsed.failures, copy: null, claims: [] as AiLocalClaimMapRowV1[], sentencePurposes: [] as AiSentencePurposeRowV2[], repetitionAnalysis: null as AiRepetitionAnalysisV2 | null };
    }
    const copy = hydrateEvidenceSelectionFromInput(parsed.copy, input);
    const validated = validateAiLocalCopyPilotV2(copy, input, opts.previousFingerprints || []);
    return {
      ok: validated.ok,
      failures: validated.failures,
      copy,
      claims: validated.claims,
      sentencePurposes: validated.sentencePurposes,
      repetitionAnalysis: validated.repetitionAnalysis,
      model: response.model,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
    };
  };

  let result: Awaited<ReturnType<typeof tryOnce>> | null = null;
  let lastFailures: string[] = [];
  for (const isRetry of [false, true]) {
    try {
      result = await tryOnce(isRetry ? lastFailures : []);
      if (result.ok && result.copy) break;
      lastFailures = result.failures;
      if (result.failures.length) {
        console.error(`AI v2 pilot ${opts.areaSlug}${isRetry ? " retry" : ""}: ${result.failures.slice(0, 6).join(" | ")}`);
      }
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
      };
      if (!isRetry) continue;
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
    };
  }

  const record: AiLocalCopyPilotRecordV2 = {
    promptContractId: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V2,
    promptContractVersion: AI_LOCAL_NARRATIVE_PROMPT_VERSION_V2,
    promptContractPath: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
    provider: AI_LOCAL_NARRATIVE_PROVIDER_V2,
    model: result.model || AI_LOCAL_NARRATIVE_MODEL_V2,
    generatedAt: new Date().toISOString(),
    tokenUsage: {
      promptTokens: result.promptTokens || 0,
      completionTokens: result.completionTokens || 0,
      totalTokens: (result.promptTokens || 0) + (result.completionTokens || 0),
    },
    estimatedCostUsd: estimateGpt41CostUsd(result.promptTokens || 0, result.completionTokens || 0),
    inputEvidencePackHash: packHash,
    areaSlug: opts.areaSlug,
    areaName: opts.areaName,
    evidenceSelection: result.copy.evidenceSelection,
    outputCopy: result.copy,
    claimMap: result.claims,
    sentencePurposes: result.sentencePurposes,
    repetitionAnalysis: result.repetitionAnalysis,
    validationResult: { ok: true, failures: [] },
    reviewStatus: "candidate",
    approved: false,
  };
  if (opts.writeRecord !== false) {
    const file = aiLocalCopyPilotPath(opts.slug, opts.serviceId, opts.areaSlug);
    if (file.includes("/pharmacy-ai-local-copy-candidates/")) {
      throw new Error("refusing to write a v2 pilot into Prompt 93 candidate records");
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
  return { ok: true, record, fingerprint };
}

export function loadAiLocalCopyPilotV2(
  slug: string,
  serviceId: string,
  areaSlug: string,
): AiLocalCopyPilotRecordV2 | null {
  const file = aiLocalCopyPilotPath(slug, serviceId, areaSlug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as AiLocalCopyPilotRecordV2;
  } catch {
    return null;
  }
}

export { hydrateOpenAiEnvIfNeeded, resetAiGenerationLedger, getAiGenerationLedger, buildPharmacyAiLocalCopyInputV1 };
