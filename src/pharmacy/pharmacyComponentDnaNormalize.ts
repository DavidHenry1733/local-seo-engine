/**
 * Component DNA safe bounds — extreme or invalid values fall back to proven defaults.
 */
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import { getPharmaConnectComponentDnaDefaults } from "./pharmacyComponentDnaDefaults.ts";

const LOGO_MIN_PX = 32;
const LOGO_MAX_PX = 56;
const NAV_GAP_MIN_PX = 8;
const NAV_GAP_MAX_PX = 28;
const CTA_GAP_MIN_PX = 6;
const CTA_GAP_MAX_PX = 16;
const HERO_PADDING_MIN_PX = 64;
const HERO_PADDING_MAX_PX = 96;
const IMAGE_MAX_HEIGHT_MIN_PX = 280;
const IMAGE_MAX_HEIGHT_MAX_PX = 560;
const CARD_COLUMNS_MIN = 1;
const CARD_COLUMNS_MAX = 4;
const CARD_GAP_MIN_PX = 16;
const CARD_GAP_MAX_PX = 32;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function parsePx(value: string, fallback: number): number {
  const match = str(value).match(/^([\d.]+)\s*px$/i);
  if (!match) return fallback;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : fallback;
}

export function clampPx(value: string, min: number, max: number, fallback: number): string {
  const parsed = parsePx(value, fallback);
  return `${Math.min(max, Math.max(min, parsed))}px`;
}

export function normalizeLogoMaxHeight(value: string, fallback = "48px"): string {
  const parsed = parsePx(value || fallback, parsePx(fallback, 48));
  if (!str(value) || parsed > LOGO_MAX_PX * 2) return `${LOGO_MAX_PX}px`;
  return clampPx(`${parsed}px`, LOGO_MIN_PX, LOGO_MAX_PX, parsePx(fallback, 48));
}

export function normalizeNavGap(value: string, fallback = "16px"): string {
  return clampPx(value || fallback, NAV_GAP_MIN_PX, NAV_GAP_MAX_PX, parsePx(fallback, 16));
}

export function normalizeCtaGap(value: string, fallback = "10px"): string {
  return clampPx(value || fallback, CTA_GAP_MIN_PX, CTA_GAP_MAX_PX, parsePx(fallback, 10));
}

export function normalizeHeroPaddingY(value: string, fallback = "96px"): string {
  return clampPx(value || fallback, HERO_PADDING_MIN_PX, HERO_PADDING_MAX_PX, parsePx(fallback, 96));
}

export function normalizeImageMaxHeight(value: string, fallback = "520px"): string {
  return clampPx(value || fallback, IMAGE_MAX_HEIGHT_MIN_PX, IMAGE_MAX_HEIGHT_MAX_PX, parsePx(fallback, 520));
}

export function normalizeCardColumns(value: number, fallback = 3): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(CARD_COLUMNS_MAX, Math.max(CARD_COLUMNS_MIN, Math.round(value)));
}

export function normalizeFooterColumnWidths(value: string, variant: string, fallback: string): string {
  const normalized = str(value);
  if (!normalized) return fallback;
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (variant === "four-column-contact" && parts.length !== 4) {
    return "2.2fr 1fr 1.15fr 1.5fr";
  }
  if (variant === "three-column" && parts.length !== 3) {
    return "2fr 1fr 1.2fr";
  }
  if (variant === "compact" && parts.length !== 2) {
    return "1fr 1fr";
  }
  return normalized;
}

export function normalizeComponentDna(dna: ComponentDna): ComponentDna {
  const defaults = getPharmaConnectComponentDnaDefaults();
  const footerVariant = dna.footer.variant || dna.variants.footerVariant;
  return {
    ...dna,
    header: {
      ...dna.header,
      logoMaxHeight: normalizeLogoMaxHeight(dna.header.logoMaxHeight, defaults.header.logoMaxHeight),
      navGap: normalizeNavGap(dna.header.navGap, defaults.header.navGap),
      ctaGap: normalizeCtaGap(dna.header.ctaGap, defaults.header.ctaGap),
      desktopBreakpoint: str(dna.header.desktopBreakpoint) || defaults.header.desktopBreakpoint,
      mobileBreakpoint: str(dna.header.mobileBreakpoint) || defaults.header.mobileBreakpoint,
    },
    footer: {
      ...dna.footer,
      columnWidths: normalizeFooterColumnWidths(
        dna.footer.columnWidths,
        footerVariant,
        defaults.footer.columnWidths,
      ),
      columnGap: clampPx(dna.footer.columnGap || defaults.footer.columnGap, 24, 48, 40),
    },
    hero: {
      ...dna.hero,
      paddingY: normalizeHeroPaddingY(dna.hero.paddingY, defaults.hero.paddingY),
      gap: clampPx(dna.hero.gap || defaults.hero.gap, 24, 56, 48),
    },
    image: {
      ...dna.image,
      maxHeight: normalizeImageMaxHeight(dna.image.maxHeight, defaults.image.maxHeight),
    },
    card: {
      ...dna.card,
      columns: normalizeCardColumns(dna.card.columns, defaults.card.columns),
      gap: clampPx(dna.card.gap || defaults.card.gap, CARD_GAP_MIN_PX, CARD_GAP_MAX_PX, 22),
    },
    cta: {
      ...dna.cta,
      buttonRadius: clampPx(dna.cta.buttonRadius || defaults.cta.buttonRadius, 8, 20, 14),
      headerPrimary: { ...defaults.cta.headerPrimary, ...dna.cta.headerPrimary },
      headerSecondary: { ...defaults.cta.headerSecondary, ...dna.cta.headerSecondary },
    },
    contact: { ...defaults.contact, ...dna.contact },
  };
}
