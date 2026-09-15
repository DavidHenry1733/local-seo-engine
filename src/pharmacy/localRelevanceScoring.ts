/**
 * Local Relevance Pack V2 — entity relevance scoring for Google Places results.
 */
export interface LocalEntityInput {
  name: string;
  address?: string;
  types?: string[];
  location?: { latitude: number; longitude: number } | null;
}

export interface ScoredLocalEntity extends LocalEntityInput {
  score: number;
  category: LocalEntityCategory;
  rejectionReason?: string;
}

export type LocalEntityCategory =
  | "healthcare"
  | "community"
  | "landmarks"
  | "retail"
  | "transport"
  | "schools"
  | "rejected";

export interface ScoringContext {
  area: string;
  areaSlug: string;
  town: string;
  postcode?: string;
  pharmacyLat?: number;
  pharmacyLng?: number;
}

const HEALTHCARE_TYPES = new Set([
  "doctor",
  "hospital",
  "health",
  "medical_clinic",
  "medical_center",
  "physiotherapist",
  "dentist",
  "pharmacy",
]);

const COMMUNITY_TYPES = new Set([
  "library",
  "community_center",
  "sports_complex",
  "sports_activity_location",
  "gym",
  "leisure_center",
  "event_venue",
]);

const LANDMARK_TYPES = new Set(["park", "tourist_attraction", "museum", "shopping_mall"]);
const RETAIL_TYPES = new Set(["shopping_mall", "department_store", "supermarket", "store"]);
const TRANSPORT_TYPES = new Set([
  "train_station",
  "bus_station",
  "transit_station",
  "light_rail_station",
  "subway_station",
]);
const SCHOOL_TYPES = new Set([
  "school",
  "primary_school",
  "secondary_school",
  "educational_institution",
  "university",
]);

const COUNTY_WIDE_PATTERNS =
  /rotherham college|dearne valley|university centre rotherham|thomas rotherham college|sheffield hallam|sheffield university/i;

