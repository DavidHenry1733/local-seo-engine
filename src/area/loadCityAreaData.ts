/**
 * Shared city area data loader — Local SEO Engine area/cluster source.
 * Loads rich format (src/area/areaData) or simple format (config/areas).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AffluenceTier,
  AreaProfile,
  CityAreaData,
  CompetitionLevel,
  SearchDemandLevel,
} from "./areaTypes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/areas"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export function citySlug(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

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
  const text = `${character} ${knownFor}`.toLowerCase();
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

export function simpleDataToCityAreaData(data: SimpleAreaData): CityAreaData {
  const areas: AreaProfile[] = data.coreAreas.map((name, idx) => {
    const profile = data.areaProfiles[name] ?? {
      character: "residential area",
      knownFor: "local businesses",
      businessType: "local businesses",
    };
    const isPriority = data.priorityAreas.includes(name);
    const affluenceTier = deriveAffluenceTier(profile.character, profile.knownFor);
    const competition = deriveCompetition(profile.knownFor);
    const searchDemand: SearchDemandLevel = isPriority ? "high" : idx < 8 ? "medium" : "low";
    return {
      name,
      postcode: "",
      priority: idx + 1,
      searchDemand,
      competition,
      affluenceTier,
      businessType: profile.businessType ?? "local businesses",
      character: profile.character ?? "a local community",
      knownFor: profile.knownFor ?? "local businesses",
      keywordModifier: profile.character ?? "local",
      landmarks: [],
      nearbyAreas: [],
      distanceKm: idx + 1,
    };
  });

  return {
    city: data.primaryCity,
    region: "",
    postcodeRoot: "",
    marketContext: `${data.primaryCity} local area covering ${data.coreAreas.length} communities.`,
    areas,
  };
}

export function loadCityAreaData(cityName: string, workspaceRoot?: string): CityAreaData {
  const root = workspaceRoot || resolveWorkspaceRoot();
  const slug = citySlug(cityName);
  const richFile = path.join(root, "src/area/areaData", `${slug}.json`);
  const simpleFile = path.join(root, "config/areas", `${slug}.json`);

  if (fs.existsSync(richFile)) {
    return JSON.parse(fs.readFileSync(richFile, "utf8")) as CityAreaData;
  }
  if (fs.existsSync(simpleFile)) {
    const simple = JSON.parse(fs.readFileSync(simpleFile, "utf8")) as SimpleAreaData;
    return simpleDataToCityAreaData(simple);
  }
  throw new Error(`No area data found for city: ${cityName}`);
}

export function listAvailableCities(workspaceRoot?: string): Array<{ name: string; slug: string }> {
  const root = workspaceRoot || resolveWorkspaceRoot();
  const seen = new Set<string>();
  const cities: Array<{ name: string; slug: string }> = [];

  const richDir = path.join(root, "src/area/areaData");
  if (fs.existsSync(richDir)) {
    for (const f of fs.readdirSync(richDir).filter((x) => x.endsWith(".json"))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(richDir, f), "utf8")) as CityAreaData;
        const slug = f.replace(".json", "");
        if (!seen.has(slug)) {
          seen.add(slug);
          cities.push({ name: data.city, slug });
        }
      } catch {
        /* skip */
      }
    }
  }

  const simpleDir = path.join(root, "config/areas");
  if (fs.existsSync(simpleDir)) {
    for (const f of fs.readdirSync(simpleDir).filter((x) => x.endsWith(".json"))) {
      const slug = f.replace(".json", "");
      if (seen.has(slug)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(simpleDir, f), "utf8")) as SimpleAreaData;
        seen.add(slug);
        cities.push({ name: data.primaryCity ?? cityNameFromSlug(slug), slug });
      } catch {
        /* skip */
      }
    }
  }

  return cities.sort((a, b) => a.name.localeCompare(b.name));
}

function cityNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
