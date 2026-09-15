/**
 * NI-03A — Generic national intelligence subject identity.
 * Derives slug, domain, platform, market, and services from project config.
 * Does not infer NATIONAL from keywords or office address.
 * growthPlatform remains authoritative.
 */
import fs from "node:fs";

import { resolveGrowthPlatform, type GrowthPlatform } from "./growthPlatformResolverService.ts";
import { resolvePrimaryMarket } from "./masterAdminMarketScopeService.ts";
import { resolveTenantServiceCatalogue, type TenantServiceCatalogueEntry } from "./growthEngineTenantServiceCatalogue.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export interface NationalIntelligenceSubject {
  slug: string;
  businessName: string;
  subjectDomain: string;
  growthPlatform: GrowthPlatform;
  platformSource: string;
  primaryMarket: string;
  country: string;
  languageCode: string;
  commercialServices: TenantServiceCatalogueEntry[];
  eligibleForNationalIntelligence: boolean;
  identitySource: "PROJECT_CONFIG" | "FALLBACK";
}

export function hostFromConfiguredDomain(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

export function subjectDomainFromProjectRecord(project: Record<string, unknown>): string {
  return hostFromConfiguredDomain(project.domain || project.website || project.subjectDomain);
}

function readProjectRecord(slug: string): Record<string, unknown> | null {
  const file = getPharmacyProjectConfigPath(safePharmacySlug(slug));
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function resolveNationalIntelligenceSubject(slug: string): NationalIntelligenceSubject {
  const safe = safePharmacySlug(slug);
  const platform = resolveGrowthPlatform(slug);
  const project = readProjectRecord(safe);
  const catalogue = resolveTenantServiceCatalogue(safe);
  const primaryMarket = resolvePrimaryMarket(safe) || String(project?.primaryLocation || "United Kingdom");
  const country = String(project?.country || project?.primaryLocation || "United Kingdom");
  const languageCode = String(project?.languageCode || "en");

  if (!project) {
    return {
      slug: safe,
      businessName: safe,
      subjectDomain: "",
      growthPlatform: platform.platform,
      platformSource: platform.source,
      primaryMarket,
      country,
      languageCode,
      commercialServices: [],
      eligibleForNationalIntelligence: false,
      identitySource: "FALLBACK",
    };
  }

  return {
    slug: safe,
    businessName: String(project.businessName || project.legalName || safe),
    subjectDomain: subjectDomainFromProjectRecord(project),
    growthPlatform: platform.platform,
    platformSource: platform.source,
    primaryMarket,
    country,
    languageCode,
    commercialServices: platform.platform === "national" ? catalogue.services : [],
    eligibleForNationalIntelligence: platform.platform === "national" && Boolean(subjectDomainFromProjectRecord(project)),
    identitySource: "PROJECT_CONFIG",
  };
}
