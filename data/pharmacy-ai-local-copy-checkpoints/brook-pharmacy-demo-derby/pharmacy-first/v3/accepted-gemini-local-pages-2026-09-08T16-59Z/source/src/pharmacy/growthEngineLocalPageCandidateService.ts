/**
 * Connects the existing v3 local writer, Review Centre and unpublished Preview
 * to Campaign Builder for one user-selected area at a time.
 * Does not generate the full campaign. Does not collect evidence or call paid APIs
 * during preflight. Each selected area uses its own evidence, distance, allowance
 * and candidate records.
 */
import fs from "node:fs";
import path from "node:path";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  getAiLocalCopyAttemptLogRoot,
  isAuthorisedAiLocalPilotV3Area,
  isOneLocalPageCandidateArea,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { planSavedLocalPageStraightLineDistance } from "./growthEngineLocalPageEvidenceCollectionService.ts";
import {
  ADDITIONAL_GENERATION_ATTEMPT_EVENT,
  AI_LOCAL_PILOT_V3_MAX_COST_USD,
  AUTHORISE_ONE_ADDITIONAL_ATTEMPT_LABEL,
  additionalGenerationAttemptsAuthorisedV3,
  authorizedTaskBudgetPathV3,
  formatAuthorizedGenerationUsdV3,
  generateAiLocalCopyPilotV3,
  canAuthoriseOneAdditionalGenerationAttemptFromBudgetV3,
  grantOneLocalPageGenerateCallIfNeededV3,
  loadAiLocalCopyPilotV3,
  loadAuthorizedTaskBudgetV3,
  oneLocalPageAuthorizedTaskIdV3,
  remainingAuthorizedGenerationCostUsdV3,
  remainingAuthorizedProviderCallsV3,
  type AuthorizedTaskBudgetV3,
} from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "./contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import {
  loadLocalEvidencePackForGeneration,
  loadPharmacyLocalEvidencePack,
  validatePharmacyLocalEvidencePack,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { assessSavedLocalPageGenerationReadiness } from "./contentEngine/pharmacyLocalPageGenerationReadinessV1.ts";
import { loadCampaignBuilderSession } from "./growthEngineCampaignBuilderService.ts";
import { assemblePharmacyAiLocalPagePilotsV3 } from "./pharmacyAiLocalPagePilotAssemblerV3.ts";
import { hasCurrentGeminiLocalCopyFields } from "./contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { assignUkLocalIntroductionStructures } from "./contentEngine/pharmacyUkLocalIntroductionStyleContractV1.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";

export const GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL = "Generate one local-page candidate";
export { AUTHORISE_ONE_ADDITIONAL_ATTEMPT_LABEL, ADDITIONAL_GENERATION_ATTEMPT_EVENT };
export const ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS = 1;
export const LOCAL_PAGE_OPENAI_CALL_LIMIT_EXHAUSTED =
  "The authorised OpenAI call limit is exhausted. Previous spend is preserved.";

export type LocalPageGenerationAllowance = {
  consumed: number;
  reserved: number;
  uncertain: number;
  maxProviderCalls: number;
  remainingCalls: number;
  estimatedCostUsd: number;
  remainingCostUsd: number;
  additionalAttemptsAuthorised: number;
  canAuthoriseAdditionalAttempt: boolean;
  additionalAttemptMaxCostUsd: number;
  additionalAttemptMaxCostLabel: string;
  allowanceLabel: string;
  budgetPresent: boolean;
};

function emptyGenerationAllowance(): LocalPageGenerationAllowance {
  return {
    consumed: 0,
    reserved: 0,
    uncertain: 0,
    maxProviderCalls: 2,
    remainingCalls: 2,
    estimatedCostUsd: 0,
    remainingCostUsd: AI_LOCAL_PILOT_V3_MAX_COST_USD,
    additionalAttemptsAuthorised: 0,
    canAuthoriseAdditionalAttempt: false,
    additionalAttemptMaxCostUsd: AI_LOCAL_PILOT_V3_MAX_COST_USD,
    additionalAttemptMaxCostLabel: `up to ${formatAuthorizedGenerationUsdV3(AI_LOCAL_PILOT_V3_MAX_COST_USD)} remaining of the $2.00 OpenAI cap`,
    allowanceLabel: "2 of 2 OpenAI calls remaining · $0 spent",
    budgetPresent: false,
  };
}

