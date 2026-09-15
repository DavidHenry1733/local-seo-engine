/**
 * Service search-demand artifact storage.
 * Path: data/growth-engine/{slug}-service-search-demand.json
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import {
  SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
  SERVICE_SEARCH_DEMAND_LOCATION_CODE,
  SERVICE_SEARCH_DEMAND_SCHEMA_VERSION,
  SERVICE_SEARCH_DEMAND_SOURCE,
  type ServiceSearchDemandArtifact,
} from "./serviceSearchDemandModel.ts";

export function serviceSearchDemandArtifactPath(slug: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "data/growth-engine",
    `${safePharmacySlug(slug)}-service-search-demand.json`,
  );
}

export function readServiceSearchDemandArtifact(slug: string): ServiceSearchDemandArtifact | null {
  const file = serviceSearchDemandArtifactPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ServiceSearchDemandArtifact;
  } catch {
    return null;
  }
}

export function writeServiceSearchDemandArtifact(
  artifact: ServiceSearchDemandArtifact,
): string {
  const file = serviceSearchDemandArtifactPath(artifact.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const normalised: ServiceSearchDemandArtifact = {
    schemaVersion: SERVICE_SEARCH_DEMAND_SCHEMA_VERSION,
    slug: safePharmacySlug(artifact.slug),
    source: SERVICE_SEARCH_DEMAND_SOURCE,
    generatedAt: artifact.generatedAt,
    locationCode: SERVICE_SEARCH_DEMAND_LOCATION_CODE,
    languageCode: SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
    confirmedServiceIds: [...(artifact.confirmedServiceIds || [])],
    demandByService: artifact.demandByService || {},
    requestCount: Number(artifact.requestCount || 0),
    taskIds: [...(artifact.taskIds || [])],
    providerCost:
      typeof artifact.providerCost === "number" && Number.isFinite(artifact.providerCost)
        ? artifact.providerCost
        : null,
  };
  fs.writeFileSync(file, JSON.stringify(normalised, null, 2) + "\n", "utf8");
  return file;
}

export function emptyServiceSearchDemandArtifact(
  slug: string,
  confirmedServiceIds: string[] = [],
  generatedAt = new Date().toISOString(),
): ServiceSearchDemandArtifact {
  return {
    schemaVersion: SERVICE_SEARCH_DEMAND_SCHEMA_VERSION,
    slug: safePharmacySlug(slug),
    source: SERVICE_SEARCH_DEMAND_SOURCE,
    generatedAt,
    locationCode: SERVICE_SEARCH_DEMAND_LOCATION_CODE,
    languageCode: SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
    confirmedServiceIds: [...confirmedServiceIds],
    demandByService: {},
    requestCount: 0,
    taskIds: [],
    providerCost: null,
  };
}
