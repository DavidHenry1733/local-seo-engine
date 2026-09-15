/**
 * Required assets per service — platform catalog (not render).
 */
import fs from "node:fs";
import { BENCHMARK_MASTER_SERVICE_IDS, getServicePublishMeta } from "../pharmacyMasterPublishConfig.ts";
import { ensureImagePlatformDirectories, serviceCatalogAbs, type ImagePlatformRole } from "./pharmacyImagePlatformPaths.ts";
import type { ImagePlatformServiceCatalog } from "./pharmacyImagePlatformTypes.ts";

function defaultRoleRequirements(role: ImagePlatformRole): ImagePlatformServiceCatalog["roles"][ImagePlatformRole] {
  if (role === "hero") {
    return {
      minApprovedAssets: 2,
      minWidth: 1200,
      minHeight: 675,
      preferredOrientation: "landscape",
      preferredAspectRatio: "16:9",
      subjectHint: "Primary service hero — photographic, patient-safe, UK community pharmacy context",
    };
  }
  if (role === "trust") {
    return {
      minApprovedAssets: 1,
      minWidth: 800,
      minHeight: 600,
      preferredOrientation: "any",
      preferredAspectRatio: "4:3",
      subjectHint: "Trusted pharmacy team or professional care — photographic",
    };
  }
  if (role === "conversion") {
    return {
      minApprovedAssets: 1,
      minWidth: 800,
      minHeight: 600,
      preferredOrientation: "landscape",
      preferredAspectRatio: "16:9",
      subjectHint: "Booking, next steps, or consultation room — photographic",
    };
  }
  return {
    minApprovedAssets: 1,
    minWidth: 800,
    minHeight: 600,
    preferredOrientation: "any",
    preferredAspectRatio: "3:2",
    subjectHint: "Supporting editorial or care scene — photographic or approved illustration",
  };
}

export function buildServiceCatalog(serviceId: string): ImagePlatformServiceCatalog {
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || serviceId;
  return {
    schemaVersion: "1.0",
    serviceId,
    serviceName,
    roles: {
      hero: defaultRoleRequirements("hero"),
      support: defaultRoleRequirements("support"),
      trust: defaultRoleRequirements("trust"),
      conversion: defaultRoleRequirements("conversion"),
    },
  };
}

export function listPlatformServiceIds(): string[] {
  return [...BENCHMARK_MASTER_SERVICE_IDS];
}

export function writeAllServiceCatalogs(): string[] {
  const ids = listPlatformServiceIds();
  ensureImagePlatformDirectories(ids);
  const written: string[] = [];
  for (const id of ids) {
    const catalog = buildServiceCatalog(id);
    const p = serviceCatalogAbs(id);
    fs.writeFileSync(p, JSON.stringify(catalog, null, 2));
    written.push(p);
  }
  return written;
}
