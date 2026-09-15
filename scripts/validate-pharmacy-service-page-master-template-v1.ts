#!/usr/bin/env npx tsx
/**
 * Pharmacy First master-template V1 — restore accepted service page and prove
 * only compact governance was added. Does not generate, publish, or edit
 * accepted Brook/Allestree pages.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import { defaultProfileServiceDelivery } from "../src/pharmacy/pharmacyProfileV2Fields.ts";
import {
  CLINICAL_REVIEW_PENDING,
  CONTENT_CLINICAL_REVIEW_HEADING,
  CONTENT_GOVERNANCE_HEADING,
  CONTENT_PREPARED_BY,
  DEMONSTRATION_APPROVAL_RECORD_LABEL,
  DEMONSTRATION_CREDENTIALS_NOTICE,
  NOT_PUBLISHED,
  PHARMACY_FIRST_NOTICE_GUARANTEE_SENTENCE,
  PUBLICATION_AUTHORISATION_PENDING,
  SERVICE_NOTICE_HEADING,
  SERVICE_PAGE_EMERGENCY_FOOTER,
  SERVICE_PAGE_MASTER_PENDING_BANNER,
  SERVICE_PAGE_MASTER_PREVIEW_BANNER,
  SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
  SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  SHARED_PHARMACY_CREDENTIALS_MARKER,
  computeServicePageMasterVersionHash,
  expectedOverlayHeadings,
  extractProtectedClinicalText,
  inventoryAcceptedServicePage,
  isExactPageVersionClinicallyApproved,
  isExactPageVersionPublicationAuthorised,
  loadServicePageMasterApproval,
  loadServicePageMasterPublication,
  loadServicePageMasterPublicationAuthorisation,
  overlayServicePageMasterTemplateV1,
  servicePageMasterApprovalPath,
  servicePageMasterPublicationAuthorisationPath,
  servicePageMasterPublicationPath,
} from "../src/pharmacy/pharmacyServicePageMasterTemplateV1.ts";
import {
  renderAcceptedBrookServicePageSource,
  renderServicePageMasterTemplatePreview,
} from "../src/pharmacy/pharmacyServicePageMasterTemplatePreview.ts";
import { pharmacyFirstEnglandNhsNotice } from "../src/pharmacy/pharmacyServiceNoticeCatalog.ts";
import { SALES_DEMO_BROOK_SERVICE_PAGE_ASSET } from "../src/pharmacy/pharmacySalesDemoBrookServicePreview.ts";
import { normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  schemaSafeGphcIdentifier,
  schemaSafeSuperintendentName,
} from "../src/pharmacy/pharmacyProfileProductionSafety.ts";
import {
  resolveSharedPharmacyCredentials,
} from "../src/pharmacy/pharmacyTrustLayer.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sameSeq<T>(a: T[], b: T[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function matchingFacts() {
  return {
    ...defaultProfileServiceDelivery("pharmacy-first", "Pharmacy First"),
    fundingModel: "nhs" as const,
    ukNation: "england" as const,
    deliveryMode: "in-person" as const,
    appointmentRequired: true,
    walkInAvailable: false,
    consultationLengthMinutes: 20,
    consultationLengthLabel: "20 minutes",
    prescribingSupplyStatus: "pgd" as const,
    prescribingSupplyConfirmed: true,
    consultationFee: { kind: "fixed" as const, amount: "NHS prescription charge", notes: "" },
    treatmentFee: { kind: "included" as const, amount: "", notes: "" },
    followUpFee: { kind: "unknown" as const, amount: "", notes: "" },
  };
}

function noticeIndex(html: string): number {
  return html.search(/<section\b[^>]*data-component="pharmacy-service-notice"/i);
}

function main() {
  console.log("\n=== Pharmacy First master-template V1 restoration ===\n");

  const allestreeFile = path.join(
    ROOT,
    "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html",
  );
  const visualFile = path.join(
    ROOT,
    "output/pharmacy-visual-experience/yorkshire-pharmacy-and-health-clinic/pharmacy-first/index.html",
  );
  const allestreeBefore = sha(allestreeFile);
  const visualBefore = sha(visualFile);

  record(
    "no-v2-asset-file",
    !fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyServicePageMasterTemplateV2.ts")),
    "v2 file absent",
  );

  const source = renderAcceptedBrookServicePageSource();
  record("accepted-source-route", source.sourceRoute === "sales-demo-brook-service-page", source.sourceRoute);
  const sourceInv = inventoryAcceptedServicePage(source.html);
  record("source-has-headings", sourceInv.headings.length >= 20, String(sourceInv.headings.length));
  record("source-has-faqs", sourceInv.faqs.length >= 8, String(sourceInv.faqs.length));
  record("source-has-images", sourceInv.imageSrcs.length >= 4, String(sourceInv.imageSrcs.length));
  record("source-has-ctas", sourceInv.ctas.length >= 4, String(sourceInv.ctas.length));
  record(
    "source-hero-h1",
    sourceInv.headings[0] === "Pharmacy First at Brook Pharmacy",
    sourceInv.headings[0] || "missing",
  );

  const preview = renderServicePageMasterTemplatePreview("brook-pharmacy-demo-derby", "pharmacy-first");
  record("preview-route", preview.sourceRoute === SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET, preview.sourceRoute);
  record("preview-banner", preview.html.includes(SERVICE_PAGE_MASTER_PREVIEW_BANNER), SERVICE_PAGE_MASTER_PREVIEW_BANNER);
  record("preview-noindex", /noindex,\s*nofollow/i.test(preview.html), "noindex");

  const restored = inventoryAcceptedServicePage(preview.html);
  record(
    "headings-restored-with-notice",
    sameSeq(restored.headings, expectedOverlayHeadings(sourceInv.headings)),
    `${sourceInv.headings.length} + notice + content governance`,
  );
  record("faqs-unchanged", sameSeq(restored.faqs, sourceInv.faqs), `${sourceInv.faqs.length} FAQs`);
  record("images-unchanged", sameSeq(restored.imageSrcs, sourceInv.imageSrcs), `${sourceInv.imageSrcs.length} images`);
  record("ctas-unchanged", sameSeq(restored.ctas, sourceInv.ctas), `${sourceInv.ctas.length} CTAs`);
  record("nav-unchanged", sameSeq(restored.navLabels, sourceInv.navLabels), `${sourceInv.navLabels.length} nav`);
  record(
    "template-blocks-unchanged",
    sameSeq(restored.templateBlocks, sourceInv.templateBlocks),
    sourceInv.templateBlocks.join(", "),
  );
  record(
    "no-large-unknown-facts-area",
    !/Confirmed funding, delivery, appointment and fee facts/i.test(preview.html) &&
      !/data-fact-status="unknown"/i.test(preview.html) &&
      !/data-component="service-logistics-strip"/i.test(preview.html),
    "unknown facts omitted",
  );
  record(
    "no-v1-rebuild-copy",
    !/Service overview/i.test(preview.html) || source.html.includes("Service overview"),
    "did not replace with compliance template",
  );
  record(
    "full-conditions-present",
    preview.html.includes("Acute Sore Throat") &&
      preview.html.includes("Uncomplicated Urinary Tract Infection") &&
      preview.html.includes("What happens during your consultation") &&
      preview.html.includes("Frequently Asked Questions"),
    "accepted clinical sections present",
  );

  const notice = pharmacyFirstEnglandNhsNotice();
  const noticeAt = noticeIndex(preview.html);
  const noticeClose = preview.html.indexOf("</section>", noticeAt);
  const afterNotice = preview.html.slice(noticeClose + "</section>".length, noticeClose + 500);
  record("notice-heading", preview.html.includes(`<h2>${SERVICE_NOTICE_HEADING}</h2>`), SERVICE_NOTICE_HEADING);
  record("notice-body", preview.html.includes(notice.body), "existing notice wording");
  record(
    "notice-guarantee-sentence",
    preview.html.includes(PHARMACY_FIRST_NOTICE_GUARANTEE_SENTENCE),
    PHARMACY_FIRST_NOTICE_GUARANTEE_SENTENCE,
  );
  record(
    "notice-immediately-before-consultation",
    noticeAt > 0 && /What happens during (?:the |your )?consultation/i.test(afterNotice),
    "immediately above consultation",
  );
  record(
    "notice-centered",
    /section\.pharmacy-service-notice\[data-master-template="v1"\]\{[^}]*text-align:center/.test(preview.html) &&
      /section\.pharmacy-service-notice\[data-master-template="v1"\] \.wrap\{[^}]*text-align:center/.test(preview.html) &&
      /section\.pharmacy-service-notice\[data-master-template="v1"\] h2\{[^}]*text-align:center/.test(preview.html) &&
      /section\.pharmacy-service-notice\[data-master-template="v1"\] p\{[^}]*text-align:center/.test(preview.html) &&
      /section\.pharmacy-service-notice\[data-master-template="v1"\] p\{[^}]*margin:0 auto/.test(preview.html) &&
      preview.html.includes('<div class="section-head center"><h2>Eligibility and important information</h2></div>'),
    "notice container, heading and body centred",
  );
  record(
    "notice-not-dominating-banner",
    !/Draft demonstration — not clinical approval/i.test(preview.html),
    "no extra notice draft banner",
  );
  record(
    "demo-approved-presentation",
    preview.html.includes(DEMONSTRATION_APPROVAL_RECORD_LABEL) &&
      preview.html.includes(`<h3>${CONTENT_GOVERNANCE_HEADING}</h3>`) &&
      preview.html.includes("Content created by") &&
      preview.html.includes("PharmaConnect") &&
      preview.html.includes("Pharmacy strategy and sector insight") &&
      preview.html.includes("Mrs Jennifer Henry") &&
      preview.html.includes("Clinically reviewed and approved by") &&
      preview.html.includes("Mr John Ward — Superintendent Pharmacist") &&
      preview.html.includes("Demo GPhC No. 453756") &&
      preview.html.includes("Clinical review date") &&
      preview.html.includes("5 September 2026") &&
      preview.html.includes("Publication authorised by") &&
      preview.html.includes("Publication date") &&
      /data-component="content-governance-panel"/.test(preview.html) &&
      /data-demonstration-approval="true"/.test(preview.html) &&
      /data-approval-record="false"/.test(preview.html) &&
      /content-governance-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(preview.html) &&
      !preview.html.includes(CONTENT_CLINICAL_REVIEW_HEADING) &&
      !preview.html.includes(CLINICAL_REVIEW_PENDING) &&
      !preview.html.includes(CONTENT_PREPARED_BY) &&
      !preview.html.includes(NOT_PUBLISHED) &&
      !preview.html.includes(PUBLICATION_AUTHORISATION_PENDING) &&
      !preview.html.includes(SERVICE_PAGE_MASTER_PENDING_BANNER) &&
      !/data-component="content-clinical-review"/.test(preview.html) &&
      (preview.html.match(/Demonstration approval record/g) || []).length === 1 &&
      (preview.html.match(/Mrs Jennifer Henry/g) || []).length === 1,
    "Preview shows illustrative Content governance panel only",
  );
  record(
    "attribution-in-trust-section",
    (() => {
      const trust = preview.html.search(/data-template-block="trust-split"/i);
      const trustEnd = preview.html.indexOf("</section>", trust);
      const block = preview.html.search(/data-component="content-governance-panel"/i);
      const heading = preview.html.search(new RegExp(`<h3>${CONTENT_GOVERNANCE_HEADING}</h3>`));
      const credentials = preview.html.search(/data-component="pharmacy-shared-credentials"/i);
      return (
        trust > 0 &&
        block > trust &&
        block < trustEnd &&
        heading > trust &&
        heading < trustEnd &&
        credentials > trust &&
        credentials < trustEnd &&
        credentials < block
      );
    })(),
    "Content governance sits inside Trust & Credentials with pharmacy credentials",
  );
  record(
    "disclaimer-band-above-footer-columns",
    (() => {
      const footer = preview.html.search(/<footer\b[^>]*data-sales-demo-brook="footer"/i);
      const inner = preview.html.indexOf("brook-demo-footer-inner", footer);
      const between = footer >= 0 && inner > footer ? preview.html.slice(footer, inner) : "";
      return (
        /service-emergency-disclaimer-band/.test(between) &&
        /data-component="service-emergency-disclaimer"/.test(between) &&
        !/<section\b/i.test(between)
      );
    })(),
    "centred disclaimer immediately above footer columns",
  );
  record(
    "emergency-footer",
    /data-component="service-emergency-disclaimer"/.test(preview.html) &&
      preview.html.includes(SERVICE_PAGE_EMERGENCY_FOOTER.replace(/&/g, "&amp;")) &&
      /max-width:900px/.test(preview.html) &&
      /font:400 16px/.test(preview.html) &&
      /text-align:center/.test(preview.html) &&
      (preview.html.match(/This service is subject to patient eligibility and a clinical consultation with our pharmacist/g) || []).length === 1,
    "exact disclaimer wording in centred band",
  );
  record(
    "schema-inactive",
    /data-schema-enabled="false"/.test(preview.html) &&
      !/application\/ld\+json/i.test(preview.html) &&
      !/>schema\.org</i.test(preview.html),
    "no JSON-LD, slot hidden",
  );
  record(
    "no-schema-card",
    !/Structured data/i.test(preview.html) && !/schema card/i.test(preview.html),
    "no visible schema UI",
  );

  const identityFacts = {
    ...defaultProfileServiceDelivery("pharmacy-first", "Pharmacy First"),
    clinicalReviewerName: "Jane Pharmacist",
    clinicalReviewerRole: "Superintendent Pharmacist",
    clinicalReviewerStatus: "confirmed" as const,
  };
  const identityOnly = overlayServicePageMasterTemplateV1(source.html, {
    facts: identityFacts,
    clinicalReviewDate: "2026-09-01",
    approval: null,
  });
  record(
    "identity-confirmation-not-approval",
    identityOnly.html.includes(CLINICAL_REVIEW_PENDING) && !/Clinically reviewed by /i.test(identityOnly.html),
    "reviewer identity confirmation is not approval",
  );
  record(
    "review-pending-compact",
    identityOnly.html.includes(CLINICAL_REVIEW_PENDING) &&
      identityOnly.html.includes(CONTENT_PREPARED_BY) &&
      identityOnly.html.includes("Editorial lead: Mrs Jennifer Henry") &&
      identityOnly.html.includes("Pharmacy Strategy") &&
      identityOnly.html.includes("Sector Insight") &&
      identityOnly.html.includes(NOT_PUBLISHED) &&
      identityOnly.html.includes(PUBLICATION_AUTHORISATION_PENDING) &&
      identityOnly.html.includes(CONTENT_CLINICAL_REVIEW_HEADING) &&
      identityOnly.html.includes(SERVICE_PAGE_MASTER_PENDING_BANNER) &&
      !identityOnly.html.includes(SERVICE_PAGE_MASTER_PREVIEW_BANNER) &&
      !identityOnly.html.includes(DEMONSTRATION_APPROVAL_RECORD_LABEL) &&
      !identityOnly.html.includes(CONTENT_GOVERNANCE_HEADING) &&
      !/Clinically reviewed by /i.test(identityOnly.html) &&
      !/First published /i.test(identityOnly.html) &&
      !/Publication authorised by /i.test(identityOnly.html) &&
      (identityOnly.html.match(/Content prepared by PharmaConnect/g) || []).length === 1 &&
      /data-component="content-clinical-review"/.test(identityOnly.html) &&
      !/data-component="content-governance-panel"/.test(identityOnly.html) &&
      !/data-component="content-attribution"/.test(identityOnly.html),
    "real overlay stays pending unless exact-version approval exists",
  );

  const namedFacts = {
    ...defaultProfileServiceDelivery("pharmacy-first", "Pharmacy First"),
    clinicalReviewerName: "Jane Pharmacist",
    clinicalReviewerRole: "Superintendent Pharmacist",
    clinicalReviewerStatus: "confirmed" as const,
  };
  const pendingNamed = overlayServicePageMasterTemplateV1(source.html, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: null,
  });
  const approvedExact = overlayServicePageMasterTemplateV1(source.html, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: {
      explicitContentApproval: true,
      approvedBy: "Jane Pharmacist",
      approvedAt: "2026-09-05T09:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
  });
  record(
    "approved-exact-version",
    approvedExact.clinicallyApproved === true &&
      approvedExact.publicationAuthorised === false &&
      approvedExact.published === false &&
      approvedExact.html.includes("Clinically reviewed by Jane Pharmacist, Superintendent Pharmacist") &&
      approvedExact.html.includes("Last clinically reviewed: 2026-09-05") &&
      approvedExact.html.includes(NOT_PUBLISHED) &&
      approvedExact.html.includes(PUBLICATION_AUTHORISATION_PENDING) &&
      !approvedExact.html.includes(CLINICAL_REVIEW_PENDING),
    "named superintendent after exact-hash approval; authorisation and publication stay pending",
  );
  record(
    "presentation-does-not-mint-review-date",
    pendingNamed.pageVersionHash === approvedExact.pageVersionHash &&
      approvedExact.html.includes("Last clinically reviewed: 2026-09-05"),
    "overlay presentation keeps the stored clinical review date and hash",
  );

  const authorisedOnly = overlayServicePageMasterTemplateV1(source.html, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: null,
    publicationAuthorisation: {
      explicitAuthorisation: true,
      authorisedBy: "Jane Pharmacist",
      authorisedAt: "2026-09-05T11:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
  });
  record(
    "authorisation-separate-from-clinical-approval",
    authorisedOnly.clinicallyApproved === false &&
      authorisedOnly.publicationAuthorised === true &&
      authorisedOnly.published === false &&
      authorisedOnly.html.includes(CLINICAL_REVIEW_PENDING) &&
      authorisedOnly.html.includes("Publication authorised by Jane Pharmacist") &&
      authorisedOnly.html.includes("Authorised for publication: 2026-09-05") &&
      authorisedOnly.html.includes(NOT_PUBLISHED) &&
      !authorisedOnly.html.includes("Clinically reviewed by "),
    "publication authorisation does not imply clinical review",
  );

  const publishedExact = overlayServicePageMasterTemplateV1(source.html, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: {
      explicitContentApproval: true,
      approvedBy: "Jane Pharmacist",
      approvedAt: "2026-09-05T09:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
    publicationAuthorisation: {
      explicitAuthorisation: true,
      authorisedBy: "Jane Pharmacist",
      authorisedAt: "2026-09-05T11:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
    publication: {
      published: true,
      publishedAt: "2026-09-05T12:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
  });
  record(
    "published-exact-version",
    publishedExact.published === true &&
      publishedExact.html.includes("First published 2026-09-05") &&
      publishedExact.html.includes("Clinically reviewed by Jane Pharmacist, Superintendent Pharmacist") &&
      publishedExact.html.includes("Publication authorised by Jane Pharmacist") &&
      !publishedExact.html.includes(NOT_PUBLISHED) &&
      !publishedExact.html.includes(CLINICAL_REVIEW_PENDING) &&
      !publishedExact.html.includes(PUBLICATION_AUTHORISATION_PENDING),
    "first published date only after exact-hash publication record",
  );

  const missingReviewer = overlayServicePageMasterTemplateV1(source.html, {
    facts: defaultProfileServiceDelivery("pharmacy-first", "Pharmacy First"),
    clinicalReviewDate: "",
    approval: {
      explicitContentApproval: true,
      approvedBy: "Jane Pharmacist",
      approvedAt: "2026-09-05T09:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
  });
  record(
    "missing-reviewer-stays-pending",
    missingReviewer.html.includes(CLINICAL_REVIEW_PENDING) && !/Clinically reviewed by /i.test(missingReviewer.html),
    "no name, no reviewed-by",
  );

  record(
    "unverified-credentials-omitted-from-clinical-review",
    !/GPhC/i.test(approvedExact.html) && approvedExact.html.includes("Consultation Room Available"),
    "unverified GPhC not inferred into clinical review or overlay without demo credentials",
  );

  const brookProfile = normalizeProfileDoc(
    "brook-pharmacy-demo-derby",
    JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/brook-pharmacy-demo-derby.json"), "utf8")),
  );
  const yorkshireProfile = normalizeProfileDoc(
    "yorkshire-pharmacy-and-health-clinic",
    JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/yorkshire-pharmacy-and-health-clinic.json"), "utf8")),
  );
  const dhmProfile = normalizeProfileDoc(
    "dhmdigital",
    JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/dhmdigital.json"), "utf8")),
  );
  const brookCreds = brookProfile.data.displayCredentials;
  record(
    "brook-demo-credentials-stored",
    brookCreds?.kind === "demonstration" &&
      brookCreds.verificationStatus === "unverified" &&
      brookCreds.superintendentPharmacistName === "Mr John Ward" &&
      brookCreds.superintendentGphcNumber === "453756" &&
      brookCreds.premisesGphcNumber === "1109432" &&
      brookCreds.sourceUrl === "https://pharmacy.inboxingproweb.com/" &&
      brookCreds.allowedTenantSlug === "brook-pharmacy-demo-derby" &&
      brookCreds.allowedSurfaces.includes(SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE) &&
      brookProfile.data.gphcNumber === "" &&
      brookProfile.data.superintendentPharmacistName === "",
    "stored on Brook tenant profile as demonstration/unverified, not canonical GPhC",
  );
  record(
    "credentials-not-copied-to-other-tenants",
    yorkshireProfile.data.displayCredentials == null &&
      dhmProfile.data.displayCredentials == null &&
      yorkshireProfile.data.gphcNumber !== "1109432" &&
      dhmProfile.data.superintendentPharmacistName !== "Mr John Ward",
    "other tenant profiles unchanged",
  );
  record(
    "demo-credentials-preview-only",
    preview.html.includes("Superintendent Pharmacist") &&
      preview.html.includes("Mr John Ward") &&
      preview.html.includes("Demo GPhC No. 453756") &&
      preview.html.includes("Pharmacy premises") &&
      preview.html.includes("Demo GPhC registration No. 1109432") &&
      preview.html.includes(DEMONSTRATION_CREDENTIALS_NOTICE) &&
      preview.html.includes(`data-component="${SHARED_PHARMACY_CREDENTIALS_MARKER}"`) &&
      preview.html.includes('data-credential-kind="demonstration"') &&
      preview.html.includes('data-verification-status="unverified"') &&
      preview.html.includes('data-schema-eligible="false"') &&
      !preview.html.includes("Consultation Room Available") &&
      !/pharmacyregulation\.org|gphc-uk\.org|\/registers\/pharmacy/i.test(preview.html) &&
      (preview.html.match(/Demonstration credentials — not a real pharmacy registration\./g) || []).length === 1,
    "Brook Preview shows demonstration credentials in Pharmacy credentials",
  );
  record(
    "demo-credentials-not-verified-or-schema",
    schemaSafeGphcIdentifier(brookProfile.data) == null &&
      schemaSafeSuperintendentName(brookProfile.data) == null &&
      resolveSharedPharmacyCredentials({
        slug: "brook-pharmacy-demo-derby",
        credentials: brookCreds,
        surface: SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
      })?.verified === false &&
      resolveSharedPharmacyCredentials({
        slug: "brook-pharmacy-demo-derby",
        credentials: brookCreds,
        surface: SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
      })?.schemaEligible === false &&
      !preview.html.includes("Clinically reviewed by Mr John Ward") &&
      !/GPhC 453756/.test(preview.html) &&
      !/GPhC 1109432/.test(preview.html),
    "demonstration credentials never verified or schema-eligible",
  );
  record(
    "demo-credentials-tenant-and-surface-isolation",
    resolveSharedPharmacyCredentials({
      slug: "yorkshire-pharmacy-and-health-clinic",
      credentials: brookCreds,
      surface: SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
    }) == null &&
      resolveSharedPharmacyCredentials({
        slug: "brook-pharmacy-demo-derby",
        credentials: brookCreds,
        surface: "ai-local-area-page-pilot-v3",
      }) == null &&
      resolveSharedPharmacyCredentials({
        slug: "dhmdigital",
        credentials: dhmProfile.data.displayCredentials,
        surface: SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
      }) == null,
    "renderer refuses other tenants, other surfaces, and verified profiles",
  );

  const demoPresentationWithoutBrook = overlayServicePageMasterTemplateV1(source.html, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: null,
    tenantSlug: "yorkshire-pharmacy-and-health-clinic",
    demonstrationApprovedPresentation: true,
  });
  const brookCredentialsPending = overlayServicePageMasterTemplateV1(source.html, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: null,
    tenantSlug: "brook-pharmacy-demo-derby",
    displayCredentials: brookCreds,
  });
  const brookDemoPresentation = overlayServicePageMasterTemplateV1(source.html, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: {
      explicitContentApproval: true,
      approvedBy: "Jane Pharmacist",
      approvedAt: "2026-09-05T09:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
    tenantSlug: "brook-pharmacy-demo-derby",
    displayCredentials: brookCreds,
    demonstrationApprovedPresentation: true,
  });
  record(
    "demo-state-isolation-from-real-pending",
    brookCredentialsPending.html.includes(CLINICAL_REVIEW_PENDING) &&
      brookCredentialsPending.html.includes(CONTENT_CLINICAL_REVIEW_HEADING) &&
      brookCredentialsPending.html.includes(SERVICE_PAGE_MASTER_PENDING_BANNER) &&
      brookCredentialsPending.html.includes("Mr John Ward") &&
      brookCredentialsPending.html.includes("Demo GPhC No. 453756") &&
      !brookCredentialsPending.html.includes(DEMONSTRATION_APPROVAL_RECORD_LABEL) &&
      !brookCredentialsPending.html.includes("Clinically reviewed and approved by") &&
      !brookCredentialsPending.html.includes(SERVICE_PAGE_MASTER_PREVIEW_BANNER) &&
      /data-component="content-clinical-review"/.test(brookCredentialsPending.html) &&
      !/data-component="content-governance-panel"/.test(brookCredentialsPending.html),
    "Brook credentials without demo presentation stay pending",
  );
  record(
    "demo-presentation-tenant-isolation",
    demoPresentationWithoutBrook.html.includes(CLINICAL_REVIEW_PENDING) &&
      demoPresentationWithoutBrook.html.includes(SERVICE_PAGE_MASTER_PENDING_BANNER) &&
      !demoPresentationWithoutBrook.html.includes(DEMONSTRATION_APPROVAL_RECORD_LABEL) &&
      !demoPresentationWithoutBrook.html.includes("Clinically reviewed and approved by") &&
      !demoPresentationWithoutBrook.html.includes("Mr John Ward") &&
      !/data-component="content-governance-panel"/.test(demoPresentationWithoutBrook.html),
    "demonstration approved presentation cannot be forced onto another tenant",
  );
  record(
    "demo-presentation-does-not-change-real-rules",
    brookDemoPresentation.clinicallyApproved === true &&
      brookDemoPresentation.publicationAuthorised === false &&
      brookDemoPresentation.published === false &&
      brookDemoPresentation.pageVersionHash === pendingNamed.pageVersionHash &&
      brookDemoPresentation.schemaEnabled === false &&
      brookDemoPresentation.html.includes(DEMONSTRATION_APPROVAL_RECORD_LABEL) &&
      !brookDemoPresentation.html.includes("Clinically reviewed by Jane Pharmacist") &&
      !brookDemoPresentation.html.includes(CLINICAL_REVIEW_PENDING),
    "demo presentation is illustrative; hash and approval flags still follow stored records",
  );
  record(
    "no-approval-record-written",
    loadServicePageMasterApproval("brook-pharmacy-demo-derby", "pharmacy-first") == null &&
      loadServicePageMasterPublicationAuthorisation("brook-pharmacy-demo-derby", "pharmacy-first") == null &&
      loadServicePageMasterPublication("brook-pharmacy-demo-derby", "pharmacy-first") == null &&
      !fs.existsSync(servicePageMasterApprovalPath("brook-pharmacy-demo-derby", "pharmacy-first")) &&
      !fs.existsSync(
        servicePageMasterPublicationAuthorisationPath("brook-pharmacy-demo-derby", "pharmacy-first"),
      ) &&
      !fs.existsSync(servicePageMasterPublicationPath("brook-pharmacy-demo-derby", "pharmacy-first")),
    "no clinical approval, authorisation or publication file written",
  );

  const verifiedReal = overlayServicePageMasterTemplateV1(source.html, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: {
      explicitContentApproval: true,
      approvedBy: "Jane Pharmacist",
      approvedAt: "2026-09-05T09:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
    verifiedGphcNumber: "132456",
  });
  record(
    "verified-real-profile-behaviour",
    schemaSafeGphcIdentifier(dhmProfile.data) === "132456" &&
      schemaSafeSuperintendentName(dhmProfile.data) === "Bob Ross" &&
      verifiedReal.html.includes("GPhC 132456") &&
      verifiedReal.html.includes("Consultation Room Available") &&
      !verifiedReal.html.includes("Mr John Ward") &&
      !verifiedReal.html.includes("453756") &&
      !verifiedReal.html.includes("1109432") &&
      !verifiedReal.html.includes(DEMONSTRATION_CREDENTIALS_NOTICE),
    "verified profile GPhC remains schema-safe; overlay does not inject Brook demo credentials",
  );

  const mutatedSafety = source.html.replace(
    "PGD-supply of prescription-only medicines where criteria are met",
    "PGD-supply of prescription-only medicines where criteria are met — changed",
  );
  const invalidatedSafety = overlayServicePageMasterTemplateV1(mutatedSafety, {
    facts: namedFacts,
    clinicalReviewDate: "",
    approval: {
      explicitContentApproval: true,
      approvedBy: "Jane Pharmacist",
      approvedAt: "2026-09-05T09:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
    publicationAuthorisation: {
      explicitAuthorisation: true,
      authorisedBy: "Jane Pharmacist",
      authorisedAt: "2026-09-05T11:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
    publication: {
      published: true,
      publishedAt: "2026-09-05T12:00:00.000Z",
      pageVersionHash: pendingNamed.pageVersionHash,
    },
  });
  record(
    "safety-change-invalidates-approval",
    invalidatedSafety.pageVersionHash !== pendingNamed.pageVersionHash &&
      invalidatedSafety.clinicallyApproved === false &&
      invalidatedSafety.publicationAuthorised === false &&
      invalidatedSafety.published === false &&
      invalidatedSafety.html.includes(CLINICAL_REVIEW_PENDING) &&
      invalidatedSafety.html.includes(PUBLICATION_AUTHORISATION_PENDING) &&
      invalidatedSafety.html.includes(NOT_PUBLISHED) &&
      !/Clinically reviewed by /i.test(invalidatedSafety.html) &&
      !/Publication authorised by /i.test(invalidatedSafety.html) &&
      !/First published /i.test(invalidatedSafety.html),
    "safety wording change returns pending clinical review, authorisation and publication",
  );
  record(
    "notice-change-invalidates-hash",
    computeServicePageMasterVersionHash({
      inventory: pendingNamed.inventory,
      confirmedFacts: pendingNamed.confirmedFacts,
      noticeBody: `${notice.body} changed`,
      protectedClinicalText: extractProtectedClinicalText(source.html),
    }) !== pendingNamed.pageVersionHash &&
      !isExactPageVersionClinicallyApproved(
        {
          explicitContentApproval: true,
          approvedBy: "Jane Pharmacist",
          approvedAt: "2026-09-05T09:00:00.000Z",
          pageVersionHash: pendingNamed.pageVersionHash,
        },
        computeServicePageMasterVersionHash({
          inventory: pendingNamed.inventory,
          confirmedFacts: pendingNamed.confirmedFacts,
          noticeBody: `${notice.body} changed`,
          protectedClinicalText: extractProtectedClinicalText(source.html),
        }),
      ) &&
      !isExactPageVersionPublicationAuthorised(
        {
          explicitAuthorisation: true,
          authorisedBy: "Jane Pharmacist",
          authorisedAt: "2026-09-05T11:00:00.000Z",
          pageVersionHash: pendingNamed.pageVersionHash,
        },
        computeServicePageMasterVersionHash({
          inventory: pendingNamed.inventory,
          confirmedFacts: pendingNamed.confirmedFacts,
          noticeBody: `${notice.body} changed`,
          protectedClinicalText: extractProtectedClinicalText(source.html),
        }),
      ),
      "notice wording change invalidates previous approval and authorisation",
  );

  const confirmedPage = overlayServicePageMasterTemplateV1(source.html, {
    facts: matchingFacts(),
    clinicalReviewDate: "",
    approval: null,
  });
  record(
    "confirmed-logistics-strip",
    /data-component="service-logistics-strip"/.test(confirmedPage.html) &&
      confirmedPage.html.includes("Funding: NHS") &&
      confirmedPage.html.includes("Delivery: In person") &&
      confirmedPage.html.includes("Appointment: Required") &&
      !/Follow-up fee: unknown/i.test(confirmedPage.html),
    "confirmed only, unknown omitted",
  );

  const routed = renderReviewCentrePreviewAsset(
    "brook-pharmacy-demo-derby",
    "pharmacy-first",
    SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  );
  record("review-centre-v1-route", routed.sourceRoute === SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET, routed.sourceRoute);
  const v2Routed = renderReviewCentrePreviewAsset(
    "brook-pharmacy-demo-derby",
    "pharmacy-first",
    "service-page-master-template-v2",
  );
  record("no-v2-preview-route", v2Routed.sourceRoute !== "service-page-master-template-v2", v2Routed.sourceRoute);

  const yorkshire = renderServicePageMasterTemplatePreview("yorkshire-pharmacy-and-health-clinic", "pharmacy-first");
  const allestreeOverlay = renderServicePageMasterTemplatePreview("brook-pharmacy-demo-derby", "pharmacy-first", {
    areaSlug: "allestree",
  });
  record("isolation-yorkshire", yorkshire.sourceRoute.endsWith("-unavailable"), yorkshire.sourceRoute);
  record("isolation-allestree-area", allestreeOverlay.sourceRoute.endsWith("-unavailable"), allestreeOverlay.sourceRoute);

  const salesDemo = renderReviewCentrePreviewAsset(
    "yorkshire-pharmacy-and-health-clinic",
    "pharmacy-first",
    SALES_DEMO_BROOK_SERVICE_PAGE_ASSET,
  );
  const allestreePreview = renderReviewCentrePreviewAsset("brook-pharmacy-demo-derby", "pharmacy-first", "ai-local-area-page-pilot-v3", {
    areaSlug: "allestree",
  });
  record("accepted-brook-service-unchanged-route", salesDemo.sourceRoute === SALES_DEMO_BROOK_SERVICE_PAGE_ASSET, salesDemo.sourceRoute);
  record("accepted-allestree-unchanged-route", allestreePreview.sourceRoute === "ai-local-area-page-pilot-v3", allestreePreview.sourceRoute);
  record("accepted-allestree-html-unchanged", sha(allestreeFile) === allestreeBefore, allestreeBefore.slice(0, 12));
  record("accepted-brook-visual-html-unchanged", sha(visualFile) === visualBefore, visualBefore.slice(0, 12));
  record(
    "sales-demo-without-demo-credentials",
    !salesDemo.html.includes("Mr John Ward") &&
      !/Demo GPhC No\. 453756/.test(salesDemo.html) &&
      !/Demo GPhC registration No\. 1109432/.test(salesDemo.html) &&
      !salesDemo.html.includes(DEMONSTRATION_CREDENTIALS_NOTICE) &&
      !salesDemo.html.includes(DEMONSTRATION_APPROVAL_RECORD_LABEL) &&
      !salesDemo.html.includes("Clinically reviewed and approved by"),
    "demonstration credentials stay off the accepted Yorkshire Brook service Preview",
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.log("Failed:");
    for (const row of failed) console.log(`  - ${row.id}: ${row.detail}`);
    process.exit(1);
  }
}

main();
