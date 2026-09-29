/**
 * Local evidence-pack contract V3 — Campaign Builder areas → attributable per-area packs.
 * Preview and Review Centre must never import the discovery function.
 */
import fs from "node:fs";
import path from "node:path";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";
import { loadCampaignBuilderSession } from "../growthEngineCampaignBuilderService.ts";
import { resolvePharmacyGoogleLocation, haversineKm } from "../masterAdminLocalCoverageGeoService.ts";
import { normalizeProfileData } from "../pharmacyProfileSchema.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import {
  classifyEvidenceForRequestedCategory,
  classifySupportedCategoryFromTypes,
  evaluateGeographicCompatibility,
  resolveGeographicEvidenceContext,
  resolveAreaCentroidFromRecordedReference,
  wordBoundaryIncludes as geoWordBoundaryIncludes,
  finitePoint as geoFinitePoint,
  addressContainsRequestedLocality,
} from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { visibleCopyContainsVerifiedEvidenceName } from "./pharmacyVerifiedLocalEvidenceConsumptionContract.ts";

export const LOCAL_EVIDENCE_PACK_SCHEMA_VERSION = "v3";
export const LOCAL_EVIDENCE_PACK_PROVIDER = "googlePlaces";
export const PHARMACY_LOCAL_EVIDENCE_DISCOVERY_FUNCTION = "runPharmacyLocalEvidenceDiscovery";

/** Conservative identity-stripped body duplication threshold (existing sectional gate uses 0.92). */
export const LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD = 0.85;

/** Max km from an authoritative area centroid for proximity attribution. Pharmacy distance is not sufficient. */
export const AREA_CENTROID_ATTRIBUTION_MAX_KM = 3;

export const SUPPORTED_LOCAL_EVIDENCE_CATEGORIES = [
  "healthcare",
  "community",
  "landmarks",
  "transport",
  "schools",
  "retail",
] as const;

export type SupportedLocalEvidenceCategory = (typeof SUPPORTED_LOCAL_EVIDENCE_CATEGORIES)[number];

export type LocalEvidenceAreaStatus = "ready" | "missing" | "stale" | "evidence-limited";

export type LocalEvidenceAttributionRelationship =
  | "name-in-address"
  | "name-in-entity"
  | "verified-locality-component"
  | "area-centroid-proximity";

export const LOCAL_EVIDENCE_DISTANCE_METHOD = "haversine-straight-line" as const;

export interface LocalEvidencePharmacyRelationship {
  from: string;
  to: string;
  distanceKm: number;
  method: typeof LOCAL_EVIDENCE_DISTANCE_METHOD;
  areaReferenceSource: string;
}

export interface PharmacyEvidenceCoordinates {
  latitude: number;
  longitude: number;
  source: string;
}

export interface LocalEvidenceEntity {
  name: string;
  address: string;
  category: SupportedLocalEvidenceCategory;
  types: string[];
  location: { latitude: number; longitude: number } | null;
  placeId: string;
  source: string;
  provider: string;
  retrievedAt: string;
  sourceRef: string;
  confidence: number;
  relationship: LocalEvidenceAttributionRelationship;
  areaName: string;
}

export interface RejectedLocalEvidenceEntity {
  name: string;
  address: string;
  category?: string;
  types?: string[];
  location?: { latitude: number; longitude: number } | null;
  placeId?: string;
  rejectionReason: string;
}

export interface LocalEvidenceQualitySummary {
  attributableCount: number;
  rejectedCount: number;
  categoriesPresent: SupportedLocalEvidenceCategory[];
  minimumMet: boolean;
}

export interface PharmacyLocalEvidencePackV3 {
  version: typeof LOCAL_EVIDENCE_PACK_SCHEMA_VERSION;
  slug: string;
  area: string;
  areaSlug: string;
  provider: string;
  generatedAt: string;
  sourceStatus: string;
  pharmacyCoordinates: PharmacyEvidenceCoordinates;
  healthcare: LocalEvidenceEntity[];
  community: LocalEvidenceEntity[];
  landmarks: LocalEvidenceEntity[];
  transport: LocalEvidenceEntity[];
  schools: LocalEvidenceEntity[];
  retail: LocalEvidenceEntity[];
  rejected: RejectedLocalEvidenceEntity[];
  researchCandidates?: RejectedLocalEvidenceEntity[];
  pharmacyRelationship?: LocalEvidencePharmacyRelationship | null;
  evidenceLimited: boolean;
  qualitySummary: LocalEvidenceQualitySummary;
}

