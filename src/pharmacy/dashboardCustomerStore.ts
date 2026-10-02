/**
 * Production pharmacy dashboard catalog — loads the 10 live customers from
 * pharmacy_customers.json and maps them to the 4 core service channels.
 */
import fs from "node:fs";
import path from "node:path";
import {
  getPharmacyCampaignStorePath,
  getPharmacyProfilePath,
  PHARMACY_WORKSPACE_ROOT,
} from "./pharmacyWorkspacePaths.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import {
  ACTIVE_SERVICE_CHANNELS,
  ACTIVE_SERVICE_IDS,
  resolveActiveServiceId,
} from "./pharmacyServiceRegistry.ts";

export const CORE_SERVICE_CHANNELS = ACTIVE_SERVICE_CHANNELS;
export const CORE_SERVICE_IDS = ACTIVE_SERVICE_IDS;

const REJECTED_SANDBOX_SLUGS = new Set([
  "test-leeds-pharmacy",
  "test-pharmacy",
  "pharmaconnect-e2e-test-pharmacy",
  "pharmaconnect-e2e-test-pharmacy-2",
]);

export interface GoogleCatchmentConfig {
  googlePlaceId: string;
  latitude: number | null;
  longitude: number | null;
  googleBusinessProfileUrl: string;
  googleMapsEmbedUrl: string;
  coverageRadius: string;
  rankingAreas: string[];
  nearbyAreas: string[];
  coverageAreas: string[];
}

export interface PharmacyCustomerRecord {
  slug: string;
  pharmacyName: string;
  website: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
  displayAddress: string;
  brandPrimaryColor: string;
  googleCatchment: GoogleCatchmentConfig;
  activeServiceChannels: string[];
}

export interface PharmacyCustomerCard {
  slug: string;
  pharmacyName: string;
  townCity: string;
  postcode: string;
  website: string;
  brandPrimaryColor: string;
  displayAddress: string;
  rankingAreaCount: number;
  rankingAreas: string[];
  googlePlaceId: string;
  googleMapsEmbedUrl: string;
  coverageRadius: string;
  activeServiceChannels: string[];
}

export interface PharmacyCustomerCatalog {
  version: number;
  coreServiceChannels: Array<{ id: string; label: string; aliases?: string[] }>;
  pharmacies: PharmacyCustomerRecord[];
}

export interface CompetitorMatrixRow {
  name: string;
  reviewCount: number;
  rating: number;
  address: string;
}

export interface LocalClusterPage {
  suburbName: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  clinicalPathway: string;
  previewBodyHtml: string;
  serviceId: string;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) > 0.01 ? n : null;
}

function uniq(values: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(values)) return out;
  for (const value of values) {
    const item = str(value);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function areaSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "area";
}

function customerFileCandidates(): string[] {
  return [
    path.join(PHARMACY_WORKSPACE_ROOT, "data", "pharmacy_customers.json"),
    path.join(PHARMACY_WORKSPACE_ROOT, "pharmacy_customers.json"),
    path.join(process.cwd(), "data", "pharmacy_customers.json"),
    path.join(process.cwd(), "pharmacy_customers.json"),
  ];
}

export function resolveCoreServiceId(raw: unknown): string | null {
  return resolveActiveServiceId(raw);
}

export function isRejectedSandboxSlug(slug: string): boolean {
  return REJECTED_SANDBOX_SLUGS.has(str(slug).toLowerCase());
}

function emptyCatchment(): GoogleCatchmentConfig {
  return {
    googlePlaceId: "",
    latitude: null,
    longitude: null,
    googleBusinessProfileUrl: "",
    googleMapsEmbedUrl: "",
    coverageRadius: "5 miles",
    rankingAreas: [],
    nearbyAreas: [],
    coverageAreas: [],
  };
}

