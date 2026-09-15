/**
 * Normalize stored local evidence packs through the current geographic and category resolvers.
 * Uses only already stored Google Places results. Does not call any provider.
 */
import fs from "node:fs";
import path from "node:path";
import {
  attributableEntities,
  attributeEntityToArea,
  buildEvidencePackFromAttributedEntities,
  classifyRequestedEvidenceCategory,
  emptyEvidencePack,
  entityIdentityKey,
  isRecordedPharmacyRelationship,
  loadPharmacyLocalEvidencePack,
  localEvidencePackDirectory,
  localEvidencePackPath,
  planPharmacyLocalEvidenceRequest,
  writePharmacyLocalEvidencePack,
  type LocalEvidenceEntity,
  type PharmacyLocalEvidencePackV3,
  type RejectedLocalEvidenceEntity,
  type SupportedLocalEvidenceCategory,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  inferEvidenceCategoryFromTypes,
  resolveGeographicEvidenceContext,
} from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export const PHARMACY_LOCAL_EVIDENCE_NORMALISATION_FUNCTION = "normalizeStoredPharmacyLocalEvidencePacks";

export interface EvidenceNormalisationMutation {
  area: string;
  areaSlug: string;
  retained: Array<{ name: string; category: SupportedLocalEvidenceCategory }>;
  reclassified: Array<{ name: string; from: string; to: SupportedLocalEvidenceCategory; reason: string }>;
  removed: Array<{ name: string; from: string; reason: string }>;
}

export interface EvidenceNormalisationResult {
  slug: string;
  processedAreas: string[];
  packsChanged: string[];
  packsUnchanged: string[];
  indexChanged: boolean;
  mutations: EvidenceNormalisationMutation[];
  filesWritten: string[];
}

function relationshipRank(relationship: LocalEvidenceEntity["relationship"]): number {
  if (relationship === "name-in-address") return 4;
  if (relationship === "name-in-entity") return 3;
  if (relationship === "verified-locality-component") return 2;
  return 1;
}

function asRejected(entity: LocalEvidenceEntity, reason: string): RejectedLocalEvidenceEntity {
  return {
    name: entity.name,
    address: entity.address,
    category: entity.category,
    types: entity.types,
    location: entity.location,
    placeId: entity.placeId,
    rejectionReason: reason,
  };
}

function serializePack(pack: PharmacyLocalEvidencePackV3): string {
  return JSON.stringify(pack, null, 2);
}

function writeIndex(
  slug: string,
  packs: Array<{ area: string; areaSlug: string; evidenceLimited: boolean; attributableCount: number }>,
  generatedAt: string,
  workspaceRoot: string,
): { file: string; changed: boolean } {
  const file = path.join(localEvidencePackDirectory(slug, workspaceRoot), "_index.json");
  const next = {
    slug,
    version: "v3",
    generatedAt,
    pageCount: packs.length,
    provider: "googlePlaces",
    packs,
  };
  const serialized = JSON.stringify(next, null, 2);
  const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (previous === serialized) return { file, changed: false };
  fs.writeFileSync(file, serialized);
  return { file, changed: true };
}

export function normalizeAcceptedEvidenceEntity(
  entity: LocalEvidenceEntity,
  ctx: Parameters<typeof attributeEntityToArea>[1],
):
  | { action: "keep"; entity: LocalEvidenceEntity; categoryReason: string }
  | { action: "reclassify"; entity: LocalEvidenceEntity; from: SupportedLocalEvidenceCategory; to: SupportedLocalEvidenceCategory; categoryReason: string }
  | { action: "reject"; entity: LocalEvidenceEntity; rejectionReason: string } {
  const geo = attributeEntityToArea(entity, ctx);
  if (!geo.ok) {
    return { action: "reject", entity, rejectionReason: geo.rejectionReason };
  }
  const stored = entity.category;
  const classified = classifyRequestedEvidenceCategory(stored, entity.types || [], entity.name);
  const nextEntity: LocalEvidenceEntity = {
    ...entity,
    relationship: geo.relationship,
    areaName: ctx.areaName,
  };
  if (classified.ok) {
    return { action: "keep", entity: nextEntity, categoryReason: classified.reason };
  }
  const inferred = classified.actualCategory || inferEvidenceCategoryFromTypes(entity.types || [], entity.name);
  if (inferred && inferred !== stored) {
    const moved = classifyRequestedEvidenceCategory(inferred, entity.types || [], entity.name);
    if (moved.ok) {
      return {
        action: "reclassify",
        entity: { ...nextEntity, category: inferred },
        from: stored,
        to: inferred,
        categoryReason: `reclassified-from-${stored}:${moved.reason}`,
      };
    }
  }
  return { action: "reject", entity, rejectionReason: classified.rejectionReason };
}

/**
 * Revalidate stored packs with the current geographic and category resolvers.
 * Does not call Google Places or any other external provider.
 */
