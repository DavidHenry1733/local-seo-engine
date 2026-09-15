/**
 * TENANT-BRAND-IDENTITY-CONNECTION-43A
 *
 * One authoritative tenant-brand record for Product Owner confirmation.
 * Resolution order: PO-confirmed → uploaded tenant asset → Brand DNA → commercial baseline.
 * Polluted #000000 header/footer profile values never override Brand DNA.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { COMMERCIAL_BLUE_UI_TOKENS } from "./pharmacyCommercialBlueUiBaseline.ts";
import { loadBrandDnaV1File } from "./pharmacyBrandDnaStore.ts";
import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { normalizeHex } from "./pharmacyThemeEngine.ts";
import {
  getPharmacyTenantBrandIdentityPath,
  PHARMACY_WORKSPACE_ROOT,
  safePharmacySlug,
} from "./pharmacyWorkspacePaths.ts";

export const TENANT_BRAND_IDENTITY_CONTRACT_ID = "pharmaconnect-tenant-brand-identity-v1";
export const TENANT_BRAND_IDENTITY_OVERLAY_MARKER = "pharmaconnect-tenant-brand-identity-overlay-v1";

export type TenantBrandFieldSource =
  | "po-confirmed"
  | "uploaded-tenant-asset"
  | "brand-dna"
  | "commercial-baseline";

export type TenantBrandConfirmationStatus = "unconfirmed" | "confirmed";

export interface TenantBrandField<T = string> {
  value: T;
  source: TenantBrandFieldSource;
  evidenceSource: string;
  confidence: number;
}

export interface TenantBrandIdentityResolved {
  slug: string;
  contractId: typeof TENANT_BRAND_IDENTITY_CONTRACT_ID;
  revision: string;
  confirmationStatus: TenantBrandConfirmationStatus;
  confirmedAt: string | null;
  logoUrl: TenantBrandField;
  primaryColor: TenantBrandField;
  secondaryColor: TenantBrandField;
  accentColor: TenantBrandField;
  headingFont: TenantBrandField;
  bodyFont: TenantBrandField;
  headingFontStack: string;
  bodyFontStack: string;
  googleFontsHref: string;
}

export interface TenantBrandIdentityRecord {
  version: typeof TENANT_BRAND_IDENTITY_CONTRACT_ID;
  slug: string;
  confirmationStatus: TenantBrandConfirmationStatus;
  confirmedAt: string | null;
  updatedAt: string;
  uploadedLogoUrl: string;
  fields: {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headingFont: string;
    bodyFont: string;
  };
}

export interface TenantBrandConfirmInput {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  headingFont?: string;
  bodyFont?: string;
}

const BASELINE_PRIMARY = COMMERCIAL_BLUE_UI_TOKENS.primary;
const BASELINE_SECONDARY = COMMERCIAL_BLUE_UI_TOKENS.secondary;
const BASELINE_ACCENT = "#1ca9c9";
const BASELINE_HEADING_FONT = "Poppins";
const BASELINE_BODY_FONT = "Inter";

/** Fonts already available from the locked commercial web source (Google Fonts Poppins + Inter). */
const APPROVED_AVAILABLE_WEB_FONTS = new Set(["poppins", "inter"]);
const SAFE_FONT_RE = /^[a-zA-Z][a-zA-Z0-9 -]{0,60}$/;

const LOGO_DIR = path.join(PHARMACY_WORKSPACE_ROOT, "assets/pharmacy-logos");