function slugify(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function classifyEntityTypes(types: string[] = []): LocalEntityCategory {
  const lower = types.map((t) => t.toLowerCase());
  if (lower.some((t) => HEALTHCARE_TYPES.has(t) && t !== "pharmacy")) return "healthcare";
  if (lower.some((t) => TRANSPORT_TYPES.has(t))) return "transport";
  if (lower.some((t) => COMMUNITY_TYPES.has(t))) return "community";
  if (lower.some((t) => LANDMARK_TYPES.has(t))) return "landmarks";
  if (lower.some((t) => RETAIL_TYPES.has(t))) return "retail";
  if (lower.some((t) => SCHOOL_TYPES.has(t))) return "schools";
  return "community";
}

function categoryBoost(category: LocalEntityCategory, types: string[] = []): number {
  const lower = types.map((t) => t.toLowerCase());
  if (category === "healthcare") {
    if (lower.includes("doctor") || lower.includes("medical_clinic")) return 18;
    if (lower.includes("medical_center") || lower.includes("hospital")) return 14;
    return 10;
  }
  if (category === "community") {
    if (lower.includes("library") || lower.includes("community_center")) return 16;
    if (lower.includes("sports_complex") || lower.includes("gym")) return 12;
    return 8;
  }
  if (category === "landmarks") {
    if (lower.includes("park")) return 14;
    return 10;
  }
  if (category === "retail") return 8;
  if (category === "transport") return 10;
  if (category === "schools") {
    if (lower.includes("primary_school") || lower.includes("secondary_school")) return 12;
    if (lower.includes("university")) return -8;
    return 6;
  }
  return 0;
}

function areaMatchScore(entity: LocalEntityInput, ctx: ScoringContext): number {
  const hay = `${entity.name} ${entity.address || ""}`.toLowerCase();
  const area = ctx.area.toLowerCase();
  const slug = ctx.areaSlug || slugify(ctx.area);
  let score = 0;
  if (hay.includes(area)) score += 28;
  if (hay.includes(slug.replace(/-/g, " "))) score += 12;
  if (ctx.postcode && entity.address?.toUpperCase().includes(ctx.postcode.split(" ")[0]?.toUpperCase() || "")) {
    score += 8;
  }
  if (ctx.town && hay.includes(ctx.town.toLowerCase()) && !hay.includes(area)) score += 4;
  return score;
}

function distanceScore(entity: LocalEntityInput, ctx: ScoringContext): number {
  if (!entity.location || ctx.pharmacyLat == null || ctx.pharmacyLng == null) return 0;
  const km = haversineKm(ctx.pharmacyLat, ctx.pharmacyLng, entity.location.latitude, entity.location.longitude);
  if (km <= 1.5) return 22;
  if (km <= 3) return 16;
  if (km <= 5) return 8;
  if (km <= 8) return 2;
  return -12;
}

function shouldReject(entity: LocalEntityInput, ctx: ScoringContext, category: LocalEntityCategory): string | null {
  const name = entity.name || "";
  const address = entity.address || "";
  const hay = `${name} ${address}`.toLowerCase();

  if (/pharmacy|chemist|boots|rowlands|lloyds|superdrug|asda pharmacy/i.test(hay)) {
    return "competitor-pharmacy";
  }
  if (COUNTY_WIDE_PATTERNS.test(hay) && !hay.includes(ctx.area.toLowerCase())) {
    return "county-wide-institution";
  }
  if (category === "schools" && /university|college/i.test(name) && !hay.includes(ctx.area.toLowerCase())) {
    return "distant-college";
  }
  if (!name.trim() || name.length < 3) return "weak-name";
  if (areaMatchScore(entity, ctx) < 4 && distanceScore(entity, ctx) <= 0) {
    return "weak-relevance";
  }
  return null;
}

export function scoreLocalEntity(entity: LocalEntityInput, ctx: ScoringContext): ScoredLocalEntity {
  const category = classifyEntityTypes(entity.types || []);
  const rejection = shouldReject(entity, ctx, category);
  if (rejection) {
    return { ...entity, category: "rejected", score: 0, rejectionReason: rejection };
  }

  const score =
    areaMatchScore(entity, ctx) +
    distanceScore(entity, ctx) +
    categoryBoost(category, entity.types || []);

  return { ...entity, category, score: Math.max(0, Math.round(score)) };
}

export function dedupeEntities(entities: ScoredLocalEntity[]): ScoredLocalEntity[] {
  const seen = new Map<string, ScoredLocalEntity>();
  for (const e of entities) {
    if (e.category === "rejected" || e.score <= 0) continue;
    const key = slugify(e.name);
    const existing = seen.get(key);
    if (!existing || e.score > existing.score) seen.set(key, e);
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

export function scoreAndBucketEntities(
  rawEntities: LocalEntityInput[],
  ctx: ScoringContext,
): {
  healthcare: ScoredLocalEntity[];
  community: ScoredLocalEntity[];
  landmarks: ScoredLocalEntity[];
  retail: ScoredLocalEntity[];
  transport: ScoredLocalEntity[];
  schools: ScoredLocalEntity[];
  topHealthcare: ScoredLocalEntity[];
  topCommunity: ScoredLocalEntity[];
  topLandmarks: ScoredLocalEntity[];
} {
  const scored = dedupeEntities(rawEntities.map((e) => scoreLocalEntity(e, ctx)));

  const bucket = (cat: LocalEntityCategory) => scored.filter((e) => e.category === cat);
  const healthcare = bucket("healthcare");
  const community = bucket("community");
  const landmarks = bucket("landmarks");
  const retail = bucket("retail");
  const transport = bucket("transport");
  const schools = bucket("schools");

  return {
    healthcare,
    community,
    landmarks,
    retail,
    transport,
    schools,
    topHealthcare: healthcare.slice(0, 3),
    topCommunity: community.slice(0, 3),
    topLandmarks: landmarks.slice(0, 3),
  };
}

export function entityDisplayName(entity: ScoredLocalEntity | LocalEntityInput): string {
  return String(entity.name || "").trim();
}
