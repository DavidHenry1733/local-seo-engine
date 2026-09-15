/**
 * Isolated unpublished Preview for the Pharmacy First service-page master template V1.
 * Restores the accepted Brook service-page implementation and overlays only compact
 * governance. Does not rewrite accepted Brook or Allestree pages.
 */
import { renderBrookSalesDemoServicePreview } from "./pharmacySalesDemoBrookServicePreview.ts";
import {
  SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  loadServicePageMasterContext,
  overlayServicePageMasterTemplateV1,
  type ServicePageMasterApproval,
  type ServicePageMasterPublicationAuthorisation,
  type ServicePageMasterPublicationRecord,
} from "./pharmacyServicePageMasterTemplateV1.ts";
import type { ProfileServiceDeliveryProfile } from "./pharmacyProfileV2Fields.ts";

export { SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET };

const AUTHORISED = {
  slug: "brook-pharmacy-demo-derby",
  campaignId: "pharmacy-first",
} as const;

const ACCEPTED_SOURCE = {
  slug: "yorkshire-pharmacy-and-health-clinic",
  campaignId: "pharmacy-first",
} as const;

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function unavailable(detail: string): { html: string; sourcePath: string | null; sourceRoute: string; pageVersionHash: string | null } {
  return {
    html: `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><meta name="robots" content="noindex, nofollow"/><title>Service page master template unavailable</title></head><body><p>${esc(detail)}</p></body></html>`,
    sourcePath: null,
    sourceRoute: `${SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET}-unavailable`,
    pageVersionHash: null,
  };
}

export function renderAcceptedBrookServicePageSource(): {
  html: string;
  sourcePath: string | null;
  sourceRoute: string;
} {
  return renderBrookSalesDemoServicePreview(ACCEPTED_SOURCE.slug, ACCEPTED_SOURCE.campaignId);
}

export function renderServicePageMasterTemplatePreview(
  slug: string,
  campaignId: string,
  options: {
    areaSlug?: string;
    facts?: ProfileServiceDeliveryProfile;
    approval?: ServicePageMasterApproval | null;
    publicationAuthorisation?: ServicePageMasterPublicationAuthorisation | null;
    publication?: ServicePageMasterPublicationRecord | null;
  } = {},
): { html: string; sourcePath: string | null; sourceRoute: string; pageVersionHash: string | null } {
  const areaSlug = String(options.areaSlug || "").trim().toLowerCase();
  if (slug !== AUTHORISED.slug || campaignId !== AUTHORISED.campaignId || areaSlug) {
    return { ...unavailable("This isolated Pharmacy First master-template Preview is not available for this tenant."), pageVersionHash: null };
  }

  const source = renderAcceptedBrookServicePageSource();
  if (source.sourceRoute !== "sales-demo-brook-service-page") {
    return unavailable("Accepted Brook service Preview is not available for this overlay.");
  }

  const context = loadServicePageMasterContext(slug, campaignId);
  const rendered = overlayServicePageMasterTemplateV1(source.html, {
    facts: options.facts || context.facts,
    clinicalReviewDate: context.clinicalReviewDate,
    approval: options.approval !== undefined ? options.approval : context.approval,
    publicationAuthorisation:
      options.publicationAuthorisation !== undefined
        ? options.publicationAuthorisation
        : context.publicationAuthorisation,
    publication: options.publication !== undefined ? options.publication : context.publication,
    tenantSlug: slug,
    campaignId,
    displayCredentials: context.displayCredentials,
    demonstrationApprovedPresentation: true,
  });

  return {
    html: rendered.html,
    sourcePath: source.sourcePath,
    sourceRoute: SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
    pageVersionHash: rendered.pageVersionHash,
  };
}
