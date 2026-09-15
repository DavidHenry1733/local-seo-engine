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
  AI_LOCAL_PILOT_V3_MAX_COST_USD,
  generateAiLocalCopyPilotV3,
  loadAiLocalCopyPilotV3,
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
  }

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
  const generated = await generateAiLocalCopyPilotV3({
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaName: preflight.areaName,
    areaSlug: preflight.areaSlug,
    writeRecord: true,
    authorizedTaskId: `${opts.slug}:${opts.serviceId}:v3:one-local-page:${preflight.areaSlug}`,
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
