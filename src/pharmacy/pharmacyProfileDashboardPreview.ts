/**
 * Pharmacy Profile Dashboard V1 — live preview panel HTML.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { formatOpeningHoursDisplay } from "./pharmacyProfileHours.ts";
import { resolveGoogleMapsEmbedUrlFromData } from "./pharmacyServicePageProfileContext.ts";
import { resolveProductionGphcDisplay } from "./pharmacyProfileProductionSafety.ts";
import {
  resolveFooterLogo,
  resolveHeaderCtaText,
  resolveHeaderCtaUrl,
  resolveHeaderLogo,
} from "./pharmacyProfileDashboardConfig.ts";
import { buildProfessionalReviewCardHtml, profileReviewCardCss } from "./pharmacyProfileReviewCardHtml.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildProfilePreviewHtml(data: Partial<PharmacyProfileData>): string {
  const name = data.pharmacyName || data.tradingName || "Your pharmacy";
  const town = data.townCity || "";
  const phone = data.phone || "";
  const address = [data.addressLine1, data.addressLine2, data.postcode].filter(Boolean).join(", ");
  const hours = formatOpeningHoursDisplay(data) || data.openingHours || "Opening hours not set";
  const cta = resolveHeaderCtaText(data);
  const ctaUrl = resolveHeaderCtaUrl(data);
  const ctaColor = data.brandCtaColor || data.brandPrimaryColor || "#005eb8";
  const primary = data.brandPrimaryColor || "#005eb8";
  const secondary = data.brandSecondaryColor || "#003087";
  const accent = data.brandAccentColor || "#0d9488";
  const bg = data.brandBackgroundColor || "#ffffff";
  const text = data.brandTextColor || "#142033";
  const muted = data.brandMutedTextColor || "#5d6b7f";
  const mapUrl = resolveGoogleMapsEmbedUrlFromData(data);
  const coverage = [...new Set([...(data.rankingAreas || []), ...(data.nearbyAreas || [])])].slice(0, 6);
  const gphc = resolveProductionGphcDisplay(data).display;
  const headerLogo = resolveHeaderLogo(data);
  const footerLogo = resolveFooterLogo(data);
  const navLinks = (data.headerNavLinks || []).filter((l) => l.visible);

  const logo = headerLogo
    ? `<img src="${esc(headerLogo)}" alt="${esc(name)}" class="preview-logo">`
    : `<div class="preview-logo-placeholder">${esc(name.charAt(0) || "P")}</div>`;

  const navHtml = navLinks.length
    ? navLinks.map((l) => `<a href="${esc(l.url)}" class="preview-nav-link">${esc(l.label)}</a>`).join("")
    : `<a href="#" class="preview-nav-link">Services</a><a href="#" class="preview-nav-link">Contact</a>`;

  const footerSocial = [
    data.socialFacebook ? `<a href="${esc(data.socialFacebook)}">Facebook</a>` : "",
    data.socialInstagram ? `<a href="${esc(data.socialInstagram)}">Instagram</a>` : "",
    data.socialLinkedIn ? `<a href="${esc(data.socialLinkedIn)}">LinkedIn</a>` : "",
    data.socialX ? `<a href="${esc(data.socialX)}">X</a>` : "",
    data.socialYouTube ? `<a href="${esc(data.socialYouTube)}">YouTube</a>` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const reviewCard = buildProfessionalReviewCardHtml(data);

  return `<style>${profileReviewCardCss()}
.preview-nav-links{display:flex;flex-wrap:wrap;gap:10px;margin-left:auto}
.preview-nav-link{color:#fff;text-decoration:none;font-size:12px;font-weight:600}
.preview-color-swatches{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.preview-swatch{width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0}
.preview-hero-sample{padding:16px;border-radius:12px;margin-top:10px;color:#fff}
.preview-btn-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.preview-btn-primary,.preview-btn-secondary{display:inline-block;padding:10px 16px;font-weight:800;font-size:13px;text-decoration:none;color:#fff}
.preview-btn-secondary{background:#fff;color:${esc(text)}!important;border:1px solid #e2e8f0}
.preview-footer-block a{color:${esc(primary)};text-decoration:none;margin-right:8px}
</style>
<div class="preview-shell" style="--preview-primary:${esc(primary)};--preview-secondary:${esc(secondary)};--preview-cta:${esc(ctaColor)};--preview-accent:${esc(accent)};--preview-bg:${esc(bg)};--preview-text:${esc(text)};--preview-muted:${esc(muted)};font-family:${esc(data.fontBody || "Inter, system-ui, sans-serif")}">
<div class="preview-section"><h4>Header</h4>
<div class="preview-header" style="background:${esc(secondary)}">
${logo}
<div><strong style="font-family:${esc(data.fontHeading || "Poppins, system-ui, sans-serif")}">${esc(name)}</strong>${town ? `<span>${esc(town)}${gphc ? ` · ${esc(gphc)}` : ""}</span>` : ""}</div>
<div class="preview-nav-links">${navHtml}</div>
${phone ? `<a href="tel:${esc(phone.replace(/\s/g, ""))}">${esc(phone)}</a>` : ""}
</div></div>

<div class="preview-section"><h4>Hero &amp; buttons</h4>
<div class="preview-hero-sample" style="background:linear-gradient(135deg,${esc(secondary)},${esc(primary)})">
<strong style="font-size:${esc(data.fontH2Size || "1.5rem")};font-family:${esc(data.fontHeading || "Poppins, system-ui, sans-serif")}">Service page hero</strong>
<p style="opacity:.9;font-size:${esc(data.fontBodySize || "1rem")}">Brand colours applied to generated pages after rebuild.</p>
<div class="preview-btn-row">
<a class="preview-btn-primary" style="background:${esc(ctaColor)};border-radius:${esc(data.buttonRadius || "14px")}" href="${esc(ctaUrl)}">${esc(cta)}</a>
<a class="preview-btn-secondary" style="border-radius:${esc(data.buttonRadius || "14px")}" href="#">Call ${esc(phone || "pharmacy")}</a>
</div></div></div>

<div class="preview-section"><h4>Brand colours</h4>
<div class="preview-color-swatches">
<span class="preview-swatch" style="background:${esc(primary)}" title="Primary"></span>
<span class="preview-swatch" style="background:${esc(secondary)}" title="Secondary"></span>
<span class="preview-swatch" style="background:${esc(ctaColor)}" title="CTA"></span>
<span class="preview-swatch" style="background:${esc(accent)}" title="Accent"></span>
</div></div>

<div class="preview-section"><h4>Typography</h4>
<div class="typography-preview" style="color:${esc(text)};background:${esc(bg)}">
<h1 style="font-family:${esc(data.fontHeading || "Poppins, system-ui, sans-serif")};font-size:${esc(data.fontH1Size || "2rem")};font-weight:${esc(data.fontHeadingWeight || "800")}">Heading One</h1>
<h2 style="font-family:${esc(data.fontHeading || "Poppins, system-ui, sans-serif")};font-size:${esc(data.fontH2Size || "1.5rem")}">Heading Two</h2>
<h3 style="font-size:${esc(data.fontH3Size || "1.25rem")}">Heading Three</h3>
<p style="font-size:${esc(data.fontBodySize || "1rem")};color:${esc(muted)}">Body text sample for patient-facing content.</p>
</div></div>

<div class="preview-section"><h4>Professional Review Card</h4>
${reviewCard}
</div>

<div class="preview-section"><h4>Footer</h4>
<div class="preview-footer-block">
${footerLogo ? `<img src="${esc(footerLogo)}" alt="" style="max-height:32px;margin-bottom:8px"/>` : ""}
<p><strong>${esc(name)}</strong>${data.footerText ? `<br>${esc(data.footerText)}` : ""}</p>
<p>${esc(address || "Address not set")}</p>
<p>${esc(hours)}</p>
${footerSocial ? `<p>${footerSocial}</p>` : ""}
<p style="font-size:11px;color:${esc(muted)}">${esc(data.footerCopyright || `© ${new Date().getFullYear()} ${name}`)}${data.footerCompanyNumber ? ` · Co. ${esc(data.footerCompanyNumber)}` : ""}</p>
</div></div>

${mapUrl ? `<div class="preview-map"><iframe src="${esc(mapUrl)}" title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ""}
</div>`;
}

export { profileReviewCardCss, buildProfessionalReviewCardHtml };
