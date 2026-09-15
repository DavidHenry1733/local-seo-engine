/**
 * Tenant-, campaign- and asset-scoped destinations for accepted Pharmacy First Previews.
 * Request-time only. Does not regenerate copy, HTML candidates, or evidence.
 */
import { BROOK_DERBY_DEMO_SLUG } from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";

export const ACCEPTED_PHARMACY_FIRST_CAMPAIGN_ID = "pharmacy-first";
export const ACCEPTED_SERVICE_PAGE_ASSET = "service-page-master-template-v1";
export const ACCEPTED_LOCAL_PAGE_ASSET = "ai-local-area-page-pilot-v3";
export const ACCEPTED_BROOK_MONEY_PAGE_HREF = "https://pharmacy.inboxingproweb.com/";
export const ACCEPTED_PREVIEW_ORIGIN = "https://app.pharmaconnect.uk";

export const ACCEPTED_PHARMACY_FIRST_LOCAL_AREAS = [
  { slug: "allestree", name: "Allestree" },
  { slug: "mickleover", name: "Mickleover" },
  { slug: "littleover", name: "Littleover" },
  { slug: "chellaston", name: "Chellaston" },
  { slug: "duffield", name: "Duffield" },
  { slug: "alvaston", name: "Alvaston" },
  { slug: "mackworth", name: "Mackworth" },
  { slug: "chaddesden", name: "Chaddesden" },
  { slug: "spondon", name: "Spondon" },
  { slug: "borrowash", name: "Borrowash" },
] as const;

export type AcceptedPharmacyFirstPageRoutes = {
  slug: string;
  campaignId: string;
  moneyPageHref: string;
  servicePageHref: string;
  localPageHref: (areaSlug: string) => string | null;
};

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function escAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function previewOrigin(): string {
  return String(process.env.APP_DOMAIN || ACCEPTED_PREVIEW_ORIGIN).trim().replace(/\/$/, "") || ACCEPTED_PREVIEW_ORIGIN;
}

function previewHref(slug: string, campaignId: string, asset: string, areaSlug?: string): string {
  const params = new URLSearchParams({ campaign: campaignId, asset });
  if (areaSlug) params.set("area", areaSlug);
  return `${previewOrigin()}/api/growth-engine/${encodeURIComponent(slug)}/review-preview?${params.toString()}`;
}

export function isPublicAcceptedPharmacyFirstPreviewGet(input: {
  method: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  query?: Record<string, unknown>;
}): boolean {
  const method = String(input.method || "").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  const blob = [input.originalUrl, input.path, input.url, JSON.stringify(input.query || {})]
    .join("\n")
    .toLowerCase();
  if (!blob.includes("brook-pharmacy-demo-derby")) return false;
  if (!blob.includes("review-preview")) return false;
  if (!blob.includes("pharmacy-first")) return false;
  if (!blob.includes("service-page-master-template-v1")) return false;
  if (/(?:[?&]|%26)area=/.test(blob)) return false;
  return Boolean(
    resolveAcceptedPharmacyFirstPageRoutes({
      slug: BROOK_DERBY_DEMO_SLUG,
      campaignId: ACCEPTED_PHARMACY_FIRST_CAMPAIGN_ID,
    }),
  );
}

export function resolveAcceptedPharmacyFirstPageRoutes(input: {
  slug: string;
  campaignId: string;
}): AcceptedPharmacyFirstPageRoutes | null {
  const slug = normalize(input.slug);
  const campaignId = normalize(input.campaignId);
  if (!slug || slug !== BROOK_DERBY_DEMO_SLUG) return null;
  if (campaignId !== ACCEPTED_PHARMACY_FIRST_CAMPAIGN_ID) return null;
  return {
    slug,
    campaignId,
    moneyPageHref: ACCEPTED_BROOK_MONEY_PAGE_HREF,
    servicePageHref: previewHref(slug, campaignId, ACCEPTED_SERVICE_PAGE_ASSET),
    localPageHref: (areaSlug: string) => {
      const area = ACCEPTED_PHARMACY_FIRST_LOCAL_AREAS.find((row) => row.slug === normalize(areaSlug));
      return area ? previewHref(slug, campaignId, ACCEPTED_LOCAL_PAGE_ASSET, area.slug) : null;
    },
  };
}

