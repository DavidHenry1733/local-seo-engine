/**
 * Brand DNA tenant storage — brand-dna.json + brand-dna-overrides.json per pharmacy.
 * Renderers read resolved DNA via pharmacyBrandDnaEngine (never website files at render time).
 */
import fs from "node:fs";
import path from "node:path";
import type { BrandDnaOverrides, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { BRAND_DNA_VERSION } from "./pharmacyBrandDnaTypes.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { getPharmacyProjectBrandDir } from "./pharmacyWorkspacePaths.ts";

export function getPharmacyBrandDnaPath(slug: string): string {
  return path.join(getPharmacyProjectBrandDir(slug), "brand-dna.json");
}

export function getPharmacyBrandDnaOverridesPath(slug: string): string {
  return path.join(getPharmacyProjectBrandDir(slug), "brand-dna-overrides.json");
}

export function loadBrandDnaV1File(slug: string): BrandDnaV1 | null {
  const file = getPharmacyBrandDnaPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as BrandDnaV1;
    if (raw?.version !== BRAND_DNA_VERSION) return null;
    return raw;
  } catch {
    return null;
  }
}

export function loadBrandDnaOverrides(slug: string): BrandDnaOverrides | null {
  const file = getPharmacyBrandDnaOverridesPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as BrandDnaOverrides;
  } catch {
    return null;
  }
}

/** Raw frozen website-import file — null when tenant has not frozen Brand DNA yet. */
export function loadBrandDna(slug: string): BrandDnaV1 | null {
  return loadBrandDnaV1File(slug);
}

export function loadResolvedBrandDna(slug: string) {
  return resolveBrandDnaForRender(slug);
}

export function isBrandDnaAvailable(slug: string): boolean {
  return loadBrandDnaV1File(slug) !== null || loadBrandDnaOverrides(slug) !== null;
}

export function freezeBrandDna(slug: string, dna: BrandDnaV1): string {
  const dir = getPharmacyProjectBrandDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = getPharmacyBrandDnaPath(slug);
  fs.writeFileSync(file, JSON.stringify(dna, null, 2), "utf8");
  return file;
}

export function saveBrandDnaOverrides(slug: string, overrides: BrandDnaOverrides): string {
  const dir = getPharmacyProjectBrandDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = getPharmacyBrandDnaOverridesPath(slug);
  fs.writeFileSync(file, JSON.stringify(overrides, null, 2), "utf8");
  return file;
}

export function ensureTenantBrandDnaStorage(slug: string): { brandDnaPath: string; overridesPath: string } {
  const dir = getPharmacyProjectBrandDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  return {
    brandDnaPath: getPharmacyBrandDnaPath(slug),
    overridesPath: getPharmacyBrandDnaOverridesPath(slug),
  };
}
