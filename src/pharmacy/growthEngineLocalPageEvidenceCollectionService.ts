/**
 * User-authorised one-local-page evidence collection.
 * Reuses existing Places, DataForSEO and page-body adapters.
 * Evidence spend is stored separately from the OpenAI generation budget.
 * Does not flip EVIDENCE_PREP_PAID_AUTHORISED.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { searchNationalGoogleOrganic } from "./dataForSeoNationalSearchAdapter.ts";
import { fetchSafeHtmlEvidencePage } from "./nationalCompetitorEvidenceEnrichmentService.ts";
import { searchGooglePlacesTextForLocalEvidence } from "./pharmacyLocalRelevancePackService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { isOneLocalPageCandidateArea } from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import {
  EDITORIAL_EVIDENCE_CONTRACT_ID,
  EDITORIAL_EVIDENCE_VERSION,
  assessUkLocalPageEditorialSufficiency,
  canonicalPharmacyFacts,
  classifyEditorialSource,
  editorialEvidencePackPath,
  extractEditorialFactDrafts,
  factIdFor,
  hostFromUrl,
  looksLikeRawCopiedPassage,
  isCustomerAppropriateOrganisationName,
  officialGpPracticeNamesFromRetrievedPages,
  placesEntityNormalizedStatement,
  healthcareEntityIsOfficiallySupported,
  unsupportedInferencesIn,
  type EditorialEvidencePackV3,
  type EditorialFactV3,
  type EditorialRetrievedPageV3,
  type EditorialSearchRecordV3,
} from "./contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import {
  attributableEntities,
  attributeEntityToArea,
  buildEvidencePackFromAttributedEntities,
  classifyRequestedEvidenceCategory,
  emptyEvidencePack,
  entityIdentityKey,
  loadPharmacyLocalEvidencePack,
  localEvidencePackPath,
  planPharmacyLocalEvidenceRequest,
  recordedPharmacyRelationshipFromDistance,
  writePharmacyLocalEvidencePack,
  type LocalEvidenceEntity,
  type PharmacyLocalEvidencePackV3,
  type RejectedLocalEvidenceEntity,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import {
  resolveGeographicEvidenceContext,
  type GeographicEvidenceContext,
} from "./contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { resolveCanonicalPharmacyName } from "./pharmacyServicePageProfileContext.ts";
import {
  DATAFORSEO_ORGANIC_LIVE_ADVANCED_RECORDED_USD,
  PAGE_RETRIEVAL_USD,
  PLACES_TEXT_SEARCH_PRO_LIST_USD,
  planUkLocalPageStraightLineDistance,
  premisesAddressLooksUnverified,
  resolveUkLocalPagePlacesAreaReference,
  type UkLocalPageDistancePlan,
} from "./contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import {
  planOneLocalPageEvidencePreparation,
  type EvidencePreparationCall,
  type LocalPageEvidencePreparationPlan,
} from "./growthEngineLocalPageEvidencePreparationService.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";

export const EVIDENCE_AUTHORISATION_KIND = "local-page-evidence-authorisation-v1";
export const EVIDENCE_BUDGET_KIND = "evidence-only";
export const INTERRUPTED_COLLECTION_FIXTURE = "INTERRUPTED_COLLECTION_FIXTURE";

export type EvidenceCallOutcomeStatus =
  | "pending"
  | "reserved"
  | "consumed"
  | "skipped-cached"
  | "skipped-blocked"
  | "stopped-budget"
  | "stopped-uncertain"
  | "stopped-no-bound";

export type EvidenceCollectionRunStatus =
  | "authorised"
  | "running"
  | "interrupted"
  | "completed"
  | "stopped";

export type EvidencePlacesHit = {
  name: string;
  address?: string;
  types?: string[];
  location?: { latitude: number; longitude: number } | null;
  placeId?: string;
  locality?: string;
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
  sourceRef?: string;
};

export type EvidenceOrganicSearchResult = {
  query: string;
  capturedAt: string;
  costUsd: number | null;
  uncertain?: boolean;
  results: Array<{ url: string; title: string; description: string }>;
};

export type EvidencePageBodyResult = {
  url: string;
  title: string | null;
  status: number | null;
  textSample: string | null;
  retrievedAt: string;
};

export type EvidenceCollectionAdapters = {
  placesSearch?: (
    query: string,
    geo: GeographicEvidenceContext,
    maxResultCount: number,
    callId?: string,
  ) => Promise<{ hits: EvidencePlacesHit[]; costUsd: number | null; uncertain?: boolean; detail?: string }>;
  organicSearch?: (query: string) => Promise<EvidenceOrganicSearchResult>;
  fetchPage?: (url: string) => Promise<EvidencePageBodyResult>;
  afterCall?: (callId: string, run: LocalPageEvidenceRun) => void | Promise<void>;
};

export type LocalPageEvidenceAuthorisation = {
  kind: typeof EVIDENCE_AUTHORISATION_KIND;
  slug: string;
  serviceId: string;
  areaSlug: string;
  areaName: string;
  planFingerprint: string;
  contentContractId: string;
  contentContractVersion: string;
  spendingCapUsd: number;
  authorisedAt: string;
  authorisedBy: string;
  callIds: string[];
  status: "authorised";
  budgetKind: typeof EVIDENCE_BUDGET_KIND;
};

export type LocalPageEvidenceCallRecord = {
  id: string;
  provider: EvidencePreparationCall["provider"];
  kind: string;
  query?: string;
  required: boolean;
  safeCostBoundUsd: number | null;
  costBoundKind: "public-list" | "recorded-live" | "zero" | "unavailable";
  status: EvidenceCallOutcomeStatus;
  reservedUsd: number;
  actualCostUsd: number | null;
  reservationId: string | null;
  detail: string | null;
  capturedAt: string | null;
};

export type LocalPageEvidenceBudget = {
  kind: typeof EVIDENCE_BUDGET_KIND;
  slug: string;
  serviceId: string;
  areaSlug: string;
  runId: string;
  spendingCapUsd: number;
  spentUsd: number;
  reservedUsd: number;
  events: Array<{ at: string; kind: string; callId?: string; detail: string; usd?: number }>;
};

export type LocalPageEvidenceRun = {
  kind: "local-page-evidence-run-v1";
  runId: string;
  slug: string;
  serviceId: string;
  areaSlug: string;
  areaName: string;
  planFingerprint: string;
  spendingCapUsd: number;
  status: EvidenceCollectionRunStatus;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  spentUsd: number;
  reservedUsd: number;
  paidCallsMade: number;
  stopReason: string | null;
  calls: LocalPageEvidenceCallRecord[];
  placesHitsByCall: Record<string, EvidencePlacesHit[]>;
  organicByCall: Record<string, EvidenceOrganicSearchResult>;
  pagesByCall: Record<string, EvidencePageBodyResult>;
  areaReferencePoint: { latitude: number; longitude: number; source: string } | null;
  distanceKm: number | null;
  verifiedGpPracticeCount: number;
  findings: string[];
  localPackPath: string | null;
  editorialPackPath: string | null;
  editorialSufficiency: string | null;
  outcomeSummary: string | null;
  reprocessedAt: string | null;
};

type TestHarness = {
  liveProvidersForbidden: boolean;
  adapters: EvidenceCollectionAdapters | null;
  storageRoot: string | null;
  persistPacks: boolean;
  allowLiveProviders: boolean;
};

const harness: TestHarness = {
  liveProvidersForbidden: false,
  adapters: null,
  storageRoot: null,
  persistPacks: true,
  allowLiveProviders: false,
};

export function setEvidenceCollectionTestHarness(next: Partial<TestHarness>): void {
  Object.assign(harness, next);
}

export function resetEvidenceCollectionTestHarness(): void {
  harness.liveProvidersForbidden = false;
  harness.adapters = null;
  harness.storageRoot = null;
  harness.persistPacks = true;
  harness.allowLiveProviders = false;
}

function workspaceRoot(): string {
  return harness.storageRoot || PHARMACY_WORKSPACE_ROOT;
}

function evidenceDir(kind: "authorisations" | "runs" | "budget" | "area-reference", slug: string, serviceId: string): string {
  return path.join(workspaceRoot(), `data/pharmacy-local-page-evidence-${kind}`, slug, serviceId, "v1");
}

export function evidenceAuthorisationPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(evidenceDir("authorisations", slug, serviceId), `${areaSlug}.json`);
}

export function evidenceRunPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(evidenceDir("runs", slug, serviceId), `${areaSlug}.json`);
}

export function evidenceBudgetPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(evidenceDir("budget", slug, serviceId), `${areaSlug}.json`);
}

export function recordedAreaReferencePath(slug: string, areaSlug: string): string {
  return path.join(workspaceRoot(), "data/pharmacy-local-page-evidence-area-reference", slug, `${areaSlug}.json`);
}


function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function withFileLock<T>(file: string, fn: () => Promise<T> | T): Promise<T> {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const started = Date.now();
  while (true) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
      break;
    } catch {
      if (Date.now() - started > 8000) throw new Error("evidence-collection-lock-timeout");
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(lock);
    } catch {
      /* ignore */
    }
  }
}

export function safeCostBoundForCall(call: Pick<EvidencePreparationCall, "provider" | "estimatedCostUsd">): {
  boundUsd: number | null;
  kind: LocalPageEvidenceCallRecord["costBoundKind"];
} {
  if (call.provider === "google-places") {
    return { boundUsd: PLACES_TEXT_SEARCH_PRO_LIST_USD, kind: "public-list" };
  }
  if (call.provider === "dataforseo") {
    return { boundUsd: DATAFORSEO_ORGANIC_LIVE_ADVANCED_RECORDED_USD, kind: "recorded-live" };
  }
  if (call.provider === "safe-html-fetch" || call.provider === "local-computation") {
    return { boundUsd: PAGE_RETRIEVAL_USD, kind: "zero" };
  }
  if (Number.isFinite(call.estimatedCostUsd) && call.estimatedCostUsd === 0) {
    return { boundUsd: 0, kind: "zero" };
  }
  return { boundUsd: null, kind: "unavailable" };
}

