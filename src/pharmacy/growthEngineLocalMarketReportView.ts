/**
 * Local Market Report V2 — presentation view model (read-only, no engine changes).
 * Derives commercial intelligence from live Google Places snapshot data only.
 * Local-area context reads existing profile, local-intelligence and healthcare records.
 */
import fs from "node:fs";
import path from "node:path";
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import type { HealthcareProviderEntity } from "./growthEngineHealthcareModel.ts";
import {
  buildOpportunityHighlights,
  realGoogleCompetitors,
} from "./growthEngineLocalMarketAnalysis.ts";
import { realHealthcareProviders } from "./growthEngineHealthcareDiscovery.ts";
import { loadProfileDataForLocalMarket } from "./growthEngineLocalMarketService.ts";
import type { ProfileLocalEntity } from "./pharmacyProfileLocalIntelligenceSelection.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export interface LocalMarketOverviewCounts {
  pharmacies: number;
  gpSurgeries: number;
  hospitals: number;
  healthCentres: number;
  walkInCentres: number;
  careHomes: number;
  otherHealthcare: number;
}

export interface LocalMarketReportView {
  live: boolean;
  lastUpdated: string | null;
  overview: LocalMarketOverviewCounts;
  insights: string[];
  actions: string[];
  opportunitySummary: string;
}

const SERVICE_PROVIDER_KEYS = new Set([
  "dentists",
  "opticians",
  "physiotherapists",
  "podiatrists",
  "mentalHealthServices",
  "communityClinics",
  "urgentTreatmentCentres",
]);

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function countHealthcare(providers: HealthcareProviderEntity[]): Omit<LocalMarketOverviewCounts, "pharmacies"> {
  const live = realHealthcareProviders(providers);
  return {
    gpSurgeries: live.filter((p) => p.groupKey === "gpSurgeries").length,
    hospitals: live.filter((p) => p.groupKey === "hospitals").length,
    healthCentres: live.filter((p) => p.groupKey === "healthCentres").length,
    walkInCentres: live.filter((p) => p.groupKey === "walkInCentres").length,
    careHomes: live.filter((p) => p.groupKey === "careHomes").length,
    otherHealthcare: live.filter((p) => SERVICE_PROVIDER_KEYS.has(p.groupKey)).length,
  };
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function buildExtraInsights(
  snapshot: GrowthEngineCompetitorSnapshot,
): string[] {
  const yours = snapshot.yourPharmacy;
  const pool = realGoogleCompetitors(snapshot.competitors);
  const insights: string[] = [];
  if (!yours || !pool.length) return insights;

  const reviewAvg = avg(pool.map((c) => c.reviewCount));
  if (reviewAvg != null && yours.reviewCount < reviewAvg) {
    insights.push("Your pharmacy has fewer Google reviews than the local average.");
  }

  const ratingAvg = avg(pool.map((c) => c.rating).filter((r): r is number => r != null));
  const maxRating = Math.max(...pool.map((c) => c.rating ?? 0));
  if (yours.rating != null && ratingAvg != null && yours.rating >= ratingAvg && yours.rating >= maxRating - 0.05) {
    insights.push("Your rating is one of the highest in your area.");
  }

  const photoAvg = avg(pool.map((c) => c.photoCount));
  if (photoAvg != null && yours.photoCount < photoAvg) {
    const significantlyMore = pool.filter((c) => c.photoCount > yours.photoCount + 10).length;
    if (significantlyMore >= 2) {
      insights.push("Most competitors have significantly more business photos on Google.");
    } else {
      insights.push("Your Google Business profile has fewer photos than the local average.");
    }
  }

  const yourCats = 1 + yours.secondaryCategories.length;
  const moreCategories = pool.filter((c) => 1 + c.secondaryCategories.length > yourCats).length;
  if (moreCategories >= 2) {
    insights.push("Several competitors promote additional services on their Google listing.");
  }

  if (!yours.openingHours.length && pool.filter((c) => c.openingHours.length > 0).length >= pool.length / 2) {
    insights.push("Many nearby pharmacies list opening hours on Google — yours may be incomplete.");
  }

  if (!yours.website && pool.filter((c) => c.website).length >= Math.ceil(pool.length / 2)) {
    insights.push("Many competitors link a website from Google — patients may not find yours as easily.");
  }

  return insights;
}

function dedupeInsights(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 6);
}