function normalizeCatchment(raw: unknown): GoogleCatchmentConfig {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const placeId = str(row.googlePlaceId);
  const rankingAreas = uniq(row.rankingAreas);
  const nearbyAreas = uniq(row.nearbyAreas).length ? uniq(row.nearbyAreas) : rankingAreas;
  const coverageAreas = uniq(row.coverageAreas).length ? uniq(row.coverageAreas) : rankingAreas;
  return {
    googlePlaceId: placeId.toLowerCase() === "not connected" ? "" : placeId,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    googleBusinessProfileUrl: str(row.googleBusinessProfileUrl).toLowerCase() === "not connected"
      ? ""
      : str(row.googleBusinessProfileUrl),
    googleMapsEmbedUrl: str(row.googleMapsEmbedUrl),
    coverageRadius: str(row.coverageRadius) || "5 miles",
    rankingAreas,
    nearbyAreas,
    coverageAreas,
  };
}

function normalizeCustomer(raw: unknown): PharmacyCustomerRecord | null {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const slug = str(row.slug).toLowerCase();
  if (!slug || isRejectedSandboxSlug(slug)) return null;
  const channels = uniq(row.activeServiceChannels)
    .map((id) => resolveCoreServiceId(id))
    .filter((id): id is string => Boolean(id));
  return {
    slug,
    pharmacyName: str(row.pharmacyName) || slug,
    website: str(row.website),
    email: str(row.email),
    phone: str(row.phone),
    addressLine1: str(row.addressLine1),
    addressLine2: str(row.addressLine2),
    townCity: str(row.townCity),
    county: str(row.county),
    postcode: str(row.postcode),
    displayAddress: str(row.displayAddress),
    brandPrimaryColor: str(row.brandPrimaryColor) || "#6366f1",
    googleCatchment: normalizeCatchment(row.googleCatchment),
    activeServiceChannels: channels.length ? channels : [...CORE_SERVICE_IDS],
  };
}

function overlayLiveProfile(customer: PharmacyCustomerRecord): PharmacyCustomerRecord {
  const profilePath = getPharmacyProfilePath(customer.slug);
  if (!fs.existsSync(profilePath)) return customer;
  try {
    const doc = JSON.parse(fs.readFileSync(profilePath, "utf8")) as { data?: Record<string, unknown> };
    const data = doc.data && typeof doc.data === "object" ? doc.data : {};
    const snap = data.googleImportSnapshot && typeof data.googleImportSnapshot === "object"
      ? (data.googleImportSnapshot as Record<string, unknown>)
      : {};
    const placeId = str(data.googlePlaceId);
    const liveCatchment: GoogleCatchmentConfig = {
      googlePlaceId:
        placeId && placeId.toLowerCase() !== "not connected"
          ? placeId
          : str(snap.placeId) || customer.googleCatchment.googlePlaceId,
      latitude: num(data.latitude) ?? num(snap.latitude) ?? customer.googleCatchment.latitude,
      longitude: num(data.longitude) ?? num(snap.longitude) ?? customer.googleCatchment.longitude,
      googleBusinessProfileUrl: str(data.googleBusinessProfileUrl) || customer.googleCatchment.googleBusinessProfileUrl,
      googleMapsEmbedUrl: str(data.googleMapsEmbedUrl) || customer.googleCatchment.googleMapsEmbedUrl,
      coverageRadius: str(data.coverageRadius) || customer.googleCatchment.coverageRadius,
      rankingAreas: uniq(data.rankingAreas).length ? uniq(data.rankingAreas) : customer.googleCatchment.rankingAreas,
      nearbyAreas: uniq(data.nearbyAreas).length ? uniq(data.nearbyAreas) : customer.googleCatchment.nearbyAreas,
      coverageAreas: uniq(data.coverageAreas).length ? uniq(data.coverageAreas) : customer.googleCatchment.coverageAreas,
    };
    return {
      ...customer,
      pharmacyName: str(data.tradingName) || str(data.pharmacyName) || customer.pharmacyName,
      website: str(data.website) || customer.website,
      email: str(data.email) || str(data.businessEmail) || customer.email,
      phone: str(data.phone) || customer.phone,
      addressLine1: str(data.addressLine1) || customer.addressLine1,
      addressLine2: str(data.addressLine2) || customer.addressLine2,
      townCity: str(data.primaryTown) || str(data.townCity) || str(data.primaryCity) || customer.townCity,
      county: str(data.county) || customer.county,
      postcode: str(data.postcode) || customer.postcode,
      displayAddress: str(data.displayAddress) || customer.displayAddress,
      brandPrimaryColor: str(data.brandPrimaryColor) || customer.brandPrimaryColor,
      googleCatchment: liveCatchment,
    };
  } catch {
    return customer;
  }
}

