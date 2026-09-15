/**
 * Editorial style contract for UK local service-page introductions.
 * Ten reusable writing structures, assigned stably across a campaign’s selected
 * areas. Not fixed copy. No tenant, service, town or area-name branches.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export const UK_LOCAL_INTRODUCTION_STYLE_CONTRACT_ID = "pharmacy-uk-local-introduction-style-contract-v1";
export const UK_LOCAL_INTRODUCTION_STYLE_CONTRACT_VERSION = "v1";
export const UK_LOCAL_INTRODUCTION_MIN_WORDS = 150;
export const UK_LOCAL_INTRODUCTION_MAX_WORDS = 250;
export const UK_LOCAL_INTRODUCTION_GEMINI_MIN_WORDS = 170;
export const UK_LOCAL_INTRODUCTION_GEMINI_MAX_WORDS = 230;
export const UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS = 35;
export const UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS = 55;

export type UkLocalIntroductionStructureId =
  | "civic-identity-first"
  | "named-landmark-first"
  | "healthcare-setting-first"
  | "geography-then-places"
  | "community-life-first"
  | "heritage-then-present"
  | "civic-amenity-first"
  | "twin-anchor-weave"
  | "daily-places-then-care"
  | "setting-then-service";

export type UkLocalIntroductionStructure = {
  id: UkLocalIntroductionStructureId;
  label: string;
  instruction: string;
};

export const UK_LOCAL_INTRODUCTION_STRUCTURES: UkLocalIntroductionStructure[] = [
  {
    id: "civic-identity-first",
    label: "Civic identity, then daily places, then the service",
    instruction:
      "Open with the verified civic or administrative identity of the selected area. Continue with named community, park or shopping facts from this area’s brief. Close by naming the selected service for people in this area, without eligibility, conditions, process or GP comparison.",
  },
  {
    id: "named-landmark-first",
    label: "Named landmark or park, then civic life, then the service",
    instruction:
      "Open with a named landmark, park or outdoor place from this area’s brief. Then place that setting in the verified geography and civic life of the area. Close by connecting the selected service to people in this area, without clinical paraphrase.",
  },
  {
    id: "healthcare-setting-first",
    label: "Named healthcare setting, then civic facts, then the service",
    instruction:
      "Open with one named verified healthcare provider that belongs to this area. Do not imply registration, referral or partnership. Continue with civic, park or community facts from the same brief. Close with a natural mention of the selected service for this area.",
  },
  {
    id: "geography-then-places",
    label: "Geography first, then named places, then the service",
    instruction:
      "Open with the verified geographical setting of the selected area. Then weave several named local references from this brief into connected paragraphs. Finish by naming the selected service for readers in this area, without inventing travel or convenience.",
  },
  {
    id: "community-life-first",
    label: "Community venues first, then healthcare, then the service",
    instruction:
      "Open with named community, civic or shopping places from this area’s brief. Continue with one verified healthcare setting if one exists. Close by connecting the selected service to this area in plain British English.",
  },
  {
    id: "heritage-then-present",
    label: "Heritage or civic history, then present-day places, then the service",
    instruction:
      "Open with a verified heritage or longer-standing civic fact from this brief, and stop at what the statement supports. Then describe present-day named parks, libraries or community places. Close with the selected service for people in this area.",
  },
  {
    id: "civic-amenity-first",
    label: "Library or civic amenity first, then geography, then the service",
    instruction:
      "Open with a named library, board, hall or similar civic amenity from this brief. Then add the verified geography and one further named local reference. Close with the selected service for this area, without restating renderer-owned clinical copy.",
  },
  {
    id: "twin-anchor-weave",
    label: "Civic and healthcare as twin anchors",
    instruction:
      "Start from a civic or community fact and a verified healthcare setting for this area, weaving them in the same opening movement rather than listing them. Add further named places only where they belong. Close with the selected service for this area.",
  },
  {
    id: "daily-places-then-care",
    label: "Daily places, then care setting, then the service",
    instruction:
      "Open with everyday named places from this brief such as parks, shopping or community venues. Then mention one verified healthcare setting if available. Close by naming the selected service for people who live in this area.",
  },
  {
    id: "setting-then-service",
    label: "Compact setting, several named facts, then the service",
    instruction:
      "Give a compact opening of the area’s verified setting, then move through several distinct named facts in connected sentences rather than a catalogue. Keep the assigned shape. End with a natural link to the selected service for this area.",
  },
];

const ASSIGNMENT_DIRNAME = "data/pharmacy-uk-local-introduction-assignments";

export function countUkLocalIntroductionWords(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromParts(parts: string[]): number {
  const hex = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16);
}

function permuteStructures(seed: number): UkLocalIntroductionStructure[] {
  const items = [...UK_LOCAL_INTRODUCTION_STRUCTURES];
  const rand = mulberry32(seed);
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const current = items[i]!;
    items[i] = items[j]!;
    items[j] = current;
  }
  return items;
}

export function assignUkLocalIntroductionStructures(opts: {
  slug: string;
  serviceId: string;
  areaSlugs: string[];
}): Map<string, UkLocalIntroductionStructure> {
  const unique = [...new Set(opts.areaSlugs.map((slug) => String(slug || "").trim()).filter(Boolean))];
  const sorted = [...unique].sort((a, b) => a.localeCompare(b));
  const permutation = permuteStructures(seedFromParts([opts.slug, opts.serviceId, sorted.join(",")]));
  const assigned = new Map<string, UkLocalIntroductionStructure>();
  sorted.forEach((areaSlug, index) => {
    assigned.set(areaSlug, permutation[index % permutation.length]!);
  });
  return assigned;
}

export function ukLocalIntroductionAssignmentPath(slug: string, serviceId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    ASSIGNMENT_DIRNAME,
    slug,
    serviceId,
    UK_LOCAL_INTRODUCTION_STYLE_CONTRACT_VERSION,
    "assignments.json",
  );
}

export function persistUkLocalIntroductionAssignments(opts: {
  slug: string;
  serviceId: string;
  areaSlugs: string[];
}): Record<string, UkLocalIntroductionStructureId> {
  const assigned = assignUkLocalIntroductionStructures(opts);
  const record: Record<string, UkLocalIntroductionStructureId> = {};
  for (const [areaSlug, structure] of assigned) record[areaSlug] = structure.id;
  const file = ukLocalIntroductionAssignmentPath(opts.slug, opts.serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        kind: UK_LOCAL_INTRODUCTION_STYLE_CONTRACT_ID,
        version: UK_LOCAL_INTRODUCTION_STYLE_CONTRACT_VERSION,
        slug: opts.slug,
        serviceId: opts.serviceId,
        assignedAt: new Date().toISOString(),
        assignments: record,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return record;
}

export function loadUkLocalIntroductionAssignment(
  slug: string,
  serviceId: string,
  areaSlug: string,
  areaSlugs: string[],
): UkLocalIntroductionStructure {
  const file = ukLocalIntroductionAssignmentPath(slug, serviceId);
  if (fs.existsSync(file)) {
    try {
      const saved = JSON.parse(fs.readFileSync(file, "utf8")) as {
        assignments?: Record<string, UkLocalIntroductionStructureId>;
      };
      const id = saved.assignments?.[areaSlug];
      const match = UK_LOCAL_INTRODUCTION_STRUCTURES.find((row) => row.id === id);
      if (match) return match;
    } catch {
      /* fall through to deterministic assignment */
    }
  }
  return assignUkLocalIntroductionStructures({ slug, serviceId, areaSlugs }).get(areaSlug) || UK_LOCAL_INTRODUCTION_STRUCTURES[0]!;
}

