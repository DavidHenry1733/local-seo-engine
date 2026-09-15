/**
 * Professional review panel — profile-driven "Professionally reviewed by" block for service pages.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import {
  buildProfessionalReviewCardHtml,
  profileReviewCardCss,
} from "./pharmacyProfileReviewCardHtml.ts";
import {
  isUntrustedDisplayValue,
  productionContextFromProfile,
  requiresProductionSafeDisplay,
} from "./pharmacyProfileProductionSafety.ts";
import { NEUTRAL_PHARMACY_TEAM_REVIEW_STATE } from "./pharmacyCommercialReadinessGate.ts";

export const PROFESSIONAL_REVIEW_PANEL_MARKER = "pharmacy-professional-review-panel";

export interface ResolvedProfessionalReviewer {
  name: string;
  role: string;
  qualifications: string;
  bio: string;
  experienceYears: string;
  specialisms: string[];
  photoUrl: string;
  clinicalReviewDate: string;
  nextReviewDate: string;
  isFallbackSuperintendent: boolean;
  hasNamedReviewer: boolean;
}

function safeText(value: string, demoMode: boolean): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  if (demoMode || isUntrustedDisplayValue(v)) return "";
  return v;
}

function pageProfileToReviewData(profile: PharmacyServicePageProfile) {
  return {
    pharmacyName: profile.pharmacyName,
    tradingName: profile.tradingName,
    reviewerName: profile.reviewerName,
    reviewerRole: profile.reviewerRole,
    reviewerQualifications: profile.reviewerQualifications,
    reviewerProfessionalRegistrations: profile.reviewerProfessionalRegistrations,
    reviewerGphcNumber: profile.reviewerGphcNumber,
    reviewerExperienceYears: profile.reviewerExperienceYears,
    reviewerBio: profile.reviewerBio,
    reviewerSpecialisms: profile.reviewerSpecialisms,
    reviewerSpecialInterests: profile.reviewerSpecialInterests,
    reviewerClinicalInterests: profile.reviewerClinicalInterests,
    reviewerPhoto: profile.reviewerPhotoUrl,
    clinicalReviewDate: profile.clinicalReviewDate,
    nextReviewDate: profile.nextReviewDate,
    superintendentPharmacistName: profile.superintendentPharmacistName,
    demoMode: profile.demoMode,
    trustDataStatus: profile.trustDataStatus,
  };
}

export function resolveProfessionalReviewer(profile: PharmacyServicePageProfile): ResolvedProfessionalReviewer {
  const ctx = productionContextFromProfile(profile, profile);
  const demoBlocked = requiresProductionSafeDisplay(ctx);

  const reviewerName = safeText(profile.reviewerName, demoBlocked);
  const superintendentName = safeText(profile.superintendentPharmacistName, demoBlocked);

  const useReviewer = Boolean(reviewerName);
  const useSuperintendent = !useReviewer && Boolean(superintendentName);

  const name = useReviewer ? reviewerName : useSuperintendent ? superintendentName : "";
  const role = useReviewer
    ? safeText(profile.reviewerRole, demoBlocked) || "Superintendent Pharmacist"
    : useSuperintendent
      ? "Superintendent Pharmacist"
      : "";

  return {
    name,
    role,
    qualifications: safeText(profile.reviewerQualifications, demoBlocked),
    bio: safeText(profile.reviewerBio, demoBlocked),
    experienceYears: safeText(profile.reviewerExperienceYears, demoBlocked),
    specialisms: [
      ...(profile.reviewerSpecialInterests || []),
      ...(profile.reviewerClinicalInterests || []),
      ...(profile.reviewerSpecialisms || []),
    ].filter((s) => safeText(s, demoBlocked)),
    photoUrl: safeText(profile.reviewerPhotoUrl, demoBlocked),
    clinicalReviewDate: safeText(profile.clinicalReviewDate, demoBlocked),
    nextReviewDate: safeText(profile.nextReviewDate, demoBlocked),
    isFallbackSuperintendent: useSuperintendent,
    hasNamedReviewer: useReviewer || useSuperintendent,
  };
}

function renderNeutralProfessionalReviewCardHtml(): string {
  return `<div class="profile-review-card profile-review-card--fallback" data-component="profile-review-card">
<p class="profile-review-fallback">${NEUTRAL_PHARMACY_TEAM_REVIEW_STATE}</p>
</div>`;
}

export function renderProfessionalReviewPanelHtml(profile: PharmacyServicePageProfile): string {
  const reviewer = resolveProfessionalReviewer(profile);
  const namedCardHtml =
    reviewer.hasNamedReviewer && reviewer.name
      ? buildProfessionalReviewCardHtml(pageProfileToReviewData(profile))
      : "";
  const cardHtml =
    namedCardHtml && !/profile-review-card--fallback/.test(namedCardHtml)
      ? namedCardHtml
      : renderNeutralProfessionalReviewCardHtml();

  return `<section class="professional-review-panel soft" id="professional-review" data-component="${PROFESSIONAL_REVIEW_PANEL_MARKER}" data-template-block="professional-review">
<div class="wrap">
<div class="about-card review-card">
<h2>Professionally reviewed by</h2>
${cardHtml}
</div>
</div>
</section>`;
}

export function ensureProfessionalReviewPanelHtml(html: string, panelHtml: string): string {
  const source = String(html || "");
  const panel = String(panelHtml || "").trim();
  if (!source || !panel) return source;
  if (/data-component="pharmacy-professional-review-panel"/i.test(source)) return source;
  if (/<section\b[^>]*data-template-block="faq"/i.test(source)) {
    return source.replace(/<section\b[^>]*data-template-block="faq"/i, `${panel}\n$&`);
  }
  return source;
}

export function professionalReviewPanelCss(): string {
  return `${profileReviewCardCss()}
.professional-review-panel{padding:72px 0}
.review-card h2{margin-bottom:20px}
.professional-review-panel .profile-review-card{border:none;background:transparent;padding:0;box-shadow:none}
.professional-review-panel .profile-review-photo img{width:96px;height:96px;border:3px solid var(--line)}
.professional-review-panel .profile-review-name{font-size:22px;color:var(--brand-heading)}
.professional-review-panel .profile-review-role{color:var(--brand-accent);font-size:16px}
.professional-review-panel .profile-review-bio{font-size:17px;color:var(--muted)}`;
}
