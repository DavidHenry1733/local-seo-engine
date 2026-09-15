/**
 * Pharmacy AI local-copy input helpers V1.
 * The OpenAI local-copy writer (`generateAiLocalCopyForArea`) is archived at
 * `src/pharmacy/contentEngine/_archive-legacy-local-writers/`.
 * Preview and Campaign Builder must never call that writer.
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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
export const AI_LOCAL_NARRATIVE_PROVIDER = "archived-openai";
export const AI_LOCAL_NARRATIVE_MODEL = "archived-openai-local-copy-writer";
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

export async function generateAiLocalCopyForArea(_opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  previousFingerprints?: string[];
  writeRecord?: boolean;
}): Promise<never> {
  throw new Error("The OpenAI local-copy writer is archived. Gemini is the only active local-copy writer.");
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
