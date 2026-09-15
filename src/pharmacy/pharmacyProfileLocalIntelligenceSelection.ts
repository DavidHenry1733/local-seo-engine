/**
 * Pharmacy Profile Local Intelligence Selection V1 —
 * generate, group, select and map local entities for profile storage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LocalEntityInput } from "./localRelevanceScoring.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/pharmacy/service-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();

export const ENTITY_GROUP_KEYS = [
  "gpSurgeries",
  "hospitals",
  "healthCentres",
  "careHomes",
  "schools",
  "landmarks",
  "communityFacilities",
  "transportLinks",
  "retailCentres",
  "residentialAreas",
] as const;

export type EntityGroupKey = (typeof ENTITY_GROUP_KEYS)[number];
/** @deprecated Removed from selection UI — retained for reading saved profiles */
export type LegacyEntityGroupKey = "majorEmployers";
export type StoredEntityGroupKey = EntityGroupKey | LegacyEntityGroupKey;

export interface ProfileLocalEntity {
  id: string;
  name: string;
  address: string;
  category: string;
  entityType: StoredEntityGroupKey;
  distanceKm: number | null;
  distanceLabel: string;
  source: "Google Places" | "local intelligence" | "demo pack";
  types: string[];
  selected?: boolean;
}

export interface GeneratedLocalIntelligenceGroups {
  gpSurgeries: ProfileLocalEntity[];
  hospitals: ProfileLocalEntity[];
  healthCentres: ProfileLocalEntity[];
  careHomes: ProfileLocalEntity[];
  schools: ProfileLocalEntity[];
  landmarks: ProfileLocalEntity[];
  communityFacilities: ProfileLocalEntity[];
  transportLinks: ProfileLocalEntity[];
  retailCentres: ProfileLocalEntity[];
  residentialAreas: ProfileLocalEntity[];
}

export interface GeneratedLocalIntelligenceResult {
  slug: string;
  generatedAt: string;
  source: string;
  researchStatus: string;
  town: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  groups: GeneratedLocalIntelligenceGroups;
  totals: Record<EntityGroupKey, number>;
}

export const SELECTION_LIMITS: Record<EntityGroupKey, number> = {
  gpSurgeries: 8,
  hospitals: 4,
  healthCentres: 6,
  careHomes: 8,
  schools: 8,
  landmarks: 8,
  communityFacilities: 8,
  transportLinks: 6,
  retailCentres: 6,
  residentialAreas: 10,
};

export const ENTITY_GROUP_LABELS: Record<EntityGroupKey, string> = {
  gpSurgeries: "GP Surgeries",
  hospitals: "Hospitals",
  healthCentres: "Health Centres",
  careHomes: "Care Homes",
  schools: "Schools",
  landmarks: "Landmarks",
  communityFacilities: "Community Facilities",
  transportLinks: "Transport Links",
  retailCentres: "Retail Centres",
  residentialAreas: "Residential Areas",
};

const HEALTHCARE_GROUPS: EntityGroupKey[] = [
  "gpSurgeries",
  "hospitals",
  "healthCentres",
  "careHomes",
];

const COMMUNITY_GROUPS: EntityGroupKey[] = [
  "schools",
  "landmarks",
  "communityFacilities",
  "transportLinks",
  "retailCentres",
  "residentialAreas",
];

function slugify(v: string): string {
  return String(v || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function entityId(name: string, address: string, group: StoredEntityGroupKey): string {
  return slugify(`${group}-${name}-${address}`).slice(0, 80);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(a)) * 10) / 10;
}

