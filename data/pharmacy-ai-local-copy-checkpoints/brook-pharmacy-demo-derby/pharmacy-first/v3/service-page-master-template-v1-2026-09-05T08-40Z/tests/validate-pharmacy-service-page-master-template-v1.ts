#!/usr/bin/env npx tsx
/**
 * Pharmacy First service-page master template V1 — facts, notice, approval,
 * footer, schema, tenant isolation, layout. Does not generate, publish, or edit
 * accepted Brook/Allestree pages.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import { defaultProfileServiceDelivery } from "../src/pharmacy/pharmacyProfileV2Fields.ts";
import {
  CLINICALLY_REVIEWED_AND_APPROVED,
  SERVICE_PAGE_MASTER_PREVIEW_BANNER,
  SERVICE_PAGE_MASTER_TEMPLATE_SECTIONS,
  SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  computeServicePageMasterVersionHash,
  isExactPageVersionClinicallyApproved,
  renderServicePageMasterTemplateV1,
  selectNoticeForMasterTemplate,
  visibleServiceDeliveryFacts,
} from "../src/pharmacy/pharmacyServicePageMasterTemplateV1.ts";
import { renderServicePageMasterTemplatePreview } from "../src/pharmacy/pharmacyServicePageMasterTemplatePreview.ts";
import {
  SERVICE_NOTICE_DRAFT_BANNER,
  SERVICE_NOTICE_HEADING,
} from "../src/pharmacy/pharmacyServiceNoticeComponent.ts";
import { pharmacyFirstEnglandNhsNotice } from "../src/pharmacy/pharmacyServiceNoticeCatalog.ts";
import { SALES_DEMO_BROOK_SERVICE_PAGE_ASSET } from "../src/pharmacy/pharmacySalesDemoBrookServicePreview.ts";

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

function identity() {
  return {
    pharmacyName: "Brook Pharmacy",
    location: "Derby",
    address: "56 West Burton Road, Derby, DA5 4NR",
    phoneDisplay: "01332 445 076",
  };
}

function noticeIndex(html: string): number {
  return html.search(/<section\b[^>]*data-component="pharmacy-service-notice"/i);
}

function withoutNotice(html: string): string {
  return html.replace(/<section\b[^>]*data-component="pharmacy-service-notice"[\s\S]*?<\/section>/i, "");
}

function factValue(html: string, key: string): string {
  const re = new RegExp(`data-fact-key="${key}"[^>]*>[\\s\\S]*?<dd>([^<]*)</dd>`, "i");
  return html.match(re)?.[1]?.trim() || "";
}

function factStatus(html: string, key: string): string {
  const re = new RegExp(`data-fact-key="${key}"[^>]*data-fact-status="([^"]+)"`, "i");
  return html.match(re)?.[1] || "";
}

function main() {
  console.log("\n=== Pharmacy First service-page master template V1 ===\n");

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

  const unknownFacts = defaultProfileServiceDelivery("pharmacy-first", "Pharmacy First");
  const unknownVisible = visibleServiceDeliveryFacts(unknownFacts);
  record(
    "unknown-facts-labelled",
    unknownVisible.every((row) => row.status === "unknown" && row.value === "unknown"),
    `${unknownVisible.length} unknown facts`,
  );
  record(
    "unknown-does-not-infer-free",
    unknownVisible.every((row) => !/free/i.test(row.value)),
    "no free inference",
  );

  const confirmed = matchingFacts();
  const confirmedVisible = visibleServiceDeliveryFacts(confirmed);
  record(
    "confirmed-funding",
    confirmedVisible.find((row) => row.key === "fundingModel")?.value === "NHS" &&
      confirmedVisible.find((row) => row.key === "fundingModel")?.status === "confirmed",
    "NHS confirmed",
  );
  record(
    "confirmed-appointment",
    confirmedVisible.find((row) => row.key === "appointmentRequired")?.value === "Required",
    "appointment required",
  );
  record(
    "confirmed-walk-in-no",
    confirmedVisible.find((row) => row.key === "walkInAvailable")?.value === "No" &&
      confirmedVisible.find((row) => row.key === "walkInAvailable")?.status === "confirmed",
    "walk-in no, not inferred available",
  );
  record(
    "unknown-follow-up-fee",
    confirmedVisible.find((row) => row.key === "followUpFee")?.status === "unknown",
    "follow-up fee unknown",
  );

  const notice = pharmacyFirstEnglandNhsNotice();
  const unmatchedNotice = selectNoticeForMasterTemplate("pharmacy-first", unknownFacts);
  const matchedNotice = selectNoticeForMasterTemplate("pharmacy-first", confirmed);
  record("notice-unknown-presentation-draft", unmatchedNotice.mode === "presentation-draft", unmatchedNotice.mode);
  record("notice-matched-profile", matchedNotice.mode === "profile-matched", matchedNotice.mode);
  record("notice-wording-preserved", matchedNotice.notice?.body === notice.body && unmatchedNotice.notice?.body === notice.body, notice.id);

  const unknownPage = renderServicePageMasterTemplateV1({
    slug: "brook-pharmacy-demo-derby",
    serviceId: "pharmacy-first",
    facts: unknownFacts,
    identity: identity(),
    clinicalReviewDate: "",
    approval: {
      explicitContentApproval: false,
      approvedBy: "Jane Pharmacist",
      approvedAt: null,
      pageVersionHash: null,
    },
  });

  record("h1-service-and-location", /<h1>Pharmacy First at Brook Pharmacy, Derby<\/h1>/.test(unknownPage.html), "H1");
  record(
    "unknown-facts-on-page",
    factStatus(unknownPage.html, "fundingModel") === "unknown" &&
      factValue(unknownPage.html, "fundingModel") === "unknown" &&
      factStatus(unknownPage.html, "appointmentRequired") === "unknown" &&
      factStatus(unknownPage.html, "consultationFee") === "unknown",
    "labelled unknown",
  );

  const bodyWithoutNotice = withoutNotice(unknownPage.html);
  record(
    "no-free-inference",
    !/\bfree\b/i.test(bodyWithoutNotice) && !/no charge/i.test(bodyWithoutNotice),
    "no free/no-charge outside notice",
  );
  record(
    "no-walk-in-available-inference",
    !/walk-?in available/i.test(bodyWithoutNotice) && !/walk in without/i.test(unknownPage.html),
    "no walk-in availability claim",
  );
  record(
    "no-treatment-supply-inference",
    !/you will (?:receive|be given) treatment/i.test(bodyWithoutNotice) &&
      !/medicine will be supplied/i.test(bodyWithoutNotice) &&
      !/guaranteed treatment/i.test(bodyWithoutNotice),
    "no treatment/supply inference",
  );

  const confirmedReviewerOnly = renderServicePageMasterTemplateV1({
    slug: "brook-pharmacy-demo-derby",
    serviceId: "pharmacy-first",
    facts: {
      ...unknownFacts,
      clinicalReviewerName: "Jane Pharmacist",
      clinicalReviewerRole: "Superintendent Pharmacist",
      clinicalReviewerStatus: "confirmed",
    },
    identity: identity(),
    clinicalReviewDate: "2026-09-01",
    approval: null,
  });
  record(
    "reviewer-identity-not-approval",
    !confirmedReviewerOnly.html.includes(CLINICALLY_REVIEWED_AND_APPROVED) &&
      /data-clinical-approval="pending"/.test(confirmedReviewerOnly.html) &&
      confirmedReviewerOnly.html.includes("Jane Pharmacist"),
    "identity confirmed is not content approval",
  );
  record(
    "actual-review-date",
    confirmedReviewerOnly.html.includes("Review date: 2026-09-01"),
    "2026-09-01",
  );

  const hash = computeServicePageMasterVersionHash({
    slug: "brook-pharmacy-demo-derby",
    serviceId: "pharmacy-first",
    facts: confirmed,
    identity: identity(),
    clinicalReviewDate: "2026-09-01",
    noticeId: notice.id,
    noticeVersion: notice.version,
    noticeBody: notice.body,
  });
  const approvedPage = renderServicePageMasterTemplateV1({
    slug: "brook-pharmacy-demo-derby",
    serviceId: "pharmacy-first",
    facts: confirmed,
    identity: identity(),
    clinicalReviewDate: "2026-09-01",
    approval: {
      explicitContentApproval: true,
      approvedBy: "Jane Pharmacist",
      approvedAt: "2026-09-05T09:00:00.000Z",
      pageVersionHash: hash,
    },
  });
  record(
    "explicit-version-approval",
    approvedPage.clinicallyApproved && approvedPage.html.includes(CLINICALLY_REVIEWED_AND_APPROVED),
    hash.slice(0, 12),
  );
  record(
    "schema-enabled-flag-only-when-approved",
    approvedPage.schemaEnabled === true && /data-schema-enabled="true"/.test(approvedPage.html),
    "slot flag true, no JSON-LD",
  );
  record(
    "no-schema-output-when-approved",
    !/application\/ld\+json/i.test(approvedPage.html) && !/schema\.org/i.test(approvedPage.html),
    "no JSON-LD",
  );

  const changedFacts = { ...confirmed, fundingModel: "private" as const };
  const changedPage = renderServicePageMasterTemplateV1({
    slug: "brook-pharmacy-demo-derby",
    serviceId: "pharmacy-first",
    facts: changedFacts,
    identity: identity(),
    clinicalReviewDate: "2026-09-01",
    approval: {
      explicitContentApproval: true,
      approvedBy: "Jane Pharmacist",
      approvedAt: "2026-09-05T09:00:00.000Z",
      pageVersionHash: hash,
    },
  });
  record(
    "approval-invalidated-after-content-change",
    !changedPage.clinicallyApproved &&
      !changedPage.html.includes(CLINICALLY_REVIEWED_AND_APPROVED) &&
      changedPage.pageVersionHash !== hash &&
      !isExactPageVersionClinicallyApproved(
        { explicitContentApproval: true, approvedBy: "Jane Pharmacist", approvedAt: "2026-09-05T09:00:00.000Z", pageVersionHash: hash },
        changedPage.pageVersionHash,
      ),
    "hash mismatch invalidates approval",
  );

  const noticeAt = noticeIndex(unknownPage.html);
  const consultationAt = unknownPage.html.search(/data-template-block="consultation"/i);
  const overviewAt = unknownPage.html.search(/data-template-block="service-overview"/i);
  const noticeClose = unknownPage.html.indexOf("</section>", noticeAt);
  const afterNotice = unknownPage.html.slice(noticeClose + "</section>".length, noticeClose + 400);
  record("notice-heading", unknownPage.html.includes(`<div class="section-head center"><h2>${SERVICE_NOTICE_HEADING}</h2></div>`), SERVICE_NOTICE_HEADING);
  record("notice-body", unknownPage.html.includes(notice.body), "renderer-owned wording");
  record("notice-after-overview", noticeAt > overviewAt && overviewAt > 0, "after overview");
  record(
    "notice-immediately-before-consultation",
    noticeAt > 0 && consultationAt > noticeAt && /data-template-block="consultation"/i.test(afterNotice),
    "immediately above consultation",
  );
  record("notice-draft-banner", unknownPage.html.includes(SERVICE_NOTICE_DRAFT_BANNER), "presentation-draft");
  record(
    "consultation-locked-process",
    unknownPage.html.includes(PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.process),
    "locked process",
  );
  record(
    "safety-locked",
    unknownPage.html.includes(PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.safety),
    "locked safety",
  );
  record(
    "emergency-footer",
    /<p class="emergency-disclaimer">This service is subject to patient eligibility and a clinical consultation with our pharmacist\. If you are experiencing a medical emergency, call 999 or attend A&amp;E\.<\/p>/.test(
      unknownPage.html,
    ),
    "exact disclaimer",
  );
  record(
    "schema-disabled-before-approval",
    unknownPage.schemaEnabled === false &&
      /data-schema-enabled="false"/.test(unknownPage.html) &&
      !/application\/ld\+json/i.test(unknownPage.html),
    "slot disabled, no JSON-LD",
  );
  record(
    "all-required-sections",
    SERVICE_PAGE_MASTER_TEMPLATE_SECTIONS.every((section) =>
      section === "eligibility-notice"
        ? /data-component="pharmacy-service-notice"/i.test(unknownPage.html)
        : new RegExp(`data-template-block="${section}"`, "i").test(unknownPage.html),
    ),
    SERVICE_PAGE_MASTER_TEMPLATE_SECTIONS.join(", "),
  );
  record(
    "responsive-css",
    /@media \(max-width:639px\)/.test(unknownPage.html) && /@media \(min-width:1440px\)/.test(unknownPage.html),
    "639px and 1440px",
  );

  const preview = renderServicePageMasterTemplatePreview("brook-pharmacy-demo-derby", "pharmacy-first");
  record("preview-route", preview.sourceRoute === SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET, preview.sourceRoute);
  record("preview-banner", preview.html.includes(SERVICE_PAGE_MASTER_PREVIEW_BANNER), SERVICE_PAGE_MASTER_PREVIEW_BANNER);
  record("preview-noindex", /noindex,\s*nofollow/i.test(preview.html), "noindex");
  record("preview-unpublished", !/content="index,\s*follow"/i.test(preview.html), "unpublished");
  record("preview-brook-chrome", /data-sales-demo-brook="header"/i.test(preview.html), "Brook chrome");
  record(
    "preview-schema-disabled",
    /data-schema-enabled="false"/.test(preview.html) && !/application\/ld\+json/i.test(preview.html),
    "schema disabled",
  );

  const routed = renderReviewCentrePreviewAsset(
    "brook-pharmacy-demo-derby",
    "pharmacy-first",
    SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  );
  record("review-centre-route", routed.sourceRoute === SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET, routed.sourceRoute);

  const yorkshire = renderServicePageMasterTemplatePreview("yorkshire-pharmacy-and-health-clinic", "pharmacy-first");
  const flu = renderServicePageMasterTemplatePreview("brook-pharmacy-demo-derby", "flu-vaccinations");
  const allestreeOverlay = renderServicePageMasterTemplatePreview("brook-pharmacy-demo-derby", "pharmacy-first", {
    areaSlug: "allestree",
  });
  const welfare = renderReviewCentrePreviewAsset("welfare-pharmacy", "pharmacy-first", SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET);
  record("isolation-yorkshire", yorkshire.sourceRoute.endsWith("-unavailable"), yorkshire.sourceRoute);
  record("isolation-flu", flu.sourceRoute.endsWith("-unavailable"), flu.sourceRoute);
  record("isolation-allestree-area", allestreeOverlay.sourceRoute.endsWith("-unavailable"), allestreeOverlay.sourceRoute);
  record("isolation-other-tenant", welfare.sourceRoute.endsWith("-unavailable"), welfare.sourceRoute);

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

  const allestreeAfter = sha(allestreeFile);
  const visualAfter = sha(visualFile);
  record("accepted-allestree-html-unchanged", allestreeAfter === allestreeBefore, allestreeAfter.slice(0, 12));
  record("accepted-brook-visual-html-unchanged", visualAfter === visualBefore, visualAfter.slice(0, 12));

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.log("Failed:");
    for (const row of failed) console.log(`  - ${row.id}: ${row.detail}`);
    process.exit(1);
  }
}

main();
