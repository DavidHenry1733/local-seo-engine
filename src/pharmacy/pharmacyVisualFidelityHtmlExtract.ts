/**
 * Sprint 5H — extract structured visual metrics from generated HTML output.
 */
import * as cheerio from "cheerio";
import type { GeneratedVisualMetrics } from "./pharmacyVisualFidelityTypes.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function parseCssVariables(styleText: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(styleText))) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

function extractCssRuleValue(styleText: string, selector: string, property: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRe = new RegExp(`${escaped}[^{]*\\{([^}]+)\\}`, "i");
  const block = styleText.match(blockRe)?.[1] || "";
  const propRe = new RegExp(`${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`, "i");
  return str(block.match(propRe)?.[1]);
}

function extractLogoMaxHeight(styleText: string): string {
  const component = styleText.match(/--component-header-logo-max:([^;]+);/)?.[1]?.trim();
  if (component) return component.replace(/^min\(([^,]+),.*\)$/i, "$1").trim();
  const brand = styleText.match(/--brand-radius-nav-logo:([^;]+);/)?.[1]?.trim();
  if (brand) return brand.replace(/^min\(([^,]+),.*\)$/i, "$1").trim();
  return extractCssRuleValue(styleText, ".site-header .brand img", "max-height") || "48px";
}

