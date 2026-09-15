/**
 * Growth Engine — Local Healthcare Intelligence V1 model.
 * Real Google Places data only — never invent values.
 */
import type { GrowthEngineCompetitor, GrowthEngineYourPharmacy } from "./growthEngineCompetitorModel.ts";

export type HealthcareProviderGroupKey =
  | "gpSurgeries"
  | "healthCentres"
  | "walkInCentres"
  | "hospitals"
  | "careHomes"
  | "dentists"
  | "opticians"
  | "physiotherapists"
  | "podiatrists"
  | "mentalHealthServices"
  | "urgentTreatmentCentres"
  | "communityClinics";

export type HealthcareDisplayGroupKey =
  | "gpSurgeries"
  | "healthCentres"
  | "hospitals"
  | "careHomes"
  | "otherPharmacies"
  | "healthcareServices";

export type CompetitorOwnershipType = "independent" | "regional" | "national" | "unknown";

export interface HealthcareProviderEntity {
  placeId: string;
  businessName: string;
  category: string;
  groupKey: HealthcareProviderGroupKey;
  distanceKm: number | null;
  distanceLabel: string;
  address: string;
  rating: number | null;
  reviewCount: number;
  phone: string;
  website: string;
  openingStatus: string;
  googleMapsUrl: string;
  latitude: number | null;
  longitude: number | null;
  source: "google-places";
}

export interface HealthcareEcosystemGroup {
  id: HealthcareDisplayGroupKey;
  label: string;
  count: number;
  nearest: HealthcareProviderEntity | null;
  providers: HealthcareProviderEntity[];
}

export interface HealthcareAnalysisSnapshot {
  dataSource: "google-places-live" | "unavailable";
  providerCount: number;
  summaryParagraphs: string[];
  opportunities: string[];
  ecosystemGroups: HealthcareEcosystemGroup[];
  competitorGroups: {
    independent: number;
    regional: number;
    national: number;
    unknown: number;
  };
}

export interface HealthcareMapMarker {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  layer: "your-pharmacy" | "healthcare-provider" | "competitor";
  groupKey?: HealthcareDisplayGroupKey | HealthcareProviderGroupKey;
  ownershipType?: CompetitorOwnershipType;
  placeId?: string;
}

export interface HealthcareMapModel {
  center: { latitude: number; longitude: number } | null;
  zoom: number;
  markers: HealthcareMapMarker[];
  futureLayers: {
    catchmentOverlay: null;
    driveTimeAnalysis: null;
    referralRoutes: null;
    demographicLayers: null;
  };
}

export interface HealthcareFutureSection {
  id: string;
  label: string;
  status: "available-in-future";
  note: string;
}

export const HEALTHCARE_DISPLAY_GROUP_LABELS: Record<HealthcareDisplayGroupKey, string> = {
  gpSurgeries: "GP Surgeries",
  healthCentres: "Health Centres",
  hospitals: "Hospitals",
  careHomes: "Care Homes",
  otherPharmacies: "Other Pharmacies",
  healthcareServices: "Healthcare Services",
};

export const HEALTHCARE_FUTURE_SECTIONS: HealthcareFutureSection[] = [
  { id: "website-intelligence", label: "Website Intelligence", status: "available-in-future", note: "Available in future analysis" },
  { id: "referral-intelligence", label: "Referral Intelligence", status: "available-in-future", note: "Available in future analysis" },
  { id: "population-intelligence", label: "Population Intelligence", status: "available-in-future", note: "Available in future analysis" },
  { id: "catchment-analysis", label: "Catchment Analysis", status: "available-in-future", note: "Available in future analysis" },
  { id: "healthcare-network", label: "Healthcare Network", status: "available-in-future", note: "Available in future analysis" },
];

export interface GrowthEngineHealthcareSnapshot {
  version: number;
  generatedAt: string;
  providers: HealthcareProviderEntity[];
  analysis: HealthcareAnalysisSnapshot | null;
  mapModel: HealthcareMapModel | null;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeHealthcareProvider(raw: unknown): HealthcareProviderEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const businessName = str(item.businessName || item.name);
  if (!businessName) return null;
  const placeId = str(item.placeId);
  if (!placeId || placeId.startsWith("demo-")) return null;

  const ratingRaw = item.rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
      ? null
      : Math.min(5, Math.max(0, Number(ratingRaw) || 0));

  const groupKey = str(item.groupKey) as HealthcareProviderGroupKey;
  const validGroups: HealthcareProviderGroupKey[] = [
    "gpSurgeries", "healthCentres", "walkInCentres", "hospitals", "careHomes",
    "dentists", "opticians", "physiotherapists", "podiatrists", "mentalHealthServices",
    "urgentTreatmentCentres", "communityClinics",
  ];

  return {
    placeId,
    businessName,
    category: str(item.category) || "Healthcare",
    groupKey: validGroups.includes(groupKey) ? groupKey : "communityClinics",
    distanceKm: numOrNull(item.distanceKm),
    distanceLabel: str(item.distanceLabel),
    address: str(item.address),
    rating,
    reviewCount: Math.max(0, Number(item.reviewCount) || 0),
    phone: str(item.phone),
    website: str(item.website),
    openingStatus: str(item.openingStatus),
    googleMapsUrl: str(item.googleMapsUrl),
    latitude: numOrNull(item.latitude),
    longitude: numOrNull(item.longitude),
    source: "google-places",
  };
}

export function normalizeHealthcareSnapshot(raw: unknown): GrowthEngineHealthcareSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  const providers = Array.isArray(doc.providers)
    ? doc.providers.map(normalizeHealthcareProvider).filter(Boolean) as HealthcareProviderEntity[]
    : [];

  return {
    version: Number(doc.version) || 1,
    generatedAt: str(doc.generatedAt) || new Date().toISOString(),
    providers,
    analysis: doc.analysis && typeof doc.analysis === "object" ? (doc.analysis as HealthcareAnalysisSnapshot) : null,
    mapModel: doc.mapModel && typeof doc.mapModel === "object" ? (doc.mapModel as HealthcareMapModel) : null,
  };
}

export function emptyHealthcareSnapshot(): GrowthEngineHealthcareSnapshot {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    providers: [],
    analysis: null,
    mapModel: null,
  };
}

export interface ClassifiedCompetitor extends GrowthEngineCompetitor {
  ownershipType: CompetitorOwnershipType;
  chainBrand: string | null;
}