export interface LocalEvidenceAreaPlan {
  areaName: string;
  areaSlug: string;
}

export interface LocalEvidenceRequestPlan {
  slug: string;
  serviceId: string;
  pharmacyName: string;
  pharmacyCoordinates: PharmacyEvidenceCoordinates | null;
  areas: LocalEvidenceAreaPlan[];
  blueprintRequired: false;
}

export interface LocalEvidenceAreaPreflight {
  areaName: string;
  areaSlug: string;
  status: LocalEvidenceAreaStatus;
  detail: string;
}

export interface LocalEvidencePreflightResult {
  ok: boolean;
  ready: boolean;
  slug: string;
  serviceId: string;
  areas: LocalEvidenceAreaPreflight[];
  readyAreas: string[];
  missingAreas: string[];
  staleAreas: string[];
  evidenceLimitedAreas: string[];
  customerError: string | null;
}

export interface AttributionInput {
  name: string;
  address?: string;
  types?: string[];
  location?: { latitude?: number; longitude?: number } | null;
  placeId?: string;
  locality?: string;
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
}

export interface AreaAttributionContext {
  areaName: string;
  areaSlug: string;
  siblingAreaNames: string[];
  areaCentroid?: { latitude: number; longitude: number } | null;
  pharmacyCoordinates?: PharmacyEvidenceCoordinates | null;
  parentTown?: string;
  county?: string;
  country?: string;
  countryCode?: string;
  pharmacyPostcode?: string;
  pharmacyPostcodeArea?: string;
  pharmacyPostcodeVerified?: boolean;
  maxDistanceFromPharmacyKm?: number;
}

function packsRoot(workspaceRoot = PHARMACY_WORKSPACE_ROOT): string {
  return path.join(workspaceRoot, "data/pharmacy-local-relevance-packs");
}

export function localEvidencePackDirectory(slug: string, workspaceRoot = PHARMACY_WORKSPACE_ROOT): string {
  return path.join(packsRoot(workspaceRoot), slug);
}

export function localEvidencePackPath(
  slug: string,
  areaSlug: string,
  workspaceRoot = PHARMACY_WORKSPACE_ROOT,
): string {
  return path.join(localEvidencePackDirectory(slug, workspaceRoot), `${areaSlug}.json`);
}