export function extractGeneratedVisualMetrics(html: string): GeneratedVisualMetrics {
  const $ = cheerio.load(html);
  const styleText = $("style").toArray().map((el) => $(el).html() || "").join("\n");
  const cssVariables = parseCssVariables(styleText);
  const body = $("body");

  const navLinks = $("header .nav-links > a[href]").not(".nav-cta, .nav-cta-secondary");
  const ctaLinks = $("header .nav-links a.nav-cta, header .nav-links a.nav-cta-secondary");
  const footerCols = $(".site-footer .footer-col");
  const footerHoursRows = $(".site-footer .footer-hours-row");
  const footerQuickLinks = $(".site-footer .footer-col--links .footer-link-list a");
  const footerLegalLinks = $(".site-footer .footer-legal-links a");
  const footerBadges = $(".site-footer .footer-badge, .site-footer .footer-badge-image");
  const footerContactRows = $(".site-footer .footer-contact-row");
  const footerSocial = $(".site-footer .footer-social-link");
  const gphcRow = $(".site-footer .footer-contact-row").filter((_, el) => /gphc|1039201/i.test($(el).text()));

  const processGrid = $(".process-grid.grid-4");
  const misconceptionGrid = $(".card-grid-equal.grid-2, .grid-2.card-grid-equal");
  const cardVariant = str(body.attr("data-card-variant"));
  const cardColumns =
    cardVariant === "card-grid-two" ? "2" : cardVariant === "card-led-band" ? "1" : "3";

  const heroGrid = $(".hero .hero-grid, .hero-grid--split-left");
  const heroImage = $(".hero-image-wrap img, .hero .hero-image-wrap");
  const mapSection = $("#local-access, .pharmacy-local-grid, [data-template-block='map-contact']").first();
  const mapIframe = mapSection.find("iframe").first();

  const ctaOrder =
    ctaLinks.length >= 2
      ? ctaLinks.first().hasClass("nav-cta-secondary")
        ? "secondary-primary"
        : "primary-secondary"
      : ctaLinks.length === 1
        ? "primary-only"
        : "none";

  return {
    cssVariables,
    header: {
      headerHeightPx: parseInt(extractCssRuleValue(styleText, ".site-header .nav", "min-height") || "72", 10) || 72,
      logoMaxHeightPx: extractLogoMaxHeight(styleText),
      logoAlignment: str($("header.site-header").attr("data-logo-position")) || "left",
      navigationPosition: str($("header.site-header").attr("data-nav-style")) || "multi-link",
      navigationGapPx: str(cssVariables["--component-header-nav-gap"] || "16px"),
      navigationLinkCount: navLinks.length,
      ctaCount: ctaLinks.length,
      ctaOrder,
      ctaGapPx: str(cssVariables["--component-header-cta-gap"] || "10px"),
      containerWidth: str(cssVariables["--brand-container-width"] || "1200px"),
      topInformationBar: $(".site-top-bar").length > 0,
      stickyHeader: /position:\s*sticky/i.test(styleText) && $(".site-header").length > 0,
      headerVariant: str(body.attr("data-header-variant")),
      headerBackground: str(cssVariables["--header-bg"] || cssVariables["--brand-nav-bg"]),
      topBarBackground: str(cssVariables["--brand-top-bar-bg"]),
    },
    hero: {
      layout: heroGrid.length ? "split" : "single",
      heroVariant: str(body.attr("data-hero-variant")),
      textColumnRatio: str(cssVariables["--component-hero-text-ratio"] || "1.05fr"),
      imageColumnRatio: str(cssVariables["--component-hero-image-ratio"] || "0.95fr"),
      paddingY: str(cssVariables["--component-hero-padding-y"] || extractCssRuleValue(styleText, ".hero", "padding")),
      gapPx: parseInt(str(cssVariables["--component-hero-gap"] || "48").replace("px", ""), 10) || 48,
      imageRadius: str(cssVariables["--component-image-radius"] || cssVariables["--brand-radius-image"] || "10px"),
      ctaPlacement: $(".hero .btn, .hero a.nav-cta").length ? "hero-copy" : "none",
    },
    content: {
      sectionPaddingY: str(cssVariables["--brand-section-spacing"] || "72px"),
      containerWidth: str(cssVariables["--brand-container-width"] || "1200px"),
      cardColumns,
      processColumns: processGrid.length
        ? (styleText.match(/process-grid\.grid-4\{grid-template-columns:repeat\((\d+)/)?.[1] || "4")
        : "0",
      misconceptionColumns: misconceptionGrid.length ? "2" : "0",
      trustVariant: str(body.attr("data-trust-variant")),
      faqVariant: str(body.attr("data-faq-variant")),
      sectionFlow: str(body.attr("data-section-flow")),
      splitVariant: str(body.attr("data-split-variant")),
    },
    footer: {
      columnCount: footerCols.length,
      columnWidths:
        str($(".site-footer .footer-grid--four, .site-footer .footer-grid").first().attr("style"))
          .match(/--footer-column-widths:([^;]+)/)?.[1]
          ?.trim() ||
        str(cssVariables["--component-footer-columns"]) ||
        "",
      showLogo: $(".site-footer .footer-logo").length > 0,
      nhsBadge: footerBadges.length > 0,
      nhsBadgeLabel: str(footerBadges.first().text()),
      gphcRowExpected: gphcRow.length > 0,
      openingHoursRows: footerHoursRows.length,
      openingHoursLayout: $(".site-footer .footer-hours-table").length ? "table" : "block",
      contactIcons: footerContactRows.length > 0,
      socialIcons: footerSocial.length > 0,
      quickLinkCount: footerQuickLinks.length,
      legalLinkCount: footerLegalLinks.length,
      legalBar: $(".site-footer .footer-bottom-bar").length > 0,
      backToTop: $(".site-footer .footer-back-to-top").length > 0,
      background: str(cssVariables["--footer-bg"] || cssVariables["--brand-footer-bg"]),
      bottomBarBackground: str(cssVariables["--brand-footer-bottom-bg"]),
      footerVariant: str(body.attr("data-footer-variant")),
    },
    map: {
      variant: str(body.attr("data-map-contact-variant")),
      minHeightPx: (() => {
        const raw =
          extractCssRuleValue(styleText, ".pharmacy-map-card iframe", "min-height") ||
          cssVariables["--component-map-min-height"] ||
          cssVariables["--brand-map-min-height"] ||
          "320px";
        const varMatch = raw.match(/var\([^,]+,\s*([^)]+)\)/);
        return str(varMatch?.[1] || raw);
      })(),
      borderRadius: str(extractCssRuleValue(styleText, ".pharmacy-map-card iframe", "border-radius") || "10px"),
      panelBackground: str(cssVariables["--brand-map-panel-bg"] || cssVariables["--brand-surface"]),
      hasMapSection: mapSection.length > 0,
      hasMapIframe: mapIframe.length > 0,
    },
    image: {
      treatment: str(body.attr("data-image-treatment")),
      heroMaxHeightPx: str(extractCssRuleValue(styleText, ".hero-image-wrap", "max-height") || cssVariables["--component-image-max-height"] || "520px"),
      inlineMaxHeightPx: str(extractCssRuleValue(styleText, ".definition-split-media .image-panel", "max-height") || "360px"),
      borderRadius: str(cssVariables["--component-image-radius"] || cssVariables["--brand-radius-image"] || "10px"),
      objectFit: extractCssRuleValue(styleText, ".hero-image-wrap img", "object-fit") || "cover",
      heroAspectRatio: extractCssRuleValue(styleText, ".hero-image-wrap", "aspect-ratio") || "4/3",
    },
    responsive: {
      desktopBreakpoint: str(cssVariables["--component-header-desktop-breakpoint"] || "980px"),
      mobileHeaderVariant: str($("header.site-header").attr("data-mobile-header") || body.attr("data-mobile-header-variant")),
      stackCardsBelow: styleText.includes("@media (max-width:980px)") ? "980px" : "unknown",
      hasMobileNavStackRules: /header\[data-mobile-header="stacked-nav"\]|stacked-nav/.test(styleText),
    },
    colours: {
      primaryAction: str(cssVariables["--brand-action"] || cssVariables["--brand-primary"]),
      headingPrimary: str(cssVariables["--brand-heading-primary"] || cssVariables["--brand-heading"]),
      bodyText: str(cssVariables["--brand-text"]),
      headerBackground: str(cssVariables["--header-bg"] || cssVariables["--brand-nav-bg"]),
      topBarBackground: str(cssVariables["--brand-top-bar-bg"]),
      footerBackground: str(cssVariables["--footer-bg"] || cssVariables["--brand-footer-bg"]),
      footerText: str(cssVariables["--brand-footer-text"]),
      pageBackground: str(cssVariables["--brand-background"]),
    },
    typography: {
      headingFont: str(cssVariables["--brand-font-heading"]).replace(/['"]/g, "").split(",")[0],
      bodyFont: str(cssVariables["--brand-font-body"]).replace(/['"]/g, "").split(",")[0],
      h1Size: extractCssRuleValue(styleText, "h1", "font-size") || str(cssVariables["--brand-h1-scale"]),
      h2Size: extractCssRuleValue(styleText, "h2", "font-size") || "",
      bodySize: extractCssRuleValue(styleText, "body", "font-size") || "",
      navSize:
        extractCssRuleValue(styleText, ".site-header[data-nav-style=\"multi-link\"] .nav-links", "font-size") ||
        extractCssRuleValue(styleText, ".nav-links a", "font-size") ||
        "13px",
    },
  };
}
