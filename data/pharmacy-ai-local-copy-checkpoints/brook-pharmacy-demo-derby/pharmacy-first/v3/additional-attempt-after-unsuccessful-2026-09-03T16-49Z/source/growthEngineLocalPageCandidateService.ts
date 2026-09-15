/**
 * Connects the existing v3 local writer, Review Centre and unpublished Preview
 * to Campaign Builder for one user-selected area.
 * Does not generate the full campaign. Does not collect evidence or call paid APIs
 * during preflight.
 */
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  isAuthorisedAiLocalPilotV3Area,
  isOneLocalPageCandidateArea,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import {
  ADDITIONAL_GENERATION_ATTEMPT_EVENT,
  AI_LOCAL_PILOT_V3_MAX_COST_USD,
  AUTHORISE_ONE_ADDITIONAL_ATTEMPT_LABEL,
  additionalGenerationAttemptsAuthorisedV3,
  authorizedTaskBudgetPathV3,
  canAuthoriseOneAdditionalGenerationAttemptFromBudgetV3,
  formatAuthorizedGenerationUsdV3,
  generateAiLocalCopyPilotV3,
  loadAiLocalCopyPilotV3,
  loadAuthorizedTaskBudgetV3,
  oneLocalPageAuthorizedTaskIdV3,
  remainingAuthorizedGenerationCostUsdV3,
  remainingAuthorizedProviderCallsV3,
  type AuthorizedTaskBudgetV3,
} from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "./contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import {
  loadPharmacyLocalEvidencePack,
  validatePharmacyLocalEvidencePack,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { loadCampaignBuilderSession } from "./growthEngineCampaignBuilderService.ts";
import { assemblePharmacyAiLocalPagePilotsV3 } from "./pharmacyAiLocalPagePilotAssemblerV3.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";

export const GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL = "Generate one local-page candidate";
export { AUTHORISE_ONE_ADDITIONAL_ATTEMPT_LABEL, ADDITIONAL_GENERATION_ATTEMPT_EVENT };
export const ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS = 1;

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
};

function selectedAreaNames(slug: string): string[] {
  return (loadCampaignBuilderSession(slug).targetAreaNames || []).map((name) => String(name || "").trim()).filter(Boolean);
}

