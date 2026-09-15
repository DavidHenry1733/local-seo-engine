/**
 * Saved-state adapter for local-page generation readiness.
 * Rules live in the content-generation field policy. This module only loads
 * recorded facts and never invents replacement copy.
 */
import fs from "node:fs";
import path from "node:path";

import {
  assessLocalPageGenerationReadiness,
  type LocalPageGenerationReadiness,
} from "./pharmacyContentGenerationFieldPolicyV1.ts";
import {
  emptyEditorialEvidencePackForGeneration,
  type EditorialEvidencePackV3,
} from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import { loadEditorialEvidencePack } from "./pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { resolveGeographicEvidenceContext } from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import {
  attributableEntities,
  loadLocalEvidencePackForGeneration,
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  planUkLocalPageStraightLineDistance,
  resolveUkLocalPagePlacesAreaReference,
  type PlacesAreaReferenceHit,
} from "./pharmacyUkLocalPageContentContractV1.ts";
import { premisesLocalityFromCanonicalAddress } from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  isAuthorisedAiLocalPilotV3Area,
} from "./pharmacyAiLocalPageCandidatePaths.ts";
import { loadCampaignBuilderSession } from "../growthEngineCampaignBuilderService.ts";
import { loadPharmacyProfile } from "../pharmacyContentBlueprintService.ts";
import { normalizeProfileData } from "../pharmacyProfileSchema.ts";
import { resolveCanonicalPharmacyName } from "../pharmacyServicePageProfileContext.ts";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export const ADDITIONAL_LOCAL_EVIDENCE_REQUIRED = "Additional local evidence required.";

function readJson(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function evidenceRunPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-runs",
    slug,
    serviceId,
    "v1",
    `${areaSlug}.json`,
  );
}

function recordedAreaReferencePath(slug: string, areaSlug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-page-evidence-area-reference", slug, `${areaSlug}.json`);
}

function finitePoint(value: unknown): { latitude: number; longitude: number; source: string } | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as { latitude?: unknown; longitude?: unknown; source?: unknown };
  const latitude = Number(rec.latitude);
  const longitude = Number(rec.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) return null;
  return { latitude, longitude, source: String(rec.source || "places-area-reference") };
}

function packAreaCentroid(
  slug: string,
  areaSlug: string,
): { latitude: number; longitude: number; source: string } | null {
  const pack = loadPharmacyLocalEvidencePack(slug, areaSlug);
  if (!pack || typeof pack !== "object") return null;
  const entities = attributableEntities(pack as never).filter(
    (entity) => entity.location && Number.isFinite(entity.location.latitude) && Number.isFinite(entity.location.longitude),
  );
  if (!entities.length) return null;
  const latitude = entities.reduce((sum, entity) => sum + Number(entity.location!.latitude), 0) / entities.length;
  const longitude = entities.reduce((sum, entity) => sum + Number(entity.location!.longitude), 0) / entities.length;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, source: "saved-local-evidence-pack" };
}

function savedVerifiedAreaReference(slug: string, serviceId: string, areaName: string, areaSlug: string): {
  point: { latitude: number; longitude: number; source: string } | null;
  status: "recorded" | "missing" | "ambiguous";
  collectionFinished: boolean;
  verifiedGpPracticeCount: number;
} {
  const request = planPharmacyLocalEvidenceRequest(slug, serviceId);
  const geo = resolveGeographicEvidenceContext({
    slug,
    areaName,
    areaSlug,
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: request.pharmacyCoordinates,
  });
  const run = readJson(evidenceRunPath(slug, serviceId, areaSlug));
  const recorded = finitePoint(readJson(recordedAreaReferencePath(slug, areaSlug)));
  const fromRun = finitePoint(run?.areaReferencePoint);
  const hits = (run?.placesHitsByCall as Record<string, PlacesAreaReferenceHit[]> | undefined)?.["places-area-reference"];
  const resolved = resolveUkLocalPagePlacesAreaReference({
    areaName,
    county: geo.county,
    countryCode: geo.countryCode,
    siblingAreaNames: geo.siblingAreaNames,
    pharmacyCityHint: geo.parentTown,
    hits,
  });
  const resolvedPoint = resolved.ok
    ? { latitude: resolved.latitude, longitude: resolved.longitude, source: resolved.source }
    : null;
  if (resolved.ok === false && resolved.reason === "ambiguous") {
    return {
      point: null,
      status: "ambiguous",
      collectionFinished: run?.status === "completed" || run?.status === "stopped",
      verifiedGpPracticeCount: Number(run?.verifiedGpPracticeCount || 0),
    };
  }
  const point = fromRun || recorded || resolvedPoint || packAreaCentroid(slug, areaSlug);
  return {
    point,
    status: point ? "recorded" : "missing",
    collectionFinished: run?.status === "completed" || run?.status === "stopped",
    verifiedGpPracticeCount: Number(run?.verifiedGpPracticeCount || 0),
  };
}

