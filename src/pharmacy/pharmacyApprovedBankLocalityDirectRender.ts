/**
 * Direct approved-bank service sections for registered services.
 * This module does not write locality prose. Locality synthesis belongs to
 * composeCommercialClusterNarrativeV1.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { isApprovedBankRegisteredService } from "./pharmacyServiceVariantLibrary.ts";
import type {
  LocalClusterContentInput,
  LocalClusterPageContent,
} from "./pharmacyLocalClusterContentEngine.ts";

export const APPROVED_BANK_LOCALITY_DIRECT_NARRATIVE = "approved-bank-locality-direct";

export function usesApprovedBankLocalityDirectPath(serviceId: string): boolean {
  return isApprovedBankRegisteredService(serviceId);
}

export function serviceHubPublicPath(serviceId: string): string {
  const id = String(serviceId || "").trim();
  return id ? `/${id}/` : "/";
}

function escHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared full-service hub CTA for registered approved-service locality pages. */
export function renderApprovedBankServiceHubCtaHtml(
  serviceName: string,
  serviceId: string,
  conversionImageHtml: string,
): string {
  const service = escHtml(serviceName);
  const href = escHtml(serviceHubPublicPath(serviceId));
  return `<section class="section-band conversion-image-section" data-template-block="conversion-image">
<div class="wrap">${conversionImageHtml}</div>
</section>
<section id="contact" class="cta-band" data-template-block="final-cta" data-service-hub-cta="${escHtml(serviceId)}">
<div class="wrap">
<h2>Find out more about ${service}</h2>
<p class="cta-close">The full ${service} page contains more detailed information about this service. Open it if you want a fuller explanation before you get in touch.</p>
<div class="cta-actions">
<a class="btn-white" href="${href}">View full ${service} information</a>
</div>
</div>
</section>`;
}

/** Distinct preparation / accurate-reading section for approved-bank locality pages. */
export function renderApprovedBankLocalityPreparationHtml(input: {
  heading: string;
  body: string;
  bullets?: string[];
}): string {
  const heading = escHtml(String(input.heading || "").trim() || "Getting an accurate reading");
  const paragraphs = String(input.body || "")
    .trim()
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const sentences = paragraphs.length
    ? paragraphs
    : String(input.body || "")
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
  const chunks: string[] = [];
  if (paragraphs.length > 1) {
    chunks.push(...paragraphs);
  } else {
    for (let i = 0; i < sentences.length; i += 2) {
      chunks.push(sentences.slice(i, i + 2).join(" "));
    }
  }
  const prose = chunks.map((p) => `<p>${escHtml(p)}</p>`).join("\n");
  const bullets = (input.bullets || []).map((b) => String(b).trim()).filter(Boolean);
  const list = bullets.length
    ? `<ul class="clean">${bullets.map((b) => `<li>${escHtml(b)}</li>`).join("")}</ul>`
    : "";
  if (!prose && !list) return "";
  return `<section class="soft" id="cluster-consultation" data-template-block="consultation" data-locality-evidence="approved-bank-preparation">
<div class="wrap">
<div class="section-head center"><h2>${heading}</h2></div>
${prose}
${list}
</div>
</section>`;
}

export function composeApprovedBankLocalityDirectDraft(
  input: LocalClusterContentInput,
  _ctxInput?: ContentGenerationContext,
): LocalClusterPageContent {
  throw new Error(
    `Approved-bank locality draft cannot write locality prose for ${input.serviceId}/${input.areaSlug}. composeCommercialClusterNarrativeV1 owns locality synthesis.`,
  );
}