function resolveMapsEmbed(customer: PharmacyCustomerRecord): string {
  const catchment = customer.googleCatchment;
  if (catchment.googleMapsEmbedUrl) return catchment.googleMapsEmbedUrl;
  if (catchment.latitude != null && catchment.longitude != null) {
    return `https://maps.google.com/maps?q=${catchment.latitude},${catchment.longitude}&hl=en&z=15&output=embed`;
  }
  if (catchment.googlePlaceId) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      `${customer.pharmacyName}, ${customer.townCity} ${customer.postcode} UK`,
    )}&hl=en&z=15&output=embed`;
  }
  const query = [customer.pharmacyName, customer.addressLine1, customer.townCity, customer.postcode, "UK"]
    .filter(Boolean)
    .join(", ");
  return query
    ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=en&z=15&output=embed`
    : "";
}

let catalogCache: PharmacyCustomerCatalog | null = null;

export function loadPharmacyCustomerCatalog(): PharmacyCustomerCatalog {
  if (catalogCache) return catalogCache;
  const filePath = customerFileCandidates().find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error("pharmacy_customers.json was not found in the workspace data directory.");
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { pharmacies?: unknown[]; coreServiceChannels?: unknown };
  const pharmacies = (Array.isArray(parsed.pharmacies) ? parsed.pharmacies : [])
    .map(normalizeCustomer)
    .filter((row): row is PharmacyCustomerRecord => Boolean(row))
    .map(overlayLiveProfile)
    .map((row) => ({
      ...row,
      googleCatchment: {
        ...row.googleCatchment,
        googleMapsEmbedUrl: resolveMapsEmbed(row),
      },
      activeServiceChannels: [...CORE_SERVICE_IDS],
    }));
  catalogCache = {
    version: 1,
    coreServiceChannels: CORE_SERVICE_CHANNELS.map((channel) => ({
      id: channel.id,
      label: channel.label,
      aliases: channel.aliases ? [...channel.aliases] : undefined,
    })),
    pharmacies,
  };
  return catalogCache;
}

export function listPharmacyCustomers(): PharmacyCustomerRecord[] {
  return loadPharmacyCustomerCatalog().pharmacies;
}

export function findPharmacyCustomer(slug: string): PharmacyCustomerRecord | null {
  const key = str(slug).toLowerCase();
  if (!key || isRejectedSandboxSlug(key)) return null;
  return listPharmacyCustomers().find((row) => row.slug === key) || null;
}

export function toPharmacyCustomerCard(customer: PharmacyCustomerRecord): PharmacyCustomerCard {
  return {
    slug: customer.slug,
    pharmacyName: customer.pharmacyName,
    townCity: customer.townCity,
    postcode: customer.postcode,
    website: customer.website,
    brandPrimaryColor: customer.brandPrimaryColor,
    displayAddress: customer.displayAddress,
    rankingAreaCount: customer.googleCatchment.rankingAreas.length,
    rankingAreas: customer.googleCatchment.rankingAreas,
    googlePlaceId: customer.googleCatchment.googlePlaceId,
    googleMapsEmbedUrl: customer.googleCatchment.googleMapsEmbedUrl,
    coverageRadius: customer.googleCatchment.coverageRadius,
    activeServiceChannels: customer.activeServiceChannels,
  };
}

