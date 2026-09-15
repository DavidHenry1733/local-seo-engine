/**
 * Brand DNA → render tokens adapter.
 * Resolves tenant Brand DNA once and exposes safe CSS custom properties for all renderers.
 */
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import type { BrandDNA } from "./pharmacyBrandDnaTypes.ts";
import { normalizeHex } from "./pharmacyThemeEngine.ts";
import { resolveBrandButtonColor } from "./pharmacyBrandButtonColorResolver.ts";
import { resolveSemanticFromLegacyColours } from "./pharmacyBrandDnaSemanticColours.ts";
import { resolveSiteChromeColourTokens } from "./pharmacySiteChromeColourService.ts";
import { resolveEffectiveSectionSpacing, hasActivatedTenantDesignDna } from "./pharmacyTenantDnaRenderActivation.ts";

const HEADING_FALLBACK = "system-ui, -apple-system, Segoe UI, sans-serif";
const BODY_FALLBACK = "system-ui, -apple-system, Segoe UI, sans-serif";

export interface BrandDnaRenderTokens {
  slug: string;
  hasTenantDna: boolean;
  css: string;
}

export function fontStack(primary: string, fallback = BODY_FALLBACK): string {
  const name = String(primary || "")
    .split(",")[0]
    ?.replace(/['"]/g, "")
    .trim();
  if (!name || /system-ui|sans-serif|serif/i.test(name)) return fallback;
  return `'${name.replace(/'/g, "")}', ${fallback}`;
}

function resolveBrand(slug: string, dna?: BrandDNA | null): BrandDNA {
  if (dna && "spacing" in dna) return dna;
  return resolveBrandDnaForRender(slug);
}

function resolveSemantic(brand: BrandDNA) {
  if (brand.semanticColours) return brand.semanticColours;
  return resolveSemanticFromLegacyColours(brand.colours);
}

/** Convert stored Brand DNA into CSS custom properties for shared renderers. */
export function resolveBrandDnaRenderTokens(slug: string, dna?: BrandDNA | null): BrandDnaRenderTokens {
  const brand = resolveBrand(slug, dna);
  const hasTenantDna = Boolean(brand.provenance?.websiteImport || brand.provenance?.customerOverrides);
  const semantic = resolveSemantic(brand);

  const primary = normalizeHex(brand.colours.primary, "#005EB8");
  const secondary = normalizeHex(semantic.headingSecondary, brand.colours.secondary || primary);
  const accent = normalizeHex(brand.colours.accent, semantic.iconSecondary || secondary);
  const actionBase = normalizeHex(
    resolveBrandButtonColor({
      button: brand.colours.button,
      primary: brand.colours.primary,
      accent: brand.colours.accent,
      secondary: brand.colours.secondary,
    }),
    primary,
  );
  const background = normalizeHex(semantic.pageBackground, "#ffffff");
  const surface = normalizeHex(semantic.surface, "#f8fafc");
  const heading = normalizeHex(semantic.headingPrimary, "#1F2933");
  const headingPrimary = normalizeHex(semantic.headingPrimary, heading);
  const headingSecondary = normalizeHex(semantic.headingSecondary, secondary);
  const text = normalizeHex(semantic.bodyText, heading);
  const muted = normalizeHex(semantic.mutedText, "#5F6C7B");
  const border = semantic.border || "color-mix(in srgb, var(--brand-text) 12%, white)";

  const sectionSpacing = hasActivatedTenantDesignDna(slug)
    ? resolveEffectiveSectionSpacing(slug, brand)
    : brand.spacing.sectionY;

  const chromeColours = hasActivatedTenantDesignDna(slug) ? resolveSiteChromeColourTokens(slug, brand) : null;
  const headerBg = chromeColours?.headerBackground || normalizeHex(semantic.headerBackground, "#ffffff");
  const headerText = chromeColours?.headerText || normalizeHex(semantic.headerText, heading);
  const footerBg = chromeColours?.upperFooterBackground || normalizeHex(semantic.footerBackground, heading);
  const footerBottomBg = chromeColours?.lowerFooterBackground || normalizeHex(semantic.footerBottomBarBackground, semantic.footerBackground);
  const footerText = chromeColours?.footerTextColour || normalizeHex(semantic.footerText, "#ffffff");
  const footerLink = chromeColours?.footerLinkColour || normalizeHex(semantic.footerLink, semantic.footerText);
  const action = chromeColours?.ctaBackground || actionBase;
  const actionText = chromeColours?.ctaText || normalizeHex(semantic.primaryActionText, "#ffffff");

  const css = `:root{
  --brand-primary:${primary};
  --brand-secondary:${secondary};
  --brand-accent:${accent};
  --brand-background:${background};
  --brand-surface:${surface};
  --brand-text:${text};
  --brand-heading:${heading};
  --brand-heading-primary:${headingPrimary};
  --brand-heading-secondary:${headingSecondary};
  --brand-muted:${muted};
  --brand-border:${border};
  --brand-container-width:${brand.spacing.containerMax};
  --brand-section-spacing:${sectionSpacing};
  --brand-section-x:${brand.spacing.sectionX};
  --brand-content-gap:${brand.spacing.contentGap};
  --brand-stack-gap:${brand.spacing.stackGap};
  --brand-inline-gap:${brand.spacing.inlineGap};
  --brand-radius-button:${brand.buttons.radius};
  --brand-radius-card:${brand.cards.radius};
  --brand-radius-image:${brand.imagery.imageRadius};
  --brand-radius-nav-logo:min(${brand.layout.logoMaxHeight}, 64px);
  --brand-font-heading:${fontStack(brand.typography.headingFont, HEADING_FALLBACK)};
  --brand-font-body:${fontStack(brand.typography.bodyFont, BODY_FALLBACK)};
  --brand-button-weight:${brand.buttons.weight};
  --brand-button-min-height:${brand.buttons.minHeight};
  --brand-button-padding-x:${brand.buttons.paddingX};
  --brand-button-padding-y:${brand.buttons.paddingY};
  --brand-card-border:${brand.cards.border};
  --brand-card-shadow:${brand.cards.shadow};
  --brand-card-padding:${brand.cards.padding};
  --brand-card-gap:${brand.cards.gap};
  --brand-top-bar-bg:${normalizeHex(semantic.topBarBackground, primary)};
  --brand-top-bar-text:${normalizeHex(semantic.topBarText, "#ffffff")};
  --header-bg:${headerBg};
  --header-text:${headerText};
  --brand-nav-bg:${headerBg};
  --brand-nav-text:${headerText};
  --brand-footer-bg:${footerBg};
  --brand-footer-text:${footerText};
  --brand-footer-link:${footerLink};
  --brand-footer-accent:${normalizeHex(brand.colours.footerAccent, footerText)};
  --brand-footer-bottom-bg:${footerBottomBg};
  --brand-action:${action};
  --brand-action-text:${actionText};
  --brand-icon-primary:${normalizeHex(semantic.iconPrimary, primary)};
  --brand-icon-secondary:${normalizeHex(semantic.iconSecondary, secondary)};
  --brand-map-min-height:${brand.maps.minHeight};
  --brand-map-radius:${brand.maps.borderRadius};
  --brand-map-border:${brand.maps.border};
  --brand-map-shadow:${brand.maps.shadow};
  --brand-shadow-sm:${brand.shadows.sm};
  --brand-shadow-md:${brand.shadows.md};
  --brand-shadow-lg:${brand.shadows.lg};
  --brand-responsive-md:${brand.responsive.breakpointMd};
  --brand-responsive-sm:${brand.responsive.breakpointSm};
}`;

  return { slug, hasTenantDna, css };
}
