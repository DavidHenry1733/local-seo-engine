/**
 * Request-time Pharmacy First local-page Preview overlay.
 * Reuses passed service-page-master-template-v1 compliance fragments.
 * Does not rewrite saved local HTML, copy records, evidence, or approval files.
 */
import { BROOK_DERBY_DEMO_SLUG } from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import {
  ACCEPTED_LOCAL_PAGE_ASSET,
  applyAcceptedPharmacyFirstPreviewLinks,
} from "./pharmacyAcceptedPageRouteResolverV1.ts";
import { injectServiceNoticeBeneathOverview } from "./pharmacyServiceNoticeComponent.ts";
import {
  disableStructuredData,
  insertDisclaimerBand,
  insertTrustGovernance,
  loadServicePageMasterContext,
  overlayCss,
  renderCompactNotice,
  renderContentClinicalReviewBlock,
  renderDemonstrationContentGovernancePanel,
} from "./pharmacyServicePageMasterTemplateV1.ts";
import {
  PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE,
  SHARED_PHARMACY_CREDENTIALS_MARKER,
  renderSharedPharmacyCredentialsHtml,
  resolveSharedPharmacyCredentials,
} from "./pharmacyTrustLayer.ts";

export { PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE };

export const PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_OVERLAY = "pharmacy-first-local-page-preview";
export const PHARMACY_FIRST_LOCAL_PAGE_SCHEMA_INACTIVE_HASH = "preview-inactive";
export const YORKSHIRE_PHARMACY_SLUG = "yorkshire-pharmacy-and-health-clinic";

export function applyPharmacyFirstRendererOwnedDisclaimers(
  html: string,
  pageKind: "service" | "local",
): string {
  const source = String(html || "");
  if (!source) return source;
  let out = source;
  out = injectServiceNoticeBeneathOverview(out, renderCompactNotice(), pageKind);
  out = insertDisclaimerBand(out);
  if (!out.includes(`data-master-template="service-page-master-template-v1"`)) {
    out = out.includes("</head>")
      ? out.replace(/<\/head>/i, `${overlayCss()}\n</head>`)
      : `${overlayCss()}${out}`;
  }
  return out;
}

function stripAdHocPharmacyFirstRequiredDisclaimers(html: string): string {
  return String(html || "")
    .replace(/<style[^>]*data-pharmacy-first-required-disclaimers="css"[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<aside\b[^>]*data-component="pharmacy-first-required-disclaimers"[^>]*>[\s\S]*?<\/aside>\s*/gi, "");
}

/**
 * Restore the locked Pharmacy First service-page structure:
 * body service notice, footer emergency disclaimer, and Trust / Reviewed By governance.
 * Does not rewrite service copy, approval, or identity.
 */
export function applyLockedPharmacyFirstServicePageStructure(html: string): string {
  return applyLockedPharmacyFirstPageStructure(html, "service");
}

export function applyLockedPharmacyFirstLocalPageStructure(html: string): string {
  return applyLockedPharmacyFirstPageStructure(html, "local");
}

function applyLockedPharmacyFirstPageStructure(html: string, pageKind: "service" | "local"): string {
  const source = String(html || "");
  if (!source) return source;
  let out = stripAdHocPharmacyFirstRequiredDisclaimers(source);
  out = applyPharmacyFirstRendererOwnedDisclaimers(out, pageKind);
  out = insertTrustGovernance(
    out,
    renderContentClinicalReviewBlock({
      clinicallyApproved: false,
      reviewerName: "",
      approvalDate: "",
      published: false,
      publishedAt: "",
      publicationAuthorised: false,
      authorisedBy: "",
      authorisedAt: "",
    }),
  );
  return out;
}

const LOCAL_CREDENTIALS_CSS = `<style data-local-preview-overlay="${PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_OVERLAY}">.trust-media > .trust-grid{grid-template-columns:minmax(0,1fr);margin-top:0;margin-bottom:16px}</style>`;

function insertCredentialsIntoTrustMedia(html: string, credentialsHtml: string): string {
  if (!credentialsHtml) return html;
  if (html.includes(`data-component="${SHARED_PHARMACY_CREDENTIALS_MARKER}"`)) return html;
  const open = /(<div class="trust-media">)/i;
  if (!open.test(html)) return html;
  return html.replace(open, `$1\n<h3>Pharmacy credentials</h3>\n${credentialsHtml}`);
}

function injectPassedOverlayCss(html: string): string {
  let out = String(html || "");
  if (!out.includes(`data-master-template="service-page-master-template-v1"`)) {
    out = out.includes("</head>")
      ? out.replace(/<\/head>/i, `${overlayCss()}\n</head>`)
      : `${overlayCss()}${out}`;
  }
  if (!out.includes(`data-local-preview-overlay="${PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_OVERLAY}"`)) {
    out = out.includes("</head>")
      ? out.replace(/<\/head>/i, `${LOCAL_CREDENTIALS_CSS}\n</head>`)
      : `${LOCAL_CREDENTIALS_CSS}${out}`;
  }
  return out;
}

export function overlayPharmacyFirstLocalPagePreviewHtml(
  html: string,
  options: { slug: string; campaignId: string; areaSlug?: string },
): string {
  const slug = String(options.slug || "").trim().toLowerCase();
  const campaignId = String(options.campaignId || "").trim().toLowerCase();
  if (campaignId !== "pharmacy-first") return html;
  if (slug === YORKSHIRE_PHARMACY_SLUG) {
    return applyPharmacyFirstRendererOwnedDisclaimers(html, "local");
  }
  if (slug !== BROOK_DERBY_DEMO_SLUG) {
    return applyLockedPharmacyFirstLocalPageStructure(html);
  }
  const source = String(html || "");
  if (!source) return source;

  const context = loadServicePageMasterContext(slug, campaignId);
  const sharedCredentials = resolveSharedPharmacyCredentials({
    slug,
    credentials: context.displayCredentials,
    surface: PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE,
  });

  let out = source;
  out = injectServiceNoticeBeneathOverview(out, renderCompactNotice(), "local");
  out = insertCredentialsIntoTrustMedia(out, renderSharedPharmacyCredentialsHtml(sharedCredentials));
  out = insertTrustGovernance(out, renderDemonstrationContentGovernancePanel());
  out = insertDisclaimerBand(out);
  out = disableStructuredData(out, PHARMACY_FIRST_LOCAL_PAGE_SCHEMA_INACTIVE_HASH);
  out = injectPassedOverlayCss(out);
  out = applyAcceptedPharmacyFirstPreviewLinks(out, {
    slug,
    campaignId,
    asset: ACCEPTED_LOCAL_PAGE_ASSET,
  });
  return out;
}
