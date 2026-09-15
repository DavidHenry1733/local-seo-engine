/**
 * Professional Review Card — shared HTML for dashboard preview and generated pages.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import {
  isUntrustedDisplayValue,
  productionContextFromProfile,
  requiresProductionSafeDisplay,
} from "./pharmacyProfileProductionSafety.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatReviewDate(iso: string): string {
  const v = String(iso ?? "").trim();
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function safeText(value: string, demoBlocked: boolean): string {
  const v = String(value ?? "").trim();
  if (!v || demoBlocked || isUntrustedDisplayValue(v)) return "";
  return v;
}

export function buildProfessionalReviewCardHtml(data: Partial<PharmacyProfileData>): string {
  const ctx = productionContextFromProfile(data, data);
  const demoBlocked = requiresProductionSafeDisplay(ctx);
  const pharmacyName = safeText(data.pharmacyName || data.tradingName || "", demoBlocked) || "this pharmacy";

  const reviewerName = safeText(data.reviewerName || "", demoBlocked);
  const superintendent = safeText(data.superintendentPharmacistName || "", demoBlocked);
  const name = reviewerName || superintendent;

  if (!name) {
    // Never render patient-facing missing-data / pre-publish instructions.
    return "";
  }

  const role = safeText(data.reviewerRole || "", demoBlocked) || "Superintendent Pharmacist";
  const qualifications = safeText(data.reviewerQualifications || "", demoBlocked);
  const registrations = safeText(data.reviewerProfessionalRegistrations || data.reviewerGphcNumber || "", demoBlocked);
  const experience = safeText(data.reviewerExperienceYears || "", demoBlocked);
  const bio = safeText(data.reviewerBio || "", demoBlocked);
  const photo = safeText(data.reviewerPhoto || "", demoBlocked);
  const clinicalDate = safeText(data.clinicalReviewDate || "", demoBlocked);
  const nextDate = safeText(data.nextReviewDate || "", demoBlocked);
  const specialisms = [
    ...(data.reviewerSpecialInterests || []),
    ...(data.reviewerClinicalInterests || []),
    ...(data.reviewerSpecialisms || []),
  ]
    .filter(Boolean)
    .slice(0, 4);

  return `<div class="profile-review-card" data-component="profile-review-card">
${photo ? `<div class="profile-review-photo"><img src="${esc(photo)}" alt="${esc(name)}" loading="lazy"/></div>` : ""}
<div class="profile-review-body">
<h3 class="profile-review-name">${esc(name)}</h3>
<p class="profile-review-role">${esc(role)} at ${esc(pharmacyName)}</p>
${qualifications ? `<p class="profile-review-qual">${esc(qualifications)}</p>` : ""}
${registrations ? `<p class="profile-review-reg">${esc(registrations)}</p>` : ""}
${experience ? `<p class="profile-review-exp"><strong>Experience:</strong> ${esc(experience)} years</p>` : ""}
${specialisms.length ? `<p class="profile-review-tags">${specialisms.map((s) => `<span class="profile-review-tag">${esc(s)}</span>`).join("")}</p>` : ""}
${bio ? `<p class="profile-review-bio">${esc(bio)}</p>` : ""}
${clinicalDate ? `<p class="profile-review-date"><strong>Clinical review date:</strong> ${esc(formatReviewDate(clinicalDate))}</p>` : ""}
${nextDate ? `<p class="profile-review-date"><strong>Next review due:</strong> ${esc(formatReviewDate(nextDate))}</p>` : ""}
</div>
</div>`;
}

export function profileReviewCardCss(): string {
  return `.profile-review-card{display:grid;grid-template-columns:auto 1fr;gap:16px;padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}
.profile-review-photo img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #cbd5e1}
.profile-review-name{margin:0 0 4px;font-size:18px;color:var(--brand-heading)}
.profile-review-role{margin:0 0 8px;font-weight:700;color:var(--brand-accent);font-size:14px}
.profile-review-qual,.profile-review-reg,.profile-review-exp{margin:0 0 6px;font-size:13px;color:var(--brand-muted)}
.profile-review-bio{margin:8px 0;font-size:14px;line-height:1.6;color:var(--brand-muted)}
.profile-review-date{margin:4px 0 0;font-size:13px;color:var(--brand-heading)}
.profile-review-tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.profile-review-tag{display:inline-block;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--brand-primary) 10%,white);border:1px solid color-mix(in srgb,var(--brand-primary) 24%,white);font-size:11px;font-weight:700;color:var(--brand-primary)}
.profile-review-fallback{margin:0;font-size:14px;color:var(--brand-muted)}
@media(max-width:600px){.profile-review-card{grid-template-columns:1fr}}`;
}