export function normalizeStoredPharmacyLocalEvidencePacks(
  slug: string,
  workspaceRoot = PHARMACY_WORKSPACE_ROOT,
): EvidenceNormalisationResult {
  const plan = planPharmacyLocalEvidenceRequest(slug);
  const siblingNames = plan.areas.map((area) => area.areaName);
  const perArea: Array<{
    areaName: string;
    areaSlug: string;
    original: PharmacyLocalEvidencePackV3 | null;
    kept: LocalEvidenceEntity[];
    rejected: RejectedLocalEvidenceEntity[];
    mutation: EvidenceNormalisationMutation;
  }> = [];

  for (const area of plan.areas) {
    const raw = loadPharmacyLocalEvidencePack(slug, area.areaSlug, workspaceRoot);
    const original = raw && typeof raw === "object" ? (raw as PharmacyLocalEvidencePackV3) : null;
    const ctx = resolveGeographicEvidenceContext({
      slug,
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      siblingAreaNames: siblingNames,
      pharmacyCoordinates: plan.pharmacyCoordinates || original?.pharmacyCoordinates || null,
    });
    const mutation: EvidenceNormalisationMutation = {
      area: area.areaName,
      areaSlug: area.areaSlug,
      retained: [],
      reclassified: [],
      removed: [],
    };
    const kept: LocalEvidenceEntity[] = [];
    const rejected: RejectedLocalEvidenceEntity[] = original?.rejected ? [...original.rejected] : [];
    if (original) {
      for (const entity of attributableEntities(original)) {
        const result = normalizeAcceptedEvidenceEntity(entity, ctx);
        if (result.action === "reject") {
          rejected.push(asRejected(entity, result.rejectionReason));
          mutation.removed.push({ name: entity.name, from: entity.category, reason: result.rejectionReason });
          continue;
        }
        if (result.action === "reclassify") {
          mutation.reclassified.push({
            name: entity.name,
            from: result.from,
            to: result.to,
            reason: result.categoryReason,
          });
        }
        kept.push(result.entity);
        mutation.retained.push({ name: result.entity.name, category: result.entity.category });
      }
    }
    perArea.push({
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      original,
      kept,
      rejected,
      mutation,
    });
  }

  const claimed = new Map<string, { areaSlug: string; rank: number }>();
  for (const row of perArea) {
    const nextKept: LocalEvidenceEntity[] = [];
    for (const entity of row.kept) {
      const key = entityIdentityKey(entity);
      const rank = relationshipRank(entity.relationship);
      const existing = claimed.get(key);
      if (!existing) {
        claimed.set(key, { areaSlug: row.areaSlug, rank });
        nextKept.push(entity);
        continue;
      }
      if (rank > existing.rank) {
        const loser = perArea.find((candidate) => candidate.areaSlug === existing.areaSlug);
        if (loser) {
          const stolen = loser.kept.find((item) => entityIdentityKey(item) === key);
          loser.kept = loser.kept.filter((item) => entityIdentityKey(item) !== key);
          loser.mutation.retained = loser.mutation.retained.filter((item) => item.name !== stolen?.name);
          if (stolen) {
            loser.rejected.push(asRejected(stolen, "exclusive-to-other-selected-area"));
            loser.mutation.removed.push({
              name: stolen.name,
              from: stolen.category,
              reason: "exclusive-to-other-selected-area",
            });
          }
        }
        claimed.set(key, { areaSlug: row.areaSlug, rank });
        nextKept.push(entity);
        continue;
      }
      row.rejected.push(asRejected(entity, "exclusive-to-other-selected-area"));
      row.mutation.removed.push({
        name: entity.name,
        from: entity.category,
        reason: "exclusive-to-other-selected-area",
      });
      row.mutation.retained = row.mutation.retained.filter((item) => item.name !== entity.name);
    }
    row.kept = nextKept;
  }

  const packsChanged: string[] = [];
  const packsUnchanged: string[] = [];
  const filesWritten: string[] = [];
  const summaries: Array<{ area: string; areaSlug: string; evidenceLimited: boolean; attributableCount: number }> = [];
  let latestGeneratedAt = "";

  for (const row of perArea) {
    const coords = row.original?.pharmacyCoordinates || plan.pharmacyCoordinates;
    if (!coords) {
      packsUnchanged.push(row.areaName);
      continue;
    }
    const generatedAt = row.original?.generatedAt || new Date().toISOString();
    if (generatedAt > latestGeneratedAt) latestGeneratedAt = generatedAt;
    const relationship = isRecordedPharmacyRelationship(row.original?.pharmacyRelationship, row.areaSlug)
      ? row.original?.pharmacyRelationship
      : null;
    const next =
      row.kept.length || relationship
        ? buildEvidencePackFromAttributedEntities({
            slug,
            area: row.areaName,
            areaSlug: row.areaSlug,
            pharmacyCoordinates: coords,
            generatedAt,
            sourceStatus: row.original?.sourceStatus || "google-places-live",
            entities: row.kept,
            rejected: row.rejected,
            pharmacyRelationship: relationship,
          })
        : emptyEvidencePack({
            slug,
            area: row.areaName,
            areaSlug: row.areaSlug,
            pharmacyCoordinates: coords,
            generatedAt,
            sourceStatus: row.original?.sourceStatus || "google-places-live",
            rejected: row.rejected,
          });
    summaries.push({
      area: next.area,
      areaSlug: next.areaSlug,
      evidenceLimited: next.evidenceLimited,
      attributableCount: next.qualitySummary.attributableCount,
    });
    const serialized = serializePack(next);
    const file = localEvidencePackPath(slug, row.areaSlug, workspaceRoot);
    const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (previous === serialized) {
      packsUnchanged.push(row.areaName);
      continue;
    }
    writePharmacyLocalEvidencePack(next, workspaceRoot);
    packsChanged.push(row.areaName);
    filesWritten.push(file);
  }

  const index = writeIndex(
    slug,
    summaries,
    latestGeneratedAt || new Date().toISOString(),
    workspaceRoot,
  );
  if (index.changed) filesWritten.push(index.file);

  return {
    slug,
    processedAreas: plan.areas.map((area) => area.areaName),
    packsChanged,
    packsUnchanged,
    indexChanged: index.changed,
    mutations: perArea.map((row) => row.mutation),
    filesWritten,
  };
}
