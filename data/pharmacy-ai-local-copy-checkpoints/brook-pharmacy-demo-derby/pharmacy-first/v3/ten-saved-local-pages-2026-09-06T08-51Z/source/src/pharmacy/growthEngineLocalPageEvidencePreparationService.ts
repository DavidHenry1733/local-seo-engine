/**
 * Plans evidence preparation for one selected Campaign Builder area.
 * Reuses saved caches first. Does not call Google Places, DataForSEO, or OpenAI.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEditorialEvidencePack, hydrateDataForSeoEnvIfNeeded } from "./contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { editorialEvidencePackPath } from "./contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { resolveGeographicEvidenceContext, buildDisambiguatedEvidenceQuery } from "./contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import {
  attributableEntities,
  loadPharmacyLocalEvidencePack,
  localEvidencePackPath,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import {
  DATAFORSEO_ORGANIC_LIVE_ADVANCED_RECORDED_USD,
  PAGE_RETRIEVAL_USD,
  PLACES_TEXT_SEARCH_PRO_LIST_USD,
  UK_LOCAL_PAGE_CONTENT_CONTRACT_ID,
  UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION,
  UK_LOCAL_PAGE_COST_BASIS,
  UK_LOCAL_PAGE_EVIDENCE_QUALITY_RULES,
  UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING,
  buildUkLocalPageAreaReferenceQuery,
  buildUkLocalPageEditorialSearchQueries,
  planUkLocalPageStraightLineDistance,
  ukLocalPagePlacesSearchSpecs,
  type UkLocalPageContentRole,
  type UkLocalPageDistancePlan,
} from "./contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import { isDataForSeoConfigured } from "./dataForSeoNationalSearchAdapter.ts";
import { hasGooglePlacesApiKey } from "./googlePlacesConnection.ts";
import {
  preflightOneLocalPageCandidate,
  resolveOneLocalPageCandidateArea,
} from "./growthEngineLocalPageCandidateService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";

export const PLACES_TEXT_SEARCH_USD = PLACES_TEXT_SEARCH_PRO_LIST_USD;
export const DATAFORSEO_ORGANIC_SEARCH_USD = DATAFORSEO_ORGANIC_LIVE_ADVANCED_RECORDED_USD;
export { PAGE_RETRIEVAL_USD };
export const EVIDENCE_PREP_PAID_AUTHORISED = false;

export type EvidencePreparationCall = {
  id: string;
  provider: "google-places" | "dataforseo" | "safe-html-fetch" | "local-computation";
  kind: string;
  purpose: string;
  query?: string;
  estimatedCostUsd: number;
  cached: boolean;
  required: boolean;
  contentRole: UkLocalPageContentRole;
  costVerification: string;
  safeCostBoundUsd?: number | null;
  costBoundKind?: "public-list" | "recorded-live" | "zero" | "unavailable";
};

export type EvidencePreparationGap = {
  id: string;
  layer: "local-places" | "editorial-descriptive" | "location-and-access";
  status: string;
  detail: string;
};

export type LocalPageEvidencePreparationPlan = {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  plannedAt: string;
  contentContractId: string;
  contentContractVersion: string;
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
  optionalEstimatedCostUsd: number;
  estimatedCostLabel: string;
  costBasis: typeof UK_LOCAL_PAGE_COST_BASIS;
  sourceToFieldMapping: typeof UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING;
  evidenceQualityRules: string[];
  distancePlan: UkLocalPageDistancePlan;
  providersConfigured: { googlePlaces: boolean; dataForSeo: boolean };
  placesNamesAreNotDescriptiveEvidence: string;
  paidCollectionAuthorised: boolean;
  paidCollectionBlockedReason: string | null;
  startPaidCollectionEnabled?: boolean;
  planFingerprint?: string;
  evidenceSpendingCapUsd?: number | null;
  collectionRunStatus?: string | null;
  collectionSpentUsd?: number;
  collectionOutcomeSummary?: string | null;
  verifiedGpPracticeCount?: number | null;
  editorialSufficiency?: string | null;
  collectionFindings?: string[];
  executedCalls?: Array<{
    id: string;
    provider: string;
    kind: string;
    query?: string;
    purpose?: string;
    estimatedCostUsd?: number;
    actualCostUsd?: number | null;
    status: string;
    detail?: string | null;
  }>;
  remainingBlocker: string | null;
  wouldSave: string[];
  confirmedAt: string | null;
  executed: boolean;
  paidCallsMade: number;
  areaReferenceFollowUpRequired?: boolean;
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

function loadExistingEvidenceRunLite(
  slug: string,
  serviceId: string,
  areaSlug: string,
): { calls?: Array<{ id?: string; status?: string; query?: string }> } | null {
  const root = process.env.PHARMACY_LOCAL_PAGE_EVIDENCE_TEST_ROOT || PHARMACY_WORKSPACE_ROOT;
  const file = path.join(root, "data/pharmacy-local-page-evidence-runs", slug, serviceId, "v1", `${areaSlug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as {
      calls?: Array<{ id?: string; status?: string; query?: string }>;
    };
  } catch {
    return null;
  }
}

function evidenceCallAlreadyConsumed(
  run: { calls?: Array<{ id?: string; status?: string }> } | null,
  callId: string,
): boolean {
  const row = (run?.calls || []).find((call) => String(call.id || "") === callId);
  return row?.status === "consumed" || row?.status === "skipped-cached";
}

function loadRecordedAreaReferencePoint(slug: string, areaSlug: string): { latitude: number; longitude: number } | null {
  const testRoot = process.env.PHARMACY_LOCAL_PAGE_EVIDENCE_TEST_ROOT;
  const roots = testRoot ? [testRoot] : [PHARMACY_WORKSPACE_ROOT];
  for (const root of roots) {
    const file = path.join(root, "data/pharmacy-local-page-evidence-area-reference", slug, `${areaSlug}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const doc = JSON.parse(fs.readFileSync(file, "utf8")) as {
        latitude?: number;
        longitude?: number;
        slug?: string;
        areaSlug?: string;
      };
      if (doc.slug && String(doc.slug) !== slug) continue;
      if (doc.areaSlug && String(doc.areaSlug) !== areaSlug) continue;
      const lat = Number(doc.latitude);
      const lng = Number(doc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
      return { latitude: lat, longitude: lng };
    } catch {
      continue;
    }
  }
  return null;
}

function loadProfileDisplayFields(slug: string): { displayAddress: string; postcode: string } {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return { displayAddress: "", postcode: "" };
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as {
      data?: { displayAddress?: string; postcode?: string };
    };
    return {
      displayAddress: String(doc.data?.displayAddress || "").trim(),
      postcode: String(doc.data?.postcode || "").trim(),
    };
  } catch {
    return { displayAddress: "", postcode: "" };
  }
}

export function safeCostBoundForProposedCall(call: Pick<EvidencePreparationCall, "provider">): {
  safeCostBoundUsd: number | null;
  costBoundKind: NonNullable<EvidencePreparationCall["costBoundKind"]>;
} {
  if (call.provider === "google-places") {
    return { safeCostBoundUsd: PLACES_TEXT_SEARCH_USD, costBoundKind: "public-list" };
  }
  if (call.provider === "dataforseo") {
    return { safeCostBoundUsd: DATAFORSEO_ORGANIC_SEARCH_USD, costBoundKind: "recorded-live" };
  }
  return { safeCostBoundUsd: PAGE_RETRIEVAL_USD, costBoundKind: "zero" };
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
  const testRoot = process.env.PHARMACY_LOCAL_PAGE_EVIDENCE_TEST_ROOT;
  const rawPack = testRoot ? null : loadPharmacyLocalEvidencePack(slug, areaSlug);
  const packCheck = validatePharmacyLocalEvidencePack(rawPack, {
    slug,
    areaName,
    areaSlug,
    pharmacyCoordinates: requestPlan.pharmacyCoordinates,
  });
  const editorial = testRoot ? null : loadEditorialEvidencePack(slug, serviceId, areaSlug);
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

  const geo = resolveGeographicEvidenceContext({
    slug,
    areaName,
    areaSlug,
    siblingAreaNames: requestPlan.areas.map((row) => row.areaName),
    pharmacyCoordinates: requestPlan.pharmacyCoordinates,
  });
  const profileFields = loadProfileDisplayFields(slug);
  const recordedArea = loadRecordedAreaReferencePoint(slug, areaSlug);
  const existingRun = loadExistingEvidenceRunLite(slug, serviceId, areaSlug);
  const distancePlan = planUkLocalPageStraightLineDistance({
    slug,
    areaName,
    pharmacyCoordinates: requestPlan.pharmacyCoordinates,
    areaCentroid: geo.areaCentroid || recordedArea,
    displayAddress: profileFields.displayAddress,
    postcode: profileFields.postcode || geo.pharmacyPostcode,
    queryPlaceLabel: geo.queryPlaceLabel,
    pharmacyName: requestPlan.pharmacyName,
  });

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
  if (distancePlan.areaReferenceStatus === "missing" || distancePlan.missingPremisesCoordinates) {
    missing.push({
      id: "location-and-access-reference",
      layer: "location-and-access",
      status: distancePlan.areaReferenceStatus === "missing" ? "missing-area-reference" : "missing-premises-coordinates",
      detail: distancePlan.detail,
    });
  }

  const proposedCalls: EvidencePreparationCall[] = [];
  for (const spec of ukLocalPagePlacesSearchSpecs(geo)) {
    if (spec.id === "places-area-reference") {
      if (distancePlan.areaReferenceStatus !== "missing") continue;
      proposedCalls.push({
        id: spec.id,
        provider: "google-places",
        kind: "places-text-search",
        purpose: `Recorded area reference point for ${areaName}; not an organisation inventory`,
        query: buildUkLocalPageAreaReferenceQuery(geo),
        estimatedCostUsd: PLACES_TEXT_SEARCH_USD,
        cached: false,
        required: spec.required,
        contentRole: spec.contentRole,
        costVerification: UK_LOCAL_PAGE_COST_BASIS.googlePlaces.verification,
      });
      continue;
    }
    if (localReady || evidenceCallAlreadyConsumed(existingRun, spec.id)) continue;
    proposedCalls.push({
      id: spec.id,
      provider: "google-places",
      kind: "places-text-search",
      purpose: `Verified GP practices in or around ${areaName} (up to three after official-source checks)`,
      query: buildDisambiguatedEvidenceQuery(spec.phrase, geo),
      estimatedCostUsd: PLACES_TEXT_SEARCH_USD,
      cached: false,
      required: spec.required,
      contentRole: spec.contentRole,
      costVerification: UK_LOCAL_PAGE_COST_BASIS.googlePlaces.verification,
    });
  }
  if (!editorialReady) {
    for (const row of buildUkLocalPageEditorialSearchQueries(geo)) {
      if (evidenceCallAlreadyConsumed(existingRun, `dataforseo-${row.topic}`)) continue;
      proposedCalls.push({
        id: `dataforseo-${row.topic}`,
        provider: "dataforseo",
        kind: "google-organic-live",
        purpose:
          row.topic === "official-gp-practices"
            ? `Official NHS/GP sources to verify practice identity and address for ${areaName}`
            : `Meaningful descriptive locality information for ${areaName}; one search only`,
        query: row.query,
        estimatedCostUsd: DATAFORSEO_ORGANIC_SEARCH_USD,
        cached: false,
        required: row.required,
        contentRole: row.contentRole,
        costVerification: UK_LOCAL_PAGE_COST_BASIS.dataForSeo.verification,
      });
    }
    if (!evidenceCallAlreadyConsumed(existingRun, "page-body-gp-official")) {
      proposedCalls.push({
        id: "page-body-gp-official",
        provider: "safe-html-fetch",
        kind: "authoritative-page-body",
        purpose: `Retrieve dated official GP/NHS page body for ${areaName}. Search snippets are not factual support.`,
        estimatedCostUsd: PAGE_RETRIEVAL_USD,
        cached: false,
        required: true,
        contentRole: "local-primary-care",
        costVerification: UK_LOCAL_PAGE_COST_BASIS.pageRetrieval.verification,
      });
    }
    if (!evidenceCallAlreadyConsumed(existingRun, "page-body-locality")) {
      proposedCalls.push({
        id: "page-body-locality",
        provider: "safe-html-fetch",
        kind: "authoritative-page-body",
        purpose: `Retrieve dated official locality page body for ${areaName}. Historical and current information must be distinguished; uncertain statistics omitted.`,
        estimatedCostUsd: PAGE_RETRIEVAL_USD,
        cached: false,
        required: true,
        contentRole: "recognisable-local-context",
        costVerification: UK_LOCAL_PAGE_COST_BASIS.pageRetrieval.verification,
      });
    }
  }
  proposedCalls.push({
    id: "distance-haversine",
    provider: "local-computation",
    kind: "straight-line-distance",
    purpose: distancePlan.detail,
    estimatedCostUsd: 0,
    cached: distancePlan.areaReferenceStatus === "recorded" && !distancePlan.missingPremisesCoordinates,
    required: true,
    contentRole: "location-and-access",
    costVerification: UK_LOCAL_PAGE_COST_BASIS.distance.verification,
  });
  for (const row of proposedCalls) {
    const bound = safeCostBoundForProposedCall(row);
    row.safeCostBoundUsd = bound.safeCostBoundUsd;
    row.costBoundKind = bound.costBoundKind;
  }

  const estimatedCostUsd = Number(
    proposedCalls.reduce((sum, row) => sum + (row.required && !row.cached ? row.estimatedCostUsd : 0), 0).toFixed(4),
  );
  const optionalEstimatedCostUsd = Number(
    proposedCalls.reduce((sum, row) => sum + (!row.required && !row.cached ? row.estimatedCostUsd : 0), 0).toFixed(4),
  );
  const saved = loadSavedPlan(slug, serviceId, areaSlug);
  const remainingBlocker = !preflight.onePagePath
    ? preflight.blocker
    : !localReady || !editorialReady
      ? `Saved ${areaName} evidence is not READY. Local Places pack: ${localReady ? "ready" : localDetail} Editorial/descriptive pack: ${editorialReady ? "ready" : editorialDetail} Places names alone cannot mark descriptive evidence ready.${distancePlan.originWarning ? ` ${distancePlan.originWarning}` : ""}`
      : distancePlan.missingPremisesCoordinates || distancePlan.areaReferenceStatus === "missing"
        ? distancePlan.detail
        : null;

  const costNote =
    estimatedCostUsd > 0
      ? `Required evidence preparation is about $${estimatedCostUsd.toFixed(3)} at documented list/recorded rates (Places Text Search Pro $${PLACES_TEXT_SEARCH_USD.toFixed(3)}/call if billed; DataForSEO organic live advanced $${DATAFORSEO_ORGANIC_SEARCH_USD.toFixed(3)}/search from recorded live costs). Remaining Google monthly free Pro quota is unverified. Optional extra searches are not proposed. Page retrieval and distance calculation are not paid APIs. OpenAI is not included until Generate.`
      : "No paid evidence calls required — saved packs can be reused.";

  return {
    slug,
    serviceId,
    areaName,
    areaSlug,
    plannedAt: new Date().toISOString(),
    contentContractId: UK_LOCAL_PAGE_CONTENT_CONTRACT_ID,
    contentContractVersion: UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION,
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
    optionalEstimatedCostUsd,
    estimatedCostLabel: costNote,
    costBasis: UK_LOCAL_PAGE_COST_BASIS,
    sourceToFieldMapping: UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING,
    evidenceQualityRules: UK_LOCAL_PAGE_EVIDENCE_QUALITY_RULES,
    distancePlan,
    providersConfigured: {
      googlePlaces: hasGooglePlacesApiKey(),
      dataForSeo: hydrateDataForSeoEnvIfNeeded().ok || isDataForSeoConfigured(),
    },
    placesNamesAreNotDescriptiveEvidence:
      "Places entity names alone must not count as descriptive local evidence. Editorial readiness requires dated retrieved page bodies and accepted facts from authoritative sources. Search snippets are not factual support.",
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
