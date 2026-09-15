#!/usr/bin/env npx tsx
/**
 * Locality indexability authority — approved published locality pages become index,follow.
 * Preview/draft/unapproved/rejected/non-selected remain noindex.
 * Does not regenerate content, fix schema, fix /locations/, publish via UI, or submit indexing.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAuthoritativePublicationRobotsToHtml,
  applyAuthoritativePublicationRobotsToHtmlTree,
  inferTechnicalSeoPageTypeFromPublicPath,
  INDEXABLE_ROBOTS_DIRECTIVE,
  NONINDEXABLE_ROBOTS_DIRECTIVE,
  resolvePublicationRobotsDirective,
} from "../src/pharmacy/pharmacyPublicationIndexabilityAuthority.ts";
import { rewritePublishHtmlForStaticHosting } from "../src/pharmacy/pharmacyPublishPackageAssembler.ts";
import { getTechnicalSeoContract } from "../src/pharmacy/pharmacyTechnicalSeoContract.ts";
import {
  assertNoTechnicalSeoIndexBlockers,
  auditPublishedTechnicalSeo,
} from "../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
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
  const tag = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i)?.[0] || "";
  return tag.match(/\bcontent=["']([^"']+)["']/i)?.[1] || "";
}

function previewLocalityHtml(): string {
  return `<!DOCTYPE html><html><head>
<meta name="robots" content="noindex, nofollow"/>
<title>Travel Vaccinations in Oadby | Fixture Pharmacy</title>
<meta name="description" content="Travel vaccinations for patients in Oadby."/>
<link rel="canonical" href="https://fixture-alpha.sites.pharmaconnect.uk/local-oadby/"/>
</head><body>
<h1>Travel Vaccinations in Oadby</h1>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","url":"https://example.local/travel-vaccinations/local/oadby/"}</script>
<nav><a href="/locations/">Locations</a></nav>
</body></html>`;
}

async function main() {
  console.log("\n=== Locality indexability authority ===\n");

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
  const robotsBefore = Object.fromEntries(
    LOCALITIES.map((area) => {
      const file = path.join(LIVE_ROOT, `local-${area}`, "index.html");
      return [area, fs.existsSync(file) ? robotsOf(fs.readFileSync(file, "utf8")) : "MISSING"];
    }),
  );

  const publishedLocality = resolvePublicationRobotsDirective({
    pageType: "locality",
    publicationRole: "authoritative_indexable_publication",
    publicPath: "/local-oadby/",
    serviceId: "travel-vaccinations",
  });
  record(
    "approved-published-locality-index-follow",
    publishedLocality.robots === INDEXABLE_ROBOTS_DIRECTIVE && publishedLocality.indexable === true,
    `${publishedLocality.robots} ${publishedLocality.reason}`,
  );

  for (const role of ["draft", "unapproved", "rejected", "non_selected", "preview"] as const) {
    const decision = resolvePublicationRobotsDirective({
      pageType: "locality",
      publicationRole: role,
      publicPath: "/local-oadby/",
      serviceId: "travel-vaccinations",
    });
    record(
      `${role}-locality-remains-noindex`,
      decision.robots === NONINDEXABLE_ROBOTS_DIRECTIVE && decision.indexable === false,
      `${role} → ${decision.robots}`,
    );
  }

  const servicePolicy = getTechnicalSeoContract("service");
  const localityPolicy = getTechnicalSeoContract("locality");
  const homepagePolicy = getTechnicalSeoContract("homepage");
  record(
    "service-and-locality-policies-page-type-aware",
    servicePolicy?.indexableByDefault === true &&
      localityPolicy?.indexableByDefault === true &&
      homepagePolicy?.indexableByDefault === false &&
      inferTechnicalSeoPageTypeFromPublicPath("/local-oadby/", "travel-vaccinations") === "locality" &&
      inferTechnicalSeoPageTypeFromPublicPath("/travel-vaccinations/", "travel-vaccinations") === "service",
    `service=${servicePolicy?.indexableByDefault} locality=${localityPolicy?.indexableByDefault} home=${homepagePolicy?.indexableByDefault}`,
  );

  const rewritten = rewritePublishHtmlForStaticHosting(previewLocalityHtml(), "fixture-alpha", "travel-vaccinations", "/local-oadby/");
  record(
    "publish-rewrite-lifts-preview-noindex-for-authoritative-locality",
    robotsOf(rewritten) === INDEXABLE_ROBOTS_DIRECTIVE &&
      rewritten.includes("https://fixture-alpha.sites.pharmaconnect.uk/local-oadby/") &&
      !rewritten.includes("https://example.local/") &&
      !rewritten.includes('href="/locations/"'),
    `robots=${robotsOf(rewritten)}`,
  );

  const previewHtml = applyAuthoritativePublicationRobotsToHtml(previewLocalityHtml(), {
    pageType: "locality",
    publicationRole: "preview",
    publicPath: "/local-oadby/",
    serviceId: "travel-vaccinations",
  });
  record("preview-html-keeps-noindex", robotsOf(previewHtml) === NONINDEXABLE_ROBOTS_DIRECTIVE, robotsOf(previewHtml));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "locality-indexability-"));
  fs.mkdirSync(path.join(tmp, "local-oadby"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "travel-vaccinations"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "local-oadby", "index.html"), previewLocalityHtml(), "utf8");
  fs.writeFileSync(
    path.join(tmp, "travel-vaccinations", "index.html"),
    `<html><head><meta name="robots" content="index, follow"/><title>Service</title></head><body><h1>Service</h1></body></html>`,
    "utf8",
  );
  const tree = applyAuthoritativePublicationRobotsToHtmlTree(tmp, "travel-vaccinations");
  record(
    "tenant-service-isolation-tree",
    tree.filesUpdated >= 1 &&
      robotsOf(fs.readFileSync(path.join(tmp, "local-oadby", "index.html"), "utf8")) === INDEXABLE_ROBOTS_DIRECTIVE &&
      robotsOf(fs.readFileSync(path.join(tmp, "travel-vaccinations", "index.html"), "utf8")) === INDEXABLE_ROBOTS_DIRECTIVE,
    `updated=${tree.filesUpdated}`,
  );
  fs.rmSync(tmp, { recursive: true, force: true });

  const liveOverlay = applyAuthoritativePublicationRobotsToHtmlTree(LIVE_ROOT, "pharmacy-first");
  const preparedOverlay = applyAuthoritativePublicationRobotsToHtmlTree(PREPARED_ROOT, "pharmacy-first");
  record(
    "bounded-live-robots-overlay",
    liveOverlay.filesScanned >= 9 && preparedOverlay.filesScanned >= 9,
    `live=${liveOverlay.filesUpdated}/${liveOverlay.filesScanned} prepared=${preparedOverlay.filesUpdated}/${preparedOverlay.filesScanned}`,
  );

  const robotsAfter: Record<string, string> = {};
  let allIndexFollow = true;
  let titlesUnchanged = true;
  for (const area of LOCALITIES) {
    const html = fs.readFileSync(path.join(LIVE_ROOT, `local-${area}`, "index.html"), "utf8");
    robotsAfter[area] = robotsOf(html);
    if (robotsAfter[area] !== INDEXABLE_ROBOTS_DIRECTIVE) allIndexFollow = false;
    if (!html.includes(`Pharmacy First in ${area[0]!.toUpperCase()}${area.slice(1)}`)) titlesUnchanged = false;
  }
  record("vision-eight-locality-robots-index-follow", allIndexFollow, LOCALITIES.map((area) => `${area}:${robotsBefore[area]}→${robotsAfter[area]}`).join(" | "));
  record("titles-unchanged", titlesUnchanged, "locality titles left intact");

  const serviceHtml = fs.readFileSync(path.join(LIVE_ROOT, "pharmacy-first", "index.html"), "utf8");
  record(
    "service-robots-unchanged-index-follow",
    robotsOf(serviceHtml) === INDEXABLE_ROBOTS_DIRECTIVE,
    robotsOf(serviceHtml),
  );

  const audit = await auditPublishedTechnicalSeo({ slug: "vision-pharmacy", serviceId: "pharmacy-first", fetchLive: true });
  const localityPages = audit.pages.filter((page) => page.pageType === "locality");
  const robotsPass = localityPages.filter((page) => !/\bnoindex\b/i.test(page.robots || "")).length;
  const remainingBlockers = [...new Set(localityPages.flatMap((page) => page.blockers.map((item) => item.code)))];
  record(
    "vision-robots-pass-count",
    audit.intendedIndexableUrls === 9 && robotsPass === 8 && localityPages.every((page) => page.httpStatus === 200),
    `intended=${audit.intendedIndexableUrls} localityRobotsPass=${robotsPass}/8`,
  );
  record(
    "indexability-blockers-exclude-accidental-noindex",
    !remainingBlockers.includes("accidental_noindex") && robotsPass === 8,
    `eligible=${audit.eligibleCount} blocked=${audit.blockedCount} codes=${remainingBlockers.join(",")}`,
  );

  let gateThrew = false;
  try {
    assertNoTechnicalSeoIndexBlockers(audit);
  } catch {
    gateThrew = true;
  }
  record("indexing-gate-matches-blockers", gateThrew === audit.blockedCount > 0, `threw=${gateThrew} blocked=${audit.blockedCount}`);

  const indexing = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-indexing/vision-pharmacy.json"), "utf8")) as { submitted?: number };
  record("nothing-submitted-for-indexing", (indexing.submitted || 0) === 0, `submitted=${indexing.submitted || 0}`);
  const areas = explicitConfirmedLocalityNames(readSetupProfile("vision-pharmacy").selectedAreas);
  record("vision-areas-unchanged", areas.length === 8, `areas=${areas.length}`);

  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  const changed = hashed.filter((rel) => before[rel] !== after[rel]);
  record("vision-protected-hashes-unchanged", changed.length === 0, changed.length ? changed.join(", ") : "protected Vision files unchanged");

  console.log("\nrobots before → after");
  for (const area of LOCALITIES) {
    console.log(`  ${area}: ${robotsBefore[area]} → ${robotsAfter[area]}`);
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length} checks`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
