/**
 * Business Profile Wizard V2 — step definitions and per-step validation.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { collectServiceIdsFromProfile } from "./pharmacyProfileV2Fields.ts";
import { buildWizardImportFields } from "./pharmacyProfileWizardEnrichment.ts";

export const WIZARD_VERSION = 2;
export const WIZARD_TOTAL_STEPS = 8;

export interface WizardStepMeta {
  step: number;
  id: string;
  title: string;
  subtitle: string;
  why: string;
  estimatedMinutes: number;
}

export const WIZARD_STEPS: WizardStepMeta[] = [
  {
    step: 1,
    id: "import",
    title: "Import & Confirm",
    subtitle: "Website URL, Google Place and detected business info",
    why: "We import as much as possible from your existing website and Google Places so you confirm rather than retype.",
    estimatedMinutes: 3,
  },
  {
    step: 2,
    id: "basics",
    title: "Business Basics",
    subtitle: "Only fields we could not import confidently",
    why: "Fill gaps for contact, address or hours that were not found automatically.",
    estimatedMinutes: 3,
  },
  {
    step: 3,
    id: "brand",
    title: "Brand & Website Style",
    subtitle: "Logo, colours, header/footer and website preview",
    why: "Imported branding keeps generated pages aligned with your current site.",
    estimatedMinutes: 4,
  },
  {
    step: 4,
    id: "services",
    title: "Services",
    subtitle: "Detected services and how each works",
    why: "Appointment rules, NHS/private flags and checklists make service content accurate.",
    estimatedMinutes: 6,
  },
  {
    step: 5,
    id: "local",
    title: "Local Intelligence",
    subtitle: "Nearby places, competitors and areas served",
    why: "Google Places suggestions power local cluster pages and competition context.",
    estimatedMinutes: 5,
  },
  {
    step: 6,
    id: "patients",
    title: "Patient Groups",
    subtitle: "Who you help — checkbox groups",
    why: "Patient groups guide tone and angles in guides, FAQs and cluster pages.",
    estimatedMinutes: 2,
  },
  {
    step: 7,
    id: "trust",
    title: "Trust & Proof",
    subtitle: "Credentials, team reviewer and community proof",
    why: "Accreditations, reviewer credentials and awards reinforce authority in generated copy.",
    estimatedMinutes: 4,
  },
  {
    step: 8,
    id: "readiness",
    title: "Marketing & Readiness",
    subtitle: "CTA, tone and ready-to-generate check",
    why: "These preferences shape calls-to-action and writing style; review completion before generating.",
    estimatedMinutes: 3,
  },
];

function isEmail(v: string): boolean {
  return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isHex(v: string): boolean {
  return !v || /^#[0-9a-fA-F]{3,8}$/.test(v);
}

export function validateWizardStep(step: number, data: PharmacyProfileData): string | null {
  if (step === 2) {
    const gaps = buildWizardImportFields(data).filter((f) => f.status === "missing");
    if (!data.pharmacyName?.trim() && gaps.some((g) => g.id === "pharmacyName")) {
      return "Pharmacy name is required";
    }
    if (!data.phone?.trim() && gaps.some((g) => g.id === "phone")) {
      return "Telephone number is required";
    }
    if (!data.pharmacyName?.trim()) return "Pharmacy name is required";
    if (!data.phone?.trim()) return "Telephone number is required";
    if (data.businessEmail && !isEmail(data.businessEmail)) return "Enter a valid email address";
  }

  if (step === 3) {
    for (const key of [
      "brandPrimaryColor",
      "brandHeaderBackgroundColor",
      "brandHeaderTextColor",
      "brandFooterBackgroundColor",
      "brandFooterTextColor",
      "brandFooterLinkColor",
    ] as const) {
      const v = data[key];
      if (v && !isHex(v)) return `Invalid colour for ${key}`;
    }
  }

  if (step === 5) {
    if (!data.primaryTown?.trim() && !data.townCity?.trim()) {
      return "Primary town or city is required";
    }
    const hasAreas =
      (data.selectedAreas || []).some((a) => a.selected !== false) ||
      (data.rankingAreas || []).length > 0;
    if (!hasAreas) return "Select at least one target area";
  }

  if (step === 7) {
    if (!data.reviewerName?.trim() && !data.superintendentPharmacistName?.trim()) {
      return "Add a reviewer or superintendent pharmacist name";
    }
    if (!data.clinicalReviewDate?.trim()) return "Clinical review date is required";
  }

  if (step === 4) {
    const ids = collectServiceIdsFromProfile(data as unknown as Record<string, unknown>);
    if (ids.length && !(data.selectedServices || []).length) {
      return null;
    }
  }

  return null;
}

export function clampWizardStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  return Math.max(1, Math.min(WIZARD_TOTAL_STEPS, Math.round(step)));
}

export function resolveInitialWizardStep(data: PharmacyProfileData): number {
  const saved = clampWizardStep(Number(data.profileWizardStep || 1));
  return saved > 1 ? saved : 1;
}
