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
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  aiLocalCopyAttemptLogPath,
  aiLocalCopyPilotPath,
  isAuthorisedAiLocalPilotV3Area,
  isOneLocalPageCandidateArea,
} from "./pharmacyAiLocalPageCandidatePaths.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import {
  LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD,
  stripIdentityTokens,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import {
  isCustomerAppropriateOrganisationName,
  officialGpPracticeNamesFromFacts,
  healthcareEntityIsOfficiallySupported,
  type EditorialEvidencePackV3,
  type EditorialFactV3,
} from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import { loadEditorialEvidencePack } from "./pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { resolveAreaCentroidFromRecordedReference } from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { planUkLocalPageStraightLineDistance } from "./pharmacyUkLocalPageContentContractV1.ts";

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
  validationResult: { ok: boolean; failures: string[]; automatedReviews?: string[] };
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
  // In-memory counters only. Does not reset durable authorised-task call or cost limits.
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

export type AuthorizedTaskBudgetV3 = {
  taskId: string;
  maxProviderCalls: number;
  maxCostUsd: number;
  reserved: number;
  consumed: number;
  failed: number;
  uncertain: number;
  estimatedCostUsd: number;
  events: Array<{ at: string; kind: string; reservationId?: string; detail?: string }>;
};

export type PilotProviderAdapterV3 = (
  request: ReturnType<typeof buildStructuredPilotChatRequestV3>,
) => Promise<{
  raw: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  uncertain?: boolean;
}>;

export function authorizedTaskBudgetPathV3(opts: {
  slug: string;
  serviceId: string;
  taskId: string;
  budgetDir?: string;
}): string {
  const root = opts.budgetDir || path.join(process.cwd(), "data/pharmacy-ai-local-generation-budget");
  return path.join(root, opts.slug, opts.serviceId, "v3", `${opts.taskId}.json`);
}

function emptyBudgetV3(taskId: string, maxProviderCalls: number, maxCostUsd: number): AuthorizedTaskBudgetV3 {
  return {
    taskId,
    maxProviderCalls,
    maxCostUsd,
    reserved: 0,
    consumed: 0,
    failed: 0,
    uncertain: 0,
    estimatedCostUsd: 0,
    events: [],
  };
}

function withBudgetLockV3<T>(file: string, fn: (budget: AuthorizedTaskBudgetV3, save: (next: AuthorizedTaskBudgetV3) => void) => T): T {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const started = Date.now();
  while (true) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
      break;
    } catch {
      if (Date.now() - started > 5000) throw new Error("authorized-task-budget-lock-timeout");
    }
  }
  try {
    const budget = fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, "utf8")) as AuthorizedTaskBudgetV3)
      : emptyBudgetV3("pending", 0, 0);
    let stored = budget;
    const result = fn(budget, (next) => {
      stored = next;
    });
    fs.writeFileSync(file, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    return result;
  } finally {
    try {
      fs.unlinkSync(lock);
    } catch {
      /* ignore */
    }
  }
}

export function loadAuthorizedTaskBudgetV3(file: string): AuthorizedTaskBudgetV3 | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as AuthorizedTaskBudgetV3;
}

export function ensureAuthorizedTaskBudgetV3(opts: {
  file: string;
  taskId: string;
  maxProviderCalls: number;
  maxCostUsd: number;
}): AuthorizedTaskBudgetV3 {
  return withBudgetLockV3(opts.file, (budget, save) => {
    if (!budget.taskId || budget.taskId === "pending" || budget.maxProviderCalls <= 0) {
      const created = emptyBudgetV3(opts.taskId, opts.maxProviderCalls, opts.maxCostUsd);
      created.events.push({ at: new Date().toISOString(), kind: "created", detail: `calls=${opts.maxProviderCalls} cost=${opts.maxCostUsd}` });
      save(created);
      return created;
    }
    save(budget);
    return budget;
  });
}