export function fingerprintLocalPageEvidencePlan(plan: LocalPageEvidencePreparationPlan): string {
  const payload = {
    slug: plan.slug,
    serviceId: plan.serviceId,
    areaSlug: plan.areaSlug,
    contentContractId: plan.contentContractId,
    contentContractVersion: plan.contentContractVersion,
    calls: plan.proposedCalls.map((row) => ({
      id: row.id,
      provider: row.provider,
      kind: row.kind,
      query: row.query || "",
      estimatedCostUsd: row.estimatedCostUsd,
      required: row.required,
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function loadEvidenceAuthorisation(
  slug: string,
  serviceId: string,
  areaSlug: string,
): LocalPageEvidenceAuthorisation | null {
  return readJson<LocalPageEvidenceAuthorisation>(evidenceAuthorisationPath(slug, serviceId, areaSlug));
}

export function loadEvidenceRun(slug: string, serviceId: string, areaSlug: string): LocalPageEvidenceRun | null {
  return readJson<LocalPageEvidenceRun>(evidenceRunPath(slug, serviceId, areaSlug));
}

export function areaReferenceFollowUpRequired(
  run: LocalPageEvidenceRun | null | undefined,
  plan: LocalPageEvidencePreparationPlan,
): boolean {
  if (!run || run.slug !== plan.slug || run.serviceId !== plan.serviceId || run.areaSlug !== plan.areaSlug) {
    return false;
  }
  const recorded = loadRecordedAreaReference(plan.slug, plan.areaSlug);
  if (recorded || finiteSavedPoint(run.areaReferencePoint, run.areaReferencePoint?.source || "evidence-run")) {
    return false;
  }
  const proposed = plan.proposedCalls.find((row) => row.id === "places-area-reference" && row.cached !== true);
  if (!proposed) return false;
  const executed = (run.calls || []).find((row) => row.id === "places-area-reference");
  if (!executed) return true;
  return String(executed.query || "") !== String(proposed.query || "") || executed.status !== "consumed";
}

export function uncachedPaidEvidenceFollowUpRequired(
  run: LocalPageEvidenceRun | null | undefined,
  plan: LocalPageEvidencePreparationPlan,
): boolean {
  if (areaReferenceFollowUpRequired(run, plan)) return true;
  if (!run || run.status !== "completed") return false;
  if (run.slug !== plan.slug || run.serviceId !== plan.serviceId || run.areaSlug !== plan.areaSlug) return false;
  return (plan.proposedCalls || []).some((row) => {
    if (row.cached) return false;
    if (!(Number(row.estimatedCostUsd || 0) > 0)) return false;
    const executed = (run.calls || []).find((call) => call.id === row.id);
    if (!executed) return true;
    return executed.status !== "consumed" && executed.status !== "skipped-cached";
  });
}

export function loadEvidenceBudget(slug: string, serviceId: string, areaSlug: string): LocalPageEvidenceBudget | null {
  return readJson<LocalPageEvidenceBudget>(evidenceBudgetPath(slug, serviceId, areaSlug));
}

export function loadRecordedAreaReference(
  slug: string,
  areaSlug: string,
): { latitude: number; longitude: number; source: string } | null {
  return readRecordedAreaFile(recordedAreaReferencePath(slug, areaSlug), { slug, areaSlug });
}

function readRecordedAreaFile(
  file: string,
  expected?: { slug: string; areaSlug: string },
): { latitude: number; longitude: number; source: string } | null {
  const doc = readJson<{ slug?: string; areaSlug?: string; latitude?: number; longitude?: number; source?: string }>(file);
  if (!doc) return null;
  if (expected?.slug && doc.slug && String(doc.slug) !== expected.slug) return null;
  if (expected?.areaSlug && doc.areaSlug && String(doc.areaSlug) !== expected.areaSlug) return null;
  const lat = Number(doc.latitude);
  const lng = Number(doc.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { latitude: lat, longitude: lng, source: String(doc.source || "places-area-reference") };
}

export type SavedLocalPageDistanceEndpoint = {
  latitude: number;
  longitude: number;
  source: string;
};

export type SavedLocalPageDistanceInspection = {
  slug: string;
  serviceId: string;
  areaSlug: string;
  pharmacy: SavedLocalPageDistanceEndpoint | null;
  area: SavedLocalPageDistanceEndpoint | null;
  pharmacySourceKind: "area-local-pack" | "canonical-profile" | "missing";
  areaSourceKind: "evidence-run" | "recorded-area-reference" | "saved-places-hits" | "missing";
  areaReferenceResolution: "recorded" | "missing" | "ambiguous" | "wrong-area" | "unsupported" | "zero-results";
};

function finiteSavedPoint(
  value: { latitude?: number; longitude?: number; source?: string } | null | undefined,
  source: string,
): SavedLocalPageDistanceEndpoint | null {
  const lat = Number(value?.latitude);
  const lng = Number(value?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { latitude: lat, longitude: lng, source: String(value?.source || source) };
}

/** Endpoints for the reusable straight-line distance. Never reads another area’s recorded reference. */
export function inspectSavedLocalPageDistanceEndpoints(
  slug: string,
  serviceId: string,
  areaSlug: string,
): SavedLocalPageDistanceInspection {
  const pack = loadPharmacyLocalEvidencePack(slug, areaSlug) as
    | { pharmacyCoordinates?: { latitude?: number; longitude?: number; source?: string }; area?: string }
    | null;
  const fromPack = finiteSavedPoint(pack?.pharmacyCoordinates, pack?.pharmacyCoordinates?.source || "area-local-pack");
  const request = planPharmacyLocalEvidenceRequest(slug, serviceId);
  const fromProfile = finiteSavedPoint(
    request.pharmacyCoordinates,
    request.pharmacyCoordinates?.source || "canonical-pharmacy-coordinates",
  );
  const pharmacy = fromPack || fromProfile;
  const run = loadEvidenceRun(slug, serviceId, areaSlug);
  const fromRun = finiteSavedPoint(run?.areaReferencePoint, run?.areaReferencePoint?.source || "evidence-run");
  const fromRecorded = loadRecordedAreaReference(slug, areaSlug);
  const persisted = fromRun || fromRecorded;
  if (persisted) {
    return {
      slug,
      serviceId,
      areaSlug,
      pharmacy,
      area: persisted,
      pharmacySourceKind: fromPack ? "area-local-pack" : fromProfile ? "canonical-profile" : "missing",
      areaSourceKind: fromRun ? "evidence-run" : "recorded-area-reference",
      areaReferenceResolution: "recorded",
    };
  }
  const hits = run?.placesHitsByCall?.["places-area-reference"];
  const areaName =
    request.areas.find((row) => slugifyArea(row.areaName) === areaSlug)?.areaName ||
    String(run?.areaName || pack?.area || "").trim();
  const geo = resolveGeographicEvidenceContext({
    slug,
    areaName: areaName || areaSlug,
    areaSlug,
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: request.pharmacyCoordinates,
  });
  const resolved = resolveUkLocalPagePlacesAreaReference({
    areaName: areaName || areaSlug,
    county: geo.county,
    countryCode: geo.countryCode,
    siblingAreaNames: geo.siblingAreaNames,
    pharmacyCityHint: geo.parentTown,
    hits,
  });
  if (resolved.ok) {
    return {
      slug,
      serviceId,
      areaSlug,
      pharmacy,
      area: {
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        source: resolved.source,
      },
      pharmacySourceKind: fromPack ? "area-local-pack" : fromProfile ? "canonical-profile" : "missing",
      areaSourceKind: "saved-places-hits",
      areaReferenceResolution: "recorded",
    };
  }
  return {
    slug,
    serviceId,
    areaSlug,
    pharmacy,
    area: null,
    pharmacySourceKind: fromPack ? "area-local-pack" : fromProfile ? "canonical-profile" : "missing",
    areaSourceKind: "missing",
    areaReferenceResolution: hits?.length ? resolved.reason : "missing",
  };
}

export function planSavedLocalPageStraightLineDistance(
  slug: string,
  serviceId: string,
  areaName: string,
  areaSlug: string,
): UkLocalPageDistancePlan {
  const endpoints = inspectSavedLocalPageDistanceEndpoints(slug, serviceId, areaSlug);
  const identity = loadPharmacyIdentity(slug);
  return planUkLocalPageStraightLineDistance({
    slug,
    areaName,
    pharmacyCoordinates: endpoints.pharmacy,
    areaCentroid: endpoints.area,
    pharmacyName: identity.name,
  });
}

export function applySavedLocalPageStraightLineDistanceFromEvidence(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
}):
  | { ok: true; applied: true; distanceKm: number; plan: UkLocalPageDistancePlan; endpoints: SavedLocalPageDistanceInspection }
  | { ok: false; applied: false; error: string; plan: UkLocalPageDistancePlan; endpoints: SavedLocalPageDistanceInspection } {
  const endpoints = inspectSavedLocalPageDistanceEndpoints(opts.slug, opts.serviceId, opts.areaSlug);
  const plan = planUkLocalPageStraightLineDistance({
    slug: opts.slug,
    areaName: opts.areaName,
    pharmacyCoordinates: endpoints.pharmacy,
    areaCentroid: endpoints.area,
  });
  if (!endpoints.pharmacy || !endpoints.area || plan.distanceKm == null) {
    return {
      ok: false,
      applied: false,
      error:
        plan.detail ||
        `Saved ${opts.areaName} evidence is missing a pharmacy or area endpoint. Straight-line distance stays unstated.`,
      plan,
      endpoints,
    };
  }
  persistAreaReference(opts.slug, opts.areaSlug, {
    latitude: endpoints.area.latitude,
    longitude: endpoints.area.longitude,
    source: endpoints.area.source,
  });
  const run = loadEvidenceRun(opts.slug, opts.serviceId, opts.areaSlug);
  if (run && run.slug === opts.slug && run.areaSlug === opts.areaSlug) {
    run.areaReferencePoint = {
      latitude: endpoints.area.latitude,
      longitude: endpoints.area.longitude,
      source: endpoints.area.source,
    };
    run.distanceKm = plan.distanceKm;
    const distanceCall = run.calls.find((row) => row.id === "distance-haversine");
    if (distanceCall && distanceCall.status !== "consumed") {
      distanceCall.status = "consumed";
      distanceCall.actualCostUsd = 0;
      distanceCall.detail = `Approximate straight-line distance ${plan.distanceKm} km. Not a driving time.`;
      distanceCall.capturedAt = distanceCall.capturedAt || new Date().toISOString();
    }
    const budget = loadEvidenceBudget(opts.slug, opts.serviceId, opts.areaSlug) || {
      kind: EVIDENCE_BUDGET_KIND,
      slug: run.slug,
      serviceId: run.serviceId,
      areaSlug: run.areaSlug,
      runId: run.runId,
      spendingCapUsd: run.spendingCapUsd,
      spentUsd: run.spentUsd,
      reservedUsd: 0,
      events: [],
    };
    finaliseRun(run, budget, planOneLocalPageEvidencePreparation(opts.slug, opts.serviceId, opts.areaSlug));
  }
  return { ok: true, applied: true, distanceKm: plan.distanceKm, plan, endpoints };
}

function saveAuthorisation(doc: LocalPageEvidenceAuthorisation): void {
  writeJson(evidenceAuthorisationPath(doc.slug, doc.serviceId, doc.areaSlug), doc);
}

function saveRun(run: LocalPageEvidenceRun): void {
  run.updatedAt = new Date().toISOString();
  writeJson(evidenceRunPath(run.slug, run.serviceId, run.areaSlug), run);
}

function saveBudget(doc: LocalPageEvidenceBudget): void {
  writeJson(evidenceBudgetPath(doc.slug, doc.serviceId, doc.areaSlug), doc);
}

function emptyBudget(opts: {
  slug: string;
  serviceId: string;
  areaSlug: string;
  runId: string;
  spendingCapUsd: number;
}): LocalPageEvidenceBudget {
  return {
    kind: EVIDENCE_BUDGET_KIND,
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaSlug: opts.areaSlug,
    runId: opts.runId,
    spendingCapUsd: opts.spendingCapUsd,
    spentUsd: 0,
    reservedUsd: 0,
    events: [{ at: new Date().toISOString(), kind: "created", detail: `cap=${opts.spendingCapUsd}` }],
  };
}

function remainingBudgetUsd(budget: LocalPageEvidenceBudget): number {
  return Number((budget.spendingCapUsd - budget.spentUsd - budget.reservedUsd).toFixed(6));
}

export function decorateLocalPageEvidencePlan(plan: LocalPageEvidencePreparationPlan): LocalPageEvidencePreparationPlan {
  const fingerprint = fingerprintLocalPageEvidencePlan(plan);
  const auth = loadEvidenceAuthorisation(plan.slug, plan.serviceId, plan.areaSlug);
  const run = loadEvidenceRun(plan.slug, plan.serviceId, plan.areaSlug);
  const fingerprintMatches = Boolean(auth && auth.planFingerprint === fingerprint);
  const authorised = fingerprintMatches && auth?.status === "authorised";
  const followUp = uncachedPaidEvidenceFollowUpRequired(run, plan);
  let startEnabled = Boolean(authorised && run?.status !== "completed" && run?.status !== "stopped");
  if (followUp && authorised && run?.status === "completed") startEnabled = true;
  if (run?.status === "running") startEnabled = false;
  let blocked = plan.paidCollectionBlockedReason;
  if (run?.status === "completed" && followUp) {
    blocked = authorised
      ? null
      : `A verified ${plan.areaName} area reference was not recorded. Review the ${plan.areaName}-specific provider request, enter an evidence-only cap, and authorise this exact plan. Previous evidence spend is preserved.`;
  } else if (run?.status === "completed") {
    blocked =
      run.outcomeSummary ||
      `Collection completed. Actual evidence spend $${(run.spentUsd || 0).toFixed(3)}.`;
  } else if (run?.status === "stopped") {
    blocked = run.stopReason || "Collection stopped before further paid calls.";
  } else if (run?.status === "interrupted") {
    blocked = "Collection was interrupted. Start paid collection again to resume remaining unused calls.";
  } else if (!authorised) {
    blocked =
      "Paid collection starts only after you enter an evidence-only spending cap and authorise this exact plan. The OpenAI generation budget is separate. No provider calls have been made.";
  } else {
    blocked = null;
  }
  return {
    ...plan,
    planFingerprint: fingerprint,
    evidenceSpendingCapUsd: fingerprintMatches ? auth?.spendingCapUsd ?? null : null,
    paidCollectionAuthorised: Boolean(authorised),
    paidCollectionBlockedReason: blocked,
    startPaidCollectionEnabled: Boolean(startEnabled),
    collectionRunStatus: run?.status || null,
    collectionSpentUsd: run?.spentUsd ?? 0,
    collectionOutcomeSummary: run?.outcomeSummary || (run?.findings || []).join(" ") || null,
    verifiedGpPracticeCount: run?.verifiedGpPracticeCount ?? null,
    editorialSufficiency: run?.editorialSufficiency || null,
    collectionFindings: run?.findings || [],
    executedCalls: (run?.calls || []).map((row) => ({
      id: row.id,
      provider: row.provider,
      kind: row.kind,
      query: row.query,
      purpose: row.detail || row.query || row.id,
      estimatedCostUsd: row.actualCostUsd ?? row.safeCostBoundUsd ?? 0,
      actualCostUsd: row.actualCostUsd,
      status: row.status,
      detail: row.detail,
    })),
    executed: run?.status === "completed" && !followUp,
    paidCallsMade: run?.paidCallsMade || 0,
    areaReferenceFollowUpRequired: followUp,
  };
}

export function authoriseLocalPageEvidencePlan(opts: {
  slug: string;
  serviceId: string;
  areaSlug?: string;
  spendingCapUsd: number;
  confirmAuthorise: boolean;
  planFingerprint?: string;
  authorisedBy?: string;
}): { ok: true; authorisation: LocalPageEvidenceAuthorisation; plan: LocalPageEvidencePreparationPlan } | { ok: false; error: string; status: number } {
  if (opts.confirmAuthorise !== true) {
    return { ok: false, status: 403, error: "Explicit authorisation is required for this exact plan. No provider calls were made." };
  }
  const cap = Number(opts.spendingCapUsd);
  if (!Number.isFinite(cap) || cap <= 0) {
    return { ok: false, status: 400, error: "Enter a positive evidence-only spending cap. This is separate from the AI generation budget." };
  }
  const plan = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(opts.slug, opts.serviceId, opts.areaSlug));
  if (!isOneLocalPageCandidateArea(plan.slug, plan.areaSlug)) {
    return { ok: false, status: 403, error: "This area is not on the one-local-page evidence path." };
  }
  const fingerprint = plan.planFingerprint || fingerprintLocalPageEvidencePlan(plan);
  if (opts.planFingerprint && opts.planFingerprint !== fingerprint) {
    return { ok: false, status: 409, error: "The saved plan has changed. Review the current providers, calls and pricing uncertainty, then authorise again." };
  }
  const authorisation: LocalPageEvidenceAuthorisation = {
    kind: EVIDENCE_AUTHORISATION_KIND,
    slug: plan.slug,
    serviceId: plan.serviceId,
    areaSlug: plan.areaSlug,
    areaName: plan.areaName,
    planFingerprint: fingerprint,
    contentContractId: plan.contentContractId,
    contentContractVersion: plan.contentContractVersion,
    spendingCapUsd: Number(cap.toFixed(4)),
    authorisedAt: new Date().toISOString(),
    authorisedBy: String(opts.authorisedBy || "authenticated-user"),
    callIds: plan.proposedCalls.map((row) => row.id),
    status: "authorised",
    budgetKind: EVIDENCE_BUDGET_KIND,
  };
  saveAuthorisation(authorisation);
  return { ok: true, authorisation, plan: decorateLocalPageEvidencePlan(plan) };
}

function callRecordFromProposed(row: EvidencePreparationCall): LocalPageEvidenceCallRecord {
  const bound = safeCostBoundForCall(row);
  return {
    id: row.id,
    provider: row.provider,
    kind: row.kind,
    query: row.query,
    required: row.required,
    safeCostBoundUsd: bound.boundUsd,
    costBoundKind: bound.kind,
    status: row.cached ? "skipped-cached" : "pending",
    reservedUsd: 0,
    actualCostUsd: null,
    reservationId: null,
    detail: row.cached ? "Reused saved cache; no provider call." : null,
    capturedAt: null,
  };
}

function newRunFromPlan(plan: LocalPageEvidencePreparationPlan, auth: LocalPageEvidenceAuthorisation): LocalPageEvidenceRun {
  return {
    kind: "local-page-evidence-run-v1",
    runId: randomUUID(),
    slug: plan.slug,
    serviceId: plan.serviceId,
    areaSlug: plan.areaSlug,
    areaName: plan.areaName,
    planFingerprint: auth.planFingerprint,
    spendingCapUsd: auth.spendingCapUsd,
    status: "authorised",
    startedAt: null,
    updatedAt: new Date().toISOString(),
    completedAt: null,
    spentUsd: 0,
    reservedUsd: 0,
    paidCallsMade: 0,
    stopReason: null,
    calls: plan.proposedCalls.map((row) => callRecordFromProposed(row)),
    placesHitsByCall: {},
    organicByCall: {},
    pagesByCall: {},
    areaReferencePoint: loadRecordedAreaReference(plan.slug, plan.areaSlug),
    distanceKm: null,
    verifiedGpPracticeCount: 0,
    findings: [],
    localPackPath: null,
    editorialPackPath: null,
    editorialSufficiency: null,
    outcomeSummary: null,
    reprocessedAt: null,
  };
}

function reopenUncachedCallsOnExistingRun(
  run: LocalPageEvidenceRun,
  plan: LocalPageEvidencePreparationPlan,
  auth: LocalPageEvidenceAuthorisation,
): LocalPageEvidenceRun {
  run.planFingerprint = auth.planFingerprint;
  if (auth.spendingCapUsd >= run.spentUsd) {
    run.spendingCapUsd = auth.spendingCapUsd;
  }
  run.status = "authorised";
  run.completedAt = null;
  run.stopReason = null;
  run.updatedAt = new Date().toISOString();
  for (const proposed of plan.proposedCalls) {
    if (proposed.cached) continue;
    const existingCall = run.calls.find((row) => row.id === proposed.id);
    if (existingCall) {
      existingCall.query = proposed.query;
      existingCall.required = proposed.required;
      existingCall.status = "pending";
      existingCall.detail = null;
      existingCall.actualCostUsd = null;
      existingCall.capturedAt = null;
      existingCall.reservationId = null;
      existingCall.reservedUsd = 0;
      const bound = safeCostBoundForCall(proposed);
      existingCall.safeCostBoundUsd = bound.boundUsd;
      existingCall.costBoundKind = bound.kind;
    } else {
      run.calls.push(callRecordFromProposed(proposed));
    }
  }
  return run;
}

function reserveCall(budget: LocalPageEvidenceBudget, call: LocalPageEvidenceCallRecord): { ok: true } | { ok: false; reason: string } {
  if (call.safeCostBoundUsd == null) {
    return {
      ok: false,
      reason: `No safe cost bound is available for ${call.id} (${call.provider}). Collection stopped before the call.`,
    };
  }
  const remaining = remainingBudgetUsd(budget);
  if (call.safeCostBoundUsd > remaining + 1e-9) {
    return {
      ok: false,
      reason: `${call.id} needs a $${call.safeCostBoundUsd.toFixed(3)} cost bound, but only $${Math.max(0, remaining).toFixed(3)} remains on the evidence-only cap of $${budget.spendingCapUsd.toFixed(3)}. The call was not made.`,
    };
  }
  call.status = "reserved";
  call.reservedUsd = call.safeCostBoundUsd;
  call.reservationId = randomUUID();
  budget.reservedUsd = Number((budget.reservedUsd + call.safeCostBoundUsd).toFixed(6));
  budget.events.push({
    at: new Date().toISOString(),
    kind: "reserved",
    callId: call.id,
    detail: `bound=${call.safeCostBoundUsd}`,
    usd: call.safeCostBoundUsd,
  });
  return { ok: true };
}

function commitCall(budget: LocalPageEvidenceBudget, call: LocalPageEvidenceCallRecord, actualUsd: number): void {
  const actual = Number(Math.max(0, actualUsd).toFixed(6));
  budget.reservedUsd = Number(Math.max(0, budget.reservedUsd - call.reservedUsd).toFixed(6));
  budget.spentUsd = Number((budget.spentUsd + actual).toFixed(6));
  call.reservedUsd = 0;
  call.actualCostUsd = actual;
  call.status = "consumed";
  call.capturedAt = new Date().toISOString();
  budget.events.push({
    at: new Date().toISOString(),
    kind: "consumed",
    callId: call.id,
    detail: `actual=${actual}`,
    usd: actual,
  });
}

function releaseReservation(budget: LocalPageEvidenceBudget, call: LocalPageEvidenceCallRecord, status: EvidenceCallOutcomeStatus, detail: string): void {
  budget.reservedUsd = Number(Math.max(0, budget.reservedUsd - call.reservedUsd).toFixed(6));
  call.reservedUsd = 0;
  call.status = status;
  call.detail = detail;
  call.capturedAt = new Date().toISOString();
  budget.events.push({ at: new Date().toISOString(), kind: status, callId: call.id, detail });
}

async function executePlacesCall(
  call: LocalPageEvidenceCallRecord,
  geo: GeographicEvidenceContext,
): Promise<{ hits: EvidencePlacesHit[]; costUsd: number | null; uncertain?: boolean; detail?: string }> {
  const maxResultCount = call.id === "places-gp-practices" ? 5 : 3;
  if (harness.adapters?.placesSearch) {
    return harness.adapters.placesSearch(call.query || "", geo, maxResultCount, call.id);
  }
  if (harness.liveProvidersForbidden || !harness.allowLiveProviders) {
    throw new Error("Live Places calls are forbidden in this collection run.");
  }
  try {
    const hits = await searchGooglePlacesTextForLocalEvidence(call.query || "", geo, maxResultCount, {
      areaReference: call.id === "places-area-reference",
    });
    return { hits, costUsd: PLACES_TEXT_SEARCH_PRO_LIST_USD };
  } catch (error) {
    return {
      hits: [],
      costUsd: null,
      uncertain: true,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeOrganicCall(call: LocalPageEvidenceCallRecord): Promise<EvidenceOrganicSearchResult> {
  if (harness.adapters?.organicSearch) {
    return harness.adapters.organicSearch(call.query || "");
  }
  if (harness.liveProvidersForbidden || !harness.allowLiveProviders) {
    throw new Error("Live DataForSEO calls are forbidden in this collection run.");
  }
  const serp = await searchNationalGoogleOrganic({
    query: call.query || "",
    marketCountry: "United Kingdom",
    languageCode: "en",
    depth: 10,
  });
  return {
    query: call.query || "",
    capturedAt: serp.capturedAt,
    costUsd: serp.cost == null ? null : Number(serp.cost),
    uncertain: serp.cost == null,
    results: serp.results.map((row) => ({ url: row.url, title: row.title, description: row.description })),
  };
}

async function executePageCall(url: string): Promise<EvidencePageBodyResult> {
  if (harness.adapters?.fetchPage) {
    return harness.adapters.fetchPage(url);
  }
  if (harness.liveProvidersForbidden) {
    throw new Error("Live page retrieval is forbidden in this collection run.");
  }
  const fetched = await fetchSafeHtmlEvidencePage(url);
  return {
    url: fetched.url || url,
    title: fetched.title,
    status: fetched.status,
    textSample: fetched.textSample,
    retrievedAt: new Date().toISOString(),
  };
}

function firstPrimaryUrl(results: Array<{ url: string; title: string; description: string }>, preferNhs: boolean): string | null {
  const classified = results.map((row) => ({ row, class: classifyEditorialSource(row.url, row.title, row.description) }));
  const primary = classified.filter((row) => row.class.class === "primary");
  const match = preferNhs
    ? primary.find((row) => row.class.publisher === "NHS" || row.row.url.includes(".nhs.uk")) || primary[0]
    : primary.find((row) => row.row.url.includes(".gov.uk")) || primary[0];
  return match?.row.url || null;
}

function loadPharmacyIdentity(slug: string): {
  name: string;
  address: string;
  addressVerified: boolean;
} {
  const loaded = loadPharmacyProfile(slug);
  const data = loaded?.data ? normalizeProfileData(loaded.data) : null;
  if (!data) return { name: slug, address: "", addressVerified: false };
  const name = resolveCanonicalPharmacyName(data).value || slug;
  const address = String(data.displayAddress || data.customerFacingAddress || data.fullAddress || "").trim();
  return {
    name,
    address,
    addressVerified: Boolean(address) && !premisesAddressLooksUnverified(address),
  };
}

function persistAreaReference(
  slug: string,
  areaSlug: string,
  point: { latitude: number; longitude: number; source: string; name?: string; address?: string; placeId?: string },
): void {
  writeJson(recordedAreaReferencePath(slug, areaSlug), {
    slug,
    areaSlug,
    latitude: point.latitude,
    longitude: point.longitude,
    source: point.source,
    name: point.name || undefined,
    address: point.address || undefined,
    placeId: point.placeId || undefined,
    recordedAt: new Date().toISOString(),
  });
}

function recordResolvedAreaReference(
  run: LocalPageEvidenceRun,
  geo: GeographicEvidenceContext,
  hits: EvidencePlacesHit[] | undefined,
): void {
  const resolved = resolveUkLocalPagePlacesAreaReference({
    areaName: run.areaName,
    county: geo.county,
    countryCode: geo.countryCode,
    siblingAreaNames: geo.siblingAreaNames,
    pharmacyCityHint: geo.parentTown,
    hits,
  });
  if (!resolved.ok) return;
  run.areaReferencePoint = {
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    source: resolved.source,
  };
  persistAreaReference(run.slug, run.areaSlug, {
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    source: resolved.source,
    name: resolved.name,
    address: resolved.address,
    placeId: resolved.placeId,
  });
}

function mergeAreaReferenceIntoGeo(
  geo: GeographicEvidenceContext,
  point: { latitude: number; longitude: number } | null,
): GeographicEvidenceContext {
  if (geo.areaCentroid || !point) return geo;
  return { ...geo, areaCentroid: { latitude: point.latitude, longitude: point.longitude } };
}

function classifyPlacesHit(
  hit: EvidencePlacesHit,
  requested: LocalEvidenceEntity["category"],
  geo: GeographicEvidenceContext,
  generatedAt: string,
  areaName: string,
): { ok: true; entity: LocalEvidenceEntity } | { ok: false; rejected: RejectedLocalEvidenceEntity } {
  if (/^Dr\s+/i.test(String(hit.name || "").trim()) || !isCustomerAppropriateOrganisationName(String(hit.name || ""))) {
    return {
      ok: false,
      rejected: {
        name: hit.name || "",
        address: String(hit.address || ""),
        category: requested,
        types: hit.types,
        location: hit.location || null,
        placeId: hit.placeId,
        rejectionReason: "not-customer-facing-organisation-name",
      },
    };
  }
  const classified = classifyRequestedEvidenceCategory(requested, hit.types || [], hit.name || "");
  if (!classified.ok) {
    return {
      ok: false,
      rejected: {
        name: hit.name || "",
        address: String(hit.address || ""),
        category: requested,
        types: hit.types,
        location: hit.location || null,
        placeId: hit.placeId,
        rejectionReason: classified.rejectionReason,
      },
    };
  }
  const result = attributeEntityToArea(
    {
      name: hit.name,
      address: hit.address,
      types: hit.types,
      location: hit.location,
      placeId: hit.placeId,
      locality: hit.locality || hit.address,
      addressComponents: hit.addressComponents,
    },
    geo,
  );
  if (!result.ok) {
    return {
      ok: false,
      rejected: {
        name: hit.name || "",
        address: String(hit.address || ""),
        category: requested,
        types: hit.types,
        location: hit.location || null,
        placeId: hit.placeId,
        rejectionReason: result.rejectionReason,
      },
    };
  }
  return {
    ok: true,
    entity: {
      name: hit.name,
      address: String(hit.address || ""),
      category: classified.category,
      types: hit.types || [],
      location: hit.location || null,
      placeId: String(hit.placeId || ""),
      source: "google-places",
      provider: "googlePlaces",
      retrievedAt: generatedAt,
      sourceRef: hit.sourceRef || "",
      confidence: result.relationship === "name-in-address" ? 92 : 76,
      relationship: result.relationship,
      areaName,
    },
  };
}

function assembleLocalPack(opts: {
  slug: string;
  areaName: string;
  areaSlug: string;
  geo: GeographicEvidenceContext;
  gpHits: EvidencePlacesHit[];
  hospitalHits?: EvidencePlacesHit[];
  landmarkHits?: EvidencePlacesHit[];
  communityHits?: EvidencePlacesHit[];
  officialGpPracticeNames?: string[];
  distanceKm?: number | null;
  pharmacyName?: string;
  areaReferenceSource?: string;
}): { pack: PharmacyLocalEvidencePackV3; verifiedGpPracticeCount: number } {
  const generatedAt = new Date().toISOString();
  const attributed: LocalEvidenceEntity[] = [];
  const rejected: RejectedLocalEvidenceEntity[] = [];
  const relationshipRank: Record<string, number> = {
    "name-in-address": 0,
    "verified-locality-component": 1,
    "name-in-entity": 2,
    "area-centroid-proximity": 3,
  };
  for (const hit of opts.gpHits) {
    if (/^Dr\s+/i.test(String(hit.name || "").trim()) || !isCustomerAppropriateOrganisationName(String(hit.name || ""))) {
      rejected.push({
        name: hit.name || "",
        address: String(hit.address || ""),
        category: "healthcare",
        types: hit.types,
        location: hit.location || null,
        placeId: hit.placeId,
        rejectionReason: "not-customer-facing-organisation-name",
      });
      continue;
    }
    const classified = classifyRequestedEvidenceCategory("healthcare", hit.types || [], hit.name || "");
    if (!classified.ok) {
      rejected.push({
        name: hit.name || "",
        address: String(hit.address || ""),
        category: "healthcare",
        types: hit.types,
        location: hit.location || null,
        placeId: hit.placeId,
        rejectionReason: classified.rejectionReason,
      });
      continue;
    }
    const result = attributeEntityToArea(
      {
        name: hit.name,
        address: hit.address,
        types: hit.types,
        location: hit.location,
        placeId: hit.placeId,
        locality: hit.locality || hit.address,
        addressComponents: hit.addressComponents,
      },
      opts.geo,
    );
    if (!result.ok) {
      rejected.push({
        name: hit.name || "",
        address: String(hit.address || ""),
        category: "healthcare",
        types: hit.types,
        location: hit.location || null,
        placeId: hit.placeId,
        rejectionReason: result.rejectionReason,
      });
      continue;
    }
    attributed.push({
      name: hit.name,
      address: String(hit.address || ""),
      category: classified.category,
      types: hit.types || [],
      location: hit.location || null,
      placeId: String(hit.placeId || ""),
      source: "google-places",
      provider: "googlePlaces",
      retrievedAt: generatedAt,
      sourceRef: hit.sourceRef || "",
      confidence: result.relationship === "name-in-address" ? 92 : 76,
      relationship: result.relationship,
      areaName: opts.areaName,
    });
  }
  attributed.sort(
    (a, b) => (relationshipRank[a.relationship] ?? 9) - (relationshipRank[b.relationship] ?? 9),
  );
  const officialNames = opts.officialGpPracticeNames || [];
  const verified: LocalEvidenceEntity[] = [];
  const researchCandidates: RejectedLocalEvidenceEntity[] = [];
  for (const entity of attributed) {
    if (officialNames.length > 0 && healthcareEntityIsOfficiallySupported(entity.name, officialNames)) {
      verified.push(entity);
    } else {
      researchCandidates.push({
        name: entity.name,
        address: entity.address,
        category: entity.category,
        types: entity.types,
        location: entity.location,
        placeId: entity.placeId,
        rejectionReason: officialNames.length
          ? "no-retrieved-official-source"
          : "awaiting-official-source-check",
      });
    }
  }
  const kept = verified.slice(0, 3);
  for (const extra of verified.slice(3)) {
    rejected.push({
      name: extra.name,
      address: extra.address,
      category: extra.category,
      types: extra.types,
      location: extra.location,
      placeId: extra.placeId,
      rejectionReason: "above-verified-gp-ceiling",
    });
  }
  const seenKeys = new Set(kept.map((entity) => entityIdentityKey(entity)));
  const extraKept: LocalEvidenceEntity[] = [];
  const extraGroups: Array<{ hits: EvidencePlacesHit[]; category: LocalEvidenceEntity["category"]; ceiling: number }> = [
    { hits: opts.hospitalHits || [], category: "healthcare", ceiling: 2 },
    { hits: opts.landmarkHits || [], category: "landmarks", ceiling: 3 },
    { hits: opts.communityHits || [], category: "community", ceiling: 3 },
  ];
  for (const group of extraGroups) {
    const groupEntities: LocalEvidenceEntity[] = [];
    for (const hit of group.hits) {
      const classified = classifyPlacesHit(hit, group.category, opts.geo, generatedAt, opts.areaName);
      if (!classified.ok) {
        rejected.push(classified.rejected);
        continue;
      }
      const key = entityIdentityKey(classified.entity);
      if (seenKeys.has(key)) continue;
      groupEntities.push(classified.entity);
    }
    groupEntities.sort(
      (a, b) => (relationshipRank[a.relationship] ?? 9) - (relationshipRank[b.relationship] ?? 9),
    );
    for (const entity of groupEntities.slice(0, group.ceiling)) {
      seenKeys.add(entityIdentityKey(entity));
      extraKept.push(entity);
    }
  }
  const packEntities = [...kept, ...extraKept];
  const request = planPharmacyLocalEvidenceRequest(opts.slug, "pharmacy-first");
  const coords = request.pharmacyCoordinates;
  const pharmacyRelationship = recordedPharmacyRelationshipFromDistance({
    pharmacyName: opts.pharmacyName || loadPharmacyIdentity(opts.slug).name,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    distanceKm: opts.distanceKm ?? null,
    areaReferenceSource: opts.areaReferenceSource,
  });
  if (!coords) {
    return {
      pack: emptyEvidencePack({
        slug: opts.slug,
        area: opts.areaName,
        areaSlug: opts.areaSlug,
        pharmacyCoordinates: { latitude: 0, longitude: 0, source: "missing" },
        generatedAt,
        sourceStatus: "google-places-authorised-collection-missing-coordinates",
        rejected,
      }),
      verifiedGpPracticeCount: 0,
    };
  }
  const pack =
    packEntities.length || pharmacyRelationship
      ? buildEvidencePackFromAttributedEntities({
          slug: opts.slug,
          area: opts.areaName,
          areaSlug: opts.areaSlug,
          pharmacyCoordinates: coords,
          generatedAt,
          sourceStatus: packEntities.length
            ? "google-places-authorised-collection"
            : "google-places-authorised-collection-pharmacy-relationship",
          entities: packEntities,
          rejected,
          researchCandidates,
          pharmacyRelationship,
        })
      : {
          ...emptyEvidencePack({
            slug: opts.slug,
            area: opts.areaName,
            areaSlug: opts.areaSlug,
            pharmacyCoordinates: coords,
            generatedAt,
            sourceStatus: "google-places-authorised-collection-zero-gp",
            rejected,
          }),
          researchCandidates,
        };
  return { pack, verifiedGpPracticeCount: kept.length };
}

function editorialFactsFromPlacesPack(opts: {
  pack: PharmacyLocalEvidencePackV3 | null;
  areaName: string;
  areaSlug: string;
  retrievedAt: string;
  existingStatements: string[];
}): EditorialFactV3[] {
  if (!opts.pack) return [];
  const seen = new Set(opts.existingStatements.map((row) => row.toLowerCase()));
  const facts: EditorialFactV3[] = [];
  for (const entity of attributableEntities(opts.pack)) {
    const name = String(entity.name || "").trim();
    if (!name) continue;
    const statement = placesEntityNormalizedStatement({
      name,
      category: entity.category,
      types: entity.types,
      areaName: opts.areaName,
    });
    if (!statement) continue;
    if (seen.has(statement.toLowerCase())) continue;
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
      retrievedAt: opts.retrievedAt,
      sourceClass: "secondary",
      corroboratingSource: null,
      confidence: "medium",
      usefulnessToPharmacyFirstReader: "A verified Places listing attributable to this area, not an invented local colour claim.",
      permittedCopyRole: entity.category === "healthcare" ? "healthcare-context" : "neutral-community-context",
      prohibitedInference: "A listed place does not prove a route, journey time, affiliation, or that the reader uses it.",
      validationStatus: "accepted",
    };
    seen.add(statement.toLowerCase());
    facts.push(fact);
  }
  return facts;
}

function assembleEditorialPack(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  geo: GeographicEvidenceContext;
  run: LocalPageEvidenceRun;
  placesPack: PharmacyLocalEvidencePackV3 | null;
  distanceKm: number | null;
}): EditorialEvidencePackV3 {
  const retrievedAt = new Date().toISOString();
  const searches: EditorialSearchRecordV3[] = [];
  const retrievedPages: EditorialRetrievedPageV3[] = [];
  const rejectedSources: Array<{ url: string; reason: string }> = [];
  const facts: EditorialFactV3[] = [];
  for (const [callId, serp] of Object.entries(opts.run.organicByCall)) {
    const topic = callId.replace(/^dataforseo-/, "");
    searches.push({
      topic,
      query: serp.query,
      disambiguated: true,
      costUsd: Number(serp.costUsd || 0),
      resultCount: serp.results.length,
      capturedAt: serp.capturedAt,
      provider: "dataforseo",
    });
    for (const hit of serp.results) {
      const classification = classifyEditorialSource(hit.url, hit.title, hit.description);
      if (classification.class === "rejected") rejectedSources.push({ url: hit.url, reason: classification.reason });
    }
  }
  for (const page of Object.values(opts.run.pagesByCall)) {
    const classification = classifyEditorialSource(page.url, page.title || "", "");
    retrievedPages.push({
      url: page.url,
      title: page.title || "",
      publisher: classification.publisher,
      sourceClass: classification.class === "rejected" ? "rejected" : classification.class,
      status: page.status,
      retrievedAt: page.retrievedAt || retrievedAt,
      textSample: page.textSample || undefined,
    });
    if (!page.textSample || (page.status && page.status >= 400)) continue;
    if (classification.class === "rejected") continue;
    const drafts = extractEditorialFactDrafts({
      areaName: opts.areaName,
      title: page.title || "",
      text: page.textSample,
      sourceClass: classification.class === "secondary" ? "secondary" : "primary",
      publisher: classification.publisher,
      host: hostFromUrl(page.url),
    });
    for (const draft of drafts) {
      if (looksLikeRawCopiedPassage(draft.normalizedStatement, page.textSample)) continue;
      if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
      const fact: EditorialFactV3 = {
        factId: factIdFor(opts.areaSlug, draft.category, draft.normalizedStatement),
        area: opts.areaName,
        areaSlug: opts.areaSlug,
        category: draft.category,
        normalizedStatement: draft.normalizedStatement,
        sourceTitle: page.title || "",
        sourceUrl: page.url,
        publisher: classification.publisher,
        retrievedAt: page.retrievedAt || retrievedAt,
        sourceClass: classification.class === "secondary" ? "secondary" : "primary",
        corroboratingSource: null,
        confidence: draft.confidence,
        usefulnessToPharmacyFirstReader: draft.usefulnessToPharmacyFirstReader,
        permittedCopyRole: draft.permittedCopyRole,
        prohibitedInference: draft.prohibitedInference,
        validationStatus: "accepted",
      };
      if (facts.some((row) => row.normalizedStatement === fact.normalizedStatement)) continue;
      facts.push(fact);
    }
  }
  facts.push(
    ...editorialFactsFromPlacesPack({
      pack: opts.placesPack,
      areaName: opts.areaName,
      areaSlug: opts.areaSlug,
      retrievedAt,
      existingStatements: facts.map((row) => row.normalizedStatement),
    }),
  );
  const identity = loadPharmacyIdentity(opts.slug);
  const areaRe = new RegExp(`\\b${opts.areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const pharmacyIsInArea = identity.addressVerified && areaRe.test(identity.address);
  const inspected = inspectSavedLocalPageDistanceEndpoints(opts.slug, opts.serviceId, opts.areaSlug);
  const areaReference =
    finiteSavedPoint(opts.run.areaReferencePoint, opts.run.areaReferencePoint?.source || "evidence-run") || inspected.area;
  facts.push(
    ...canonicalPharmacyFacts({
      areaName: opts.areaName,
      areaSlug: opts.areaSlug,
      pharmacyName: identity.name,
      address: identity.address,
      pharmacyIsInArea,
      distanceKm: opts.distanceKm,
      retrievedAt,
      addressVerified: identity.addressVerified,
      areaReference,
      pharmacyCoordinates: inspected.pharmacy,
    }),
  );
  const healthcareFacts = facts.filter(
    (f) => f.validationStatus === "accepted" && f.category === "healthcare" && /NHS general practice services/i.test(f.normalizedStatement),
  );
  const sufficiency = assessUkLocalPageEditorialSufficiency({
    facts,
    placesEntityCount: opts.placesPack ? attributableEntities(opts.placesPack).length : 0,
    pharmacyIsInArea,
    hasVerifiedDistance: opts.distanceKm != null,
    verifiedGpPracticeCount: healthcareFacts.length,
  });
  return {
    contractId: EDITORIAL_EVIDENCE_CONTRACT_ID,
    version: EDITORIAL_EVIDENCE_VERSION,
    slug: opts.slug,
    area: opts.areaName,
    areaSlug: opts.areaSlug,
    collectedAt: retrievedAt,
    geographicContext: {
      areaName: opts.geo.areaName,
      parentTown: opts.geo.parentTown,
      county: opts.geo.county,
      country: opts.geo.country,
      queryPlaceLabel: opts.geo.queryPlaceLabel,
    },
    searches,
    retrievedPages,
    rejectedSources,
    facts,
    sufficiency,
    costUsd: opts.run.spentUsd,
  };
}

function applyStraightLineDistanceCall(run: LocalPageEvidenceRun): void {
  const call = run.calls.find((row) => row.id === "distance-haversine");
  const inspected = inspectSavedLocalPageDistanceEndpoints(run.slug, run.serviceId, run.areaSlug);
  const pharmacy = inspected.pharmacy;
  const area =
    finiteSavedPoint(run.areaReferencePoint, run.areaReferencePoint?.source || "evidence-run") || inspected.area;
  const identity = loadPharmacyIdentity(run.slug);
  const distancePlan = planUkLocalPageStraightLineDistance({
    slug: run.slug,
    areaName: run.areaName,
    pharmacyCoordinates: pharmacy,
    areaCentroid: area,
    pharmacyName: identity.name,
  });
  if (!pharmacy || !area || distancePlan.distanceKm == null) {
    if (call && call.status !== "consumed" && call.status !== "skipped-cached") {
      call.status = "skipped-blocked";
      call.detail = "Straight-line distance is blocked until a recorded area reference point exists.";
      saveRun(run);
    }
    return;
  }
  run.distanceKm = distancePlan.distanceKm;
  if (!run.areaReferencePoint && area) {
    run.areaReferencePoint = {
      latitude: area.latitude,
      longitude: area.longitude,
      source: area.source,
    };
  }
  if (call && call.status !== "consumed") {
    call.status = call.status === "skipped-cached" ? "skipped-cached" : "consumed";
    call.actualCostUsd = 0;
    call.detail = `Approximate straight-line distance ${run.distanceKm} km from ${identity.name || "the pharmacy"} to ${run.areaName}. Method: haversine straight-line. Not a driving time.`;
    call.capturedAt = call.capturedAt || new Date().toISOString();
    saveRun(run);
  }
}

async function executePendingCalls(run: LocalPageEvidenceRun, budget: LocalPageEvidenceBudget, plan: LocalPageEvidencePreparationPlan): Promise<void> {
  const request = planPharmacyLocalEvidenceRequest(run.slug, run.serviceId);
  const geo = resolveGeographicEvidenceContext({
    slug: run.slug,
    areaName: run.areaName,
    areaSlug: run.areaSlug,
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: request.pharmacyCoordinates,
  });

  for (const call of run.calls) {
    if (call.id === "distance-haversine") continue;
    if (call.status === "consumed" || call.status === "skipped-cached") continue;
    if (call.status === "stopped-budget" || call.status === "stopped-uncertain" || call.status === "stopped-no-bound") {
      continue;
    }
    if (run.status === "stopped" || run.status === "interrupted") break;

    if (call.id.startsWith("page-body-") ) {
      const serpByPageBody: Record<string, string> = {
        "page-body-gp-official": "dataforseo-official-gp-practices",
        "page-body-locality": "dataforseo-descriptive-locality",
        "page-body-community": "dataforseo-official-community",
        "page-body-healthcare": "dataforseo-official-healthcare",
      };
      const serp = run.organicByCall[serpByPageBody[call.id] || ""];
      const url = firstPrimaryUrl(serp?.results || [], call.id === "page-body-gp-official" || call.id === "page-body-healthcare");
      if (!url) {
        call.status = "skipped-blocked";
        call.detail = "No official page candidate from the authorised search. Not retried.";
        call.capturedAt = new Date().toISOString();
        saveRun(run);
        saveBudget(budget);
        continue;
      }
      const reserved = reserveCall(budget, call);
      if (!reserved.ok) {
        run.status = "stopped";
        run.stopReason = reserved.reason;
        call.status = "stopped-budget";
        call.detail = reserved.reason;
        saveRun(run);
        saveBudget(budget);
        return;
      }
      saveRun(run);
      saveBudget(budget);
      const page = await executePageCall(url);
      commitCall(budget, call, 0);
      call.detail = `Retrieved ${page.url}`;
      run.pagesByCall[call.id] = page;
      saveRun(run);
      saveBudget(budget);
      if (harness.adapters?.afterCall) await harness.adapters.afterCall(call.id, run);
      continue;
    }

    if (call.provider === "google-places" || call.provider === "dataforseo") {
      if (call.safeCostBoundUsd == null) {
        run.status = "stopped";
        run.stopReason = `No safe cost bound is available for ${call.id}. The provider was not called.`;
        call.status = "stopped-no-bound";
        call.detail = run.stopReason;
        saveRun(run);
        return;
      }
      const reserved = reserveCall(budget, call);
      if (!reserved.ok) {
        run.status = "stopped";
        run.stopReason = reserved.reason;
        call.status = "stopped-budget";
        call.detail = reserved.reason;
        saveRun(run);
        saveBudget(budget);
        return;
      }
      saveRun(run);
      saveBudget(budget);
      if (call.provider === "google-places") {
        const result = await executePlacesCall(call, geo);
        if (result.uncertain || result.costUsd == null) {
          releaseReservation(
            budget,
            call,
            "stopped-uncertain",
            result.detail || "Places outcome or billed cost is uncertain. The call was not retried.",
          );
          run.status = "stopped";
          run.stopReason = call.detail;
          saveRun(run);
          saveBudget(budget);
          return;
        }
        commitCall(budget, call, result.costUsd);
        run.paidCallsMade += 1;
        run.spentUsd = budget.spentUsd;
        run.placesHitsByCall[call.id] = result.hits;
        call.detail = `${result.hits.length} Places result(s) stored.`;
        if (call.id === "places-area-reference") {
          recordResolvedAreaReference(run, geo, result.hits);
        }
        saveRun(run);
        saveBudget(budget);
        if (harness.adapters?.afterCall) await harness.adapters.afterCall(call.id, run);
        continue;
      }
      const serp = await executeOrganicCall(call);
      if (serp.uncertain || serp.costUsd == null) {
        releaseReservation(
          budget,
          call,
          "stopped-uncertain",
          "DataForSEO cost or outcome is uncertain. The call was not retried.",
        );
        run.status = "stopped";
        run.stopReason = call.detail;
        saveRun(run);
        saveBudget(budget);
        return;
      }
      commitCall(budget, call, serp.costUsd);
      if (serp.costUsd > (call.safeCostBoundUsd || 0) && budget.spentUsd > budget.spendingCapUsd) {
        run.status = "stopped";
        run.stopReason = `${call.id} actual cost $${serp.costUsd.toFixed(3)} exceeded the remaining evidence cap. Further paid calls were not made.`;
      }
      run.paidCallsMade += 1;
      run.spentUsd = budget.spentUsd;
      run.organicByCall[call.id] = serp;
      call.detail = `${serp.results.length} organic result(s) stored.`;
      saveRun(run);
      saveBudget(budget);
      if (harness.adapters?.afterCall) await harness.adapters.afterCall(call.id, run);
    }
  }
  applyStraightLineDistanceCall(run);
}

function finaliseRun(run: LocalPageEvidenceRun, budget: LocalPageEvidenceBudget, plan: LocalPageEvidencePreparationPlan): void {
  const request = planPharmacyLocalEvidenceRequest(run.slug, run.serviceId);
  const geoContext = resolveGeographicEvidenceContext({
    slug: run.slug,
    areaName: run.areaName,
    areaSlug: run.areaSlug,
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: request.pharmacyCoordinates,
  });
  if (!run.areaReferencePoint) {
    recordResolvedAreaReference(run, geoContext, run.placesHitsByCall["places-area-reference"]);
  }
  applyStraightLineDistanceCall(run);
  const inspected = inspectSavedLocalPageDistanceEndpoints(run.slug, run.serviceId, run.areaSlug);
  const areaPoint =
    finiteSavedPoint(run.areaReferencePoint, run.areaReferencePoint?.source || "evidence-run") || inspected.area;
  const geo = mergeAreaReferenceIntoGeo(
    { ...geoContext, pharmacyCoordinates: inspected.pharmacy || request.pharmacyCoordinates },
    areaPoint,
  );
  if (run.distanceKm == null && inspected.pharmacy && areaPoint) {
    const identity = loadPharmacyIdentity(run.slug);
    const distancePlan = planUkLocalPageStraightLineDistance({
      slug: run.slug,
      areaName: run.areaName,
      pharmacyCoordinates: inspected.pharmacy,
      areaCentroid: areaPoint,
      pharmacyName: identity.name,
    });
    run.distanceKm = distancePlan.distanceKm;
  }
  const gpHits = run.placesHitsByCall["places-gp-practices"] || [];
  const officialGpPracticeNames = officialGpPracticeNamesFromRetrievedPages({
    areaName: run.areaName,
    pages: Object.values(run.pagesByCall || {}),
  });
  const identity = loadPharmacyIdentity(run.slug);
  const local = assembleLocalPack({
    slug: run.slug,
    areaName: run.areaName,
    areaSlug: run.areaSlug,
    geo,
    gpHits,
    hospitalHits: run.placesHitsByCall["places-hospitals"] || [],
    landmarkHits: run.placesHitsByCall["places-landmarks"] || [],
    communityHits: run.placesHitsByCall["places-community"] || [],
    officialGpPracticeNames,
    distanceKm: run.distanceKm,
    pharmacyName: identity.name,
    areaReferenceSource: areaPoint?.source || run.areaReferencePoint?.source,
  });
  const editorial = assembleEditorialPack({
    slug: run.slug,
    serviceId: run.serviceId,
    areaName: run.areaName,
    areaSlug: run.areaSlug,
    geo,
    run,
    placesPack: local.pack,
    distanceKm: run.distanceKm,
  });
  const nhsNamedPractices = new Set(
    editorial.facts
      .filter(
        (f) =>
          f.validationStatus === "accepted" &&
          f.category === "healthcare" &&
          /NHS general practice services/i.test(f.normalizedStatement),
      )
      .map((f) => f.normalizedStatement),
  );
  run.verifiedGpPracticeCount = Math.max(local.verifiedGpPracticeCount, nhsNamedPractices.size);
  run.editorialSufficiency = editorial.sufficiency.status;
  run.findings = [
    `${run.verifiedGpPracticeCount} verified GP practice(s) after official-source checks.`,
    run.verifiedGpPracticeCount === 0
      ? "Zero verified GP practices is a recorded research outcome, not an automatic retry."
      : "Verified GP practices were stored from Places and checked against official sources.",
    editorial.sufficiency.reasons.join(" "),
    `Actual evidence spend $${budget.spentUsd.toFixed(3)} of cap $${budget.spendingCapUsd.toFixed(3)}. OpenAI generation was not charged.`,
  ];
  run.outcomeSummary =
    editorial.sufficiency.status === "READY"
      ? `Collection finished. Evidence is READY. ${run.verifiedGpPracticeCount} verified GP practice(s). Spend $${budget.spentUsd.toFixed(3)}.`
      : `Collection finished. Evidence is LIMITED: ${editorial.sufficiency.reasons.join("; ")}. Spend $${budget.spentUsd.toFixed(3)}.`;
  if (harness.persistPacks) {
    const root = workspaceRoot();
    run.localPackPath = writePharmacyLocalEvidencePack(local.pack, root);
    const editorialFile = editorialEvidencePackPath(run.slug, run.serviceId, run.areaSlug, root);
    fs.mkdirSync(path.dirname(editorialFile), { recursive: true });
    fs.writeFileSync(editorialFile, `${JSON.stringify(editorial, null, 2)}\n`);
    run.editorialPackPath = editorialFile;
  }
  run.spentUsd = budget.spentUsd;
  run.reservedUsd = budget.reservedUsd;
  if (run.status !== "stopped" && run.status !== "interrupted") {
    run.status = "completed";
    run.completedAt = run.completedAt || new Date().toISOString();
    run.stopReason = null;
  }
  saveRun(run);
  saveBudget(budget);
}

function backupPathBeside(file: string): string {
  return file.replace(/\.json$/, ".before-evidence-quality-fix.json");
}

function copyIfMissing(from: string, to: string): void {
  if (!from || !fs.existsSync(from) || fs.existsSync(to)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function backupEvidenceArtifactsBeforeQualityFix(run: LocalPageEvidenceRun): void {
  if (!harness.persistPacks) return;
  const root = workspaceRoot();
  copyIfMissing(evidenceRunPath(run.slug, run.serviceId, run.areaSlug), backupPathBeside(evidenceRunPath(run.slug, run.serviceId, run.areaSlug)));
  copyIfMissing(
    localEvidencePackPath(run.slug, run.areaSlug, root),
    backupPathBeside(localEvidencePackPath(run.slug, run.areaSlug, root)),
  );
  copyIfMissing(
    editorialEvidencePackPath(run.slug, run.serviceId, run.areaSlug, root),
    backupPathBeside(editorialEvidencePackPath(run.slug, run.serviceId, run.areaSlug, root)),
  );
}

export function reprocessLocalPageEvidenceRun(opts: {
  slug: string;
  serviceId: string;
  areaSlug: string;
}): { ok: true; run: LocalPageEvidenceRun; paidCallsMade: number } | { ok: false; error: string } {
  const run = loadEvidenceRun(opts.slug, opts.serviceId, opts.areaSlug);
  if (!run) return { ok: false, error: "No saved evidence run to reprocess." };
  if (run.slug !== opts.slug) return { ok: false, error: "Cross-tenant reprocess is not allowed." };
  const spent = run.spentUsd;
  const paid = run.paidCallsMade;
  const runId = run.runId;
  const startedAt = run.startedAt;
  const completedAt = run.completedAt;
  const calls = run.calls;
  const placesHitsByCall = run.placesHitsByCall;
  const organicByCall = run.organicByCall;
  const pagesByCall = run.pagesByCall;
  backupEvidenceArtifactsBeforeQualityFix(run);
  const budget = loadEvidenceBudget(opts.slug, opts.serviceId, opts.areaSlug) || {
    kind: EVIDENCE_BUDGET_KIND,
    slug: run.slug,
    serviceId: run.serviceId,
    areaSlug: run.areaSlug,
    runId: run.runId,
    spendingCapUsd: run.spendingCapUsd,
    spentUsd: spent,
    reservedUsd: 0,
    events: [],
  };
  budget.spentUsd = spent;
  budget.reservedUsd = 0;
  const plan = planOneLocalPageEvidencePreparation(opts.slug, opts.serviceId, opts.areaSlug);
  run.reprocessedAt = new Date().toISOString();
  finaliseRun(run, budget, plan);
  const saved = loadEvidenceRun(opts.slug, opts.serviceId, opts.areaSlug) || run;
  saved.runId = runId;
  saved.startedAt = startedAt;
  saved.completedAt = completedAt || saved.completedAt;
  saved.spentUsd = spent;
  saved.paidCallsMade = paid;
  saved.calls = calls;
  saved.placesHitsByCall = placesHitsByCall;
  saved.organicByCall = organicByCall;
  saved.pagesByCall = pagesByCall;
  saveRun(saved);
  return { ok: true, run: saved, paidCallsMade: paid };
}

export async function startLocalPageEvidenceCollection(opts: {
  slug: string;
  serviceId: string;
  areaSlug?: string;
  allowLiveProviders?: boolean;
}): Promise<
  | { ok: true; run: LocalPageEvidenceRun; duplicate: boolean; plan: LocalPageEvidencePreparationPlan }
  | { ok: false; error: string; status: number; run?: LocalPageEvidenceRun }
> {
  const plan = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(opts.slug, opts.serviceId, opts.areaSlug));
  if (plan.slug !== opts.slug) {
    return { ok: false, status: 403, error: "Tenant mismatch. Evidence authorisation is scoped to the authenticated pharmacy." };
  }
  if (!isOneLocalPageCandidateArea(plan.slug, plan.areaSlug)) {
    return { ok: false, status: 403, error: "Cross-tenant or non-candidate collection is not authorised." };
  }
  const auth = loadEvidenceAuthorisation(plan.slug, plan.serviceId, plan.areaSlug);
  if (!auth || auth.slug !== plan.slug || auth.serviceId !== plan.serviceId || auth.areaSlug !== plan.areaSlug) {
    return { ok: false, status: 403, error: "This exact evidence plan has not been authorised for this pharmacy." };
  }
  const fingerprint = plan.planFingerprint || fingerprintLocalPageEvidencePlan(plan);
  harness.allowLiveProviders = opts.allowLiveProviders === true && !harness.liveProvidersForbidden;

  const file = evidenceRunPath(plan.slug, plan.serviceId, plan.areaSlug);
  return await withFileLock(file, async () => {
    const existing = loadEvidenceRun(plan.slug, plan.serviceId, plan.areaSlug);
    if (existing?.status === "running") {
      return { ok: true, run: existing, duplicate: true, plan };
    }
    if (existing?.status === "stopped") {
      const followUpStopped = uncachedPaidEvidenceFollowUpRequired(existing, plan);
      const unconsumedPaid = (plan.proposedCalls || []).some(
        (row) => !row.cached && Number(row.estimatedCostUsd || 0) > 0,
      );
      if (followUpStopped || unconsumedPaid) {
        const budget = loadEvidenceBudget(plan.slug, plan.serviceId, plan.areaSlug) || emptyBudget({
          slug: existing.slug,
          serviceId: existing.serviceId,
          areaSlug: existing.areaSlug,
          runId: existing.runId,
          spendingCapUsd: existing.spendingCapUsd,
        });
        existing.status = "running";
        existing.stopReason = null;
        saveRun(existing);
        try {
          await executePendingCalls(existing, budget, plan);
          if (existing.status === "running") finaliseRun(existing, budget, plan);
          else {
            existing.spentUsd = budget.spentUsd;
            saveRun(existing);
            saveBudget(budget);
          }
          return {
            ok: true,
            run: loadEvidenceRun(plan.slug, plan.serviceId, plan.areaSlug) || existing,
            duplicate: false,
            plan,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          existing.status = "stopped";
          existing.stopReason = message;
          saveRun(existing);
          saveBudget(budget);
          return { ok: false, status: 500, error: message, run: existing };
        }
      }
      const reprocessed = reprocessLocalPageEvidenceRun({
        slug: plan.slug,
        serviceId: plan.serviceId,
        areaSlug: plan.areaSlug,
      });
      if (!reprocessed.ok) {
        return { ok: false, status: 409, error: reprocessed.error, run: existing };
      }
      return { ok: true, run: reprocessed.run, duplicate: false, plan };
    }
    if (existing?.status === "interrupted") {
      const budget = loadEvidenceBudget(plan.slug, plan.serviceId, plan.areaSlug) || emptyBudget({
        slug: existing.slug,
        serviceId: existing.serviceId,
        areaSlug: existing.areaSlug,
        runId: existing.runId,
        spendingCapUsd: existing.spendingCapUsd,
      });
      existing.status = "running";
      existing.stopReason = null;
      saveRun(existing);
      try {
        await executePendingCalls(existing, budget, plan);
        if (existing.status === "running") finaliseRun(existing, budget, plan);
        else {
          existing.spentUsd = budget.spentUsd;
          saveRun(existing);
          saveBudget(budget);
        }
        return {
          ok: true,
          run: loadEvidenceRun(plan.slug, plan.serviceId, plan.areaSlug) || existing,
          duplicate: false,
          plan,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === INTERRUPTED_COLLECTION_FIXTURE || /interrupt/i.test(message)) {
          existing.status = "interrupted";
          existing.stopReason = "Collection was interrupted before remaining unused calls. Resume does not repeat consumed calls.";
          saveRun(existing);
          saveBudget(budget);
          return { ok: true, run: existing, duplicate: false, plan };
        }
        existing.status = "stopped";
        existing.stopReason = message;
        saveRun(existing);
        saveBudget(budget);
        return { ok: false, status: 500, error: message, run: existing };
      }
    }
    const followUp = uncachedPaidEvidenceFollowUpRequired(existing, plan);
    if (existing?.status === "completed" && !followUp) {
      const reprocessed = reprocessLocalPageEvidenceRun({
        slug: plan.slug,
        serviceId: plan.serviceId,
        areaSlug: plan.areaSlug,
      });
      const latest = reprocessed.ok ? reprocessed.run : existing;
      return {
        ok: true,
        run: latest,
        duplicate: true,
        plan: decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(plan.slug, plan.serviceId, plan.areaSlug)),
      };
    }
    if (auth.planFingerprint !== fingerprint) {
      return { ok: false, status: 409, error: "The authorised plan no longer matches the current saved plan. Re-authorise after review." };
    }
    const preserveExisting = Boolean(existing && followUp && existing.status === "completed");
    const run = preserveExisting
      ? reopenUncachedCallsOnExistingRun(existing as LocalPageEvidenceRun, plan, auth)
      : existing && existing.planFingerprint === fingerprint
        ? existing
        : newRunFromPlan(plan, auth);
    if (!existing || (existing.planFingerprint !== fingerprint && !preserveExisting)) {
      saveRun(run);
      saveBudget(
        emptyBudget({
          slug: run.slug,
          serviceId: run.serviceId,
          areaSlug: run.areaSlug,
          runId: run.runId,
          spendingCapUsd: auth.spendingCapUsd,
        }),
      );
    } else if (preserveExisting) {
      saveRun(run);
      const preserved = loadEvidenceBudget(plan.slug, plan.serviceId, plan.areaSlug);
      if (preserved && preserved.slug === run.slug && preserved.areaSlug === run.areaSlug) {
        preserved.runId = run.runId;
        if (auth.spendingCapUsd >= preserved.spentUsd) preserved.spendingCapUsd = auth.spendingCapUsd;
        saveBudget(preserved);
      }
    }
    const budget = loadEvidenceBudget(plan.slug, plan.serviceId, plan.areaSlug) || emptyBudget({
      slug: run.slug,
      serviceId: run.serviceId,
      areaSlug: run.areaSlug,
      runId: run.runId,
      spendingCapUsd: auth.spendingCapUsd,
    });
    run.status = "running";
    run.startedAt = run.startedAt || new Date().toISOString();
    run.stopReason = null;
    saveRun(run);
    try {
      await executePendingCalls(run, budget, plan);
      if (run.status === "running") finaliseRun(run, budget, plan);
      else {
        run.spentUsd = budget.spentUsd;
        saveRun(run);
        saveBudget(budget);
      }
      return {
        ok: true,
        run: loadEvidenceRun(plan.slug, plan.serviceId, plan.areaSlug) || run,
        duplicate: Boolean(existing) && !preserveExisting,
        plan,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === INTERRUPTED_COLLECTION_FIXTURE || /interrupt/i.test(message)) {
        run.status = "interrupted";
        run.stopReason = "Collection was interrupted before remaining unused calls. Resume does not repeat consumed calls.";
        saveRun(run);
        saveBudget(budget);
        return { ok: true, run, duplicate: false, plan };
      }
      run.status = "stopped";
      run.stopReason = message;
      saveRun(run);
      saveBudget(budget);
      return { ok: false, status: 500, error: message, run };
    }
  });
}

export function getLocalPageEvidenceRun(slug: string, serviceId: string, areaSlug: string): LocalPageEvidenceRun | null {
  const run = loadEvidenceRun(slug, serviceId, areaSlug);
  if (!run || run.slug !== slug) return null;
  return run;
}
