#!/usr/bin/env npx tsx
/**
 * Accepted Pharmacy First page-link destinations.
 * Does not generate, rewrite copy, publish, or clinically approve.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCEPTED_BROOK_MONEY_PAGE_HREF,
  ACCEPTED_SERVICE_PAGE_ASSET,
  resolveAcceptedPharmacyFirstPageRoutes,
} from "../src/pharmacy/pharmacyAcceptedPageRouteResolverV1.ts";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  BROOK_DERBY_DEMO_SLUG,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import {
  PHARMACY_FIRST_NOTICE_GUARANTEE_SENTENCE,
  SERVICE_PAGE_EMERGENCY_FOOTER,
  SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
} from "../src/pharmacy/pharmacyServicePageMasterTemplateV1.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AREAS = [
  "allestree",
  "mickleover",
  "littleover",
  "chellaston",
  "duffield",
  "alvaston",
  "mackworth",
  "chaddesden",
  "spondon",
  "borrowash",
] as const;
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const YORKSHIRE_HOSTED =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=service-page";

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

function heroPrimaryHref(html: string): string | null {
  const hero = html.match(/<section\b[^>]*data-template-block="hero"[^>]*>[\s\S]*?<div class="btns">([\s\S]*?)<\/div>/i);
  const match = hero?.[1]?.match(/<a class="btn"[^>]*href="([^"]*)"[^>]*>/i);
  return match ? match[1].replace(/&amp;/g, "&") : null;
}

function breadcrumbServiceHref(html: string): string | null {
  const match = html.match(
    /<nav class="local-breadcrumb[^"]*"[^>]*>\s*<a href="([^"]*)">Pharmacy First<\/a>/i,
  );
  return match ? match[1].replace(/&amp;/g, "&") : null;
}

function hrefHasToken(href: string | null): boolean {
  return Boolean(href && /(?:^|[?&])_t=/.test(href));
}

function main() {
  const copyBefore: Record<string, string> = {};
  const htmlBefore: Record<string, string> = {};
  for (const area of AREAS) {
    copyBefore[area] = sha(aiLocalCopyPilotPath(BROOK_DERBY_DEMO_SLUG, "pharmacy-first", area, AI_LOCAL_PILOT_CONTRACT_VERSION_V3));
    htmlBefore[area] = sha(aiLocalPagePilotHtmlPath(BROOK_DERBY_DEMO_SLUG, "pharmacy-first", area, AI_LOCAL_PILOT_CONTRACT_VERSION_V3));
  }

  const brook = resolveAcceptedPharmacyFirstPageRoutes({
    slug: BROOK_DERBY_DEMO_SLUG,
    campaignId: "pharmacy-first",
  });
  record("resolver-brook-pharmacy-first", Boolean(brook), JSON.stringify(brook));
  record(
    "resolver-service-destination",
    Boolean(
      brook?.servicePageHref ===
        `https://app.pharmaconnect.uk/api/growth-engine/${BROOK_DERBY_DEMO_SLUG}/review-preview?campaign=pharmacy-first&asset=${ACCEPTED_SERVICE_PAGE_ASSET}`,
    ),
    brook?.servicePageHref || "missing",
  );
  record(
    "resolver-money-destination",
    brook?.moneyPageHref === ACCEPTED_BROOK_MONEY_PAGE_HREF,
    brook?.moneyPageHref || "missing",
  );
  record(
    "resolver-rejects-yorkshire",
    resolveAcceptedPharmacyFirstPageRoutes({ slug: YORKSHIRE, campaignId: "pharmacy-first" }) === null,
    "yorkshire tenant is out of scope",
  );
  record(
    "resolver-rejects-other-campaign",
    resolveAcceptedPharmacyFirstPageRoutes({ slug: BROOK_DERBY_DEMO_SLUG, campaignId: "blood-pressure-checks" }) ===
      null,
    "non-pharmacy-first campaign is out of scope",
  );

  const service = renderReviewCentrePreviewAsset(
    BROOK_DERBY_DEMO_SLUG,
    "pharmacy-first",
    SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  );
  const serviceHeroHref = heroPrimaryHref(service.html);
  record(
    "service-source-route",
    service.sourceRoute === SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
    service.sourceRoute,
  );
  record(
    "service-primary-cta-money-page",
    serviceHeroHref === ACCEPTED_BROOK_MONEY_PAGE_HREF,
    String(serviceHeroHref),
  );
  record(
    "service-primary-cta-text-preserved",
    /<div class="btns">\s*<a class="btn" href="https:\/\/pharmacy\.inboxingproweb\.com\/">Contact the pharmacy<\/a>/i.test(
      service.html,
    ),
    "Contact the pharmacy remains the hero primary CTA",
  );
  record(
    "service-no-extra-hero-button",
    (service.html.match(/<section\b[^>]*data-template-block="hero"[^>]*>[\s\S]*?<div class="btns">([\s\S]*?)<\/div>/i)?.[1].match(/<a class="btn"/g) || []).length === 1,
    "hero .btns still has a single primary button",
  );
  record(
    "service-disclaimers-present",
    service.html.includes(SERVICE_PAGE_EMERGENCY_FOOTER.replace(/&/g, "&amp;")) &&
      service.html.includes(PHARMACY_FIRST_NOTICE_GUARANTEE_SENTENCE),
    "both renderer-owned disclaimers remain on the service page",
  );
  record(
    "service-no-yorkshire-hosted-service",
    !service.html.includes(YORKSHIRE_HOSTED) &&
      !/yorkshire-pharmacy-and-health-clinic\/review-preview/i.test(service.html),
    "no Yorkshire-hosted service demonstration href",
  );
  record("service-cta-token-free", !hrefHasToken(serviceHeroHref), String(serviceHeroHref));

  for (const area of AREAS) {
    const preview = renderReviewCentrePreviewAsset(
      BROOK_DERBY_DEMO_SLUG,
      "pharmacy-first",
      AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
      { areaSlug: area },
    );
    const crumb = breadcrumbServiceHref(preview.html);
    const book = preview.html.match(
      /<section\b[^>]*data-template-block="hero"[^>]*>[\s\S]*?<a class="btn" href="([^"]*)">Book An Appointment<\/a>/i,
    );
    const bookHref = book ? book[1].replace(/&amp;/g, "&") : null;
    record(
      `${area}-breadcrumb`,
      crumb === brook?.servicePageHref,
      String(crumb),
    );
    record(
      `${area}-book-cta`,
      bookHref === brook?.servicePageHref,
      String(bookHref),
    );
    record(
      `${area}-token-free`,
      !hrefHasToken(crumb) && !hrefHasToken(bookHref),
      "breadcrumb and Book An Appointment have no _t",
    );
    record(
      `${area}-no-yorkshire-hosted-service`,
      !preview.html.includes(YORKSHIRE_HOSTED) &&
        !new RegExp(`${YORKSHIRE}/review-preview\\?campaign=pharmacy-first&asset=service-page`).test(preview.html),
      "no Yorkshire-hosted service demonstration href",
    );
    record(
      `${area}-overview-not-rewritten`,
      preview.html.includes('href="/pharmacy-first/">Pharmacy First overview</a>'),
      "nearby overview link stays on the existing in-page destination",
    );
  }

  const yorkshireLocal = renderReviewCentrePreviewAsset(
    YORKSHIRE,
    "pharmacy-first",
    AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
    { areaSlug: "wombwell" },
  );
  record(
    "no-tenant-leakage-to-yorkshire",
    yorkshireLocal.sourceRoute === "ai-local-area-page-pilot-v3" &&
      !yorkshireLocal.html.includes(BROOK_DERBY_DEMO_SLUG) &&
      !yorkshireLocal.html.includes(String(brook?.servicePageHref || "service-page-master-template-v1")),
    "Yorkshire Preview does not receive Brook accepted destinations",
  );

  for (const area of AREAS) {
    record(
      `${area}-copy-unchanged`,
      sha(aiLocalCopyPilotPath(BROOK_DERBY_DEMO_SLUG, "pharmacy-first", area, AI_LOCAL_PILOT_CONTRACT_VERSION_V3)) === copyBefore[area],
      copyBefore[area].slice(0, 16),
    );
    record(
      `${area}-saved-html-unchanged`,
      sha(aiLocalPagePilotHtmlPath(BROOK_DERBY_DEMO_SLUG, "pharmacy-first", area, AI_LOCAL_PILOT_CONTRACT_VERSION_V3)) === htmlBefore[area],
      htmlBefore[area].slice(0, 16),
    );
  }

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