export function isPollutedBlackHex(value: string): boolean {
  const hex = String(value || "").trim().toLowerCase();
  if (!hex) return false;
  if (hex === "black" || hex === "rgb(0,0,0)" || hex === "rgba(0,0,0,1)") return true;
  const compact = hex.replace(/^#/, "");
  return /^0+$/.test(compact) && (compact.length === 3 || compact.length === 6 || compact.length === 8);
}

function firstFontName(value: string): string {
  return String(value || "")
    .split(",")[0]
    ?.replace(/['"]/g, "")
    .trim() || "";
}

export function isSafeApprovedAvailableFont(value: string): boolean {
  const name = firstFontName(value);
  if (!name || !SAFE_FONT_RE.test(name)) return false;
  if (/system-ui|sans-serif|serif|monospace|cursive|fantasy/i.test(name)) return false;
  return APPROVED_AVAILABLE_WEB_FONTS.has(name.toLowerCase());
}

function usableColor(value: string, fallback: string): string {
  const hex = normalizeHex(String(value || "").trim(), "");
  if (!hex || isPollutedBlackHex(hex)) return fallback;
  return hex;
}

function field<T>(value: T, source: TenantBrandFieldSource, evidenceSource: string, confidence: number): TenantBrandField<T> {
  return { value, source, evidenceSource, confidence };
}

export function findUploadedTenantLogoUrl(slug: string): string {
  const key = safePharmacySlug(slug);
  if (!fs.existsSync(LOGO_DIR)) return "";
  const exts = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
  for (const ext of exts) {
    const file = path.join(LOGO_DIR, `${key}${ext}`);
    if (fs.existsSync(file)) return `/assets/pharmacy-logos/${key}${ext}`;
  }
  return "";
}

export function loadTenantBrandIdentityRecord(slug: string): TenantBrandIdentityRecord | null {
  const file = getPharmacyTenantBrandIdentityPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as TenantBrandIdentityRecord;
    if (raw?.version !== TENANT_BRAND_IDENTITY_CONTRACT_ID) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveTenantBrandIdentityRecord(record: TenantBrandIdentityRecord): string {
  const file = getPharmacyTenantBrandIdentityPath(record.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2), "utf8");
  return file;
}

function dnaConfidence(dna: BrandDnaV1 | null, key: "logo" | "colours" | "fonts"): number {
  const n = Number(dna?.confidence?.[key]);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function revisionFor(resolved: Omit<TenantBrandIdentityResolved, "revision">): string {
  const payload = {
    logo: resolved.logoUrl.value,
    primary: resolved.primaryColor.value,
    secondary: resolved.secondaryColor.value,
    accent: resolved.accentColor.value,
    heading: resolved.headingFont.value,
    body: resolved.bodyFont.value,
    status: resolved.confirmationStatus,
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function fontStackFor(name: string, fallbackName: string): string {
  const safe = firstFontName(name) || fallbackName;
  return `'${safe.replace(/'/g, "")}', system-ui, -apple-system, Segoe UI, sans-serif`;
}

export function resolveTenantBrandIdentityFromParts(input: {
  slug: string;
  stored?: TenantBrandIdentityRecord | null;
  dna?: BrandDnaV1 | null;
}): TenantBrandIdentityResolved {
  const key = safePharmacySlug(input.slug);
  const stored = input.stored === undefined ? loadTenantBrandIdentityRecord(key) : input.stored;
  const dna = input.dna === undefined ? loadBrandDnaV1File(key) : input.dna;
  const uploadedLogo = stored?.uploadedLogoUrl || findUploadedTenantLogoUrl(key);

  const confirmed = stored?.confirmationStatus === "confirmed" ? stored.fields : null;

  let logoUrl = field("", "commercial-baseline", "no logo", 0);
  if (confirmed?.logoUrl) {
    logoUrl = field(confirmed.logoUrl, "po-confirmed", "Product Owner confirmed", 100);
  } else if (uploadedLogo) {
    logoUrl = field(uploadedLogo, "uploaded-tenant-asset", "uploaded tenant logo file", 95);
  } else if (dna?.logoUrl) {
    logoUrl = field(dna.logoUrl, "brand-dna", dna.sourceUrl || "brand-dna", dnaConfidence(dna, "logo"));
  }

  const dnaPrimary = usableColor(dna?.colours?.primary || "", "");
  const dnaSecondary = usableColor(dna?.colours?.secondary || "", "");
  const dnaAccent = usableColor(dna?.colours?.accent || dna?.colours?.button || "", "");
  const colourConf = dnaConfidence(dna, "colours");

  const primaryColor = confirmed?.primaryColor && !isPollutedBlackHex(confirmed.primaryColor)
    ? field(usableColor(confirmed.primaryColor, BASELINE_PRIMARY), "po-confirmed", "Product Owner confirmed", 100)
    : dnaPrimary
      ? field(dnaPrimary, "brand-dna", "brand-dna colours.primary", colourConf)
      : field(BASELINE_PRIMARY, "commercial-baseline", "commercial blue baseline", 100);

  const secondaryColor = confirmed?.secondaryColor && !isPollutedBlackHex(confirmed.secondaryColor)
    ? field(usableColor(confirmed.secondaryColor, BASELINE_SECONDARY), "po-confirmed", "Product Owner confirmed", 100)
    : dnaSecondary
      ? field(dnaSecondary, "brand-dna", "brand-dna colours.secondary", colourConf)
      : field(BASELINE_SECONDARY, "commercial-baseline", "commercial blue baseline", 100);

  const accentColor = confirmed?.accentColor && !isPollutedBlackHex(confirmed.accentColor)
    ? field(usableColor(confirmed.accentColor, BASELINE_ACCENT), "po-confirmed", "Product Owner confirmed", 100)
    : dnaAccent
      ? field(dnaAccent, "brand-dna", "brand-dna colours.accent", colourConf)
      : field(BASELINE_ACCENT, "commercial-baseline", "commercial baseline accent", 80);

  const dnaHeading = firstFontName(dna?.typography?.headingFont || "");
  const dnaBody = firstFontName(dna?.typography?.bodyFont || "");
  const fontConf = dnaConfidence(dna, "fonts");

  const headingFont = confirmed?.headingFont && isSafeApprovedAvailableFont(confirmed.headingFont)
    ? field(firstFontName(confirmed.headingFont), "po-confirmed", "Product Owner confirmed", 100)
    : isSafeApprovedAvailableFont(dnaHeading)
      ? field(dnaHeading, "brand-dna", "brand-dna typography.headingFont", fontConf)
      : field(BASELINE_HEADING_FONT, "commercial-baseline", "commercial baseline fonts (imported font unavailable or unsafe)", 100);

  const bodyFont = confirmed?.bodyFont && isSafeApprovedAvailableFont(confirmed.bodyFont)
    ? field(firstFontName(confirmed.bodyFont), "po-confirmed", "Product Owner confirmed", 100)
    : isSafeApprovedAvailableFont(dnaBody)
      ? field(dnaBody, "brand-dna", "brand-dna typography.bodyFont", fontConf)
      : field(BASELINE_BODY_FONT, "commercial-baseline", "commercial baseline fonts (imported font unavailable or unsafe)", 100);

  const googleFamilyName: Record<string, string> = { poppins: "Poppins", inter: "Inter" };
  const families = [...new Set([headingFont.value, bodyFont.value].map((n) => n.toLowerCase()))]
    .filter((n) => APPROVED_AVAILABLE_WEB_FONTS.has(n));
  const googleFontsHref = families.length
    ? `https://fonts.googleapis.com/css2?${families
        .map((n) => `family=${googleFamilyName[n] || n}:wght@400;600;700;800`)
        .join("&")}&display=swap`
    : "";

  const partial: Omit<TenantBrandIdentityResolved, "revision"> = {
    slug: key,
    contractId: TENANT_BRAND_IDENTITY_CONTRACT_ID,
    confirmationStatus: stored?.confirmationStatus === "confirmed" ? "confirmed" : "unconfirmed",
    confirmedAt: stored?.confirmedAt || null,
    logoUrl,
    primaryColor,
    secondaryColor,
    accentColor,
    headingFont,
    bodyFont,
    headingFontStack: fontStackFor(headingFont.value, BASELINE_HEADING_FONT),
    bodyFontStack: fontStackFor(bodyFont.value, BASELINE_BODY_FONT),
    googleFontsHref,
  };

  return { ...partial, revision: revisionFor(partial) };
}

export function resolveTenantBrandIdentity(slug: string): TenantBrandIdentityResolved {
  return resolveTenantBrandIdentityFromParts({ slug });
}

export function confirmTenantBrandIdentity(slug: string, input: TenantBrandConfirmInput = {}): TenantBrandIdentityResolved {
  const current = resolveTenantBrandIdentity(slug);
  const uploaded = findUploadedTenantLogoUrl(slug) || loadTenantBrandIdentityRecord(slug)?.uploadedLogoUrl || "";
  const now = new Date().toISOString();
  const record: TenantBrandIdentityRecord = {
    version: TENANT_BRAND_IDENTITY_CONTRACT_ID,
    slug: safePharmacySlug(slug),
    confirmationStatus: "confirmed",
    confirmedAt: now,
    updatedAt: now,
    uploadedLogoUrl: uploaded,
    fields: {
      logoUrl: String(input.logoUrl || uploaded || current.logoUrl.value || "").trim(),
      primaryColor: usableColor(String(input.primaryColor || current.primaryColor.value), BASELINE_PRIMARY),
      secondaryColor: usableColor(String(input.secondaryColor || current.secondaryColor.value), BASELINE_SECONDARY),
      accentColor: usableColor(String(input.accentColor || current.accentColor.value), BASELINE_ACCENT),
      headingFont: isSafeApprovedAvailableFont(String(input.headingFont || current.headingFont.value))
        ? firstFontName(String(input.headingFont || current.headingFont.value))
        : BASELINE_HEADING_FONT,
      bodyFont: isSafeApprovedAvailableFont(String(input.bodyFont || current.bodyFont.value))
        ? firstFontName(String(input.bodyFont || current.bodyFont.value))
        : BASELINE_BODY_FONT,
    },
  };
  saveTenantBrandIdentityRecord(record);
  return resolveTenantBrandIdentity(slug);
}

export function recordUploadedTenantLogo(slug: string, logoUrl: string): TenantBrandIdentityResolved {
  const key = safePharmacySlug(slug);
  const existing = loadTenantBrandIdentityRecord(key);
  const now = new Date().toISOString();
  const record: TenantBrandIdentityRecord = existing
    ? {
        ...existing,
        updatedAt: now,
        uploadedLogoUrl: logoUrl,
        fields: {
          ...existing.fields,
          logoUrl: existing.confirmationStatus === "confirmed" ? logoUrl : existing.fields.logoUrl || logoUrl,
        },
      }
    : {
        version: TENANT_BRAND_IDENTITY_CONTRACT_ID,
        slug: key,
        confirmationStatus: "unconfirmed",
        confirmedAt: null,
        updatedAt: now,
        uploadedLogoUrl: logoUrl,
        fields: {
          logoUrl,
          primaryColor: "",
          secondaryColor: "",
          accentColor: "",
          headingFont: "",
          bodyFont: "",
        },
      };
  saveTenantBrandIdentityRecord(record);
  return resolveTenantBrandIdentity(key);
}

export function buildTenantBrandOverlayCss(resolved: TenantBrandIdentityResolved): string {
  const p = resolved.primaryColor.value;
  const s = resolved.secondaryColor.value;
  const a = resolved.accentColor.value;
  return `/* ${TENANT_BRAND_IDENTITY_OVERLAY_MARKER} revision:${resolved.revision} */
:root{
--brand-primary:${p} !important;
--brand-secondary:${s} !important;
--brand-accent:${a} !important;
--brand-cta:${a} !important;
--blue:var(--brand-primary) !important;
--pharmacy-cta:var(--brand-cta) !important;
--brand-font-heading:${resolved.headingFontStack} !important;
--brand-font-body:${resolved.bodyFontStack} !important;
--font-heading:var(--brand-font-heading) !important;
--font-body:var(--brand-font-body) !important;
--heading-font:var(--brand-font-heading) !important;
}
`;
}
