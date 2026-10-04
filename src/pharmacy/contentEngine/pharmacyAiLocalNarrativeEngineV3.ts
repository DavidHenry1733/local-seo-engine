/**
 * Pharmacy AI local-narrative engine V3 — Gemini local-copy writer only.
 * Campaign Builder calls Gemini directly. OpenAI and multi-field writers are archived.
 * Preview must never call this.
 * Must never write v1/v2 records or live pages.
 */
import fs from "node:fs";
import path from "node:path";

import { type AiLocalCopyV3, type AiSentencePurposeRowV2 } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
  applyRendererOwnedLocalCopyFieldsV3,
  keepGeminiLocalIntroductionParagraphs,
  type BusinessLocalityCopyInputV3,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { type AiLocalClaimMapRowV1 } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import {
  copyFromLocalIntroductionProse,
  parseUkLocalIntroductionProseFields,
  requestUkLocalIntroductionProseV1,
  UK_LOCAL_INTRODUCTION_GEMINI_MODEL,
  UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE,
  UK_LOCAL_INTRODUCTION_WRITER_PROVIDER,
  type GeminiLocalGroundingMetadataV1,
  type UkLocalIntroductionCorrectionV1,
} from "./pharmacyUkLocalIntroductionProseWriterV1.ts";
import {
  canPersistAcceptedGeminiLocalCopy,
  evaluateAcceptedGeminiLocalCopyV1,
  shouldAttemptAcceptedGeminiCopyCorrection,
} from "./pharmacyGroundedGeminiLocalCopyValidationV1.ts";
import {
  distinctVerifiedLocalReferenceLabelsFromFacts,
  formatCustomerFacingLocalCopyV3,
  localNarrativeFingerprint,
} from "./pharmacyAiLocalCopyQualityV1.ts";
import {
  analyseRepetitionV3,
  classifySentencePurposesV2,
  type AiRepetitionAnalysisV2,
} from "./pharmacyAiLocalCopyEditorialReviewV2.ts";
import {
  buildPharmacyAiLocalCopyInputV1,
  estimateGpt41CostUsd,
  type AiGenerationLedger,
} from "./pharmacyAiLocalNarrativeEngineV1.ts";
import {
  AI_LOCAL_FULL_PAGE_UNIQUENESS_VERSION,
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
  canonicalPharmacyFacts,
  emptyEditorialEvidencePackForGeneration,
  factIdFor,
  healthcareEntityIsOfficiallySupported,
  isCustomerAppropriateOrganisationName,
  officialGpPracticeNamesFromFacts,
  placesEntityNormalizedStatement,
  editorialEvidencePackPath,
  type EditorialEvidencePackV3,
  type EditorialFactV3,
} from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import { resolveAreaCentroidFromRecordedReference } from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { savedVerifiedAreaReferencePoint } from "./pharmacyLocalPageGenerationReadinessV1.ts";
import {
  attributableEntities,
  loadLocalEvidencePackForGeneration,
  type PharmacyLocalEvidencePackV3,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { formatStraightLineKm } from "./pharmacyContentGenerationFieldPolicyV1.ts";

export const AI_LOCAL_NARRATIVE_ENGINE_ID_V3 = "pharmacy-ai-local-narrative-engine-v3";
export const AI_LOCAL_NARRATIVE_PROVIDER_V3 = UK_LOCAL_INTRODUCTION_WRITER_PROVIDER;
export const AI_LOCAL_NARRATIVE_MODEL_V3 = UK_LOCAL_INTRODUCTION_GEMINI_MODEL;
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
  geminiGrounding?: GeminiLocalGroundingMetadataV1 | null;
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

export type PilotChatRequestV3 = {
  model: string;
  temperature: number;
  max_tokens: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
  response_format?: { type: "json_object" };
};

export type PilotProviderAdapterV3 = (
  request: PilotChatRequestV3,
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

function sleepSyncMs(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    /* ignore */
  }
}

function pidFromLockFile(file: string): number {
  try {
    const raw = Number.parseInt(String(fs.readFileSync(file, "utf8") || "").trim(), 10);
    return Number.isFinite(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

function pidIsAlive(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function releaseStaleBudgetLock(lock: string): void {
  try {
    if (!fs.existsSync(lock)) return;
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    const pid = pidFromLockFile(lock);
    if (age > 2000 || !pidIsAlive(pid)) fs.unlinkSync(lock);
  } catch {
    /* ignore */
  }
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
      releaseStaleBudgetLock(lock);
      if (Date.now() - started > 5000) throw new Error("authorized-task-budget-lock-timeout");
      sleepSyncMs(25);
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
export const GENERATE_CALL_GRANTED_EVENT = "generate-call-granted";
/** Each Generate click grants at most one provider call when the dollar cap remains. Not an automatic retry loop. */
export const ADDITIONAL_GENERATION_ATTEMPT_CALLS_PER_CONFIRMATION_V3 = 1;
export const MAX_ADDITIONAL_GENERATION_ATTEMPTS_V3 = ADDITIONAL_GENERATION_ATTEMPT_CALLS_PER_CONFIRMATION_V3;
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

export function hasUnusedAdditionalGenerationConfirmationV3(budget: AuthorizedTaskBudgetV3): boolean {
  return remainingAuthorizedProviderCallsV3(budget) > 0 && additionalGenerationAttemptsAuthorisedV3(budget) > 0;
}

export function canAuthoriseOneAdditionalGenerationAttemptFromBudgetV3(budget: AuthorizedTaskBudgetV3): boolean {
  return (
    remainingAuthorizedProviderCallsV3(budget) <= 0 &&
    Number(budget.reserved || 0) <= 0 &&
    remainingAuthorizedGenerationCostUsdV3(budget) > 0
  );
}

export function grantOneLocalPageGenerateCallIfNeededV3(opts: {
  slug: string;
  serviceId: string;
  areaSlug: string;
  budgetDir?: string;
  minRemainingCalls?: number;
}): AuthoriseAdditionalGenerationAttemptResultV3 {
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
    if (Number(budget.reserved || 0) > 0) {
      save(budget);
      return { ok: false as const, status: 409, error: "A generation attempt is already in progress. No additional allowance was added." };
    }
    const minRemainingCalls = Math.max(
      ADDITIONAL_GENERATION_ATTEMPT_CALLS_PER_CONFIRMATION_V3,
      Math.floor(Number(opts.minRemainingCalls || ADDITIONAL_GENERATION_ATTEMPT_CALLS_PER_CONFIRMATION_V3)),
    );
    const remainingCalls = remainingAuthorizedProviderCallsV3(budget);
    if (remainingCalls >= minRemainingCalls) {
      save(budget);
      return {
        ok: true as const,
        duplicate: true,
        budget,
        additionalAttemptMaxCostUsd: remainingCost,
      };
    }
    if (remainingCost <= 0) {
      save(budget);
      return { ok: false as const, status: 409, error: "The generation cost cap is exhausted. Previous spend was not changed." };
    }
    const additionalCalls = minRemainingCalls - remainingCalls;
    budget.maxProviderCalls += additionalCalls;
    budget.events.push({
      at: new Date().toISOString(),
      kind: GENERATE_CALL_GRANTED_EVENT,
      detail: `additionalCalls=${additionalCalls} maxProviderCalls=${budget.maxProviderCalls} remainingCostUsd=${remainingCost}`,
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
    if (remainingAuthorizedProviderCallsV3(budget) > 0) {
      if (hasUnusedAdditionalGenerationConfirmationV3(budget)) {
        save(budget);
        return {
          ok: true as const,
          duplicate: true,
          budget,
          additionalAttemptMaxCostUsd: remainingCost,
        };
      }
      save(budget);
      return { ok: false as const, status: 409, error: "The call limit is not exhausted. No additional allowance was added." };
    }
    if (Number(budget.reserved || 0) > 0) {
      save(budget);
      return { ok: false as const, status: 409, error: "A generation attempt is already in progress. No additional allowance was added." };
    }
    if (remainingCost <= 0) {
      save(budget);
      return { ok: false as const, status: 409, error: "The generation cost cap is exhausted. Previous spend was not changed." };
    }
    budget.maxProviderCalls += ADDITIONAL_GENERATION_ATTEMPT_CALLS_PER_CONFIRMATION_V3;
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

export function acceptedEditorialFactsForLocalGenerationV3(opts: {
  editorial: EditorialEvidencePackV3;
  areaName: string;
  areaSlug: string;
  pharmacyName: string;
  address: string;
  pharmacyIsInArea: boolean;
  distanceKm: number | null;
  areaReference?: { latitude: number; longitude: number; source: string } | null;
  pharmacyCoordinates?: { latitude: number; longitude: number; source?: string } | null;
}): EditorialFactV3[] {
  const fromPack = opts.editorial.facts
    .filter((fact) => fact.validationStatus === "accepted")
    .filter((fact) => {
      const provided = fact.normalizedStatement.match(/provided from\s+(.+?)\.?$/i)?.[1]?.trim() || "";
      return !provided || isCustomerAppropriateOrganisationName(provided);
    });
  const canonical = canonicalPharmacyFacts({
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    pharmacyName: opts.pharmacyName,
    address: opts.address,
    pharmacyIsInArea: opts.pharmacyIsInArea,
    distanceKm: opts.distanceKm,
    retrievedAt: opts.editorial.collectedAt || "canonical://verified-locality",
    areaReference: opts.areaReference || null,
    pharmacyCoordinates: opts.pharmacyCoordinates || null,
  });
  const known = new Set(fromPack.map((fact) => fact.factId));
  return [...fromPack, ...canonical.filter((fact) => !known.has(fact.factId))];
}

function loadSavedEditorialEvidencePack(
  slug: string,
  serviceId: string,
  areaSlug: string,
): EditorialEvidencePackV3 | null {
  const file = editorialEvidencePackPath(slug, serviceId, areaSlug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as EditorialEvidencePackV3;
  } catch {
    return null;
  }
}

function promptFactsFromEditorial(facts: EditorialFactV3[]) {
  return facts.map((fact) => ({
    factId: fact.factId,
    category: fact.category,
    normalizedStatement: fact.normalizedStatement,
    permittedCopyRole: fact.permittedCopyRole,
    prohibitedInference: fact.prohibitedInference,
    sourceClass: fact.sourceClass,
    publisher: fact.publisher,
  }));
}

function editorialFactsFromVerifiedPlacesPack(opts: {
  pack: PharmacyLocalEvidencePackV3 | null;
  areaName: string;
  areaSlug: string;
  existingStatements: string[];
}): EditorialFactV3[] {
  if (!opts.pack) return [];
  const seen = new Set(opts.existingStatements.map((row) => row.toLowerCase()));
  const facts: EditorialFactV3[] = [];
  const retrievedAt = opts.pack.generatedAt || "canonical://verified-locality";
  for (const entity of attributableEntities(opts.pack)) {
    const name = String(entity.name || "").trim();
    if (!name || !isCustomerAppropriateOrganisationName(name)) continue;
    const statement = placesEntityNormalizedStatement({
      name,
      category: entity.category,
      types: entity.types,
      areaName: opts.areaName,
    });
    if (!statement || seen.has(statement.toLowerCase())) continue;
    const category =
      entity.category === "healthcare" ? "healthcare" : entity.category === "landmarks" ? "heritage" : "community";
    const fact: EditorialFactV3 = {
      factId: factIdFor(opts.areaSlug, category, statement),
      area: opts.areaName,
      areaSlug: opts.areaSlug,
      category,
      normalizedStatement: statement,
      sourceTitle: name,
      sourceUrl: entity.placeId
        ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(entity.placeId)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${opts.areaName}`)}`,
      publisher: "Google Places",
      retrievedAt: entity.retrievedAt || retrievedAt,
      sourceClass: "secondary",
      corroboratingSource: null,
      confidence: "medium",
      usefulnessToPharmacyFirstReader:
        "A verified Places listing attributable to this area, not an invented local colour claim.",
      permittedCopyRole: entity.category === "healthcare" ? "healthcare-context" : "neutral-community-context",
      prohibitedInference:
        "A listed place does not prove a route, journey time, affiliation, or that the reader uses it.",
      validationStatus: "accepted",
    };
    seen.add(statement.toLowerCase());
    facts.push(fact);
  }
  return facts;
}

const IMPROVED_PROMPT_LOCAL_FACT_LIMIT = 3;

function promptFactLabel(statement: string): string {
  const from =
    statement.match(/provided from\s+(.+?)\.?$/i)?.[1] ||
    statement.match(/^(.+?)\s+is listed as a /i)?.[1] ||
    statement.match(/^(.+?)\s+is named on /i)?.[1] ||
    statement.match(/\bhas a ([A-Z][^.]*?(?:Board|Park|Library|Centre|Carnival)[^.]*)/i)?.[1] ||
    statement;
  return String(from || statement).replace(/\.$/, "").trim();
}

function isGpOrHospitalStatement(statement: string): boolean {
  return /\b(Medical Centre|Health Centre|Surgery|Practice|hospital)\b/i.test(statement);
}

export function selectLocalNarrativePromptFactsV3(facts: EditorialFactV3[], areaName: string): EditorialFactV3[] {
  const area = String(areaName || "").trim().toLowerCase();
  const local = facts.filter(
    (fact) =>
      fact.category !== "pharmacy-relationship" &&
      (fact.sourceClass === "primary" || fact.sourceClass === "secondary"),
  );
  const ranked = local.map((fact) => {
    const statement = fact.normalizedStatement;
    const label = promptFactLabel(statement);
    const hay = `${label} ${statement}`.toLowerCase();
    let score = 0;
    if (fact.category === "community" || fact.category === "heritage") score += 30;
    if (hay.includes(area)) score += 20;
    if (label.toLowerCase().includes(area)) score += 15;
    if (/\b(library|park|carnival|memorial|community centre|nature reserve|neighbourhood board|parish council)\b/i.test(hay)) {
      score += 12;
    }
    if (fact.category === "healthcare") score += 4;
    if (fact.category === "area-identity") score += 1;
    if (!label.toLowerCase().includes(area) && fact.category === "heritage") score -= 20;
    if (/\bhospital\b/i.test(statement)) score -= 8;
    if (/^[^.]+\shas a public library\.?$/i.test(statement)) score -= 6;
    return { fact, score, label };
  });
  ranked.sort((left, right) => right.score - left.score || left.fact.factId.localeCompare(right.fact.factId));
  const picked: EditorialFactV3[] = [];
  const labels = new Set<string>();
  let gpCount = 0;
  let libraryCount = 0;
  for (const row of ranked) {
    if (picked.length >= IMPROVED_PROMPT_LOCAL_FACT_LIMIT) break;
    const key = row.label.toLowerCase();
    if (labels.has(key)) continue;
    const named = distinctVerifiedLocalReferenceLabelsFromFacts([row.fact]);
    if (!named.length) continue;
    const gp = isGpOrHospitalStatement(row.fact.normalizedStatement);
    if (gp) {
      if (gpCount >= 1) continue;
      gpCount += 1;
    }
    const library = /\blibrary\b/i.test(row.label) || /\bpublic library\b/i.test(row.fact.normalizedStatement);
    if (library) {
      if (libraryCount >= 1) continue;
      libraryCount += 1;
    }
    labels.add(key);
    picked.push(row.fact);
  }
  return picked;
}

export function buildPharmacyAiLocalCopyInputV3(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  editorial?: EditorialEvidencePackV3;
  varietyHints?: string[];
  ukLocalIntroductionStyle?: BusinessLocalityCopyInputV3["ukLocalIntroductionStyle"];
}): BusinessLocalityCopyInputV3 {
  const packForGeneration = loadLocalEvidencePackForGeneration(
    opts.slug,
    opts.areaName,
    opts.areaSlug,
    undefined,
    opts.serviceId,
  );
  if (!packForGeneration.ok) throw new Error(packForGeneration.detail);
  const base = buildPharmacyAiLocalCopyInputV1({
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    pack: packForGeneration.pack,
    varietyHints: opts.varietyHints,
  });
  const editorial =
    opts.editorial ||
    loadSavedEditorialEvidencePack(opts.slug, opts.serviceId, opts.areaSlug) ||
    emptyEditorialEvidencePackForGeneration({
      slug: opts.slug,
      areaName: opts.areaName,
      areaSlug: opts.areaSlug,
    });
  const placesFacts = editorialFactsFromVerifiedPlacesPack({
    pack: packForGeneration.pack,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    existingStatements: editorial.facts.map((fact) => fact.normalizedStatement),
  });
  const editorialForGeneration: EditorialEvidencePackV3 = {
    ...editorial,
    facts: [...editorial.facts, ...placesFacts],
  };
  const officialGpNames = officialGpPracticeNamesFromFacts(editorialForGeneration.facts);
  if (officialGpNames.length) {
    base.locality.acceptedEntities = base.locality.acceptedEntities.filter((entity) => {
      if (!isCustomerAppropriateOrganisationName(entity.name)) return false;
      if (entity.category !== "healthcare") return true;
      return healthcareEntityIsOfficiallySupported(entity.name, officialGpNames);
    });
  } else {
    base.locality.acceptedEntities = base.locality.acceptedEntities.filter((entity) =>
      isCustomerAppropriateOrganisationName(entity.name),
    );
  }
  const savedPoint =
    savedVerifiedAreaReferencePoint(opts.slug, opts.serviceId, opts.areaName, opts.areaSlug) ||
    resolveAreaCentroidFromRecordedReference(opts.slug, opts.areaSlug);
  const pharmacyCoordinates = packForGeneration.pack.pharmacyCoordinates || null;
  if (base.locality.distanceKm != null && Number.isFinite(base.locality.distanceKm)) {
    base.locality.distanceLabel = `approximately ${formatStraightLineKm(base.locality.distanceKm)} km in a straight line`;
  }
  const editorialFacts = acceptedEditorialFactsForLocalGenerationV3({
    editorial: editorialForGeneration,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    pharmacyName: base.business.name,
    address: base.business.address,
    pharmacyIsInArea: Boolean(base.locality.pharmacyIsInArea),
    distanceKm: base.locality.distanceKm,
    areaReference: savedPoint,
    pharmacyCoordinates,
  });
  return {
    ...base,
    tenantSlug: opts.slug,
    editorialFacts: promptFactsFromEditorial(editorialFacts),
    editorialSufficiency: editorial.sufficiency.status,
    ukLocalIntroductionStyle: opts.ukLocalIntroductionStyle,
    distanceBasis: {
      method: "approximate-straight-line",
      distanceKm: base.locality.distanceKm,
      areaReferencePoint: savedPoint,
      pharmacyCoordinates,
    },
  };
}

export function validateAiLocalCopyPilotV3(
  copy: AiLocalCopyV3,
  input: BusinessLocalityCopyInputV3,
  _editorialFacts: EditorialFactV3[] = [],
  previousFingerprints: string[] = [],
  grounding: GeminiLocalGroundingMetadataV1 | null = null,
): {
  ok: boolean;
  failures: string[];
  reviews: string[];
  claims: AiLocalClaimMapRowV1[];
  sentencePurposes: AiSentencePurposeRowV2[];
  repetitionAnalysis: AiRepetitionAnalysisV2;
} {
  const grounded = evaluateAcceptedGeminiLocalCopyV1({
    copy,
    input,
    grounding,
    expectedSlug: String(input.tenantSlug || "").trim(),
    expectedServiceId: String(input.offer.serviceId || "").trim(),
    expectedAreaName: String(input.locality.areaName || "").trim(),
  });
  const repetitionAnalysis = analyseRepetitionV3(copy, input);
  const failures = [...grounded.failures];
  const fingerprint = stripIdentityTokens(copy.localIntroduction || localNarrativeFingerprint(copy), {
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
  const sentencePurposes = classifySentencePurposesV2(copy, []);
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    reviews: [],
    claims: [],
    sentencePurposes,
    repetitionAnalysis,
  };
}

export function enforceEditorialDisciplineV3(
  copy: AiLocalCopyV3,
  input: BusinessLocalityCopyInputV3,
): AiLocalCopyV3 {
  return applyRendererOwnedLocalCopyFieldsV3(copy, input);
}

export function sanitizeAiLocalAttemptPayloadV3(value: unknown): unknown {
  const secretKey =
    /^(api[_-]?key|authorization|token|password|secret|credentials?|openai_api_key|ai_integrations_openai_api_key|gemini_api_key)$/i;
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
  candidateVersion?: string;
  grounding?: GeminiLocalGroundingMetadataV1 | null;
}): string {
  const savedAt = new Date().toISOString();
  const attemptId = `${savedAt.replace(/[:.]/g, "-")}-attempt-${opts.attemptNumber}`;
  const logFile = aiLocalCopyAttemptLogPath(
    opts.slug,
    opts.serviceId,
    opts.areaSlug,
    attemptId,
    opts.candidateVersion || AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
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
    geminiGrounding: opts.grounding || null,
    rawResponse: opts.rawResponse,
    validationResult: opts.validationResult,
    parsedCopy: opts.copy,
    candidateRecordWritten: false,
  });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  try {
    fs.writeFileSync(logFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️ Validation warning for [${opts.areaSlug}]: nested attempt payload skipped (${detail}). Continuing.`,
    );
    try {
      fs.writeFileSync(
        logFile,
        `${JSON.stringify(
          {
            savedAt,
            areaSlug: opts.areaSlug,
            attemptNumber: opts.attemptNumber,
            validationResult: opts.validationResult,
            nestedPayloadSkipped: true,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    } catch (slimError) {
      const slimDetail = slimError instanceof Error ? slimError.message : String(slimError);
      console.warn(
        `⚠️ Validation warning for [${opts.areaSlug}]: attempt log could not be written (${slimDetail}). Continuing.`,
      );
    }
  }
  return logFile;
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
  ukLocalIntroductionStyle?: BusinessLocalityCopyInputV3["ukLocalIntroductionStyle"];
  retryFromFailures?: string[];
  requireImprovedLocalQuality?: boolean;
  candidateVersion?: string;
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
  resetAiPilotLedgerV3();
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

  let input;
  try {
    input = buildPharmacyAiLocalCopyInputV3({
      slug: opts.slug,
      serviceId: opts.serviceId,
      areaName: opts.areaName,
      areaSlug: opts.areaSlug,
      editorial: opts.editorial,
      varietyHints: opts.varietyHints,
      ukLocalIntroductionStyle: opts.ukLocalIntroductionStyle,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      areaSlug: opts.areaSlug,
      detail,
      failures: [detail],
      wrote: false,
      copy: null,
      raw: "",
      attemptLogPaths: [],
    };
  }
  if (opts.previousFingerprints?.length) {
    input.previousLocalContextFingerprints = opts.previousFingerprints;
  }

  const capturedRaws: string[] = [];
  const attemptLogPaths: string[] = [];
  if (UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE) {
    return {
      ok: false,
      areaSlug: opts.areaSlug,
      detail: "The OpenAI local-copy writer is archived. Gemini is the only active local-copy writer.",
      failures: ["openai-local-writer-archived"],
      wrote: false,
      copy: null,
      raw: "",
      attemptLogPaths: [],
    };
  }
  if (!input.ukLocalIntroductionStyle) {
    input.ukLocalIntroductionStyle = {
      id: "gemini-local-introduction",
      label: "Gemini local introduction",
      instruction: "Write British English local copy for the selected area from the accepted Brook Gemini contract.",
    };
  }
  const persistLogs = opts.persistAttemptLogs !== false;
  const tryOnce = async (correction?: UkLocalIntroductionCorrectionV1) => {
    const durableNow = loadAuthorizedTaskBudgetV3(budgetFile);
    if (durableNow && durableNow.estimatedCostUsd + 0.04 >= durableNow.maxCostUsd) {
      throw new Error("cost-limit-precheck");
    }
    const reserved = reserveAuthorizedProviderCallV3(budgetFile);
    if (!reserved.ok) throw new Error(reserved.detail);
    ledger.attempted += 1;
    let request: unknown;
    let response: {
      raw: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      uncertain: boolean;
    };
    try {
      const gemini = await requestUkLocalIntroductionProseV1(input, correction);
      request = gemini.request;
      response = {
        raw: gemini.raw,
        model: gemini.model,
        promptTokens: gemini.promptTokens,
        completionTokens: gemini.completionTokens,
        uncertain: gemini.uncertain,
      };
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
    const fields = parseUkLocalIntroductionProseFields(response.raw);
    const introduction = keepGeminiLocalIntroductionParagraphs(fields.localIntroduction);
    const parsedCopy = copyFromLocalIntroductionProse(
      input.locality.areaName,
      introduction,
      keepGeminiLocalIntroductionParagraphs(fields.heroIntroduction),
      fields.serviceDefinitionParagraphs,
      fields.processHeading,
      fields.processSteps,
    );
    if (!parsedCopy) {
      return {
        ok: false as const,
        failures: ["local introduction prose could not be parsed"],
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
    const copy = enforceEditorialDisciplineV3(parsedCopy, input);
    const validated = validateAiLocalCopyPilotV3(
      copy,
      input,
      [],
      opts.previousFingerprints || [],
      null,
    );
    const blockingFailures = validated.failures.filter((row) => !/^REVIEW REQUIRED\b/i.test(row));
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

  const persistAttempt = (
    attemptNumber: number,
    attempt: Awaited<ReturnType<typeof tryOnce>>,
  ) => {
    if (!persistLogs) return;
    try {
      attemptLogPaths.push(
        persistAiLocalAttemptLogV3({
          slug: opts.slug,
          serviceId: opts.serviceId,
          areaSlug: opts.areaSlug,
          attemptNumber,
          request: attempt.request,
          rawResponse: attempt.raw,
          validationResult: { ok: attempt.ok, failures: attempt.failures, automatedReviews: attempt.reviews },
          copy: attempt.copy,
          candidateVersion: opts.candidateVersion,
          grounding: null,
        }),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(
        `⚠️ Validation warning for [${opts.areaName}]: attempt log skipped (${detail}). Continuing.`,
      );
    }
  };
  const rejectedCopyForCorrection = (attempt: Awaited<ReturnType<typeof tryOnce>>): string => {
    if (attempt.copy?.heroIntroduction || attempt.copy?.localIntroduction) {
      return [
        "HERO INTRODUCTION:",
        attempt.copy.heroIntroduction || "",
        "",
        "LOCAL INTRODUCTION:",
        attempt.copy.localIntroduction || "",
      ].join("\n");
    }
    return String(attempt.raw || "").trim();
  };

  let result: Awaited<ReturnType<typeof tryOnce>> | null = null;
  let lastFailures: string[] = [...(opts.retryFromFailures || [])];
  let providerError = false;
  try {
    result = await tryOnce();
    persistAttempt(1, result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "ai-request-failed";
    lastFailures = [detail];
    providerError = true;
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
    persistAttempt(1, result);
  }
  if (result && !result.ok) {
    lastFailures = result.failures;
    if (result.failures.length) {
      console.error(`AI v3 pilot ${opts.areaSlug}: ${result.failures.slice(0, 6).join(" | ")}`);
      if (result.copy) {
        console.error(`\n===== FAILED ${opts.areaSlug.toUpperCase()} WORDING =====\n${formatCustomerFacingLocalCopyV3(result.copy)}\n===== END FAILED WORDING =====\n`);
      }
      if (result.raw) console.error(`===== FAILED RAW RESPONSE =====\n${result.raw}\n===== END FAILED RAW =====\n`);
    }
  }
  if (
    result &&
    shouldAttemptAcceptedGeminiCopyCorrection({
      failures: result.failures,
      uncertain: result.uncertain,
      providerError,
    })
  ) {
    const correction: UkLocalIntroductionCorrectionV1 = {
      rejectedCopy: rejectedCopyForCorrection(result),
      defects: result.failures,
    };
    try {
      result = await tryOnce(correction);
      persistAttempt(2, result);
      lastFailures = result.failures;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "ai-request-failed";
      lastFailures = [detail];
      providerError = true;
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
      persistAttempt(2, result);
    }
  }

  if (!canPersistAcceptedGeminiLocalCopy(result || { ok: false, copy: null }) || !result?.repetitionAnalysis) {
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

  const fullRecord: AiLocalCopyPilotRecordV3 = {
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
    inputEvidencePackHash: "",
    editorialEvidencePackHash: "",
    areaSlug: opts.areaSlug,
    areaName: opts.areaName,
    editorialFactIdsUsed: [],
    outputCopy: result.copy,
    claimMap: result.claims,
    sentencePurposes: result.sentencePurposes,
    repetitionAnalysis: result.repetitionAnalysis,
    validationResult: { ok: true, failures: [], automatedReviews: result.reviews || [] },
    reviewStatus: "candidate",
    approved: false,
    rawOpenAiResponse: result.raw || capturedRaws[capturedRaws.length - 1] || "",
    rawOpenAiResponses: capturedRaws,
    geminiGrounding: null,
  };
  if (opts.writeRecord !== false) {
    const version = opts.candidateVersion || AI_LOCAL_FULL_PAGE_UNIQUENESS_VERSION;
    const targets = [...new Set([version, AI_LOCAL_FULL_PAGE_UNIQUENESS_VERSION])];
    for (const writeVersion of targets) {
      const file = aiLocalCopyPilotPath(opts.slug, opts.serviceId, opts.areaSlug, writeVersion);
      if (file.includes("/pharmacy-ai-local-copy-candidates/") || file.includes("/v2/") || /\/v1\//.test(file)) {
        throw new Error("refusing to write a local-copy pilot into v1/v2 or live candidate paths");
      }
      const record = {
        promptContractId: fullRecord.promptContractId,
        promptContractVersion: fullRecord.promptContractVersion,
        provider: fullRecord.provider,
        model: fullRecord.model,
        generatedAt: fullRecord.generatedAt,
        areaSlug: fullRecord.areaSlug,
        areaName: fullRecord.areaName,
        validationResult: fullRecord.validationResult,
        outputCopy: {
          area: fullRecord.outputCopy.area,
          heroIntroduction: fullRecord.outputCopy.heroIntroduction,
          localIntroduction: fullRecord.outputCopy.localIntroduction,
          serviceDefinitionParagraphs: fullRecord.outputCopy.serviceDefinitionParagraphs || [],
          processHeading: fullRecord.outputCopy.processHeading || "",
          processSteps: fullRecord.outputCopy.processSteps || [],
        },
      };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      try {
        fs.writeFileSync(file, JSON.stringify(record, null, 2), "utf8");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.warn(
          `⚠️ Validation warning for [${opts.areaName}]: nested payload was not written to ${path.basename(file)} (${detail}). Continuing.`,
        );
      }
    }
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
  return { ok: true, record: fullRecord, fingerprint, attemptLogPaths };
}

export function loadAiLocalCopyPilotV3(
  slug: string,
  serviceId: string,
  areaSlug: string,
  version = AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
): AiLocalCopyPilotRecordV3 | null {
  const file = aiLocalCopyPilotPath(slug, serviceId, areaSlug, version);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as AiLocalCopyPilotRecordV3;
  } catch {
    return null;
  }
}

export { hydrateOpenAiEnvIfNeeded } from "./pharmacyAiLocalNarrativeEngineV1.ts";
