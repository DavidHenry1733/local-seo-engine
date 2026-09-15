/**
 * Apply Website Design Evidence to Brand DNA and Component DNA generation.
 */
import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { resolveBrandButtonColor } from "./pharmacyBrandButtonColorResolver.ts";
import { getPharmaConnectComponentDnaDefaults } from "./pharmacyComponentDnaDefaults.ts";
import { normalizeComponentDna } from "./pharmacyComponentDnaNormalize.ts";
import { resolveComponentDna } from "./pharmacyComponentDnaResolver.ts";
import { brandDnaV1ToEngineModel } from "./pharmacyBrandDnaNormalize.ts";
import { resolveImportedAssetPath } from "./pharmacyWebsiteDesignAssetImporter.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function firstColour(tokens: Array<{ hex: string }>, fallback = ""): string {
  return str(tokens[0]?.hex) || fallback;
}

export function applyDesignEvidenceToBrandDna(base: BrandDnaV1, evidence: WebsiteDesignEvidence): BrandDnaV1 {
  const primary = firstColour(evidence.colourSystem.primary, base.colours.primary);
  const secondary = firstColour(evidence.colourSystem.secondary, base.colours.secondary);
  const accent = firstColour(evidence.colourSystem.accent, base.colours.accent) || primary;
  const button = resolveBrandButtonColor({
    button: firstColour(evidence.colourSystem.button, base.colours.button),
    primary,
    accent,
    secondary,
  });

  const logoPath = resolveImportedAssetPath(base.slug, "logo");
  const logoUrl = logoPath ? `/${logoPath.replace(/^\/+/, "")}` : evidence.header.logoUrl || base.logoUrl;
  const navLinks = evidence.navigation.items.map((item) => ({ label: item.label, href: item.href }));

  return {
    ...base,
    businessName: base.businessName || evidence.pagesSampled.find((p) => p.role === "branch")?.title.split(/[|–-]/)[0]?.trim() || base.businessName,
    logoUrl,
    colours: {
      ...base.colours,
      primary,
      secondary,
      accent,
      button,
      headerBackground: evidence.header.backgroundColour || base.colours.headerBackground,
      headerText: evidence.header.textColour || base.colours.headerText,
      footerBackground: evidence.footer.backgroundColour || base.colours.footerBackground,
      footerText: evidence.footer.textColour || base.colours.footerText,
      topBarBackground: evidence.colourSystem.header.find((c) => c.role.includes("topbar"))?.hex || primary,
    },
    typography: {
      ...base.typography,
      headingFont: evidence.typography.heading.fontFamily || base.typography.headingFont,
      bodyFont: evidence.typography.body.fontFamily || base.typography.bodyFont,
      headingWeight: evidence.typography.heading.fontWeight || base.typography.headingWeight,
      bodyWeight: evidence.typography.body.fontWeight || base.typography.bodyWeight,
      h1Scale: evidence.layout.headingScale.h1 ? `clamp(1.8rem, 4vw, ${evidence.layout.headingScale.h1})` : base.typography.h1Scale,
      bodySize: evidence.typography.body.fontSize || base.typography.bodySize,
    },
    layout: {
      ...base.layout,
      headerLayout: evidence.header.hasTopBar ? "with-top-bar" : base.layout.headerLayout,
      topInfoBar: evidence.header.hasTopBar,
      navigationStyle: evidence.navigation.items.length > 5 ? "multi-link" : base.layout.navigationStyle,
      footerLayout: evidence.footer.columnCount >= 3 ? "multi-column" : base.layout.footerLayout,
      logoMaxHeight: evidence.header.logoMaxHeight || base.layout.logoMaxHeight,
    },
    surfaces: {
      ...base.surfaces,
      buttonRadius: evidence.buttons[0]?.borderRadius || base.surfaces.buttonRadius,
      cardRadius: evidence.layout.cardRadius || base.surfaces.cardRadius,
      sectionPadding: evidence.layout.sectionPaddingY || base.surfaces.sectionPadding,
      heroPadding: evidence.layout.heroPaddingY || base.surfaces.heroPadding,
    },
    navigationLinks: navLinks.length ? navLinks : base.navigationLinks,
    navigation: {
      confirmedItems: navLinks,
      primaryCta: base.navigation?.primaryCta,
      secondaryCta: base.navigation?.secondaryCta,
      telephoneCta: base.navigation?.telephoneCta,
    },
    footerLinks: evidence.footer.quickLinks.length ? evidence.footer.quickLinks : base.footerLinks,
    footer: {
      confirmedItems: evidence.footer.quickLinks,
      legalItems: evidence.footer.legalLinks,
      showLogo: evidence.footer.logoPlacement !== "none",
      columnCount: evidence.footer.columnCount || base.footer?.columnCount || 3,
    },
    websiteIntelligenceRevision: base.websiteIntelligenceRevision,
    sourceImportRevision: base.sourceImportRevision,
    generatedAt: evidence.capturedAt,
    updatedAt: new Date().toISOString(),
  };
}