function generationAllowanceFromBudget(budget: AuthorizedTaskBudgetV3 | null): LocalPageGenerationAllowance {
  if (!budget) return emptyGenerationAllowance();
  const remainingCalls = remainingAuthorizedProviderCallsV3(budget);
  const remainingCostUsd = remainingAuthorizedGenerationCostUsdV3(budget);
  const additionalAttemptsAuthorised = additionalGenerationAttemptsAuthorisedV3(budget);
  return {
    consumed: Number(budget.consumed || 0),
    reserved: Number(budget.reserved || 0),
    uncertain: Number(budget.uncertain || 0),
    maxProviderCalls: Number(budget.maxProviderCalls || 0),
    remainingCalls,
    estimatedCostUsd: Number(budget.estimatedCostUsd || 0),
    remainingCostUsd,
    additionalAttemptsAuthorised,
    canAuthoriseAdditionalAttempt: false,
    additionalAttemptMaxCostUsd: remainingCostUsd,
    additionalAttemptMaxCostLabel: `up to ${formatAuthorizedGenerationUsdV3(remainingCostUsd)} remaining of the $2.00 OpenAI cap`,
    allowanceLabel: `${remainingCalls} of ${Number(budget.maxProviderCalls || 0)} OpenAI calls remaining · ${formatAuthorizedGenerationUsdV3(Number(budget.estimatedCostUsd || 0))} spent`,
    budgetPresent: true,
  };
}

export type LocalPageCandidatePaidCall = {
  kind: "dataforseo-editorial-search" | "editorial-page-retrieval" | "google-places-evidence" | "openai-copy";
  required: boolean;
  reason: string;
};

export type LocalPageCandidatePreflight = {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  selected: boolean;
  authorised: boolean;
  onePagePath: boolean;
  campaignScope: string;
  estimatedCostUsd: number;
  estimatedCostLabel: string;
  localEvidence: { status: string; detail: string };
  editorialEvidence: { status: string; detail: string };
  canGenerate: boolean;
  blocker: string | null;
  paidCallsRequired: LocalPageCandidatePaidCall[];
  reviewUrl: string;
  previewUrl: string;
  existingCandidate: boolean;
  generationAllowance: LocalPageGenerationAllowance;
  distanceKm: number | null;
  distanceStatus: "recorded" | "missing";
  distanceLabel: string;
  distanceDetail: string;
  distanceMethod: "haversine-straight-line";
  distanceFrom: string;
  distanceTo: string;
};

function selectedAreaNames(slug: string): string[] {
  return (loadCampaignBuilderSession(slug).targetAreaNames || []).map((name) => String(name || "").trim()).filter(Boolean);
}

