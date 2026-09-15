/**
 * Brand DNA normalization — upgrade legacy v1 files to the full engine model.
 */
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { BRAND_DNA_ENGINE_VERSION } from "./pharmacyBrandDnaTypes.ts";
import { getPharmaConnectBrandDnaDefaults } from "./pharmacyBrandDnaDefaults.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepMergeBrandDna<T extends Record<string, unknown>>(base: T, patch?: Record<string, unknown>): T {
  if (!patch) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      out[key] = deepMergeBrandDna(current, value) as T[Extract<keyof T, string>];
      continue;
    }
    out[key] = value as T[Extract<keyof T, string>];
  }
  return out;
}

export function brandDnaV1ToEngineModel(v1: BrandDnaV1): BrandDNA {
  const defaults = getPharmaConnectBrandDnaDefaults(v1.slug);
  const surfaces = v1.surfaces;
  const trustCta = v1.trustCta;

  return deepMergeBrandDna(defaults, {
    version: BRAND_DNA_ENGINE_VERSION,
    slug: v1.slug,
    sourceUrl: v1.sourceUrl,
    frozenAt: v1.frozenAt,
    businessName: v1.businessName,
    logoUrl: v1.logoUrl,
    faviconUrl: v1.faviconUrl,
    colours: v1.colours,
    typography: v1.typography,
    layout: v1.layout,
    spacing: {
      sectionY: surfaces.sectionPadding,
      heroPadding: surfaces.heroPadding,
    },
    imagery: {
      imageRadius: surfaces.cardRadius,
      imageStyle: surfaces.iconStyle,
    },
    cards: {
      radius: surfaces.cardRadius,
      border: surfaces.cardBorder,
      shadow: surfaces.cardShadow,
    },
    buttons: {
      radius: surfaces.buttonRadius,
      weight: surfaces.buttonWeight,
      shadow: surfaces.buttonShadow,
    },
    icons: {
      radius: surfaces.iconRadius,
      style: surfaces.iconStyle,
    },
    maps: {
      ...defaults.maps,
      googlePlaceId: v1.mapConfig?.googlePlaceId,
      latitude: v1.mapConfig?.latitude ?? null,
      longitude: v1.mapConfig?.longitude ?? null,
      canonicalAddress: v1.mapConfig?.canonicalAddress,
      embedMode: v1.mapConfig?.embedMode,
      fallbackMode: v1.mapConfig?.fallbackMode,
    },
    navigation: {
      links: v1.detectedServiceLinks || v1.navigationLinks,
      confirmedItems: v1.navigation?.confirmedItems || v1.footer?.confirmedItems || [],
      primaryCta: v1.navigation?.primaryCta,
      secondaryCta: v1.navigation?.secondaryCta,
      style: v1.layout.navigationStyle,
      ctaText: v1.headerCtaText,
      ctaUrl: v1.headerCtaUrl,
      logoMaxHeight: v1.layout.logoMaxHeight,
    },
    footer: {
      links: v1.footerLinks,
      confirmedItems: v1.footer?.confirmedItems || v1.navigation?.confirmedItems || [],
      legalItems: v1.footer?.legalItems || [],
      layout: v1.layout.footerLayout,
      showLogo: v1.footerEvidence?.showLogo ?? true,
      showAddress: v1.footerEvidence?.hasContactBlock ?? true,
      showPhone: v1.footerEvidence?.hasContactBlock ?? true,
    },
    trustPanels: {
      cardRadius: trustCta.trustCardRadius,
      itemStyle: trustCta.trustItemStyle,
    },
    ctaStyles: {
      bandStyle: trustCta.ctaBandStyle,
      buttonRadius: trustCta.ctaButtonRadius,
    },
    radius: {
      md: surfaces.buttonRadius,
      lg: surfaces.cardRadius,
    },
    shadows: {
      card: surfaces.cardShadow,
    },
    surfaces,
    trustCta,
    navigationLinks: v1.detectedServiceLinks || v1.navigationLinks,
    footerLinks: v1.footerLinks,
    headerCtaText: v1.headerCtaText,
    headerCtaUrl: v1.headerCtaUrl,
    topInfoBarText: v1.topInfoBarText,
    components: v1.components,
    componentEvidence: v1.componentEvidence,
    confidence: v1.confidence,
    source: v1.source,
    semanticColours: v1.semanticColours,
    typographyRoles: v1.typographyRoles,
    styleEvidence: v1.styleEvidence,
    footerEvidence: v1.footerEvidence,
    mapConfig: v1.mapConfig,
    conflicts: v1.conflicts,
    completeness: v1.completeness,
    detectedServiceLinks: v1.detectedServiceLinks,
  });
}

export function syncBrandDnaLegacyBridges(dna: BrandDNA): BrandDNA {
  return {
    ...dna,
    surfaces: {
      buttonRadius: dna.buttons.radius,
      buttonWeight: dna.buttons.weight,
      buttonShadow: dna.buttons.shadow,
      cardRadius: dna.cards.radius,
      cardBorder: dna.cards.border,
      cardShadow: dna.cards.shadow,
      sectionPadding: dna.spacing.sectionY,
      heroPadding: dna.spacing.heroPadding,
      iconRadius: dna.icons.radius,
      iconStyle: dna.icons.style,
    },
    trustCta: {
      trustCardRadius: dna.trustPanels.cardRadius,
      trustItemStyle: dna.trustPanels.itemStyle,
      ctaBandStyle: dna.ctaStyles.bandStyle,
      ctaButtonRadius: dna.ctaStyles.buttonRadius,
    },
    navigationLinks: dna.navigation.links,
    footerLinks: dna.footer.links,
    headerCtaText: dna.navigation.ctaText,
    headerCtaUrl: dna.navigation.ctaUrl,
    layout: {
      ...dna.layout,
      navigationStyle: dna.navigation.style,
      footerLayout: dna.footer.layout,
      logoMaxHeight: dna.navigation.logoMaxHeight,
    },
  };
}
