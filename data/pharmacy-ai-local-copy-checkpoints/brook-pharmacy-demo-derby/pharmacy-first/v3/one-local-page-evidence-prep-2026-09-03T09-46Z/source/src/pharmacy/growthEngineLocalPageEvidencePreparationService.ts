/**
 * Plans evidence preparation for one selected Campaign Builder area.
 * Reuses saved caches first. Does not call Google Places, DataForSEO, or OpenAI.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEditorialEvidencePack, hydrateDataForSeoEnvIfNeeded } from "./contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import {
  MAX_PAGE_RETRIEVALS_PER_AREA,
  MAX_SEARCHES_PER_AREA,
  buildEditorialSearchQueries,
  editorialEvidencePackPath,
} from "./contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { resolveGeographicEvidenceContext, buildDisambiguatedEvidenceQuery } from "./contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import {
  attributableEntities,
  loadPharmacyLocalEvidencePack,
  localEvidencePackPath,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { isDataForSeoConfigured } from "./dataForSeoNationalSearchAdapter.ts";
import { hasGooglePlacesApiKey } from "./googlePlacesConnection.ts";
import {
  preflightOneLocalPageCandidate,
  resolveOneLocalPageCandidateArea,
} from "./growthEngineLocalPageCandidateService.ts";
import { LOCAL_EVIDENCE_CATEGORY_QUERIES } from "./pharmacyLocalRelevancePackService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";

export const PLACES_TEXT_SEARCH_USD = 0.032;
export const DATAFORSEO_ORGANIC_SEARCH_USD = 0.002;
export const PAGE_RETRIEVAL_USD = 0;
export const EVIDENCE_PREP_PAID_AUTHORISED = false;

export type EvidencePreparationCall = {
  id: string;
  provider: "google-places" | "dataforseo" | "safe-html-fetch";
  kind: string;
  purpose: string;
  query?: string;
  estimatedCostUsd: number;
  cached: boolean;
  required: boolean;
};

export type EvidencePreparationGap = {
  id: string;
  layer: "local-places" | "editorial-descriptive";
  status: string;
  detail: string;
};

export type LocalPageEvidencePreparationPlan = {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  plannedAt: string;
  cacheReuse: {
    localPackPath: string;
    localPackPresent: boolean;
    localPackReady: boolean;
    localPackDetail: string;
    editorialPackPath: string;
    editorialPackPresent: boolean;
    editorialReady: boolean;
    editorialDetail: string;
    editorialFactCount: number;
    editorialPageCount: number;
    placesEntityCount: number;
  };
  missing: EvidencePreparationGap[];
  proposedCalls: EvidencePreparationCall[];
  estimatedCostUsd: number;
  estimatedCostLabel: string;
  providersConfigured: { googlePlaces: boolean; dataForSeo: boolean };
  placesNamesAreNotDescriptiveEvidence: string;
  paidCollectionAuthorised: boolean;
  paidCollectionBlockedReason: string | null;
  remainingBlocker: string | null;
  wouldSave: string[];
  confirmedAt: string | null;
  executed: boolean;
  paidCallsMade: number;
};

function planFilePath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-plans",
    slug,
    serviceId,
    "v1",
    `${areaSlug}.json`,
  );
}

function loadSavedPlan(slug: string, serviceId: string, areaSlug: string): LocalPageEvidencePreparationPlan | null {
  const file = planFilePath(slug, serviceId, areaSlug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as LocalPageEvidencePreparationPlan;
  } catch {
    return null;
  }
}

export function writeEvidencePreparationPlan(plan: LocalPageEvidencePreparationPlan): string {
  const file = planFilePath(plan.slug, plan.serviceId, plan.areaSlug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
  return file;
}

export function planOneLocalPageEvidencePreparation(
  slug: string,
  serviceId: string,
  areaNameOrSlug?: string,
): LocalPageEvidencePreparationPlan {
  const resolved = areaNameOrSlug
    ? { areaName: areaNameOrSlug, areaSlug: slugifyArea(areaNameOrSlug) || String(areaNameOrSlug).toLowerCase() }
    : resolveOneLocalPageCandidateArea(slug);
  const areaSlug = resolved?.areaSlug || "";
  const preflight = preflightOneLocalPageCandidate(slug, serviceId, areaSlug || areaNameOrSlug || "");
  const areaName = preflight.areaName || resolved?.areaName || "";
  const requestPlan = planPharmacyLocalEvidenceRequest(slug, serviceId);
  const rawPack = loadPharmacyLocalEvidencePack(slug, areaSlug);
  const packCheck = validatePharmacyLocalEvidencePack(rawPack, {
    slug,
    areaName,
    areaSlug,
    pharmacyCoordinates: requestPlan.pharmacyCoordinates,
  });
  const editorial = loadEditorialEvidencePack(slug, serviceId, areaSlug);
  const placesEntityCount = packCheck.ok ? attributableEntities(packCheck.pack).length : 0;
  const editorialReady = editorial?.sufficiency?.status === "READY";
  const localReady = packCheck.ok;
  const localDetail = localReady
    ? packCheck.pack.sourceStatus || "Saved local evidence pack is usable."
    : packCheck.ok === false
      ? packCheck.detail
      : "No current evidence pack is stored for this area.";
  const editorialDetail = editorialReady
    ? "Saved editorial-evidence pack is READY."
    : editorial
      ? (editorial.sufficiency.reasons || []).join("; ") || "Editorial pack is not READY."
      : "No saved editorial-evidence pack for this area.";

  const missing: EvidencePreparationGap[] = [];
  if (!localReady) {
    missing.push({
      id: "local-places-pack",
      layer: "local-places",
      status: packCheck.ok ? "ready" : packCheck.status,
      detail: localDetail,
    });
  }
  if (!editorialReady) {
    missing.push({
      id: "editorial-descriptive-pack",
      layer: "editorial-descriptive",
      status: editorial?.sufficiency?.status || "missing",
      detail: editorialDetail,
    });
    if (placesEntityCount > 0 && (editorial?.sufficiency?.acceptedFactCount || 0) === 0) {
      missing.push({
        id: "places-names-not-descriptive",
        layer: "editorial-descriptive",
        status: "insufficient",
        detail: "Places entity names alone are not descriptive local evidence.",
      });
    }
  }

  const geo = resolveGeographicEvidenceContext({
    slug,
    areaName,
    areaSlug,
    siblingAreaNames: requestPlan.areas.map((row) => row.areaName),
    pharmacyCoordinates: requestPlan.pharmacyCoordinates,
  });
  const proposedCalls: EvidencePreparationCall[] = [];
  if (!localReady) {
    for (const spec of LOCAL_EVIDENCE_CATEGORY_QUERIES) {
      proposedCalls.push({
        id: `places-${spec.category}`,
        provider: "google-places",
        kind: "places-text-search",
        purpose: `Attributable ${spec.category} entities in ${areaName}`,
        query: buildDisambiguatedEvidenceQuery(spec.phrase, geo),
        estimatedCostUsd: PLACES_TEXT_SEARCH_USD,
        cached: false,
        required: true,
      });
    }
  }
  if (!editorialReady) {
    const queries = buildEditorialSearchQueries({
      geo,
      pack: packCheck.ok ? packCheck.pack : null,
    }).slice(0, MAX_SEARCHES_PER_AREA);
    for (const row of queries) {
      proposedCalls.push({
        id: `dataforseo-${row.topic}`,
        provider: "dataforseo",
        kind: "google-organic-live",
        purpose: `Authoritative ${row.topic} sources for ${areaName}`,
        query: row.query,
        estimatedCostUsd: DATAFORSEO_ORGANIC_SEARCH_USD,
        cached: false,
        required: true,
      });
    }
    for (let i = 0; i < MAX_PAGE_RETRIEVALS_PER_AREA; i += 1) {
      proposedCalls.push({
        id: `page-body-${i + 1}`,
        provider: "safe-html-fetch",
        kind: "authoritative-page-body",
        purpose: `Retrieve and date one authoritative page body for ${areaName} (after search)`,
        estimatedCostUsd: PAGE_RETRIEVAL_USD,
        cached: false,
        required: true,
      });
    }
  }

  const estimatedCostUsd = Number(
    proposedCalls.reduce((sum, row) => sum + (row.required && !row.cached ? row.estimatedCostUsd : 0), 0).toFixed(4),
  );
  const saved = loadSavedPlan(slug, serviceId, areaSlug);
  const remainingBlocker = !preflight.onePagePath
    ? preflight.blocker
    : !localReady || !editorialReady
      ? `Saved ${areaName} evidence is not READY. Local Places pack: ${localReady ? "ready" : localDetail} Editorial/descriptive pack: ${editorialReady ? "ready" : editorialDetail} Places names alone cannot mark descriptive evidence ready.`
      : null;

  return {
    slug,
    serviceId,
    areaName,
    areaSlug,
    plannedAt: new Date().toISOString(),
    cacheReuse: {
      localPackPath: localEvidencePackPath(slug, areaSlug),
      localPackPresent: Boolean(rawPack),
      localPackReady: localReady,
      localPackDetail: localDetail,
      editorialPackPath: editorialEvidencePackPath(slug, serviceId, areaSlug),
      editorialPackPresent: Boolean(editorial),
      editorialReady,
      editorialDetail,
      editorialFactCount: editorial?.facts?.length || 0,
      editorialPageCount: editorial?.retrievedPages?.length || 0,
      placesEntityCount,
    },
    missing,
    proposedCalls,
    estimatedCostUsd,
    estimatedCostLabel:
      estimatedCostUsd > 0
        ? `up to $${estimatedCostUsd.toFixed(3)} for evidence preparation (Places + DataForSEO). Page retrieval is not a paid API. OpenAI is not included until Generate.`
        : "No paid evidence calls required — saved packs can be reused.",
    providersConfigured: {
      googlePlaces: hasGooglePlacesApiKey(),
      dataForSeo: hydrateDataForSeoEnvIfNeeded().ok || isDataForSeoConfigured(),
    },
    placesNamesAreNotDescriptiveEvidence:
      "Places entity names alone must not count as descriptive local evidence. Editorial readiness requires dated retrieved page bodies and accepted facts from authoritative sources.",
    paidCollectionAuthorised: EVIDENCE_PREP_PAID_AUTHORISED,
    paidCollectionBlockedReason: EVIDENCE_PREP_PAID_AUTHORISED
      ? null
      : "Paid collection is not authorised in this step. Review providers, proposed calls and cost first. No provider calls were made.",
    remainingBlocker,
    wouldSave: [
      localEvidencePackPath(slug, areaSlug),
      editorialEvidencePackPath(slug, serviceId, areaSlug),
      planFilePath(slug, serviceId, areaSlug),
    ],
    confirmedAt: saved?.confirmedAt || null,
    executed: false,
    paidCallsMade: 0,
  };
}

export function saveOneLocalPageEvidencePreparationPlan(opts: {
  slug: string;
  serviceId: string;
  areaSlug?: string;
  confirm?: boolean;
}): { plan: LocalPageEvidencePreparationPlan; file: string } {
  const plan = planOneLocalPageEvidencePreparation(opts.slug, opts.serviceId, opts.areaSlug);
  if (opts.confirm) {
    plan.confirmedAt = new Date().toISOString();
  }
  plan.executed = false;
  plan.paidCallsMade = 0;
  const file = writeEvidencePreparationPlan(plan);
  return { plan, file };
}
