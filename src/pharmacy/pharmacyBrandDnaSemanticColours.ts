/**
 * Resolve semantic colour roles from style evidence — never assume primary = heading.
 */
import type { BrandDnaSemanticColours, BrandDnaStyleEvidenceSample } from "./pharmacyBrandDnaSemanticTypes.ts";
import type { BrandDnaColours } from "./pharmacyBrandDnaTypes.ts";
import { normalizeHex } from "./pharmacyThemeEngine.ts";
import { resolveBrandButtonColor } from "./pharmacyBrandButtonColorResolver.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function sampleValue(samples: BrandDnaStyleEvidenceSample[], role: string, property?: string): string {
  const hit = samples.find((s) => s.role === role && (!property || s.property.includes(property)));
  return str(hit?.computedValue);
}

export interface SemanticColourInput {
  samples: BrandDnaStyleEvidenceSample[];
  cssVars: Record<string, string>;
  hasTopBar: boolean;
  defaults: BrandDnaSemanticColours;
}

function cssVar(vars: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = str(vars[key.toLowerCase()]);
    if (val && /^#/.test(val)) return val;
  }
  return "";
}

export function buildDefaultSemanticColours(base: BrandDnaColours): BrandDnaSemanticColours {
  return {
    pageBackground: base.background,
    surface: base.sectionBackground,
    headingPrimary: base.heading,
    headingSecondary: base.secondary,
    bodyText: base.body,
    mutedText: base.muted,
    primaryAction: resolveBrandButtonColor({
      button: base.button,
      primary: base.primary,
      accent: base.accent,
      secondary: base.secondary,
    }),
    primaryActionText: base.buttonText,
    secondaryAction: base.secondary,
    secondaryActionText: "#ffffff",
    link: base.secondary,
    iconPrimary: base.primary,
    iconSecondary: base.secondary,
    border: "color-mix(in srgb, var(--brand-text) 12%, white)",
    topBarBackground: base.primary,
    topBarText: "#ffffff",
    headerBackground: "#ffffff",
    headerText: base.heading,
    footerBackground: base.footerBackground,
    footerText: base.footerText,
    footerLink: base.footerLink,
    footerBottomBarBackground: base.footerBackground,
    trustBackground: base.sectionBackground,
    cardBackground: "#ffffff",
    mapPanelBackground: base.sectionBackground,
  };
}

export function resolveSemanticColours(input: SemanticColourInput): BrandDnaSemanticColours {
  const { samples, cssVars, hasTopBar, defaults } = input;

  const headingPrimary =
    sampleValue(samples, "h1", "color") ||
    cssVar(cssVars, "heading-color", "black-dark-color") ||
    defaults.headingPrimary;
  const bodyText = sampleValue(samples, "paragraph", "color") || cssVar(cssVars, "text-color") || defaults.bodyText;
  const primaryAction =
    sampleValue(samples, "primary-button", "background") || cssVar(cssVars, "main-color", "primary-color") || defaults.primaryAction;
  const iconPrimary = sampleValue(samples, "icon", "color") || primaryAction;
  const iconSecondary = sampleValue(samples, "secondary-button", "background") || cssVar(cssVars, "secondary-color") || defaults.iconSecondary;
  const headingSecondary = iconSecondary;
  const topBarBackground = hasTopBar
    ? sampleValue(samples, "top-bar", "background") || primaryAction
    : defaults.topBarBackground;
  const topBarText = sampleValue(samples, "top-bar-text", "color") || "#ffffff";
  const headerBackground = hasTopBar
    ? sampleValue(samples, "main-header", "background") || cssVar(cssVars, "white-color") || "#ffffff"
    : sampleValue(samples, "main-header", "background") || defaults.headerBackground;
  const headerText = sampleValue(samples, "navigation-link", "color") || headingPrimary;
  const footerBackground = sampleValue(samples, "footer", "background") || defaults.footerBackground;
  const footerBottomBarBackground = sampleValue(samples, "footer-bottom", "background") || footerBackground;
  const footerText = sampleValue(samples, "footer-heading", "color") || "#ffffff";
  const footerLink = sampleValue(samples, "footer-link", "color") || footerText;
  const pageBackground = cssVar(cssVars, "bg-color", "gray-light-color", "white-color") || defaults.pageBackground;
  const surface = pageBackground;
  const primaryActionText = sampleValue(samples, "primary-button-text", "color") || "#ffffff";

  return {
    pageBackground: normalizeHex(pageBackground, defaults.pageBackground),
    surface: normalizeHex(surface, defaults.surface),
    headingPrimary: normalizeHex(headingPrimary, defaults.headingPrimary),
    headingSecondary: normalizeHex(headingSecondary, defaults.headingSecondary),
    bodyText: normalizeHex(bodyText, defaults.bodyText),
    mutedText: normalizeHex(bodyText, defaults.mutedText),
    primaryAction: normalizeHex(primaryAction, defaults.primaryAction),
    primaryActionText: normalizeHex(primaryActionText, defaults.primaryActionText),
    secondaryAction: normalizeHex(iconSecondary, defaults.secondaryAction),
    secondaryActionText: defaults.secondaryActionText,
    link: normalizeHex(iconSecondary, defaults.link),
    iconPrimary: normalizeHex(iconPrimary, defaults.iconPrimary),
    iconSecondary: normalizeHex(iconSecondary, defaults.iconSecondary),
    border: defaults.border,
    topBarBackground: normalizeHex(topBarBackground, defaults.topBarBackground),
    topBarText: normalizeHex(topBarText, defaults.topBarText),
    headerBackground: normalizeHex(headerBackground, defaults.headerBackground),
    headerText: normalizeHex(headerText, defaults.headerText),
    footerBackground: normalizeHex(footerBackground, defaults.footerBackground),
    footerText: normalizeHex(footerText, defaults.footerText),
    footerLink: normalizeHex(footerLink, defaults.footerLink),
    footerBottomBarBackground: normalizeHex(footerBottomBarBackground, defaults.footerBottomBarBackground),
    trustBackground: normalizeHex(surface, defaults.trustBackground),
    cardBackground: normalizeHex("#ffffff", defaults.cardBackground),
    mapPanelBackground: normalizeHex(surface, defaults.mapPanelBackground),
  };
}

/** Bridge semantic roles onto legacy colour fields consumed by existing renderers. */
export function bridgeSemanticToLegacyColours(semantic: BrandDnaSemanticColours): BrandDnaColours {
  return {
    primary: semantic.iconPrimary,
    secondary: semantic.headingSecondary,
    accent: semantic.iconSecondary,
    background: semantic.pageBackground,
    heading: semantic.headingPrimary,
    headingPrimary: semantic.headingPrimary,
    headingSecondary: semantic.headingSecondary,
    body: semantic.bodyText,
    muted: semantic.mutedText,
    button: semantic.primaryAction,
    buttonText: semantic.primaryActionText,
    headerBackground: semantic.headerBackground,
    headerText: semantic.headerText,
    footerBackground: semantic.footerBackground,
    footerText: semantic.footerText,
    footerLink: semantic.footerLink,
    footerAccent: semantic.footerLink,
    sectionBackground: semantic.surface,
    topBarBackground: semantic.topBarBackground,
    topBarText: semantic.topBarText,
  };
}

export function resolveSemanticFromLegacyColours(colours: BrandDnaColours): BrandDnaSemanticColours {
  return buildDefaultSemanticColours({
    ...colours,
    headingPrimary: colours.headingPrimary || colours.heading,
    headingSecondary: colours.headingSecondary || colours.secondary,
  });
}
