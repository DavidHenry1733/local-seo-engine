import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type WebDesignProfile =
  | "growth_business"
  | "established_company"
  | "professional_services"
  | "local_trades"
  | "premium_brand";

interface WebDesignAreaProfile {
  area: string;
  city: string;
  profile: WebDesignProfile;
  reason: string;
}

interface WebDesignNarrativeProfileData {
  audience: string;
  pain_points: string[];
  goals: string[];
  trust_drivers: string[];
  messaging_angle: string;
  conversion_focus: string;
  proof_points: string[];
}

type WebDesignNarratives = Record<WebDesignProfile, WebDesignNarrativeProfileData>;

export interface SelectedWebDesignNarrative {
  area: string;
  city: string;
  profile: WebDesignProfile;
  reason: string;
  narrativeProfileData: WebDesignNarrativeProfileData;
}

const DEFAULT_PROFILE: WebDesignProfile = "growth_business";
const AREA_MAP_PATH = path.join("config", "area-profiles", "web-design-area-map.json");
const NARRATIVES_PATH = path.join("config", "narratives", "web-design.v2.json");

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function findProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (currentDir !== path.dirname(currentDir)) {
    if (
      fs.existsSync(path.join(currentDir, AREA_MAP_PATH)) &&
      fs.existsSync(path.join(currentDir, NARRATIVES_PATH))
    ) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

function readJson<T>(relativePath: string): T {
  const filePath = path.join(findProjectRoot(), relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function findAreaProfile(
  areaProfiles: WebDesignAreaProfile[],
  area: string,
  city?: string,
): WebDesignAreaProfile | undefined {
  const requestedArea = normalise(area);
  const requestedCity = city ? normalise(city) : "";

  return areaProfiles.find((item) => {
    if (normalise(item.area) !== requestedArea) {
      return false;
    }

    return !requestedCity || normalise(item.city) === requestedCity;
  });
}

export function selectWebDesignNarrative(
  area: string,
  city?: string,
): SelectedWebDesignNarrative {
  const areaProfiles = readJson<WebDesignAreaProfile[]>(AREA_MAP_PATH);
  const narratives = readJson<WebDesignNarratives>(NARRATIVES_PATH);
  const match = findAreaProfile(areaProfiles, area, city);
  const profile = match?.profile ?? DEFAULT_PROFILE;

  return {
    area: match?.area ?? area,
    city: match?.city ?? city ?? "",
    profile,
    reason: match?.reason ?? "No area-specific profile match found; using the default growth business narrative.",
    narrativeProfileData: narratives[profile],
  };
}

function isCliRun(): boolean {
  const invoked = process.argv[1] ? path.basename(process.argv[1]) : "";
  return /^selectWebDesignNarrative\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  const [, , areaArg, cityArg] = process.argv;

  if (!areaArg) {
    console.error("Usage: pnpm exec tsx src/narratives/selectWebDesignNarrative.ts \"Dore\" \"Sheffield\"");
    process.exit(1);
  }

  const selected = selectWebDesignNarrative(areaArg, cityArg);

  console.log(`area: ${selected.area}`);
  console.log(`city: ${selected.city}`);
  console.log(`profile: ${selected.profile}`);
  console.log(`reason: ${selected.reason}`);
  console.log("narrativeProfileData:");
  console.log(JSON.stringify(selected.narrativeProfileData, null, 2));
}
