/**
 * Component DNA contact treatment renderers.
 */
import type { ContactTreatmentDna } from "./pharmacyComponentDnaTypes.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeTelHref } from "./pharmacyServicePageProfileContext.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PHONE_ICON = `<svg class="hero-contact-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>`;

export function renderHeroContactTreatment(
  profile: PharmacyServicePageProfile,
  contact?: ContactTreatmentDna,
): string {
  if (!profile.phone || !contact || contact.role === "plain") return "";
  const displayPhone = profile.displayPhone || profile.phone;
  const telHref = normalizeTelHref(profile.phone);
  const linkedLabel = contact.clickable
    ? `<a href="${esc(telHref)}">${esc(displayPhone)}</a>`
    : esc(displayPhone);
  const plainLabel = esc(displayPhone);
  const icon = contact.showIcon ? PHONE_ICON : "";

  if (contact.role === "hero-contact" || contact.role === "boxed") {
    return `<div class="hero-contact-box" data-contact-role="${esc(contact.role)}">${icon}<span class="hero-contact-text">${plainLabel}</span></div>`;
  }

  if (contact.role === "linked") {
    return `<p class="hero-contact-link">${icon}${linkedLabel}</p>`;
  }

  return `<p class="hero-contact-plain">${esc(displayPhone)}</p>`;
}

export function heroContactTreatmentCss(): string {
  return `
.hero-contact-box{display:inline-flex;align-items:center;gap:10px;margin-top:18px;padding:var(--component-contact-hero-padding,12px 18px);border-radius:var(--component-contact-hero-radius,10px);background:var(--component-contact-hero-bg,var(--brand-cta,var(--brand-secondary)));color:var(--component-contact-hero-fg,#fff);font-weight:700;font-size:16px;line-height:1.2}
.hero-contact-box a{color:inherit;text-decoration:none}
.hero-contact-box .hero-contact-icon{width:18px;height:18px;flex:0 0 18px}
.hero-contact-link,.hero-contact-plain{margin-top:18px;font-size:16px;font-weight:700}
.hero-contact-link a{color:var(--brand-primary);text-decoration:none}
`;
}