export function listPharmacyCustomerCards(): PharmacyCustomerCard[] {
  return listPharmacyCustomers().map(toPharmacyCustomerCard);
}

export function coreServiceLabel(serviceId: string): string {
  const id = resolveCoreServiceId(serviceId) || serviceId;
  return CORE_SERVICE_CHANNELS.find((channel) => channel.id === id)?.label || id;
}

export function buildCatchmentPages(
  customer: PharmacyCustomerRecord,
  serviceId = "pharmacy-first",
): LocalClusterPage[] {
  const resolved = resolveCoreServiceId(serviceId) || "pharmacy-first";
  const label = coreServiceLabel(resolved);
  return customer.googleCatchment.rankingAreas.map((area) => ({
    suburbName: area,
    slug: `services/${resolved}-${customer.slug}/${areaSlug(area)}`,
    status: "DRAFT",
    clinicalPathway: label,
    previewBodyHtml: "",
    serviceId: resolved,
  }));
}

function readProfileData(slug: string): Record<string, unknown> {
  const profilePath = getPharmacyProfilePath(slug);
  if (!fs.existsSync(profilePath)) return {};
  try {
    const doc = JSON.parse(fs.readFileSync(profilePath, "utf8")) as { data?: Record<string, unknown> };
    return doc.data && typeof doc.data === "object" ? doc.data : {};
  } catch {
    return {};
  }
}

function snapshotRecord(raw: unknown) {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    status: str(row.status),
    importedAt: str(row.importedAt),
    message: str(row.message),
    placeId: str(row.placeId),
    businessName: str(row.businessName),
    address: str(row.address),
    town: str(row.town),
    postcode: str(row.postcode),
    phone: str(row.phone),
    website: str(row.website || row.websiteUrl),
    googleMapsUrl: str(row.googleMapsUrl || row.googleBusinessUrl),
    logoUrl: str(row.logoUrl),
  };
}

export function loadImportRecords(slug: string) {
  const data = readProfileData(slug);
  return {
    google: snapshotRecord(data.googleImportSnapshot),
    website: snapshotRecord(data.websiteImportSnapshot),
  };
}

export function loadCampaignRecords(slug: string) {
  const file = getPharmacyCampaignStorePath(slug);
  let stored: Array<Record<string, unknown>> = [];
  if (fs.existsSync(file)) {
    try {
      const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { campaigns?: Array<Record<string, unknown>> };
      stored = Array.isArray(doc.campaigns) ? doc.campaigns : [];
    } catch {
      stored = [];
    }
  }
  return CORE_SERVICE_CHANNELS.map((channel) => {
    const match = stored.find((row) => resolveCoreServiceId(row.serviceId) === channel.id);
    const areas = Array.isArray(match?.campaignAreas) ? match.campaignAreas : [];
    const selectedAreas = areas.filter((area) => {
      if (!area || typeof area !== "object") return false;
      return Boolean((area as { selected?: boolean }).selected);
    });
    const campaignId = str(match?.id) || channel.id;
    return {
      id: campaignId,
      serviceId: channel.id,
      label: channel.label,
      name: str(match?.name) || `${channel.label} campaign`,
      status: str(match?.status) || "not_started",
      publishingStatus: str(match?.publishingStatus),
      areaCount: selectedAreas.length,
      href: `/api/pharmacy-campaigns?slug=${encodeURIComponent(slug)}&campaignId=${encodeURIComponent(campaignId)}`,
      builderHref: `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=choose&campaign=${encodeURIComponent(channel.id)}`,
      reviewHref: `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(channel.id)}`,
    };
  });
}

export function loadCompetitorMatrix(slug: string): CompetitorMatrixRow[] {
  try {
    const snapshot = loadCompetitorSnapshot(slug);
    return (snapshot?.competitors || []).map((row) => ({
      name: str(row.businessName),
      reviewCount: Number(row.reviewCount) || 0,
      rating: Number(row.rating) || 0,
      address: str(row.address),
    }));
  } catch {
    return [];
  }
}

