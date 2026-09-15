/**
 * CPR-02A — locked commercial supported services verified from explicit catalogue config.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { loadServiceExpertiseProfile } from "./pharmacyServiceExpertiseService.ts";

export const LOCKED_COMMERCIAL_CATALOGUE_PATH = path.join(
  WORKSPACE_ROOT,
  "config/pharmacy/locked-commercial-service-catalogue.json",
);

export interface LockedCommercialServiceEntry {
  serviceId: string;
  serviceName: string;
  locked: boolean;
  approvalStatus: string;
  knowledgePackSources: string[];
  imagePlatformCatalog: string;
  masterFile: string;
}

export interface LockedCommercialServiceCatalogue {
  version: number;
  purpose: string;
  approvalDocumentation: string;
  publishConfigSource: string;
  lockedCommercialSupportedServiceCount: number;
  services: LockedCommercialServiceEntry[];
}

export interface LockedCommercialServiceVerification {
  serviceId: string;
  serviceName: string;
  approvalStatus: string;
  locked: boolean;
  knowledgePackAvailable: boolean;
  servicePageGeneratorSupport: boolean;
  imagePlatformSupport: boolean;
  schemaSupport: boolean;
}

export const LOCKED_COMMERCIAL_SUPPORTED_SERVICE_COUNT = 7 as const;

function readCatalogueFile(): LockedCommercialServiceCatalogue | null {
  if (!fs.existsSync(LOCKED_COMMERCIAL_CATALOGUE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LOCKED_COMMERCIAL_CATALOGUE_PATH, "utf8")) as LockedCommercialServiceCatalogue;
  } catch {
    return null;
  }
}

function knowledgePackAvailable(entry: LockedCommercialServiceEntry): boolean {
  if (loadServiceExpertiseProfile(entry.serviceId)) return true;
  for (const rel of entry.knowledgePackSources || []) {
    if (fs.existsSync(path.join(WORKSPACE_ROOT, rel))) return true;
  }
  return false;
}

export function loadLockedCommercialServiceCatalogue(): LockedCommercialServiceCatalogue | null {
  return readCatalogueFile();
}

export function verifyLockedCommercialService(entry: LockedCommercialServiceEntry): LockedCommercialServiceVerification {
  const meta = getServicePublishMeta(entry.serviceId);
  const imagePath = path.join(WORKSPACE_ROOT, entry.imagePlatformCatalog);
  return {
    serviceId: entry.serviceId,
    serviceName: entry.serviceName || meta?.serviceName || entry.serviceId,
    approvalStatus: entry.approvalStatus,
    locked: entry.locked === true,
    knowledgePackAvailable: knowledgePackAvailable(entry),
    servicePageGeneratorSupport: Boolean(meta?.masterFile && meta.urlPath),
    imagePlatformSupport: fs.existsSync(imagePath),
    schemaSupport: Boolean(meta?.urlPath),
  };
}

export function resolveLockedCommercialSupportedServiceIds(): readonly string[] {
  const catalogue = readCatalogueFile();
  if (!catalogue) return [];
  return catalogue.services.filter((s) => s.locked).map((s) => s.serviceId);
}

export function listLockedCommercialSupportedServices(): Array<{ serviceId: string; serviceName: string }> {
  const catalogue = readCatalogueFile();
  if (!catalogue) return [];
  return catalogue.services
    .filter((s) => s.locked)
    .map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName || getServicePublishMeta(s.serviceId)?.serviceName || s.serviceId,
    }));
}

export function isLockedCommercialSupportedService(serviceId: string): boolean {
  return resolveLockedCommercialSupportedServiceIds().includes(serviceId);
}

export function assertLockedCommercialServiceCatalog(): {
  ok: boolean;
  count: number;
  catalogueSourceFile: string;
  services: LockedCommercialServiceVerification[];
  error?: string;
} {
  const catalogue = readCatalogueFile();
  if (!catalogue) {
    return {
      ok: false,
      count: 0,
      catalogueSourceFile: LOCKED_COMMERCIAL_CATALOGUE_PATH,
      services: [],
      error: "Locked commercial service catalogue config not found",
    };
  }

  const locked = catalogue.services.filter((s) => s.locked);
  const verifications = locked.map(verifyLockedCommercialService);
  const expected = catalogue.lockedCommercialSupportedServiceCount || LOCKED_COMMERCIAL_SUPPORTED_SERVICE_COUNT;

  if (locked.length !== expected) {
    return {
      ok: false,
      count: locked.length,
      catalogueSourceFile: LOCKED_COMMERCIAL_CATALOGUE_PATH,
      services: verifications,
      error: `Expected ${expected} locked services in catalogue config, found ${locked.length}`,
    };
  }

  const incomplete = verifications.filter(
    (v) =>
      !v.locked ||
      !v.knowledgePackAvailable ||
      !v.servicePageGeneratorSupport ||
      !v.imagePlatformSupport ||
      !v.schemaSupport,
  );
  if (incomplete.length) {
    return {
      ok: false,
      count: locked.length,
      catalogueSourceFile: LOCKED_COMMERCIAL_CATALOGUE_PATH,
      services: verifications,
      error: `Incomplete locked service support: ${incomplete.map((s) => s.serviceId).join(", ")}`,
    };
  }

  if (!fs.existsSync(path.join(WORKSPACE_ROOT, catalogue.approvalDocumentation))) {
    return {
      ok: false,
      count: locked.length,
      catalogueSourceFile: LOCKED_COMMERCIAL_CATALOGUE_PATH,
      services: verifications,
      error: `Approval documentation missing: ${catalogue.approvalDocumentation}`,
    };
  }

  return {
    ok: true,
    count: locked.length,
    catalogueSourceFile: LOCKED_COMMERCIAL_CATALOGUE_PATH,
    services: verifications,
  };
}
