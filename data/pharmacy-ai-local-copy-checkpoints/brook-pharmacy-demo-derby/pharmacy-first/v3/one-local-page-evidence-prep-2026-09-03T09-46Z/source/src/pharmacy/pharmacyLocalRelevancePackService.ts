/**
 * Local relevance packs — explicit discovery only.
 * Authoritative area input: Campaign Builder targetAreaNames.
 * Do not call from Preview or Review Centre.
 */
import {
  LOCAL_EVIDENCE_PACK_PROVIDER,
  PHARMACY_LOCAL_EVIDENCE_DISCOVERY_FUNCTION,
  attributableEntities,
  attributeEntityToArea,
  assignEntitiesToExclusiveAreas,
  buildEvidencePackFromAttributedEntities,
  classifyRequestedEvidenceCategory,
  emptyEvidencePack,
  entityIdentityKey,
  loadPharmacyLocalEvidencePack,
  localEvidencePackDirectory,
  planPharmacyLocalEvidenceRequest,
  writePharmacyLocalEvidencePack,
  type AttributionInput,
  type LocalEvidenceEntity,
  type RejectedLocalEvidenceEntity,
  type SupportedLocalEvidenceCategory,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import {
  buildDisambiguatedEvidenceQuery,
  finitePoint,
  regionCodeFromContext,
  resolveGeographicEvidenceContext,
  searchRadiusMeters,
  type AddressComponentLike,
  type GeographicEvidenceContext,
} from "./contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { hasGooglePlacesApiKey } from "./googlePlacesConnection.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import fs from "node:fs";
import path from "node:path";

export { PHARMACY_LOCAL_EVIDENCE_DISCOVERY_FUNCTION };

export const LOCAL_EVIDENCE_CATEGORY_QUERIES: Array<{
  category: SupportedLocalEvidenceCategory;
  phrase: string;
  maxResultCount: number;
}> = [
  { category: "healthcare", phrase: "GP surgeries medical centres walk-in centres NHS", maxResultCount: 8 },
  { category: "schools", phrase: "schools primary secondary", maxResultCount: 6 },
  { category: "community", phrase: "libraries community centres leisure centres sports centres", maxResultCount: 8 },
  { category: "landmarks", phrase: "parks landmarks memorial", maxResultCount: 8 },
  { category: "retail", phrase: "retail parks shopping centres", maxResultCount: 6 },
  { category: "transport", phrase: "train station bus station transport", maxResultCount: 5 },
];

type PlacesHit = AttributionInput & {
  types: string[];
  location: { latitude: number; longitude: number } | null;
  sourceRef?: string;
  requestedCategory: SupportedLocalEvidenceCategory;
};

export interface LocalEvidenceDiscoveryOptions {
  areaNames?: string[];
  maxProviderCalls?: number;
}

export interface LocalEvidenceDiscoveryResult {
  slug: string;
  generatedAt: string;
  pageCount: number;
  providerCallsAttempted: number;
  providerCallsSuccessful: number;
  providerCallsFailed: number;
  skippedAreas: string[];
  packs: Array<{ area: string; areaSlug: string; evidenceLimited: boolean; attributableCount: number }>;
}

async function googlePlacesSearch(
  query: string,
  geo: GeographicEvidenceContext,
  maxResultCount = 6,
): Promise<PlacesHit[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  const pharmacy = finitePoint(geo.pharmacyCoordinates || null);
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount,
  };
  const regionCode = regionCodeFromContext(geo);
  if (regionCode) body.regionCode = regionCode;
  if (pharmacy) {
    body.locationBias = {
      circle: {
        center: { latitude: pharmacy.latitude, longitude: pharmacy.longitude },
        radius: searchRadiusMeters(geo),
      },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.types,places.location,places.googleMapsUri,places.addressComponents",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error("Local evidence discovery could not complete. Try again later.");
  }

  const data = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      types?: string[];
      location?: { latitude?: number; longitude?: number };
      googleMapsUri?: string;
      addressComponents?: AddressComponentLike[];
    }>;
  };
  return (data.places || [])
    .map((p) => ({
      name: p.displayName?.text || "",
      address: p.formattedAddress || "",
      types: p.types || [],
      location: p.location?.latitude != null && p.location?.longitude != null
        ? { latitude: Number(p.location.latitude), longitude: Number(p.location.longitude) }
        : null,
      placeId: String(p.id || "").replace(/^places\//, ""),
      locality: p.formattedAddress || "",
      addressComponents: p.addressComponents || [],
      sourceRef: p.googleMapsUri || "",
      requestedCategory: "community" as SupportedLocalEvidenceCategory,
    }))
    .filter((p) => p.name && !/pharmacy|chemist|boots|rowlands|asda/i.test(p.name));
}

