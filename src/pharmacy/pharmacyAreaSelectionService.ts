/**
 * PharmaConnect Growth Engine — Area Selection Manager.
 * Scores, grades and persists area candidates for content generation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const GROWTH_ENGINE_ROOT =
  process.env.PHARMACONNECT_GROWTH_ENGINE_ROOT ||
  (fs.existsSync("/home/inboxingproweb/pharmaconnect-growth-engine")
    ? "/home/inboxingproweb/pharmaconnect-growth-engine"
    : WORKSPACE_ROOT);

function dirHasJsonFiles(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith(".json"));
  } catch {
    return false;
  }
}

function dataRoot(): string {
  if (dirHasJsonFiles(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles"))) return WORKSPACE_ROOT;
  if (dirHasJsonFiles(path.join(GROWTH_ENGINE_ROOT, "data/pharmacy-profiles"))) return GROWTH_ENGINE_ROOT;
  return GROWTH_ENGINE_ROOT;
}

const ROOT = dataRoot();

export const LOCAL_INTEL_DIR = path.join(ROOT, "data/pharmacy-local-intelligence");
export const PROFILE_DIR = path.join(ROOT, "data/pharmacy-profiles");

export const MAX_SELECTED_AREAS = 12;
export const RECOMMENDED_SELECTED_AREAS = 8;
export const MAX_DISPLAY_CANDIDATES = 18;
export const MIN_CANDIDATE_SCORE = 40;

export type AreaGrade = "A" | "B" | "C";

export interface AreaCandidate {
  area: string;
  score: number;
  grade: AreaGrade;
  reason: string;
  selected: boolean;
}

export interface PharmacyLocalIntelligenceDoc {
  slug: string;
  generatedAt?: string;
  areaScoredAt?: string;
  town?: string;
  localAuthority?: string;
  localAreas?: string[];
  localResidentialAreas?: string[];
  localLandmarks?: string[];
  localHealthcareLocations?: string[];
  localEmployers?: string[];
  localRetailCentres?: string[];
  localCommunityLocations?: string[];
  localCareHomes?: string[];
  areaCandidates?: AreaCandidate[];
  selectedAreas?: string[];
  [key: string]: unknown;
}

const STREET_PATTERNS = [
  /\broad\b/i,
  /\bstreet\b/i,
  /\bst\b/i,
  /\blane\b/i,
  /\bway\b/i,
  /\bavenue\b/i,
  /\bdrive\b/i,
  /\bclose\b/i,
  /\bcrescent\b/i,
  /\bterrace\b/i,
  /\bgrove\b/i,
  /\bbus stop\b/i,
  /\bbus station\b/i,
  /\broundabout\b/i,
];

const BUSINESS_PATTERNS = [
  /\bco-?operative\b/i,
  /\bboots\b/i,
  /\basda\b/i,
  /\btesco\b/i,
  /\bsainsbury/i,
  /\bsupermarket\b/i,
  /\bsnooker\b/i,
  /\bhealth club\b/i,
  /\bsports centre\b/i,
  /\bsports center\b/i,
  /\bmuseum\b/i,
  /\blimited\b/i,
  /\bltd\b/i,
  /\bplc\b/i,
  /\bpharmacy\b/i,
  /\bsurgery\b/i,
  /\bmedical centre\b/i,
  /\bhospital\b/i,
  /\bclinic\b/i,
  /\buniversity\b/i,
  /\bcollege\b/i,
  /\bchurch\b/i,
  /\blibrary\b/i,
  /\byouth centre\b/i,
  /\bneighbourhood centre\b/i,
  /\bstanding stones\b/i,
];

const INTERNAL_CODE = /^[A-Z]\d+[A-Z]?$/i;
const POSTCODE_FRAGMENT = /^[A-Z]{1,2}\d{1,2}\s?\d?[A-Z]{0,2}$/i;

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function normalizeAreaKey(area: string): string {
  return area.trim().toLowerCase().replace(/\s+/g, " ");
}

function gradeFromScore(score: number): AreaGrade | null {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= MIN_CANDIDATE_SCORE) return "C";
  return null;
}

function isLowValueName(area: string): { reject: boolean; reason?: string } {
  const n = area.trim();
  if (!n || n.length < 3) return { reject: true, reason: "Too small or obscure" };
  if (INTERNAL_CODE.test(n)) return { reject: true, reason: "Looks like an internal area code" };
  if (POSTCODE_FRAGMENT.test(n)) return { reject: true, reason: "Looks like a postcode fragment" };
  for (const p of STREET_PATTERNS) {
    if (p.test(n)) return { reject: true, reason: "Looks like a street or transport stop" };
  }
  for (const p of BUSINESS_PATTERNS) {
    if (p.test(n)) return { reject: true, reason: "Looks like a business or building name" };
  }
  if (/\bindustrial\b/i.test(n) || /\bunit\b/i.test(n) || /\bestate\b/i.test(n) && n.length < 12) {
    return { reject: true, reason: "Looks like an industrial or generic estate label" };
  }
  return { reject: false };
}

interface ScoreContext {
  town: string;
  localAreasSet: Set<string>;
  residentialSet: Set<string>;
  landmarkSet: Set<string>;
  businessSet: Set<string>;
  rankingAreas: string[];
}

function buildScoreContext(doc: PharmacyLocalIntelligenceDoc, rankingAreas: string[] = []): ScoreContext {
  const toSet = (items?: string[]) =>
    new Set((items || []).map((a) => normalizeAreaKey(a)).filter(Boolean));

  return {
    town: String(doc.town || doc.localAuthority || "").trim(),
    localAreasSet: toSet(doc.localAreas),
    residentialSet: toSet(doc.localResidentialAreas),
    landmarkSet: toSet([
      ...(doc.localLandmarks || []),
      ...(doc.localHealthcareLocations || []),
      ...(doc.localEmployers || []),
      ...(doc.localRetailCentres || []),
      ...(doc.localCommunityLocations || []),
    ]),
    businessSet: toSet([
      ...(doc.localHealthcareLocations || []),
      ...(doc.localEmployers || []),
      ...(doc.localRetailCentres || []),
      ...(doc.localLandmarks || []),
    ]),
    rankingAreas,
  };
}

function scoreSingleArea(area: string, ctx: ScoreContext): { score: number; reason: string } | null {
  const low = isLowValueName(area);
  if (low.reject) return null;

  const key = normalizeAreaKey(area);
  let score = 45;
  const reasons: string[] = [];

  if (ctx.localAreasSet.has(key)) {
    score += 35;
    reasons.push("Recognised local area from intelligence discovery");
  }

  if (ctx.residentialSet.has(key)) {
    score += 12;
    reasons.push("Residential neighbourhood signal");
  }

  if (ctx.rankingAreas.some((r) => normalizeAreaKey(r) === key)) {
    score += 15;
    reasons.push("Marked as a profile ranking priority");
  }

  if (ctx.town && key === normalizeAreaKey(ctx.town)) {
    score += 8;
    reasons.push("Primary town location");
  }

  if (/\b(suburb|village|park|gate|worth|ham|ton|field|wood|side|green|hill)\b/i.test(area)) {
    score += 5;
    reasons.push("Name pattern matches a searchable suburb or neighbourhood");
  } else if (/(?:worth|marsh|gate|ham|ton|field|ford|ley|wick|borough|side|wood|hill|green|park)$/i.test(area)) {
    score += 8;
    reasons.push("Recognised suburb or neighbourhood name pattern");
  }

  if (area.split(/\s+/).length === 1 && ctx.localAreasSet.has(key)) {
    score += 3;
    reasons.push("Compact local place name likely to be searched");
  }

  if (ctx.businessSet.has(key) && !ctx.localAreasSet.has(key)) {
    score -= 35;
    reasons.push("More likely a business or landmark than a patient search area");
  } else if (ctx.landmarkSet.has(key) && !ctx.localAreasSet.has(key)) {
    score -= 25;
    reasons.push("Detected as a landmark rather than a residential service area");
  }

  if (area.split(/\s+/).length >= 3 && !ctx.localAreasSet.has(key)) {
    score -= 10;
    reasons.push("Longer place label with weaker local-area signal");
  }

  score = Math.max(0, Math.min(100, score));
  if (score < MIN_CANDIDATE_SCORE) return null;

  const grade = gradeFromScore(score)!;
  let reason = reasons[0] || "Local area within selected radius";

  if (grade === "A") {
    if (/parkgate|rawmarsh|wickersley|brinsworth|maltby/i.test(area)) {
      reason = "Recognised nearby residential area";
    } else if (reason.includes("suburb") || reason.includes("neighbourhood")) {
      reason = "Recognised suburb with strong local relevance";
    } else if (/retail|centre|center/i.test(area)) {
      reason = "Recognised local area and retail destination";
    }
  } else if (grade === "C") {
    reason = reason.includes("neighbourhood") ? reason : "Smaller local neighbourhood";
  }

  return { score, reason };
}

function collectRawCandidates(doc: PharmacyLocalIntelligenceDoc): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name?: string) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    const key = normalizeAreaKey(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };

  for (const a of doc.localAreas || []) add(a);
  for (const a of doc.localResidentialAreas || []) add(a);
  return out;
}

export function scoreAreaCandidates(
  doc: PharmacyLocalIntelligenceDoc,
  rankingAreas: string[] = [],
  preserveSelection = true,
): AreaCandidate[] {
  const ctx = buildScoreContext(doc, rankingAreas);
  const previousSelected = new Set(
    (preserveSelection ? doc.selectedAreas || [] : []).map(normalizeAreaKey),
  );
  const previousCandidateSelected = new Map(
    (doc.areaCandidates || []).map((c) => [normalizeAreaKey(c.area), c.selected]),
  );

  const scored: AreaCandidate[] = [];
  for (const area of collectRawCandidates(doc)) {
    const result = scoreSingleArea(area, ctx);
    if (!result) continue;
    const grade = gradeFromScore(result.score)!;
    const wasSelected =
      previousSelected.has(normalizeAreaKey(area)) ||
      previousCandidateSelected.get(normalizeAreaKey(area)) === true;

    scored.push({
      area,
      score: result.score,
      grade,
      reason: result.reason,
      selected: wasSelected,
    });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.area.split(/\s+/).length - b.area.split(/\s+/).length ||
      a.area.localeCompare(b.area),
  );
  return scored.slice(0, MAX_DISPLAY_CANDIDATES);
}

export function localIntelligencePath(slug: string): string {
  return path.join(LOCAL_INTEL_DIR, `${slug}.json`);
}

export function profilePath(slug: string): string {
  return path.join(PROFILE_DIR, `${slug}.json`);
}

export function loadPharmacyLocalIntelligenceDoc(slug: string): PharmacyLocalIntelligenceDoc {
  const doc = readJson<PharmacyLocalIntelligenceDoc>(localIntelligencePath(slug));
  if (!doc) {
    throw new Error(`Local Intelligence not found for "${slug}". Build Local Intelligence first.`);
  }
  return { ...doc, slug: doc.slug || slug };
}

function loadProfileRankingAreas(slug: string): string[] {
  const profile = readJson<{ data?: { rankingAreas?: string[] } }>(profilePath(slug));
  return profile?.data?.rankingAreas || [];
}

function syncProfileRankingAreas(slug: string, selectedAreas: string[]): void {
  const file = profilePath(slug);
  const profile = readJson<{ slug?: string; data?: Record<string, unknown> }>(file);
  if (!profile) return;
  profile.data = profile.data || {};
  profile.data.rankingAreas = selectedAreas;
  writeJson(file, profile);
}

export function enrichLocalIntelligence(doc: PharmacyLocalIntelligenceDoc, slug: string): PharmacyLocalIntelligenceDoc {
  const rankingAreas = loadProfileRankingAreas(slug);
  const areaCandidates = scoreAreaCandidates(doc, rankingAreas, true);

  let selectedAreas = (doc.selectedAreas || []).filter(Boolean);
  if (!selectedAreas.length) {
    selectedAreas = areaCandidates
      .filter((c) => c.selected)
      .map((c) => c.area);
  }

  return {
    ...doc,
    slug,
    areaCandidates,
    selectedAreas,
    areaScoredAt: new Date().toISOString(),
  };
}

export function getLocalIntelligence(slug: string): PharmacyLocalIntelligenceDoc {
  const doc = loadPharmacyLocalIntelligenceDoc(slug);
  if (!doc.areaCandidates?.length) {
    const enriched = enrichLocalIntelligence(doc, slug);
    writeJson(localIntelligencePath(slug), enriched);
    return enriched;
  }
  return doc;
}

export function rescoreLocalIntelligence(slug: string): PharmacyLocalIntelligenceDoc {
  const doc = loadPharmacyLocalIntelligenceDoc(slug);
  const enriched = enrichLocalIntelligence(doc, slug);
  writeJson(localIntelligencePath(slug), enriched);
  return enriched;
}

export function saveSelectedAreas(slug: string, selectedAreas: string[]): PharmacyLocalIntelligenceDoc {
  if (selectedAreas.length > MAX_SELECTED_AREAS) {
    throw new Error(`Maximum ${MAX_SELECTED_AREAS} areas can be selected.`);
  }

  const doc = getLocalIntelligence(slug);
  const selectedSet = new Set(selectedAreas.map(normalizeAreaKey));

  const areaCandidates = (doc.areaCandidates || []).map((c) => ({
    ...c,
    selected: selectedSet.has(normalizeAreaKey(c.area)),
  }));

  const normalizedSelected = areaCandidates.filter((c) => c.selected).map((c) => c.area);

  const updated: PharmacyLocalIntelligenceDoc = {
    ...doc,
    slug,
    selectedAreas: normalizedSelected,
    areaCandidates,
    updatedAt: new Date().toISOString(),
  };

  writeJson(localIntelligencePath(slug), updated);
  syncProfileRankingAreas(slug, normalizedSelected);
  return updated;
}

export function resolveBlueprintAreas(
  doc: PharmacyLocalIntelligenceDoc,
  maxAreas: number,
): string[] {
  const cap = Math.min(maxAreas, MAX_SELECTED_AREAS);
  const selected = (doc.selectedAreas || []).filter(Boolean);
  if (selected.length) return selected.slice(0, cap);

  const fallback = (doc.areaCandidates || [])
    .filter((c) => c.score >= MIN_CANDIDATE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map((c) => c.area);

  return fallback;
}

export function getAreaSelectionStatus(slug: string): {
  hasLocalIntelligence: boolean;
  candidateCount: number;
  selectedCount: number;
  recommendedCount: number;
} {
  if (!fs.existsSync(localIntelligencePath(slug))) {
    return { hasLocalIntelligence: false, candidateCount: 0, selectedCount: 0, recommendedCount: 0 };
  }
  try {
    const doc = getLocalIntelligence(slug);
    return {
      hasLocalIntelligence: true,
      candidateCount: (doc.areaCandidates || []).length,
      selectedCount: (doc.selectedAreas || []).length,
      recommendedCount: RECOMMENDED_SELECTED_AREAS,
    };
  } catch {
    return { hasLocalIntelligence: false, candidateCount: 0, selectedCount: 0, recommendedCount: 0 };
  }
}

export function evaluateAreaNameForDiscovery(
  area: string,
  primaryTown: string,
): { accept: boolean; reason?: string } {
  const low = isLowValueName(area);
  if (low.reject) return { accept: false, reason: low.reason || "Low-confidence name" };

  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const townNorm = norm(primaryTown);
  const areaNorm = norm(area);
  if (townNorm && areaNorm === townNorm) {
    return { accept: false, reason: "Primary town or city" };
  }
  if (/^(south|north|east|west)\s+yorkshire$/i.test(area)) {
    return { accept: false, reason: "County or region" };
  }
  if (/\bshire$/i.test(area) && areaNorm !== townNorm) {
    return { accept: false, reason: "County" };
  }
  if (/^(united kingdom|england|scotland|wales)$/i.test(area)) {
    return { accept: false, reason: "Country" };
  }
  return { accept: true };
}
