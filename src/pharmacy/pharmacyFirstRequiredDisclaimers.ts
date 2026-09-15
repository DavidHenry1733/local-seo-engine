/**
 * Renderer-owned Pharmacy First disclaimers for the generated service page.
 * Uses the customer-facing pharmacy name. AI generation must not rewrite these strings.
 */

export const PHARMACY_FIRST_REQUIRED_DISCLAIMERS_COMPONENT = "pharmacy-first-required-disclaimers";

export const PHARMACY_FIRST_NHS_REQUIREMENTS_DISCLAIMER =
  "We follow the NHS Pharmacy First service requirements.";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function pharmacyFirstProvidedByDisclaimer(pharmacyName: string): string {
  const name = String(pharmacyName || "").trim();
  if (!name) return "";
  return `The Pharmacy First service is provided by ${name}.`;
}

export function htmlContainsPharmacyFirstRequiredDisclaimers(html: string, pharmacyName: string): boolean {
  const name = String(pharmacyName || "").trim();
  if (!html || !name) return false;
  const decoded = String(html).replace(/&amp;/gi, "&");
  return (
    decoded.includes(PHARMACY_FIRST_NHS_REQUIREMENTS_DISCLAIMER) &&
    decoded.includes(pharmacyFirstProvidedByDisclaimer(name))
  );
}

export function renderPharmacyFirstRequiredDisclaimersHtml(pharmacyName: string): string {
  const name = String(pharmacyName || "").trim();
  const providedBy = pharmacyFirstProvidedByDisclaimer(name);
  if (!providedBy) return "";
  return `<aside class="${PHARMACY_FIRST_REQUIRED_DISCLAIMERS_COMPONENT}" data-component="${PHARMACY_FIRST_REQUIRED_DISCLAIMERS_COMPONENT}" data-ai-rewrite="forbidden">
<p>${esc(PHARMACY_FIRST_NHS_REQUIREMENTS_DISCLAIMER)}</p>
<p>${esc(providedBy)}</p>
</aside>`;
}

function disclaimerCss(): string {
  return `<style data-pharmacy-first-required-disclaimers="css">
.${PHARMACY_FIRST_REQUIRED_DISCLAIMERS_COMPONENT}{max-width:var(--brand-container-width,1180px);margin:0 auto;padding:4px var(--brand-section-x,24px) 32px;text-align:center}
.${PHARMACY_FIRST_REQUIRED_DISCLAIMERS_COMPONENT} p{margin:0 0 .45rem;font:400 14px/1.55 var(--font-body,inherit);color:var(--brand-muted,#5d6b7f)}
.${PHARMACY_FIRST_REQUIRED_DISCLAIMERS_COMPONENT} p:last-child{margin-bottom:0}
</style>`;
}

/**
 * Restore the two required Pharmacy First disclaimers without rewriting other copy.
 * Idempotent. Pharmacy name must already be the customer-facing canonical name.
 */
export function injectPharmacyFirstRequiredDisclaimers(html: string, pharmacyName: string): string {
  const name = String(pharmacyName || "").trim();
  if (!html || !name) return html;
  if (htmlContainsPharmacyFirstRequiredDisclaimers(html, name)) {
    if (!html.includes(`data-pharmacy-first-required-disclaimers="css"`) && html.includes("</head>")) {
      return html.replace(/<\/head>/i, `${disclaimerCss()}\n</head>`);
    }
    return html;
  }
  const snippet = renderPharmacyFirstRequiredDisclaimersHtml(name);
  if (!snippet) return html;
  let out = html.replace(
    /<aside\b[^>]*data-component="pharmacy-first-required-disclaimers"[^>]*>[\s\S]*?<\/aside>/gi,
    "",
  );
  if (!out.includes(`data-pharmacy-first-required-disclaimers="css"`) && out.includes("</head>")) {
    out = out.replace(/<\/head>/i, `${disclaimerCss()}\n</head>`);
  }
  if (/<\/main>/i.test(out)) return out.replace(/<\/main>/i, `${snippet}\n</main>`);
  if (/<footer\b/i.test(out)) return out.replace(/<footer\b/i, `${snippet}\n$&`);
  return `${out}${snippet}`;
}
