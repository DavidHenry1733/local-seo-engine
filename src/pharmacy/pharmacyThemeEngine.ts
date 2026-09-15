/**
 * Profile-driven pharmacy theme — single source of truth for visual service page branding.
 * Uses imported profile colours as-is; NHS blue is not remapped to green.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";

import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { resolveBrandDnaRenderTokens } from "./pharmacyBrandDnaRenderTokens.ts";

export const PHARMACY_VISUAL_PIPELINE_VERSION = "consolidated-v1";

/** Fixed NHS informational colour — badges and kicker accents only. */
export const NHS_INFORMATIONAL_BLUE = "#005eb8";

/** Large sections that must not use solid brand-primary/secondary backgrounds. */
export const LARGE_SECTION_BACKGROUND_SELECTORS = [
  "hero",
  "cta-band",
  "money-page-band",
  "blue-band",
  "impact",
  "final",
  "conversion-image-section",
] as const;

export function sectionCssBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`\\.${escaped}\\{[^}]+\\}`, "i"))?.[0] ?? "";
}

/** True when a section rule uses brand blue as a large-area background fill. */
export function sectionUsesSolidBrandBlueBackground(css: string, selector: string): boolean {
  const block = sectionCssBlock(css, selector);
  if (!block) return false;
  return /background[^:]*:[^;]*var\(--brand-(primary|secondary)\)/i.test(block);
}

export interface PharmacyTheme {
  pharmacyName: string;
  logoUrl: string;
  phone: string;
  primaryColor: string;
  secondaryColor: string;
  ctaColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  headingColor: string;
  sectionBackground: string;
  fontHeading: string;
  fontBody: string;
  buttonRadius: string;
  cardRadius: string;
  healthcareTeal: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  footerLinkColor: string;
  footerAccentColor: string;
  brandDna?: BrandDnaV1;
}

export function normalizeHex(color: string, fallback: string): string {
  const v = String(color ?? "").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  return fallback;
}

