/**
 * Pharmacy AI local-narrative engine V1.
 * Reuses src/generator/generateClusterContent.ts getOpenAiIntegrationClient().
 * Preview must never call generateAiLocalCopyForArea.
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  getOpenAiIntegrationClient,
  OPENAI_INTEGRATION_CHAT_MODEL,
} from "../../generator/generateClusterContent.ts";
import { pharmacyIsInSelectedArea } from "./pharmacyEvidenceLedLocalNarrativeV1.ts";
import {
  attributableEntities,
  loadPharmacyLocalEvidencePack,
  localEvidencePackPath,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
  type LocalEvidenceEntity,
  type PharmacyLocalEvidencePackV3,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { bindVerifiedLocalityEvidenceV1 } from "./pharmacyVerifiedLocalityEvidenceV1.ts";
import { buildContentGenerationContext } from "./buildContentGenerationContext.ts";
import { bindCurrentRegisteredApprovedBank } from "../pharmacyApprovedBankRunProvenance.ts";
import { parseAiLocalCopyV1, type AiLocalCopyV1 } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID,
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION,
  PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
  buildAiLocalNarrativeSystemPromptV1,
  buildAiLocalNarrativeUserPromptV1,
  type BusinessLocalityCopyInputV1,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  evidenceEntityId,
  groundAiLocalCopyClaimsV1,
  type AiLocalClaimMapRowV1,
} from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { evaluateAiLocalCopyQualityV1, localNarrativeFingerprint } from "./pharmacyAiLocalCopyQualityV1.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import {
  LOCALITY_NARRATIVE_SIMILARITY_THRESHOLD,
  stripIdentityTokens,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { aiLocalCopyRecordPath } from "./pharmacyAiLocalPageCandidatePaths.ts";

export const AI_LOCAL_NARRATIVE_ENGINE_ID = "pharmacy-ai-local-narrative-engine-v1";
export const AI_LOCAL_NARRATIVE_PROVIDER = "openai";
export const AI_LOCAL_NARRATIVE_MODEL = OPENAI_INTEGRATION_CHAT_MODEL;
export const AI_LOCAL_MAX_SUCCESSFUL_GENERATIONS = 10;
export const AI_LOCAL_MAX_COST_USD = 5;

export type AiLocalCopyRecordV1 = {
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
  outputCopy: AiLocalCopyV1;
  claimMap: AiLocalClaimMapRowV1[];
  validationResult: { ok: boolean; failures: string[] };
  reviewStatus: "candidate";
  approved: false;
};

export type AiGenerationLedger = {
  attempted: number;
  successful: number;
  failed: number;
  retried: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  failures: Array<{ areaSlug: string; detail: string }>;
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

export function resetAiGenerationLedger(initialCostUsd = 0): AiGenerationLedger {
  ledger.attempted = 0;
  ledger.successful = 0;
  ledger.failed = 0;
  ledger.retried = 0;
  ledger.promptTokens = 0;
  ledger.completionTokens = 0;
  ledger.estimatedCostUsd = initialCostUsd;
  ledger.failures = [];
  return ledger;
}

export function getAiGenerationLedger(): AiGenerationLedger {
  return { ...ledger, failures: [...ledger.failures] };
}

export function estimateGpt41CostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1e6) * 2 + (completionTokens / 1e6) * 8;
}

function applyOpenAiEnvFromText(raw: string): void {
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    const eq = trimmed.indexOf("=");
    let key = "";
    let value = "";
    if (eq > 0 && (colon < 0 || eq < colon)) {
      key = trimmed.slice(0, eq).trim();
      value = trimmed.slice(eq + 1).trim();
    } else if (colon > 0) {
      key = trimmed.slice(0, colon).trim();
      value = trimmed.slice(colon + 1).trim();
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === "AI_INTEGRATIONS_OPENAI_API_KEY" && value && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY = value;
    }
    if (key === "AI_INTEGRATIONS_OPENAI_BASE_URL" && value && !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = value;
    }
  }
}

export function hydrateOpenAiEnvIfNeeded(): { ok: boolean; detail: string } {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return { ok: true, detail: "process-env" };
  }
  const envFile = path.join(process.cwd(), ".env");
  if (fs.existsSync(envFile)) {
    applyOpenAiEnvFromText(fs.readFileSync(envFile, "utf8"));
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      return { ok: true, detail: "dotenv" };
    }
  }
  try {
    applyOpenAiEnvFromText(execSync("pm2 env 1", { encoding: "utf8" }));
  } catch {
    /* ignore */
  }
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return { ok: true, detail: "pm2-env" };
  }
  return { ok: false, detail: "AI_INTEGRATIONS_OPENAI_API_KEY not configured" };
}