function formatDistance(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km} km`;
}

function emptyGroups(): GeneratedLocalIntelligenceGroups {
  return {
    gpSurgeries: [],
    hospitals: [],
    healthCentres: [],
    careHomes: [],
    schools: [],
    landmarks: [],
    communityFacilities: [],
    transportLinks: [],
    retailCentres: [],
    residentialAreas: [],
  };
}

function pushUnique(
  groups: GeneratedLocalIntelligenceGroups,
  group: EntityGroupKey,
  entity: ProfileLocalEntity,
): void {
  const list = groups[group];
  if (list.some((e) => e.id === entity.id || e.name.toLowerCase() === entity.name.toLowerCase())) return;
  list.push(entity);
}

function makeEntity(
  group: StoredEntityGroupKey,
  name: string,
  opts: {
    address?: string;
    category?: string;
    source?: ProfileLocalEntity["source"];
    types?: string[];
    lat?: number | null;
    lng?: number | null;
    pharmacyLat?: number | null;
    pharmacyLng?: number | null;
  } = {},
): ProfileLocalEntity {
  const address = opts.address || "";
  let distanceKm: number | null = null;
  if (
    opts.pharmacyLat != null &&
    opts.pharmacyLng != null &&
    opts.lat != null &&
    opts.lng != null
  ) {
    distanceKm = haversineKm(opts.pharmacyLat, opts.pharmacyLng, opts.lat, opts.lng);
  }
  return {
    id: entityId(name, address, group),
    name,
    address,
    category: opts.category || (group in ENTITY_GROUP_LABELS ? ENTITY_GROUP_LABELS[group as EntityGroupKey] : "Employer"),
    entityType: group,
    distanceKm,
    distanceLabel: formatDistance(distanceKm),
    source: opts.source || "local intelligence",
    types: opts.types || [],
    selected: false,
  };
}

function isPharmacyName(name: string): boolean {
  return /pharmacy|chemist|boots|rowlands|lloyds|superdrug|well pharmacy/i.test(name);
}

function categorizeGoogleEntity(
  input: LocalEntityInput,
  ctx: { pharmacyLat?: number | null; pharmacyLng?: number | null; source: ProfileLocalEntity["source"] },
): Array<{ group: EntityGroupKey; entity: ProfileLocalEntity }> {
  const types = (input.types || []).map((t) => t.toLowerCase());
  const name = input.name.trim();
  if (!name || isPharmacyName(name)) return [];

  const lat = input.location?.latitude ?? null;
  const lng = input.location?.longitude ?? null;
  const base = {
    address: input.address || "",
    source: ctx.source,
    types,
    lat,
    lng,
    pharmacyLat: ctx.pharmacyLat,
    pharmacyLng: ctx.pharmacyLng,
  };

  const out: Array<{ group: EntityGroupKey; entity: ProfileLocalEntity }> = [];
  const lowerName = name.toLowerCase();

  if (types.includes("hospital") || /hospital|a\s*&\s*e|urgent care/i.test(name)) {
    out.push({ group: "hospitals", entity: makeEntity("hospitals", name, { ...base, category: "Hospital" }) });
    return out;
  }
  if (
    types.includes("doctor") ||
    types.includes("medical_clinic") ||
    /surgery|medical centre|medical center|gp practice/i.test(name)
  ) {
    out.push({ group: "gpSurgeries", entity: makeEntity("gpSurgeries", name, { ...base, category: "GP Surgery" }) });
    return out;
  }
  if (/health centre|health center|walk-in|walk in/i.test(name) || types.includes("medical_center")) {
    out.push({
      group: "healthCentres",
      entity: makeEntity("healthCentres", name, { ...base, category: "Health Centre" }),
    });
    return out;
  }
  if (/care home|nursing home|residential care/i.test(name)) {
    out.push({ group: "careHomes", entity: makeEntity("careHomes", name, { ...base, category: "Care Home" }) });
    return out;
  }
  if (types.some((t) => ["school", "primary_school", "secondary_school", "university"].includes(t)) || /school|college|academy/i.test(name)) {
    out.push({ group: "schools", entity: makeEntity("schools", name, { ...base, category: "School" }) });
    return out;
  }
  if (types.includes("train_station") || types.includes("bus_station") || /station|interchange|tram stop/i.test(name)) {
    out.push({
      group: "transportLinks",
      entity: makeEntity("transportLinks", name, { ...base, category: "Transport Link" }),
    });
    return out;
  }
  if (types.includes("shopping_mall") || types.includes("supermarket") || /retail|shopping|market/i.test(lowerName)) {
    out.push({
      group: "retailCentres",
      entity: makeEntity("retailCentres", name, { ...base, category: "Retail Centre" }),
    });
    return out;
  }
  if (types.includes("park") || types.includes("tourist_attraction") || types.includes("museum") || /museum|park|memorial|stadium/i.test(name)) {
    out.push({ group: "landmarks", entity: makeEntity("landmarks", name, { ...base, category: "Landmark" }) });
    return out;
  }
  if (types.includes("community_center") || types.includes("library") || /community|library|leisure|sports centre|church|salvation army/i.test(name)) {
    out.push({
      group: "communityFacilities",
      entity: makeEntity("communityFacilities", name, { ...base, category: "Community Facility" }),
    });
    return out;
  }
  if (/residential|estate|neighbourhood|neighborhood|village|suburb/i.test(name)) {
    out.push({
      group: "residentialAreas",
      entity: makeEntity("residentialAreas", name, { ...base, category: "Residential Area" }),
    });
    return out;
  }

  return out;
}

async function googlePlacesSearch(query: string, maxResultCount = 8): Promise<LocalEntityInput[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.types,places.location",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount }),
  });

  if (!res.ok) return [];

  const data: any = await res.json();
  return (data.places || [])
    .map((p: any) => ({
      name: p.displayName?.text || "",
      address: p.formattedAddress || "",
      types: p.types || [],
      location: p.location || null,
    }))
    .filter((p: LocalEntityInput) => p.name);
}

function loadDemoLocalIntelligence(slug: string): any {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-local-intelligence", `${slug}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  return null;
}