function entityWithDiagnostics(
  hit: PlacesHit,
  areaName: string,
  category: SupportedLocalEvidenceCategory,
  relationship: LocalEvidenceEntity["relationship"],
  retrievedAt: string,
  confidence: number,
): LocalEvidenceEntity {
  return {
    name: hit.name || "",
    address: String(hit.address || ""),
    category,
    types: hit.types || [],
    location: hit.location,
    placeId: String(hit.placeId || ""),
    source: LOCAL_EVIDENCE_PACK_PROVIDER,
    provider: LOCAL_EVIDENCE_PACK_PROVIDER,
    retrievedAt,
    sourceRef: hit.sourceRef || hit.placeId || "",
    confidence,
    relationship,
    areaName,
  };
}

function mergeIndex(
  slug: string,
  generatedAt: string,
  summaries: Array<{ area: string; areaSlug: string; evidenceLimited: boolean; attributableCount: number }>,
  replacedSlugs: Set<string>,
): void {
  const dir = localEvidencePackDirectory(slug);
  const indexFile = path.join(dir, "_index.json");
  let existing: {
    slug?: string;
    version?: string;
    generatedAt?: string;
    pageCount?: number;
    provider?: string;
    packs?: Array<{ area: string; areaSlug: string; evidenceLimited: boolean; attributableCount: number }>;
  } = {};
  if (fs.existsSync(indexFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    } catch {
      existing = {};
    }
  }
  const kept = (existing.packs || []).filter((row) => !replacedSlugs.has(row.areaSlug));
  const packs = [...kept, ...summaries];
  fs.writeFileSync(
    indexFile,
    JSON.stringify(
      {
        slug,
        version: "v3",
        generatedAt,
        pageCount: packs.length,
        provider: LOCAL_EVIDENCE_PACK_PROVIDER,
        packs,
      },
      null,
      2,
    ),
  );
}

/**
 * Explicit controlled discovery. Never invoked by Preview, Review Centre, or page render.
 * Campaign Builder target areas are the only area input. A content blueprint is not required.
 * Pass areaNames to rebuild a subset without touching other stored packs.
 */