function buildRecommendedActions(insights: string[], snapshot: GrowthEngineCompetitorSnapshot): string[] {
  const yours = snapshot.yourPharmacy;
  const pool = realGoogleCompetitors(snapshot.competitors);
  const actions: string[] = [];

  const add = (action: string) => {
    if (actions.length < 6 && !actions.includes(action)) actions.push(action);
  };

  for (const insight of insights) {
    const lower = insight.toLowerCase();
    if (lower.includes("fewer google reviews")) add("Increase Google reviews by inviting patients to share their experience.");
    else if (lower.includes("fewer photos") || lower.includes("more business photos")) add("Upload additional business photos to your Google profile.");
    else if (lower.includes("additional services")) add("Promote more pharmacy services on your Google Business Profile.");
    else if (lower.includes("opening hours") || lower.includes("incomplete")) add("Complete missing business information on Google.");
    else if (lower.includes("website")) add("Add your website link to your Google Business Profile.");
    else if (lower.includes("below the local average") && lower.includes("rating")) add("Focus on patient experience to strengthen your Google rating.");
  }

  if (yours && pool.length) {
    if (!yours.phone) add("Complete missing business information on Google.");
    if (!yours.openingHours.length) add("Complete missing business information on Google.");
  }

  add("Keep your Google Business Profile active with regular updates and fresh photos.");

  return actions.slice(0, 6);
}

function buildOpportunitySummary(insights: string[], snapshot: GrowthEngineCompetitorSnapshot): string {
  const yours = snapshot.yourPharmacy;
  const pool = realGoogleCompetitors(snapshot.competitors);
  if (!pool.length) {
    return "Run Discover local market to load live Google Places data. We only show counts and comparisons from genuine Google listings — nothing is invented.";
  }

  const parts: string[] = [];
  if (yours?.rating != null && yours.rating >= 4.5) {
    parts.push("Your pharmacy already has a strong Google rating.");
  } else if (yours?.rating != null) {
    parts.push(`Your pharmacy is rated ${yours.rating.toFixed(1)} on Google among ${pool.length} nearby pharmacies.`);
  } else {
    parts.push(`We analysed ${pool.length} nearby pharmacies from Google Places.`);
  }

  const reviewInsight = insights.find((i) => /reviews/i.test(i));
  const photoInsight = insights.find((i) => /photo/i.test(i));
  const serviceInsight = insights.find((i) => /services/i.test(i));

  if (reviewInsight && photoInsight) {
    parts.push("Increasing your review count and adding more business photos represents the biggest opportunity to improve your local presence.");
  } else if (reviewInsight) {
    parts.push("Growing your Google review count is the clearest opportunity to strengthen your local presence.");
  } else if (photoInsight) {
    parts.push("Adding more business photos is a practical next step to stand out against nearby pharmacies.");
  } else if (serviceInsight) {
    parts.push("Expanding the services visible on your Google listing could help patients discover what you offer.");
  } else if (insights.some((i) => /highest/i.test(i))) {
    parts.push("Maintaining your reputation and keeping your profile fresh will help you stay ahead locally.");
  } else {
    parts.push("Keep your Google profile complete and active to stay competitive in your area.");
  }

  return truncateWords(parts.join(" "), 120);
}

