/**
 * Verified locality evidence binder.
 * Uses saved Google/locality packs, approved profile entities, area-discovery
 * records, and stored coordinates. Does not invent landmarks or call Google.
 */
import fs from "node:fs";
import path from "node:path";
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";
import {
  areaDiscoveryForName,
  providersForArea,
  type LocalMarketHealthcareProvider,
} from "../pharmacyLocalMarketSnapshot.ts";
import type { ProfileLocalEntity } from "../pharmacyProfileLocalIntelligenceSelection.ts";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "../pharmacyTenantSlug.ts";
import type { ProfileAreaEntry } from "../pharmacyProfileSchema.ts";

export type LocalityEvidenceKind =
  | "distance"
  | "direction"
  | "coordinate"
  | "landmark"
  | "healthcare"
  | "community"
  | "transport"
  | "school"
  | "retail"
  | "neighbour"
  | "discovery"
  | "address"
  | "unavailable";

export type NamedLocalityFact = {
  name: string;
  provenance: string;
  category?: string;
  distanceLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type NearbyLocalityLink = {
  areaName: string;
  areaSlug: string;
  distanceKm: number | null;
  reason: string;
  geographic: boolean;
};

export type VerifiedLocalityEvidence = {
  areaName: string;
  areaSlug: string;
  evidenceLimited: boolean;
  latitude: number | null;
  longitude: number | null;
  coordinateProvenance: string;
  distanceKm: number | null;
  distanceLabel: string;
  distanceProvenance: string;
  cardinalDirection: string;
  directionProvenance: string;
  landmarks: NamedLocalityFact[];
  healthcare: NamedLocalityFact[];
  community: NamedLocalityFact[];
  transport: NamedLocalityFact[];
  schools: NamedLocalityFact[];
  retail: NamedLocalityFact[];
  nearbyLocalities: NearbyLocalityLink[];
  discoveryReason: string;
  discoveryEvidence: string[];
  relationship: string;
  pharmacyAddress: string;
  sectionEvidence: Record<string, string[]>;
};

export type SiblingLocalityRef = {
  areaName: string;
  areaSlug: string;
  distanceLabel?: string;
  relationship?: string;
  evidence?: string[];
  source?: string;
};

type SavedRelevanceEntity = {
  name?: string;
  address?: string;
  category?: string;
  types?: string[];
  location?: { latitude?: number; longitude?: number } | null;
  distanceKm?: number | null;
  distanceLabel?: string;
  provider?: string;
  source?: string;
  retrievedAt?: string;
  sourceRef?: string;
  placeId?: string;
  confidence?: number;
  relationship?: string;
};

function num(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(n) ? n : null;
}

function hay(entity: { name?: string; address?: string }): string {
  return `${entity.name || ""} ${entity.address || ""}`.toLowerCase();
}

function belongsToArea(entity: { name?: string; address?: string }, areaName: string, siblingNames: string[]): boolean {
  const text = hay(entity);
  const area = areaName.toLowerCase();
  if (!area || !text.includes(area)) return false;
  for (const sibling of siblingNames) {
    const sib = sibling.toLowerCase();
    if (!sib || sib === area) continue;
    if (text.includes(sib) && sib.length > area.length) return false;
  }
  return true;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function cardinalFromBearing(deg: number): string {
  const dirs = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return dirs[Math.round(deg / 45) % 8]!;
}

export function formatVerifiedDistanceKm(km: number): string {
  if (km < 1) return "less than 1 km";
  const tenths = Math.round(km * 10) / 10;
  return `about ${Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)} km`;
}

function loadSavedRelevancePack(slug: string, areaSlug: string): Record<string, unknown> | null {
  const key = resolveTenantProfileSlug(slug) || slug;
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-relevance-packs", key, `${areaSlug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function packEntities(pack: Record<string, unknown> | null, keys: string[]): SavedRelevanceEntity[] {
  if (!pack) return [];
  const out: SavedRelevanceEntity[] = [];
  for (const key of keys) {
    const rows = pack[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      out.push(row as SavedRelevanceEntity);
    }
  }
  return out;
}

function profileEntities(raw: ContentGenerationContext["rawProfile"] | undefined, group: string): ProfileLocalEntity[] {
  const list = raw && Array.isArray((raw as Record<string, unknown>)[group])
    ? ((raw as Record<string, unknown>)[group] as ProfileLocalEntity[])
    : [];
  return list.filter((e) => e?.name && e.selected !== false && e.source !== "demo pack");
}

function pharmacyCoords(ctx: ContentGenerationContext): { lat: number | null; lng: number | null; provenance: string } {
  const market = ctx.localMarket?.yourPharmacy;
  if (market && Number.isFinite(market.latitude) && Number.isFinite(market.longitude) && (market.latitude || market.longitude)) {
    return { lat: market.latitude, lng: market.longitude, provenance: "local-market:yourPharmacy" };
  }
  const mapLat = num(ctx.map?.latitude);
  const mapLng = num(ctx.map?.longitude);
  if (mapLat != null && mapLng != null && (mapLat !== 0 || mapLng !== 0)) {
    return { lat: mapLat, lng: mapLng, provenance: "generation-context:map" };
  }
  const rawLat = num(ctx.rawProfile?.latitude);
  const rawLng = num(ctx.rawProfile?.longitude);
  if (rawLat != null && rawLng != null && (rawLat !== 0 || rawLng !== 0)) {
    return { lat: rawLat, lng: rawLng, provenance: "profile:coordinates" };
  }
  return { lat: null, lng: null, provenance: "" };
}

function selectedAreaEntry(ctx: ContentGenerationContext, areaName: string): ProfileAreaEntry | null {
  const rows = ctx.rawProfile?.selectedAreas;
  if (!Array.isArray(rows)) return null;
  const needle = areaName.trim().toLowerCase();
  return rows.find((row) => String(row.areaName || "").trim().toLowerCase() === needle) || null;
}

function savedDistanceIsUsable(entry: ProfileAreaEntry | null): boolean {
  if (!entry) return false;
  const method = String(entry.distanceMethod || "").trim().toLowerCase();
  const label = String(entry.distanceLabel || "").trim();
  if (!method || method === "none") return false;
  if (!label || /^distance unavailable$/i.test(label)) return false;
  return entry.distanceKm != null && Number.isFinite(Number(entry.distanceKm));
}

function parseSavedCoordsFromEvidence(lines: string[]): { lat: number; lng: number } | null {
  for (const line of lines) {
    const match = String(line || "").match(
      /(?:saved-coords|coords|coordinates)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i,
    );
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

function centroidFromEntities(entities: Array<{ latitude?: number | null; longitude?: number | null }>): {
  lat: number;
  lng: number;
} | null {
  const pts = entities.filter((e) => e.latitude != null && e.longitude != null) as Array<{ latitude: number; longitude: number }>;
  if (!pts.length) return null;
  return {
    lat: pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
    lng: pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
  };
}

function factFromSaved(entity: SavedRelevanceEntity, provenance: string): NamedLocalityFact | null {
  const name = String(entity.name || "").trim();
  if (!name) return null;
  const retrieved = String(entity.retrievedAt || "").trim();
  const provider = String(entity.provider || entity.source || "").trim();
  const sourceRef = String(entity.sourceRef || entity.placeId || "").trim();
  return {
    name,
    provenance: [provenance, provider, retrieved, sourceRef].filter(Boolean).join(":"),
    category: String(entity.category || (entity.types || [])[0] || ""),
    distanceLabel: entity.distanceLabel || undefined,
    latitude: entity.location?.latitude ?? null,
    longitude: entity.location?.longitude ?? null,
  };
}

function factFromProfile(entity: ProfileLocalEntity, provenance: string): NamedLocalityFact {
  const extra = entity as ProfileLocalEntity & {
    location?: { latitude?: number; longitude?: number } | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  return {
    name: entity.name,
    provenance,
    category: entity.category || entity.entityType,
    distanceLabel: entity.distanceLabel || undefined,
    latitude: extra.location?.latitude ?? extra.latitude ?? null,
    longitude: extra.location?.longitude ?? extra.longitude ?? null,
  };
}

function factFromProvider(provider: LocalMarketHealthcareProvider, provenance: string): NamedLocalityFact {
  return {
    name: provider.businessName,
    provenance,
    category: provider.category || provider.groupKey,
    distanceLabel: provider.distanceLabel || undefined,
  };
}

function uniqueFacts(items: NamedLocalityFact[], limit: number): NamedLocalityFact[] {
  const seen = new Set<string>();
  const out: NamedLocalityFact[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function evidenceLine(kind: LocalityEvidenceKind, provenance: string, detail: string): string {
  return `${kind}:${provenance}:${detail}`.slice(0, 180);
}

function emptyEvidence(areaName: string, areaSlug: string, pharmacyAddress: string): VerifiedLocalityEvidence {
  return {
    areaName,
    areaSlug,
    evidenceLimited: true,
    latitude: null,
    longitude: null,
    coordinateProvenance: "",
    distanceKm: null,
    distanceLabel: "",
    distanceProvenance: "",
    cardinalDirection: "",
    directionProvenance: "",
    landmarks: [],
    healthcare: [],
    community: [],
    transport: [],
    schools: [],
    retail: [],
    nearbyLocalities: [],
    discoveryReason: "",
    discoveryEvidence: [],
    relationship: "",
    pharmacyAddress,
    sectionEvidence: {
      intro: ["unavailable:no-verified-locality-facts"],
      localRelevance: ["unavailable:no-verified-locality-facts"],
      access: pharmacyAddress ? ["address:profile"] : ["unavailable:no-verified-access-facts"],
    },
  };
}

function bindOne(
  ctx: ContentGenerationContext,
  areaName: string,
  areaSlug: string,
  siblings: SiblingLocalityRef[],
  localityRecord?: SiblingLocalityRef,
): VerifiedLocalityEvidence {
  const pharmacyAddress = String(ctx.profile.fullAddress || ctx.profile.customerFacingAddress || "").trim();
  const base = emptyEvidence(areaName, areaSlug, pharmacyAddress);
  const siblingNames = siblings.map((s) => s.areaName);
  const slug = ctx.resolvedSlug;
  const pack = loadSavedRelevancePack(slug, areaSlug);
  const discovery = areaDiscoveryForName(ctx.areaDiscovery, areaName);
  const savedArea = selectedAreaEntry(ctx, areaName);

  const packIsV3 = String(pack?.version || "") === "v3";
  const packFact = (e: SavedRelevanceEntity) =>
    packIsV3 || e.relationship || belongsToArea(e, areaName, siblingNames)
      ? factFromSaved(e, packIsV3 ? "local-evidence-pack-v3" : "local-relevance-pack:google-or-saved")
      : null;

  const savedLandmarks = packEntities(pack, packIsV3 ? ["landmarks"] : ["topLandmarks", "landmarks"]).map(packFact);
  const savedHealthcare = packEntities(pack, packIsV3 ? ["healthcare"] : ["topHealthcare", "healthcare"]).map(packFact);
  const savedTransport = packEntities(pack, ["transport"]).map(packFact);
  const savedSchools = packEntities(pack, ["schools"]).map(packFact);
  const savedRetail = packEntities(pack, ["retail"]).map(packFact);
  const savedCommunity = packEntities(pack, packIsV3 ? ["community"] : ["topCommunity", "community"]).map(packFact);

  const profileLandmarks = packIsV3
    ? []
    : profileEntities(ctx.rawProfile, "landmarks")
        .filter((e) => belongsToArea(e, areaName, siblingNames))
        .map((e) => factFromProfile(e, "profile:approved-landmarks"));
  const profileHealthcare = packIsV3
    ? []
    : [
        ...profileEntities(ctx.rawProfile, "gpSurgeries"),
        ...profileEntities(ctx.rawProfile, "healthCentres"),
        ...profileEntities(ctx.rawProfile, "hospitals"),
      ]
        .filter((e) => belongsToArea(e, areaName, siblingNames))
        .map((e) => factFromProfile(e, "profile:approved-healthcare"));
  const profileTransport = packIsV3
    ? []
    : profileEntities(ctx.rawProfile, "transportLinks")
        .filter((e) => belongsToArea(e, areaName, siblingNames))
        .map((e) => factFromProfile(e, "profile:approved-transport"));
  const profileSchools = packIsV3
    ? []
    : profileEntities(ctx.rawProfile, "schools")
        .filter((e) => belongsToArea(e, areaName, siblingNames))
        .map((e) => factFromProfile(e, "profile:approved-schools"));
  const profileRetail = packIsV3
    ? []
    : profileEntities(ctx.rawProfile, "retailCentres")
        .filter((e) => belongsToArea(e, areaName, siblingNames))
        .map((e) => factFromProfile(e, "profile:approved-retail"));
  const profileCommunity = packIsV3
    ? []
    : profileEntities(ctx.rawProfile, "communityFacilities")
        .filter((e) => belongsToArea(e, areaName, siblingNames))
        .map((e) => factFromProfile(e, "profile:approved-community"));

  const marketHealthcare = packIsV3
    ? []
    : providersForArea(ctx.localMarket, areaName, {
        groupKeys: ["gpSurgeries", "healthCentres", "communityClinics", "hospitals"],
        limit: 6,
      })
        .filter((p) => belongsToArea({ name: p.businessName, address: p.address }, areaName, siblingNames))
        .slice(0, 3)
        .map((p) => factFromProvider(p, "local-market:healthcare"));

  const landmarks = uniqueFacts(
    (packIsV3
      ? savedLandmarks
      : [...savedLandmarks, ...savedCommunity, ...profileLandmarks, ...profileCommunity]
    ).filter((f): f is NamedLocalityFact => Boolean(f)),
    packIsV3 ? 6 : 4,
  );
  const healthcare = uniqueFacts(
    [...savedHealthcare, ...profileHealthcare, ...marketHealthcare].filter((f): f is NamedLocalityFact => Boolean(f)),
    packIsV3 ? 8 : 3,
  );
  const community = uniqueFacts(
    [...savedCommunity, ...profileCommunity].filter((f): f is NamedLocalityFact => Boolean(f)),
    packIsV3 ? 6 : 3,
  );
  const transport = uniqueFacts(
    [...savedTransport, ...profileTransport].filter((f): f is NamedLocalityFact => Boolean(f)),
    packIsV3 ? 6 : 3,
  );
  const schools = uniqueFacts(
    [...savedSchools, ...profileSchools].filter((f): f is NamedLocalityFact => Boolean(f)),
    packIsV3 ? 8 : 2,
  );
  const retail = uniqueFacts(
    [...savedRetail, ...profileRetail].filter((f): f is NamedLocalityFact => Boolean(f)),
    packIsV3 ? 4 : 2,
  );

  const located = [...landmarks, ...healthcare, ...community, ...transport].filter(
    (f) => f.latitude != null && f.longitude != null,
  );
  const centroid = centroidFromEntities(located);
  const pharmacy = pharmacyCoords(ctx);
  const savedLat = num(savedArea?.latitude);
  const savedLng = num(savedArea?.longitude);
  const evidenceCoords = parseSavedCoordsFromEvidence([
    ...(discovery?.evidence || []),
    ...(localityRecord?.evidence || []),
    savedLat != null && savedLng != null ? `saved-coords:${savedLat},${savedLng}` : "",
  ]);

  let latitude = savedLat ?? centroid?.lat ?? evidenceCoords?.lat ?? null;
  let longitude = savedLng ?? centroid?.lng ?? evidenceCoords?.lng ?? null;
  let coordinateProvenance =
    savedLat != null && savedLng != null
      ? "profile.selectedAreas:google-coordinates"
      : centroid
        ? "saved-google-entity-locations:centroid"
        : evidenceCoords
          ? "area-discovery:saved-coords"
          : "";
  let distanceKm: number | null = null;
  let distanceLabel = "";
  let distanceProvenance = "";
  let cardinalDirection = "";
  let directionProvenance = "";

  if (pharmacy.lat != null && pharmacy.lng != null && latitude != null && longitude != null) {
    distanceKm = haversineKm(pharmacy.lat, pharmacy.lng, latitude, longitude);
    distanceLabel = formatVerifiedDistanceKm(distanceKm);
    distanceProvenance = `haversine:${pharmacy.provenance}->${coordinateProvenance}`;
    cardinalDirection = cardinalFromBearing(bearingDegrees(pharmacy.lat, pharmacy.lng, latitude, longitude));
    directionProvenance = distanceProvenance;
  }
  if (savedDistanceIsUsable(savedArea) && savedArea) {
    distanceKm = Number(savedArea.distanceKm);
    distanceLabel = String(savedArea.distanceLabel || "").trim();
    const source =
      savedArea.distanceProvenance && typeof savedArea.distanceProvenance.distanceSource === "string"
        ? String(savedArea.distanceProvenance.distanceSource)
        : "google-coordinates";
    distanceProvenance = `profile.selectedAreas:${savedArea.distanceMethod}:${source}`;
  }

  const discoveryReason = String(discovery?.reason || localityRecord?.relationship || "").trim();
  const discoveryEvidence = [
    ...(discovery?.evidence || []),
    ...(localityRecord?.evidence || []),
  ]
    .map((e) => String(e || "").trim())
    .filter(Boolean)
    .filter((e) => !/^approx\.\s*\d+\s*km from/i.test(e));

  const relationship = String(localityRecord?.relationship || "").trim();

  const evidenceLimited =
    landmarks.length === 0 &&
    healthcare.length === 0 &&
    community.length === 0 &&
    transport.length === 0 &&
    schools.length === 0 &&
    retail.length === 0 &&
    distanceKm == null &&
    !discoveryReason;

  const sectionEvidence: Record<string, string[]> = {
    title: [
      evidenceLine("discovery", "verified-locality-name", areaName),
      distanceLabel ? evidenceLine("distance", distanceProvenance, distanceLabel) : "",
      cardinalDirection ? evidenceLine("direction", directionProvenance, cardinalDirection) : "",
    ].filter(Boolean),
    intro: [
      distanceLabel ? evidenceLine("distance", distanceProvenance, distanceLabel) : "",
      cardinalDirection ? evidenceLine("direction", directionProvenance, cardinalDirection) : "",
      pharmacyAddress ? evidenceLine("address", "profile", pharmacyAddress) : "",
      discoveryReason ? evidenceLine("discovery", "area-discovery", discoveryReason) : "",
      evidenceLimited ? evidenceLine("unavailable", "fail-safe", "restrained-page") : "",
    ].filter(Boolean),
    localRelevance: [
      ...landmarks.map((f) => evidenceLine("landmark", f.provenance, f.name)),
      ...healthcare.map((f) => evidenceLine("healthcare", f.provenance, f.name)),
      discoveryReason ? evidenceLine("discovery", "area-discovery", discoveryReason) : "",
    ].filter(Boolean),
    access: [
      pharmacyAddress ? evidenceLine("address", "profile", pharmacyAddress) : "",
      distanceLabel ? evidenceLine("distance", distanceProvenance, distanceLabel) : "",
      ...transport.map((f) => evidenceLine("transport", f.provenance, f.name)),
    ].filter(Boolean),
    supporting: [
      ...landmarks.map((f) => evidenceLine("landmark", f.provenance, f.name)),
      ...healthcare.map((f) => evidenceLine("healthcare", f.provenance, f.name)),
      ...community.map((f) => evidenceLine("community", f.provenance, f.name)),
      coordinateProvenance ? evidenceLine("coordinate", coordinateProvenance, `${latitude},${longitude}`) : "",
    ].filter(Boolean),
    faqs: [],
    cta: [
      distanceLabel ? evidenceLine("distance", distanceProvenance, distanceLabel) : "",
      cardinalDirection ? evidenceLine("direction", directionProvenance, cardinalDirection) : "",
    ].filter(Boolean),
    internalLinks: [],
  };

  return {
    ...base,
    evidenceLimited,
    latitude,
    longitude,
    coordinateProvenance,
    distanceKm,
    distanceLabel,
    distanceProvenance,
    cardinalDirection,
    directionProvenance,
    landmarks,
    healthcare,
    community,
    transport,
    schools,
    retail,
    discoveryReason,
    discoveryEvidence,
    relationship,
    pharmacyAddress,
    sectionEvidence,
  };
}

function rankNearby(
  current: VerifiedLocalityEvidence,
  others: VerifiedLocalityEvidence[],
): NearbyLocalityLink[] {
  const scored = others
    .filter((o) => o.areaSlug !== current.areaSlug)
    .map((o) => {
      let distanceKm: number | null = null;
      let geographic = false;
      let reason = `Guidance for patients travelling from ${o.areaName}`;
      if (
        current.latitude != null &&
        current.longitude != null &&
        o.latitude != null &&
        o.longitude != null
      ) {
        distanceKm = haversineKm(current.latitude, current.longitude, o.latitude, o.longitude);
        geographic = true;
        reason = `${formatVerifiedDistanceKm(distanceKm)} from ${current.areaName}`;
      }
      return { areaName: o.areaName, areaSlug: o.areaSlug, distanceKm, reason, geographic };
    })
    .sort((a, b) => {
      if (a.geographic && b.geographic && a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.geographic !== b.geographic) return a.geographic ? -1 : 1;
      return a.areaName.localeCompare(b.areaName);
    });
  return scored.slice(0, 4);
}

export function bindVerifiedLocalityEvidenceV1(input: {
  ctx: ContentGenerationContext;
  areaName: string;
  areaSlug: string;
  siblingLocalities: SiblingLocalityRef[];
  localityRecord?: SiblingLocalityRef;
}): VerifiedLocalityEvidence {
  const siblings = input.siblingLocalities.length
    ? input.siblingLocalities
    : [{ areaName: input.areaName, areaSlug: input.areaSlug }];
  const bound = new Map<string, VerifiedLocalityEvidence>();
  for (const sibling of siblings) {
    bound.set(
      sibling.areaSlug,
      bindOne(
        input.ctx,
        sibling.areaName,
        sibling.areaSlug,
        siblings,
        sibling.areaSlug === input.areaSlug ? input.localityRecord || sibling : sibling,
      ),
    );
  }
  if (!bound.has(input.areaSlug)) {
    bound.set(
      input.areaSlug,
      bindOne(input.ctx, input.areaName, input.areaSlug, siblings, input.localityRecord),
    );
  }
  const current = bound.get(input.areaSlug)!;
  const nearby = rankNearby(current, [...bound.values()]);
  current.nearbyLocalities = nearby;
  current.sectionEvidence.internalLinks = nearby.map((n) =>
    evidenceLine("neighbour", n.geographic ? "haversine-between-saved-coords" : "approved-sibling-locality", n.areaName),
  );
  if (nearby.length) {
    current.sectionEvidence.faqs = [
      ...(current.sectionEvidence.faqs || []),
      ...nearby.slice(0, 2).map((n) => evidenceLine("neighbour", n.reason, n.areaName)),
    ];
  }
  if (current.distanceLabel) {
    current.sectionEvidence.faqs = [
      ...(current.sectionEvidence.faqs || []),
      evidenceLine("distance", current.distanceProvenance, current.distanceLabel),
    ];
  }
  return current;
}

export function verifiedTravelSummary(evidence: VerifiedLocalityEvidence): string {
  const bits: string[] = [];
  if (evidence.distanceLabel && evidence.cardinalDirection) {
    bits.push(
      `${evidence.areaName} is ${evidence.distanceLabel} ${evidence.cardinalDirection} of the pharmacy`,
    );
  } else if (evidence.distanceLabel) {
    bits.push(`${evidence.areaName} is ${evidence.distanceLabel} from the pharmacy`);
  }
  if (evidence.pharmacyAddress) {
    bits.push(`consultations take place at ${evidence.pharmacyAddress}`);
  }
  return bits.join(" — ");
}

export function recordSectionEvidence(
  evidence: VerifiedLocalityEvidence,
  section: string,
  lines: string[],
): void {
  evidence.sectionEvidence[section] = [...new Set([...(evidence.sectionEvidence[section] || []), ...lines.filter(Boolean)])];
}

export function discoveryContextSentence(evidence: VerifiedLocalityEvidence): string {
  const reason = evidence.discoveryReason.replace(/\s+/g, " ").trim();
  if (!reason) return "";
  if (/^recognised neighbourhood/i.test(reason)) return "";
  return reason.endsWith(".") ? reason : `${reason}.`;
}