export function hashFileSha256(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function entityToInput(entity: LocalEvidenceEntity) {
  return {
    entityId: evidenceEntityId(entity.name, entity.category),
    name: entity.name,
    category: entity.category,
    address: entity.address || "",
    coordinates: entity.location,
    attributionRelationship: entity.relationship,
    provider: entity.provider,
  };
}

export function buildPharmacyAiLocalCopyInputV1(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  pack: PharmacyLocalEvidencePackV3;
  varietyHints?: string[];
}): BusinessLocalityCopyInputV1 {
  const ctx = bindCurrentRegisteredApprovedBank(
    buildContentGenerationContext(opts.slug, opts.serviceId, {
      selectedAreasOverride: [{ areaName: opts.areaName, areaSlug: opts.areaSlug, selected: true, order: 1, priority: 1 }],
    }),
  );
  const plan = planPharmacyLocalEvidenceRequest(opts.slug, opts.serviceId);
  const verified = bindVerifiedLocalityEvidenceV1({
    ctx,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    siblingLocalities: plan.areas.map((row) => ({ areaName: row.areaName, areaSlug: row.areaSlug })),
  });
  const profile = ctx.profile;
  const address = String(profile.displayAddress || profile.customerFacingAddress || profile.fullAddress || "").trim();
  return {
    vertical: "pharmacy",
    business: {
      name: profile.pharmacyName,
      telephone: profile.displayPhone || profile.phone,
      website: profile.website || "",
      address,
      coordinates: opts.pack.pharmacyCoordinates
        ? { latitude: opts.pack.pharmacyCoordinates.latitude, longitude: opts.pack.pharmacyCoordinates.longitude }
        : null,
      marketTown: String(ctx.primaryTown || "Barnsley"),
    },
    offer: {
      serviceName: ctx.serviceName,
      serviceId: opts.serviceId,
      lockedClinicalFacts: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
      allowedCta: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.allowedCta,
    },
    locality: {
      areaName: opts.areaName,
      areaSlug: opts.areaSlug,
      distanceLabel: verified.distanceLabel || "",
      distanceKm: verified.distanceKm,
      cardinalDirection: verified.cardinalDirection || "",
      pharmacyIsInArea: pharmacyIsInSelectedArea(verified, address),
      neighbouringSelectedAreas: plan.areas.filter((a) => a.areaSlug !== opts.areaSlug).map((a) => a.areaName),
      evidenceLimitations: opts.pack.sourceStatus ? [`sourceStatus=${opts.pack.sourceStatus}`] : [],
      acceptedEntities: attributableEntities(opts.pack).map(entityToInput),
    },
    style: {
      roles: ["hero introduction", "local context", "access relationship", "local FAQs", "CTA bridge"],
      tone: "Headingley local-page patient-journey tone: calm, specific, professional British English. Not Headingley facts.",
    },
    varietyHints: opts.varietyHints || [`Write a distinct local angle for ${opts.areaName}.`],
  };
}

export function validateAiLocalCopyAgainstInput(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
  previousFingerprints: string[] = [],
): { ok: boolean; failures: string[]; claims: AiLocalClaimMapRowV1[] } {
  const grounded = groundAiLocalCopyClaimsV1(copy, input);
  const quality = evaluateAiLocalCopyQualityV1(copy, input);
  const failures = [...grounded.failures, ...quality.failures];
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
  return { ok: failures.length === 0, failures, claims: grounded.claims };
}

