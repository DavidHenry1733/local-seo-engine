/**
 * Resolve Brand Component DNA from stored selections or generic layout inference.
 */
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import {
  type BrandDnaComponentEvidence,
  type BrandDnaComponents,
} from "./pharmacyBrandDnaComponentTypes.ts";
import { getPharmaConnectBrandDnaComponentDefaults } from "./pharmacyBrandDnaComponentDefaults.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function inferBrandDnaComponentsFromBrand(brand: BrandDNA | BrandDnaV1): BrandDnaComponents {
  const defaults = getPharmaConnectBrandDnaComponentDefaults();
  const layout = brand.layout;
  const surfaces = brand.surfaces;
  const trust = brand.trustCta;

  const withTopBar = layout.headerLayout === "with-top-bar" && layout.topInfoBar;
  const headerVariant = withTopBar ? "topbar-white-navigation" : "standard-navigation";
  const topBarVariant = withTopBar ? "contact-hours-strip" : "none";
  const navigationVariant =
    layout.navigationStyle === "multi-link"
      ? "horizontal-multi-link"
      : layout.navigationStyle === "compact"
        ? "horizontal-compact"
        : "inline";

  const heroVariant =
    layout.heroLayout === "centered" ? "centred-contained" : "split-text-left-image-right";

  const footerVariant =
    layout.footerLayout === "minimal" ? "compact" : "four-column-contact";

  const trustPanelVariant =
    trust.trustItemStyle === "minimal" ? "minimal-list" : "split-image-trust";

  const imageTreatmentVariant =
    surfaces.iconStyle === "square" ? "square-contained" : "rounded-balanced";

  return {
    ...defaults,
    headerVariant,
    topBarVariant,
    navigationVariant,
    heroVariant,
    sectionFlowVariant: layout.heroLayout === "split" ? "alternating-media" : "card-led",
    mediaTextVariant: layout.heroLayout === "split" ? "split-wide-image" : "split-balanced",
    serviceCardVariant: "card-grid-three",
    trustPanelVariant,
    processVariant: "numbered-cards",
    faqVariant: "stacked-cards",
    ctaVariant: "split-image-phone",
    mapContactVariant: "split-map-details",
    footerVariant,
    mobileHeaderVariant: "stacked-nav",
    imageTreatmentVariant,
  };
}

export function resolveBrandDnaComponents(brand: BrandDNA | BrandDnaV1): BrandDnaComponents {
  const stored = (brand as BrandDNA & BrandDnaV1).components;
  const inferred = inferBrandDnaComponentsFromBrand(brand);
  if (!stored) return inferred;
  return { ...inferred, ...stored };
}

export function resolveBrandDnaComponentEvidence(
  brand: BrandDNA | BrandDnaV1,
): BrandDnaComponentEvidence {
  return ((brand as BrandDNA & BrandDnaV1).componentEvidence || {}) as BrandDnaComponentEvidence;
}

import type { BrandDnaComponents } from "./pharmacyBrandDnaComponentTypes.ts";
import { getPharmaConnectComponentDnaDefaults } from "./pharmacyComponentDnaDefaults.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";

export function brandComponentBodyAttributes(components: BrandDnaComponents): string {
  const dna = getPharmaConnectComponentDnaDefaults();
  dna.variants = components;
  return componentDnaBodyAttributes(dna);
}

/** Map website-import evidence keys to component selections (persistence helper). */
export function resolveComponentsFromWebsiteEvidence(
  slug: string,
  evidence: Record<string, { value?: unknown; confidence?: number; extractionMethod?: string; source?: string }>,
  brand: BrandDnaV1,
): { components: BrandDnaComponents; componentEvidence: BrandDnaComponentEvidence } {
  const inferred = inferBrandDnaComponentsFromBrand(brand);
  const entry = (
    key: keyof BrandDnaComponents,
    value: string,
    evidenceKey: string,
    confidence = 75,
  ): BrandDnaComponentEvidence => ({
    [key]: {
      value,
      source: "website-import",
      confidence,
      evidenceKey,
      extractionMethod: evidence[evidenceKey]?.extractionMethod,
    },
  });

  const components: BrandDnaComponents = {
    ...inferred,
    headerVariant:
      brand.layout.headerLayout === "with-top-bar" ? "topbar-white-navigation" : inferred.headerVariant,
    topBarVariant: brand.layout.topInfoBar ? "contact-hours-strip" : "none",
    navigationVariant:
      brand.layout.navigationStyle === "multi-link" ? "horizontal-multi-link" : inferred.navigationVariant,
    heroVariant:
      brand.layout.heroLayout === "split" ? "split-text-left-image-right" : inferred.heroVariant,
    sectionFlowVariant: "alternating-media",
    mediaTextVariant: "split-wide-image",
    serviceCardVariant: "card-grid-three",
    trustPanelVariant: "split-image-trust",
    processVariant: "numbered-cards",
    faqVariant: "stacked-cards",
    ctaVariant: "split-image-phone",
    mapContactVariant: "split-map-details",
    footerVariant: brand.layout.footerLayout === "multi-column" ? "four-column-contact" : inferred.footerVariant,
    mobileHeaderVariant: "stacked-nav",
    imageTreatmentVariant: "rounded-balanced",
  };

  const componentEvidence: BrandDnaComponentEvidence = {
    ...entry("headerVariant", components.headerVariant, "layout.headerLayout", evidence["layout.headerLayout"]?.confidence as number || 90),
    ...entry("topBarVariant", components.topBarVariant, "layout.headerLayout", 90),
    ...entry("heroVariant", components.heroVariant, "layout.heroLayout", evidence["layout.heroLayout"]?.confidence as number || 75),
    ...entry("navigationVariant", components.navigationVariant, "layout.navigationStyle", 85),
    ...entry("footerVariant", components.footerVariant, "layout.footerLayout", 80),
    ...entry("imageTreatmentVariant", components.imageTreatmentVariant, "surfaces.cardRadius", evidence["surfaces.cardRadius"]?.confidence as number || 80),
    ...entry("serviceCardVariant", components.serviceCardVariant, "surfaces.cardRadius", 75),
    ...entry("ctaVariant", components.ctaVariant, "navigation.ctaText", evidence["navigation.ctaText"]?.confidence as number || 85),
    ...entry("mapContactVariant", components.mapContactVariant, "layout.footerLayout", 70),
    sectionFlowVariant: {
      value: components.sectionFlowVariant,
      source: "website-import",
      confidence: evidence["layout.heroLayout"]?.confidence as number || 75,
      evidenceKey: "layout.heroLayout",
      extractionMethod: "medolia split hero + alternating sections",
    },
    mediaTextVariant: {
      value: components.mediaTextVariant,
      source: "website-import",
      confidence: 75,
      evidenceKey: "layout.heroLayout",
    },
    trustPanelVariant: {
      value: components.trustPanelVariant,
      source: "layout-inference",
      confidence: 70,
      evidenceKey: "trustCta.trustItemStyle",
    },
    processVariant: {
      value: components.processVariant,
      source: "layout-inference",
      confidence: 70,
      evidenceKey: "layout.heroLayout",
    },
    faqVariant: {
      value: components.faqVariant,
      source: "platform-default",
      confidence: 60,
    },
    mobileHeaderVariant: {
      value: components.mobileHeaderVariant,
      source: "platform-default",
      confidence: 65,
    },
  };

  void slug;
  return { components, componentEvidence };
}
