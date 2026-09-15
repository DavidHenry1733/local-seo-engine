/**
 * Isolated presentation Preview for the shared service-notice component.
 * Request-time overlay only. Does not rewrite accepted Brook HTML, profiles,
 * or generators. Does not invent Brook service facts.
 */
import fs from "node:fs";
import path from "node:path";
import {
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  AI_PILOT_V3_PREVIEW_BANNER,
  aiLocalPagePilotHtmlPath,
  isAuthorisedAiLocalPilotV3Area,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { renderBrookSalesDemoServicePreview } from "./pharmacySalesDemoBrookServicePreview.ts";
import { pharmacyFirstEnglandNhsNotice } from "./pharmacyServiceNoticeCatalog.ts";
import { applyServiceNoticeToPageHtml } from "./pharmacyServiceNoticeComponent.ts";
import { selectServiceNoticeFromFacts } from "./pharmacyServiceNoticeSelection.ts";
import { defaultProfileServiceDelivery, type ProfileServiceDeliveryProfile } from "./pharmacyProfileV2Fields.ts";
import { normalizeProfileDoc } from "./pharmacyProfileSchema.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const SERVICE_NOTICE_DRAFT_PREVIEW_ASSET = "service-notice-draft-v1";

const AUTHORISED_LOCAL = {
  slug: "brook-pharmacy-demo-derby",
  campaignId: "pharmacy-first",
  areaSlug: "allestree",
} as const;

const AUTHORISED_SERVICE = {
  slug: "yorkshire-pharmacy-and-health-clinic",
  campaignId: "pharmacy-first",
} as const;

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function unavailable(detail: string): { html: string; sourcePath: string | null; sourceRoute: string } {
  return {
    html: `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><meta name="robots" content="noindex, nofollow"/><title>Service notice preview unavailable</title></head><body><p>${esc(detail)}</p></body></html>`,
    sourcePath: null,
    sourceRoute: "service-notice-draft-v1-unavailable",
  };
}

export function loadTenantServiceFacts(slug: string, serviceId: string): ProfileServiceDeliveryProfile | null {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  const doc = normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8")));
  return doc.data.serviceDeliveryProfiles?.[serviceId] || defaultProfileServiceDelivery(serviceId);
}

export function presentationSelectionForPreview(
  serviceId: string,
  facts: ProfileServiceDeliveryProfile | null,
): ReturnType<typeof selectServiceNoticeFromFacts> {
  return selectServiceNoticeFromFacts(serviceId, facts);
}

export function renderServiceNoticeDraftPreview(
  slug: string,
  campaignId: string,
  options: { areaSlug?: string } = {},
): { html: string; sourcePath: string | null; sourceRoute: string } {
  const areaSlug = String(options.areaSlug || "").trim().toLowerCase();
  const notice = pharmacyFirstEnglandNhsNotice();
  loadTenantServiceFacts(slug, campaignId);

  if (slug === AUTHORISED_LOCAL.slug && campaignId === AUTHORISED_LOCAL.campaignId && (areaSlug === AUTHORISED_LOCAL.areaSlug || !areaSlug)) {
    if (!isAuthorisedAiLocalPilotV3Area(slug, AUTHORISED_LOCAL.areaSlug)) {
      return unavailable("Accepted Allestree local Preview is not available for this overlay.");
    }
    const file = aiLocalPagePilotHtmlPath(slug, campaignId, AUTHORISED_LOCAL.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
    if (!fs.existsSync(file)) return unavailable("Accepted Allestree local Preview is not available for this overlay.");
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes(AI_PILOT_V3_PREVIEW_BANNER) || !/noindex,\s*nofollow/i.test(html)) {
      return unavailable("Accepted Allestree local Preview is not available for this overlay.");
    }
    return {
      html: applyServiceNoticeToPageHtml(html, notice, {
        mode: "presentation-draft",
        pageKind: "local",
      }),
      sourcePath: file,
      sourceRoute: SERVICE_NOTICE_DRAFT_PREVIEW_ASSET,
    };
  }

  if (slug === AUTHORISED_SERVICE.slug && campaignId === AUTHORISED_SERVICE.campaignId && !areaSlug) {
    const base = renderBrookSalesDemoServicePreview(slug, campaignId);
    if (base.sourceRoute !== "sales-demo-brook-service-page") {
      return unavailable("Accepted Brook service Preview is not available for this overlay.");
    }
    return {
      html: applyServiceNoticeToPageHtml(base.html, notice, {
        mode: "presentation-draft",
        pageKind: "service",
      }),
      sourcePath: base.sourcePath,
      sourceRoute: SERVICE_NOTICE_DRAFT_PREVIEW_ASSET,
    };
  }

  return unavailable("This isolated service-notice Preview is not available for this tenant.");
}
