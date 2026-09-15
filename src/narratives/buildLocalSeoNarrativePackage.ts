import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type LocalSeoProfile = "visibility" | "competition" | "growth" | "authority" | "conversion";
export type LocalSeoNarrativeKey = LocalSeoProfile;

interface LocalSeoAreaProfile {
  area: string;
  city: string;
  profile: LocalSeoProfile;
  reason: string;
}

interface LocalSeoV1Narrative {
  label: string;
  audience: string;
  trustDrivers: string[];
  conversionFocus: string;
  coreMessage: string;
  heroMessaging: string[];
  whyInvest: string[];
  problems: string[];
  doNothing: string[];
  outcomes: string[];
  mistakes: string[];
  faqs: string[];
  ctas: string[];
}

interface LocalSeoV1Config {
  serviceKey: string;
  serviceName: string;
  version: string;
  narratives: Record<LocalSeoNarrativeKey, LocalSeoV1Narrative>;
}

export interface LocalSeoNarrativePackage {
  area: string;
  city: string;
  profile: LocalSeoProfile;
  narrativeKey: LocalSeoNarrativeKey;
  reason: string;
  coreMessage: string;
  narrativeProfileData: {
    audience: string;
    trustDrivers: string[];
    conversionFocus: string;
  };
  selected: {
    hero: string;
    whyInvest: string;
    problems: string[];
    doNothing: string;
    outcomes: string[];
    mistakes: string[];
    faqs: string[];
    cta: string;
  };
}

const DEFAULT_PROFILE: LocalSeoProfile = "visibility";
const AREA_MAP_PATH = path.join("config", "area-profiles", "local-seo-area-map.json");
const V1_NARRATIVE_PATH = path.join("src", "narratives", "data", "local-seo-v1.json");

function findProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (currentDir !== path.dirname(currentDir)) {
    if (
      fs.existsSync(path.join(currentDir, AREA_MAP_PATH)) &&
      fs.existsSync(path.join(currentDir, V1_NARRATIVE_PATH))
    ) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(findProjectRoot(), relativePath), "utf8")) as T;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function interpolateArea(value: string, area: string): string {
  return value.replace(/\{\{AREA\}\}/g, area);
}

function findAreaProfile(
  areaProfiles: LocalSeoAreaProfile[],
  area: string,
  city?: string,
): LocalSeoAreaProfile | undefined {
  const requestedArea = normalise(area);
  const requestedCity = city ? normalise(city) : "";

  return areaProfiles.find((item) => {
    if (normalise(item.area) !== requestedArea) {
      return false;
    }

    return !requestedCity || normalise(item.city) === requestedCity;
  });
}

function hashString(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function selectDeterministicItems<T>(items: T[], count: number, seed: string): T[] {
  return items
    .map((item, index) => ({
      item,
      score: hashString(`${seed}:${index}:${String(item)}`),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(({ item }) => item);
}

function selectOne(items: string[], seed: string): string {
  return selectDeterministicItems(items, 1, seed)[0] ?? "";
}

export function buildLocalSeoNarrativePackage(
  area: string,
  city?: string,
): LocalSeoNarrativePackage {
  const areaProfiles = readJson<LocalSeoAreaProfile[]>(AREA_MAP_PATH);
  const v1Config = readJson<LocalSeoV1Config>(V1_NARRATIVE_PATH);
  const match = findAreaProfile(areaProfiles, area, city);
  const profile = match?.profile ?? DEFAULT_PROFILE;
  const narrativeKey: LocalSeoNarrativeKey = profile;
  const narrative = v1Config.narratives[narrativeKey];
  const selectedArea = match?.area ?? area;
  const selectedCity = match?.city ?? city ?? "";
  const seed = `${selectedArea}|${selectedCity}|${profile}|${narrativeKey}`;

  return {
    area: selectedArea,
    city: selectedCity,
    profile,
    narrativeKey,
    reason: match?.reason ?? "No area-specific Local SEO profile match found; using the default visibility narrative.",
    coreMessage: narrative.coreMessage,
    narrativeProfileData: {
      audience: narrative.audience,
      trustDrivers: narrative.trustDrivers,
      conversionFocus: narrative.conversionFocus,
    },
    selected: {
      hero: interpolateArea(selectOne(narrative.heroMessaging, `${seed}:hero`), selectedArea),
      whyInvest: selectOne(narrative.whyInvest, `${seed}:whyInvest`),
      problems: selectDeterministicItems(narrative.problems, 6, `${seed}:problems`),
      doNothing: selectOne(narrative.doNothing, `${seed}:doNothing`),
      outcomes: selectDeterministicItems(narrative.outcomes, 4, `${seed}:outcomes`),
      mistakes: selectDeterministicItems(narrative.mistakes, 4, `${seed}:mistakes`),
      faqs: selectDeterministicItems(narrative.faqs, 4, `${seed}:faqs`),
      cta: selectOne(narrative.ctas, `${seed}:cta`),
    },
  };
}

function isCliRun(): boolean {
  const invoked = process.argv[1] ? path.basename(process.argv[1]) : "";
  return /^buildLocalSeoNarrativePackage\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  const [, , areaArg, cityArg] = process.argv;

  if (!areaArg) {
    console.error("Usage: pnpm exec tsx src/narratives/buildLocalSeoNarrativePackage.ts \"Rotherham\" \"Rotherham\"");
    process.exit(1);
  }

  const narrativePackage = buildLocalSeoNarrativePackage(areaArg, cityArg);

  console.log(`area: ${narrativePackage.area}`);
  console.log(`city: ${narrativePackage.city}`);
  console.log(`profile: ${narrativePackage.profile}`);
  console.log(`narrativeKey: ${narrativePackage.narrativeKey}`);
  console.log(`coreMessage: ${narrativePackage.coreMessage}`);
  console.log("selected:");
  console.log(JSON.stringify(narrativePackage.selected, null, 2));
}