function readJson(file: string): unknown {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function wordBoundaryIncludes(haystack: string, needle: string): boolean {
  return geoWordBoundaryIncludes(haystack, needle);
}

function finitePoint(value: { latitude?: unknown; longitude?: unknown } | null | undefined): {
  latitude: number;
  longitude: number;
} | null {
  return geoFinitePoint(value);
}

export function classifySupportedCategory(types: string[] = [], name = ""): SupportedLocalEvidenceCategory {
  return classifySupportedCategoryFromTypes(types, name);
}

export function classifyRequestedEvidenceCategory(
  requested: SupportedLocalEvidenceCategory,
  types: string[] = [],
  name = "",
) {
  return classifyEvidenceForRequestedCategory(requested, types, name);
}

/**
 * Deterministic area attribution. A matching place name alone is not enough.
 * Near-the-pharmacy is not enough. Distant same-name localities are rejected.
 */
export function attributeEntityToArea(
  entity: AttributionInput,
  ctx: AreaAttributionContext,
): { ok: true; relationship: LocalEvidenceAttributionRelationship } | { ok: false; rejectionReason: string } {
  const name = String(entity.name || "").trim();
  const address = String(entity.address || "").trim();
  if (!name) return { ok: false, rejectionReason: "weak-name" };
  if (/pharmacy|chemist|boots|rowlands|lloyds|superdrug/i.test(`${name} ${address}`)) {
    return { ok: false, rejectionReason: "competitor-pharmacy" };
  }

  const geo = evaluateGeographicCompatibility(entity, ctx);
  if (!geo.ok) return geo;

  const area = ctx.areaName.trim();
  if (addressContainsRequestedLocality(address, area)) {
    return { ok: true, relationship: "name-in-address" };
  }
  if (entity.locality && addressContainsRequestedLocality(entity.locality, area)) {
    return { ok: true, relationship: "verified-locality-component" };
  }
  if (wordBoundaryIncludes(name, area)) {
    const entityPoint = finitePoint(entity.location || null);
    const pharmacy = finitePoint(ctx.pharmacyCoordinates || null);
    const centroid = finitePoint(ctx.areaCentroid || null);
    const nearCentroid = Boolean(
      entityPoint && centroid && haversineKm(centroid, entityPoint) <= AREA_CENTROID_ATTRIBUTION_MAX_KM,
    );
    const nearPharmacy = Boolean(
      entityPoint && pharmacy && haversineKm(pharmacy, entityPoint) <= (ctx.maxDistanceFromPharmacyKm || 20),
    );
    if (!address && !entityPoint) {
      return { ok: false, rejectionReason: "geographic-ambiguity" };
    }
    if (nearCentroid || nearPharmacy || address) {
      return { ok: true, relationship: "name-in-entity" };
    }
    return { ok: false, rejectionReason: "geographic-ambiguity" };
  }

  const entityPoint = finitePoint(entity.location || null);
  const centroid = finitePoint(ctx.areaCentroid || null);
  if (entityPoint && centroid) {
    const km = haversineKm(centroid, entityPoint);
    if (km <= AREA_CENTROID_ATTRIBUTION_MAX_KM) {
      return { ok: true, relationship: "area-centroid-proximity" };
    }
    return { ok: false, rejectionReason: "outside-area-centroid" };
  }

  const pharmacy = finitePoint(ctx.pharmacyCoordinates || null);
  if (entityPoint && pharmacy) {
    const km = haversineKm(pharmacy, entityPoint);
    if (km <= AREA_CENTROID_ATTRIBUTION_MAX_KM) {
      return { ok: false, rejectionReason: "pharmacy-radial-unattributable" };
    }
  }

  return { ok: false, rejectionReason: "unattributable-to-requested-area" };
}

export function entityIdentityKey(entity: { placeId?: string; name?: string; address?: string }): string {
  const placeId = String(entity.placeId || "").trim();
  if (placeId) return `place:${placeId}`;
  return `name:${slugifyArea(`${entity.name || ""}|${entity.address || ""}`)}`;
}

/**
 * Assign each entity to at most one area (best attribution). Prevents one generic place filling every pack.
 */
export function assignEntitiesToExclusiveAreas(
  entities: AttributionInput[],
  areas: AreaAttributionContext[],
): Map<string, AttributionInput[]> {
  const assigned = new Map<string, AttributionInput[]>();
  for (const area of areas) assigned.set(area.areaSlug, []);
  const claimed = new Set<string>();

  for (const entity of entities) {
    const key = entityIdentityKey(entity);
    if (claimed.has(key)) continue;
    const matches: Array<{ area: AreaAttributionContext; rank: number }> = [];
    for (const area of areas) {
      const result = attributeEntityToArea(entity, area);
      if (!result.ok) continue;
      const rank =
        result.relationship === "name-in-address" ? 4
        : result.relationship === "name-in-entity" ? 3
        : result.relationship === "verified-locality-component" ? 2
        : 1;
      matches.push({ area, rank });
    }
    if (matches.length !== 1 && matches.every((m) => m.rank <= 1) && matches.length > 1) {
      continue;
    }
    matches.sort((a, b) => b.rank - a.rank);
    const winner = matches[0];
    if (!winner) continue;
    if (matches.length > 1 && matches[1]!.rank === winner.rank) continue;
    claimed.add(key);
    assigned.get(winner.area.areaSlug)!.push(entity);
  }
  return assigned;
}

export function resolveAuthoritativeCampaignTargetAreas(slug: string): string[] {
  const session = loadCampaignBuilderSession(slug);
  const fromSession = (session.targetAreaNames || []).map((name) => String(name || "").trim()).filter(Boolean);
  if (fromSession.length) return fromSession;
  const profileFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  const doc = readJson(profileFile) as {
    data?: { selectedAreas?: Array<{ areaName?: string; selected?: boolean }> };
  } | null;
  return (doc?.data?.selectedAreas || [])
    .filter((area) => area && area.selected !== false)
    .map((area) => String(area.areaName || "").trim())
    .filter(Boolean);
}

export function resolvePharmacyEvidenceCoordinates(slug: string): PharmacyEvidenceCoordinates | null {
  const google = resolvePharmacyGoogleLocation(slug);
  if (google) {
    return { latitude: google.latitude, longitude: google.longitude, source: google.source };
  }
  const profileFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  const doc = readJson(profileFile) as { data?: Record<string, unknown> } | null;
  const data = normalizeProfileData(doc?.data || {});
  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { latitude: lat, longitude: lng, source: "profile:coordinates" };
  }
  const marketFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/growth-engine", `${slug}-competitors.json`);
  const market = readJson(marketFile) as {
    pharmacy?: { latitude?: number; longitude?: number };
    yourPharmacy?: { latitude?: number; longitude?: number };
  } | null;
  const mlat = Number(market?.pharmacy?.latitude ?? market?.yourPharmacy?.latitude);
  const mlng = Number(market?.pharmacy?.longitude ?? market?.yourPharmacy?.longitude);
  if (Number.isFinite(mlat) && Number.isFinite(mlng) && (mlat !== 0 || mlng !== 0)) {
    return { latitude: mlat, longitude: mlng, source: "local-market:pharmacy" };
  }
  return null;
}

