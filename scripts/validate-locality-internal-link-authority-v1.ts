#!/usr/bin/env npx tsx
/**
 * Locality internal-link authority — unpublished generator routes such as /locations/
 * cannot survive into authoritative publication. Does not invent a locations page
 * or redirect. Does not regenerate content or submit indexing.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAuthoritativeInternalLinksToHtml,
  applyAuthoritativeInternalLinksToHtmlTree,
} from "../src/pharmacy/pharmacyPublicationInternalLinkAuthority.ts";
import { rewritePublishHtmlForStaticHosting } from "../src/pharmacy/pharmacyPublishPackageAssembler.ts";
import {
  assertNoTechnicalSeoIndexBlockers,
  auditPublishedTechnicalSeo,
} from "../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
import { evaluateTechnicalSeoIndexGate } from "../src/pharmacy/pharmacyTechnicalSeoIndexGate.ts";
import { explicitConfirmedLocalityNames } from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE_ROOT = "/var/www/pharmaconnect-sites/vision-pharmacy/current";
const PREPARED_ROOT = path.join(ROOT, "artifacts/output/pharmacy-publish/vision-pharmacy");
const LOCALITIES = [
  "oadby",
  "wigston",
  "leicester",
  "hamilton",
  "braunstone",
  "blaby",
  "thurmaston",
  "birstall",
];

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha(rel: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function robotsOf(html: string): string {
  return html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i)?.[0]?.match(/\bcontent=["']([^"']+)["']/i)?.[1] || "";
}

function titleOf(html: string): string {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
}

function canonicalOf(html: string): string {
  return html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0]?.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((match) => match[1] || "");
}

function localityFixture(area: string, serviceId = "travel-vaccinations"): string {
  return `<!DOCTYPE html><html><head>
<meta name="robots" content="index, follow"/>
<title>Travel Vaccinations in ${area[0]!.toUpperCase()}${area.slice(1)} | Fixture Pharmacy</title>
<meta name="description" content="Travel vaccinations for patients in ${area}."/>
<link rel="canonical" href="https://fixture-alpha.sites.pharmaconnect.uk/local-${area}/"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","url":"https://fixture-alpha.sites.pharmaconnect.uk/local-${area}/"}</script>
</head><body>
<nav class="local-breadcrumb wrap" aria-label="Breadcrumb"><a href="/${serviceId}/">${serviceId}</a> <span aria-hidden="true">›</span> <a href="/locations/">Locations</a> <span aria-hidden="true">›</span> <span>${area}</span></nav>
<p><a href="/${serviceId}/">Service overview</a></p>
<p><a href="/local-wigston/">Wigston</a></p>
<p><a href="/api/pharmacy-visual-experience/locations/?slug=fixture-alpha">Preview hub</a></p>
<footer><a href="https://www.customer-pharmacy.example/">Customer website</a></footer>
</body></html>`;
}

function httpStatus(url: string): Promise<number> {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method: "HEAD" }, (res) => {
      resolve(res.statusCode || 0);
      res.resume();
    });
    req.on("error", () => resolve(0));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve(0);
    });
    req.end();
  });
}

async function main() {
  console.log("\n=== Locality internal-link authority ===\n");

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
    "data/growth-engine/vision-pharmacy-review-centre.json",
    "data/pharmacy-indexing/vision-pharmacy.json",
    "data/pharmacy-registry/vision-pharmacy.json",
    "output/pharmacy-visual-experience/vision-pharmacy/pharmacy-first/index.html",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  const sitemapBefore = crypto.createHash("sha256").update(fs.readFileSync(path.join(LIVE_ROOT, "sitemap.xml"))).digest("hex");
  const locationsBefore = Object.fromEntries(
    LOCALITIES.map((area) => {
      const html = fs.readFileSync(path.join(LIVE_ROOT, `local-${area}`, "index.html"), "utf8");
      return [area, html.includes('href="/locations/"')];
    }),
  );

  const published = ["/travel-vaccinations/", "/local-oadby/", "/local-wigston/"];
  const rewritten = applyAuthoritativeInternalLinksToHtml(localityFixture("oadby"), {
    slug: "fixture-alpha",
    serviceId: "travel-vaccinations",
    publicPath: "/local-oadby/",
    publishedPublicPaths: published,
  });
  record(
    "authoritative-locality-has-no-broken-hub-link",
    !rewritten.includes('href="/locations/"') && rewritten.includes('href="/travel-vaccinations/"'),
    hrefs(rewritten).join(" | "),
  );
  record(
    "locality-to-service-resolves-to-publication-path",
    rewritten.includes('href="/travel-vaccinations/"') && /local-breadcrumb[\s\S]*href="\/travel-vaccinations\/"/.test(rewritten),
    "breadcrumb keeps service link",
  );
  record(
    "service-to-locality-kept-where-present",
    rewritten.includes('href="/local-wigston/"'),
    "sibling locality href kept",
  );
  record(
    "unpublished-locations-cannot-survive",
    !/href=["'][^"']*\/locations\/?["']/.test(rewritten),
    "no /locations/ href",
  );
  record(
    "preview-placeholder-cannot-leak",
    !rewritten.includes("/api/pharmacy-visual-experience/") && rewritten.includes("Preview hub"),
    "preview href unwrapped, text kept",
  );
  record(
    "customer-website-identity-preserved",
    rewritten.includes('href="https://www.customer-pharmacy.example/"'),
    "customer website kept",
  );

  const noFakePage = applyAuthoritativeInternalLinksToHtml(localityFixture("oadby"), {
    slug: "fixture-alpha",
    serviceId: "travel-vaccinations",
    publishedPublicPaths: published,
  });
  record(
    "no-fake-locations-destination-invented",
    !noFakePage.includes('href="/locations/"') && published.every((item) => item !== "/locations/"),
    "hub unpublished and not created",
  );

  const betaHtml = applyAuthoritativeInternalLinksToHtml(
    `<a href="https://fixture-beta.sites.pharmaconnect.uk/local-oadby/">Other tenant</a><a href="/travel-vaccinations/">Service</a>`,
    { slug: "fixture-alpha", serviceId: "travel-vaccinations", publishedPublicPaths: published },
  );
  record(
    "tenant-a-cannot-link-to-tenant-b",
    !betaHtml.includes("fixture-beta.sites.pharmaconnect.uk") && betaHtml.includes("Other tenant"),
    betaHtml,
  );

  const otherService = applyAuthoritativeInternalLinksToHtml(
    `<nav class="local-breadcrumb wrap"><a href="/blood-pressure-checks/">Blood Pressure Checks</a> <span aria-hidden="true">›</span> <a href="/locations/">Locations</a> <span aria-hidden="true">›</span> <span>Oadby</span></nav>`,
    {
      slug: "fixture-alpha",
      serviceId: "travel-vaccinations",
      publishedPublicPaths: ["/travel-vaccinations/", "/local-oadby/"],
    },
  );
  record(
    "service-a-does-not-keep-unpublished-service-b-as-required-nav",
    !otherService.includes('href="/locations/"') && !otherService.includes('href="/blood-pressure-checks/"'),
    hrefs(otherService).join(" | ") || "no hrefs",
  );

  const oadbyOnly = applyAuthoritativeInternalLinksToHtml(localityFixture("oadby"), {
    slug: "fixture-alpha",
    serviceId: "travel-vaccinations",
    publicPath: "/local-oadby/",
    publishedPublicPaths: ["/travel-vaccinations/", "/local-oadby/"],
  });
  const wigstonOnly = applyAuthoritativeInternalLinksToHtml(localityFixture("wigston").replace("/local-wigston/", "/local-oadby/"), {
    slug: "fixture-alpha",
    serviceId: "travel-vaccinations",
    publicPath: "/local-wigston/",
    publishedPublicPaths: ["/travel-vaccinations/", "/local-wigston/"],
  });
  record(
    "locality-specific-nav-does-not-swap-a-for-b",
    oadbyOnly.includes("/local-oadby/") &&
      !wigstonOnly.includes('href="/local-oadby/"') &&
      wigstonOnly.includes("/local-wigston/"),
    "oadby/wigston destinations stay distinct",
  );

  const publishRewritten = rewritePublishHtmlForStaticHosting(localityFixture("oadby"), "fixture-alpha", "travel-vaccinations", "/local-oadby/");
  record(
    "publish-rewrite-strips-unpublished-hub",
    !publishRewritten.includes('href="/locations/"') && publishRewritten.includes('href="/travel-vaccinations/"'),
    hrefs(publishRewritten).join(" | "),
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "internal-link-authority-"));
  fs.mkdirSync(path.join(tmp, "local-oadby"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "travel-vaccinations"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "local-oadby", "index.html"), localityFixture("oadby"), "utf8");
  fs.writeFileSync(
    path.join(tmp, "travel-vaccinations", "index.html"),
    `<html><head></head><body><a href="/local-oadby/">Oadby</a><a href="/locations/">Locations</a></body></html>`,
    "utf8",
  );
  const tree = applyAuthoritativeInternalLinksToHtmlTree(tmp, "fixture-alpha", "travel-vaccinations");
  const treeLocality = fs.readFileSync(path.join(tmp, "local-oadby", "index.html"), "utf8");
  const treeService = fs.readFileSync(path.join(tmp, "travel-vaccinations", "index.html"), "utf8");
  record(
    "tree-overlay-service-and-locality-nav",
    !treeLocality.includes('href="/locations/"') &&
      treeLocality.includes('href="/travel-vaccinations/"') &&
      treeService.includes('href="/local-oadby/"') &&
      !treeService.includes('href="/locations/"') &&
      !fs.existsSync(path.join(tmp, "locations", "index.html")),
    `updated=${tree.filesUpdated} published=${tree.publishedPublicPaths.join(",")}`,
  );
  fs.rmSync(tmp, { recursive: true, force: true });

  const validGate = evaluateTechnicalSeoIndexGate({
    slug: "fixture-alpha",
    serviceId: "travel-vaccinations",
    pageType: "locality",
    publicPath: "/local-oadby/",
    html: `<!DOCTYPE html><html><head><title>Travel Vaccinations in Oadby | Fixture Pharmacy</title><meta name="description" content="Travel vaccinations for patients in Oadby."/><link rel="canonical" href="https://fixture-alpha.sites.pharmaconnect.uk/local-oadby/"/><meta name="robots" content="index, follow"/><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","url":"https://fixture-alpha.sites.pharmaconnect.uk/local-oadby/"}</script></head><body><h1>Travel Vaccinations in Oadby</h1><a href="/travel-vaccinations/">Travel Vaccinations</a><img src="/hero.webp" alt="Consultation room"/></body></html>`,
    pageUrl: "https://fixture-alpha.sites.pharmaconnect.uk/local-oadby/",
    httpStatus: 200,
    sitemapUrls: [
      "https://fixture-alpha.sites.pharmaconnect.uk/travel-vaccinations/",
      "https://fixture-alpha.sites.pharmaconnect.uk/local-oadby/",
    ],
    expectedLocality: "Oadby",
  });
  record(
    "gate-zero-blockers-when-mandatory-rules-pass",
    validGate.eligible === true && validGate.blockers.length === 0,
    validGate.blockers.map((item) => item.code).join(",") || "none",
  );

  const liveOverlay = applyAuthoritativeInternalLinksToHtmlTree(LIVE_ROOT, "vision-pharmacy", "pharmacy-first");
  const preparedOverlay = applyAuthoritativeInternalLinksToHtmlTree(PREPARED_ROOT, "vision-pharmacy", "pharmacy-first");
  record(
    "bounded-live-internal-link-overlay",
    liveOverlay.filesScanned >= 9 && preparedOverlay.filesScanned >= 9 && !liveOverlay.publishedPublicPaths.includes("/locations/"),
    `live=${liveOverlay.filesUpdated}/${liveOverlay.filesScanned} prepared=${preparedOverlay.filesUpdated}/${preparedOverlay.filesScanned}`,
  );

  let robotsPass = true;
  let titlesPass = true;
  let canonicalPass = true;
  let schemaPass = true;
  let exampleCount = 0;
  let locationsAfter = 0;
  let serviceNav = true;
  for (const area of LOCALITIES) {
    const html = fs.readFileSync(path.join(LIVE_ROOT, `local-${area}`, "index.html"), "utf8");
    if (robotsOf(html) !== "index, follow") robotsPass = false;
    if (!titleOf(html).includes(`Pharmacy First in ${area[0]!.toUpperCase()}${area.slice(1)}`)) titlesPass = false;
    if (canonicalOf(html) !== `https://vision-pharmacy.sites.pharmaconnect.uk/local-${area}/`) canonicalPass = false;
    if (html.includes("example.local")) exampleCount += (html.match(/example.local/g) || []).length;
    if (html.includes('href="/locations/"')) locationsAfter += 1;
    if (!html.includes('href="/pharmacy-first/"')) serviceNav = false;
    if (!html.includes(`"url":"https://vision-pharmacy.sites.pharmaconnect.uk/local-${area}/"`) && !html.includes(`"url": "https://vision-pharmacy.sites.pharmaconnect.uk/local-${area}/"`)) {
      schemaPass = false;
    }
  }
  const serviceHtml = fs.readFileSync(path.join(LIVE_ROOT, "pharmacy-first", "index.html"), "utf8");
  record("blocker-01-robots-remain-index-follow", robotsPass && robotsOf(serviceHtml) === "index, follow", "9 intended pages keep index, follow");
  record("blocker-02-example-local-remains-zero", exampleCount === 0 && schemaPass, `example.local=${exampleCount}`);
  record("titles-canonical-unchanged", titlesPass && canonicalPass, "titles/canonicals intact");
  record(
    "vision-locations-href-cleared",
    locationsAfter === 0 && !serviceHtml.includes('href="/locations/"'),
    `before=${Object.values(locationsBefore).filter(Boolean).length} after=${locationsAfter}`,
  );
  record("locality-to-service-nav-kept", serviceNav, "all 8 locality pages link to /pharmacy-first/");
  record("service-to-locality-nav-kept", serviceHtml.includes('href="/local-leicester/"'), "service coverage link kept");
  record(
    "no-fake-locations-page-or-redirect",
    !fs.existsSync(path.join(LIVE_ROOT, "locations", "index.html")) &&
      !fs.existsSync(path.join(PREPARED_ROOT, "locations", "index.html")),
    "locations/ directory not created",
  );

  const locationsStatus = await httpStatus("https://vision-pharmacy.sites.pharmaconnect.uk/locations/");
  record("locations-still-404", locationsStatus === 404, `HTTP ${locationsStatus}`);

  const sitemapAfter = crypto.createHash("sha256").update(fs.readFileSync(path.join(LIVE_ROOT, "sitemap.xml"))).digest("hex");
  record("sitemap-unchanged", sitemapBefore === sitemapAfter, "sitemap hash unchanged");

  const audit = await auditPublishedTechnicalSeo({ slug: "vision-pharmacy", serviceId: "pharmacy-first", fetchLive: true });
  const intended = audit.pages.filter((page) => page.intendedIndexable);
  const sitemapOk = audit.sitemapUrls.filter((url) => !url.replace(/\/$/, "").endsWith("vision-pharmacy.sites.pharmaconnect.uk")).length;
  void sitemapOk;
  const sitemapStatuses = await Promise.all(
    audit.sitemapUrls.map(async (url) => [url, await httpStatus(url)] as const),
  );
  record(
    "sitemap-intended-indexable-urls-return-200",
    sitemapStatuses.every(([, status]) => status === 200) && audit.sitemapUrls.length === 9,
    sitemapStatuses.map(([url, status]) => `${url}→${status}`).join(" | "),
  );
  record(
    "final-live-index-counts",
    audit.totalPublishedUrls === 10 &&
      audit.intendedIndexableUrls === 9 &&
      audit.intentionallyNonIndexableUrls === 1 &&
      audit.eligibleCount === 9 &&
      audit.blockedCount === 0,
    `published=${audit.totalPublishedUrls} intended=${audit.intendedIndexableUrls} non=${audit.intentionallyNonIndexableUrls} eligible=${audit.eligibleCount} blocked=${audit.blockedCount}`,
  );
  record(
    "final-live-pages-pass-mandatory-rules",
    intended.length === 9 &&
      intended.every((page) => page.eligible && page.blockers.length === 0 && page.httpStatus === 200) &&
      intended.every((page) => page.robots.includes("index")) &&
      intended.every((page) => page.title && page.metaDescription && page.h1.length === 1),
    `intendedEligible=${intended.filter((page) => page.eligible).length}/9`,
  );
  record(
    "homepage-remains-non-indexable",
    audit.pages.some((page) => page.pageType === "homepage" && page.intendedIndexable === false && page.eligible === false),
    "homepage excluded",
  );

  let gateThrew = false;
  try {
    assertNoTechnicalSeoIndexBlockers(audit);
  } catch {
    gateThrew = true;
  }
  record("index-gate-open-when-zero-blockers", gateThrew === false && audit.blockedCount === 0, `threw=${gateThrew}`);

  const indexing = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-indexing/vision-pharmacy.json"), "utf8")) as { submitted?: number };
  record("nothing-submitted-for-indexing", (indexing.submitted || 0) === 0, `submitted=${indexing.submitted || 0}`);
  const areas = explicitConfirmedLocalityNames(readSetupProfile("vision-pharmacy").selectedAreas);
  record("vision-areas-unchanged", areas.length === 8, `areas=${areas.length}`);
  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  const changed = hashed.filter((rel) => before[rel] !== after[rel]);
  record("vision-protected-hashes-unchanged", changed.length === 0, changed.length ? changed.join(", ") : "protected Vision files unchanged");

  console.log("\n/locations/ before → after");
  for (const area of LOCALITIES) {
    console.log(`  ${area}: ${locationsBefore[area] ? "/locations/" : "none"} → ${fs.readFileSync(path.join(LIVE_ROOT, `local-${area}`, "index.html"), "utf8").includes('href="/locations/"') ? "/locations/" : "removed"}`);
  }

  const failed = checks.filter((item) => !item.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((item) => item.pass).length}/${checks.length} checks`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
