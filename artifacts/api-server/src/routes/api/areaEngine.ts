import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AreaProfile,
  CityAreaData,
  AreaScore,
  AreaContentSignals,
  AreaEngineOutput,
  AreaEngineQuery,
  SearchDemandLevel,
  CompetitionLevel,
  AffluenceTier,
  AreaTier,
} from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const AREA_DATA_DIR = path.join(WORKSPACE_ROOT, "src", "area", "areaData");
const CONFIG_AREAS_DIR = path.join(WORKSPACE_ROOT, "config", "areas");

// ── Simple area config format (config/areas/*.json) ──────────────────────────
interface SimpleAreaProfile {
  character: string;
  knownFor: string;
  businessType: string;
}
interface SimpleAreaData {
  primaryCity: string;
  coreAreas: string[];
  priorityAreas: string[];
  areaProfiles: Record<string, SimpleAreaProfile>;
}

function deriveAffluenceTier(character: string, knownFor: string): AffluenceTier {
  const text = (character + " " + knownFor).toLowerCase();
  if (/affluent|premium|luxury|prestigious|exclusive/.test(text)) return "premium";
  if (/professional|prosperous|commuter|quality/.test(text)) return "professional";
  if (/student|diverse|creative|independent/.test(text)) return "mixed";
  return "community";
}

function deriveCompetition(knownFor: string): CompetitionLevel {
  const text = knownFor.toLowerCase();
  if (/professional|corporate|premium|luxury|tech/.test(text)) return "high";
  if (/independent|quality|retail/.test(text)) return "medium";
  return "low";
}

function simpleDataToCityAreaData(data: SimpleAreaData): CityAreaData {
  const areas: AreaProfile[] = data.coreAreas.map((name, idx) => {
    const profile = data.areaProfiles[name] ?? { character: "residential area", knownFor: "local businesses", businessType: "local businesses" };
    const isPriority = data.priorityAreas.includes(name);
    const affluenceTier = deriveAffluenceTier(profile.character, profile.knownFor);
    const competition = deriveCompetition(profile.knownFor);
    const searchDemand: SearchDemandLevel = isPriority ? "high" : idx < 8 ? "medium" : "low";
    return {
      name,
      priority: idx + 1,
      searchDemand,
      competition,
      affluenceTier,
      businessType: profile.businessType ?? "local businesses",
      character:    profile.character  ?? "a local community",
      knownFor:     profile.knownFor   ?? "local businesses",
      keywordModifier: profile.character ?? "local",
      localContext: `${profile.character ?? "a local community"}, known for ${profile.knownFor ?? "local businesses"}`,
      nearbyAreas: [],
    } as unknown as AreaProfile;
  });
  return {
    city: data.primaryCity,
    region: "",
    postcodeRoot: "",
    marketContext: `${data.primaryCity} local area covering ${data.coreAreas.length} communities.`,
    areas,
  } as unknown as CityAreaData;
}

// WIRING: This is an inline port of src/area/areaEngine.ts scoring logic.
//         For the full implementation with relatedAreaMap + coverageReport,
//         import runAreaEngine() from src/area/areaEngine.ts directly.

const router = Router();

// ── Scoring helpers ──────────────────────────────────────────────────────────

function demandPoints(level: SearchDemandLevel): number {
  return { high: 30, medium: 20, low: 10 }[level];
}

function competitionPoints(level: CompetitionLevel): number {
  return { low: 20, medium: 12, high: 5 }[level];
}

function affluencePoints(tier: AffluenceTier): number {
  return { premium: 25, professional: 20, mixed: 13, community: 8 }[tier];
}

function priorityPoints(priority: number): number {
  return Math.max(0, 25 - (priority - 1) * 5);
}

function scoreArea(profile: AreaProfile): number {
  return (
    demandPoints(profile.searchDemand) +
    competitionPoints(profile.competition) +
    affluencePoints(profile.affluenceTier) +
    priorityPoints(profile.priority)
  );
}

function assignTier(rank: number, maxPriority: number, maxSecondary: number): AreaTier {
  if (rank <= maxPriority) return "priority";
  if (rank <= maxPriority + maxSecondary) return "secondary";
  return "tertiary";
}

// ── Signal builders ──────────────────────────────────────────────────────────

function buildLocalContext(profile: AreaProfile, city: string): string {
  const character = profile.character ?? profile.keywordModifier ?? "a local community";
  const knownFor  = profile.knownFor  ?? profile.businessType   ?? "local businesses";
  return (
    `${profile.name} is ${character} in ${city}, known for ${knownFor}. ` +
    `The area's businesses are predominantly ${profile.businessType ?? "local businesses"}.`
  );
}

function buildDemandNote(level: SearchDemandLevel, serviceName: string, area: string): string {
  switch (level) {
    case "high":
      return `Search demand for ${serviceName} in ${area} is high — customers are actively looking, so visibility directly translates into enquiries.`;
    case "medium":
      return `Search demand for ${serviceName} in ${area} is consistent — steady local interest makes this a reliable target for organic lead generation.`;
    case "low":
      return `Search demand for ${serviceName} in ${area} is currently lower — pages should emphasise local relevance and trust to maximise conversion of available traffic.`;
  }
}

function buildCompetitionNote(level: CompetitionLevel, serviceName: string): string {
  switch (level) {
    case "high":
      return `${serviceName} is a competitive market in this area — differentiation through quality, trust signals and local specificity is essential.`;
    case "medium":
      return `${serviceName} has moderate competition in this area — a well-optimised page with strong local relevance can stand out clearly.`;
    case "low":
      return `${serviceName} has relatively few established competitors in this area — a strong first-mover presence can capture significant organic traffic.`;
  }
}

