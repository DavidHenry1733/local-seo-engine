/**
 * Tenant- and campaign-scoped destinations for accepted Pharmacy First pages.
 * Request-time only. Does not regenerate copy, HTML candidates, or evidence.
 */
import { BROOK_DERBY_DEMO_SLUG } from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";

export const ACCEPTED_PHARMACY_FIRST_CAMPAIGN_ID = "pharmacy-first";
export const ACCEPTED_SERVICE_PAGE_ASSET = "service-page-master-template-v1";
export const ACCEPTED_BROOK_MONEY_PAGE_HREF = "https://pharmacy.inboxingproweb.com/";
export const ACCEPTED_PREVIEW_ORIGIN = "https://app.pharmaconnect.uk";

export type AcceptedPharmacyFirstPageRoutes = {
  slug: string;
  campaignId: string;
  moneyPageHref: string;
  servicePageHref: string;
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

export function resolveAcceptedPharmacyFirstPageRoutes(input: {
  slug: string;
  campaignId: string;
}): AcceptedPharmacyFirstPageRoutes | null {
  const slug = normalize(input.slug);
  const campaignId = normalize(input.campaignId);
  if (!slug || slug !== BROOK_DERBY_DEMO_SLUG) return null;
  if (campaignId !== ACCEPTED_PHARMACY_FIRST_CAMPAIGN_ID) return null;
  const origin = String(process.env.APP_DOMAIN || ACCEPTED_PREVIEW_ORIGIN).trim().replace(/\/$/, "") || ACCEPTED_PREVIEW_ORIGIN;
  const servicePageHref = `${origin}/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(ACCEPTED_SERVICE_PAGE_ASSET)}`;
  return {
    slug,
    campaignId,
    moneyPageHref: ACCEPTED_BROOK_MONEY_PAGE_HREF,
    servicePageHref,
  };
}

export function connectAcceptedServicePagePrimaryConversionCta(
  html: string,
  routes: AcceptedPharmacyFirstPageRoutes | null,
): string {
  if (!routes) return html;
  const href = escAttr(routes.moneyPageHref);
  return String(html || "").replace(
    /(<section\b[^>]*data-template-block="hero"[^>]*>[\s\S]*?<div class="btns">\s*)<a class="btn"[^>]*>Contact the pharmacy<\/a>/i,
    `$1<a class="btn" href="${href}">Contact the pharmacy</a>`,
  );
}

export function connectAcceptedLocalPageServiceLinks(
  html: string,
  routes: AcceptedPharmacyFirstPageRoutes | null,
): string {
  if (!routes) return html;
  const href = escAttr(routes.servicePageHref);
  let out = String(html || "");
  out = out.replace(
    /(<nav class="local-breadcrumb[^"]*"[^>]*>)<a href="\/pharmacy-first\/?">Pharmacy First<\/a>/i,
    `$1<a href="${href}">Pharmacy First</a>`,
  );
  out = out.replace(
    /(<section\b[^>]*data-template-block="hero"[^>]*>[\s\S]*?)<a class="btn" href="\/pharmacy-first\/?">Book An Appointment<\/a>/i,
    `$1<a class="btn" href="${href}">Book An Appointment</a>`,
  );
  return out;
}