function darkenHex(hex: string, amount: number): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const r = Math.max(0, Math.round(parseInt(m[1], 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(m[2], 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(m[3], 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Resolve page chrome colours directly from profile — no LSE default remapping. */
export function buildPharmacyTheme(profile: PharmacyServicePageProfile): PharmacyTheme {
  const primary = normalizeHex(profile.brandPrimaryColor, "#005EB8");
  const secondary = normalizeHex(profile.brandSecondaryColor, darkenHex(primary, 0.22));
  const cta = normalizeHex(profile.brandCtaColor, primary);
  const accent = normalizeHex(profile.brandAccentColor, "#007A7A");
  const background = normalizeHex(profile.brandBackgroundColor, "#ffffff");
  const sectionBackground = "#f8fafc";
  const headingColor = normalizeHex(profile.brandTextColor, "#1F2933");
  const text = headingColor;
  const muted = normalizeHex(profile.brandMutedTextColor, "#5F6C7B");

  const headerBackgroundColor = normalizeHex(profile.brandHeaderBackgroundColor, background);
  const headerTextColor = normalizeHex(profile.brandHeaderTextColor, text);
  const footerBackgroundColor = normalizeHex(profile.brandFooterBackgroundColor, headingColor);
  const footerTextColor = normalizeHex(profile.brandFooterTextColor, "#ffffff");
  const footerLinkColor = normalizeHex(profile.brandFooterLinkColor, footerTextColor);
  const footerAccentColor = normalizeHex(profile.brandFooterAccentColor, "#cbd5e1");

  return {
    pharmacyName: profile.pharmacyName,
    logoUrl: profile.logoUrl,
    phone: profile.phone,
    primaryColor: primary,
    secondaryColor: secondary,
    ctaColor: cta,
    accentColor: accent,
    backgroundColor: background,
    sectionBackground,
    textColor: text,
    mutedTextColor: muted,
    headingColor,
    fontHeading: String(profile.fontHeading || "Open Sans").trim() || "Open Sans",
    fontBody: String(profile.fontBody || "Open Sans").trim() || "Open Sans",
    buttonRadius: String(profile.buttonRadius || "14px").trim() || "14px",
    cardRadius: String(profile.cardRadius || "26px").trim() || "26px",
    healthcareTeal: accent,
    headerBackgroundColor,
    headerTextColor,
    footerBackgroundColor,
    footerTextColor,
    footerLinkColor,
    footerAccentColor,
  };
}

export function pharmacyThemeRootCss(theme: PharmacyTheme): string {
  const dna = theme.brandDna;
  const tokenSlug = dna?.slug || "pharmaconnect";
  const tokenCss = resolveBrandDnaRenderTokens(tokenSlug).css;
  const sectionPadding = dna?.surfaces.sectionPadding || "84px";
  const heroPadding = dna?.surfaces.heroPadding || "96px";
  const h1Scale = dna?.typography.h1Scale || "clamp(2.2rem,5vw,3.5rem)";
  const h2Scale = dna?.typography.h2Scale || "clamp(1.75rem,3.5vw,2.5rem)";
  const h3Size = dna?.typography.h3Size || "22px";
  const bodySize = dna?.typography.bodySize || "17px";
  const headingWeight = dna?.typography.headingWeight || "700";
  const bodyWeight = dna?.typography.bodyWeight || "400";
  const logoMaxHeight = dna?.layout.logoMaxHeight || "48px";
  const iconRadius = dna?.surfaces.iconRadius || "14px";
  const trustRadius = dna?.trustCta.trustCardRadius || theme.cardRadius;

  return `${tokenCss}
:root{
  --brand-primary:${theme.primaryColor};
  --brand-secondary:${theme.secondaryColor};
  --brand-cta:${theme.ctaColor};
  --brand-button-text:${dna?.colours.buttonText || "#ffffff"};
  --brand-accent:${theme.accentColor};
  --brand-background:${theme.backgroundColor};
  --brand-text:${theme.textColor};
  --brand-muted:${theme.mutedTextColor};
  --brand-heading:${theme.headingColor};
  --page-background:${theme.backgroundColor};
  --section-background:${theme.sectionBackground};
  --header-bg:${theme.headerBackgroundColor};
  --header-text:${theme.headerTextColor};
  --footer-bg:${theme.footerBackgroundColor};
  --footer-text:${theme.footerTextColor};
  --footer-link:${theme.footerLinkColor};
  --footer-accent:${theme.footerAccentColor};
  --ink:${theme.textColor};
  --navy:${theme.headingColor};
  --blue:var(--brand-primary);
  --pharmacy-cta:var(--brand-cta);
  --nhs:${NHS_INFORMATIONAL_BLUE};
  --healthcare-teal:${theme.healthcareTeal};
  --soft:var(--section-background);
  --soft2:color-mix(in srgb,var(--brand-accent) 10%,white);
  --line:#e2e8f0;
  --text:${theme.textColor};
  --muted:${theme.mutedTextColor};
  --white:#fff;
  --page-bg:var(--page-background);
  --heading-font:var(--brand-font-heading,'${theme.fontHeading.replace(/'/g, "")}',system-ui,sans-serif);
  --body-font:var(--brand-font-body,'${theme.fontBody.replace(/'/g, "")}',system-ui,sans-serif);
  --font-heading:var(--heading-font);
  --font-body:var(--body-font);
  --btn-radius:${theme.buttonRadius};
  --radius:${theme.cardRadius};
  --section-padding:${sectionPadding};
  --hero-padding:${heroPadding};
  --h1-scale:${h1Scale};
  --h2-scale:${h2Scale};
  --h3-size:${h3Size};
  --body-size:${bodySize};
  --heading-weight:${headingWeight};
  --body-weight:${bodyWeight};
  --logo-max-height:${logoMaxHeight};
  --icon-radius:${iconRadius};
  --trust-radius:${trustRadius};
  --shadow:0 22px 55px rgba(26,51,71,.11);
  --shadow2:0 10px 26px rgba(26,51,71,.08);
}`;
}
