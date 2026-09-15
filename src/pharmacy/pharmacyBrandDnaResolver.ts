/**
 * Apply resolved Brand DNA to service page profile and theme.
 * Render path reads tenant storage via Brand DNA Engine only — no website scanning.
 */
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { brandDnaV1ToEngineModel } from "./pharmacyBrandDnaNormalize.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveBrandButtonColor } from "./pharmacyBrandButtonColorResolver.ts";
import { buildPharmacyTheme, normalizeHex, type PharmacyTheme } from "./pharmacyThemeEngine.ts";
import {
  confirmedNavToProfileLinks,
  resolveConfirmedNavigationItems,
  resolveFooterConfirmedItems,
  resolveProminentTelephoneCta,
} from "./pharmacyBrandDnaConfirmedNavigation.ts";
import { hasActivatedTenantDesignDna } from "./pharmacyTenantDnaRenderActivation.ts";
import { resolveSiteChromeNavigation } from "./pharmacySiteChromeNavigationService.ts";
import { resolveCommercialLogoUrl } from "./pharmacyBusinessFieldSanitizer.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function isValidTenantNavUrl(url: string): boolean {
  const normalized = String(url || "").trim();
  if (!normalized || normalized === "#") return false;
  if (/^javascript:/i.test(normalized)) return false;
  if (/localhost|127\.0\.0\.1/i.test(normalized)) return false;
  return true;
}

function resolveBrandForProfile(slug: string, dna?: BrandDnaV1 | BrandDNA | null): BrandDNA {
  if (dna && "spacing" in dna) return dna;
  if (dna && "version" in dna && dna.version === "brand-dna-v1") {
    return brandDnaV1ToEngineModel(dna);
  }
  return resolveBrandDnaForRender(slug);
}

export function applyBrandDnaToServicePageProfile(
  profile: PharmacyServicePageProfile,
  dna?: BrandDnaV1 | BrandDNA | null,
): PharmacyServicePageProfile {
  const brand = resolveBrandForProfile(profile.slug, dna);

  const confirmedNav = resolveConfirmedNavigationItems(brand);
  const siteChromeNav = hasActivatedTenantDesignDna(profile.slug) ? resolveSiteChromeNavigation(profile.slug) : null;
  const primaryNav = siteChromeNav?.primaryNavigation.length
    ? confirmedNavToProfileLinks(siteChromeNav.primaryNavigation.map((l) => ({ label: l.label, href: l.href })))
    : confirmedNav.length
      ? confirmedNavToProfileLinks(confirmedNav)
      : profile.headerNavLinks;
  const headerNavLinks = primaryNav;

  const footerConfirmed = resolveFooterConfirmedItems(brand);
  const footerLinks = footerConfirmed.length
    ? confirmedNavToProfileLinks(footerConfirmed)
    : profile.footerLinks;

  const showProminentTelephoneCta = resolveProminentTelephoneCta(brand);

  const logo = resolveCommercialLogoUrl(str(brand.logoUrl), profile.logoUrl, profile.headerLogoUrl);

  const headerNavBackground =
    brand.layout.headerLayout === "with-top-bar" && brand.layout.topInfoBar
      ? normalizeHex(brand.colours.headerBackground, brand.colours.background)
      : brand.colours.headerBackground;

  const headerNavText =
    brand.layout.headerLayout === "with-top-bar" && brand.layout.topInfoBar
      ? brand.colours.headerText
      : brand.colours.headerText;

  const secondaryCtaUrl = str(
    (brand as BrandDNA).navigation?.secondaryCta?.href ||
      (brand as BrandDnaV1).navigation?.secondaryCta?.href,
  );
  const secondaryCtaText = str(
    (brand as BrandDNA).navigation?.secondaryCta?.label ||
      (brand as BrandDnaV1).navigation?.secondaryCta?.label,
  );
  const primaryCtaUrl =
    str((brand as BrandDNA).navigation?.primaryCta?.href || (brand as BrandDnaV1).navigation?.primaryCta?.href) ||
    str(brand.headerCtaUrl) ||
    profile.headerCtaUrl ||
    profile.website;
  const primaryCtaText =
    str((brand as BrandDNA).navigation?.primaryCta?.label || (brand as BrandDnaV1).navigation?.primaryCta?.label) ||
    str(brand.headerCtaText) ||
    profile.headerCtaText ||
    profile.primaryCta;

  return {
    ...profile,
    logoUrl: logo,
    headerLogoUrl: logo,
    footerLogoUrl: logo,
    website: str(brand.sourceUrl) || profile.website,
    brandPrimaryColor: brand.colours.primary,
    brandSecondaryColor: brand.colours.secondary,
    brandCtaColor: resolveBrandButtonColor({
      button: brand.colours.button,
      primary: brand.colours.primary,
      accent: brand.colours.accent,
      secondary: brand.colours.secondary,
    }),
    brandAccentColor: brand.colours.accent,
    brandBackgroundColor: brand.colours.background,
    brandTextColor: brand.colours.heading,
    brandMutedTextColor: brand.colours.muted,
    brandHeaderBackgroundColor: headerNavBackground,
    brandHeaderTextColor: headerNavText,
    brandFooterBackgroundColor: brand.colours.footerBackground,
    brandFooterTextColor: brand.colours.footerText,
    brandFooterLinkColor: brand.colours.footerLink,
    brandFooterAccentColor: brand.colours.footerAccent,
    fontHeading: brand.typography.headingFont,
    fontBody: brand.typography.bodyFont,
    buttonRadius: brand.surfaces.buttonRadius,
    cardRadius: brand.surfaces.cardRadius,
    headerNavLinks,
    footerLinks,
    headerCtaText: primaryCtaText,
    headerCtaUrl: primaryCtaUrl,
    primaryCta: primaryCtaText,
    secondaryCtaText: secondaryCtaText || undefined,
    secondaryCtaUrl: secondaryCtaUrl || undefined,
    showProminentTelephoneCta,
  };
}

