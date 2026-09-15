/**
 * Aggregate stored Website Import evidence for Brand DNA extraction.
 * Reads tenant files only — never another tenant's data.
 */
import type { BrandProfile } from "../generator/brandImporter.ts";
import type { WebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { getPharmacyBrandProfilePath } from "./pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import fs from "node:fs";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export interface WebsiteImportSources {
  slug: string;
  sourceUrl: string;
  importedAt: string;
  brandProfile: BrandProfile | null;
  profile: PharmacyProfileData;
  intelligence: WebsiteIntelligenceImportV2 | null;
}

function loadBrandProfile(slug: string): BrandProfile | null {
  const file = getPharmacyBrandProfilePath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as BrandProfile;
  } catch {
    return null;
  }
}

export function loadWebsiteImportSources(slug: string): WebsiteImportSources | null {
  const resolved = resolveTenantProfileSlug(slug) || slug;
  const loaded = loadPharmacyProfile(resolved);
  if (!loaded?.data) return null;

  const profile = loaded.data as PharmacyProfileData;
  const brandProfile = loadBrandProfile(resolved);
  const snapshot = profile.websiteImportSnapshot as
    | { intelligence?: WebsiteIntelligenceImportV2; websiteUrl?: string; importedAt?: string }
    | undefined;
  const intelligence = snapshot?.intelligence ?? null;

  const sourceUrl =
    str(brandProfile?.sourceUrl) ||
    str(snapshot?.websiteUrl) ||
    str(intelligence?.identity?.websiteUrl) ||
    str(profile.website);

  if (!sourceUrl) return null;

  return {
    slug: resolved,
    sourceUrl,
    importedAt:
      str(brandProfile?.fetchedAt) ||
      str(snapshot?.importedAt) ||
      str(intelligence?.importedAt) ||
      str(profile.websiteAnalysisAt) ||
      new Date().toISOString(),
    brandProfile,
    profile,
    intelligence,
  };
}

export function websiteImportColourConfidence(sources: WebsiteImportSources): number {
  const fromBrand = sources.brandProfile?.confidence?.colours ?? 0;
  const snapshot = sources.profile.websiteImportSnapshot as { brandPrimaryColor?: string } | undefined;
  const fromSnapshot = str(snapshot?.brandPrimaryColor) ? 100 : 0;
  const fromIntel = str(sources.intelligence?.identity?.brandPrimaryColor) ? 100 : 0;
  const fromStoredBrand = str(sources.brandProfile?.primaryColour) ? 90 : 0;
  return Math.max(fromBrand, fromSnapshot, fromIntel, fromStoredBrand);
}

export function websiteImportNeedsCssSupplement(sources: WebsiteImportSources): boolean {
  return websiteImportColourConfidence(sources) < 60;
}

export function websiteImportLogoLooksLikeFavicon(url: string): boolean {
  return /favicon|icon\.(png|ico|svg)/i.test(url);
}
