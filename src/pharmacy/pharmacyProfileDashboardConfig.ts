/**
 * Profile Dashboard V1 — defaults, guided examples, and normalizers.
 */
import type { PharmacyProfileData, ProfileNavLink } from "./pharmacyProfileSchema.ts";

export interface ReviewerBioExample {
  id: string;
  title: string;
  bio: string;
  role: string;
  specialisms: string[];
}

export const DEFAULT_HEADER_NAV_LINKS: ProfileNavLink[] = [
  { label: "Home", url: "#", order: 1, visible: true },
  { label: "Services", url: "#split-section-one", order: 2, visible: true },
  { label: "NHS Services", url: "#split-section-one", order: 3, visible: true },
  { label: "Private Services", url: "#contact", order: 4, visible: true },
  { label: "About", url: "#local-access", order: 5, visible: true },
  { label: "Contact", url: "#contact", order: 6, visible: true },
];

export const REVIEWER_BIO_EXAMPLES: ReviewerBioExample[] = [
  {
    id: "community-pharmacy",
    title: "Community Pharmacy",
    role: "Superintendent Pharmacist",
    bio: "Our superintendent pharmacist has led clinical governance at this pharmacy for over 12 years, supporting patients with NHS Pharmacy First, medicines reviews and everyday health advice in the local community.",
    specialisms: ["Pharmacy First", "Minor illness", "Medicines support"],
  },
  {
    id: "nhs-services",
    title: "NHS Services",
    role: "Clinical Pharmacist",
    bio: "Our clinical team delivers NHS-commissioned pharmacy services including blood pressure monitoring, contraception consultations and vaccination appointments, with clear safety-netting and GP liaison when needed.",
    specialisms: ["NHS Pharmacy First", "Blood pressure checks", "Vaccinations"],
  },
  {
    id: "travel-health",
    title: "Travel Health",
    role: "Travel Health Pharmacist",
    bio: "Our travel health pharmacist provides destination-specific vaccination advice, antimalarial counselling and travel medicine consultations for patients planning trips abroad.",
    specialisms: ["Travel vaccinations", "Antimalarials", "Travel health counselling"],
  },
];

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function normalizeNavLinks(raw: unknown): ProfileNavLink[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_HEADER_NAV_LINKS.map((l) => ({ ...l }));
  return raw
    .map((item, idx) => {
      const row = item as Record<string, unknown>;
      return {
        label: str(row.label) || `Link ${idx + 1}`,
        url: str(row.url) || "#",
        order: Number(row.order) || idx + 1,
        visible: row.visible !== false,
      };
    })
    .sort((a, b) => a.order - b.order);
}

export interface ProfileFooterLink {
  label: string;
  url: string;
  order: number;
}

export function normalizeFooterLinks(raw: unknown): ProfileFooterLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      const row = item as Record<string, unknown>;
      return {
        label: str(row.label),
        url: str(row.url) || "#",
        order: Number(row.order) || idx + 1,
      };
    })
    .filter((l) => l.label)
    .sort((a, b) => a.order - b.order);
}

export function resolveHeaderLogo(data: Partial<PharmacyProfileData>): string {
  return str(data.headerLogoUrl) || str(data.logoUrl);
}

export function resolveFooterLogo(data: Partial<PharmacyProfileData>): string {
  return str(data.footerLogoUrl) || str(data.logoUrl);
}

export function resolveHeaderCtaText(data: Partial<PharmacyProfileData>): string {
  return str(data.headerCtaText) || str(data.preferredCta) || "Book Consultation";
}

export function resolveHeaderCtaUrl(data: Partial<PharmacyProfileData>): string {
  return str(data.headerCtaUrl) || str(data.bookingUrl) || "#contact";
}

export const DEFAULT_BRANDING = {
  brandPrimaryColor: "#005eb8",
  brandSecondaryColor: "#003087",
  brandCtaColor: "#005eb8",
  brandAccentColor: "#0d9488",
  brandBackgroundColor: "#ffffff",
  brandTextColor: "#142033",
  brandMutedTextColor: "#5d6b7f",
  /** Empty = fall back to page shell defaults at render time */
  brandHeaderBackgroundColor: "",
  brandHeaderTextColor: "",
  brandFooterBackgroundColor: "",
  brandFooterTextColor: "",
  brandFooterLinkColor: "",
  brandFooterAccentColor: "",
  fontHeading: "Poppins, system-ui, sans-serif",
  fontBody: "Inter, system-ui, sans-serif",
  fontHeadingWeight: "800",
  fontBodyWeight: "400",
  fontH1Size: "3.5rem",
  fontH2Size: "2.5rem",
  fontH3Size: "1.375rem",
  fontBodySize: "1.0625rem",
  buttonStyle: "rounded",
  buttonRadius: "14px",
  cardRadius: "26px",
  imageStyle: "rounded",
  pageStyle: "clinical-modern",
} as const;
