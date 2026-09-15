#!/usr/bin/env npx tsx
/**
 * Pharmacy First local-page Preview overlay — request-time compliance only.
 * Does not generate, approve, publish, or rewrite saved Allestree HTML.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  BROOK_DERBY_DEMO_SLUG,
  BROOK_DERBY_FIRST_LOCAL_AREA_SLUG,
  aiLocalPagePilotHtmlPath,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { overlayPharmacyFirstLocalPagePreviewHtml } from "../src/pharmacy/pharmacyPharmacyFirstLocalPagePreviewOverlay.ts";
import {
  CONTENT_GOVERNANCE_HEADING,
  DEMONSTRATION_APPROVAL_RECORD_LABEL,
  DEMONSTRATION_CREDENTIALS_NOTICE,
  PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE,
  SERVICE_NOTICE_HEADING,
  SERVICE_PAGE_EMERGENCY_FOOTER,
  SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE,
  SHARED_PHARMACY_CREDENTIALS_MARKER,
  loadServicePageMasterApproval,
  loadServicePageMasterPublication,
  loadServicePageMasterPublicationAuthorisation,
  servicePageMasterApprovalPath,
} from "../src/pharmacy/pharmacyServicePageMasterTemplateV1.ts";
import { pharmacyFirstEnglandNhsNotice } from "../src/pharmacy/pharmacyServiceNoticeCatalog.ts";
import { normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { resolveSharedPharmacyCredentials } from "../src/pharmacy/pharmacyTrustLayer.ts";

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

function noticeIndex(html: string): number {
  return html.search(/<section\b[^>]*data-component="pharmacy-service-notice"/i);
}

function main() {
  console.log("\n=== Pharmacy First local-page Preview compliance overlay ===\n");

  const allestreeFile = aiLocalPagePilotHtmlPath(
    BROOK_DERBY_DEMO_SLUG,
    "pharmacy-first",
    BROOK_DERBY_FIRST_LOCAL_AREA_SLUG,
    AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  );
  const wombwellFile = aiLocalPagePilotHtmlPath(
    "yorkshire-pharmacy-and-health-clinic",
    "pharmacy-first",
    "wombwell",
    AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  );
  const before = sha(allestreeFile);
  const wombwellBefore = sha(wombwellFile);
  const saved = fs.readFileSync(allestreeFile, "utf8");
  const notice = pharmacyFirstEnglandNhsNotice();

  record("saved-allestree-exists", fs.existsSync(allestreeFile), allestreeFile);
  record(
    "saved-allestree-has-no-overlay-before-preview",
    !saved.includes(`data-component="${SHARED_PHARMACY_CREDENTIALS_MARKER}"`) &&
      !saved.includes("data-component=\"content-governance-panel\"") &&
      !saved.includes("data-component=\"pharmacy-service-notice\"") &&
      !saved.includes("data-component=\"service-emergency-disclaimer\"") &&
      /application\/ld\+json/i.test(saved),
    "saved candidate remains copy-only with JSON-LD",
  );

  const preview = renderReviewCentrePreviewAsset(
    BROOK_DERBY_DEMO_SLUG,
    "pharmacy-first",
    AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
    { areaSlug: BROOK_DERBY_FIRST_LOCAL_AREA_SLUG },
  );
  record("preview-route", preview.sourceRoute === "ai-local-area-page-pilot-v3", preview.sourceRoute);
  record("preview-source-path", preview.sourcePath === allestreeFile, String(preview.sourcePath));

  const html = preview.html;
  const brookProfile = normalizeProfileDoc(
    BROOK_DERBY_DEMO_SLUG,
    JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/brook-pharmacy-demo-derby.json"), "utf8")),
  );
  const yorkshireProfile = normalizeProfileDoc(
    "yorkshire-pharmacy-and-health-clinic",
    JSON.parse(
      fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/yorkshire-pharmacy-and-health-clinic.json"), "utf8"),
    ),
  );
  const brookCreds = brookProfile.data.displayCredentials;

  record(
    "credentials-shared-renderer",
    html.includes(`data-component="${SHARED_PHARMACY_CREDENTIALS_MARKER}"`) &&
      html.includes('data-credential-kind="demonstration"') &&
      html.includes("Superintendent Pharmacist") &&
      html.includes("Mr John Ward") &&
      html.includes("Demo GPhC No. 453756") &&
      html.includes("Demo GPhC registration No. 1109432") &&
      html.includes(DEMONSTRATION_CREDENTIALS_NOTICE) &&
      resolveSharedPharmacyCredentials({
        slug: BROOK_DERBY_DEMO_SLUG,
        credentials: brookCreds,
        surface: PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE,
      })?.verified === false,
    "credentials rendered through shared demonstration renderer",
  );
  record(
    "credentials-above-trust-image",
    (() => {
      const trust = html.search(/<section\b[^>]*data-template-block="trust-split"/i);
      const trustEnd = html.indexOf("</section>", trust);
      const media = html.indexOf('class="trust-media"', trust);
      const heading = html.indexOf("<h3>Pharmacy credentials</h3>", media);
      const creds = html.indexOf(`data-component="${SHARED_PHARMACY_CREDENTIALS_MARKER}"`, media);
      const image = html.indexOf('data-image-slot="trust"', media);
      return (
        trust > 0 &&
        media > trust &&
        heading > media &&
        creds > heading &&
        image > creds &&
        heading < trustEnd &&
        image < trustEnd
      );
    })(),
    "credentials sit in trust media above the existing image",
  );
  record(
    "brook-surface-permission",
    brookCreds?.allowedSurfaces.includes(PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE) === true &&
      brookCreds.allowedSurfaces.includes(SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE) === true &&
      brookCreds.kind === "demonstration" &&
      brookCreds.verificationStatus === "unverified",
    "Brook demonstration surface extended to local-page Preview only",
  );
  record(
    "no-tenant-leakage",
    resolveSharedPharmacyCredentials({
      slug: "yorkshire-pharmacy-and-health-clinic",
      credentials: brookCreds,
      surface: PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE,
    }) == null &&
      resolveSharedPharmacyCredentials({
        slug: BROOK_DERBY_DEMO_SLUG,
        credentials: brookCreds,
        surface: "ai-local-area-page-pilot-v3",
      }) == null &&
      yorkshireProfile.data.displayCredentials == null,
    "Yorkshire and other surfaces cannot use Brook demonstration credentials",
  );

  record(
    "governance-once-in-trust",
    (() => {
      const trust = html.search(/<section\b[^>]*data-template-block="trust-split"/i);
      const trustEnd = html.indexOf("</section>", trust);
      const block = html.search(/data-component="content-governance-panel"/i);
      const heading = html.search(new RegExp(`<h3>${CONTENT_GOVERNANCE_HEADING}</h3>`));
      return (
        (html.match(/data-component="content-governance-panel"/g) || []).length === 1 &&
        html.includes(DEMONSTRATION_APPROVAL_RECORD_LABEL) &&
        html.includes("Clinically reviewed and approved by") &&
        html.includes("Mr John Ward — Superintendent Pharmacist") &&
        html.includes("5 September 2026") &&
        html.includes('data-approval-record="false"') &&
        trust > 0 &&
        block > trust &&
        block < trustEnd &&
        heading > trust &&
        heading < trustEnd
      );
    })(),
    "demonstration Content governance appears once inside Trust",
  );

  const noticeAt = noticeIndex(html);
  const consultAt = html.search(/<section\b[^>]*data-template-block="consultation"/i);
  const between = noticeAt > 0 && consultAt > noticeAt ? html.slice(noticeAt, consultAt) : "";
  record(
    "notice-once-before-consultation",
    (html.match(/data-component="pharmacy-service-notice"/g) || []).length === 1 &&
      noticeAt > 0 &&
      consultAt > noticeAt &&
      !/<section\b/i.test(between.slice(between.indexOf("</section>") + "</section>".length)),
    "service notice appears once immediately before consultation",
  );
  record(
    "notice-exact-wording",
    html.includes(`<h2>${SERVICE_NOTICE_HEADING}</h2>`) && html.includes(notice.body),
    "Eligibility and important information uses the passed Pharmacy First wording",
  );

  record(
    "footer-disclaimer-once",
    (() => {
      const footer = html.search(/<footer\b[^>]*data-sales-demo-brook="footer"/i);
      const inner = html.indexOf("brook-demo-footer-inner", footer);
      const betweenFooter = footer >= 0 && inner > footer ? html.slice(footer, inner) : "";
      return (
        (html.match(/data-component="service-emergency-disclaimer"/g) || []).length === 1 &&
        html.includes(SERVICE_PAGE_EMERGENCY_FOOTER.replace(/&/g, "&amp;")) &&
        /service-emergency-disclaimer-band/.test(betweenFooter) &&
        html.includes("Demonstration website — for presentation purposes only.")
      );
    })(),
    "centred disclaimer once above existing footer columns",
  );

  record(
    "no-jsonld-in-unpublished-preview",
    !/application\/ld\+json/i.test(html) && !/>schema\.org</i.test(html),
    "no JSON-LD in unpublished Allestree Preview",
  );
  record(
    "inactive-schema-slot",
    /data-schema-enabled="false"/.test(html) && /data-schema-slot="service-page-master-template-v1"/.test(html),
    "invisible inactive schema slot present",
  );

  record(
    "allestree-copy-preserved",
    html.includes("Why Allestree patients start with the pharmacist") &&
      html.includes("approximately 4.1 km in a straight line from Allestree") &&
      html.includes("How do patients in Allestree reach Brook Pharmacy Demo Derby for Pharmacy First?") &&
      html.includes("Park Lane Surgery") &&
      html.includes("Friends of Allestree Park") &&
      html.includes("What happens during the consultation") &&
      html.includes("When to contact a GP, NHS 111 or emergency services") &&
      html.includes("pf-trust-diverse-team") &&
      html.includes("Book, call or get directions") &&
      saved.includes("Why Allestree patients start with the pharmacist") &&
      saved.includes("approximately 4.1 km in a straight line from Allestree"),
    "accepted Allestree copy, facts, FAQs, images and CTAs remain",
  );

  const futureSource = saved
    .replace(/Allestree/g, "Mackworth")
    .replace(/allestree/g, "mackworth");
  const futurePreview = overlayPharmacyFirstLocalPagePreviewHtml(futureSource, {
    slug: BROOK_DERBY_DEMO_SLUG,
    campaignId: "pharmacy-first",
    areaSlug: "mackworth",
  });
  record(
    "future-area-keeps-own-copy",
    futurePreview.includes("Why Mackworth patients start with the pharmacist") &&
      futurePreview.includes("approximately 4.1 km in a straight line from Mackworth") &&
      !futurePreview.includes("Allestree") &&
      futurePreview.includes(`data-component="${SHARED_PHARMACY_CREDENTIALS_MARKER}"`) &&
      futurePreview.includes("data-component=\"content-governance-panel\"") &&
      futurePreview.includes(notice.body) &&
      !/application\/ld\+json/i.test(futurePreview),
    "future area candidates keep their own copy and receive the same overlay",
  );

  const yorkshire = renderReviewCentrePreviewAsset(
    "yorkshire-pharmacy-and-health-clinic",
    "pharmacy-first",
    AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
    { areaSlug: "wombwell" },
  );
  record(
    "yorkshire-preview-untouched",
    yorkshire.sourceRoute === "ai-local-area-page-pilot-v3" &&
      !yorkshire.html.includes("Mr John Ward") &&
      !yorkshire.html.includes(DEMONSTRATION_CREDENTIALS_NOTICE) &&
      !yorkshire.html.includes(DEMONSTRATION_APPROVAL_RECORD_LABEL) &&
      !yorkshire.html.includes("data-component=\"content-governance-panel\"") &&
      yorkshire.html.includes("Wombwell"),
    "Yorkshire local Preview does not receive Brook demonstration compliance",
  );

  record(
    "saved-allestree-hash-unchanged",
    sha(allestreeFile) === before,
    before.slice(0, 12),
  );
  record("saved-wombwell-hash-unchanged", sha(wombwellFile) === wombwellBefore, wombwellBefore.slice(0, 12));
  record(
    "no-approval-record-written",
    loadServicePageMasterApproval(BROOK_DERBY_DEMO_SLUG, "pharmacy-first") == null &&
      loadServicePageMasterPublicationAuthorisation(BROOK_DERBY_DEMO_SLUG, "pharmacy-first") == null &&
      loadServicePageMasterPublication(BROOK_DERBY_DEMO_SLUG, "pharmacy-first") == null &&
      !fs.existsSync(servicePageMasterApprovalPath(BROOK_DERBY_DEMO_SLUG, "pharmacy-first")),
    "no approval, authorisation or publication file written",
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