export const UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE =
  /\b(orient yourself|orientating pharmacy care|local orientation|familiar points around|(?:is|are)\s+listed as|listed as|(?:is|are)\s+recorded as|recorded as|named on the provider page|named on the (?:local-authority |council )?neighbourhood page|recorded healthcare setting)\b/i;

/**
 * Product Owner-approved Mickleover introduction. Tone and paragraphing only.
 * Never copy these Mickleover facts into another area’s introduction.
 */
export const APPROVED_MICKLEOVER_INTRODUCTION_DRAFT = `Mickleover is a neighbourhood ward in Derby. It has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services. Mickleover also has a public library. Mickleover Library is a community facility in Mickleover. Mickleover Community Centre is a community facility in Mickleover, and Mickleover Community Pavilion is a community facility in Mickleover.

Mickleover Meadows is a landmark in Mickleover. Homerton Vale is a landmark in Mickleover. War Memorial - Mickleover is a landmark in Mickleover. NHS general practice services in Mickleover are provided from Mickleover Medical Centre. NHS general practice services in Mickleover are also provided from Mickleover Surgery. Mickleover Medical Centre and Mickleover Surgery are the verified general practice settings named for Mickleover.

Pharmacy First is available for people in Mickleover. Brook Pharmacy Demo Derby provides Pharmacy First from its confirmed premises. People in Mickleover can use Pharmacy First when they need the selected service.`;