export async function runPharmacyLocalEvidenceDiscovery(
  slug: string,
  options: LocalEvidenceDiscoveryOptions = {},
): Promise<LocalEvidenceDiscoveryResult> {
  if (!hasGooglePlacesApiKey()) {
    throw new Error("Local pages cannot be generated yet because verified area evidence is missing or insufficient.");
  }
  const plan = planPharmacyLocalEvidenceRequest(slug);
  if (!plan.areas.length) {
    throw new Error("Local pages cannot be generated yet because no Campaign Builder target areas are saved.");
  }
  if (!plan.pharmacyCoordinates) {
    throw new Error("Local pages cannot be generated yet because the pharmacy location is not confirmed.");
  }

  const requested = (options.areaNames || []).map((name) => String(name || "").trim()).filter(Boolean);
  const planNames = plan.areas.map((a) => a.areaName);
  if (requested.length) {
    const unknown = requested.filter((name) => !planNames.some((planName) => planName.toLowerCase() === name.toLowerCase()));
    if (unknown.length) {
      throw new Error(`Local evidence discovery cannot run for areas that are not saved Campaign Builder targets: ${unknown.join(", ")}.`);
    }
  }
  const targetAreas = requested.length
    ? plan.areas.filter((area) => requested.some((name) => name.toLowerCase() === area.areaName.toLowerCase()))
    : plan.areas;

  const generatedAt = new Date().toISOString();
  const siblingNames = plan.areas.map((a) => a.areaName);
  const areaContexts: GeographicEvidenceContext[] = targetAreas.map((area) =>
    resolveGeographicEvidenceContext({
      slug,
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      siblingAreaNames: siblingNames,
      pharmacyCoordinates: plan.pharmacyCoordinates,
    }),
  );

  const maxCalls = Number.isFinite(Number(options.maxProviderCalls))
    ? Math.max(0, Number(options.maxProviderCalls))
    : Number.POSITIVE_INFINITY;
  let attempted = 0;
  let successful = 0;
  let failed = 0;
  const skippedAreas: string[] = [];
  const hitsByArea = new Map<string, PlacesHit[]>();
  const rejectedByArea = new Map<string, RejectedLocalEvidenceEntity[]>();

  for (const area of targetAreas) {
    const geo = areaContexts.find((c) => c.areaSlug === area.areaSlug)!;
    rejectedByArea.set(area.areaSlug, []);
    const remaining = maxCalls - attempted;
    if (remaining < LOCAL_EVIDENCE_CATEGORY_QUERIES.length) {
      skippedAreas.push(area.areaName);
      rejectedByArea.get(area.areaSlug)!.push({
        name: "",
        address: "",
        rejectionReason: "provider-call-cap-reached",
      });
      hitsByArea.set(area.areaSlug, []);
      continue;
    }
    const areaHits: PlacesHit[] = [];
    for (const spec of LOCAL_EVIDENCE_CATEGORY_QUERIES) {
      const query = buildDisambiguatedEvidenceQuery(spec.phrase, geo);
      attempted += 1;
      try {
        const hits = await googlePlacesSearch(query, geo, spec.maxResultCount);
        successful += 1;
        for (const hit of hits) {
          areaHits.push({ ...hit, requestedCategory: spec.category });
        }
      } catch {
        failed += 1;
        rejectedByArea.get(area.areaSlug)!.push({
          name: "",
          address: "",
          category: spec.category,
          rejectionReason: "provider-request-failed",
        });
      }
    }
    hitsByArea.set(area.areaSlug, areaHits);
  }

  const reservedPlaceIds = new Set<string>();
  const targetSlugSet = new Set(targetAreas.map((area) => area.areaSlug));
  for (const area of plan.areas) {
    if (targetSlugSet.has(area.areaSlug)) continue;
    const stored = loadPharmacyLocalEvidencePack(slug, area.areaSlug);
    if (!stored || typeof stored !== "object") continue;
    for (const entity of attributableEntities(stored as Parameters<typeof attributableEntities>[0])) {
      const placeId = String(entity.placeId || "").trim();
      if (placeId) reservedPlaceIds.add(placeId);
    }
  }

  const allHits: PlacesHit[] = [];
  const seen = new Set<string>();
  for (const hits of hitsByArea.values()) {
    for (const hit of hits) {
      const key = entityIdentityKey(hit);
      if (seen.has(key)) continue;
      if (hit.placeId && reservedPlaceIds.has(String(hit.placeId))) continue;
      seen.add(key);
      allHits.push(hit);
    }
  }
  const exclusive = assignEntitiesToExclusiveAreas(allHits, areaContexts);

  fs.mkdirSync(localEvidencePackDirectory(slug), { recursive: true });
  const summaries = [];
  const replacedSlugs = new Set<string>();
  for (const area of targetAreas) {
    if (skippedAreas.includes(area.areaName)) {
      const pack = emptyEvidencePack({
        slug,
        area: area.areaName,
        areaSlug: area.areaSlug,
        pharmacyCoordinates: plan.pharmacyCoordinates,
        generatedAt,
        sourceStatus: "google-places-live",
        rejected: rejectedByArea.get(area.areaSlug) || [],
      });
      writePharmacyLocalEvidencePack(pack);
      replacedSlugs.add(pack.areaSlug);
      summaries.push({
        area: pack.area,
        areaSlug: pack.areaSlug,
        evidenceLimited: pack.evidenceLimited,
        attributableCount: pack.qualitySummary.attributableCount,
      });
      continue;
    }
    const ctx = areaContexts.find((c) => c.areaSlug === area.areaSlug)!;
    const attributed: LocalEvidenceEntity[] = [];
    const rejected = rejectedByArea.get(area.areaSlug) || [];
    const exclusiveHits = exclusive.get(area.areaSlug) || [];
    const claimed = new Set(exclusiveHits.map((hit) => entityIdentityKey(hit)));
    const hitsByKey = new Map(
      (hitsByArea.get(area.areaSlug) || []).map((hit) => [entityIdentityKey(hit), hit] as const),
    );
    for (const hit of hitsByArea.get(area.areaSlug) || []) {
      const classified = classifyRequestedEvidenceCategory(hit.requestedCategory, hit.types || [], hit.name || "");
      if (!classified.ok) {
        rejected.push({
          name: hit.name || "",
          address: String(hit.address || ""),
          category: hit.requestedCategory,
          types: hit.types,
          location: hit.location,
          placeId: hit.placeId,
          rejectionReason: classified.rejectionReason,
        });
        continue;
      }
      const result = attributeEntityToArea(hit, ctx);
      if (!result.ok) {
        rejected.push({
          name: hit.name || "",
          address: String(hit.address || ""),
          category: hit.requestedCategory,
          types: hit.types,
          location: hit.location,
          placeId: hit.placeId,
          rejectionReason: result.rejectionReason,
        });
      }
    }
    for (const assigned of exclusiveHits) {
      const hit = hitsByKey.get(entityIdentityKey(assigned));
      if (!hit) continue;
      const classified = classifyRequestedEvidenceCategory(
        hit.requestedCategory,
        hit.types || [],
        hit.name || "",
      );
      if (!classified.ok) continue;
      const result = attributeEntityToArea(hit, ctx);
      if (!result.ok) continue;
      if (!claimed.has(entityIdentityKey(hit))) continue;
      attributed.push(
        entityWithDiagnostics(
          hit,
          area.areaName,
          classified.category,
          result.relationship,
          generatedAt,
          result.relationship === "name-in-address" ? 92
            : result.relationship === "name-in-entity" ? 84
            : result.relationship === "verified-locality-component" ? 76
            : 64,
        ),
      );
    }

    const pack = attributed.length
      ? buildEvidencePackFromAttributedEntities({
          slug,
          area: area.areaName,
          areaSlug: area.areaSlug,
          pharmacyCoordinates: plan.pharmacyCoordinates,
          generatedAt,
          sourceStatus: "google-places-live",
          entities: attributed,
          rejected,
        })
      : emptyEvidencePack({
          slug,
          area: area.areaName,
          areaSlug: area.areaSlug,
          pharmacyCoordinates: plan.pharmacyCoordinates,
          generatedAt,
          sourceStatus: "google-places-live",
          rejected,
        });
    writePharmacyLocalEvidencePack(pack);
    replacedSlugs.add(pack.areaSlug);
    summaries.push({
      area: pack.area,
      areaSlug: pack.areaSlug,
      evidenceLimited: pack.evidenceLimited,
      attributableCount: pack.qualitySummary.attributableCount,
    });
  }

  mergeIndex(slug, generatedAt, summaries, replacedSlugs);
  return {
    slug,
    generatedAt,
    pageCount: summaries.length,
    providerCallsAttempted: attempted,
    providerCallsSuccessful: successful,
    providerCallsFailed: failed,
    skippedAreas,
    packs: summaries,
  };
}

/** Explicit discovery entry used by operators/jobs. Not part of Preview or Review Centre. */
export async function generatePharmacyLocalRelevancePacks(slug: string) {
  return runPharmacyLocalEvidenceDiscovery(slug);
}

export function loadPharmacyLocalRelevancePack(slug: string, area: string) {
  const areaSlug = slugifyArea(area);
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-relevance-packs", slug, `${areaSlug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