export function buildPharmacyThemeWithBrandDna(
  profile: PharmacyServicePageProfile,
  dna?: BrandDnaV1 | BrandDNA | null,
): PharmacyTheme {
  const brand = resolveBrandForProfile(profile.slug, dna);
  const resolvedProfile = applyBrandDnaToServicePageProfile(profile, brand);
  const theme = buildPharmacyTheme(resolvedProfile);

  return {
    ...theme,
    fontHeading: brand.typography.headingFont,
    fontBody: brand.typography.bodyFont,
    buttonRadius: brand.surfaces.buttonRadius,
    cardRadius: brand.surfaces.cardRadius,
    sectionBackground: brand.colours.sectionBackground,
    primaryColor: brand.colours.primary,
    secondaryColor: brand.colours.secondary,
    ctaColor: resolveBrandButtonColor({
      button: brand.colours.button,
      primary: brand.colours.primary,
      accent: brand.colours.accent,
      secondary: brand.colours.secondary,
    }),
    accentColor: brand.colours.accent,
    backgroundColor: brand.colours.background,
    textColor: brand.colours.body,
    mutedTextColor: brand.colours.muted,
    headingColor: brand.colours.heading,
    headerBackgroundColor: resolvedProfile.brandHeaderBackgroundColor,
    headerTextColor: resolvedProfile.brandHeaderTextColor,
    footerBackgroundColor: brand.colours.footerBackground,
    footerTextColor: brand.colours.footerText,
    footerLinkColor: brand.colours.footerLink,
    footerAccentColor: brand.colours.footerAccent,
    brandDna: brandDnaToThemeBridge(brand),
  };
}

/** Bridge full engine model to legacy theme.brandDna slot until all renderers migrate. */
function brandDnaToThemeBridge(brand: BrandDNA): BrandDnaV1 {
  return {
    version: "brand-dna-v1",
    slug: brand.slug,
    sourceUrl: brand.sourceUrl,
    frozenAt: brand.frozenAt,
    businessName: brand.businessName,
    logoUrl: brand.logoUrl,
    faviconUrl: brand.faviconUrl,
    colours: brand.colours,
    typography: brand.typography,
    layout: brand.layout,
    surfaces: brand.surfaces,
    trustCta: brand.trustCta,
    navigationLinks: brand.navigationLinks,
    navigation: {
      confirmedItems: brand.navigation?.confirmedItems || [],
      primaryCta: brand.navigation?.primaryCta,
      secondaryCta: brand.navigation?.secondaryCta,
    },
    footerLinks: brand.footerLinks,
    headerCtaText: brand.headerCtaText,
    headerCtaUrl: brand.headerCtaUrl,
    topInfoBarText: brand.topInfoBarText,
    confidence: brand.confidence,
    source: brand.source === "website-import" || brand.source === "brand-profile" || brand.source === "manual"
      ? brand.source
      : "manual",
  };
}

import { isPharmaconnectDesignSystemV1Locked, buildPharmaconnectDesignSystemV1FontsLink } from "./pharmacyDesignSystemV1.ts";

export function buildGoogleFontsLink(theme: PharmacyTheme): string {
  if (isPharmaconnectDesignSystemV1Locked()) {
    return buildPharmaconnectDesignSystemV1FontsLink();
  }
  const families = new Set<string>();
  for (const font of [theme.fontHeading, theme.fontBody]) {
    const name = str(font).split(",")[0]?.replace(/['"]/g, "").trim();
    if (name && !/system-ui|sans-serif|serif/i.test(name)) families.add(name);
  }
  if (!families.size) {
    return `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet"/>`;
  }
  const params = [...families]
    .map((name) => `family=${encodeURIComponent(name)}:wght@400;500;600;700;800`)
    .join("&");
  return `<link href="https://fonts.googleapis.com/css2?${params}&display=swap" rel="stylesheet"/>`;
}
