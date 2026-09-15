/**
 * Website Import → Brand DNA extraction (Sprint 5B).
 * Populates canonical brand-dna.json from stored import evidence + targeted CSS/HTML supplements.
 */
import type { BrandProfile } from "../generator/brandImporter.ts";
import type {
  BrandDnaColours,
  BrandDnaLayout,
  BrandDnaSurfaceStyle,
  BrandDnaTrustCta,
  BrandDnaTypography,
  BrandDnaV1,
} from "./pharmacyBrandDnaTypes.ts";
import { BRAND_DNA_VERSION } from "./pharmacyBrandDnaTypes.ts";
import { getPharmaConnectBrandDnaDefaults } from "./pharmacyBrandDnaDefaults.ts";
import {
  type BrandDnaExtractionReport,
  emptyExtractionReport,
  fieldEvidence,
} from "./pharmacyBrandDnaExtractionEvidence.ts";
import {
  cssFontFamily,
  cssHex,
  fetchWebsiteCssEvidence,
  fetchWebsiteHtmlIdentityEvidence,
  pickAccentHex,
} from "./pharmacyBrandDnaCssImportEvidence.ts";
import {
  loadWebsiteImportSources,
  websiteImportLogoLooksLikeFavicon,
  websiteImportNeedsCssSupplement,
  websiteImportColourConfidence,
  type WebsiteImportSources,
} from "./pharmacyBrandDnaWebsiteImportSources.ts";
import {
  buildStyleEvidenceSamples,
  extractCssRuleColor,
} from "./pharmacyBrandDnaStyleEvidence.ts";
import {
  bridgeSemanticToLegacyColours,
  buildDefaultSemanticColours,
  resolveSemanticColours,
} from "./pharmacyBrandDnaSemanticColours.ts";
import { extractCanonicalNavigation } from "./pharmacyBrandDnaNavigationExtraction.ts";
import { computeWebsiteImportRevision } from "./pharmacyDesignLineageRevisionService.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { applyDesignEvidenceToBrandDna } from "./pharmacyDesignEvidenceApplication.ts";
import { resolveBrandButtonColor } from "./pharmacyBrandButtonColorResolver.ts";
import { detectBrandDnaConflicts } from "./pharmacyBrandDnaConflictDetection.ts";
import { computeBrandDnaCompletenessScore } from "./pharmacyBrandDnaCompletenessScore.ts";
import { extractFooterTrustBadgeAssets } from "./pharmacyBrandDnaFooterAssetExtraction.ts";
import { extractFooterHtmlFromHomepage } from "./pharmacyWebsiteAnalysisService.ts";
import { fetchWebsiteHtml } from "./growthEngineWebsiteCrawler.ts";
import type {
  BrandDnaFooterEvidence,
  BrandDnaMapConfig,
  BrandDnaTypographyRoles,
} from "./pharmacyBrandDnaSemanticTypes.ts";
import { normalizeHex } from "./pharmacyThemeEngine.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function cleanFontName(font: string, fallback: string): string {
  const name = str(font).split(",")[0]?.replace(/['"]/g, "").trim();
  if (!name || /system-ui|sans-serif|serif/i.test(name)) return fallback;
  return name;
}

function recordField(
  report: BrandDnaExtractionReport,
  key: string,
  value: string | number | boolean | null,
  source: "website-import" | "website-css" | "website-html" | "website-intelligence" | "platform-default",
  evidenceSource: string,
  extractionMethod: string,
  confidence: number,
  selectorOrProperty?: string,
): string {
  const importedAt = report.extractedAt;
  report.fields[key] = fieldEvidence(
    value,
    source,
    evidenceSource,
    extractionMethod,
    confidence,
    importedAt,
    selectorOrProperty,
  );
  if (source === "platform-default") {
    if (!report.usingDefaults.includes(key)) report.usingDefaults.push(key);
  } else if (!report.populatedFromWebsite.includes(key)) {
    report.populatedFromWebsite.push(key);
  }
  return str(value);
}

function defaultHex(key: keyof BrandDnaColours, defaults: ReturnType<typeof getPharmaConnectBrandDnaDefaults>): string {
  return defaults.colours[key];
}

export interface WebsiteBrandDnaExtractionResult {
  dna: BrandDnaV1;
  report: BrandDnaExtractionReport;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function isPlaceholderBusinessName(value: string): boolean {
  const normalized = str(value).toLowerCase();
  return !normalized || /service input field|placeholder|untitled|your pharmacy name/i.test(normalized);
}

function resolveImportedBusinessName(
  brand: Partial<BrandProfile>,
  profile: WebsiteImportSources["profile"],
  intelligence: WebsiteImportSources["intelligence"],
): string {
  const fromBrand = str(brand.businessName);
  if (fromBrand && !isPlaceholderBusinessName(fromBrand)) return fromBrand;

  const titleCandidate = decodeHtmlEntities(str(intelligence?.identity?.title)).split(/[–—|]/)[0]?.trim() || "";
  if (titleCandidate && !isPlaceholderBusinessName(titleCandidate)) return titleCandidate;

  const pageTitleCandidate =
    intelligence?.business?.businessName?.candidates?.find(
      (c) => c.detectionMethod === "page-title" && str(c.value) && !isPlaceholderBusinessName(str(c.value)),
    )?.value || "";
  if (pageTitleCandidate) return decodeHtmlEntities(str(pageTitleCandidate));

  return str(profile.pharmacyName) || fromBrand;
}

export async function extractBrandDnaFromWebsiteEvidence(slug: string): Promise<WebsiteBrandDnaExtractionResult | null> {
  const sources = loadWebsiteImportSources(slug);
  if (!sources) return null;

  const defaults = getPharmaConnectBrandDnaDefaults(sources.slug);
  const brand = sources.brandProfile || ({} as Partial<BrandProfile>);
  const profile = sources.profile;
  const report = emptyExtractionReport(sources.slug, sources.sourceUrl);
  report.extractedAt = new Date().toISOString();

  const cssEvidence = websiteImportNeedsCssSupplement(sources)
    ? await fetchWebsiteCssEvidence(sources.sourceUrl)
    : { stylesheets: [], mergedVariables: {}, mergedHexCandidates: [], mergedCssText: "", confidence: 0 };

  const storedLogo = str(brand.logoUrl) || str(sources.intelligence?.identity?.logoUrl) || str(profile.logoUrl);
  const htmlIdentity =
    !storedLogo || websiteImportLogoLooksLikeFavicon(storedLogo) || websiteImportNeedsCssSupplement(sources)
      ? await fetchWebsiteHtmlIdentityEvidence(sources.sourceUrl)
      : null;

  const vars = cssEvidence.mergedVariables;
  const cssPrimary = cssHex(vars, "main-color", "primary-color", "bs-primary");
  const cssSecondary = cssHex(vars, "secondary-color", "primary-black-color");
  const cssBackground = cssHex(vars, "bg-color", "gray-light-color", "white-color");
  const cssBody = cssHex(vars, "text-color");
  const cssHeading = cssHex(vars, "heading-color", "black-dark-color");
  const accentCandidates = [...cssEvidence.mergedHexCandidates, ...(htmlIdentity?.hexCandidates || [])];
  const cssAccent = pickAccentHex(cssPrimary, accentCandidates);
  const storedPrimary =
    str(brand.primaryColour) ||
    str(sources.intelligence?.identity?.brandPrimaryColor) ||
    str(profile.brandPrimaryColor);
  const storedSecondary =
    str(brand.secondaryColour) ||
    str(sources.intelligence?.identity?.brandSecondaryColor) ||
    str(profile.brandSecondaryColor);
  const storedAccent =
    str(brand.accentColour) ||
    str(sources.intelligence?.identity?.brandAccentColor) ||
    str(profile.brandAccentColor);
  const colourConfidence = websiteImportColourConfidence(sources);
  const preferStoredColours = colourConfidence >= 60 && Boolean(storedPrimary);

  const primary = normalizeHex(
    recordField(
      report,
      "colours.primary",
      preferStoredColours
        ? storedPrimary
        : cssPrimary || storedPrimary || defaultHex("primary", defaults),
      preferStoredColours
        ? "website-import"
        : cssPrimary
          ? "website-css"
          : storedPrimary
            ? "website-intelligence"
            : "platform-default",
      preferStoredColours ? "brand-profile.json" : cssPrimary ? cssEvidence.stylesheets[0]?.sourceUrl || sources.sourceUrl : "brand-profile.json",
      preferStoredColours ? "stored-import" : cssPrimary ? "css-variable" : "stored-import",
      preferStoredColours ? colourConfidence : cssPrimary ? cssEvidence.confidence : brand.confidence?.colours ?? 30,
      preferStoredColours ? "primaryColour" : cssPrimary ? "--main-color" : undefined,
    ),
    defaultHex("primary", defaults),
  );

  const secondary = normalizeHex(
    recordField(
      report,
      "colours.secondary",
      preferStoredColours
        ? storedSecondary || cssSecondary || defaultHex("secondary", defaults)
        : cssAccent || cssSecondary || storedSecondary || defaultHex("secondary", defaults),
      preferStoredColours ? "website-import" : cssAccent && cssAccent !== primary ? "website-css" : cssSecondary ? "website-css" : "website-import",
      cssEvidence.stylesheets[0]?.sourceUrl || "brand-profile.json",
      preferStoredColours ? "secondaryColour" : cssAccent ? "css-hover-accent" : "css-variable-or-import",
      preferStoredColours ? colourConfidence : cssAccent ? 75 : 50,
      preferStoredColours ? "secondaryColour" : cssAccent ? "#1682b0 hover accent" : "--secondary-color",
    ),
    defaultHex("secondary", defaults),
  );

  const accent = normalizeHex(
    recordField(
      report,
      "colours.accent",
      preferStoredColours
        ? storedAccent || cssAccent || defaultHex("accent", defaults)
        : cssAccent || storedAccent || defaultHex("accent", defaults),
      preferStoredColours ? "website-import" : cssAccent ? "website-css" : "website-import",
      cssEvidence.stylesheets[0]?.sourceUrl || "brand-profile.json",
      preferStoredColours ? "accentColour" : "css-hover-accent",
      preferStoredColours ? colourConfidence : cssAccent ? 78 : brand.confidence?.colours ?? 30,
    ),
    defaultHex("accent", defaults),
  );

  const background = normalizeHex(
    recordField(
      report,
      "colours.background",
      cssBackground || str(brand.backgroundColour) || str(profile.brandBackgroundColor) || defaultHex("background", defaults),
      cssBackground ? "website-css" : "website-import",
      cssEvidence.stylesheets[0]?.sourceUrl || "brand-profile.json",
      "css-variable",
      cssBackground ? 80 : 40,
      "--bg-color",
    ),
    defaultHex("background", defaults),
  );

  const heading = normalizeHex(
    recordField(
      report,
      "colours.heading",
      cssHeading || str(brand.headingColour) || str(profile.brandTextColor) || defaultHex("heading", defaults),
      cssHeading ? "website-css" : "website-import",
      "assets/css/common-style.css",
      "css-variable",
      cssHeading ? 82 : 40,
      "--heading-color",
    ),
    defaultHex("heading", defaults),
  );

  const body = normalizeHex(
    recordField(
      report,
      "colours.body",
      cssBody || str(brand.bodyTextColour) || str(profile.brandMutedTextColor) || defaultHex("body", defaults),
      cssBody ? "website-css" : "website-import",
      "assets/css/common-style.css",
      "css-variable",
      cssBody ? 82 : 40,
      "--text-color",
    ),
    defaultHex("body", defaults),
  );

  const muted = normalizeHex(
    recordField(
      report,
      "colours.muted",
      cssBody || str(profile.brandMutedTextColor) || defaultHex("muted", defaults),
      cssBody ? "website-css" : profile.brandMutedTextColor ? "website-intelligence" : "platform-default",
      "assets/css/common-style.css",
      "css-variable",
      cssBody ? 75 : 0,
      "--text-color",
    ),
    defaultHex("muted", defaults),
  );

  const button = normalizeHex(
    recordField(
      report,
      "colours.button",
      cssPrimary || str(brand.buttonColour) || str(profile.brandCtaColor) || primary,
      cssPrimary ? "website-css" : "website-import",
      "assets/css/style.css",
      "theme-btn.style-one",
      cssPrimary ? 85 : 40,
    ),
    primary,
  );

  const buttonText = normalizeHex(
    recordField(
      report,
      "colours.buttonText",
      str(brand.buttonTextColour) || "#ffffff",
      brand.buttonTextColour ? "website-import" : "platform-default",
      "brand-profile.json",
      "stored-import",
      brand.buttonTextColour ? 70 : 0,
    ),
    "#ffffff",
  );

  const headerBackground = normalizeHex(
    recordField(
      report,
      "semanticColours.headerBackground",
      extractCssRuleColor(cssEvidence.mergedCssText, [".header-upper", ".main-header", ".header-lower"], "background") ||
        cssBackground ||
        "#ffffff",
      cssEvidence.confidence ? "website-css" : "platform-default",
      "assets/css/style.css",
      "main-header white surface",
      cssEvidence.confidence ? 78 : 0,
      ".header-upper",
    ),
    "#ffffff",
  );

  const headerText = normalizeHex(
    recordField(
      report,
      "semanticColours.headerText",
      cssHeading || heading,
      cssHeading ? "website-css" : "website-import",
      "assets/css/common-style.css",
      "navigation link colour",
      cssHeading ? 80 : 40,
      "--heading-color",
    ),
    heading,
  );

  const topBarBackground = normalizeHex(
    recordField(
      report,
      "semanticColours.topBarBackground",
      extractCssRuleColor(cssEvidence.mergedCssText, [".top-header"], "background") || cssPrimary || primary,
      cssPrimary ? "website-css" : "website-html",
      sources.sourceUrl,
      ".top-header background",
      cssPrimary ? 88 : 40,
      ".top-header",
    ),
    primary,
  );

  const topBarText = normalizeHex(
    recordField(
      report,
      "semanticColours.topBarText",
      extractCssRuleColor(cssEvidence.mergedCssText, [".top-header"], "color") || "#ffffff",
      "website-html",
      sources.sourceUrl,
      ".top-header color",
      80,
    ),
    "#ffffff",
  );

  const footerBackground = normalizeHex(
    recordField(
      report,
      "colours.footerBackground",
      extractCssRuleColor(cssEvidence.mergedCssText, [".footer-widget", ".main-footer", ".footer-area", "footer"], "background") ||
        str(brand.footerBackgroundColour) ||
        heading,
      cssEvidence.mergedCssText ? "website-css" : brand.footerBackgroundColour ? "website-import" : "website-css",
      "assets/css/style.css",
      "footer-widget background",
      cssEvidence.mergedCssText ? 72 : 35,
      ".footer-widget",
    ),
    heading,
  );

  const footerText = normalizeHex(
    recordField(
      report,
      "colours.footerText",
      str(brand.footerTextColour) || "#ffffff",
      brand.footerTextColour ? "website-import" : "platform-default",
      "brand-profile.json",
      "stored-import",
      brand.footerTextColour ? 50 : 0,
    ),
    "#ffffff",
  );

  const footerLink = normalizeHex(
    recordField(
      report,
      "colours.footerLink",
      str(brand.footerLinkColour) || footerText,
      brand.footerLinkColour ? "website-import" : "platform-default",
      "brand-profile.json",
      "stored-import",
      50,
    ),
    footerText,
  );

  const footerAccent = normalizeHex(
    recordField(
      report,
      "colours.footerAccent",
      str(brand.footerAccentColour) || defaultHex("footerAccent", defaults),
      brand.footerAccentColour ? "website-import" : "platform-default",
      "brand-profile.json",
      "stored-import",
      40,
    ),
    defaultHex("footerAccent", defaults),
  );

  const legacyColours: BrandDnaColours = {
    primary,
    secondary,
    accent,
    background,
    heading,
    headingPrimary: heading,
    headingSecondary: secondary,
    body,
    muted,
    button,
    buttonText,
    headerBackground,
    headerText,
    footerBackground,
    footerText,
    footerLink,
    footerAccent,
    topBarBackground,
    topBarText,
    sectionBackground: normalizeHex(
      recordField(
        report,
        "colours.sectionBackground",
        cssBackground || defaultHex("sectionBackground", defaults),
        cssBackground ? "website-css" : "platform-default",
        "assets/css/style.css",
        "--bg-color",
        cssBackground ? 70 : 0,
      ),
      defaultHex("sectionBackground", defaults),
    ),
  };

  const styleSamples = buildStyleEvidenceSamples({
    sourceUrl: sources.sourceUrl,
    cssEvidence,
    cssText: cssEvidence.mergedCssText,
    vars,
    importedAt: report.extractedAt,
  });
  report.styleEvidence = styleSamples;

  const hasTopBar = Boolean(str(sources.brandProfile?.sourceUrl) || htmlIdentity || cssPrimary);
  const semanticColoursResolved = resolveSemanticColours({
    samples: styleSamples,
    cssVars: vars,
    hasTopBar,
    defaults: buildDefaultSemanticColours(legacyColours),
  });
  for (const [key, value] of Object.entries(semanticColoursResolved)) {
    recordField(report, `semanticColours.${key}`, value, "website-css", sources.sourceUrl, "semantic-role-resolution", 80);
  }
  const semanticColours = preferStoredColours
    ? buildDefaultSemanticColours(legacyColours)
    : semanticColoursResolved;
  const colours = preferStoredColours ? legacyColours : bridgeSemanticToLegacyColours(semanticColours);

  const headingFont = cleanFontName(
    recordField(
      report,
      "typography.headingFont",
      cssFontFamily(vars, "heading-font") || str(brand.headingFont) || defaults.typography.headingFont,
      cssFontFamily(vars, "heading-font") ? "website-css" : "website-import",
      "assets/css/common-style.css",
      "css-variable",
      cssFontFamily(vars, "heading-font") ? 90 : brand.confidence?.fonts ?? 50,
      "--heading-font",
    ),
    defaults.typography.headingFont,
  );

  const bodyFont = cleanFontName(
    recordField(
      report,
      "typography.bodyFont",
      cssFontFamily(vars, "body-font") || str(brand.bodyFont) || defaults.typography.bodyFont,
      cssFontFamily(vars, "body-font") ? "website-css" : "website-import",
      "assets/css/common-style.css",
      "css-variable",
      cssFontFamily(vars, "body-font") ? 90 : brand.confidence?.fonts ?? 50,
      "--body-font",
    ),
    defaults.typography.bodyFont,
  );

  const typography: BrandDnaTypography = {
    headingFont,
    bodyFont,
    headingWeight: recordField(
      report,
      "typography.headingWeight",
      str(profile.fontHeadingWeight) || defaults.typography.headingWeight,
      profile.fontHeadingWeight ? "website-intelligence" : "platform-default",
      "pharmacy-profile.json",
      "stored-profile",
      profile.fontHeadingWeight ? 60 : 0,
    ),
    bodyWeight: recordField(
      report,
      "typography.bodyWeight",
      str(profile.fontBodyWeight) || defaults.typography.bodyWeight,
      profile.fontBodyWeight ? "website-intelligence" : "platform-default",
      "pharmacy-profile.json",
      "stored-profile",
      profile.fontBodyWeight ? 60 : 0,
    ),
    h1Scale: recordField(
      report,
      "typography.h1Scale",
      "clamp(2.5rem,5vw,5.3125rem)",
      cssEvidence.confidence ? "website-css" : "platform-default",
      "assets/css/common-style.css",
      "h1 font-size 85px scaled",
      cssEvidence.confidence ? 70 : 0,
    ),
    h2Scale: recordField(
      report,
      "typography.h2Scale",
      "clamp(1.75rem,3vw,3rem)",
      cssEvidence.confidence ? "website-css" : "platform-default",
      "assets/css/common-style.css",
      "h2 font-size 48px scaled",
      cssEvidence.confidence ? 70 : 0,
    ),
    h3Size: "22px",
    bodySize: recordField(
      report,
      "typography.bodySize",
      "18px",
      cssEvidence.confidence ? "website-css" : "platform-default",
      "assets/css/common-style.css",
      "body font-size",
      cssEvidence.confidence ? 75 : 0,
    ),
  };

  const navLinks = (brand.navigationLinks || [])
    .filter((l) => str(l.label) && str(l.href))
    .slice(0, 12);
  const footerLinks = (brand.footerLinks || []).filter((l) => str(l.label) && str(l.href)).slice(0, 12);

  const layout: BrandDnaLayout = {
    headerLayout: recordField(
      report,
      "layout.headerLayout",
      "with-top-bar",
      "website-html",
      sources.sourceUrl,
      "top-header detected",
      90,
    ) as BrandDnaLayout["headerLayout"],
    topInfoBar: true,
    navigationStyle: (navLinks.length > 5 ? "multi-link" : "inline") as BrandDnaLayout["navigationStyle"],
    heroLayout: recordField(
      report,
      "layout.heroLayout",
      "split",
      cssEvidence.confidence ? "website-css" : "website-import",
      "assets/css/pages/home-one.css",
      "medolia split hero template",
      75,
    ) as BrandDnaLayout["heroLayout"],
    footerLayout: (footerLinks.length >= 3 ? "multi-column" : "minimal") as BrandDnaLayout["footerLayout"],
    logoMaxHeight: recordField(
      report,
      "layout.logoMaxHeight",
      htmlIdentity?.logoWidth || "48px",
      htmlIdentity?.logoWidth ? "website-html" : "platform-default",
      sources.sourceUrl,
      "brand-logo img width",
      htmlIdentity?.logoWidth ? 80 : 0,
    ),
  };

  const buttonRadius = recordField(
    report,
    "surfaces.buttonRadius",
    "10px",
    cssEvidence.confidence ? "website-css" : "platform-default",
    "assets/css/style.css",
    "theme-btn / medolia border-radius",
    72,
  );

  const cardRadius = recordField(
    report,
    "surfaces.cardRadius",
    "10px",
    cssEvidence.confidence ? "website-css" : "platform-default",
    "assets/css/style.css",
    "medolia-choose-item border-radius",
    70,
  );

  const surfaces: BrandDnaSurfaceStyle = {
    buttonRadius,
    buttonWeight: "600",
    buttonShadow: true,
    cardRadius,
    cardBorder: "1px solid var(--line)",
    cardShadow: "var(--shadow2)",
    sectionPadding: recordField(
      report,
      "spacing.sectionY",
      "72px",
      "platform-default",
      "pharmaconnect-defaults",
      "platform-spacing",
      0,
    ),
    heroPadding: "88px",
    iconRadius: "14px",
    iconStyle: "rounded",
  };

  const trustCta: BrandDnaTrustCta = {
    trustCardRadius: cardRadius,
    trustItemStyle: "card",
    ctaBandStyle: "gradient",
    ctaButtonRadius: buttonRadius,
  };

  const logoUrl = recordField(
    report,
    "identity.logoUrl",
    htmlIdentity?.logoUrl || storedLogo || defaults.logoUrl,
    htmlIdentity?.logoUrl ? "website-html" : storedLogo ? "website-import" : "platform-default",
    htmlIdentity?.sourceUrl || "brand-profile.json",
    htmlIdentity?.logoUrl ? "brand-logo img src" : "stored-import",
    htmlIdentity?.confidence ?? brand.confidence?.logo ?? 0,
    ".brand-logo img",
  );

  const faviconUrl = recordField(
    report,
    "identity.faviconUrl",
    htmlIdentity?.faviconUrl || str(brand.faviconUrl) || str(profile.faviconUrl) || logoUrl,
    htmlIdentity?.faviconUrl ? "website-html" : "website-import",
    sources.sourceUrl,
    "link rel=icon",
    85,
  );

  recordField(
    report,
    "spacing.containerMax",
    "1314px",
    cssEvidence.confidence ? "website-css" : "platform-default",
    "assets/css/common-style.css",
    ".container max-width",
    80,
  );

  const canonicalNav = extractCanonicalNavigation(brand, sources.intelligence);
  const typographyRoles: BrandDnaTypographyRoles = {
    h1: {
      fontFamily: typography.headingFont,
      fontSize: typography.h1Scale,
      fontWeight: typography.headingWeight,
      lineHeight: "1.08",
      colour: semanticColours.headingPrimary,
    },
    h2: {
      fontFamily: typography.headingFont,
      fontSize: typography.h2Scale,
      fontWeight: typography.headingWeight,
      lineHeight: "1.12",
      colour: semanticColours.headingPrimary,
    },
    h3: {
      fontFamily: typography.headingFont,
      fontSize: typography.h3Size,
      fontWeight: typography.headingWeight,
      lineHeight: "1.2",
      colour: semanticColours.headingPrimary,
    },
    body: {
      fontFamily: typography.bodyFont,
      fontSize: typography.bodySize,
      fontWeight: typography.bodyWeight,
      lineHeight: "1.65",
      colour: semanticColours.bodyText,
    },
    navigation: {
      fontFamily: typography.bodyFont,
      fontSize: "14px",
      fontWeight: "600",
      lineHeight: "1.4",
      colour: semanticColours.headerText,
    },
    button: {
      fontFamily: typography.bodyFont,
      fontSize: typography.bodySize,
      fontWeight: "600",
      lineHeight: "1.2",
      colour: semanticColours.primaryActionText,
    },
    footer: {
      fontFamily: typography.bodyFont,
      fontSize: typography.bodySize,
      fontWeight: typography.bodyWeight,
      lineHeight: "1.6",
      colour: semanticColours.footerText,
    },
  };

  let footerBadgeAssets = extractFooterTrustBadgeAssets("", sources.sourceUrl, sources.slug);
  try {
    const homepageHtml = await fetchWebsiteHtml(sources.sourceUrl);
    const footerHtml = extractFooterHtmlFromHomepage(homepageHtml);
    footerBadgeAssets = extractFooterTrustBadgeAssets(footerHtml || homepageHtml, sources.sourceUrl, sources.slug);
  } catch {
    /* footer asset extraction is best-effort */
  }
  const nhsBadgeAsset = footerBadgeAssets.find((asset) => /nhs/i.test(`${asset.label} ${asset.sourceUrl}`));

  const footerEvidence: BrandDnaFooterEvidence = {
    background: semanticColours.footerBackground,
    bottomBarBackground: semanticColours.footerBottomBarBackground || semanticColours.footerBackground,
    headingColour: semanticColours.footerText,
    textColour: semanticColours.footerText,
    linkColour: semanticColours.footerLink,
    columnCount: canonicalNav.footer.columnCount || 4,
    showLogo: true,
    hasDescriptionBlock: true,
    hasQuickLinks: canonicalNav.footer.confirmedItems.length > 0,
    hasOpeningHours: Boolean(str(profile.openingHours)),
    hasContactBlock: Boolean(profile.phone || profile.email),
    hasSocialLinks: Boolean(
      profile.socialFacebook ||
        profile.socialInstagram ||
        profile.socialLinkedIn ||
        profile.socialX ||
        profile.socialYouTube,
    ),
    hasRegulatoryRow: Boolean(profile.gphcNumber),
    hasCopyrightRow: true,
    hasLegalLinks: canonicalNav.footer.legalItems.length > 0,
    openingHoursLayout: "table",
    contactLayout: "column",
    columnOrder: ["about", "quickLinks", "openingHours", "contact"],
    columnWidths: "2.2fr 1fr 1.15fr 1.5fr",
    backgroundTreatment: "pattern-generic",
    description: resolveFooterDescription(brand),
    badges: nhsBadgeAsset ? [] : profile.nhsServicesAvailable ? ["NHS Services"] : [],
    badgeAssets: footerBadgeAssets,
    backToTop: true,
    socialLinks: resolveFooterSocialLinks(profile),
  };

  const mapConfig: BrandDnaMapConfig = {
    googlePlaceId: str(profile.googlePlaceId) || undefined,
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    canonicalAddress: str(profile.fullAddress),
    embedMode: profile.latitude && profile.longitude ? "coordinates" : profile.googlePlaceId ? "place-id" : "address-query",
    fallbackMode: "address-query",
  };

  const conflicts = detectBrandDnaConflicts(
    profile,
    brand,
    canonicalNav.confirmedItems,
    canonicalNav.navigation.primaryCta,
    canonicalNav.navigation.secondaryCta,
  );
  report.conflicts = conflicts;

  const primaryCta = canonicalNav.navigation.primaryCta;
  const secondaryCta = canonicalNav.navigation.secondaryCta;

  const dna: BrandDnaV1 = {
    version: BRAND_DNA_VERSION,
    slug: sources.slug,
    sourceUrl: sources.sourceUrl,
    frozenAt: new Date().toISOString(),
    businessName: resolveImportedBusinessName(brand, profile, sources.intelligence),
    logoUrl,
    faviconUrl,
    colours,
    semanticColours,
    typography,
    typographyRoles,
    layout,
    surfaces,
    trustCta,
    navigationLinks: canonicalNav.confirmedItems.length
      ? canonicalNav.confirmedItems
      : canonicalNav.detectedServiceInventory,
    detectedServiceLinks: canonicalNav.detectedServiceInventory,
    footerLinks: canonicalNav.footer.confirmedItems,
    navigation: canonicalNav.navigation,
    footer: canonicalNav.footer,
    headerCtaText: primaryCta?.label || str(brand.ctaText) || "Book An Appointment",
    headerCtaUrl: primaryCta?.href || str(brand.ctaUrl) || str(profile.website) || "#contact",
    topInfoBarText: buildTopInfoBarText(brand, profile, sources, report),
    styleEvidence: styleSamples,
    footerEvidence,
    mapConfig,
    conflicts,
    confidence: {
      logo: htmlIdentity?.confidence ?? brand.confidence?.logo ?? 0,
      colours: Math.max(brand.confidence?.colours ?? 0, cssEvidence.confidence),
      fonts: Math.max(brand.confidence?.fonts ?? 0, cssFontFamily(vars, "body-font") ? 90 : 0),
      layout: canonicalNav.confirmedItems.length ? 85 : 40,
    },
    source: "website-import",
    sourceImportRevision: computeWebsiteImportRevision(profile, sources.intelligence),
    websiteIntelligenceRevision: str(sources.intelligence?.importedAt || sources.importedAt),
    generatedAt: new Date().toISOString(),
  };

  report.completeness = computeBrandDnaCompletenessScore(dna, report, styleSamples, conflicts.length);

  const designEvidence = sources.intelligence?.designEvidence || loadWebsiteDesignEvidence(sources.slug);
  if (designEvidence) {
    return { dna: applyDesignEvidenceToBrandDna(dna, designEvidence), report };
  }

  return { dna, report };
}

function resolveFooterDescription(brand: Partial<BrandProfile>): string | undefined {
  const phrases = brand.toneOfVoice?.samplePhrases || [];
  for (const phrase of phrases) {
    const text = str(phrase);
    if (text.length < 30) continue;
    if (/healthcare|wellbeing|nhs services|pharmacy solutions|private treatments/i.test(text)) {
      return text.replace(/^[^:]+:\s*/, "").trim() || text;
    }
  }
  return undefined;
}

function resolveFooterSocialLinks(profile: WebsiteImportSources["profile"]): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  for (const [label, url] of [
    ["Facebook", profile.socialFacebook],
    ["Instagram", profile.socialInstagram],
    ["LinkedIn", profile.socialLinkedIn],
    ["X", profile.socialX],
    ["YouTube", profile.socialYouTube],
  ] as const) {
    const href = str(url);
    if (href) links.push({ label, href });
  }
  return links;
}

function buildTopInfoBarText(
  brand: Partial<BrandProfile>,
  profile: WebsiteImportSources["profile"],
  sources: WebsiteImportSources,
  report: BrandDnaExtractionReport,
): string {
  const parts: string[] = [];
  const hours = str(profile.openingHours).replace(/\s*\|\s*$/g, "").trim();
  if (hours) parts.push(hours);
  const phone = str(brand.contact?.phone) || str(profile.phone);
  if (phone) parts.push(phone);
  const email = str(brand.contact?.email) || str(profile.businessEmail) || str(profile.email);
  if (email) parts.push(email);
  const text = parts.join(" | ");
  if (text) {
    recordField(report, "layout.topInfoBarText", text, "website-import", "brand-profile.json", "contact + hours", 85);
  }
  return text;
}

/** Sync entry for legacy callers — runs async extraction without CSS supplement when possible. */
export function extractBrandDnaFromWebsiteImport(slug: string): BrandDnaV1 | null {
  const sources = loadWebsiteImportSources(slug);
  if (!sources) return null;
  const brand = sources.brandProfile || ({} as Partial<BrandProfile>);
  const defaults = getPharmaConnectBrandDnaDefaults(sources.slug);
  const profile = sources.profile;
  const navLinks = (brand.navigationLinks || []).filter((l) => str(l.label) && str(l.href)).slice(0, 8);
  const footerLinks = (brand.footerLinks || []).filter((l) => str(l.label) && str(l.href)).slice(0, 8);
  if (!navLinks.length && !footerLinks.length) return null;

  return {
    version: BRAND_DNA_VERSION,
    slug: sources.slug,
    sourceUrl: sources.sourceUrl,
    frozenAt: new Date().toISOString(),
    businessName: resolveImportedBusinessName(brand, profile, sources.intelligence),
    logoUrl: str(brand.logoUrl) || str(profile.logoUrl),
    faviconUrl: str(brand.faviconUrl) || str(profile.faviconUrl),
    colours: {
      primary: normalizeHex(str(brand.primaryColour) || str(profile.brandPrimaryColor), defaults.colours.primary),
      secondary: normalizeHex(str(brand.secondaryColour) || str(profile.brandSecondaryColor), defaults.colours.secondary),
      accent: normalizeHex(str(brand.accentColour) || str(profile.brandAccentColor), defaults.colours.accent),
      background: normalizeHex(str(brand.backgroundColour) || str(profile.brandBackgroundColor), defaults.colours.background),
      heading: normalizeHex(str(brand.headingColour) || str(profile.brandTextColor), defaults.colours.heading),
      body: normalizeHex(str(brand.bodyTextColour) || str(profile.brandMutedTextColor), defaults.colours.body),
      muted: normalizeHex(str(profile.brandMutedTextColor), defaults.colours.muted),
      button: normalizeHex(str(brand.buttonColour) || str(profile.brandCtaColor), defaults.colours.button),
      buttonText: "#ffffff",
      headerBackground: normalizeHex(str(brand.headerBackgroundColour) || str(brand.primaryColour), defaults.colours.headerBackground),
      headerText: "#ffffff",
      footerBackground: normalizeHex(str(brand.footerBackgroundColour), defaults.colours.footerBackground),
      footerText: "#ffffff",
      footerLink: "#ffffff",
      footerAccent: defaults.colours.footerAccent,
      sectionBackground: defaults.colours.sectionBackground,
    },
    typography: {
      headingFont: cleanFontName(str(brand.headingFont) || str(profile.fontHeading), defaults.typography.headingFont),
      bodyFont: cleanFontName(str(brand.bodyFont) || str(profile.fontBody), defaults.typography.bodyFont),
      headingWeight: str(profile.fontHeadingWeight) || defaults.typography.headingWeight,
      bodyWeight: str(profile.fontBodyWeight) || defaults.typography.bodyWeight,
      h1Scale: defaults.typography.h1Scale,
      h2Scale: defaults.typography.h2Scale,
      h3Size: defaults.typography.h3Size,
      bodySize: defaults.typography.bodySize,
    },
    layout: {
      headerLayout: "with-top-bar",
      topInfoBar: true,
      navigationStyle: navLinks.length > 5 ? "multi-link" : "inline",
      heroLayout: "split",
      footerLayout: footerLinks.length >= 3 ? "multi-column" : "minimal",
      logoMaxHeight: "48px",
    },
    surfaces: defaults.surfaces,
    trustCta: defaults.trustCta,
    navigationLinks: navLinks,
    footerLinks,
    headerCtaText: str(brand.ctaText) || "Book An Appointment",
    headerCtaUrl: str(brand.ctaUrl) || str(profile.website) || "#contact",
    topInfoBarText: "",
    confidence: {
      logo: brand.confidence?.logo ?? 0,
      colours: brand.confidence?.colours ?? 0,
      fonts: brand.confidence?.fonts ?? 0,
      layout: navLinks.length ? 80 : 40,
    },
    source: brand.sourceUrl ? "website-import" : "brand-profile",
  };
}

export function validateBrandDnaColours(dna: BrandDnaV1): BrandDnaV1 {
  const defaults = getPharmaConnectBrandDnaDefaults(dna.slug);
  const semantic = dna.semanticColours;
  const c = semantic ? bridgeSemanticToLegacyColours(semantic) : dna.colours;
  return {
    ...dna,
    colours: {
      ...c,
      primary: normalizeHex(c.primary, defaults.colours.primary),
      secondary: normalizeHex(c.secondary, defaults.colours.secondary),
      accent: normalizeHex(c.accent, defaults.colours.accent),
      background: normalizeHex(c.background, defaults.colours.background),
      heading: normalizeHex(c.heading, defaults.colours.heading),
      headingPrimary: normalizeHex(c.headingPrimary || c.heading, defaults.colours.heading),
      headingSecondary: normalizeHex(c.headingSecondary || c.secondary, defaults.colours.secondary),
      body: normalizeHex(c.body, defaults.colours.body),
      muted: normalizeHex(c.muted, defaults.colours.muted),
      button: resolveBrandButtonColor({
        button: normalizeHex(c.button, c.primary),
        primary: normalizeHex(c.primary, defaults.colours.primary),
        accent: normalizeHex(c.accent, defaults.colours.accent),
        secondary: normalizeHex(c.secondary, defaults.colours.secondary),
      }),
      buttonText: normalizeHex(c.buttonText, "#ffffff"),
      headerBackground: normalizeHex(c.headerBackground, "#ffffff"),
      headerText: normalizeHex(c.headerText, c.heading),
      topBarBackground: normalizeHex(c.topBarBackground || c.primary, c.primary),
      topBarText: normalizeHex(c.topBarText || "#ffffff", "#ffffff"),
      footerBackground: normalizeHex(c.footerBackground, defaults.colours.footerBackground),
      footerText: normalizeHex(c.footerText, "#ffffff"),
      footerLink: normalizeHex(c.footerLink, c.footerText),
      footerAccent: normalizeHex(c.footerAccent, defaults.colours.footerAccent),
      sectionBackground: normalizeHex(c.sectionBackground, defaults.colours.sectionBackground),
    },
    semanticColours: semantic
      ? {
          ...semantic,
          headingPrimary: normalizeHex(semantic.headingPrimary, c.heading),
        }
      : dna.semanticColours,
  };
}
