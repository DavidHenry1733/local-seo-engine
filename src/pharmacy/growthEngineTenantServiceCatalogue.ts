/**
 * Tenant service catalogue resolver.
 *
 * NATIONAL: project commercial / digital-growth services.
 * LOCAL: existing pharmacy patient-service catalogue.
 *
 * Does not merge catalogues. Does not hard-code tenant slugs.
 */
import fs from "node:fs";

import {
  isNationalGrowthPlatform,
  resolveGrowthPlatform,
  type ResolvedGrowthPlatform,
} from "./growthPlatformResolverService.ts";
import { listLockedCommercialSupportedServices } from "./masterAdminLockedCommercialServiceCatalog.ts";
import { BENCHMARK_MASTER_SERVICE_IDS, getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export interface TenantServiceCatalogueEntry {
  serviceId: string;
  serviceName: string;
  href?: string;
}

export interface TenantServiceCatalogue {
  slug: string;
  platform: ResolvedGrowthPlatform["platform"];
  source: "project-commercial" | "pharmacy-patient-catalogue";
  services: TenantServiceCatalogueEntry[];
}

function slugifyServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function nameMatchesServiceId(name: string, serviceId: string): boolean {
  const slug = slugifyServiceName(name);
  if (slug === serviceId) return true;
  const tokens = serviceId.split("-").filter((t) => t && t !== "pharmacy");
  if (!tokens.length) return false;
  const hay = name.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

function readProjectConfig(slug: string): Record<string, unknown> | null {
  const file = getPharmacyProjectConfigPath(safePharmacySlug(slug));
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveProjectCommercialServices(project: Record<string, unknown>): TenantServiceCatalogueEntry[] {
  const names = Array.isArray(project.services)
    ? project.services.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  const moneyPages =
    project.serviceMoneyPages && typeof project.serviceMoneyPages === "object"
      ? (project.serviceMoneyPages as Record<string, unknown>)
      : {};
  const moneyIds = Object.keys(moneyPages).filter(Boolean);

  if (moneyIds.length) {
    return moneyIds.map((serviceId) => {
      const matchedName = names.find((name) => nameMatchesServiceId(name, serviceId));
      const href = String(moneyPages[serviceId] || "").trim();
      return {
        serviceId,
        serviceName: matchedName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        href: href || undefined,
      };
    });
  }

  return names.map((name) => ({
    serviceId: slugifyServiceName(name),
    serviceName: name,
  }));
}

function resolveLocalPharmacyServices(): TenantServiceCatalogueEntry[] {
  const locked = listLockedCommercialSupportedServices();
  if (locked.length) return locked;
  return BENCHMARK_MASTER_SERVICE_IDS.map((serviceId) => ({
    serviceId,
    serviceName: getServicePublishMeta(serviceId)?.serviceName || serviceId,
  }));
}

export function resolveTenantServiceCatalogue(slug: string): TenantServiceCatalogue {
  const platform = resolveGrowthPlatform(slug);
  if (isNationalGrowthPlatform(slug)) {
    const project = readProjectConfig(slug);
    return {
      slug: safePharmacySlug(slug),
      platform: platform.platform,
      source: "project-commercial",
      services: project ? resolveProjectCommercialServices(project) : [],
    };
  }
  return {
    slug: safePharmacySlug(slug),
    platform: platform.platform,
    source: "pharmacy-patient-catalogue",
    services: resolveLocalPharmacyServices(),
  };
}

export function tenantServiceIds(slug: string): string[] {
  return resolveTenantServiceCatalogue(slug).services.map((s) => s.serviceId);
}

export function tenantServiceNames(slug: string): string[] {
  return resolveTenantServiceCatalogue(slug).services.map((s) => s.serviceName);
}