export function buildLocalMarketReportView(
  snapshot: GrowthEngineCompetitorSnapshot | null,
  healthcareCardCounts?: Pick<LocalMarketOverviewCounts, "gpSurgeries" | "healthCentres" | "hospitals">,
): LocalMarketReportView {
  if (!snapshot) {
    return {
      live: false,
      lastUpdated: null,
      overview: { pharmacies: 0, gpSurgeries: 0, hospitals: 0, healthCentres: 0, walkInCentres: 0, careHomes: 0, otherHealthcare: 0 },
      insights: [],
      actions: [],
      opportunitySummary: "",
    };
  }

  const live = snapshot.analysis?.dataSource === "google-places-live";
  const pool = realGoogleCompetitors(snapshot.competitors);
  const snapshotHc = countHealthcare(snapshot.healthcare?.providers || []);
  const hcCounts = {
    ...snapshotHc,
    ...(healthcareCardCounts
      ? {
          gpSurgeries: healthcareCardCounts.gpSurgeries,
          healthCentres: healthcareCardCounts.healthCentres,
          hospitals: healthcareCardCounts.hospitals,
        }
      : {}),
  };

  const baseInsights = live && snapshot.yourPharmacy
    ? buildOpportunityHighlights(snapshot.yourPharmacy, snapshot.competitors)
    : [];
  const extraInsights = live ? buildExtraInsights(snapshot) : [];
  const insights = dedupeInsights([...extraInsights, ...baseInsights.map((o) => o.replace(/^You /, "Your pharmacy ").replace(/^You have/, "Your pharmacy has"))]);

  const actions = live ? buildRecommendedActions(insights, snapshot) : [];

  return {
    live,
    lastUpdated: snapshot.generatedAt || null,
    overview: {
      pharmacies: pool.length,
      ...hcCounts,
    },
    insights,
    actions,
    opportunitySummary: live ? buildOpportunitySummary(insights, snapshot) : "",
  };
}

