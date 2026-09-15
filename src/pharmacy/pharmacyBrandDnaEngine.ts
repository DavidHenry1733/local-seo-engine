/**
 * Brand DNA Engine — reusable platform layer for tenant visual identity.
 *
 * Source priority (highest wins per field):
 * 1. PharmaConnect platform defaults
 * 2. Website import (frozen brand-dna.json)
 * 3. Customer overrides (brand-dna-overrides.json)
 *
 * Renderers must call resolveBrandDnaForRender() only.
 * They must never scan websites or brand-profile.json at render time.
 */
import type { BrandDNA, BrandDnaOverrides, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { BRAND_DNA_VERSION } from "./pharmacyBrandDnaTypes.ts";
import { getPharmaConnectBrandDnaDefaults } from "./pharmacyBrandDnaDefaults.ts";
import {
  brandDnaV1ToEngineModel,
  deepMergeBrandDna,
  syncBrandDnaLegacyBridges,
} from "./pharmacyBrandDnaNormalize.ts";
import {
  getPharmacyBrandDnaOverridesPath,
  getPharmacyBrandDnaPath,
  loadBrandDnaOverrides,
  loadBrandDnaV1File,
} from "./pharmacyBrandDnaStore.ts";

export interface BrandDnaResolution {
  dna: BrandDNA;
  provenance: BrandDNA["provenance"];
}

function finalizeBrandDna(
  slug: string,
  merged: BrandDNA,
  flags: Pick<BrandDNA["provenance"], "websiteImport" | "customerOverrides">,
): BrandDNA {
  const synced = syncBrandDnaLegacyBridges({ ...merged, slug });
  return {
    ...synced,
    provenance: {
      websiteImport: flags.websiteImport,
      customerOverrides: flags.customerOverrides,
      platformDefaults: true,
      resolvedAt: new Date().toISOString(),
    },
  };
}

/**
 * Resolve Brand DNA for rendering.
 * Reads tenant storage only — never website import files or live URLs.
 */
export function resolveBrandDnaForRender(slug: string): BrandDNA {
  return resolveBrandDna(slug).dna;
}

/**
 * Resolve Brand DNA with explicit layer provenance.
 */
export function resolveBrandDna(slug: string): BrandDnaResolution {
  const defaults = getPharmaConnectBrandDnaDefaults(slug);
  const overrides = loadBrandDnaOverrides(slug);
  const imported = loadBrandDnaV1File(slug);

  let merged = defaults;
  let customerOverrides = false;
  let websiteImport = false;

  if (imported?.version === BRAND_DNA_VERSION) {
    merged = deepMergeBrandDna(merged, brandDnaV1ToEngineModel(imported) as unknown as Record<string, unknown>);
    websiteImport = true;
  }

  if (overrides) {
    merged = deepMergeBrandDna(merged, overrides as Record<string, unknown>);
    customerOverrides = true;
  }

  const dna = finalizeBrandDna(slug, merged, { websiteImport, customerOverrides });
  return { dna, provenance: dna.provenance };
}

/** Legacy adapter for code paths still expecting BrandDnaV1. */
export function brandDnaToV1(dna: BrandDNA): BrandDnaV1 {
  return {
    version: BRAND_DNA_VERSION,
    slug: dna.slug,
    sourceUrl: dna.sourceUrl,
    frozenAt: dna.frozenAt,
    businessName: dna.businessName,
    logoUrl: dna.logoUrl,
    faviconUrl: dna.faviconUrl,
    colours: dna.colours,
    typography: dna.typography,
    layout: dna.layout,
    surfaces: dna.surfaces,
    trustCta: dna.trustCta,
    navigationLinks: dna.navigationLinks,
    footerLinks: dna.footerLinks,
    headerCtaText: dna.headerCtaText,
    headerCtaUrl: dna.headerCtaUrl,
    topInfoBarText: dna.topInfoBarText,
    confidence: dna.confidence,
    source:
      dna.source === "customer-override" || dna.source === "platform-default"
        ? "manual"
        : dna.source,
  };
}

export function getTenantBrandDnaStoragePath(slug: string): string {
  return getPharmacyBrandDnaPath(slug);
}

export function getTenantBrandDnaOverridesStoragePath(slug: string): string {
  return getPharmacyBrandDnaOverridesPath(slug);
}

export function isBrandDnaFallbackOnly(slug: string): boolean {
  const resolution = resolveBrandDna(slug);
  return !resolution.provenance.websiteImport && !resolution.provenance.customerOverrides;
}