function injectAcceptedLinkRuntime(html: string): string {
  const marker = 'data-accepted-page-links="v1"';
  if (html.includes(marker)) return html;
  const css = `<style ${marker}>[data-sales-demo-localities] a.coverage-tag{pointer-events:auto;cursor:pointer;text-decoration:none}</style>`;
  const script = `<script ${marker}>document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(!a||!a.href)return;var token=new URLSearchParams(location.search).get("_t");if(!token)return;try{var url=new URL(a.href,location.href);if(url.origin!==location.origin||url.pathname.indexOf("/review-preview")<0||url.searchParams.get("_t"))return;e.preventDefault();url.searchParams.set("_t",token);location.assign(url.toString());}catch(err){}},true);</script>`;
  const snippet = `${css}\n${script}`;
  return html.includes("</head>") ? html.replace(/<\/head>/i, `${snippet}\n</head>`) : `${snippet}${html}`;
}

export function connectAcceptedServicePagePrimaryConversionCta(
  html: string,
  routes: AcceptedPharmacyFirstPageRoutes | null,
): string {
  if (!routes) return html;
  const href = escAttr(routes.moneyPageHref);
  return String(html || "").replace(
    /(<section\b[^>]*data-template-block="hero"[^>]*>[\s\S]*?<div class="btns">\s*)<a class="btn"(?![^>]*\bsecondary\b)[^>]*>Contact the pharmacy<\/a>/i,
    `$1<a class="btn" href="${href}">Contact the pharmacy</a>`,
  );
}

function connectAcceptedServicePageLocalAreaLinks(
  html: string,
  routes: AcceptedPharmacyFirstPageRoutes | null,
): string {
  if (!routes) return html;
  let out = String(html || "");
  for (const area of ACCEPTED_PHARMACY_FIRST_LOCAL_AREAS) {
    const href = routes.localPageHref(area.slug);
    if (!href) continue;
    const encoded = escAttr(href);
    const name = area.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`<(?:span|a)\\b([^>]*\\bclass="[^"]*coverage-tag[^"]*"[^>]*)>${name}<\\/(?:span|a)>`, "i"),
      `<a class="coverage-tag" role="listitem" href="${encoded}">${area.name}</a>`,
    );
  }
  return out;
}

export function connectAcceptedLocalPageServiceLinks(
  html: string,
  routes: AcceptedPharmacyFirstPageRoutes | null,
): string {
  if (!routes) return html;
  const href = escAttr(routes.servicePageHref);
  let out = String(html || "");
  out = out.replace(
    /(<nav\b[^>]*(?:class="[^"]*local-breadcrumb[^"]*"|aria-label="Breadcrumb")[^>]*>\s*)<a\b[^>]*>Pharmacy First<\/a>/i,
    `$1<a href="${href}">Pharmacy First</a>`,
  );
  out = out.replace(
    /(<section\b[^>]*data-template-block="hero"[^>]*>[\s\S]*?)<a class="btn"(?![^>]*\bsecondary\b)[^>]*>Book An Appointment<\/a>/i,
    `$1<a class="btn" href="${href}">Book An Appointment</a>`,
  );
  return out;
}

export function applyAcceptedPharmacyFirstPreviewLinks(
  html: string,
  input: { slug: string; campaignId: string; asset: string },
): string {
  const routes = resolveAcceptedPharmacyFirstPageRoutes(input);
  if (!routes) return html;
  const asset = normalize(input.asset);
  let out = String(html || "");
  if (asset === ACCEPTED_SERVICE_PAGE_ASSET) {
    out = connectAcceptedServicePagePrimaryConversionCta(out, routes);
    out = connectAcceptedServicePageLocalAreaLinks(out, routes);
  }
  if (asset === ACCEPTED_LOCAL_PAGE_ASSET) {
    out = connectAcceptedLocalPageServiceLinks(out, routes);
  }
  if (asset === ACCEPTED_SERVICE_PAGE_ASSET || asset === ACCEPTED_LOCAL_PAGE_ASSET) {
    out = injectAcceptedLinkRuntime(out);
  }
  return out;
}