export function planPharmacyLocalEvidenceRequest(slug: string, serviceId?: string): LocalEvidenceRequestPlan {
  const session = loadCampaignBuilderSession(slug);
  const areas = resolveAuthoritativeCampaignTargetAreas(slug).map((areaName) => ({
    areaName,
    areaSlug: slugifyArea(areaName),
  }));
  const profileFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  const doc = readJson(profileFile) as { data?: { pharmacyName?: string } } | null;
  const pharmacyName = String(doc?.data?.pharmacyName || "").trim();
  return {
    slug,
    serviceId: String(serviceId || session.selectedServiceId || "").trim(),
    pharmacyName,
    pharmacyCoordinates: resolvePharmacyEvidenceCoordinates(slug),
    areas,
    blueprintRequired: false,
  };
}

function isEntity(value: unknown): value is LocalEvidenceEntity {
  if (!value || typeof value !== "object") return false;
  const row = value as LocalEvidenceEntity;
  return Boolean(String(row.name || "").trim()) && Boolean(row.provider) && Boolean(row.retrievedAt);
}

export function attributableEntities(pack: PharmacyLocalEvidencePackV3): LocalEvidenceEntity[] {
  return SUPPORTED_LOCAL_EVIDENCE_CATEGORIES.flatMap((key) => pack[key] || []);
}

export function isRecordedPharmacyRelationship(
  value: unknown,
  expectedAreaSlug?: string,
): value is LocalEvidencePharmacyRelationship {
  if (!value || typeof value !== "object") return false;
  const row = value as LocalEvidencePharmacyRelationship;
  const from = String(row.from || "").trim();
  const to = String(row.to || "").trim();
  if (row.method !== LOCAL_EVIDENCE_DISTANCE_METHOD) return false;
  if (!Number.isFinite(row.distanceKm) || row.distanceKm < 0) return false;
  if (!from || !to) return false;
  if (/travel time|driving|route distance|convenience|availability/i.test(`${from} ${to} ${row.areaReferenceSource || ""}`)) {
    return false;
  }
  if (expectedAreaSlug && slugifyArea(to) !== expectedAreaSlug) return false;
  return Boolean(String(row.areaReferenceSource || "").trim());
}

export function recordedPharmacyRelationshipFromDistance(opts: {
  pharmacyName: string;
  areaName: string;
  areaSlug: string;
  distanceKm: number | null | undefined;
  areaReferenceSource?: string;
}): LocalEvidencePharmacyRelationship | null {
  if (opts.distanceKm == null || !Number.isFinite(opts.distanceKm) || opts.distanceKm < 0) return null;
  const from = String(opts.pharmacyName || "").trim();
  const to = String(opts.areaName || "").trim();
  const areaSlug = String(opts.areaSlug || "").trim();
  const areaReferenceSource = String(opts.areaReferenceSource || "places-area-reference").trim();
  if (!from || !to || !areaSlug || slugifyArea(to) !== areaSlug) return null;
  return {
    from,
    to,
    distanceKm: Number(Number(opts.distanceKm).toFixed(1)),
    method: LOCAL_EVIDENCE_DISTANCE_METHOD,
    areaReferenceSource,
  };
}

