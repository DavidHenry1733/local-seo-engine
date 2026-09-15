/**
 * Pharmacy First service-page master template V1.
 * Reusable renderer-owned sections. Does not rewrite accepted Brook or Allestree HTML.
 * Unknown profile values are omitted or labelled unknown. Never infers free, available,
 * walk-in, eligibility, treatment, or medicine supply.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1 } from "./contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  BROOK_SALES_DEMO_BRAND,
  BROOK_SALES_DEMO_IDENTITY,
  applyBrookHomepageChrome,
  brookHomepageChromeCss,
  brookHomepageFontsLink,
  renderBrookHomepageFooter,
  renderBrookHomepageHeader,
  usesBrookDemoHomepageChrome,
} from "./pharmacyBrookDemoHomepageChrome.ts";
import { normalizeProfileDoc } from "./pharmacyProfileSchema.ts";
import {
  defaultProfileServiceDelivery,
  type ProfileServiceDeliveryProfile,
  type ProfileServiceFee,
} from "./pharmacyProfileV2Fields.ts";
import {
  applyServiceNoticeToPageHtml,
} from "./pharmacyServiceNoticeComponent.ts";
import { pharmacyFirstEnglandNhsNotice } from "./pharmacyServiceNoticeCatalog.ts";
import {
  selectServiceNoticeFromFacts,
  type ServiceNoticeSelection,
} from "./pharmacyServiceNoticeSelection.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const SERVICE_PAGE_MASTER_TEMPLATE_ID = "service-page-master-template-v1";
export const SERVICE_PAGE_MASTER_TEMPLATE_VERSION = 1;
export const SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET = "service-page-master-template-v1";
export const SERVICE_PAGE_MASTER_PREVIEW_BANNER =
  "Template demonstration — clinical approval pending.";
export const SERVICE_PAGE_EMERGENCY_FOOTER =
  "This service is subject to patient eligibility and a clinical consultation with our pharmacist. If you are experiencing a medical emergency, call 999 or attend A&E.";
export const CLINICALLY_REVIEWED_AND_APPROVED = "Clinically reviewed and approved";
export const CLINICAL_APPROVAL_PENDING = "Clinical approval pending";
export const REVIEWER_IDENTITY_NOT_APPROVAL =
  "Confirming a reviewer’s identity does not approve this page content.";

export const SERVICE_PAGE_MASTER_TEMPLATE_SECTIONS = [
  "hero",
  "service-facts",
  "service-overview",
  "eligibility-notice",
  "consultation",
  "safety",
  "faq",
  "clinical-review",
  "emergency-disclaimer",
  "structured-data-slot",
] as const;

export type ServicePageMasterTemplateSection = (typeof SERVICE_PAGE_MASTER_TEMPLATE_SECTIONS)[number];

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

export type ServicePageMasterRenderInput = {
  slug: string;
  serviceId: string;
  facts: ProfileServiceDeliveryProfile;
  identity: ServicePageMasterIdentity;
  clinicalReviewDate: string;
  approval?: ServicePageMasterApproval | null;
};

export type ServicePageMasterRenderResult = {
  html: string;
  pageVersionHash: string;
  sections: ServicePageMasterTemplateSection[];
  noticeSelection: ServiceNoticeSelection;
  clinicallyApproved: boolean;
  schemaEnabled: boolean;
  visibleFacts: VisibleServiceFact[];
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

export function computeServicePageMasterVersionHash(input: {
  slug: string;
  serviceId: string;
  facts: ProfileServiceDeliveryProfile;
  identity: ServicePageMasterIdentity;
  clinicalReviewDate: string;
  noticeId: string;
  noticeVersion: number;
  noticeBody: string;
}): string {
  const payload = {
    templateId: SERVICE_PAGE_MASTER_TEMPLATE_ID,
    templateVersion: SERVICE_PAGE_MASTER_TEMPLATE_VERSION,
    slug: input.slug,
    serviceId: input.serviceId,
    identity: input.identity,
    facts: visibleServiceDeliveryFacts(input.facts),
    clinicalReviewDate: String(input.clinicalReviewDate || "").trim(),
    notice: {
      id: input.noticeId,
      version: input.noticeVersion,
      body: input.noticeBody,
    },
    lockedClinicalFacts: PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
    emergencyFooter: SERVICE_PAGE_EMERGENCY_FOOTER,
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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

export function selectNoticeForMasterTemplate(
  serviceId: string,
  facts: ProfileServiceDeliveryProfile,
): ServiceNoticeSelection {
  const selected = selectServiceNoticeFromFacts(serviceId, facts);
  if (selected.mode === "profile-matched" && selected.notice) return selected;
  return {
    mode: "presentation-draft",
    notice: pharmacyFirstEnglandNhsNotice(),
    reasons: selected.reasons.length ? selected.reasons : ["presentation-draft-unmatched-facts"],
  };
}

export function loadServicePageMasterContext(slug: string, serviceId: string): {
  facts: ProfileServiceDeliveryProfile;
  identity: ServicePageMasterIdentity;
  clinicalReviewDate: string;
  approval: ServicePageMasterApproval | null;
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
    approval: loadServicePageMasterApproval(slug, serviceId),
  };
}

function masterTemplateCss(): string {
  const b = BROOK_SALES_DEMO_BRAND;
  return `<style data-master-template="${SERVICE_PAGE_MASTER_TEMPLATE_ID}">
:root{
  --brand-primary:${b.primary};
  --brand-cta:${b.cta};
  --brand-accent:${b.accent};
  --brand-heading:#004281;
  --brand-text:${b.charcoal};
  --brand-muted:${b.slate};
  --brand-surface:#f8fafc;
  --line:#e2e8f0;
  --font-heading:${b.headingFont};
  --font-body:${b.bodyFont};
  --wrap:1180px;
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--font-body);color:var(--brand-text);background:#fff;line-height:1.65}
.wrap{width:min(100% - 48px,var(--wrap));max-width:var(--wrap);margin:0 auto}
main section{padding:72px 0}
h1,h2,h3,.faq-q{font-family:var(--font-heading);color:var(--brand-heading);margin:0 0 16px;line-height:1.12}
h1{font-size:clamp(2rem,4vw,3.25rem);letter-spacing:-1.5px;font-weight:800;overflow-wrap:anywhere}
h2{font-size:clamp(1.5rem,3vw,2.25rem);letter-spacing:-.6px;font-weight:800}
p,li{font-size:17px;color:var(--brand-muted);max-width:72ch}
.eyebrow{display:inline-flex;align-items:center;padding:8px 13px;border-radius:999px;background:color-mix(in srgb,var(--brand-primary) 12%,white);font:800 12px/1.2 var(--font-heading);text-transform:uppercase;letter-spacing:.08em;color:var(--brand-primary);margin-bottom:18px}
.hero{background:linear-gradient(180deg,var(--brand-surface),#fff);border-bottom:1px solid var(--line);padding:72px 0 64px}
.hero p{font-size:20px;max-width:720px}
.soft{background:var(--brand-surface)}
.facts-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0;padding:0;list-style:none}
.fact-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 16px;min-width:0}
.fact-card dt{font:800 12px/1.3 var(--font-heading);text-transform:uppercase;letter-spacing:.06em;color:var(--brand-primary);margin:0 0 8px}
.fact-card dd{margin:0;font:700 16px/1.4 var(--font-body);color:var(--brand-heading);overflow-wrap:anywhere}
.fact-card[data-fact-status="unknown"] dd{color:var(--brand-muted);font-weight:600}
.section-head{max-width:800px;margin:0 0 24px}
.faq-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px 22px;margin:0 0 14px;box-shadow:0 10px 26px rgba(26,51,71,.08)}
.faq-q{font-size:18px;margin:0 0 10px}
.faq-a{margin:0}
.review-record{background:#fff;border:1px solid var(--line);border-radius:12px;padding:24px}
.review-record[data-clinical-approval="pending"]{border-color:#bfdbfe;background:#f8fbff}
.emergency-disclaimer{margin:0;font:600 16px/1.55 var(--font-body);color:var(--brand-text);max-width:72ch}
@media (max-width:980px){
  .wrap{width:min(100% - 32px,var(--wrap))}
  main section{padding:48px 0}
  .facts-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:639px){
  .wrap{width:min(100% - 24px,var(--wrap))}
  main section,.hero{padding:36px 0}
  h1{font-size:1.7rem;letter-spacing:-.6px}
  .facts-grid{grid-template-columns:1fr}
  .fact-card,.faq-card,.review-record{padding:16px}
}
@media (min-width:1440px){
  .wrap{width:min(100% - 48px,1180px)}
}
</style>`;
}

function renderFactsSection(facts: VisibleServiceFact[]): string {
  const items = facts
    .map(
      (fact) => `<div class="fact-card" data-fact-key="${esc(fact.key)}" data-fact-status="${esc(fact.status)}"><dt>${esc(fact.label)}</dt><dd>${esc(fact.value)}</dd></div>`,
    )
    .join("");
  return `<section class="soft" id="service-facts" data-template-block="service-facts">
<div class="wrap">
<div class="section-head"><h2>Confirmed funding, delivery, appointment and fee facts</h2></div>
<dl class="facts-grid">${items}</dl>
</div>
</section>`;
}

function renderClinicalReviewRecord(input: {
  clinicallyApproved: boolean;
  clinicalReviewDate: string;
  facts: ProfileServiceDeliveryProfile;
  pageVersionHash: string;
}): string {
  const approved = input.clinicallyApproved;
  const date = String(input.clinicalReviewDate || "").trim() || "unknown";
  const reviewerName = String(input.facts.clinicalReviewerName || "").trim();
  const reviewerRole = String(input.facts.clinicalReviewerRole || "").trim();
  const reviewerStatus = String(input.facts.clinicalReviewerStatus || "unknown").trim() || "unknown";
  const identityBits = [reviewerName, reviewerRole].filter(Boolean).join(", ");
  const identityLine = identityBits
    ? `<p data-reviewer-identity="true">Reviewer identity: ${esc(identityBits)} (${esc(reviewerStatus)}). ${esc(REVIEWER_IDENTITY_NOT_APPROVAL)}</p>`
    : `<p data-reviewer-identity="false">Reviewer identity: unknown. ${esc(REVIEWER_IDENTITY_NOT_APPROVAL)}</p>`;
  const statusLine = approved
    ? `<p data-clinical-approval-status="approved"><strong>${esc(CLINICALLY_REVIEWED_AND_APPROVED)}</strong></p>`
    : `<p data-clinical-approval-status="pending"><strong>${esc(CLINICAL_APPROVAL_PENDING)}</strong>. ${esc(REVIEWER_IDENTITY_NOT_APPROVAL)}</p>`;
  return `<section class="soft" id="clinical-review" data-template-block="clinical-review" data-clinical-approval="${approved ? "approved" : "pending"}" data-page-version-hash="${esc(input.pageVersionHash)}">
<div class="wrap">
<div class="section-head"><h2>Clinical review record</h2></div>
<div class="review-record" data-clinical-approval="${approved ? "approved" : "pending"}">
${statusLine}
<p data-review-date="${esc(date)}">Review date: ${esc(date)}</p>
${identityLine}
<p>Page version: ${esc(input.pageVersionHash.slice(0, 12))}</p>
</div>
</div>
</section>`;
}

export function renderServicePageMasterTemplateV1(input: ServicePageMasterRenderInput): ServicePageMasterRenderResult {
  const facts = input.facts;
  const identity = input.identity;
  const visibleFacts = visibleServiceDeliveryFacts(facts);
  const noticeSelection = selectNoticeForMasterTemplate(input.serviceId, facts);
  const notice = noticeSelection.notice || pharmacyFirstEnglandNhsNotice();
  const pageVersionHash = computeServicePageMasterVersionHash({
    slug: input.slug,
    serviceId: input.serviceId,
    facts,
    identity,
    clinicalReviewDate: input.clinicalReviewDate,
    noticeId: notice.id,
    noticeVersion: notice.version,
    noticeBody: notice.body,
  });
  const clinicallyApproved = isExactPageVersionClinicallyApproved(input.approval, pageVersionHash);
  const schemaEnabled = clinicallyApproved;
  const locked = PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1;
  const h1 = `${locked.serviceName} at ${identity.pharmacyName}, ${identity.location}`;
  const schemaSlot = `<div id="structured-data-slot" data-template-block="structured-data-slot" data-schema-slot="${SERVICE_PAGE_MASTER_TEMPLATE_ID}" data-schema-enabled="${schemaEnabled ? "true" : "false"}" data-page-version-hash="${esc(pageVersionHash)}" hidden></div>`;

  const main = `<main id="main-content">
<section class="hero" id="hero-section" data-template-block="hero">
<div class="wrap">
<p class="eyebrow">${esc(locked.serviceName)}</p>
<h1>${esc(h1)}</h1>
<p>${esc(identity.pharmacyName)} in ${esc(identity.location)}.</p>
</div>
</section>
${renderFactsSection(visibleFacts)}
<section id="service-definition" data-template-block="service-overview">
<div class="wrap">
<div class="section-head"><h2>Service overview</h2></div>
<p>${esc(locked.serviceName)} can help with ${esc(locked.conditionSet)}.</p>
<p>${esc(locked.suitability)}</p>
</div>
</section>
<section class="soft" id="consultation" data-template-block="consultation">
<div class="wrap">
<div class="section-head"><h2>What happens during the consultation</h2></div>
<p>${esc(locked.process)}</p>
</div>
</section>
<section id="safety" data-template-block="safety">
<div class="wrap">
<div class="section-head"><h2>Safety, referral and emergency guidance</h2></div>
<p>${esc(locked.safety)}</p>
</div>
</section>
<section class="soft faq" id="faq-section" data-template-block="faq">
<div class="wrap">
<div class="section-head"><h2>FAQs</h2></div>
<div class="faq-card"><h3 class="faq-q">Which conditions can Pharmacy First help with?</h3><p class="faq-a">${esc(locked.conditionSet)}.</p></div>
<div class="faq-card"><h3 class="faq-q">How is a consultation arranged?</h3><p class="faq-a">${esc(locked.process)}</p></div>
<div class="faq-card"><h3 class="faq-q">When should I seek urgent care?</h3><p class="faq-a">${esc(locked.safety)}</p></div>
<div class="faq-card"><h3 class="faq-q">How is eligibility decided?</h3><p class="faq-a">${esc(locked.suitability)}</p></div>
</div>
</section>
${renderClinicalReviewRecord({ clinicallyApproved, clinicalReviewDate: input.clinicalReviewDate, facts, pageVersionHash })}
<section id="emergency-disclaimer" data-template-block="emergency-disclaimer">
<div class="wrap">
<p class="emergency-disclaimer">${esc(SERVICE_PAGE_EMERGENCY_FOOTER)}</p>
</div>
</section>
</main>`;

  let html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(h1)}</title>
<meta name="template-id" content="${SERVICE_PAGE_MASTER_TEMPLATE_ID}"/>
<meta name="template-version" content="${SERVICE_PAGE_MASTER_TEMPLATE_VERSION}"/>
<meta name="page-version-hash" content="${esc(pageVersionHash)}"/>
${brookHomepageFontsLink()}
${brookHomepageChromeCss()}
${masterTemplateCss()}
</head>
<body data-pharmacy-service="${esc(input.serviceId)}" data-master-template="${SERVICE_PAGE_MASTER_TEMPLATE_ID}" data-clinical-approval="${clinicallyApproved ? "approved" : "pending"}" data-schema-enabled="${schemaEnabled ? "true" : "false"}">
${schemaSlot}
${renderBrookHomepageHeader()}
${main}
${renderBrookHomepageFooter()}
</body>
</html>`;

  html = applyBrookHomepageChrome(html);
  html = applyServiceNoticeToPageHtml(html, notice, {
    mode: noticeSelection.mode,
    pageKind: "service",
  });

  return {
    html,
    pageVersionHash,
    sections: [...SERVICE_PAGE_MASTER_TEMPLATE_SECTIONS],
    noticeSelection,
    clinicallyApproved,
    schemaEnabled,
    visibleFacts,
  };
}