function loadRelevancePackEntities(slug: string): LocalEntityInput[] {
  const dir = path.join(WORKSPACE_ROOT, "data/pharmacy-local-relevance-packs", slug);
  if (!fs.existsSync(dir)) return [];
  const out: LocalEntityInput[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    try {
      const pack = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      for (const bucket of ["healthcare", "community", "landmarks", "retail", "transport", "schools", "topHealthcare", "topCommunity", "topLandmarks"]) {
        for (const e of pack[bucket] || []) {
          if (e?.name) out.push(e);
        }
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

function demoEntitiesFromLocalIntel(
  localIntel: any,
  town: string,
  pharmacyLat: number | null,
  pharmacyLng: number | null,
): GeneratedLocalIntelligenceGroups {
  const groups = emptyGroups();
  const source: ProfileLocalEntity["source"] = "demo pack";
  const ctx = { pharmacyLat, pharmacyLng, source };

  const addStrings = (names: string[], group: EntityGroupKey, category: string) => {
    for (const name of names || []) {
      if (!name || isPharmacyName(name)) continue;
      pushUnique(groups, group, makeEntity(group, name, { ...ctx, category }));
    }
  };

  addStrings(localIntel.localGps, "gpSurgeries", "GP Surgery");
  addStrings(localIntel.localHospitals, "hospitals", "Hospital");
  addStrings(
    (localIntel.localHealthcareLocations || []).filter(
      (n: string) => !/(gp|surgery|hospital)/i.test(n),
    ),
    "healthCentres",
    "Health Centre",
  );
  addStrings(localIntel.localCareHomes, "careHomes", "Care Home");
  addStrings(localIntel.localSchools, "schools", "School");
  addStrings(localIntel.localLandmarks, "landmarks", "Landmark");
  addStrings(localIntel.localCommunityLocations, "communityFacilities", "Community Facility");
  addStrings(localIntel.localTransportLinks, "transportLinks", "Transport Link");
  addStrings(localIntel.localRetailCentres, "retailCentres", "Retail Centre");
  addStrings(localIntel.localAreas || localIntel.localResidentialAreas, "residentialAreas", "Residential Area");

  if (!groups.transportLinks.length) {
    pushUnique(
      groups,
      "transportLinks",
      makeEntity("transportLinks", `${town} Railway Station`, {
        ...ctx,
        address: `${town}, South Yorkshire`,
        category: "Transport Link",
      }),
    );
  }

  if (!groups.healthCentres.length) {
    pushUnique(
      groups,
      "healthCentres",
      makeEntity("healthCentres", "Rotherham Community Health Centre", {
        ...ctx,
        address: "Rotherham, South Yorkshire",
        category: "Health Centre",
      }),
    );
  }

  if (!groups.careHomes.length) {
    pushUnique(
      groups,
      "careHomes",
      makeEntity("careHomes", "Local residential care settings", {
        ...ctx,
        address: `${town} area`,
        category: "Care Home",
      }),
    );
  }

  return groups;
}

export function countGroupTotals(groups: GeneratedLocalIntelligenceGroups): Record<EntityGroupKey, number> {
  const totals = {} as Record<EntityGroupKey, number>;
  for (const key of ENTITY_GROUP_KEYS) totals[key] = groups[key].length;
  return totals;
}

export async function generateProfileLocalIntelligence(input: {
  slug: string;
  address?: string;
  postcode?: string;
  townCity?: string;
  latitude?: string | number;
  longitude?: string | number;
  demoMode?: boolean;
}): Promise<GeneratedLocalIntelligenceResult> {
  const slug = slugify(input.slug) || "pharmaconnect";
  const town = String(input.townCity || "Rotherham").trim();
  const postcode = String(input.postcode || "").trim();
  const pharmacyLat = input.latitude != null && input.latitude !== "" ? Number(input.latitude) : null;
  const pharmacyLng = input.longitude != null && input.longitude !== "" ? Number(input.longitude) : null;

  const groups = emptyGroups();
  let source = "local intelligence";
  let researchStatus = "live";

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (googleKey && pharmacyLat && pharmacyLng) {
    const queries = [
      `GP surgeries doctors medical centres near ${town} ${postcode}`,
      `hospitals urgent care near ${town}`,
      `care homes nursing homes near ${town}`,
      `schools colleges near ${town}`,
      `landmarks parks museums near ${town}`,
      `community centres libraries near ${town}`,
      `train station bus station near ${town}`,
      `shopping centres supermarkets near ${town}`,
    ];
    const results = await Promise.all(queries.map((q) => googlePlacesSearch(q, 8)));
    for (const batch of results) {
      for (const item of batch) {
        for (const { group, entity } of categorizeGoogleEntity(item, {
          pharmacyLat,
          pharmacyLng,
          source: "Google Places",
        })) {
          pushUnique(groups, group, entity);
        }
      }
    }
    if (Object.values(groups).some((g) => g.length > 0)) {
      source = "Google Places";
      researchStatus = "google-places-live";
    }
  }

  const totalFound = ENTITY_GROUP_KEYS.reduce((n, k) => n + groups[k].length, 0);
  if (totalFound < 8 || input.demoMode || !googleKey) {
    const localIntel = loadDemoLocalIntelligence(slug);
    const demoGroups = demoEntitiesFromLocalIntel(
      localIntel || {},
      town,
      pharmacyLat,
      pharmacyLng,
    );
    for (const key of ENTITY_GROUP_KEYS) {
      for (const entity of demoGroups[key]) pushUnique(groups, key, entity);
    }
    for (const packEntity of loadRelevancePackEntities(slug)) {
      for (const { group, entity } of categorizeGoogleEntity(packEntity, {
        pharmacyLat,
        pharmacyLng,
        source: "demo pack",
      })) {
        pushUnique(groups, group, entity);
      }
    }
    if (source !== "Google Places") {
      source = localIntel ? "local intelligence + demo pack" : "demo pack";
      researchStatus = googleKey ? "demo-fallback" : "demo-no-google-key";
    }
  }

  return {
    slug,
    generatedAt: new Date().toISOString(),
    source,
    researchStatus,
    town,
    postcode,
    latitude: pharmacyLat,
    longitude: pharmacyLng,
    groups,
    totals: countGroupTotals(groups),
  };
}

export function normalizeEntityList(raw: unknown, group: StoredEntityGroupKey): ProfileLocalEntity[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [];
  return items
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return makeEntity(group, item.trim(), { source: "local intelligence" });
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const name = String(o.name || "").trim();
        if (!name) return null;
        return {
          id: String(o.id || entityId(name, String(o.address || ""), group)),
          name,
          address: String(o.address || ""),
          category: String(o.category || ENTITY_GROUP_LABELS[group]),
          entityType: group,
          distanceKm: o.distanceKm != null ? Number(o.distanceKm) : null,
          distanceLabel: String(o.distanceLabel || formatDistance(o.distanceKm != null ? Number(o.distanceKm) : null)),
          source: (o.source as ProfileLocalEntity["source"]) || "local intelligence",
          types: Array.isArray(o.types) ? o.types.map(String) : [],
          selected: o.selected !== false,
        } satisfies ProfileLocalEntity;
      }
      return null;
    })
    .filter(Boolean) as ProfileLocalEntity[];
}

export function entityNames(entities: ProfileLocalEntity[]): string[] {
  return entities.map((e) => e.name).filter(Boolean);
}

export function mapSelectedEntitiesToLegacyFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const gpSurgeries = normalizeEntityList(data.gpSurgeries, "gpSurgeries");
  const hospitals = normalizeEntityList(data.hospitals, "hospitals");
  const healthCentres = normalizeEntityList(data.healthCentres, "healthCentres");
  const careHomes = normalizeEntityList(data.careHomes, "careHomes");
  const schools = normalizeEntityList(data.schools, "schools");
  const majorEmployers = normalizeEntityList(data.majorEmployers, "majorEmployers");
  const landmarks = normalizeEntityList(data.landmarks, "landmarks");
  const communityFacilities = normalizeEntityList(data.communityFacilities, "communityFacilities");
  const transportLinks = normalizeEntityList(data.transportLinks, "transportLinks");
  const retailCentres = normalizeEntityList(data.retailCentres, "retailCentres");
  const residentialAreas = normalizeEntityList(data.residentialAreas, "residentialAreas");

  const healthcareNames = uniqueNames([
    ...entityNames(gpSurgeries),
    ...entityNames(hospitals),
    ...entityNames(healthCentres),
    ...entityNames(careHomes),
  ]);

  return {
    gpSurgeries,
    hospitals,
    healthCentres,
    careHomes,
    schools,
    majorEmployers,
    landmarks,
    communityFacilities,
    transportLinks,
    retailCentres,
    residentialAreas,
    localGpSurgeries: entityNames(gpSurgeries),
    nearbyHospitals: entityNames(hospitals),
    nearbyHealthCentres: entityNames(healthCentres),
    careHomesServed: entityNames(careHomes),
    nearbySchools: entityNames(schools),
    nearbyEmployers: entityNames(majorEmployers),
    localLandmarks: entityNames(landmarks),
    communityLinks: entityNames(communityFacilities),
    localTransportLinks: entityNames(transportLinks),
    localRetailCentres: entityNames(retailCentres),
    localResidentialAreas: entityNames(residentialAreas),
    localGps: entityNames(gpSurgeries),
    localHospitals: entityNames(hospitals),
    localSchools: entityNames(schools),
    localCareHomes: entityNames(careHomes),
    localEmployers: entityNames(majorEmployers),
    localCommunityLocations: entityNames(communityFacilities),
    localHealthcareLocations: healthcareNames,
  };
}

function uniqueNames(names: string[]): string[] {
  return Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
}

export function countHealthcareEntities(data: Record<string, unknown>): number {
  let n = 0;
  for (const key of HEALTHCARE_GROUPS) n += normalizeEntityList(data[key], key).length;
  return n;
}

export function countCommunityEntities(data: Record<string, unknown>): number {
  let n = 0;
  for (const key of COMMUNITY_GROUPS) n += normalizeEntityList(data[key], key).length;
  return n;
}

export function countAllSelectedEntities(data: Record<string, unknown>): number {
  return countHealthcareEntities(data) + countCommunityEntities(data);
}

export function mergeLocalIntelligenceIntoProfile(raw: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapSelectedEntitiesToLegacyFields(raw);
  return {
    ...raw,
    ...mapped,
    localIntelligenceGenerated: Boolean(raw.localIntelligenceGenerated),
    localIntelligenceGeneratedAt: String(raw.localIntelligenceGeneratedAt || ""),
  };
}
