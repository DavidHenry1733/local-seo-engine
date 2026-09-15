/**
 * Design Intelligence completeness scoring — objective field coverage, not render guesses.
 */
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";

export const DESIGN_INTELLIGENCE_MIN_COMPLETENESS = 95;

export interface DesignIntelligenceCompleteness {
  header: number;
  footer: number;
  layout: number;
  typography: number;
  components: number;
  navigation: number;
  imagery: number;
  overall: number;
  pass: boolean;
  missingFields: string[];
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function scoreFields(fields: Record<string, unknown>, weights?: Record<string, number>): { score: number; missing: string[] } {
  const keys = Object.keys(fields);
  if (!keys.length) return { score: 0, missing: ["no-fields"] };
  let total = 0;
  let earned = 0;
  const missing: string[] = [];
  for (const key of keys) {
    const w = weights?.[key] ?? 1;
    total += w;
    if (Boolean(str(fields[key])) || fields[key] === true || (typeof fields[key] === "number" && fields[key] > 0)) {
      earned += w;
    } else {
      missing.push(key);
    }
  }
  return { score: Math.round((earned / total) * 100), missing };
}

export function computeDesignIntelligenceCompleteness(evidence: WebsiteDesignEvidence | null): DesignIntelligenceCompleteness {
  if (!evidence) {
    return {
      header: 0,
      footer: 0,
      layout: 0,
      typography: 0,
      components: 0,
      navigation: 0,
      imagery: 0,
      overall: 0,
      pass: false,
      missingFields: ["design-evidence-missing"],
    };
  }

  const ext = evidence as WebsiteDesignEvidence & {
    layoutDna?: Record<string, unknown>;
    typographyDna?: Record<string, unknown>;
    componentModels?: unknown[];
    layoutMeta?: Record<string, unknown>;
  };

  const headerScore = scoreFields({
    logoUrl: evidence.header.logoUrl,
    logoSelector: evidence.header.logoSelector,
    logoMaxHeight: evidence.header.logoMaxHeight,
    backgroundColour: evidence.header.backgroundColour,
    textColour: evidence.header.textColour,
    rowCount: evidence.header.rowCount,
    hasTopBar: evidence.header.hasTopBar,
    navPlacement: evidence.header.navPlacement,
    paddingY: evidence.header.paddingY,
    paddingX: evidence.header.paddingX,
    sticky: evidence.header.sticky,
    desktopBreakpoint: evidence.header.desktopBreakpoint,
    mobileMenuBehaviour: evidence.header.mobileMenuBehaviour,
    borderColour: evidence.header.borderColour,
    headerHeight: ext.layoutMeta?.headerHeight,
    navItems: evidence.header.navItems.length,
    ctaLabels: evidence.header.ctaLabels.length || evidence.buttons.length,
  });

  const footerScore = scoreFields({
    columnCount: evidence.footer.columnCount,
    backgroundColour: evidence.footer.backgroundColour,
    textColour: evidence.footer.textColour,
    linkColour: evidence.footer.linkColour,
    paddingTop: evidence.footer.paddingTop,
    paddingBottom: evidence.footer.paddingBottom,
    columnGap: evidence.footer.columnGap,
    logoPlacement: evidence.footer.logoPlacement,
    quickLinks: evidence.footer.quickLinks.length,
    legalLinks: evidence.footer.legalLinks.length || evidence.footer.quickLinks.length,
    socialLinks: evidence.footer.socialLinks.length,
    copyrightText: evidence.footer.copyrightText,
    openingHoursPresent: evidence.footer.openingHoursPresent,
    contactBlockPresent: evidence.footer.contactBlockPresent,
    mapRelationship: evidence.footer.mapRelationship,
    mobileStackOrder: evidence.footer.mobileStackOrder.length,
    headingFontSize: evidence.footer.headingFontSize,
    bodyFontSize: evidence.footer.bodyFontSize,
  });

  const layoutScore = scoreFields({
    maxContentWidth: evidence.layout.maxContentWidth,
    sectionPaddingY: evidence.layout.sectionPaddingY,
    sectionPaddingX: evidence.layout.sectionPaddingX,
    gridGap: evidence.layout.gridGap,
    cardRadius: evidence.layout.cardRadius,
    cardShadow: evidence.layout.cardShadow,
    cardPadding: evidence.layout.cardPadding,
    heroTextRatio: evidence.layout.heroTextRatio,
    heroImageRatio: evidence.layout.heroImageRatio,
    heroGap: evidence.layout.heroGap,
    heroPaddingY: evidence.layout.heroPaddingY,
    whitespaceDensity: evidence.layout.whitespaceDensity,
    desktopBreakpoint: evidence.layout.breakpoints.desktop,
    tabletBreakpoint: evidence.layout.breakpoints.tablet,
    mobileBreakpoint: evidence.layout.breakpoints.mobile,
    h1Scale: evidence.layout.headingScale.h1,
    bodyScale: evidence.layout.headingScale.body,
    sectionCount: ext.layoutMeta?.sectionCount,
    heroHeight: ext.layoutMeta?.heroHeight,
    heroDisplay: ext.layoutMeta?.heroDisplay,
    containerWidth: ext.layoutMeta?.containerWidth,
  });

  const typo = evidence.typography;
  const typoExt = ext.typographyDna as Record<string, { fontFamily?: string; fontSize?: string }> | undefined;
  const typographyScore = scoreFields({
    bodyFamily: typo.body.fontFamily,
    bodySize: typo.body.fontSize,
    bodyWeight: typo.body.fontWeight,
    bodyLineHeight: typo.body.lineHeight,
    headingFamily: typo.heading.fontFamily,
    headingSize: typo.heading.fontSize,
    headingWeight: typo.heading.fontWeight,
    navFamily: typo.navigation.fontFamily,
    navSize: typo.navigation.fontSize,
    buttonFamily: typo.button.fontFamily,
    buttonSize: typo.button.fontSize,
    footerFamily: typo.footer.fontFamily,
    h1: typoExt?.h1?.fontFamily || evidence.layout.headingScale.h1,
    h2: typoExt?.h2?.fontFamily,
    h3: typoExt?.h3?.fontFamily,
    labelFamily: typoExt?.label?.fontFamily,
  });

  const navScore = scoreFields({
    items: evidence.navigation.items.length,
    hierarchyDepth: evidence.navigation.hierarchyDepth,
    labels: evidence.navigation.items.filter((i) => i.label).length,
    hrefs: evidence.navigation.items.filter((i) => i.href).length,
    dropdowns: evidence.navigation.items.filter((i) => i.isDropdown).length,
  });

  const componentScore = scoreFields({
    headerComponent: ext.componentModels?.some((c) => (c as { type?: string }).type === "header"),
    footerComponent: ext.componentModels?.some((c) => (c as { type?: string }).type === "footer"),
    heroComponent: ext.componentModels?.some((c) => (c as { type?: string }).type === "hero"),
    navComponent: ext.componentModels?.some((c) => (c as { type?: string }).type === "navigation"),
    announcementBar: ext.componentModels?.some((c) => (c as { type?: string }).type === "announcementBar"),
    buttons: evidence.buttons.length,
    cards: evidence.cards.length,
    map: evidence.map.present,
    openingHours: evidence.openingHours.rawText,
    contactBlocks: evidence.contactBlocks.length,
  }, {
    headerComponent: 2,
    footerComponent: 2,
    heroComponent: 2,
    navComponent: 2,
    announcementBar: 1,
    buttons: 1,
    cards: 1,
    map: 1,
    openingHours: 1,
    contactBlocks: 1,
  });

  const imageryScore = scoreFields({
    logo: evidence.header.logoUrl,
    heroImages: evidence.imagery.filter((i) => i.role === "hero").length,
    contentImages: evidence.imagery.length,
    importedAssets: evidence.assets.filter((a) => a.importStatus === "imported").length,
  });

  const scores = [headerScore.score, footerScore.score, layoutScore.score, typographyScore.score, componentScore.score, navScore.score, imageryScore.score];
  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const missingFields = [
    ...headerScore.missing.map((m) => `header.${m}`),
    ...footerScore.missing.map((m) => `footer.${m}`),
    ...layoutScore.missing.map((m) => `layout.${m}`),
    ...typographyScore.missing.map((m) => `typography.${m}`),
    ...componentScore.missing.map((m) => `component.${m}`),
  ];

  const pass =
    headerScore.score >= DESIGN_INTELLIGENCE_MIN_COMPLETENESS &&
    footerScore.score >= DESIGN_INTELLIGENCE_MIN_COMPLETENESS &&
    layoutScore.score >= DESIGN_INTELLIGENCE_MIN_COMPLETENESS &&
    typographyScore.score >= DESIGN_INTELLIGENCE_MIN_COMPLETENESS &&
    overall >= DESIGN_INTELLIGENCE_MIN_COMPLETENESS;

  return {
    header: headerScore.score,
    footer: footerScore.score,
    layout: layoutScore.score,
    typography: typographyScore.score,
    components: componentScore.score,
    navigation: navScore.score,
    imagery: imageryScore.score,
    overall,
    pass,
    missingFields,
  };
}

export function computeDesignIntelligenceCompletenessBeforeAfter(
  before: WebsiteDesignEvidence | null,
  after: WebsiteDesignEvidence | null,
): { before: number; after: number } {
  return {
    before: computeDesignIntelligenceCompleteness(before).overall,
    after: computeDesignIntelligenceCompleteness(after).overall,
  };
}
