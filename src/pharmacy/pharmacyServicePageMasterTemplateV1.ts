/**
 * Pharmacy First service-page master template V1 Preview overlay.
 * Restores the accepted Brook service-page implementation and adds only compact
 * governance. Does not rewrite accepted copy, mutate accepted HTML files, or
 * emit JSON-LD.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import {
  BROOK_SALES_DEMO_IDENTITY,
  usesBrookDemoHomepageChrome,
} from "./pharmacyBrookDemoHomepageChrome.ts";
import { normalizeProfileDoc, type PharmacyDisplayCredentials } from "./pharmacyProfileSchema.ts";
import {
  defaultProfileServiceDelivery,
  type ProfileServiceDeliveryProfile,
  type ProfileServiceFee,
} from "./pharmacyProfileV2Fields.ts";
import {
  injectServiceNoticeBeneathOverview,
  SERVICE_NOTICE_HEADING,
} from "./pharmacyServiceNoticeComponent.ts";
import { pharmacyFirstEnglandNhsNotice } from "./pharmacyServiceNoticeCatalog.ts";
import {
  DEMONSTRATION_CREDENTIALS_NOTICE,
  PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE,
  renderSharedPharmacyCredentialsHtml,
  resolveSharedPharmacyCredentials,
  SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
  SHARED_PHARMACY_CREDENTIALS_MARKER,
} from "./pharmacyTrustLayer.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  ACCEPTED_SERVICE_PAGE_ASSET,
  applyAcceptedPharmacyFirstPreviewLinks,
} from "./pharmacyAcceptedPageRouteResolverV1.ts";

export const SERVICE_PAGE_MASTER_TEMPLATE_ID = "service-page-master-template-v1";
export const SERVICE_PAGE_MASTER_TEMPLATE_VERSION = 1;
export const SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET = "service-page-master-template-v1";
export const SERVICE_PAGE_MASTER_PREVIEW_BANNER =
  "Template demonstration — example clinically reviewed and authorised presentation.";
export const SERVICE_PAGE_MASTER_PENDING_BANNER =
  "Template demonstration — clinical approval pending.";
export const SERVICE_PAGE_EMERGENCY_FOOTER =
  "This service is subject to patient eligibility and a clinical consultation with our pharmacist. If you are experiencing a medical emergency, call 999 or attend A&E.";
export const CLINICAL_REVIEW_PENDING = "Clinical review pending";
export const CONTENT_PREPARED_BY = "Content prepared by PharmaConnect";
export const EDITORIAL_LEAD_LINE =
  "Editorial lead: Mrs Jennifer Henry — Pharmacy Strategy & Sector Insight";
export const SUPERINTENDENT_PHARMACIST_ROLE = "Superintendent Pharmacist";
export const CONTENT_CLINICAL_REVIEW_HEADING = "Content and clinical review";
export const CONTENT_GOVERNANCE_HEADING = "Content governance";
export const DEMONSTRATION_APPROVAL_RECORD_LABEL = "Demonstration approval record";
export const DEMONSTRATION_APPROVED_PRESENTATION_TENANT = "brook-pharmacy-demo-derby";
export const NOT_PUBLISHED = "Not published";
export const PUBLICATION_AUTHORISATION_PENDING = "Publication authorisation pending";
export { SERVICE_NOTICE_HEADING };
export {
  DEMONSTRATION_CREDENTIALS_NOTICE,
  PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE,
  SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
  SHARED_PHARMACY_CREDENTIALS_MARKER,
};

const PROTECTED_CLINICAL_BLOCKS = [
  "service-definition",
  "conditions",
  "eligibility",
  "process",
  "safety",
] as const;

export const PHARMACY_FIRST_NOTICE_GUARANTEE_SENTENCE =
  "A consultation does not guarantee treatment or the supply of a medicine.";

export type VisibleServiceFactStatus = "confirmed" | "unknown";

export type VisibleServiceFact = {
  key: string;
  label: string;
  value: string;
  status: VisibleServiceFactStatus;
};

export type ServicePageMasterIdentity = {
  pharmacyName: string;
  location: string;
  address: string;
  phoneDisplay: string;
};

export type ServicePageMasterApproval = {
  explicitContentApproval: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  pageVersionHash: string | null;
};

export type ServicePageMasterPublicationAuthorisation = {
  explicitAuthorisation: boolean;
  authorisedBy: string | null;
  authorisedAt: string | null;
  pageVersionHash: string | null;
};

export type ServicePageMasterPublicationRecord = {
  published: boolean;
  publishedAt: string | null;
  pageVersionHash: string | null;
};

export type AcceptedServicePageInventory = {
  headings: string[];
  faqs: { question: string; answer: string }[];
  imageSrcs: string[];
  ctas: string[];
  navLabels: string[];
  templateBlocks: string[];
};

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function unknownish(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return !Number.isFinite(value);
  const raw = String(value).trim().toLowerCase();
  return raw === "" || raw === "unknown";
}

function feeFact(key: string, label: string, fee: ProfileServiceFee | undefined): VisibleServiceFact {
  const kind = String(fee?.kind || "unknown").trim().toLowerCase();
  if (unknownish(kind) || kind === "unknown") {
    return { key, label, value: "unknown", status: "unknown" };
  }
  const amount = String(fee?.amount || "").trim();
  const notes = String(fee?.notes || "").trim();
  const parts = [kind];
  if (amount) parts.push(amount);
  if (notes) parts.push(notes);
  return { key, label, value: parts.join(" — "), status: "confirmed" };
}

export function visibleServiceDeliveryFacts(facts: ProfileServiceDeliveryProfile): VisibleServiceFact[] {
  const funding = String(facts.fundingModel || "unknown").trim().toLowerCase();
  const delivery = String(facts.deliveryMode || "unknown").trim().toLowerCase();
  const fundingValue =
    funding === "nhs" ? "NHS" : funding === "private" ? "Private" : funding === "mixed" ? "NHS and private" : "unknown";
  const deliveryValue =
    delivery === "in-person"
      ? "In person"
      : delivery === "remote"
        ? "Remote"
        : delivery === "both"
          ? "In person and remote"
          : "unknown";
  const appointment: VisibleServiceFact =
    facts.appointmentRequired == null
      ? { key: "appointmentRequired", label: "Appointment", value: "unknown", status: "unknown" }
      : {
          key: "appointmentRequired",
          label: "Appointment",
          value: facts.appointmentRequired ? "Required" : "Not required",
          status: "confirmed",
        };
  const walkIn: VisibleServiceFact =
    facts.walkInAvailable == null
      ? { key: "walkInAvailable", label: "Walk-in", value: "unknown", status: "unknown" }
      : {
          key: "walkInAvailable",
          label: "Walk-in",
          value: facts.walkInAvailable ? "Yes" : "No",
          status: "confirmed",
        };
  const lengthMinutes = facts.consultationLengthMinutes;
  const lengthLabel = String(facts.consultationLengthLabel || "").trim();
  const length: VisibleServiceFact =
    lengthMinutes == null && !lengthLabel
      ? { key: "consultationLength", label: "Consultation length", value: "unknown", status: "unknown" }
      : {
          key: "consultationLength",
          label: "Consultation length",
          value: lengthLabel || `${lengthMinutes} minutes`,
          status: "confirmed",
        };

  return [
    {
      key: "fundingModel",
      label: "Funding",
      value: fundingValue,
      status: fundingValue === "unknown" ? "unknown" : "confirmed",
    },
    {
      key: "deliveryMode",
      label: "Delivery",
      value: deliveryValue,
      status: deliveryValue === "unknown" ? "unknown" : "confirmed",
    },
    appointment,
    walkIn,
    length,
    feeFact("consultationFee", "Consultation fee", facts.consultationFee),
    feeFact("treatmentFee", "Treatment fee", facts.treatmentFee),
    feeFact("followUpFee", "Follow-up fee", facts.followUpFee),
  ];
}

export function confirmedLogisticsFacts(facts: ProfileServiceDeliveryProfile): VisibleServiceFact[] {
  return visibleServiceDeliveryFacts(facts).filter((row) => row.status === "confirmed");
}

export function isExactPageVersionClinicallyApproved(
  approval: ServicePageMasterApproval | null | undefined,
  pageVersionHash: string,
): boolean {
  if (!approval) return false;
  if (approval.explicitContentApproval !== true) return false;
  if (!approval.approvedBy || !approval.approvedAt) return false;
  if (!approval.pageVersionHash || approval.pageVersionHash !== pageVersionHash) return false;
  return true;
}

export function isExactPageVersionPublicationAuthorised(
  authorisation: ServicePageMasterPublicationAuthorisation | null | undefined,
  pageVersionHash: string,
): boolean {
  if (!authorisation) return false;
  if (authorisation.explicitAuthorisation !== true) return false;
  if (!authorisation.authorisedBy || !authorisation.authorisedAt) return false;
  if (!authorisation.pageVersionHash || authorisation.pageVersionHash !== pageVersionHash) return false;
  return true;
}

export function isExactPageVersionPublished(
  publication: ServicePageMasterPublicationRecord | null | undefined,
  pageVersionHash: string,
): boolean {
  if (!publication) return false;
  if (publication.published !== true) return false;
  if (!publication.publishedAt) return false;
  if (!publication.pageVersionHash || publication.pageVersionHash !== pageVersionHash) return false;
  return true;
}

export function servicePageMasterApprovalPath(slug: string, serviceId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-service-page-master-templates/v1/approvals",
    slug,
    `${serviceId}.json`,
  );
}

export function loadServicePageMasterApproval(slug: string, serviceId: string): ServicePageMasterApproval | null {
  const file = servicePageMasterApprovalPath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  return {
    explicitContentApproval: raw.explicitContentApproval === true,
    approvedBy: String(raw.approvedBy || "").trim() || null,
    approvedAt: String(raw.approvedAt || "").trim() || null,
    pageVersionHash: String(raw.pageVersionHash || "").trim() || null,
  };
}

export function servicePageMasterPublicationAuthorisationPath(slug: string, serviceId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-service-page-master-templates/v1/publication-authorisations",
    slug,
    `${serviceId}.json`,
  );
}

export function loadServicePageMasterPublicationAuthorisation(
  slug: string,
  serviceId: string,
): ServicePageMasterPublicationAuthorisation | null {
  const file = servicePageMasterPublicationAuthorisationPath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  return {
    explicitAuthorisation: raw.explicitAuthorisation === true,
    authorisedBy: String(raw.authorisedBy || "").trim() || null,
    authorisedAt: String(raw.authorisedAt || "").trim() || null,
    pageVersionHash: String(raw.pageVersionHash || "").trim() || null,
  };
}

export function servicePageMasterPublicationPath(slug: string, serviceId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-service-page-master-templates/v1/publications",
    slug,
    `${serviceId}.json`,
  );
}

export function loadServicePageMasterPublication(
  slug: string,
  serviceId: string,
): ServicePageMasterPublicationRecord | null {
  const file = servicePageMasterPublicationPath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  return {
    published: raw.published === true,
    publishedAt: String(raw.publishedAt || "").trim() || null,
    pageVersionHash: String(raw.pageVersionHash || "").trim() || null,
  };
}

export function loadServicePageMasterContext(slug: string, serviceId: string): {
  facts: ProfileServiceDeliveryProfile;
  identity: ServicePageMasterIdentity;
  clinicalReviewDate: string;
  displayCredentials: PharmacyDisplayCredentials | null;
  approval: ServicePageMasterApproval | null;
  publicationAuthorisation: ServicePageMasterPublicationAuthorisation | null;
  publication: ServicePageMasterPublicationRecord | null;
} {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  const doc = fs.existsSync(file)
    ? normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8")))
    : null;
  const facts = doc?.data.serviceDeliveryProfiles?.[serviceId] || defaultProfileServiceDelivery(serviceId);
  const identity = usesBrookDemoHomepageChrome(slug)
    ? {
        pharmacyName: BROOK_SALES_DEMO_IDENTITY.pharmacyName,
        location: BROOK_SALES_DEMO_IDENTITY.town,
        address: BROOK_SALES_DEMO_IDENTITY.address,
        phoneDisplay: BROOK_SALES_DEMO_IDENTITY.phoneDisplay,
      }
    : {
        pharmacyName: String(doc?.data.tradingName || doc?.data.pharmacyName || slug),
        location: String(doc?.data.townCity || doc?.data.primaryTown || "").trim() || "unknown",
        address: String(doc?.data.addressLine1 || "").trim(),
        phoneDisplay: String(doc?.data.phone || "").trim(),
      };
  return {
    facts,
    identity,
    clinicalReviewDate: String(doc?.data.clinicalReviewDate || "").trim(),
    displayCredentials: doc?.data.displayCredentials || null,
    approval: loadServicePageMasterApproval(slug, serviceId),
    publicationAuthorisation: loadServicePageMasterPublicationAuthorisation(slug, serviceId),
    publication: loadServicePageMasterPublication(slug, serviceId),
  };
}

function cleanText(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function inventoryAcceptedServicePage(html: string): AcceptedServicePageInventory {
  const $ = cheerio.load(String(html || ""));
  const headings: string[] = [];
  $("main h1, main h2, main h3").each((_, el) => {
    const text = cleanText($(el).text());
    if (text) headings.push(text);
  });
  const faqs: AcceptedServicePageInventory["faqs"] = [];
  $("main .faq-q").each((_, el) => {
    const question = cleanText($(el).text());
    const answer = cleanText($(el).nextAll(".faq-a").first().text());
    if (question) faqs.push({ question, answer });
  });
  const imageSrcs: string[] = [];
  $("img[src]").each((_, el) => {
    const src = String($(el).attr("src") || "").trim();
    if (src) imageSrcs.push(src);
  });
  const ctas: string[] = [];
  $("a.btn, a.btn-white, a.btn-white-outline, a.brook-demo-pill, a.nav-cta").each((_, el) => {
    const text = cleanText($(el).text());
    if (text) ctas.push(text);
  });
  const navLabels: string[] = [];
  $("nav a").each((_, el) => {
    const text = cleanText($(el).text());
    if (text) navLabels.push(text);
  });
  const templateBlocks: string[] = [];
  $("[data-template-block]").each((_, el) => {
    const block = String($(el).attr("data-template-block") || "").trim();
    if (block) templateBlocks.push(block);
  });
  return { headings, faqs, imageSrcs, ctas, navLabels, templateBlocks };
}

export function expectedHeadingsWithNotice(sourceHeadings: string[]): string[] {
  const consultIdx = sourceHeadings.findIndex((heading) =>
    /What happens during (?:the |your )?consultation/i.test(heading),
  );
  if (consultIdx < 0) return [...sourceHeadings, SERVICE_NOTICE_HEADING];
  return [...sourceHeadings.slice(0, consultIdx), SERVICE_NOTICE_HEADING, ...sourceHeadings.slice(consultIdx)];
}

export function expectedOverlayHeadings(sourceHeadings: string[]): string[] {
  const withNotice = expectedHeadingsWithNotice(sourceHeadings);
  const extra = CONTENT_GOVERNANCE_HEADING;
  const trustIdx = withNotice.findIndex((heading) => heading === "Pharmacy credentials");
  if (trustIdx >= 0) {
    return [...withNotice.slice(0, trustIdx + 1), extra, ...withNotice.slice(trustIdx + 1)];
  }
  const faqIdx = withNotice.findIndex((heading) => /Frequently Asked Questions/i.test(heading));
  if (faqIdx >= 0) return [...withNotice.slice(0, faqIdx), extra, ...withNotice.slice(faqIdx)];
  return [...withNotice, extra];
}

export function extractProtectedClinicalText(html: string): string {
  const $ = cheerio.load(String(html || ""));
  return PROTECTED_CLINICAL_BLOCKS.map((block) =>
    cleanText($(`[data-template-block="${block}"]`).text()),
  ).join("\n");
}

export function computeServicePageMasterVersionHash(input: {
  inventory: AcceptedServicePageInventory;
  confirmedFacts: VisibleServiceFact[];
  noticeBody: string;
  protectedClinicalText: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        templateId: SERVICE_PAGE_MASTER_TEMPLATE_ID,
        templateVersion: SERVICE_PAGE_MASTER_TEMPLATE_VERSION,
        inventory: input.inventory,
        confirmedFacts: input.confirmedFacts,
        noticeBody: input.noticeBody,
        protectedClinicalText: input.protectedClinicalText,
        emergencyFooter: SERVICE_PAGE_EMERGENCY_FOOTER,
      }),
    )
    .digest("hex");
}

function approvalDateDisplay(approvedAt: string): string {
  const raw = String(approvedAt || "").trim();
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

export function clinicalReviewDisplayLines(input: {
  clinicallyApproved: boolean;
  reviewerName: string;
  approvalDate: string;
  verifiedGphcNumber?: string | null;
}): { pending: boolean; lines: string[] } {
  const name = String(input.reviewerName || "").trim();
  const date = approvalDateDisplay(input.approvalDate);
  if (!input.clinicallyApproved || !name) {
    return { pending: true, lines: [CLINICAL_REVIEW_PENDING] };
  }
  const lines = [`Clinically reviewed by ${name}, ${SUPERINTENDENT_PHARMACIST_ROLE}`];
  if (date) lines.push(`Last clinically reviewed: ${date}`);
  const gphc = String(input.verifiedGphcNumber || "").trim();
  if (gphc) lines.push(`GPhC ${gphc}`);
  return { pending: false, lines };
}

export function overlayCss(): string {
  return `<style data-master-template="${SERVICE_PAGE_MASTER_TEMPLATE_ID}">
.service-logistics-strip{margin:14px 0 0;font:600 13px/1.45 var(--font-body,inherit);color:var(--brand-muted,#5F6C7B);max-width:42rem}
section.pharmacy-service-notice[data-master-template="v1"]{display:block;box-sizing:border-box;max-width:none;width:100%;margin:0;padding:28px 0 !important;border:0;border-radius:0;background:transparent;color:inherit;text-align:center;overflow:visible}
section.pharmacy-service-notice[data-master-template="v1"] .wrap{max-width:var(--brand-container-width,1180px);margin:0 auto;padding:0 var(--brand-section-x,24px);text-align:center}
section.pharmacy-service-notice[data-master-template="v1"] .section-head{margin:0 auto 10px;max-width:none;width:100%;text-align:center}
section.pharmacy-service-notice[data-master-template="v1"] h2{margin:0 auto 10px;max-width:none;width:100%;font-size:var(--h3-size,22px);line-height:1.25;text-align:center;color:var(--brand-heading-primary,var(--brand-heading))}
section.pharmacy-service-notice[data-master-template="v1"] p{margin:0 auto;max-width:72ch;font:400 16px/1.65 var(--font-body,inherit);color:var(--brand-muted,#5d6b7f);text-align:center}
.pharmacy-shared-credentials{font-weight:400}
.pharmacy-shared-credentials .credentials-role{margin:10px 0 2px;font:700 13px/1.35 var(--font-heading,inherit);color:var(--brand-heading-primary,var(--brand-heading))}
.pharmacy-shared-credentials .credentials-role:first-child{margin-top:0}
.pharmacy-shared-credentials .credentials-value{margin:0 0 4px;max-width:none;font:400 15px/1.45 var(--font-body,inherit);color:var(--brand-muted,#5d6b7f)}
.pharmacy-shared-credentials .credentials-demo-note{margin:10px 0 0;max-width:none;font:400 12px/1.4 var(--font-body,inherit);color:var(--brand-muted,#5d6b7f)}
.content-clinical-review{display:block;width:100%;box-sizing:border-box;margin:28px 0 0;padding:20px 22px;border:1px solid var(--line,#e2e8f0);border-radius:var(--brand-radius-card,10px);background:#fff}
.content-clinical-review h3{margin:0 0 12px;font-size:var(--h3-size,18px);line-height:1.25;font-family:var(--font-heading,inherit);font-weight:700;color:var(--brand-heading-primary,var(--brand-heading))}
.content-clinical-review p{margin:0 0 8px;max-width:none;font:400 var(--body-size,16px)/var(--body-line-height,1.55) var(--font-body,inherit);font-weight:400;color:var(--brand-muted,#5d6b7f);text-align:left}
.content-clinical-review p:last-child{margin-bottom:0}
.content-governance-panel{display:block;width:100%;box-sizing:border-box;margin:20px 0 0;padding:14px 16px;border:1px solid var(--line,#e2e8f0);border-radius:12px;background:color-mix(in srgb,var(--brand-primary,#005EB8) 4%,white)}
.content-governance-panel .governance-kicker{margin:0 0 6px;font:700 11px/1.3 var(--font-body,inherit);letter-spacing:.04em;text-transform:uppercase;color:var(--brand-muted,#5d6b7f)}
.content-governance-panel h3{margin:0 0 12px;font-size:var(--h3-size,22px)}
.content-governance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 20px}
.content-governance-item .gov-label{margin:8px 0 2px;font:700 11px/1.3 var(--font-body,inherit);letter-spacing:.03em;text-transform:uppercase;color:var(--brand-muted,#5d6b7f)}
.content-governance-item .gov-label:first-child{margin-top:0}
.content-governance-item .gov-value{margin:0;font:700 14px/1.4 var(--font-heading,inherit);color:var(--brand-heading-primary,var(--brand-heading))}
.content-governance-item .gov-sub{margin:2px 0 0;font:400 13px/1.4 var(--font-body,inherit);color:var(--brand-muted,#5d6b7f)}
@media (max-width:960px){.content-governance-grid{grid-template-columns:1fr 1fr}}
.service-emergency-disclaimer-band,.brook-demo-footer .service-emergency-disclaimer-band{width:100%;box-sizing:border-box;padding:14px 24px;background:#eef5fb;background:color-mix(in srgb,var(--brand-primary,#005EB8) 8%,white);border-bottom:1px solid var(--line,#e2e8f0)}
.service-emergency-disclaimer-band .service-emergency-disclaimer,.brook-demo-footer .service-emergency-disclaimer-band .service-emergency-disclaimer{margin:0 auto;max-width:900px;font:400 16px/1.55 var(--font-body,inherit);font-weight:400;color:var(--brand-heading,#005EB8);text-align:center}
@media (max-width:639px){
  section.pharmacy-service-notice[data-master-template="v1"]{padding:20px 0 !important}
  section.pharmacy-service-notice[data-master-template="v1"] .wrap{padding:0 12px}
  .content-clinical-review{margin-top:20px;padding:16px}
  .content-governance-panel{margin-top:16px;padding:14px}
  .content-governance-grid{grid-template-columns:1fr;gap:14px}
  .service-emergency-disclaimer-band,.brook-demo-footer .service-emergency-disclaimer-band{padding:14px 16px}
}
</style>`;
}

export function renderCompactNotice(): string {
  const notice = pharmacyFirstEnglandNhsNotice();
  return `<section class="pharmacy-service-notice" id="eligibility-and-important-information" data-component="pharmacy-service-notice" data-master-template="v1" data-notice-id="${esc(notice.id)}" data-ai-rewrite="forbidden">
<div class="wrap">
<div class="section-head center"><h2>${esc(SERVICE_NOTICE_HEADING)}</h2></div>
<p>${esc(notice.body)}</p>
</div>
</section>`;
}

function renderLogisticsStrip(facts: VisibleServiceFact[]): string {
  if (!facts.length) return "";
  const text = facts.map((row) => `${row.label}: ${row.value}`).join(" · ");
  return `<p class="service-logistics-strip" data-component="service-logistics-strip">${esc(text)}</p>`;
}

export function renderContentClinicalReviewBlock(input: {
  clinicallyApproved: boolean;
  reviewerName: string;
  approvalDate: string;
  verifiedGphcNumber?: string | null;
  published: boolean;
  publishedAt: string;
  publicationAuthorised: boolean;
  authorisedBy: string;
  authorisedAt: string;
}): string {
  const review = clinicalReviewDisplayLines({
    clinicallyApproved: input.clinicallyApproved,
    reviewerName: input.reviewerName,
    approvalDate: input.approvalDate,
    verifiedGphcNumber: input.verifiedGphcNumber,
  });
  const publishedDate = approvalDateDisplay(input.publishedAt);
  const publicationStatus =
    input.published && publishedDate ? `First published ${publishedDate}` : NOT_PUBLISHED;
  const authoriser = String(input.authorisedBy || "").trim();
  const authorisedDate = approvalDateDisplay(input.authorisedAt);
  const authorisationPending = !input.publicationAuthorised || !authoriser;
  const reviewLines = review.pending
    ? [`Clinical review: ${CLINICAL_REVIEW_PENDING}`]
    : review.lines.map((line, index) => (index === 0 ? `Clinical review: ${line}` : line));
  const authorisationLines = authorisationPending
    ? [`Publication authorisation: ${PUBLICATION_AUTHORISATION_PENDING}`]
    : [
        `Publication authorised by ${authoriser}`,
        ...(authorisedDate ? [`Authorised for publication: ${authorisedDate}`] : []),
      ];
  return `<div class="content-clinical-review" data-component="content-clinical-review">
<h3>${esc(CONTENT_CLINICAL_REVIEW_HEADING)}</h3>
<p>${esc(CONTENT_PREPARED_BY)}</p>
<p>${esc(EDITORIAL_LEAD_LINE)}</p>
<p data-publication-status="${input.published && publishedDate ? "published" : "unpublished"}">Publication status: ${esc(publicationStatus)}</p>
${reviewLines.map((line) => `<p data-clinical-review="${review.pending ? "pending" : "approved"}">${esc(line)}</p>`).join("")}
${authorisationLines.map((line) => `<p data-publication-authorisation="${authorisationPending ? "pending" : "authorised"}">${esc(line)}</p>`).join("")}
</div>`;
}

export function renderDemonstrationContentGovernancePanel(): string {
  return `<div class="content-governance-panel" data-component="content-governance-panel" data-demonstration-approval="true" data-approval-record="false">
<p class="governance-kicker">${esc(DEMONSTRATION_APPROVAL_RECORD_LABEL)}</p>
<h3>${esc(CONTENT_GOVERNANCE_HEADING)}</h3>
<div class="content-governance-grid">
<div class="content-governance-item">
<p class="gov-label">Content created by</p>
<p class="gov-value">PharmaConnect</p>
<p class="gov-sub">Pharmacy strategy and sector insight</p>
<p class="gov-value">Mrs Jennifer Henry</p>
</div>
<div class="content-governance-item">
<p class="gov-label">Clinically reviewed and approved by</p>
<p class="gov-value">Mr John Ward — Superintendent Pharmacist</p>
<p class="gov-sub">Demo GPhC No. 453756</p>
<p class="gov-label">Clinical review date</p>
<p class="gov-value">5 September 2026</p>
</div>
<div class="content-governance-item">
<p class="gov-label">Publication authorised by</p>
<p class="gov-value">Mr John Ward — Superintendent Pharmacist</p>
<p class="gov-label">Publication date</p>
<p class="gov-value">5 September 2026</p>
</div>
</div>
</div>`;
}

function shouldShowDemonstrationApprovedPresentation(options: {
  demonstrationApprovedPresentation?: boolean;
  tenantSlug?: string;
}): boolean {
  return (
    options.demonstrationApprovedPresentation === true &&
    String(options.tenantSlug || "").trim().toLowerCase() === DEMONSTRATION_APPROVED_PRESENTATION_TENANT
  );
}

function insertLogisticsNearHeroCta(html: string, strip: string): string {
  if (!strip) return html;
  const heroBtns = /(<section\b[^>]*data-template-block="hero"[^>]*>[\s\S]*?<div class="btns">[\s\S]*?<\/div>)/i;
  if (!heroBtns.test(html)) return html;
  return html.replace(heroBtns, `$1\n${strip}`);
}

function replacePharmacyCredentialsGrid(html: string, credentialsHtml: string): string {
  if (!credentialsHtml) return html;
  const exact =
    /(<div class="trust-media">\s*<h3>Pharmacy credentials<\/h3>\s*)<div class="trust-grid"><div class="trust-item">✓ Consultation Room Available<\/div><\/div>/i;
  if (exact.test(html)) return html.replace(exact, `$1${credentialsHtml}`);
  return html;
}

function insertAfterOpenDiv(html: string, openNeedle: string, insert: string): string | null {
  const idx = html.indexOf(openNeedle);
  if (idx < 0) return null;
  const re = /<div\b[^>]*>|<\/div>/gi;
  re.lastIndex = idx;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    if (match[0].startsWith("<div")) depth += 1;
    else depth -= 1;
    if (depth === 0) {
      const end = match.index + match[0].length;
      return `${html.slice(0, end)}${insert}${html.slice(end)}`;
    }
  }
  return null;
}

export function insertTrustGovernance(html: string, block: string): string {
  if (/data-component="content-clinical-review"|data-component="content-governance-panel"/i.test(html)) {
    return html;
  }
  const afterSplit = insertAfterOpenDiv(html, '<div class="grid-2 trust-split-row">', block);
  if (afterSplit) return afterSplit;
  const re = /(<section\b[^>]*data-template-block="trust-split"[^>]*>[\s\S]*?)(<\/div>\s*<\/section>)/i;
  if (!re.test(html)) return html;
  return html.replace(re, `$1${block}$2`);
}

export function insertDisclaimerBand(html: string): string {
  const band = `<div class="service-emergency-disclaimer-band" data-component="service-emergency-disclaimer"><p class="service-emergency-disclaimer">${esc(SERVICE_PAGE_EMERGENCY_FOOTER)}</p></div>`;
  let out = String(html || "")
    .replace(/<div class="content-attribution"[\s\S]*?<\/div>/gi, "")
    .replace(/<div class="service-emergency-disclaimer-band"[\s\S]*?<\/div>/gi, "")
    .replace(/<p class="service-emergency-disclaimer"[^>]*>[\s\S]*?<\/p>/gi, "");
  if (/data-sales-demo-brook="footer"/i.test(out)) {
    return out.replace(/(<footer\b[^>]*data-sales-demo-brook="footer"[^>]*>)/i, `$1${band}`);
  }
  if (/<footer\b/i.test(out)) return out.replace(/<footer\b[^>]*>/i, (open) => `${open}${band}`);
  return `${out}${band}`;
}

export function disableStructuredData(html: string, pageVersionHash: string): string {
  let out = String(html || "").replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, "");
  const slot = `<template data-schema-slot="${SERVICE_PAGE_MASTER_TEMPLATE_ID}" data-schema-enabled="false" data-page-version-hash="${esc(pageVersionHash)}" hidden></template>`;
  if (/data-schema-slot="/i.test(out)) return out;
  if (out.includes("</head>")) return out.replace(/<\/head>/i, `${slot}\n</head>`);
  return `${slot}${out}`;
}

function applyPreviewBanner(html: string, banner: string): string {
  const style = `<style data-preview-toolbar="${SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET}">.pharmacy-review-preview-toolbar{position:sticky;top:0;z-index:10001;min-height:40px;box-sizing:border-box;background:#eff6ff;border-bottom:1px solid #bfdbfe;color:#1e40af;font:800 13px/1.4 Inter,system-ui,sans-serif;text-align:center;padding:10px 16px}.pharmacy-review-preview-toolbar~.site-header{top:auto}html{scroll-padding-top:130px}section[id]{scroll-margin-top:130px}</style>`;
  const toolbar = `<div class="pharmacy-review-preview-toolbar" data-component="review-preview-toolbar">${esc(banner)}</div>`;
  let out = String(html || "");
  out = out.replace(/<span class="pharmacy-sales-demo-notice">[\s\S]*?<\/span>/gi, "");
  if (/data-component="review-preview-toolbar"/i.test(out)) {
    out = out.replace(/<div class="pharmacy-review-preview-toolbar"[^>]*>[\s\S]*?<\/div>/i, toolbar);
  } else {
    out = out.replace(/<body\b[^>]*>/i, (match) => `${match}\n${toolbar}`);
  }
  if (!out.includes(`data-preview-toolbar="${SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET}"`)) {
    out = out.includes("</head>") ? out.replace(/<\/head>/i, `${style}\n</head>`) : `${style}${out}`;
  }
  return out;
}

export function overlayServicePageMasterTemplateV1(
  sourceHtml: string,
  options: {
    facts: ProfileServiceDeliveryProfile;
    clinicalReviewDate: string;
    approval?: ServicePageMasterApproval | null;
    publicationAuthorisation?: ServicePageMasterPublicationAuthorisation | null;
    publication?: ServicePageMasterPublicationRecord | null;
    verifiedGphcNumber?: string | null;
    tenantSlug?: string;
    campaignId?: string;
    displayCredentials?: PharmacyDisplayCredentials | null;
    demonstrationApprovedPresentation?: boolean;
  },
): {
  html: string;
  pageVersionHash: string;
  inventory: AcceptedServicePageInventory;
  confirmedFacts: VisibleServiceFact[];
  clinicallyApproved: boolean;
  publicationAuthorised: boolean;
  published: boolean;
  schemaEnabled: boolean;
} {
  const inventory = inventoryAcceptedServicePage(sourceHtml);
  const notice = pharmacyFirstEnglandNhsNotice();
  const confirmedFacts = confirmedLogisticsFacts(options.facts);
  const protectedClinicalText = extractProtectedClinicalText(sourceHtml);
  const pageVersionHash = computeServicePageMasterVersionHash({
    inventory,
    confirmedFacts,
    noticeBody: notice.body,
    protectedClinicalText,
  });
  const clinicallyApproved = isExactPageVersionClinicallyApproved(options.approval, pageVersionHash);
  const publicationAuthorised = isExactPageVersionPublicationAuthorised(
    options.publicationAuthorisation,
    pageVersionHash,
  );
  const published = isExactPageVersionPublished(options.publication, pageVersionHash);
  const reviewerName = String(options.facts.clinicalReviewerName || "").trim();
  const sharedCredentials = resolveSharedPharmacyCredentials({
    slug: String(options.tenantSlug || ""),
    credentials: options.displayCredentials || null,
    surface: SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
  });
  const verifiedGphcNumber =
    sharedCredentials && !sharedCredentials.verified ? null : options.verifiedGphcNumber;
  const demonstrationApprovedPresentation = shouldShowDemonstrationApprovedPresentation(options);
  let html = String(sourceHtml || "");
  html = insertLogisticsNearHeroCta(html, renderLogisticsStrip(confirmedFacts));
  html = injectServiceNoticeBeneathOverview(html, renderCompactNotice(), "service");
  html = replacePharmacyCredentialsGrid(html, renderSharedPharmacyCredentialsHtml(sharedCredentials));
  html = insertTrustGovernance(
    html,
    demonstrationApprovedPresentation
      ? renderDemonstrationContentGovernancePanel()
      : renderContentClinicalReviewBlock({
          clinicallyApproved,
          reviewerName,
          approvalDate: String(options.approval?.approvedAt || ""),
          verifiedGphcNumber,
          published,
          publishedAt: String(options.publication?.publishedAt || ""),
          publicationAuthorised,
          authorisedBy: String(options.publicationAuthorisation?.authorisedBy || ""),
          authorisedAt: String(options.publicationAuthorisation?.authorisedAt || ""),
        }),
  );
  html = insertDisclaimerBand(html);
  html = disableStructuredData(html, pageVersionHash);
  if (!html.includes(`data-master-template="${SERVICE_PAGE_MASTER_TEMPLATE_ID}"`)) {
    html = html.includes("</head>") ? html.replace(/<\/head>/i, `${overlayCss()}\n</head>`) : `${overlayCss()}${html}`;
  }
  html = applyPreviewBanner(
    html,
    demonstrationApprovedPresentation ? SERVICE_PAGE_MASTER_PREVIEW_BANNER : SERVICE_PAGE_MASTER_PENDING_BANNER,
  );
  html = applyAcceptedPharmacyFirstPreviewLinks(html, {
    slug: String(options.tenantSlug || ""),
    campaignId: String(options.campaignId || "pharmacy-first"),
    asset: ACCEPTED_SERVICE_PAGE_ASSET,
  });
  if (!/noindex,\s*nofollow/i.test(html)) {
    html = /<meta name="robots"/i.test(html)
      ? html.replace(/<meta name="robots" content="[^"]*"/i, '<meta name="robots" content="noindex, nofollow"')
      : html.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex, nofollow"/>');
  }
  return {
    html,
    pageVersionHash,
    inventory,
    confirmedFacts,
    clinicallyApproved,
    publicationAuthorised,
    published,
    schemaEnabled: false,
  };
}