export function reserveAuthorizedProviderCallV3(file: string): { ok: true; reservationId: string } | { ok: false; detail: string } {
  return withBudgetLockV3(file, (budget, save) => {
    const used = budget.consumed + budget.uncertain + budget.reserved;
    if (used >= budget.maxProviderCalls) {
      save(budget);
      return { ok: false as const, detail: "durable-call-limit-reached" };
    }
    if (budget.estimatedCostUsd >= budget.maxCostUsd) {
      save(budget);
      return { ok: false as const, detail: "durable-cost-limit-reached" };
    }
    const reservationId = `r-${Date.now()}-${budget.reserved + budget.consumed + 1}`;
    budget.reserved += 1;
    budget.events.push({ at: new Date().toISOString(), kind: "reserve", reservationId });
    save(budget);
    return { ok: true as const, reservationId };
  });
}

export function commitAuthorizedProviderCallV3(
  file: string,
  reservationId: string,
  outcome: "consumed" | "failed" | "uncertain",
  costUsd = 0,
): void {
  withBudgetLockV3(file, (budget, save) => {
    budget.reserved = Math.max(0, budget.reserved - 1);
    if (outcome === "consumed") {
      budget.consumed += 1;
      budget.estimatedCostUsd += costUsd;
    } else if (outcome === "uncertain") {
      budget.uncertain += 1;
      budget.estimatedCostUsd += costUsd;
    } else {
      budget.failed += 1;
      budget.uncertain += 1;
    }
    budget.events.push({ at: new Date().toISOString(), kind: outcome, reservationId, detail: `cost=${costUsd}` });
    save(budget);
  });
}

export const ADDITIONAL_GENERATION_ATTEMPT_EVENT = "additional-attempt-authorised";
export const MAX_ADDITIONAL_GENERATION_ATTEMPTS_V3 = 1;
export const AUTHORISE_ONE_ADDITIONAL_ATTEMPT_LABEL = "Authorise one additional attempt";

export function oneLocalPageAuthorizedTaskIdV3(slug: string, serviceId: string, areaSlug: string): string {
  return `${slug}:${serviceId}:v3:one-local-page:${areaSlug}`;
}

export function usedAuthorizedProviderCallsV3(budget: AuthorizedTaskBudgetV3): number {
  return Number(budget.consumed || 0) + Number(budget.uncertain || 0) + Number(budget.reserved || 0);
}

export function remainingAuthorizedProviderCallsV3(budget: AuthorizedTaskBudgetV3): number {
  return Math.max(0, Number(budget.maxProviderCalls || 0) - usedAuthorizedProviderCallsV3(budget));
}

export function remainingAuthorizedGenerationCostUsdV3(budget: AuthorizedTaskBudgetV3): number {
  return Math.max(0, Number((Number(budget.maxCostUsd || 0) - Number(budget.estimatedCostUsd || 0)).toFixed(6)));
}

export function formatAuthorizedGenerationUsdV3(amount: number): string {
  const rounded = Number(Number(amount || 0).toFixed(6));
  const text = rounded.toFixed(6).replace(/\.?0+$/, "");
  return `$${text.includes(".") ? text : `${text}.00`}`;
}

export function additionalGenerationAttemptsAuthorisedV3(budget: AuthorizedTaskBudgetV3): number {
  return (budget.events || []).filter((row) => row.kind === ADDITIONAL_GENERATION_ATTEMPT_EVENT).length;
}

export type AuthoriseAdditionalGenerationAttemptResultV3 =
  | {
      ok: true;
      duplicate: boolean;
      budget: AuthorizedTaskBudgetV3;
      additionalAttemptMaxCostUsd: number;
    }
  | { ok: false; status: number; error: string };

