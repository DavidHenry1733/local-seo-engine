/**
 * Isolated unpublished Preview for the Pharmacy First service-page master template V1.
 * Request-time only. Does not rewrite accepted Brook or Allestree pages, generate content,
 * emit schema, or publish.
 */
import {
  SERVICE_PAGE_MASTER_PREVIEW_BANNER,
  SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  loadServicePageMasterContext,
  renderServicePageMasterTemplateV1,
} from "./pharmacyServicePageMasterTemplateV1.ts";

export { SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET };

const AUTHORISED = {
  slug: "brook-pharmacy-demo-derby",
  campaignId: "pharmacy-first",
} as const;

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function unavailable(detail: string): { html: string; sourcePath: string | null; sourceRoute: string } {
  return {
    html: `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><meta name="robots" content="noindex, nofollow"/><title>Service page master template unavailable</title></head><body><p>${esc(detail)}</p></body></html>`,
    sourcePath: null,
    sourceRoute: `${SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET}-unavailable`,
  };
}

function applyTemplateDemonstrationToolbar(html: string): string {
  const style = `<style data-preview-toolbar="${SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET}">.pharmacy-review-preview-toolbar{position:sticky;top:0;z-index:10001;min-height:40px;box-sizing:border-box;background:#eff6ff;border-bottom:1px solid #bfdbfe;color:#1e40af;font:800 13px/1.4 Inter,system-ui,sans-serif;text-align:center;padding:10px 16px}.pharmacy-review-preview-toolbar~.site-header{top:auto}html{scroll-padding-top:130px}section[id]{scroll-margin-top:130px}</style>`;
  const toolbar = `<div class="pharmacy-review-preview-toolbar" data-component="review-preview-toolbar">${SERVICE_PAGE_MASTER_PREVIEW_BANNER}</div>`;
  let out = String(html || "");
  if (!out.includes(`data-preview-toolbar="${SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET}"`)) {
    out = out.includes("</head>") ? out.replace(/<\/head>/i, `${style}\n</head>`) : `${style}${out}`;
  }
  if (!out.includes('data-component="review-preview-toolbar"')) {
    out = out.replace(/<body\b[^>]*>/i, (match) => `${match}\n${toolbar}`);
  }
  return out;
}

export function renderServicePageMasterTemplatePreview(
  slug: string,
  campaignId: string,
  options: { areaSlug?: string } = {},
): { html: string; sourcePath: string | null; sourceRoute: string } {
  const areaSlug = String(options.areaSlug || "").trim().toLowerCase();
  if (slug !== AUTHORISED.slug || campaignId !== AUTHORISED.campaignId || areaSlug) {
    return unavailable("This isolated Pharmacy First master-template Preview is not available for this tenant.");
  }

  const context = loadServicePageMasterContext(slug, campaignId);
  const rendered = renderServicePageMasterTemplateV1({
    slug,
    serviceId: campaignId,
    facts: context.facts,
    identity: context.identity,
    clinicalReviewDate: context.clinicalReviewDate,
    approval: context.approval,
  });

  return {
    html: applyTemplateDemonstrationToolbar(rendered.html),
    sourcePath: null,
    sourceRoute: SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  };
}
