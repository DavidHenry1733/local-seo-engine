/**
 * Local hub/cluster shell layout — image slots inside content sections, not orphan full-width bands.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { preferredServicePageCta, servicePageFinalCtaBody } from "./pharmacyServicePageIntelligence.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Place hero/support image inside the first local prose section instead of a standalone section. */
export function nestLocalShellHeroInBodyMain(bodyMain: string, heroImageHtml: string): string {
  const hero = String(heroImageHtml || "").trim();
  if (!hero) return bodyMain;
  const close = "</div></section>";
  const idx = bodyMain.indexOf(close);
  if (idx === -1) {
    return `${bodyMain}\n<div class="local-shell-hero-media">${hero}</div>`;
  }
  return `${bodyMain.slice(0, idx)}<div class="local-shell-hero-media">${hero}</div>${bodyMain.slice(idx)}`;
}

/** CTA band with optional conversion image — avoids a separate conversion-image-only section. */
export function buildLocalPageFinalCtaHtml(
  serviceName: string,
  profile: PharmacyServicePageProfile,
  conversionImageHtml: string,
  contentContext?: ContentGenerationContext,
): string {
  const name = profile.pharmacyName;
  const tel = profile.phone.replace(/\s/g, "");
  const serviceLower = serviceName.toLowerCase();
  const heading = serviceLower.includes("pharmacy first")
    ? `Book Pharmacy First at ${name}`
    : `Book ${serviceName} at ${name}`;
  const displayPhone = profile.displayPhone || profile.phone;
  const body = servicePageFinalCtaBody(contentContext, profile, serviceName);
  const ctaLabel = preferredServicePageCta(contentContext, profile);
  const phoneCtaHtml =
    profile.showProminentTelephoneCta && profile.phone
      ? `<a class="btn-white" href="tel:${esc(tel)}">Call ${esc(name)} — ${esc(displayPhone)}</a>`
      : "";
  const secondaryActionHtml =
    profile.bookingUrl && !/call/i.test(ctaLabel)
      ? `<a class="btn-white-outline" href="${esc(profile.bookingUrl)}">${esc(ctaLabel)}</a>`
      : `<a class="btn-white-outline" href="#faq-section">View FAQs</a>`;
  const conversion = String(conversionImageHtml || "").trim();

  return `<section id="contact" class="cta-band" data-template-block="final-cta">
<div class="wrap">
${conversion ? `<div class="local-cta-media">${conversion}</div>` : ""}
<h2>${esc(heading)}</h2>
<p class="cta-close">${esc(body)}</p>
<div class="cta-actions">
${phoneCtaHtml}
${secondaryActionHtml}
</div>
</div>
</section>`;
}

export const LOCAL_SHELL_LAYOUT_CSS = `
.local-shell-hero-media{margin-top:28px;max-width:min(100%,720px)}
.local-shell-hero-media .hero-image-wrap,.local-shell-hero-media .image-panel{max-width:100%}
.local-cta-media{margin:0 0 20px;max-width:min(100%,560px)}
.local-cta-media .image-panel,.local-cta-media img{max-width:100%;height:auto}
`;