function buildCompetitorAngle(level: CompetitionLevel): string {
  switch (level) {
    case "high":
      return "Emphasise proven results, named local clients (where permitted), response speed and a clearly defined process. Avoid generic claims.";
    case "medium":
      return "Lead with local expertise and a clear value proposition. Highlight what makes the service distinct from volume agencies.";
    case "low":
      return "Position as the established local specialist. Build authority through content depth and local signals before competitors arrive.";
  }
}

function buildMessagingRegister(tier: AffluenceTier): string {
  switch (tier) {
    case "premium":
      return "Premium register: emphasise quality, ROI, and brand credibility. Avoid discount language. Target decision-makers who value outcomes over price.";
    case "professional":
      return "Professional register: business outcomes, efficiency, and credibility. Speak to busy owners who need reliable results.";
    case "mixed":
      return "Balanced register: quality and value in equal measure. Acknowledge cost sensitivity without underselling the service.";
    case "community":
      return "Community register: accessibility, trust, and local understanding. Referral and relationship language performs well here.";
  }
}

function buildPrimaryKeyword(serviceName: string, areaName: string): string {
  return `${serviceName} ${areaName}`;
}

// ── Available cities ─────────────────────────────────────────────────────────

router.get("/area-engine/cities", (_req, res) => {
  const seen = new Set<string>();
  const cities: { name: string; slug: string }[] = [];

  // 1. Rich format: src/area/areaData/
  if (fs.existsSync(AREA_DATA_DIR)) {
    for (const f of fs.readdirSync(AREA_DATA_DIR).filter(f => f.endsWith(".json"))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(AREA_DATA_DIR, f), "utf8")) as CityAreaData;
        const slug = f.replace(".json", "");
        if (!seen.has(slug)) { seen.add(slug); cities.push({ name: data.city, slug }); }
      } catch { /* skip */ }
    }
  }

  // 2. Simple format: config/areas/
  if (fs.existsSync(CONFIG_AREAS_DIR)) {
    for (const f of fs.readdirSync(CONFIG_AREAS_DIR).filter(f => f.endsWith(".json"))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CONFIG_AREAS_DIR, f), "utf8")) as SimpleAreaData;
        const slug = f.replace(".json", "");
        if (!seen.has(slug)) { seen.add(slug); cities.push({ name: data.primaryCity ?? (data as unknown as Record<string, unknown>).city as string, slug }); }
      } catch { /* skip */ }
    }
  }

  cities.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ cities });
});

// ── Main area engine route ───────────────────────────────────────────────────

router.get("/area-engine", (req, res) => {
  const { city, service, maxP, maxS } = req.query as unknown as AreaEngineQuery;

  if (!city || !service) {
    res.status(400).json({ error: "city and service query params are required" });
    return;
  }

  const citySlug = city.toLowerCase().replace(/\s+/g, "-");
  const richFile   = path.join(AREA_DATA_DIR, `${citySlug}.json`);
  const simpleFile = path.join(CONFIG_AREAS_DIR, `${citySlug}.json`);

  let cityData: CityAreaData;
  if (fs.existsSync(richFile)) {
    try {
      cityData = JSON.parse(fs.readFileSync(richFile, "utf8")) as CityAreaData;
    } catch {
      res.status(500).json({ error: "Failed to parse area data file" });
      return;
    }
  } else if (fs.existsSync(simpleFile)) {
    try {
      const simple = JSON.parse(fs.readFileSync(simpleFile, "utf8")) as SimpleAreaData;
      cityData = simpleDataToCityAreaData(simple);
    } catch {
      res.status(500).json({ error: "Failed to parse area data file" });
      return;
    }
  } else {
    res.status(404).json({
      error: `No area data found for city: ${city}`,
    });
    return;
  }

  const maxPriority = Math.max(1, parseInt(maxP ?? "5", 10));
  const maxSecondary = Math.max(0, parseInt(maxS ?? "4", 10));

  // Score and rank all areas
  const scored = cityData.areas
    .map((p) => ({ profile: p, score: scoreArea(p) }))
    .sort((a, b) => b.score - a.score);

  const rankedAreas: AreaScore[] = scored.map((item, i) => ({
    area: item.profile.name,
    score: item.score,
    rank: i + 1,
    tier: assignTier(i + 1, maxPriority, maxSecondary),
    postcode: item.profile.postcode,
    searchDemand: item.profile.searchDemand,
    competition: item.profile.competition,
    affluenceTier: item.profile.affluenceTier,
  }));

  // Build content signals and related area map
  const profileMap = Object.fromEntries(
    cityData.areas.map((p) => [p.name, p])
  );

  const contentSignals: Record<string, AreaContentSignals> = {};
  const relatedAreaMap: Record<string, string[]> = {};

  for (const item of scored) {
    const p = item.profile;
    contentSignals[p.name] = {
      area: p.name,
      city: cityData.city,
      serviceName: service,
      primaryKeyword: buildPrimaryKeyword(service, p.name),
      businessType: p.businessType,
      keywordModifier: p.keywordModifier,
      localContext: buildLocalContext(p, cityData.city),
      demandNote: buildDemandNote(p.searchDemand, service, p.name),
      competitionNote: buildCompetitionNote(p.competition, service),
      competitorAngle: buildCompetitorAngle(p.competition),
      messagingRegister: buildMessagingRegister(p.affluenceTier),
      landmarks: p.landmark ? [p.landmark] : [],
      nearbyAreas: p.nearbyAreas ?? [],
    };
    relatedAreaMap[p.name] = (p.nearbyAreas ?? []).filter(
      (n) => profileMap[n] !== undefined
    );
  }

  const output: AreaEngineOutput = {
    city: cityData.city,
    serviceName: service,
    rankedAreas,
    contentSignals,
    relatedAreaMap,
  };

  res.json(output);
});

export default router;