export function sortCompetitorsByDistance<T extends { distanceKm: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

export interface LocalContextPlaceCard {
  name: string;
  typeLabel: string;
  distanceLabel: string;
  mapsUrl: string;
  websiteUrl: string;
}

export interface LocalContextAreaBadge {
  name: string;
  kindLabel: string;
  distanceLabel: string;
}

export interface LocalMarketLocalContextView {
  pharmacyLocation: string;
  primaryTown: string;
  coverageRadiusLabel: string;
  servedAreas: LocalContextAreaBadge[];
  gpSurgeries: LocalContextPlaceCard[];
  healthCentres: LocalContextPlaceCard[];
  hospitals: LocalContextPlaceCard[];
  landmarks: LocalContextPlaceCard[];
}

function cleanPublicUrl(value: unknown): string {
  const url = String(value || "").trim();
  if (!/^https?:\/\//i.test(url)) return "";
  if (/query_place_id=|place_id=/i.test(url)) return "";
  if (/ChIJ[A-Za-z0-9_-]{10,}/.test(url)) return "";
  if (/-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/.test(url)) return "";
  return url;
}

function isOutOfHoursGpService(name: string, typeLabel = ""): boolean {
  const blob = `${name} ${typeLabel}`.toLowerCase();
  return /\biheart\b/.test(blob) || /out[\s-]*of[\s-]*hours/.test(blob);
}

function looksInternalName(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (/^ChIJ[A-Za-z0-9_-]+$/.test(n)) return true;
  if (/[{}\[\]"]/.test(n)) return true;
  if (/^(place_id|lat|lng|latitude|longitude)=/i.test(n)) return true;
  return false;
}

function areaKindLabel(areaType: string | undefined, selected: boolean): string {
  const t = String(areaType || "").toLowerCase();
  if (/primary/.test(t)) return "Primary area";
  if (selected) return "Local area served";
  return "Nearby area";
}

function entityTypeLabel(entityType: string, fallback: string): string {
  if (entityType === "gpSurgeries") return "GP surgery";
  if (entityType === "healthCentres") return "Health centre";
  if (entityType === "hospitals") return "Hospital";
  if (entityType === "landmarks") return "Landmark";
  const cat = String(fallback || "").replace(/_/g, " ").trim();
  if (cat && !/^[a-z0-9_]+$/.test(cat)) return cat.replace(/\b\w/g, (c) => c.toUpperCase());
  return fallback;
}

function cardFromEntity(entity: ProfileLocalEntity, fallbackType: string): LocalContextPlaceCard | null {
  if (entity.source === "demo pack") return null;
  const name = String(entity.name || "").trim();
  if (!name || looksInternalName(name)) return null;
  if (entity.selected === false) return null;
  const extra = entity as ProfileLocalEntity & { website?: string; googleMapsUrl?: string };
  return {
    name,
    typeLabel: entityTypeLabel(String(entity.entityType || ""), entity.category || fallbackType),
    distanceLabel: String(entity.distanceLabel || "").trim(),
    mapsUrl: cleanPublicUrl(extra.googleMapsUrl),
    websiteUrl: cleanPublicUrl(extra.website),
  };
}

function cardFromIntelRecord(record: unknown, fallbackType: string): LocalContextPlaceCard | null {
  if (typeof record === "string") return cardFromName(record, fallbackType);
  if (!record || typeof record !== "object") return null;
  const item = record as Record<string, unknown>;
  if (String(item.source || "") === "demo pack") return null;
  const name = String(item.name || "").trim();
  if (!name || looksInternalName(name)) return null;
  if (item.selected === false) return null;
  const typeLabel = entityTypeLabel(String(item.entityType || ""), String(item.typeLabel || item.category || fallbackType));
  if (fallbackType === "GP surgery" && isOutOfHoursGpService(name, typeLabel)) return null;
  return {
    name,
    typeLabel,
    distanceLabel: String(item.distanceLabel || "").trim(),
    mapsUrl: cleanPublicUrl(item.googleMapsUrl),
    websiteUrl: cleanPublicUrl(item.website),
  };
}

function cardFromName(name: string, typeLabel: string): LocalContextPlaceCard | null {
  const cleaned = String(name || "").trim();
  if (!cleaned || looksInternalName(name)) return null;
  if (typeLabel === "GP surgery" && isOutOfHoursGpService(cleaned, typeLabel)) return null;
  return { name: cleaned, typeLabel, distanceLabel: "", mapsUrl: "", websiteUrl: "" };
}

function cardFromProvider(provider: HealthcareProviderEntity, typeLabel: string): LocalContextPlaceCard | null {
  const name = String(provider.businessName || "").trim();
  if (!name || looksInternalName(name)) return null;
  return {
    name,
    typeLabel: String(provider.category || typeLabel).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || typeLabel,
    distanceLabel: String(provider.distanceLabel || "").trim(),
    mapsUrl: cleanPublicUrl(provider.googleMapsUrl),
    websiteUrl: cleanPublicUrl(provider.website),
  };
}

function mergeCards(cards: Array<LocalContextPlaceCard | null>): LocalContextPlaceCard[] {
  const seen = new Set<string>();
  const out: LocalContextPlaceCard[] = [];
  for (const card of cards) {
    if (!card) continue;
    const key = card.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

function namesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readLocalIntelligencePlaces(slug: string): {
  gpSurgeries: unknown[];
  healthCentres: unknown[];
  hospitals: unknown[];
  landmarks: unknown[];
} {
  const empty = { gpSurgeries: [] as unknown[], healthCentres: [], hospitals: [], landmarks: [] };
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-local-intelligence", `${slug}.json`);
  if (!fs.existsSync(file)) return empty;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const healthcare = namesFrom(doc.localHealthcareLocations);
    return {
      gpSurgeries: [...asList(doc.gpSurgeries), ...namesFrom(doc.localGps)],
      healthCentres: [
        ...asList(doc.healthCentres),
        ...healthcare.filter((n) => /health centre|medical centre/i.test(n)),
      ],
      hospitals: [
        ...asList(doc.hospitals),
        ...(namesFrom(doc.localHospitals).length
          ? namesFrom(doc.localHospitals)
          : healthcare.filter((n) => /hospital/i.test(n))),
      ],
      landmarks: [...asList(doc.landmarks), ...namesFrom(doc.localLandmarks)],
    };
  } catch {
    return empty;
  }
}

export function buildLocalMarketLocalContextView(
  slug: string,
  snapshot: GrowthEngineCompetitorSnapshot | null,
): LocalMarketLocalContextView {
  const profile: PharmacyProfileData = loadProfileDataForLocalMarket(slug);
  const intel = readLocalIntelligencePlaces(slug);
  const providers = realHealthcareProviders(snapshot?.healthcare?.providers || []);

  const servedAreas = (profile.selectedAreas || [])
    .filter((area) => area && area.selected !== false && String(area.areaName || "").trim())
    .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.priority || 0) - (b.priority || 0))
    .map((area) => ({
      name: String(area.areaName).trim(),
      kindLabel: areaKindLabel(area.areaType, true),
      distanceLabel: String(area.distanceLabel || "").trim(),
    }));

  const pharmacyLocation =
    String(profile.displayAddress || "").trim() ||
    [profile.addressLine1, profile.addressLine2, profile.townCity, profile.postcode].filter(Boolean).join(", ");
  const primaryTown = String(profile.primaryTown || profile.townCity || "").trim();
  const coverageRadiusLabel = String(profile.coverageRadius || "").trim();

  const gpSurgeries = mergeCards([
    ...providers.filter((p) => p.groupKey === "gpSurgeries").map((p) => cardFromProvider(p, "GP surgery")),
    ...(profile.gpSurgeries || []).map((e) => cardFromEntity(e, "GP surgery")),
    ...namesFrom(profile.localGpSurgeries).map((n) => cardFromName(n, "GP surgery")),
    ...namesFrom(profile.localGps).map((n) => cardFromName(n, "GP surgery")),
    ...intel.gpSurgeries.map((n) => cardFromIntelRecord(n, "GP surgery")),
  ]).filter((card) => !isOutOfHoursGpService(card.name, card.typeLabel));

  const healthCentres = mergeCards([
    ...providers.filter((p) => p.groupKey === "healthCentres").map((p) => cardFromProvider(p, "Health centre")),
    ...(profile.healthCentres || []).map((e) => cardFromEntity(e, "Health centre")),
    ...namesFrom(profile.nearbyHealthCentres).map((n) => cardFromName(n, "Health centre")),
    ...intel.healthCentres.map((n) => cardFromIntelRecord(n, "Health centre")),
  ]);

  const hospitals = mergeCards([
    ...providers.filter((p) => p.groupKey === "hospitals").map((p) => cardFromProvider(p, "Hospital")),
    ...(profile.hospitals || []).map((e) => cardFromEntity(e, "Hospital")),
    ...namesFrom(profile.nearbyHospitals).map((n) => cardFromName(n, "Hospital")),
    ...namesFrom(profile.localHospitals).map((n) => cardFromName(n, "Hospital")),
    ...intel.hospitals.map((n) => cardFromIntelRecord(n, "Hospital")),
  ]);

  const landmarks = mergeCards([
    ...(profile.landmarks || []).map((e) => cardFromEntity(e, "Landmark")),
    ...namesFrom(profile.localLandmarks).map((n) => cardFromName(n, "Landmark")),
    ...intel.landmarks.map((n) => cardFromIntelRecord(n, "Landmark")),
  ]);

  return {
    pharmacyLocation,
    primaryTown,
    coverageRadiusLabel,
    servedAreas,
    gpSurgeries,
    healthCentres,
    hospitals,
    landmarks,
  };
}