export type LocalEvidencePackGenerationReasonCode =
  | "missing"
  | "stale"
  | "contaminated"
  | "empty-optional-evidence";

export type LocalEvidencePackValidationResult =
  | { ok: true; pack: PharmacyLocalEvidencePackV3 }
  | {
      ok: false;
      status: LocalEvidenceAreaStatus;
      detail: string;
      reasonCode: LocalEvidencePackGenerationReasonCode;
    };

export function validatePharmacyLocalEvidencePack(
  value: unknown,
  expected: { slug: string; areaName: string; areaSlug: string; pharmacyCoordinates?: PharmacyEvidenceCoordinates | null },
): LocalEvidencePackValidationResult {
  if (!value || typeof value !== "object") {
    return { ok: false, status: "missing", detail: "Pack file is missing or unreadable.", reasonCode: "missing" };
  }
  const pack = value as Partial<PharmacyLocalEvidencePackV3>;
  if (pack.version !== LOCAL_EVIDENCE_PACK_SCHEMA_VERSION) {
    return {
      ok: false,
      status: "stale",
      detail: "Pack schema is not the current evidence contract.",
      reasonCode: "stale",
    };
  }
  if (String(pack.slug || "") !== expected.slug) {
    return {
      ok: false,
      status: "stale",
      detail: "Pack pharmacy slug does not match the campaign.",
      reasonCode: "stale",
    };
  }
  if (slugifyArea(String(pack.area || "")) !== expected.areaSlug || String(pack.areaSlug || "") !== expected.areaSlug) {
    return {
      ok: false,
      status: "stale",
      detail: "Pack area identity does not match the saved Campaign Builder area.",
      reasonCode: "stale",
    };
  }
  if (!pack.generatedAt || !pack.provider || !pack.sourceStatus) {
    return { ok: false, status: "stale", detail: "Pack provenance is incomplete.", reasonCode: "stale" };
  }
  if (!pack.pharmacyCoordinates || !Number.isFinite(pack.pharmacyCoordinates.latitude)) {
    return {
      ok: false,
      status: "stale",
      detail: "Pack is missing pharmacy coordinates used during discovery.",
      reasonCode: "stale",
    };
  }
  const current = expected.pharmacyCoordinates;
  if (current) {
    const drift = haversineKm(current, pack.pharmacyCoordinates);
    if (drift > 0.15) {
      return {
        ok: false,
        status: "stale",
        detail: "Pack pharmacy coordinates no longer match the stored pharmacy location.",
        reasonCode: "stale",
      };
    }
  }
  const entities = SUPPORTED_LOCAL_EVIDENCE_CATEGORIES.flatMap((key) =>
    Array.isArray(pack[key]) ? (pack[key] as LocalEvidenceEntity[]).filter(isEntity) : [],
  );
  const siblings = resolveAuthoritativeCampaignTargetAreas(expected.slug);
  const geoCtx = resolveGeographicEvidenceContext({
    slug: expected.slug,
    areaName: expected.areaName,
    areaSlug: expected.areaSlug,
    siblingAreaNames: siblings.length ? siblings : [expected.areaName],
    pharmacyCoordinates: expected.pharmacyCoordinates || pack.pharmacyCoordinates || null,
  });
  if (!geoCtx.areaCentroid) {
    geoCtx.areaCentroid = resolveAreaCentroidFromRecordedReference(expected.slug, expected.areaSlug);
  }
  const contaminated: string[] = [];
  for (const entity of entities) {
    const attributed = attributeEntityToArea(entity, geoCtx);
    if (!attributed.ok) {
      contaminated.push(`${entity.name}: ${attributed.rejectionReason}`);
      continue;
    }
    const classified = classifyEvidenceForRequestedCategory(entity.category, entity.types || [], entity.name);
    if (!classified.ok) {
      contaminated.push(`${entity.name}: ${classified.rejectionReason}`);
    }
  }
  if (contaminated.length) {
    return {
      ok: false,
      status: "evidence-limited",
      detail: `Pack contains geographically incompatible or ambiguous evidence (${contaminated.length}): ${contaminated.slice(0, 4).join("; ")}.`,
      reasonCode: "contaminated",
    };
  }
  const hasRelationship = isRecordedPharmacyRelationship(pack.pharmacyRelationship, expected.areaSlug);
  if (entities.length === 0 && !hasRelationship) {
    return {
      ok: false,
      status: "evidence-limited",
      detail: "Pack has no attributable local evidence item.",
      reasonCode: "empty-optional-evidence",
    };
  }
  if (pack.evidenceLimited === true && !hasRelationship) {
    return {
      ok: false,
      status: "evidence-limited",
      detail: "Pack has no attributable local evidence item.",
      reasonCode: "empty-optional-evidence",
    };
  }
  return { ok: true, pack: pack as PharmacyLocalEvidencePackV3 };
}