export function resolveOneLocalPageCandidateArea(slug: string): { areaName: string; areaSlug: string } | null {
  for (const name of selectedAreaNames(slug)) {
    const areaSlug = slugifyArea(name);
    if (areaSlug && isOneLocalPageCandidateArea(slug, areaSlug)) {
      return { areaName: name, areaSlug };
    }
  }
  return null;
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
  const localEvidence = packCheck.ok
    ? { status: "ready", detail: "Saved local evidence pack is usable." }
    : {
        status: packCheck.status || "missing",
        detail: packCheck.detail || "No current evidence pack is stored for this area.",
      };
  if (!packCheck.ok) {
    paidCallsRequired.push({
      kind: "google-places-evidence",
      required: true,
      reason: `No saved local evidence pack for ${matchedName}. Places discovery would be a paid call.`,
    });
  }

  const editorial = loadEditorialEvidencePack(slug, serviceId, areaSlug);
  const editorialReady = editorial?.sufficiency?.status === "READY";
  const editorialEvidence = editorialReady
    ? { status: "ready", detail: "Saved editorial-evidence pack is READY." }
    : editorial
      ? {
          status: editorial.sufficiency.status,
          detail: (editorial.sufficiency.reasons || []).join("; ") || "Editorial pack is not READY.",
        }
      : { status: "missing", detail: "No saved editorial-evidence pack for this area." };
  if (!editorialReady) {
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
    required: editorialReady && packCheck.ok,
    reason: editorialReady && packCheck.ok
      ? "Writing one local-page candidate uses the existing v3 OpenAI adapter."
      : "OpenAI is not called until saved local and editorial evidence are READY.",
  });

  const existingCandidate = Boolean(loadAiLocalCopyPilotV3(slug, serviceId, areaSlug));
  const taskId = oneLocalPageAuthorizedTaskIdV3(slug, serviceId, areaSlug);
  const budget = loadAuthorizedTaskBudgetV3(
    authorizedTaskBudgetPathV3({ slug, serviceId, taskId }),
  );
  const generationAllowance = generationAllowanceFromBudget(budget);
  let blocker: string | null = null;
  if (!onePagePath) {
    blocker =
      "One local-page candidate is connected for a selected Campaign Builder area. Existing Yorkshire v3 pilots stay on their preview path.";
  } else if (!selected) {
    blocker = `Select ${matchedName} in Target Areas before creating this page.`;
  } else if (!authorised) {
    blocker = `${matchedName} is not authorised on this tenant’s v3 local writer.`;
  } else if (!packCheck.ok || !editorialReady) {
    blocker = `Saved ${matchedName} evidence is missing. Reuse saved evidence first. Collecting it would require paid retrievals. Do not generate until that evidence is stored.`;
  } else if (generationAllowance.remainingCalls <= 0) {
    blocker =
      generationAllowance.remainingCostUsd <= 0
        ? "The generation cost cap is exhausted. Previous spend is preserved."
        : existingCandidate
          ? "The authorised OpenAI call limit for this page is exhausted. Previous spend is preserved."
          : "The authorised OpenAI call limit for this page is exhausted. Authorise one additional attempt to continue. Previous spend is preserved.";
  }
  generationAllowance.canAuthoriseAdditionalAttempt = Boolean(
    onePagePath &&
      selected &&
      authorised &&
      packCheck.ok &&
      editorialReady &&
      !existingCandidate &&
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
    canGenerate: !blocker,
    blocker,
    paidCallsRequired,
    reviewUrl,
    previewUrl,
    existingCandidate,
    generationAllowance,
  };
}

export async function generateOneLocalPageCandidate(opts: {
  slug: string;
  serviceId: string;
  areaName?: string;
  areaSlug?: string;
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
  const areaRef = opts.areaSlug || opts.areaName || resolveOneLocalPageCandidateArea(opts.slug)?.areaSlug || "";
  if (!areaRef) {
    const empty = preflightOneLocalPageCandidate(opts.slug, opts.serviceId, "");
    return {
      ok: false,
      error: "Select a target area in Campaign Builder first.",
      preflight: empty,
    };
  }
  const preflight = preflightOneLocalPageCandidate(opts.slug, opts.serviceId, areaRef);
  if (!preflight.canGenerate) {
    return {
      ok: false,
      error: preflight.blocker || "This local page cannot be created yet.",
      preflight,
    };
  }
  const taskId = oneLocalPageAuthorizedTaskIdV3(opts.slug, opts.serviceId, preflight.areaSlug);
  const budget = loadAuthorizedTaskBudgetV3(
    authorizedTaskBudgetPathV3({
      slug: opts.slug,
      serviceId: opts.serviceId,
      taskId,
    }),
  );
  const generated = await generateAiLocalCopyPilotV3({
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaName: preflight.areaName,
    areaSlug: preflight.areaSlug,
    writeRecord: true,
    authorizedTaskId: taskId,
    maxAttempts: ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS,
    maxProviderCalls: budget?.maxProviderCalls ?? 2,
  });
  if (!generated.ok) {
    return {
      ok: false,
      error: generated.detail || "The local page could not be created.",
      preflight,
    };
  }
  const assembled = assemblePharmacyAiLocalPagePilotsV3(opts.slug, opts.serviceId, [preflight.areaSlug]);
  return {
    ok: true,
    areaSlug: preflight.areaSlug,
    reviewUrl: preflight.reviewUrl,
    previewUrl: preflight.previewUrl,
    assembled: assembled.ok && assembled.areas.some((row) => row.areaSlug === preflight.areaSlug),
  };
}
