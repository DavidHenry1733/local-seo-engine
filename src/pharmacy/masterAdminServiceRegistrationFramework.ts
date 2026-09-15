/**
 * CPR-SERVICE-REGISTRATION-01 — canonical Service Registration Framework.
 * RC1-locked shared registration definition for pharmacy service onboarding.
 * Does not generate services or alter campaign/workflow engines.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  loadLockedCommercialServiceCatalogue,
  type LockedCommercialServiceEntry,
} from "./masterAdminLockedCommercialServiceCatalog.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { isBenchmarkVisualService } from "./pharmacyGenerationIntegrityService.ts";
import { loadServiceVariantPack } from "./pharmacyServiceVariantLibrary.ts";
import { VISUAL_EXPERIENCE_SERVICE_CONFIG } from "./pharmacyVisualExperienceConfig.ts";
import { serviceCatalogAbs } from "./imagePlatform/pharmacyImagePlatformPaths.ts";

/** Canonical registration checklist — order is the required onboarding order. */
export const SERVICE_REGISTRATION_REQUIREMENTS = [
  "Commercial registration",
  "Service metadata",
  "Evidence schema",
  "Master content registration",
  "Visual Experience registration",
  "Generation registration",
  "Locality support",
  "FAQ bank",
  "CTA bank",
  "Image compatibility",
  "Readiness validation",
] as const;

export type ServiceRegistrationRequirement = (typeof SERVICE_REGISTRATION_REQUIREMENTS)[number];

export type ServiceRegistrationStatus = "Ready" | "Setup Required";

export interface ServiceRegistrationEvaluation {
  serviceId: string;
  serviceName: string;
  status: ServiceRegistrationStatus;
  generationReady: boolean;
  selectable: boolean;
  missingRegistrations: ServiceRegistrationRequirement[];
  registrations: Record<ServiceRegistrationRequirement, boolean>;
}

function libraryManifestExists(): boolean {
  return fs.existsSync(
    path.join(WORKSPACE_ROOT, "assets/pharmacy-image-platform/library-manifest.json"),
  );
}

function hasImageCompatibility(serviceId: string, catalogueImagePath: string): boolean {
  const catalogPath = catalogueImagePath
    ? path.join(WORKSPACE_ROOT, catalogueImagePath)
    : serviceCatalogAbs(serviceId);
  if (!fs.existsSync(catalogPath) || !libraryManifestExists()) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as {
      roles?: Record<string, unknown>;
      serviceId?: string;
    };
    if (raw.serviceId && raw.serviceId !== serviceId) return false;
    const roles = raw.roles || {};
    return Boolean(roles.hero || roles.support || roles.trust || roles.conversion);
  } catch {
    return false;
  }
}

function evaluateRegistrations(
  entry: LockedCommercialServiceEntry,
): Record<ServiceRegistrationRequirement, boolean> {
  const serviceId = entry.serviceId;
  const meta = getServicePublishMeta(serviceId);
  const masterPath = meta?.masterFile
    ? path.join(WORKSPACE_ROOT, "docs/pharmacy-master-library", meta.masterFile)
    : "";
  const pack = loadServiceVariantPack(serviceId);
  const visualRegistered =
    isBenchmarkVisualService(serviceId) &&
    Boolean(VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId as keyof typeof VISUAL_EXPERIENCE_SERVICE_CONFIG]);

  const commercial = entry.locked === true;
  const serviceMetadata = Boolean(meta?.serviceId && meta.serviceName && meta.urlPath);
  const evidenceSchema = Boolean(meta?.serviceId && meta.serviceName);
  const masterContent = Boolean(masterPath && fs.existsSync(masterPath));
  const visualExperience = visualRegistered;
  const generation = Boolean(meta?.masterFile && meta.urlPath && meta.ctaHeading);
  const locality = Boolean(pack && pack.serviceId === serviceId);
  const faqBank = Boolean(pack && pack.serviceId === serviceId && pack.faqs?.length);
  const ctaBank = Boolean(pack && pack.serviceId === serviceId && pack.cta?.length && pack.intro?.length);
  const imageCompatibility = hasImageCompatibility(serviceId, entry.imagePlatformCatalog);

  const priorComplete =
    commercial &&
    serviceMetadata &&
    evidenceSchema &&
    masterContent &&
    visualExperience &&
    generation &&
    locality &&
    faqBank &&
    ctaBank &&
    imageCompatibility;

  return {
    "Commercial registration": commercial,
    "Service metadata": serviceMetadata,
    "Evidence schema": evidenceSchema,
    "Master content registration": masterContent,
    "Visual Experience registration": visualExperience,
    "Generation registration": generation,
    "Locality support": locality,
    "FAQ bank": faqBank,
    "CTA bank": ctaBank,
    "Image compatibility": imageCompatibility,
    "Readiness validation": priorComplete,
  };
}

/**
 * Evaluate a locked commercial service against the canonical registration checklist.
 * Ready only when every required registration is complete.
 */
export function evaluateServiceRegistration(serviceId: string): ServiceRegistrationEvaluation | null {
  const catalogue = loadLockedCommercialServiceCatalogue();
  const entry = catalogue?.services.find((s) => s.serviceId === serviceId && s.locked);
  if (!entry) return null;

  const registrations = evaluateRegistrations(entry);
  const missingRegistrations = SERVICE_REGISTRATION_REQUIREMENTS.filter((r) => !registrations[r]);
  const generationReady = missingRegistrations.length === 0;
  const meta = getServicePublishMeta(serviceId);

  return {
    serviceId,
    serviceName: entry.serviceName || meta?.serviceName || serviceId,
    status: generationReady ? "Ready" : "Setup Required",
    generationReady,
    selectable: generationReady,
    missingRegistrations: [...missingRegistrations],
    registrations,
  };
}

export function listLockedCommercialServiceRegistrations(): ServiceRegistrationEvaluation[] {
  const catalogue = loadLockedCommercialServiceCatalogue();
  if (!catalogue) return [];
  return catalogue.services
    .filter((s) => s.locked)
    .map((s) => evaluateServiceRegistration(s.serviceId))
    .filter((r): r is ServiceRegistrationEvaluation => Boolean(r));
}

export function isServiceRegistrationComplete(serviceId: string): boolean {
  return evaluateServiceRegistration(serviceId)?.generationReady === true;
}
