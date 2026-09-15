/**
 * Sprint 5H — Visual Fidelity Engine.
 * Post-render comparison: imported website evidence (Brand DNA) vs generated HTML output.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { buildImportedVisualBaseline } from "./pharmacyVisualFidelityImportedBaseline.ts";
import { extractGeneratedVisualMetrics } from "./pharmacyVisualFidelityHtmlExtract.ts";
import {
  averageScores,
  buildCheck,
  checkToIssue,
  isCommercialReady,
  scoreBoolean,
  scoreCount,
  scoreExact,
  scoreNumeric,
} from "./pharmacyVisualFidelityScoring.ts";
import type {
  ImportedVisualBaseline,
  GeneratedVisualMetrics,
  VisualFidelityCheck,
  VisualFidelityComponentComparison,
  VisualFidelityDimensionScores,
  VisualFidelityReport,
} from "./pharmacyVisualFidelityTypes.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { VISUAL_EXPERIENCE_ROOT } from "./pharmacyVisualExperienceConfig.ts";

function compareSection(
  component: VisualFidelityCheck["component"],
  pairs: Array<{
    id: string;
    dimension: VisualFidelityCheck["dimension"];
    label: string;
    imported: string | number | boolean;
    generated: string | number | boolean;
    scoreFn?: "exact" | "numeric" | "boolean" | "count";
    recommendation?: string;
  }>,
): VisualFidelityCheck[] {
  return pairs.map((pair) => {
    let score = 100;
    if (pair.scoreFn === "numeric") score = scoreNumeric(pair.imported, pair.generated);
    else if (pair.scoreFn === "boolean") score = scoreBoolean(Boolean(pair.imported), Boolean(pair.generated));
    else if (pair.scoreFn === "count") score = scoreCount(Number(pair.imported), Number(pair.generated));
    else score = scoreExact(pair.imported, pair.generated);

    return buildCheck({
      id: pair.id,
      component,
      dimension: pair.dimension,
      label: pair.label,
      imported: pair.imported,
      generated: pair.generated,
      score,
      recommendation: pair.recommendation,
    });
  });
}

function buildHeaderChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("header", [
    {
      id: "header-top-bar",
      dimension: "headerFidelity",
      label: "Top information bar",
      imported: imported.header.topInformationBar,
      generated: generated.header.topInformationBar,
      scoreFn: "boolean",
    },
    {
      id: "header-variant",
      dimension: "headerFidelity",
      label: "Header variant",
      imported: imported.header.headerVariant,
      generated: generated.header.headerVariant,
    },
    {
      id: "header-logo-height",
      dimension: "headerFidelity",
      label: "Logo max height",
      imported: `${imported.header.logoMaxHeightPx}px`,
      generated: String(generated.header.logoMaxHeightPx),
      scoreFn: "numeric",
      recommendation: "Use safe logo size variant within Component DNA bounds (32–56px).",
    },
    {
      id: "header-logo-alignment",
      dimension: "layoutFidelity",
      label: "Logo alignment",
      imported: imported.header.logoAlignment,
      generated: generated.header.logoAlignment,
    },
    {
      id: "header-nav-count",
      dimension: "headerFidelity",
      label: "Navigation link count",
      imported: imported.header.navigationLinkCount,
      generated: generated.header.navigationLinkCount,
      scoreFn: "count",
    },
    {
      id: "header-cta-count",
      dimension: "headerFidelity",
      label: "CTA count",
      imported: imported.header.ctaCount,
      generated: generated.header.ctaCount,
      scoreFn: "count",
    },
    {
      id: "header-cta-order",
      dimension: "headerFidelity",
      label: "CTA order",
      imported: imported.header.ctaOrder,
      generated: generated.header.ctaOrder,
    },
    {
      id: "header-cta-gap",
      dimension: "spacingFidelity",
      label: "CTA spacing",
      imported: imported.header.ctaGapPx,
      generated: generated.header.ctaGapPx,
      scoreFn: "numeric",
    },
    {
      id: "header-nav-gap",
      dimension: "spacingFidelity",
      label: "Navigation spacing",
      imported: `${imported.header.navigationGapPx}px`,
      generated: String(generated.header.navigationGapPx),
      scoreFn: "numeric",
    },
    {
      id: "header-container-width",
      dimension: "layoutFidelity",
      label: "Header container width",
      imported: imported.header.containerWidth,
      generated: generated.header.containerWidth,
    },
    {
      id: "header-bg-colour",
      dimension: "colourFidelity",
      label: "Header background colour",
      imported: imported.header.headerBackground,
      generated: generated.header.headerBackground,
    },
    {
      id: "header-topbar-colour",
      dimension: "colourFidelity",
      label: "Top bar background colour",
      imported: imported.header.topBarBackground,
      generated: generated.header.topBarBackground,
    },
    {
      id: "header-sticky",
      dimension: "responsiveFidelity",
      label: "Sticky header behaviour",
      imported: imported.header.stickyHeader,
      generated: generated.header.stickyHeader,
      scoreFn: "boolean",
    },
  ]);
}

function buildHeroChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("hero", [
    {
      id: "hero-layout",
      dimension: "heroFidelity",
      label: "Hero layout",
      imported: imported.hero.layout,
      generated: generated.hero.layout,
    },
    {
      id: "hero-variant",
      dimension: "heroFidelity",
      label: "Hero variant",
      imported: imported.hero.heroVariant,
      generated: generated.hero.heroVariant,
    },
    {
      id: "hero-text-ratio",
      dimension: "layoutFidelity",
      label: "Hero text column ratio",
      imported: imported.hero.textColumnRatio,
      generated: generated.hero.textColumnRatio,
    },
    {
      id: "hero-image-ratio",
      dimension: "layoutFidelity",
      label: "Hero image column ratio",
      imported: imported.hero.imageColumnRatio,
      generated: generated.hero.imageColumnRatio,
    },
    {
      id: "hero-gap",
      dimension: "spacingFidelity",
      label: "Hero spacing",
      imported: `${imported.hero.gapPx}px`,
      generated: `${generated.hero.gapPx}px`,
      scoreFn: "numeric",
    },
    {
      id: "hero-image-radius",
      dimension: "imageFidelity",
      label: "Hero image radius",
      imported: imported.hero.imageRadius,
      generated: generated.hero.imageRadius,
      scoreFn: "numeric",
    },
    {
      id: "hero-cta-placement",
      dimension: "heroFidelity",
      label: "Hero CTA placement",
      imported: imported.hero.ctaPlacement,
      generated: generated.hero.ctaPlacement,
    },
  ]);
}

function buildContentChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("content", [
    {
      id: "content-section-padding",
      dimension: "spacingFidelity",
      label: "Section vertical spacing",
      imported: imported.content.sectionPaddingY,
      generated: generated.content.sectionPaddingY,
      scoreFn: "numeric",
    },
    {
      id: "content-container-width",
      dimension: "layoutFidelity",
      label: "Content container width",
      imported: imported.content.containerWidth,
      generated: generated.content.containerWidth,
    },
    {
      id: "content-card-columns",
      dimension: "cardFidelity",
      label: "Service card columns",
      imported: imported.content.cardColumns,
      generated: Number(generated.content.cardColumns),
      scoreFn: "count",
    },
    {
      id: "content-process-columns",
      dimension: "layoutFidelity",
      label: "Process step columns",
      imported: imported.content.processColumns,
      generated: Number(generated.content.processColumns),
      scoreFn: "count",
    },
    {
      id: "content-misconception-columns",
      dimension: "cardFidelity",
      label: "Misconception pair columns",
      imported: imported.content.misconceptionColumns,
      generated: Number(generated.content.misconceptionColumns),
      scoreFn: "count",
    },
    {
      id: "content-trust-variant",
      dimension: "layoutFidelity",
      label: "Trust section variant",
      imported: imported.content.trustVariant,
      generated: generated.content.trustVariant,
    },
    {
      id: "content-faq-variant",
      dimension: "layoutFidelity",
      label: "FAQ layout variant",
      imported: imported.content.faqVariant,
      generated: generated.content.faqVariant,
    },
    {
      id: "content-section-flow",
      dimension: "layoutFidelity",
      label: "Section flow variant",
      imported: imported.content.sectionFlow,
      generated: generated.content.sectionFlow,
    },
    {
      id: "content-split-variant",
      dimension: "layoutFidelity",
      label: "Media/text split variant",
      imported: imported.content.splitVariant,
      generated: generated.content.splitVariant,
    },
  ]);
}

function buildFooterChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("footer", [
    {
      id: "footer-variant",
      dimension: "footerFidelity",
      label: "Footer variant",
      imported: imported.footer.footerVariant,
      generated: generated.footer.footerVariant,
    },
    {
      id: "footer-column-count",
      dimension: "footerFidelity",
      label: "Footer column count",
      imported: imported.footer.columnCount,
      generated: generated.footer.columnCount,
      scoreFn: "count",
      recommendation: "Restore Footer Variant four-column-contact.",
    },
    {
      id: "footer-column-widths",
      dimension: "footerFidelity",
      label: "Footer column widths",
      imported: imported.footer.columnWidths,
      generated: generated.footer.columnWidths,
    },
    {
      id: "footer-logo",
      dimension: "footerFidelity",
      label: "Footer brand logo",
      imported: imported.footer.showLogo,
      generated: generated.footer.showLogo,
      scoreFn: "boolean",
    },
    {
      id: "footer-nhs-badge",
      dimension: "footerFidelity",
      label: "NHS services badge",
      imported: imported.footer.nhsBadge,
      generated: generated.footer.nhsBadge,
      scoreFn: "boolean",
    },
    {
      id: "footer-opening-hours-rows",
      dimension: "footerFidelity",
      label: "Opening hours rows",
      imported: imported.footer.openingHoursRows,
      generated: generated.footer.openingHoursRows,
      scoreFn: "count",
    },
    {
      id: "footer-opening-hours-layout",
      dimension: "footerFidelity",
      label: "Opening hours layout",
      imported: imported.footer.openingHoursLayout,
      generated: generated.footer.openingHoursLayout,
    },
    {
      id: "footer-contact-icons",
      dimension: "footerFidelity",
      label: "Contact icon rows",
      imported: imported.footer.contactIcons,
      generated: generated.footer.contactIcons,
      scoreFn: "boolean",
    },
    {
      id: "footer-quick-links",
      dimension: "footerFidelity",
      label: "Quick link count",
      imported: imported.footer.quickLinkCount,
      generated: generated.footer.quickLinkCount,
      scoreFn: "count",
    },
    {
      id: "footer-legal-bar",
      dimension: "footerFidelity",
      label: "Legal bottom bar",
      imported: imported.footer.legalBar,
      generated: generated.footer.legalBar,
      scoreFn: "boolean",
    },
    {
      id: "footer-legal-links",
      dimension: "footerFidelity",
      label: "Legal link count",
      imported: imported.footer.legalLinkCount,
      generated: generated.footer.legalLinkCount,
      scoreFn: "count",
    },
    {
      id: "footer-back-to-top",
      dimension: "footerFidelity",
      label: "Back-to-top control",
      imported: imported.footer.backToTop,
      generated: generated.footer.backToTop,
      scoreFn: "boolean",
    },
    {
      id: "footer-background",
      dimension: "colourFidelity",
      label: "Footer background colour",
      imported: imported.footer.background,
      generated: generated.footer.background,
    },
    {
      id: "footer-bottom-bar-bg",
      dimension: "colourFidelity",
      label: "Footer bottom bar background",
      imported: imported.footer.bottomBarBackground,
      generated: generated.footer.bottomBarBackground,
    },
  ]);
}

function buildMapChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("map", [
    {
      id: "map-variant",
      dimension: "layoutFidelity",
      label: "Map/contact variant",
      imported: imported.map.variant,
      generated: generated.map.variant,
    },
    {
      id: "map-min-height",
      dimension: "layoutFidelity",
      label: "Map minimum height",
      imported: `${imported.map.minHeightPx}px`,
      generated: String(generated.map.minHeightPx),
      scoreFn: "numeric",
    },
    {
      id: "map-border-radius",
      dimension: "imageFidelity",
      label: "Map border radius",
      imported: imported.map.borderRadius,
      generated: generated.map.borderRadius,
      scoreFn: "numeric",
    },
    {
      id: "map-section-present",
      dimension: "layoutFidelity",
      label: "Map section present",
      imported: true,
      generated: Boolean(generated.map.hasMapSection),
      scoreFn: "boolean",
    },
    {
      id: "map-iframe-present",
      dimension: "layoutFidelity",
      label: "Map iframe present",
      imported: imported.map.variant !== "details-only",
      generated: Boolean(generated.map.hasMapIframe),
      scoreFn: "boolean",
    },
    {
      id: "map-panel-background",
      dimension: "colourFidelity",
      label: "Map panel background",
      imported: imported.map.panelBackground,
      generated: generated.map.panelBackground,
    },
  ]);
}

function buildImageChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("image", [
    {
      id: "image-treatment",
      dimension: "imageFidelity",
      label: "Image treatment variant",
      imported: imported.image.treatment,
      generated: generated.image.treatment,
    },
    {
      id: "image-hero-max-height",
      dimension: "imageFidelity",
      label: "Hero image max height",
      imported: `${imported.image.heroMaxHeightPx}px`,
      generated: String(generated.image.heroMaxHeightPx),
      scoreFn: "numeric",
    },
    {
      id: "image-inline-max-height",
      dimension: "imageFidelity",
      label: "Inline image max height",
      imported: `${imported.image.inlineMaxHeightPx}px`,
      generated: String(generated.image.inlineMaxHeightPx),
      scoreFn: "numeric",
    },
    {
      id: "image-border-radius",
      dimension: "imageFidelity",
      label: "Image border radius",
      imported: imported.image.borderRadius,
      generated: generated.image.borderRadius,
      scoreFn: "numeric",
    },
    {
      id: "image-object-fit",
      dimension: "imageFidelity",
      label: "Image object-fit",
      imported: imported.image.objectFit,
      generated: generated.image.objectFit,
    },
  ]);
}

function buildColourChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("header", [
    {
      id: "colour-primary-action",
      dimension: "colourFidelity",
      label: "Primary action colour",
      imported: imported.colours.primaryAction,
      generated: generated.colours.primaryAction,
    },
    {
      id: "colour-heading",
      dimension: "colourFidelity",
      label: "Heading colour",
      imported: imported.colours.headingPrimary,
      generated: generated.colours.headingPrimary,
    },
    {
      id: "colour-body-text",
      dimension: "colourFidelity",
      label: "Body text colour",
      imported: imported.colours.bodyText,
      generated: generated.colours.bodyText,
    },
    {
      id: "colour-page-background",
      dimension: "colourFidelity",
      label: "Page background colour",
      imported: imported.colours.pageBackground,
      generated: generated.colours.pageBackground,
    },
    {
      id: "colour-footer-text",
      dimension: "colourFidelity",
      label: "Footer text colour",
      imported: imported.colours.footerText,
      generated: generated.colours.footerText,
    },
  ]);
}

function buildTypographyChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("content", [
    {
      id: "typography-heading-font",
      dimension: "typographyFidelity",
      label: "Heading font family",
      imported: imported.typography.headingFont,
      generated: generated.typography.headingFont,
    },
    {
      id: "typography-body-font",
      dimension: "typographyFidelity",
      label: "Body font family",
      imported: imported.typography.bodyFont,
      generated: generated.typography.bodyFont,
    },
    {
      id: "typography-nav-size",
      dimension: "typographyFidelity",
      label: "Navigation font size",
      imported: imported.typography.navSize,
      generated: generated.typography.navSize,
      scoreFn: "numeric",
    },
  ]);
}

function buildResponsiveChecks(imported: ImportedVisualBaseline, generated: GeneratedVisualMetrics): VisualFidelityCheck[] {
  return compareSection("responsive", [
    {
      id: "responsive-desktop-breakpoint",
      dimension: "responsiveFidelity",
      label: "Desktop breakpoint",
      imported: imported.responsive.desktopBreakpoint,
      generated: generated.responsive.desktopBreakpoint,
    },
    {
      id: "responsive-mobile-header",
      dimension: "responsiveFidelity",
      label: "Mobile header variant",
      imported: imported.responsive.mobileHeaderVariant,
      generated: generated.responsive.mobileHeaderVariant,
    },
    {
      id: "responsive-mobile-stack-rules",
      dimension: "responsiveFidelity",
      label: "Mobile collapse rules",
      imported: true,
      generated: generated.responsive.hasMobileNavStackRules,
      scoreFn: "boolean",
    },
  ]);
}

function aggregateDimensions(allChecks: VisualFidelityCheck[]): VisualFidelityDimensionScores {
  const byDimension = (dimension: keyof VisualFidelityDimensionScores) =>
    averageScores(allChecks.filter((c) => c.dimension === dimension).map((c) => c.score));

  const dimensions: VisualFidelityDimensionScores = {
    headerFidelity: byDimension("headerFidelity"),
    footerFidelity: byDimension("footerFidelity"),
    typographyFidelity: byDimension("typographyFidelity"),
    colourFidelity: byDimension("colourFidelity"),
    spacingFidelity: byDimension("spacingFidelity"),
    layoutFidelity: byDimension("layoutFidelity"),
    cardFidelity: byDimension("cardFidelity"),
    heroFidelity: byDimension("heroFidelity"),
    imageFidelity: byDimension("imageFidelity"),
    responsiveFidelity: byDimension("responsiveFidelity"),
    overallBrandFidelity: 0,
  };

  dimensions.overallBrandFidelity = averageScores([
    dimensions.headerFidelity,
    dimensions.footerFidelity,
    dimensions.typographyFidelity,
    dimensions.colourFidelity,
    dimensions.spacingFidelity,
    dimensions.layoutFidelity,
    dimensions.cardFidelity,
    dimensions.heroFidelity,
    dimensions.imageFidelity,
    dimensions.responsiveFidelity,
  ]);

  return dimensions;
}

function componentComparison(
  component: VisualFidelityCheck["component"],
  checks: VisualFidelityCheck[],
): VisualFidelityComponentComparison {
  const issues = checks.map(checkToIssue).filter(Boolean);
  return {
    component,
    checks,
    score: averageScores(checks.map((c) => c.score)),
    issues: issues as NonNullable<ReturnType<typeof checkToIssue>>[],
  };
}

function deterministicHash(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function resolveVisualFidelityHtmlPath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, VISUAL_EXPERIENCE_ROOT, slug, serviceId, "index.html");
}

export function runVisualFidelityEngine(input: {
  slug: string;
  serviceId: string;
  htmlPath?: string;
  html?: string;
}): VisualFidelityReport {
  const htmlPath = input.htmlPath || resolveVisualFidelityHtmlPath(input.slug, input.serviceId);
  const html = input.html ?? fs.readFileSync(htmlPath, "utf8");
  const brand = resolveBrandDnaForRender(input.slug);
  const imported = buildImportedVisualBaseline(brand);
  const generated = extractGeneratedVisualMetrics(html);

  const headerChecks = buildHeaderChecks(imported, generated);
  const heroChecks = buildHeroChecks(imported, generated);
  const contentChecks = buildContentChecks(imported, generated);
  const footerChecks = buildFooterChecks(imported, generated);
  const mapChecks = buildMapChecks(imported, generated);
  const imageChecks = buildImageChecks(imported, generated);
  const colourChecks = buildColourChecks(imported, generated);
  const typographyChecks = buildTypographyChecks(imported, generated);
  const responsiveChecks = buildResponsiveChecks(imported, generated);

  const allChecks = [
    ...headerChecks,
    ...heroChecks,
    ...contentChecks,
    ...footerChecks,
    ...mapChecks,
    ...imageChecks,
    ...colourChecks,
    ...typographyChecks,
    ...responsiveChecks,
  ];

  const components: VisualFidelityComponentComparison[] = [
    componentComparison("header", headerChecks),
    componentComparison("hero", heroChecks),
    componentComparison("content", [...contentChecks, ...typographyChecks]),
    componentComparison("footer", footerChecks),
    componentComparison("map", mapChecks),
    componentComparison("image", imageChecks),
    componentComparison("responsive", responsiveChecks),
  ];

  const dimensions = aggregateDimensions(allChecks);
  const issues = allChecks.map(checkToIssue).filter(Boolean) as VisualFidelityReport["issues"];

  const scorePayload = {
    slug: input.slug,
    serviceId: input.serviceId,
    dimensions,
    checkScores: allChecks.map((c) => ({ id: c.id, score: c.score })),
  };

  return {
    slug: input.slug,
    serviceId: input.serviceId,
    htmlPath,
    sourceUrl: str(brand.sourceUrl),
    comparedAt: new Date().toISOString(),
    components,
    dimensions,
    issues,
    commercialReady: isCommercialReady(dimensions as unknown as Record<string, number>),
    deterministicHash: deterministicHash(scorePayload),
  };
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

/** Stable report for deterministic validation — strips volatile timestamps. */
export function runVisualFidelityEngineDeterministic(input: {
  slug: string;
  serviceId: string;
  htmlPath?: string;
  html?: string;
}): VisualFidelityReport {
  const report = runVisualFidelityEngine(input);
  return { ...report, comparedAt: "deterministic" };
}
