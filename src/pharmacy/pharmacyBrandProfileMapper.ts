/**
 * Maps Local SEO Engine BrandProfile ↔ PharmaConnect pharmacy profile.
 * Explicit field mapping — no implicit object spreading for brand colours.
 */
import type { BrandProfile } from "../generator/brandImporter.ts";
import type { PharmacyProfileData, ProfileFooterLink, ProfileNavLink } from "./pharmacyProfileSchema.ts";

function isPlausiblePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function colorField(value: unknown, fallback = ""): string {
  const v = str(value);
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback;
}

function mapNavLinks(brand: Partial<BrandProfile>): ProfileNavLink[] {
  return (brand.navigationLinks || []).map((l, i) => ({
    label: str(l.label) || `Link ${i + 1}`,
    url: str(l.href) || "#",
    order: i + 1,
    visible: true,
  }));
}

function mapFooterLinks(brand: Partial<BrandProfile>): ProfileFooterLink[] {
  return (brand.footerLinks || []).map((l, i) => ({
    label: str(l.label),
    url: str(l.href) || "#",
    order: i + 1,
  })).filter((l) => l.label);
}

export function mapBrandProfileToPharmacyData(
  brand: Partial<BrandProfile>,
  existing?: Partial<PharmacyProfileData>,
): Partial<PharmacyProfileData> {
  const primary = colorField(brand.primaryColour);
  const secondary = colorField(brand.secondaryColour);
  const cta = colorField(brand.buttonColour) || primary;
  const accent = colorField(brand.accentColour);
  const background = colorField(brand.backgroundColour, "#ffffff");
  const heading = colorField(brand.headingColour) || colorField(brand.bodyTextColour, "#1F2933");
  const body = colorField(brand.bodyTextColour, "#5F6C7B");
  const muted = body && body !== heading ? body : colorField(existing?.brandMutedTextColor, "#5F6C7B");

  const logoUrl = str(brand.logoUrl) || str(existing?.logoUrl);
  const faviconUrl = str(brand.faviconUrl) || str(existing?.faviconUrl);
  const navLinks = mapNavLinks(brand);
  const footerLinks = mapFooterLinks(brand);
  const ctaText = str(brand.ctaText) || str(existing?.headerCtaText) || str(existing?.preferredCta);
  const ctaUrl = str(brand.ctaUrl) || str(existing?.headerCtaUrl) || str(existing?.website) || "#contact";

  const patch: Partial<PharmacyProfileData> = {
    logoUrl,
    faviconUrl,
    brandPrimaryColor: primary,
    brandSecondaryColor: secondary || (primary ? darkenHex(primary, 0.22) : ""),
    brandCtaColor: cta,
    brandAccentColor: accent,
    brandBackgroundColor: background,
    brandTextColor: heading,
    brandMutedTextColor: muted,
    brandHeaderBackgroundColor: colorField(brand.headerBackgroundColour) || str(existing?.brandHeaderBackgroundColor),
    brandHeaderTextColor: colorField(brand.headerTextColour) || str(existing?.brandHeaderTextColor),
    brandFooterBackgroundColor: colorField(brand.footerBackgroundColour) || str(existing?.brandFooterBackgroundColor),
    brandFooterTextColor: colorField(brand.footerTextColour) || str(existing?.brandFooterTextColor),
    brandFooterLinkColor: colorField(brand.footerLinkColour) || str(existing?.brandFooterLinkColor),
    brandFooterAccentColor: colorField(brand.footerAccentColour) || str(existing?.brandFooterAccentColor),
    fontHeading: str(brand.headingFont) || str(existing?.fontHeading),
    fontBody: str(brand.bodyFont) || str(existing?.fontBody),
    headerLogoUrl: logoUrl,
    footerLogoUrl: logoUrl,
    headerNavLinks: navLinks.length ? navLinks : existing?.headerNavLinks,
    footerLinks: footerLinks.length ? footerLinks : existing?.footerLinks,
    website: str(brand.sourceUrl) || str(existing?.website),
    headerCtaText: ctaText,
    headerCtaUrl: ctaUrl,
    preferredCta: ctaText || str(existing?.preferredCta),
  };

  if (str(brand.contact?.phone) && isPlausiblePhone(str(brand.contact?.phone))) {
    patch.phone = str(brand.contact?.phone);
  }
  if (str(brand.contact?.email)) patch.businessEmail = str(brand.contact?.email);
  if (str(brand.businessName) && !str(existing?.pharmacyName)) patch.pharmacyName = str(brand.businessName);
  if (str(brand.businessName) && !str(existing?.tradingName)) patch.tradingName = str(brand.businessName);

  return patch;
}

function darkenHex(hex: string, amount: number): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const r = Math.max(0, Math.round(parseInt(m[1], 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(m[2], 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(m[3], 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Build a BrandProfile view from saved pharmacy profile (for panel reload). */
export function mapPharmacyDataToBrandProfile(data: Partial<PharmacyProfileData>): Partial<BrandProfile> {
  return {
    sourceUrl: data.website || "",
    fetchedAt: "",
    businessName: data.pharmacyName || data.tradingName || "",
    logoUrl: data.logoUrl || "",
    faviconUrl: data.faviconUrl || "",
    primaryColour: data.brandPrimaryColor || "",
    secondaryColour: data.brandSecondaryColor || "",
    accentColour: data.brandAccentColor || "",
    backgroundColour: data.brandBackgroundColor || "",
    headingColour: data.brandTextColor || "",
    bodyTextColour: data.brandMutedTextColor || data.brandTextColor || "",
    buttonColour: data.brandCtaColor || "",
    buttonTextColour: "#ffffff",
    headerBackgroundColour: data.brandHeaderBackgroundColor || "",
    headerTextColour: data.brandHeaderTextColor || "",
    footerBackgroundColour: data.brandFooterBackgroundColor || "",
    footerTextColour: data.brandFooterTextColor || "",
    footerLinkColour: data.brandFooterLinkColor || "",
    footerAccentColour: data.brandFooterAccentColor || "",
    headingFont: data.fontHeading || "",
    bodyFont: data.fontBody || "",
    navigationLinks: (data.headerNavLinks || []).map((l) => ({ label: l.label, href: l.url })),
    footerLinks: (data.footerLinks || []).map((l) => ({ label: l.label, href: l.url })),
    ctaText: data.headerCtaText || data.preferredCta || "",
    ctaUrl: data.headerCtaUrl || data.website || "",
    contact: {
      phone: data.phone || "",
      email: data.businessEmail || "",
      address: [data.addressLine1, data.townCity, data.postcode].filter(Boolean).join(", "),
    },
    confidence: { logo: 0, colours: 0, fonts: 0, contact: 0 },
    warnings: [],
    approved: false,
  };
}