function localPageDistanceSummary(
  slug: string,
  serviceId: string,
  areaName: string,
  areaSlug: string,
): {
  km: number | null;
  status: "recorded" | "missing";
  label: string;
  detail: string;
  method: "haversine-straight-line";
  pharmacyName: string;
  areaName: string;
} {
  const distancePlan = planSavedLocalPageStraightLineDistance(slug, serviceId, areaName, areaSlug);
  const fromMatch = new RegExp(
    `from (.+) to ${String(areaName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "i",
  ).exec(distancePlan.detail || "");
  return {
    km: distancePlan.distanceKm,
    status: distancePlan.areaReferenceStatus,
    label:
      distancePlan.distanceKm != null
        ? `approximately ${distancePlan.distanceKm.toFixed(1)} km straight-line`
        : "Distance unavailable",
    detail: distancePlan.detail,
    method: "haversine-straight-line" as const,
    pharmacyName: String(fromMatch?.[1] || "").trim(),
    areaName,
  };
}

export function listSelectedOneLocalPageCandidateAreas(slug: string): { areaName: string; areaSlug: string }[] {
  const out: { areaName: string; areaSlug: string }[] = [];
  for (const name of selectedAreaNames(slug)) {
    const areaSlug = slugifyArea(name);
    if (areaSlug && isOneLocalPageCandidateArea(slug, areaSlug)) {
      out.push({ areaName: name, areaSlug });
    }
  }
  return out;
}

/** First selected eligible area when no area is requested. A requested area must itself be selected. */
export function resolveOneLocalPageCandidateArea(
  slug: string,
  requestedArea?: string | null,
): { areaName: string; areaSlug: string } | null {
  const selected = listSelectedOneLocalPageCandidateAreas(slug);
  if (!selected.length) return null;
  const wanted = slugifyArea(String(requestedArea || "")) || String(requestedArea || "").trim().toLowerCase();
  if (wanted) {
    return selected.find((row) => row.areaSlug === wanted) || null;
  }
  return selected[0];
}

export function preflightOneLocalPageCandidate(
  slug: string,
  serviceId: string,
  areaNameOrSlug: string,
): LocalPageCandidatePreflight {
  const raw = String(areaNameOrSlug || "").trim();
  const areaSlug = slugifyArea(raw) || raw.toLowerCase();
  const selectedNames = selectedAreaNames(slug);
  const matchedName = selectedNames.find((name) => slugifyArea(name) === areaSlug) || raw;
  const selected = selectedNames.some((name) => slugifyArea(name) === areaSlug);
  const authorised = isAuthorisedAiLocalPilotV3Area(slug, areaSlug);
  const onePagePath = isOneLocalPageCandidateArea(slug, areaSlug);
  const reviewUrl = `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(serviceId)}`;
  const previewUrl = `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(serviceId)}&asset=${encodeURIComponent(AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET)}&area=${encodeURIComponent(areaSlug)}`;
  const otherCount = Math.max(0, selectedNames.length - 1);
  const campaignScope =
    otherCount > 0
      ? `1 local page (${matchedName}) — not the full campaign and not the other ${otherCount} selected area${otherCount === 1 ? "" : "s"}`
      : `1 local page (${matchedName}) — not the full campaign`;
  const estimatedCostUsd = AI_LOCAL_PILOT_V3_MAX_COST_USD;
  const estimatedCostLabel = `up to $${estimatedCostUsd.toFixed(2)} OpenAI cap for this v3 page`;

  const paidCallsRequired: LocalPageCandidatePaidCall[] = [];
  const rawPack = loadPharmacyLocalEvidencePack(slug, areaSlug);
  const packCheck = validatePharmacyLocalEvidencePack(rawPack, {
    slug,
    areaName: matchedName,
    areaSlug,
  });
  const packForGeneration = loadLocalEvidencePackForGeneration(slug, matchedName, areaSlug);
  const localEvidence = packCheck.ok
    ? { status: "ready", detail: "Saved local evidence pack is usable." }
    : packForGeneration.ok
      ? {
          status: packCheck.status || "evidence-limited",
          detail:
            packCheck.ok === false
              ? `${packCheck.detail} Optional local facts are omitted.`
              : "Saved local evidence pack is usable.",
        }
      : {
          status: packCheck.status || "missing",
          detail: packCheck.detail || "No current evidence pack is stored for this area.",
        };
  if (!packCheck.ok && !packForGeneration.ok) {
    paidCallsRequired.push({
      kind: "google-places-evidence",
      required: true,
      reason: `No saved local evidence pack for ${matchedName}. Places discovery would be a paid call.`,
    });
  }

  const editorial = loadEditorialEvidencePack(slug, serviceId, areaSlug);
  const generationReadiness = assessSavedLocalPageGenerationReadiness(slug, serviceId, matchedName, areaSlug);
  const editorialReady = editorial?.sufficiency?.status === "READY";
  const editorialEvidence = editorialReady
    ? { status: "ready", detail: "Saved editorial-evidence pack is READY." }
    : editorial
      ? {
          status: editorial.sufficiency.status,
          detail: (editorial.sufficiency.reasons || []).join("; ") || "Editorial pack is not READY.",
        }
      : { status: "missing", detail: "No saved editorial-evidence pack for this area." };
  if (!generationReadiness.collectionFinished && !editorialReady) {
    paidCallsRequired.push({
      kind: "dataforseo-editorial-search",
      required: true,
      reason: "No READY editorial pack. DataForSEO search would be a paid call.",
    });
    paidCallsRequired.push({
      kind: "editorial-page-retrieval",
      required: true,
      reason: "Authoritative page bodies would be fetched after search.",
    });
  }
  paidCallsRequired.push({
    kind: "openai-copy",
    required: generationReadiness.canGenerate && generationReadiness.fieldPlan.mayRequestOpenAI,
    reason:
      generationReadiness.canGenerate && generationReadiness.fieldPlan.mayRequestOpenAI
        ? "Writing one local-page candidate uses the existing v3 OpenAI adapter."
        : generationReadiness.canGenerate
          ? "Field policy omits OpenAI for this evidence richness; deterministic assembly is used."
          : "OpenAI is not called until required deterministic facts are present.",
  });

  const existingCandidate = Boolean(loadAiLocalCopyPilotV3(slug, serviceId, areaSlug));
  const taskId = oneLocalPageAuthorizedTaskIdV3(slug, serviceId, areaSlug);
  const budget = loadAuthorizedTaskBudgetV3(
    authorizedTaskBudgetPathV3({ slug, serviceId, taskId }),
  );
  const generationAllowance = generationAllowanceFromBudget(budget);
  const distance = localPageDistanceSummary(slug, serviceId, matchedName, areaSlug);
  let blocker: string | null = null;
  if (!onePagePath) {
    blocker =
      "One local-page candidate is connected for a selected Campaign Builder area. Existing Yorkshire v3 pilots stay on their preview path.";
  } else if (!selected) {
    blocker = `Select ${matchedName} in Target Areas before creating this page.`;
  } else if (!authorised) {
    blocker = `${matchedName} is not authorised on this tenant’s v3 local writer.`;
  } else if (!generationReadiness.canGenerate) {
    blocker = generationReadiness.reasons.join("; ") || `Saved ${matchedName} evidence is not sufficient for an honest page.`;
  } else if (generationAllowance.remainingCostUsd <= 0) {
    blocker = "The generation cost cap is exhausted. Previous spend is preserved.";
  } else if (generationAllowance.reserved > 0) {
    blocker = "A generation attempt is already in progress. Previous spend is preserved.";
  } else if (generationAllowance.budgetPresent && generationAllowance.remainingCalls <= 0) {
    blocker = LOCAL_PAGE_OPENAI_CALL_LIMIT_EXHAUSTED;
  }
  generationAllowance.canAuthoriseAdditionalAttempt = Boolean(
    !existingCandidate &&
      selected &&
      authorised &&
      onePagePath &&
      generationReadiness.canGenerate &&
      generationAllowance.remainingCostUsd > 0 &&
      generationAllowance.reserved <= 0 &&
      budget &&
      canAuthoriseOneAdditionalGenerationAttemptFromBudgetV3(budget),
  );

  return {
    slug,
    serviceId,
    areaName: matchedName,
    areaSlug,
    selected,
    authorised,
    onePagePath,
    campaignScope,
    estimatedCostUsd,
    estimatedCostLabel,
    localEvidence,
    editorialEvidence,
    canGenerate: !blocker && !existingCandidate,
    blocker,
    paidCallsRequired,
    reviewUrl,
    previewUrl,
    existingCandidate,
    generationAllowance,
    distanceKm: distance.km,
    distanceStatus: distance.status,
    distanceLabel: distance.label,
    distanceDetail: distance.detail,
    distanceMethod: distance.method,
    distanceFrom: distance.pharmacyName,
    distanceTo: distance.areaName,
  };
}

/**
 * Remaining-local-pages still skip saved valid candidates via canGenerate.
 * The V2 improvement run may overwrite a snapshotted V1 page and may grant
 * one extra OpenAI call when remainingCalls is 0 but remaining cost remains.
 */
export function improvedLocalPageGenerationBlocker(preflight: LocalPageCandidatePreflight): string | null {
  if (!preflight.blocker || preflight.blocker === LOCAL_PAGE_OPENAI_CALL_LIMIT_EXHAUSTED) {
    return null;
  }
  return preflight.blocker;
}

export async function generateOneLocalPageCandidate(opts: {
  slug: string;
  serviceId: string;
  areaName?: string;
  areaSlug?: string;
  previousFingerprints?: string[];
  requireImprovedLocalQuality?: boolean;
  replaceExistingCandidate?: boolean;
  maxAttempts?: number;
}): Promise<
  | {
      ok: true;
      areaSlug: string;
      reviewUrl: string;
      previewUrl: string;
      assembled: boolean;
    }
  | { ok: false; error: string; preflight: LocalPageCandidatePreflight }
> {
  const areaRef = String(opts.areaSlug || opts.areaName || "").trim();
  if (!areaRef) {
    const empty = preflightOneLocalPageCandidate(opts.slug, opts.serviceId, "");
    return {
      ok: false,
      error: "Select which area this action is for.",
      preflight: empty,
    };
  }
  const resolvedArea = resolveOneLocalPageCandidateArea(opts.slug, areaRef);
  if (!resolvedArea) {
    const empty = preflightOneLocalPageCandidate(opts.slug, opts.serviceId, areaRef);
    return {
      ok: false,
      error: "This area is not a selected Campaign Builder local-page area.",
      preflight: empty,
    };
  }
  const preflight = preflightOneLocalPageCandidate(opts.slug, opts.serviceId, resolvedArea.areaSlug);
  const replacing = opts.replaceExistingCandidate === true;
  const improving = opts.requireImprovedLocalQuality === true;
  const generationError = improving || replacing
    ? improvedLocalPageGenerationBlocker(preflight)
    : preflight.canGenerate
      ? null
      : preflight.blocker || "This local page cannot be created yet.";
  if (generationError) {
    return {
      ok: false,
      error: generationError,
      preflight,
    };
  }
  const taskId = oneLocalPageAuthorizedTaskIdV3(opts.slug, opts.serviceId, preflight.areaSlug);
  const budgetFile = authorizedTaskBudgetPathV3({
    slug: opts.slug,
    serviceId: opts.serviceId,
    taskId,
  });
  let maxProviderCalls = 2;
  if (fs.existsSync(budgetFile)) {
    const granted = grantOneLocalPageGenerateCallIfNeededV3({
      slug: opts.slug,
      serviceId: opts.serviceId,
      areaSlug: preflight.areaSlug,
      minRemainingCalls: opts.maxAttempts ?? ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS,
    });
    if (!granted.ok) {
      return {
        ok: false,
        error: granted.error,
        preflight: preflightOneLocalPageCandidate(opts.slug, opts.serviceId, preflight.areaSlug),
      };
    }
    maxProviderCalls = granted.budget.maxProviderCalls;
  }
  const selected = listSelectedOneLocalPageCandidateAreas(opts.slug);
  const introductionStyle = assignUkLocalIntroductionStructures({
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaSlugs: selected.map((row) => row.areaSlug),
  }).get(preflight.areaSlug);
  if (!introductionStyle) {
    return {
      ok: false,
      error: "UK local Gemini introduction writer is required. The OpenAI local-introduction writer is inactive.",
      preflight,
    };
  }
  const generated = await generateAiLocalCopyPilotV3({
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaName: preflight.areaName,
    areaSlug: preflight.areaSlug,
    writeRecord: true,
    authorizedTaskId: taskId,
    maxAttempts: opts.maxAttempts ?? ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS,
    maxProviderCalls,
    previousFingerprints: opts.previousFingerprints,
    requireImprovedLocalQuality: opts.requireImprovedLocalQuality === true,
    ukLocalIntroductionStyle: {
      id: introductionStyle.id,
      label: introductionStyle.label,
      instruction: introductionStyle.instruction,
    },
  });
  if (!generated.ok) {
    return {
      ok: false,
      error: generated.detail || "The local page could not be created.",
      preflight,
    };
  }
  let assembled = false;
  try {
    const assembledResult = assemblePharmacyAiLocalPagePilotsV3(opts.slug, opts.serviceId, [preflight.areaSlug]);
    assembled = assembledResult.ok && assembledResult.areas.some((row) => row.areaSlug === preflight.areaSlug);
  } catch (error) {
    console.error(
      `Assemble after local-page generate failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return {
    ok: true,
    areaSlug: preflight.areaSlug,
    reviewUrl: preflight.reviewUrl,
    previewUrl: preflight.previewUrl,
    assembled,
  };
}

