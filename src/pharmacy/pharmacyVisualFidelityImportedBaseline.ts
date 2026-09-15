/**
 * Sprint 5H — build imported visual baseline from frozen Brand DNA (read-only).
 */
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { ImportedVisualBaseline } from "./pharmacyVisualFidelityTypes.ts";
import { resolveSemanticFromLegacyColours } from "./pharmacyBrandDnaSemanticColours.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function parseLogoPx(value: string): number {
  const match = value.match(/^([\d.]+)\s*px$/i);
  return match ? Number(match[1]) : 48;
}

export function buildImportedVisualBaseline(brand: BrandDNA | BrandDnaV1): ImportedVisualBaseline {
  const layout = brand.layout;
  const surfaces = brand.surfaces;
  const spacing = brand.spacing;
  const footerEvidence = brand.footerEvidence;
  const navigation = brand.navigation;
  const footer = brand.footer;
  const components = brand.components;
  const semantic = brand.semanticColours || resolveSemanticFromLegacyColours(brand.colours);
  const typographyRoles = brand.typographyRoles;
  const imagery = "imagery" in brand ? brand.imagery : undefined;

  const navCount = navigation?.confirmedItems?.length || 0;
  const ctaCount =
    (navigation?.primaryCta?.href ? 1 : 0) +
    (navigation?.secondaryCta?.href ? 1 : 0) +
    (navigation?.telephoneCta?.href ? 1 : 0);
  const footerQuickLinks = footer?.confirmedItems?.length || 0;
  const footerLegalLinks = footer?.legalItems?.length || 0;

  return {
    header: {
      headerHeightPx: 72,
      logoMaxHeightPx: parseLogoPx(str(layout.logoMaxHeight) || "48px"),
      logoAlignment: "left",
      navigationPosition: "end",
      navigationGapPx: 16,
      navigationLinkCount: navCount,
      ctaCount,
      ctaOrder: navigation?.secondaryCta ? "secondary-primary" : "primary-only",
      ctaGapPx: 10,
      containerWidth: str(spacing?.containerMax) || "1200px",
      topInformationBar: Boolean(layout.topInfoBar && layout.headerLayout === "with-top-bar"),
      stickyHeader: true,
      headerVariant: str(components?.headerVariant) || "topbar-white-navigation",
      headerBackground: semantic.headerBackground,
      topBarBackground: semantic.topBarBackground,
    },
    hero: {
      layout: str(layout.heroLayout) || "split",
      heroVariant: str(components?.heroVariant) || "split-text-left-image-right",
      textColumnRatio: "1.05fr",
      imageColumnRatio: "0.95fr",
      paddingY: str(surfaces?.heroPadding) || str(spacing?.heroPadding) || "88px",
      gapPx: 48,
      imageRadius: str(surfaces?.cardRadius) || str(imagery?.imageRadius) || "10px",
      ctaPlacement: "hero-copy",
    },
    content: {
      sectionPaddingY: str(surfaces?.sectionPadding) || str(spacing?.sectionY) || "72px",
      containerWidth: str(spacing?.containerMax) || "1200px",
      cardColumns: components?.serviceCardVariant === "card-grid-two" ? 2 : components?.serviceCardVariant === "card-led-band" ? 1 : 3,
      processColumns: components?.processVariant === "compact-list" ? 1 : components?.processVariant === "timeline" ? 2 : 4,
      misconceptionColumns: 2,
      trustVariant: str(components?.trustPanelVariant) || "split-image-trust",
      faqVariant: str(components?.faqVariant) || "stacked-cards",
      sectionFlow: str(components?.sectionFlowVariant) || "alternating-media",
      splitVariant: str(components?.mediaTextVariant) || "split-wide-image",
    },
    footer: {
      columnCount: footerEvidence?.columnCount || footer?.columnCount || 4,
      columnWidths: str(footerEvidence?.columnWidths) || "2.2fr 1fr 1.15fr 1.5fr",
      showLogo: Boolean(footerEvidence?.showLogo ?? footer?.showLogo),
      nhsBadge: Boolean((footerEvidence?.badges || []).length),
      nhsBadgeLabel: (footerEvidence?.badges || [])[0] || "",
      gphcRowExpected: Boolean(footerEvidence?.hasRegulatoryRow),
      openingHoursRows: 7,
      openingHoursLayout: str(footerEvidence?.openingHoursLayout) || "table",
      contactIcons: Boolean(footerEvidence?.hasContactBlock),
      socialIcons: Boolean(footerEvidence?.hasSocialLinks),
      quickLinkCount: footerQuickLinks,
      legalLinkCount: footerLegalLinks,
      legalBar: Boolean(footerEvidence?.hasLegalLinks && footerEvidence?.hasCopyrightRow),
      backToTop: Boolean(footerEvidence?.backToTop),
      background: str(footerEvidence?.background) || semantic.footerBackground,
      bottomBarBackground: str(footerEvidence?.bottomBarBackground) || semantic.footerBottomBarBackground,
      footerVariant: str(components?.footerVariant) || "four-column-contact",
    },
    map: {
      variant: str(components?.mapContactVariant) || "split-map-details",
      minHeightPx: parseLogoPx(str("maps" in brand && brand.maps?.minHeight ? brand.maps.minHeight : "320px")),
      borderRadius: str("maps" in brand && brand.maps?.borderRadius ? brand.maps.borderRadius : "10px"),
      panelBackground: semantic.mapPanelBackground,
    },
    image: {
      treatment: str(components?.imageTreatmentVariant) || "rounded-balanced",
      heroMaxHeightPx: 520,
      inlineMaxHeightPx: 360,
      borderRadius: str(surfaces?.cardRadius) || str(imagery?.imageRadius) || "10px",
      objectFit: str(imagery?.objectFit) || "cover",
      heroAspectRatio: str(imagery?.heroAspectRatio) || "4/3",
    },
    responsive: {
      desktopBreakpoint: str("responsive" in brand && brand.responsive?.stackNavBelow ? brand.responsive.stackNavBelow : "980px"),
      mobileHeaderVariant: str(components?.mobileHeaderVariant) || "stacked-nav",
      stackCardsBelow: str("responsive" in brand && brand.responsive?.stackCardsBelow ? brand.responsive.stackCardsBelow : "980px"),
    },
    colours: {
      primaryAction: semantic.primaryAction,
      headingPrimary: semantic.headingPrimary,
      bodyText: semantic.bodyText,
      headerBackground: semantic.headerBackground,
      topBarBackground: semantic.topBarBackground,
      footerBackground: semantic.footerBackground,
      footerText: semantic.footerText,
      pageBackground: semantic.pageBackground,
    },
    typography: {
      headingFont: str(brand.typography?.headingFont),
      bodyFont: str(brand.typography?.bodyFont),
      h1Size: str(typographyRoles?.h1?.fontSize || brand.typography?.h1Scale),
      h2Size: str(typographyRoles?.h2?.fontSize || brand.typography?.h2Scale),
      bodySize: str(typographyRoles?.body?.fontSize || brand.typography?.bodySize),
      navSize: str(typographyRoles?.navigation?.fontSize || "14px"),
    },
  };
}
