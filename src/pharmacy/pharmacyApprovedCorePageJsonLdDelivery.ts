/**
 * APPROVED-CORE-PAGE-JSONLD-DELIVERY-29H —
 * Shared request-time JSON-LD delivery for approved core service and locality pages.
 * Always JSON.stringify structured objects. Does not change visible body content.
 */
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import {
  applyApprovedCorePageJsonLd,
  extractRenderedFaqsFromHtml,
  type VisualServicePageSchemaContext,
} from "./pharmacyVisualExperienceSchemaEnrichment.ts";

export interface ApprovedCorePageJsonLdRenderContext {
  slug: string;
  serviceId: string;
  localitySlug?: string;
  localityName?: string;
}

function titleCaseLocality(slug: string): string {
  return String(slug || "")
    .trim()
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractMetaDescription(html: string): string {
  return (
    String(html || "").match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ||
    ""
  );
}

function extractLocalityName(html: string, localitySlug: string): string {
  const fromAttr = String(html || "").match(/data-local-cluster=["']([^"']+)["']/i)?.[1];
  if (fromAttr && fromAttr.replace(/[-_]+/g, " ").toLowerCase() !== localitySlug.replace(/[-_]+/g, " ").toLowerCase()) {
    return titleCaseLocality(fromAttr);
  }
  const h1 = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
  const titled = titleCaseLocality(localitySlug);
  if (h1 && new RegExp(titled.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(h1)) return titled;
  if (h1) {
    const fromPatients = h1.match(/from\s+([A-Za-z][A-Za-z\s-]+?)(?:\s*[|.]|$)/i)?.[1]?.trim();
    if (fromPatients) return fromPatients;
    const fromIn = h1.match(/\bin\s+([A-Za-z][A-Za-z\s-]+?)(?:\s*[|.]|$)/i)?.[1]?.trim();
    if (fromIn) return fromIn;
  }
  return titled;
}

export function resolveApprovedCorePageJsonLdContext(
  html: string,
  render: ApprovedCorePageJsonLdRenderContext,
): VisualServicePageSchemaContext {
  const profile = buildPharmacyServicePageProfile(render.slug);
  const serviceId = String(render.serviceId || "").trim();
  const serviceName = getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ");
  const town = profile.town || "your area";
  const website = String(profile.website || "").replace(/\/+$/, "");
  const localitySlug = String(render.localitySlug || "").trim();
  const localityName = localitySlug
    ? String(render.localityName || "").trim() || extractLocalityName(html, localitySlug)
    : undefined;
  const metaDescription =
    extractMetaDescription(html) ||
    (localityName
      ? `${profile.pharmacyName} provides ${serviceName} for patients in ${localityName}.`
      : `${profile.pharmacyName} in ${town} — ${serviceName}.`);
  const urlPath = localitySlug ? `/${serviceId}/local/${localitySlug}/` : `/${serviceId}/`;
  const pageUrl = website ? `${website}${urlPath}` : urlPath;
  return {
    serviceName,
    pharmacyName: profile.pharmacyName,
    town,
    pageUrl,
    metaDescription,
    website: website || pageUrl,
    serviceId,
    localitySlug: localitySlug || undefined,
    localityName,
  };
}

/** Replace delivered JSON-LD in head only. Visible body HTML is unchanged. */
export function deliverApprovedCorePageJsonLd(
  html: string,
  render: ApprovedCorePageJsonLdRenderContext,
): string {
  const source = String(html || "");
  if (!String(render.serviceId || "").trim()) return source;
  const ctx = resolveApprovedCorePageJsonLdContext(source, render);
  const faqs = extractRenderedFaqsFromHtml(source);
  return applyApprovedCorePageJsonLd(source, ctx, faqs);
}