/** Empty optional local facts are a recorded outcome. Contaminated or stale packs still block generation. */
export function loadLocalEvidencePackForGeneration(
  slug: string,
  areaName: string,
  areaSlug: string,
  pharmacyCoordinates?: PharmacyEvidenceCoordinates | null,
):
  | { ok: true; pack: PharmacyLocalEvidencePackV3; sparse: boolean }
  | { ok: false; status: LocalEvidenceAreaStatus; detail: string; reasonCode: LocalEvidencePackGenerationReasonCode } {
  const raw = loadPharmacyLocalEvidencePack(slug, areaSlug);
  const checked = validatePharmacyLocalEvidencePack(raw, {
    slug,
    areaName,
    areaSlug,
    pharmacyCoordinates,
  });
  if (checked.ok) return { ok: true, pack: checked.pack, sparse: false };
  if (checked.reasonCode === "empty-optional-evidence" && raw && typeof raw === "object") {
    return { ok: true, pack: raw as PharmacyLocalEvidencePackV3, sparse: true };
  }
  return checked;
}

export function loadPharmacyLocalEvidencePack(
  slug: string,
  areaSlug: string,
  workspaceRoot = PHARMACY_WORKSPACE_ROOT,
): unknown {
  return readJson(localEvidencePackPath(slug, areaSlug, workspaceRoot));
}

export function localEvidenceNotReadyCustomerError(areaNames: string[]): string {
  const list = areaNames.filter(Boolean);
  if (!list.length) {
    return "Local pages cannot be generated yet because verified area evidence is missing or insufficient.";
  }
  return `Local pages cannot be generated yet because verified area evidence is missing or insufficient for: ${list.join(", ")}.`;
}

export function preflightPharmacyLocalEvidenceForCampaign(
  slug: string,
  serviceId?: string,
  workspaceRoot = PHARMACY_WORKSPACE_ROOT,
): LocalEvidencePreflightResult {
  const plan = planPharmacyLocalEvidenceRequest(slug, serviceId);

  if (!plan.areas.length) {
    return {
      ok: false,
      ready: false,
      slug,
      serviceId: plan.serviceId,
      areas: [],
      readyAreas: [],
      missingAreas: [],
      staleAreas: [],
      evidenceLimitedAreas: [],
      customerError: "Local pages cannot be generated yet because no Campaign Builder target areas are saved.",
    };
  }

  const areas: LocalEvidenceAreaPreflight[] = [];
  for (const area of plan.areas) {
    const file = localEvidencePackPath(slug, area.areaSlug, workspaceRoot);
    if (!fs.existsSync(file)) {
      areas.push({
        areaName: area.areaName,
        areaSlug: area.areaSlug,
        status: "missing",
        detail: "No current evidence pack is stored for this area.",
      });
      continue;
    }
    const validated = validatePharmacyLocalEvidencePack(readJson(file), {
      slug,
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      pharmacyCoordinates: plan.pharmacyCoordinates,
    });
    if (!validated.ok) {
      areas.push({
        areaName: area.areaName,
        areaSlug: area.areaSlug,
        status: validated.status,
        detail: validated.detail,
      });
      continue;
    }
    areas.push({
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      status: "ready",
      detail: `${validated.pack.qualitySummary.attributableCount} attributable local evidence items.`,
    });
  }

  const readyAreas = areas.filter((a) => a.status === "ready").map((a) => a.areaName);
  const missingAreas = areas.filter((a) => a.status === "missing").map((a) => a.areaName);
  const staleAreas = areas.filter((a) => a.status === "stale").map((a) => a.areaName);
  const evidenceLimitedAreas = areas.filter((a) => a.status === "evidence-limited").map((a) => a.areaName);
  const blocked = [...missingAreas, ...staleAreas, ...evidenceLimitedAreas];
  const ok = blocked.length === 0 && readyAreas.length === plan.areas.length;
  return {
    ok,
    ready: ok,
    slug,
    serviceId: plan.serviceId,
    areas,
    readyAreas,
    missingAreas,
    staleAreas,
    evidenceLimitedAreas,
    customerError: ok ? null : localEvidenceNotReadyCustomerError(blocked),
  };
}