export function buildPharmacyDashboardPayload(slug: string, serviceId?: string) {
  const customer = findPharmacyCustomer(slug);
  if (!customer) return null;
  const resolvedService = resolveCoreServiceId(serviceId) || "pharmacy-first";
  const competitorsMatrix = loadCompetitorMatrix(customer.slug);
  const localClusterPages = buildCatchmentPages(customer, resolvedService);
  return {
    success: true,
    slug: customer.slug,
    pharmacyName: customer.pharmacyName,
    websiteUrl: customer.website,
    brandPrimaryColor: customer.brandPrimaryColor,
    profile: {
      email: customer.email,
      phone: customer.phone,
      addressLine1: customer.addressLine1,
      addressLine2: customer.addressLine2,
      townCity: customer.townCity,
      county: customer.county,
      postcode: customer.postcode,
      displayAddress: customer.displayAddress,
    },
    importRecords: loadImportRecords(customer.slug),
    campaigns: loadCampaignRecords(customer.slug),
    workspace: {
      profileHref: `/api/pharmacy-profile-wizard?slug=${encodeURIComponent(customer.slug)}`,
      growthHref: `/api/pharmacy-growth-dashboard?slug=${encodeURIComponent(customer.slug)}`,
      campaignsHref: `/api/pharmacy-campaigns?slug=${encodeURIComponent(customer.slug)}`,
      importHref: `/api/growth-engine/start?slug=${encodeURIComponent(customer.slug)}`,
    },
    googleCatchment: customer.googleCatchment,
    serviceChannels: CORE_SERVICE_CHANNELS.map((channel) => ({
      id: channel.id,
      label: channel.label,
      status: "active" as const,
      active: customer.activeServiceChannels.includes(channel.id),
    })),
    activeServiceChannels: customer.activeServiceChannels,
    selectedServiceId: resolvedService,
    totalCompetitorsIdentified: competitorsMatrix.length,
    competitorsMatrix,
    localClusterPages,
  };
}

export function buildGenerationHierarchy(customer: PharmacyCustomerRecord, serviceId: string) {
  const resolved = resolveCoreServiceId(serviceId) || "pharmacy-first";
  const primaryLocality = customer.townCity || customer.pharmacyName;
  return {
    ok: true,
    primaryLocality,
    primaryLocalitySlug: areaSlug(primaryLocality),
    hub: null,
    clusters: [],
    areas: [],
    generationAreas: customer.googleCatchment.rankingAreas.map((area) => ({
      areaId: `${customer.slug}-${areaSlug(area)}`,
      name: area,
      slug: `services/${resolved}-${customer.slug}/${areaSlug(area)}`,
      type: "neighbourhood-area",
      parentAreaId: null,
      source: "google-catchment",
      evidence: [customer.googleCatchment.googlePlaceId, customer.displayAddress].filter(Boolean),
      serviceIds: [resolved],
      generationEligible: true,
      generationReason: "production ranking area",
      approved: true,
    })),
    trace: {
      profilePath: getPharmacyProfilePath(customer.slug),
      tenantSlug: customer.slug,
      primaryLocation: primaryLocality,
      postcode: customer.postcode,
      townCity: customer.townCity,
      storedServiceAreas: customer.googleCatchment.rankingAreas,
      storedNeighbourhoods: customer.googleCatchment.nearbyAreas,
      importedLocationEvidence: [],
      googleLocationEvidence: [customer.googleCatchment.googlePlaceId].filter(Boolean),
      localIntelligenceAreas: customer.googleCatchment.rankingAreas,
      selectedAreasSource: "pharmacy_customers.json",
      selectedAreasFilters: [resolved],
      rejectedAreas: [],
      rejectionReasons: [],
      areasConsidered: customer.googleCatchment.rankingAreas,
    },
  };
}

export function mapsEmbedBaseUrl(): string {
  return "https://maps.google.com/maps?hl=en&z=15&output=embed";
}