export type SavedGeminiLocalAttemptSource = {
  areaSlug: string;
  attemptPath: string;
  savedAt: string;
  heroIntroduction: string;
  localIntroduction: string;
};

export type CurrentLocalPageCandidateAssembly = {
  ok: boolean;
  areaSlug: string;
  candidateVersion: string | null;
  assembled: boolean;
  previewUrl: string;
  reviewUrl: string;
  attemptPath: string | null;
  detail: string;
};

function compactLocalCopyText(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function loadLatestSuccessfulGeminiLocalAttemptV3(
  slug: string,
  serviceId: string,
  areaSlug: string,
): SavedGeminiLocalAttemptSource | null {
  const dir = path.join(getAiLocalCopyAttemptLogRoot(slug, serviceId), areaSlug);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();
  for (const name of files) {
    const attemptPath = path.join(dir, name);
    try {
      const raw = JSON.parse(fs.readFileSync(attemptPath, "utf8")) as {
        savedAt?: string;
        validationResult?: { ok?: boolean };
        parsedCopy?: { heroIntroduction?: string; localIntroduction?: string };
        copy?: { heroIntroduction?: string; localIntroduction?: string };
      };
      if (!raw.validationResult?.ok) continue;
      const copy = raw.parsedCopy || raw.copy;
      if (!hasCurrentGeminiLocalCopyFields(copy)) continue;
      return {
        areaSlug,
        attemptPath,
        savedAt: String(raw.savedAt || ""),
        heroIntroduction: String(copy?.heroIntroduction || "").trim(),
        localIntroduction: String(copy?.localIntroduction || "").trim(),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function assembleCurrentLocalPageCandidateFromSavedGeminiAttempt(opts: {
  slug: string;
  serviceId: string;
  areaSlug: string;
}): CurrentLocalPageCandidateAssembly {
  const preflight = preflightOneLocalPageCandidate(opts.slug, opts.serviceId, opts.areaSlug);
  const empty: CurrentLocalPageCandidateAssembly = {
    ok: false,
    areaSlug: opts.areaSlug,
    candidateVersion: null,
    assembled: false,
    previewUrl: preflight.previewUrl,
    reviewUrl: preflight.reviewUrl,
    attemptPath: null,
    detail: "not-assembled",
  };
  const attempt = loadLatestSuccessfulGeminiLocalAttemptV3(opts.slug, opts.serviceId, opts.areaSlug);
  if (!attempt) {
    return { ...empty, detail: "no-successful-gemini-attempt" };
  }
  const record = loadAiLocalCopyPilotV3(opts.slug, opts.serviceId, opts.areaSlug);
  if (!record?.outputCopy || record.validationResult?.ok !== true) {
    return { ...empty, attemptPath: attempt.attemptPath, detail: "saved-copy-record-missing" };
  }
  const savedHero = String(record.outputCopy.heroIntroduction || "").trim();
  const savedLocal = compactLocalCopyText(String(record.outputCopy.localIntroduction || ""));
  const attemptLocal = compactLocalCopyText(attempt.localIntroduction);
  if (savedHero !== attempt.heroIntroduction || !savedLocal.includes(attemptLocal)) {
    return { ...empty, attemptPath: attempt.attemptPath, detail: "saved-copy-does-not-match-attempt" };
  }
  const assembledResult = assemblePharmacyAiLocalPagePilotsV3(opts.slug, opts.serviceId, [opts.areaSlug]);
  const assembled = assembledResult.ok && assembledResult.areas.some((row) => row.areaSlug === opts.areaSlug);
  return {
    ok: assembled,
    areaSlug: opts.areaSlug,
    candidateVersion: record.generatedAt || attempt.savedAt || null,
    assembled,
    previewUrl: preflight.previewUrl,
    reviewUrl: preflight.reviewUrl,
    attemptPath: attempt.attemptPath,
    detail: assembled ? "assembled-from-saved-gemini-attempt" : assembledResult.skipped[0]?.detail || "assemble-skipped",
  };
}

export function assembleCurrentLocalPageCandidatesFromSavedGeminiAttempts(opts: {
  slug: string;
  serviceId: string;
  areaSlugs: string[];
}): { ok: boolean; areas: CurrentLocalPageCandidateAssembly[] } {
  const areas = opts.areaSlugs.map((areaSlug) =>
    assembleCurrentLocalPageCandidateFromSavedGeminiAttempt({
      slug: opts.slug,
      serviceId: opts.serviceId,
      areaSlug,
    }),
  );
  return { ok: areas.every((row) => row.ok), areas };
}