async function requestStructuredCopy(input: BusinessLocalityCopyInputV1): Promise<{
  raw: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}> {
  const client = getOpenAiIntegrationClient();
  const response = await client.chat.completions.create({
    model: AI_LOCAL_NARRATIVE_MODEL,
    temperature: 0.45,
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildAiLocalNarrativeSystemPromptV1(input.vertical) },
      { role: "user", content: buildAiLocalNarrativeUserPromptV1(input) },
    ],
  });
  const raw = response.choices[0]?.message?.content ?? "";
  const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };
  return {
    raw,
    model: response.model || AI_LOCAL_NARRATIVE_MODEL,
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

export async function generateAiLocalCopyForArea(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  previousFingerprints?: string[];
  writeRecord?: boolean;
}): Promise<
  | { ok: true; record: AiLocalCopyRecordV1; fingerprint: string }
  | { ok: false; areaSlug: string; detail: string; failures: string[] }
> {
  if (ledger.successful >= AI_LOCAL_MAX_SUCCESSFUL_GENERATIONS) {
    return { ok: false, areaSlug: opts.areaSlug, detail: "successful-generation limit reached", failures: ["limit"] };
  }
  if (ledger.estimatedCostUsd >= AI_LOCAL_MAX_COST_USD) {
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

  const tryOnce = async (isRetry: boolean) => {
    if (ledger.estimatedCostUsd + 0.05 >= AI_LOCAL_MAX_COST_USD) throw new Error("cost-limit-precheck");
    ledger.attempted += 1;
    if (isRetry) ledger.retried += 1;
    const response = await requestStructuredCopy(input);
    recordUsage(response.promptTokens, response.completionTokens);
    const parsed = parseAiLocalCopyV1(response.raw);
    if (!parsed.ok) return { ok: false as const, failures: parsed.failures, copy: null, claims: [] as AiLocalClaimMapRowV1[] };
    const validated = validateAiLocalCopyAgainstInput(parsed.copy, input, opts.previousFingerprints || []);
    return {
      ok: validated.ok,
      failures: validated.failures,
      copy: parsed.copy,
      claims: validated.claims,
      model: response.model,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
    };
  };

  let result: Awaited<ReturnType<typeof tryOnce>> | null = null;
  let lastFailures: string[] = [];
  for (const isRetry of [false, true]) {
    try {
      result = await tryOnce(isRetry);
      if (result.ok && result.copy) break;
      lastFailures = result.failures;
      if (result.failures.length) {
        console.error(`AI validation ${opts.areaSlug}${isRetry ? " retry" : ""}: ${result.failures.slice(0, 4).join(" | ")}`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "ai-request-failed";
      lastFailures = [detail];
      result = { ok: false as const, failures: lastFailures, copy: null, claims: [] as AiLocalClaimMapRowV1[] };
      if (!isRetry) continue;
    }
  }

  if (!result?.ok || !result.copy) {
    ledger.failed += 1;
    ledger.failures.push({ areaSlug: opts.areaSlug, detail: lastFailures[0] || "validation-failed" });
    return {
      ok: false,
      areaSlug: opts.areaSlug,
      detail: lastFailures[0] || "validation-failed",
      failures: lastFailures,
    };
  }

  const record: AiLocalCopyRecordV1 = {
    promptContractId: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID,
    promptContractVersion: AI_LOCAL_NARRATIVE_PROMPT_VERSION,
    promptContractPath: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH,
    provider: AI_LOCAL_NARRATIVE_PROVIDER,
    model: result.model || AI_LOCAL_NARRATIVE_MODEL,
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
    outputCopy: result.copy,
    claimMap: result.claims,
    validationResult: { ok: true, failures: [] },
    reviewStatus: "candidate",
    approved: false,
  };
  if (opts.writeRecord !== false) {
    const file = aiLocalCopyRecordPath(opts.slug, opts.serviceId, opts.areaSlug);
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

export function loadAiLocalCopyRecord(slug: string, serviceId: string, areaSlug: string): AiLocalCopyRecordV1 | null {
  const file = aiLocalCopyRecordPath(slug, serviceId, areaSlug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as AiLocalCopyRecordV1;
  } catch {
    return null;
  }
}