export function emptyEvidencePack(input: {
  slug: string;
  area: string;
  areaSlug: string;
  pharmacyCoordinates: PharmacyEvidenceCoordinates;
  generatedAt: string;
  sourceStatus: string;
  rejected: RejectedLocalEvidenceEntity[];
}): PharmacyLocalEvidencePackV3 {
  return {
    version: LOCAL_EVIDENCE_PACK_SCHEMA_VERSION,
    slug: input.slug,
    area: input.area,
    areaSlug: input.areaSlug,
    provider: LOCAL_EVIDENCE_PACK_PROVIDER,
    generatedAt: input.generatedAt,
    sourceStatus: input.sourceStatus,
    pharmacyCoordinates: input.pharmacyCoordinates,
    healthcare: [],
    community: [],
    landmarks: [],
    transport: [],
    schools: [],
    retail: [],
    rejected: input.rejected,
    researchCandidates: [],
    evidenceLimited: true,
    qualitySummary: {
      attributableCount: 0,
      rejectedCount: input.rejected.length,
      categoriesPresent: [],
      minimumMet: false,
    },
  };
}

export function buildEvidencePackFromAttributedEntities(input: {
  slug: string;
  area: string;
  areaSlug: string;
  pharmacyCoordinates: PharmacyEvidenceCoordinates;
  generatedAt: string;
  sourceStatus: string;
  entities: LocalEvidenceEntity[];
  rejected: RejectedLocalEvidenceEntity[];
  researchCandidates?: RejectedLocalEvidenceEntity[];
  pharmacyRelationship?: LocalEvidencePharmacyRelationship | null;
}): PharmacyLocalEvidencePackV3 {
  const buckets: Record<SupportedLocalEvidenceCategory, LocalEvidenceEntity[]> = {
    healthcare: [],
    community: [],
    landmarks: [],
    transport: [],
    schools: [],
    retail: [],
  };
  for (const entity of input.entities) {
    buckets[entity.category].push(entity);
  }
  const relationship = isRecordedPharmacyRelationship(input.pharmacyRelationship, input.areaSlug)
    ? input.pharmacyRelationship
    : null;
  const attributableCount = input.entities.length + (relationship ? 1 : 0);
  const categoriesPresent = SUPPORTED_LOCAL_EVIDENCE_CATEGORIES.filter((key) => buckets[key].length > 0);
  return {
    version: LOCAL_EVIDENCE_PACK_SCHEMA_VERSION,
    slug: input.slug,
    area: input.area,
    areaSlug: input.areaSlug,
    provider: LOCAL_EVIDENCE_PACK_PROVIDER,
    generatedAt: input.generatedAt,
    sourceStatus: input.sourceStatus,
    pharmacyCoordinates: input.pharmacyCoordinates,
    ...buckets,
    rejected: input.rejected,
    researchCandidates: input.researchCandidates || [],
    pharmacyRelationship: relationship || undefined,
    evidenceLimited: attributableCount < 1,
    qualitySummary: {
      attributableCount,
      rejectedCount: input.rejected.length,
      categoriesPresent,
      minimumMet: attributableCount >= 1,
    },
  };
}

export function writePharmacyLocalEvidencePack(
  pack: PharmacyLocalEvidencePackV3,
  workspaceRoot = PHARMACY_WORKSPACE_ROOT,
): string {
  const file = localEvidencePackPath(pack.slug, pack.areaSlug, workspaceRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(pack, null, 2));
  return file;
}

export function pageContainsAttributableEvidence(html: string, entityNames: string[]): boolean {
  return entityNames.some((name) => visibleCopyContainsVerifiedEvidenceName(html, name));
}

/** Test-only: load a session plan without requiring a content blueprint. */
export function campaignBuilderAreasAreEvidenceInput(slug: string): string[] {
  return resolveAuthoritativeCampaignTargetAreas(slug);
}