export function savedVerifiedAreaReferencePoint(
  slug: string,
  serviceId: string,
  areaName: string,
  areaSlug: string,
): { latitude: number; longitude: number; source: string } | null {
  return savedVerifiedAreaReference(slug, serviceId, areaName, areaSlug).point;
}

export function assessSavedLocalPageGenerationReadiness(
  slug: string,
  serviceId: string,
  areaName: string,
  areaSlug: string,
): LocalPageGenerationReadiness & {
  editorial: EditorialEvidencePackV3;
  packSparse: boolean;
  collectionFinished: boolean;
} {
  const selectedNames = (loadCampaignBuilderSession(slug).targetAreaNames || [])
    .map((name) => String(name || "").trim())
    .filter(Boolean);
  const selectedAreaConfirmed = selectedNames.some((name) => slugifyArea(name) === areaSlug);
  const canonicalAreaName =
    selectedNames.find((name) => slugifyArea(name) === areaSlug) || String(areaName || "").trim();
  const request = planPharmacyLocalEvidenceRequest(slug, serviceId);
  const geo = resolveGeographicEvidenceContext({
    slug,
    areaName: canonicalAreaName,
    areaSlug,
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: request.pharmacyCoordinates,
  });
  const profile = loadPharmacyProfile(slug);
  const data = profile?.data ? normalizeProfileData(profile.data) : null;
  const pharmacyName = resolveCanonicalPharmacyName(data).value || request.pharmacyName || "";
  const address = String(data?.displayAddress || data?.customerFacingAddress || data?.fullAddress || "").trim();
  const premisesLocality = premisesLocalityFromCanonicalAddress(address);
  const packForGeneration = loadLocalEvidencePackForGeneration(
    slug,
    canonicalAreaName,
    areaSlug,
    request.pharmacyCoordinates,
  );
  const contaminatedLocalEvidence =
    packForGeneration.ok === false && packForGeneration.reasonCode === "contaminated";
  const editorial =
    loadEditorialEvidencePack(slug, serviceId, areaSlug) ||
    emptyEditorialEvidencePackForGeneration({
      slug,
      areaName: canonicalAreaName,
      areaSlug,
      parentTown: geo.parentTown,
      county: geo.county,
      country: geo.country,
      queryPlaceLabel: geo.queryPlaceLabel,
    });
  const acceptedFacts = editorial.facts.filter((fact) => fact.validationStatus === "accepted");
  const savedRef = savedVerifiedAreaReference(slug, serviceId, canonicalAreaName, areaSlug);
  const distancePlan = planUkLocalPageStraightLineDistance({
    slug,
    areaName: canonicalAreaName,
    pharmacyCoordinates: request.pharmacyCoordinates,
    areaCentroid: savedRef.point,
    pharmacyName,
  });
  const blockedAuthoritativePages = (editorial.retrievedPages || []).some(
    (page) => Number(page.status) >= 400 || /security challenge|blocked/i.test(String(page.title || page.textSample || "")),
  );
  const readiness = assessLocalPageGenerationReadiness({
    areaName: canonicalAreaName,
    selectedAreaConfirmed,
    areaIdentityAmbiguous: savedRef.status === "ambiguous",
    pharmacyName,
    premisesLocality,
    pharmacyCoordinatesPresent: Boolean(request.pharmacyCoordinates),
    areaReferenceStatus: savedRef.status,
    distanceKm: distancePlan.distanceKm,
    clinicalCopyApproved: isAuthorisedAiLocalPilotV3Area(slug, areaSlug),
    contaminatedLocalEvidence,
    editorialFactCount: acceptedFacts.length,
    hasNonDistanceEditorialFact: acceptedFacts.some((fact) => fact.category !== "pharmacy-relationship"),
    verifiedGpPracticeCount: savedRef.verifiedGpPracticeCount,
    blockedAuthoritativePages,
  });
  return {
    ...readiness,
    editorial,
    packSparse: packForGeneration.ok === true ? packForGeneration.sparse : true,
    collectionFinished: savedRef.collectionFinished,
  };
}
