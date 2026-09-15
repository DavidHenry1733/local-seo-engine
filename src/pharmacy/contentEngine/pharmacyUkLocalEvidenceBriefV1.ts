/**
 * Isolated structured evidence brief for one selected UK local-service area.
 * Never borrows facts from another area. Never invents missing information.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEditorialEvidencePack } from "./pharmacyLocalEditorialEvidenceCollectorV3.ts";
import type { EditorialFactV3 } from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import {
  loadLocalEvidencePackForGeneration,
  type LocalEvidenceEntity,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { savedVerifiedAreaReferencePoint } from "./pharmacyLocalPageGenerationReadinessV1.ts";
import { planUkLocalPageStraightLineDistance } from "./pharmacyUkLocalPageContentContractV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import type { UkLocalIntroductionStructureId } from "./pharmacyUkLocalIntroductionStyleContractV1.ts";

export const UK_LOCAL_EVIDENCE_BRIEF_ID = "pharmacy-uk-local-evidence-brief-v1";
export const UK_LOCAL_EVIDENCE_BRIEF_VERSION = "v1";
export const UK_LOCAL_EVIDENCE_BRIEF_DIRNAME = "data/pharmacy-uk-local-evidence-briefs";

export type UkLocalEvidenceBriefPlace = {
  name: string;
  category: string;
  address?: string;
  statement?: string;
  factId?: string;
};

export type UkLocalEvidenceBriefV1 = {
  kind: typeof UK_LOCAL_EVIDENCE_BRIEF_ID;
  version: typeof UK_LOCAL_EVIDENCE_BRIEF_VERSION;
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  savedAt: string;
  introductionStructureId: UkLocalIntroductionStructureId | null;
  identity: {
    verifiedName: string;
    statements: string[];
  };
  geography: {
    parentTown: string | null;
    county: string | null;
    country: string | null;
    queryPlaceLabel: string | null;
    statements: string[];
  };
  healthcare: UkLocalEvidenceBriefPlace[];
  landmarks: UkLocalEvidenceBriefPlace[];
  parks: UkLocalEvidenceBriefPlace[];
  shopping: UkLocalEvidenceBriefPlace[];
  civic: UkLocalEvidenceBriefPlace[];
  community: UkLocalEvidenceBriefPlace[];
  distance: {
    km: number | null;
    label: string | null;
    method: "haversine-straight-line" | null;
  };
  factIds: string[];
};

function areaMatches(value: string, areaName: string, areaSlug: string): boolean {
  const hay = String(value || "").trim().toLowerCase();
  const name = String(areaName || "").trim().toLowerCase();
  const slug = String(areaSlug || "").trim().toLowerCase();
  if (!hay) return false;
  if (name && hay === name) return true;
  if (slug && hay.replace(/[^a-z0-9]+/g, "-") === slug) return true;
  return false;
}

function factBelongsToArea(fact: EditorialFactV3, areaName: string, areaSlug: string): boolean {
  return areaMatches(fact.area, areaName, areaSlug) || areaMatches(fact.areaSlug, areaName, areaSlug);
}

function entityBelongsToArea(entity: LocalEvidenceEntity, areaName: string, areaSlug: string): boolean {
  if (!areaMatches(entity.areaName, areaName, areaSlug)) return false;
  const hay = `${entity.name} ${entity.address}`.toLowerCase();
  const name = areaName.trim().toLowerCase();
  return !name || hay.includes(name);
}

function uniquePlaces(rows: UkLocalEvidenceBriefPlace[]): UkLocalEvidenceBriefPlace[] {
  const seen = new Set<string>();
  const out: UkLocalEvidenceBriefPlace[] = [];
  for (const row of rows) {
    const key = `${row.category}:${row.name.trim().toLowerCase()}`;
    if (!row.name.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function placesFromFacts(facts: EditorialFactV3[], category: EditorialFactV3["category"]): UkLocalEvidenceBriefPlace[] {
  return facts
    .filter((fact) => fact.category === category && fact.validationStatus === "accepted")
    .map((fact) => ({
      name: fact.normalizedStatement,
      category: fact.category,
      statement: fact.normalizedStatement,
      factId: fact.factId,
    }));
}

function classifyCommunityPlace(entity: LocalEvidenceEntity): "landmarks" | "parks" | "shopping" | "civic" | "community" {
  const hay = `${entity.name} ${entity.types.join(" ")}`.toLowerCase();
  if (/\b(park|garden|green|meadow|reserve|recreation)\b/.test(hay)) return "parks";
  if (/\b(library|board|hall|council|ward|civic)\b/.test(hay)) return "civic";
  if (/\b(shop|retail|market|parade|shopping)\b/.test(hay)) return "shopping";
  if (/\b(landmark|church|memorial|station|mill)\b/.test(hay)) return "landmarks";
  return "community";
}

export function ukLocalEvidenceBriefPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    UK_LOCAL_EVIDENCE_BRIEF_DIRNAME,
    slug,
    serviceId,
    UK_LOCAL_EVIDENCE_BRIEF_VERSION,
    `${areaSlug}.json`,
  );
}

export function loadUkLocalEvidenceBrief(slug: string, serviceId: string, areaSlug: string): UkLocalEvidenceBriefV1 | null {
  const file = ukLocalEvidenceBriefPath(slug, serviceId, areaSlug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as UkLocalEvidenceBriefV1;
  } catch {
    return null;
  }
}

export function assembleUkLocalEvidenceBrief(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  introductionStructureId?: UkLocalIntroductionStructureId | null;
}): UkLocalEvidenceBriefV1 {
  const editorial = loadEditorialEvidencePack(opts.slug, opts.serviceId, opts.areaSlug);
  const facts = (editorial?.facts || []).filter(
    (fact) => fact.validationStatus === "accepted" && factBelongsToArea(fact, opts.areaName, opts.areaSlug),
  );
  const packResult = loadLocalEvidencePackForGeneration(opts.slug, opts.areaName, opts.areaSlug);
  const pack = packResult.ok ? packResult.pack : null;
  const healthcareEntities = (pack?.healthcare || []).filter((entity) => entityBelongsToArea(entity, opts.areaName, opts.areaSlug));
  const communityEntities = (pack?.community || []).filter((entity) => entityBelongsToArea(entity, opts.areaName, opts.areaSlug));
  const landmarkEntities = (pack?.landmarks || []).filter((entity) => entityBelongsToArea(entity, opts.areaName, opts.areaSlug));
  const savedPoint =
    savedVerifiedAreaReferencePoint(opts.slug, opts.serviceId, opts.areaName, opts.areaSlug) || null;
  const distancePlan = pack
    ? planUkLocalPageStraightLineDistance({
        slug: opts.slug,
        areaName: opts.areaName,
        pharmacyCoordinates: pack.pharmacyCoordinates,
        areaCentroid: savedPoint,
        displayAddress: "",
      })
    : { distanceKm: null as number | null };

  const classifiedCommunity = communityEntities.map((entity) => ({
    bucket: classifyCommunityPlace(entity),
    place: {
      name: entity.name,
      category: entity.category,
      address: entity.address,
    } satisfies UkLocalEvidenceBriefPlace,
  }));

  const geo = editorial?.geographicContext;
  const identityFacts = facts.filter((fact) => fact.category === "area-identity");
  const geographyFacts = facts.filter(
    (fact) =>
      fact.category === "area-identity" &&
      /\b(borough|county|district|ward|village|suburb|town|parish|sits within|is in)\b/i.test(fact.normalizedStatement),
  );

  const brief: UkLocalEvidenceBriefV1 = {
    kind: UK_LOCAL_EVIDENCE_BRIEF_ID,
    version: UK_LOCAL_EVIDENCE_BRIEF_VERSION,
    slug: opts.slug,
    serviceId: opts.serviceId,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    savedAt: new Date().toISOString(),
    introductionStructureId: opts.introductionStructureId || null,
    identity: {
      verifiedName: opts.areaName,
      statements: identityFacts.map((fact) => fact.normalizedStatement),
    },
    geography: {
      parentTown: geo?.parentTown || null,
      county: geo?.county || null,
      country: geo?.country || null,
      queryPlaceLabel: geo?.queryPlaceLabel || null,
      statements: geographyFacts.map((fact) => fact.normalizedStatement),
    },
    healthcare: uniquePlaces([
      ...healthcareEntities.map((entity) => ({
        name: entity.name.replace(/\.$/, ""),
        category: "healthcare",
        address: entity.address,
      })),
      ...placesFromFacts(facts, "healthcare"),
    ]),
    landmarks: uniquePlaces([
      ...landmarkEntities.map((entity) => ({
        name: entity.name,
        category: "landmarks",
        address: entity.address,
      })),
      ...classifiedCommunity.filter((row) => row.bucket === "landmarks").map((row) => row.place),
      ...placesFromFacts(facts, "heritage"),
    ]),
    parks: uniquePlaces(classifiedCommunity.filter((row) => row.bucket === "parks").map((row) => row.place)),
    shopping: uniquePlaces(classifiedCommunity.filter((row) => row.bucket === "shopping").map((row) => row.place)),
    civic: uniquePlaces(classifiedCommunity.filter((row) => row.bucket === "civic").map((row) => row.place)),
    community: uniquePlaces([
      ...classifiedCommunity.filter((row) => row.bucket === "community").map((row) => row.place),
      ...placesFromFacts(facts, "community"),
    ]),
    distance: {
      km: distancePlan.distanceKm ?? pack?.pharmacyRelationship?.distanceKm ?? null,
      label:
        distancePlan.distanceKm != null && Number.isFinite(distancePlan.distanceKm)
          ? `approximately ${Number(distancePlan.distanceKm).toFixed(1)} km straight-line`
          : null,
      method: distancePlan.distanceKm != null ? "haversine-straight-line" : null,
    },
    factIds: facts.map((fact) => fact.factId),
  };
  return brief;
}

export function saveUkLocalEvidenceBrief(brief: UkLocalEvidenceBriefV1): string {
  const file = ukLocalEvidenceBriefPath(brief.slug, brief.serviceId, brief.areaSlug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  return file;
}
