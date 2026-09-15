import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  selectWebDesignNarrative,
  type SelectedWebDesignNarrative,
} from "./selectWebDesignNarrative";

type WebDesignProfile = SelectedWebDesignNarrative["profile"];
type V1NarrativeKey = "growth" | "trust" | "competition" | "conversion" | "authority";

interface WebDesignV1Narrative {
  label: string;
  coreMessage: string;
  whyInvest: string[];
  problems: string[];
  doNothing: string[];
  outcomes: string[];
  mistakes: string[];
  faqs: string[];
  ctas: string[];
}

interface WebDesignV1Config {
  serviceKey: string;
  serviceName: string;
  version: string;
  narratives: Record<V1NarrativeKey, WebDesignV1Narrative>;
}

export interface WebDesignNarrativePackage {
  area: string;
  city: string;
  profile: WebDesignProfile;
  narrativeKey: V1NarrativeKey;
  reason: string;
  coreMessage: string;
  selected: {
    whyInvest: string;
    problems: string[];
    doNothing: string;
    outcomes: string[];
    mistakes: string[];
    faqs: string[];
    cta: string;
  };
  narrativeProfileData: SelectedWebDesignNarrative["narrativeProfileData"];
}

const V1_NARRATIVE_PATH = path.join("config", "narratives", "web-design.v1.json");

const PROFILE_TO_NARRATIVE_KEY: Record<WebDesignProfile, V1NarrativeKey> = {
  growth_business: "growth",
  established_company: "conversion",
  professional_services: "trust",
  local_trades: "competition",
  premium_brand: "authority",
};

function findProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, V1_NARRATIVE_PATH))) {
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

export function buildWebDesignNarrativePackage(
  area: string,
  city?: string,
): WebDesignNarrativePackage {
  const selectedNarrative = selectWebDesignNarrative(area, city);
  const v1Config = readJson<WebDesignV1Config>(V1_NARRATIVE_PATH);
  const narrativeKey = PROFILE_TO_NARRATIVE_KEY[selectedNarrative.profile];
  const narrative = v1Config.narratives[narrativeKey];
  const seed = `${selectedNarrative.area}|${selectedNarrative.city}|${selectedNarrative.profile}|${narrativeKey}`;

  return {
    area: selectedNarrative.area,
    city: selectedNarrative.city,
    profile: selectedNarrative.profile,
    narrativeKey,
    reason: selectedNarrative.reason,
    coreMessage: narrative.coreMessage,
    selected: {
      whyInvest: selectOne(narrative.whyInvest, `${seed}:whyInvest`),
      problems: selectDeterministicItems(narrative.problems, 6, `${seed}:problems`),
      doNothing: selectOne(narrative.doNothing, `${seed}:doNothing`),
      outcomes: selectDeterministicItems(narrative.outcomes, 4, `${seed}:outcomes`),
      mistakes: selectDeterministicItems(narrative.mistakes, 4, `${seed}:mistakes`),
      faqs: selectDeterministicItems(narrative.faqs, 4, `${seed}:faqs`),
      cta: selectOne(narrative.ctas, `${seed}:cta`),
    },
    narrativeProfileData: selectedNarrative.narrativeProfileData,
  };
}

function isCliRun(): boolean {
  const invoked = process.argv[1] ? path.basename(process.argv[1]) : "";
  return /^buildWebDesignNarrativePackage\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  const [, , areaArg, cityArg] = process.argv;

  if (!areaArg) {
    console.error("Usage: pnpm exec tsx src/narratives/buildWebDesignNarrativePackage.ts \"Dore\" \"Sheffield\"");
    process.exit(1);
  }

  const narrativePackage = buildWebDesignNarrativePackage(areaArg, cityArg);

  console.log(`area: ${narrativePackage.area}`);
  console.log(`city: ${narrativePackage.city}`);
  console.log(`profile: ${narrativePackage.profile}`);
  console.log(`narrativeKey: ${narrativePackage.narrativeKey}`);
  console.log(`coreMessage: ${narrativePackage.coreMessage}`);
  console.log("selected:");
  console.log(JSON.stringify(narrativePackage.selected, null, 2));
  console.log("narrativeProfileData:");
  console.log(JSON.stringify(narrativePackage.narrativeProfileData, null, 2));
}