export function applyDesignEvidenceToComponentDna(base: BrandDnaV1, evidence: WebsiteDesignEvidence): ComponentDna {
  const engine = brandDnaV1ToEngineModel(base);
  const inferred = resolveComponentDna(engine);
  const defaults = getPharmaConnectComponentDnaDefaults();

  const headerVariant = evidence.header.hasTopBar && evidence.header.backgroundColour === "#ffffff"
    ? "topbar-white-navigation"
    : evidence.header.hasTopBar
      ? "topbar-navigation"
      : inferred.variants.headerVariant;

  const footerVariant =
    evidence.footer.columnCount >= 4
      ? "four-column-contact"
      : evidence.footer.columnCount === 3
        ? "three-column"
        : evidence.footer.columnCount === 2
          ? "compact"
          : inferred.variants.footerVariant;

  return normalizeComponentDna({
    ...inferred,
    variants: {
      ...inferred.variants,
      headerVariant,
      topBarVariant: evidence.header.hasTopBar ? "contact-hours-strip" : inferred.variants.topBarVariant,
      navigationVariant: evidence.navigation.items.length > 5 ? "horizontal-multi-link" : inferred.variants.navigationVariant,
      footerVariant,
      heroVariant: evidence.imagery.some((i) => i.role === "hero") ? "split-text-left-image-right" : inferred.variants.heroVariant,
    },
    header: {
      ...inferred.header,
      logoMaxHeight: evidence.header.logoMaxHeight || inferred.header.logoMaxHeight,
      logoPosition: evidence.header.logoPosition,
      sticky: evidence.header.sticky,
      topBar: evidence.header.hasTopBar,
      navGap: evidence.layout.gridGap || inferred.header.navGap,
      desktopBreakpoint: evidence.header.desktopBreakpoint || inferred.header.desktopBreakpoint,
    },
    footer: {
      ...inferred.footer,
      columnWidths:
        evidence.footer.columnCount >= 4
          ? "2fr 1fr 1.15fr 1.5fr"
          : evidence.footer.columnCount === 3
            ? "2fr 1fr 1.2fr"
            : evidence.footer.columnCount === 2
              ? "1fr 1fr"
              : inferred.footer.columnWidths,
      columnOrder: evidence.footer.columnOrder.length ? evidence.footer.columnOrder : inferred.footer.columnOrder,
      columnGap: evidence.footer.columnGap || inferred.footer.columnGap,
      sectionPaddingTop: evidence.footer.paddingTop || inferred.footer.sectionPaddingTop,
      hoursTableLayout: evidence.openingHours.format === "table" ? "table" : "paragraph",
      patternTreatment: "imported",
    },
    hero: {
      ...inferred.hero,
      paddingY: evidence.layout.heroPaddingY || inferred.hero.paddingY,
      gap: evidence.layout.heroGap || inferred.hero.gap,
      textColumnRatio: evidence.layout.heroTextRatio || inferred.hero.textColumnRatio,
      imageColumnRatio: evidence.layout.heroImageRatio || inferred.hero.imageColumnRatio,
    },
    splitSection: {
      ...inferred.splitSection,
      maxWidth: evidence.layout.maxContentWidth || inferred.splitSection.maxWidth,
      gap: evidence.layout.gridGap || inferred.splitSection.gap,
      paddingY: evidence.layout.sectionPaddingY || inferred.splitSection.paddingY,
    },
    cta: {
      ...inferred.cta,
      buttonRadius: evidence.buttons[0]?.borderRadius || inferred.cta.buttonRadius,
      spacing: evidence.buttons[0]?.paddingY || inferred.cta.spacing,
    },
    map: {
      ...inferred.map,
      minHeight: evidence.map.minHeight || inferred.map.minHeight,
    },
    image: {
      ...inferred.image,
      borderRadius: evidence.layout.cardRadius || inferred.image.borderRadius,
      heroAspectRatio: evidence.imagery.find((i) => i.role === "hero")?.aspectRatio || inferred.image.heroAspectRatio,
    },
    table: defaults.table,
  });
}