export function authoriseOneAdditionalGenerationAttemptV3(opts: {
  slug: string;
  serviceId: string;
  areaSlug: string;
  confirmAuthorise: boolean;
  authorisedBy?: string;
  authenticatedSlug?: string;
  budgetDir?: string;
}): AuthoriseAdditionalGenerationAttemptResultV3 {
  if (opts.confirmAuthorise !== true) {
    return { ok: false, status: 403, error: "Explicit confirmation is required to authorise one additional generation attempt. No allowance was added." };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return { ok: false, status: 403, error: "Tenant mismatch. Generation authorisation is scoped to the authenticated pharmacy." };
  }
  if (!isAuthorisedAiLocalPilotV3Area(opts.slug, opts.areaSlug) || !isOneLocalPageCandidateArea(opts.slug, opts.areaSlug)) {
    return { ok: false, status: 403, error: "Cross-tenant or non-candidate generation is not authorised." };
  }
  const taskId = oneLocalPageAuthorizedTaskIdV3(opts.slug, opts.serviceId, opts.areaSlug);
  const file = authorizedTaskBudgetPathV3({
    slug: opts.slug,
    serviceId: opts.serviceId,
    taskId,
    budgetDir: opts.budgetDir,
  });
  if (!fs.existsSync(file)) {
    return { ok: false, status: 409, error: "No generation budget exists to extend. Previous spend was not changed." };
  }
  return withBudgetLockV3(file, (budget, save) => {
    if (budget.taskId && budget.taskId !== "pending" && budget.taskId !== taskId) {
      save(budget);
      return { ok: false as const, status: 403, error: "Tenant mismatch. Generation authorisation is scoped to the authenticated pharmacy." };
    }
    const remainingCost = remainingAuthorizedGenerationCostUsdV3(budget);
    if (additionalGenerationAttemptsAuthorisedV3(budget) >= MAX_ADDITIONAL_GENERATION_ATTEMPTS_V3) {
      save(budget);
      return {
        ok: true as const,
        duplicate: true,
        budget,
        additionalAttemptMaxCostUsd: remainingCost,
      };
    }
    if (remainingAuthorizedProviderCallsV3(budget) > 0) {
      save(budget);
      return { ok: false as const, status: 409, error: "The call limit is not exhausted. No additional allowance was added." };
    }
    if (remainingCost <= 0) {
      save(budget);
      return { ok: false as const, status: 409, error: "The generation cost cap is exhausted. Previous spend was not changed." };
    }
    budget.maxProviderCalls += 1;
    budget.events.push({
      at: new Date().toISOString(),
      kind: ADDITIONAL_GENERATION_ATTEMPT_EVENT,
      detail: `additionalCalls=1 maxProviderCalls=${budget.maxProviderCalls} remainingCostUsd=${remainingCost} by=${String(opts.authorisedBy || "authenticated-user")}`,
    });
    save(budget);
    return {
      ok: true as const,
      duplicate: false,
      budget,
      additionalAttemptMaxCostUsd: remainingCost,
    };
  });
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
  varietyHints?: string[];
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
    varietyHints: opts.varietyHints,
  });
  const officialGpNames = officialGpPracticeNamesFromFacts(opts.editorial.facts);
  base.locality.acceptedEntities = base.locality.acceptedEntities.filter((entity) => {
    if (!isCustomerAppropriateOrganisationName(entity.name)) return false;
    if (entity.category !== "healthcare") return true;
    return healthcareEntityIsOfficiallySupported(entity.name, officialGpNames);
  });
  const distancePlan = planUkLocalPageStraightLineDistance({
    slug: opts.slug,
    areaName: opts.areaName,
    pharmacyCoordinates: checked.pack.pharmacyCoordinates,
    areaCentroid: resolveAreaCentroidFromRecordedReference(opts.slug, opts.areaSlug),
    displayAddress: base.business.address,
  });
  if (distancePlan.distanceKm != null && Number.isFinite(distancePlan.distanceKm)) {
    base.locality.distanceKm = distancePlan.distanceKm;
    base.locality.distanceLabel = `approximately ${distancePlan.distanceKm.toFixed(1)} km straight-line`;
  }
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
    distanceBasis: {
      method: "approximate-straight-line",
      distanceKm: distancePlan.distanceKm,
      areaReferencePoint: distancePlan.areaReferencePoint,
      pharmacyCoordinates: distancePlan.pharmacyCoordinates,
    },
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
  reviews: string[];
  claims: AiLocalClaimMapRowV1[];
  sentencePurposes: AiSentencePurposeRowV2[];
  repetitionAnalysis: AiRepetitionAnalysisV2;
} {
  const grounded = groundAiLocalCopyClaimsV3(copy, input, editorialFacts);
  const quality = evaluateAiLocalCopyQualityV3(copy, input);
  const repetitionAnalysis = analyseRepetitionV3(copy, input);
  const failures = [...grounded.failures, ...quality.failures, ...repetitionAnalysis.failures];
  const reviews = [...(grounded.reviews || []), ...(quality.reviews || [])];
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
    ok: failures.length === 0 && reviews.length === 0,
    failures: [...new Set(failures)],
    reviews: [...new Set(reviews)],
    claims: grounded.claims,
    sentencePurposes,
    repetitionAnalysis,
  };
}

export function enforceEditorialDisciplineV3(
  copy: AiLocalCopyV3,
  _input: BusinessLocalityCopyInputV3,
): AiLocalCopyV3 {
  return {
    ...copy,
    localContextParagraphs: [...copy.localContextParagraphs],
    localFaqs: copy.localFaqs.map((faq) => ({ ...faq })),
    evidenceClaims: [...(copy.evidenceClaims || [])],
    evidenceEntityIdsUsed: [...(copy.evidenceEntityIdsUsed || [])],
    editorialFactIdsUsed: [...(copy.editorialFactIdsUsed || [])],
  };
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
  validationResult: { ok: boolean; failures: string[]; automatedReviews?: string[] };
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
  const blockingFailures = retryFailures.filter((row) => !/^REVIEW REQUIRED\b/i.test(row));
  const retryNote = blockingFailures.length
    ? `\n\nThe previous JSON failed validation. Fix these issues and return a complete new JSON object. Do not explain the issues in the copy:\n- ${blockingFailures.slice(0, 8).join("\n- ")}`
    : "";
  return {
    model: AI_LOCAL_NARRATIVE_MODEL_V3,
    temperature: blockingFailures.length ? 0.3 : 0.4,
    max_tokens: 2200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildAiLocalNarrativeSystemPromptV3(input.vertical, input.locality.areaName) },
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
  maxProviderCalls?: number;
  authorizedTaskId?: string;
  budgetDir?: string;
  persistAttemptLogs?: boolean;
  providerAdapter?: PilotProviderAdapterV3;
  editorial?: EditorialEvidencePackV3;
  varietyHints?: string[];
  retryFromFailures?: string[];
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
  const taskId = opts.authorizedTaskId || `${opts.slug}:${opts.serviceId}:v3`;
  const budgetFile = authorizedTaskBudgetPathV3({
    slug: opts.slug,
    serviceId: opts.serviceId,
    taskId,
    budgetDir: opts.budgetDir,
  });
  ensureAuthorizedTaskBudgetV3({
    file: budgetFile,
    taskId,
    maxProviderCalls: opts.maxProviderCalls ?? opts.maxAttempts ?? 2,
    maxCostUsd,
  });
  if (!isAuthorisedAiLocalPilotV3Area(opts.slug, opts.areaSlug)) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "area not in authorised v3 pilot set", failures: ["area"], wrote: false, copy: null, raw: "", attemptLogPaths: [] };
  }
  const durable = loadAuthorizedTaskBudgetV3(budgetFile);
  if (durable && durable.consumed + durable.uncertain + durable.reserved >= durable.maxProviderCalls) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "durable-call-limit-reached", failures: ["durable-call-limit-reached"], wrote: false, copy: null, raw: "", attemptLogPaths: [] };
  }
  if (durable && durable.estimatedCostUsd >= durable.maxCostUsd) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "durable-cost-limit-reached", failures: ["durable-cost-limit-reached"], wrote: false, copy: null, raw: "", attemptLogPaths: [] };
  }
  if (ledger.successful >= AI_LOCAL_PILOT_V3_MAX_SUCCESS) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "successful-generation limit reached", failures: ["limit"], wrote: false, copy: null, raw: "", attemptLogPaths: [] };
  }

  const editorial = opts.editorial || loadEditorialEvidencePack(opts.slug, opts.serviceId, opts.areaSlug);
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
    varietyHints: opts.varietyHints,
  });

  const capturedRaws: string[] = [];
  const attemptLogPaths: string[] = [];
  const adapter: PilotProviderAdapterV3 =
    opts.providerAdapter ||
    (async (request) => {
      const client = getOpenAiIntegrationClient();
      const response = await client.chat.completions.create(request);
      const raw = response.choices[0]?.message?.content ?? "";
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };
      return {
        raw,
        model: response.model || AI_LOCAL_NARRATIVE_MODEL_V3,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        uncertain: !String(raw || "").trim(),
      };
    });
  const persistLogs = opts.persistAttemptLogs !== false;
  const tryOnce = async (retryFailures: string[]) => {
    const durableNow = loadAuthorizedTaskBudgetV3(budgetFile);
    if (durableNow && durableNow.estimatedCostUsd + 0.04 >= durableNow.maxCostUsd) {
      throw new Error("cost-limit-precheck");
    }
    const reserved = reserveAuthorizedProviderCallV3(budgetFile);
    if (!reserved.ok) throw new Error(reserved.detail);
    ledger.attempted += 1;
    if (retryFailures.length) ledger.retried += 1;
    const request = buildStructuredPilotChatRequestV3(input, retryFailures);
    let response: Awaited<ReturnType<PilotProviderAdapterV3>>;
    try {
      response = await adapter(request);
    } catch (error) {
      commitAuthorizedProviderCallV3(budgetFile, reserved.reservationId, "uncertain", 0);
      throw error;
    }
    const cost = recordUsage(response.promptTokens, response.completionTokens);
    if (response.uncertain || !String(response.raw || "").trim()) {
      commitAuthorizedProviderCallV3(budgetFile, reserved.reservationId, "uncertain", cost);
      return {
        ok: false as const,
        failures: ["uncertain-provider-call"],
        reviews: [] as string[],
        copy: null,
        claims: [] as AiLocalClaimMapRowV1[],
        sentencePurposes: [] as AiSentencePurposeRowV2[],
        repetitionAnalysis: null as AiRepetitionAnalysisV2 | null,
        raw: response.raw,
        request,
        model: response.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        uncertain: true,
      };
    }
    commitAuthorizedProviderCallV3(budgetFile, reserved.reservationId, "consumed", cost);
    capturedRaws.push(response.raw);
    const parsed = parseAiLocalCopyV3(response.raw);
    if (!parsed.ok) {
      return {
        ok: false as const,
        failures: parsed.failures,
        reviews: [] as string[],
        copy: null,
        claims: [] as AiLocalClaimMapRowV1[],
        sentencePurposes: [] as AiSentencePurposeRowV2[],
        repetitionAnalysis: null as AiRepetitionAnalysisV2 | null,
        raw: response.raw,
        request,
        model: response.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        uncertain: false,
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
    const blockingFailures = validated.failures.filter((row) => !/^REVIEW REQUIRED\b/i.test(row));
    if (blockingFailures.length && opts.areaSlug === "wombwell") {
      console.error(`Wombwell copy rejected before accept: ${[...blockingFailures, ...validated.reviews].join(" | ")}`);
    }
    return {
      ok: blockingFailures.length === 0,
      failures: blockingFailures,
      reviews: validated.reviews,
      copy,
      claims: validated.claims,
      sentencePurposes: validated.sentencePurposes,
      repetitionAnalysis: validated.repetitionAnalysis,
      raw: response.raw,
      request,
      model: response.model,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      uncertain: false,
    };
  };

  let result: Awaited<ReturnType<typeof tryOnce>> | null = null;
  let lastFailures: string[] = [...(opts.retryFromFailures || [])];
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const isRetry = attempt > 0 || lastFailures.length > 0;
    try {
      result = await tryOnce(isRetry ? lastFailures : []);
      if (persistLogs) {
        attemptLogPaths.push(
          persistAiLocalAttemptLogV3({
            slug: opts.slug,
            serviceId: opts.serviceId,
            areaSlug: opts.areaSlug,
            attemptNumber: attempt + 1,
            request: result.request,
            rawResponse: result.raw,
            validationResult: { ok: result.ok, failures: result.failures, automatedReviews: result.reviews },
            copy: result.copy,
          }),
        );
      }
      if (result.uncertain) {
        lastFailures = result.failures;
        break;
      }
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
        reviews: [],
        copy: null,
        claims: [] as AiLocalClaimMapRowV1[],
        sentencePurposes: [] as AiSentencePurposeRowV2[],
        repetitionAnalysis: null,
        raw: "",
        request: { unsent: true, reason: detail },
        uncertain: /uncertain|durable-call-limit|durable-cost-limit/.test(detail),
      };
      if (persistLogs) {
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
      }
      if (result.uncertain || maxAttempts === 1 || attempt === maxAttempts - 1) break;
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
    validationResult: { ok: true, failures: [], automatedReviews: result.reviews || [] },
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
