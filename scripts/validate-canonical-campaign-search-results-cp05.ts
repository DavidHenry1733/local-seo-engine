#!/usr/bin/env npx tsx
/**
 * CP05 canonical search results.
 * Provider calls are in-memory. Historical pharmacies are not submitted.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { recordCanonicalCampaignPageDecision } from "../src/pharmacy/canonicalCampaignApprovalService.ts";
import { publishCanonicalCampaign } from "../src/pharmacy/canonicalCampaignPublishingService.ts";
import { classifyExistingPublishIndex } from "../src/pharmacy/canonicalCampaignPublishingService.ts";
import {
  CANONICAL_SEARCH_GSC_ATTRIBUTION,
  checkCanonicalCampaignIndexing,
  classifyLegacyRankFile,
  fetchCanonicalSearchConsolePerformance,
  recordCanonicalRankObservations,
  resolveCanonicalCampaignResults,
  resolveCanonicalSearchIdentity,
  submitCanonicalCampaignSearch,
} from "../src/pharmacy/canonicalCampaignSearchResultsService.ts";

const FIXTURE = "cp05-search-fixture-tenant";
const OTHER = "cp05-search-other-tenant";
const CAMPAIGN = "cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa";
const SERVICE = "blood-pressure-checks";
const AREAS = ["north-ward", "south-ward"] as const;
const HISTORICAL = [
  "brook-pharmacy-demo-derby",
  "yorkshire-pharmacy-and-health-clinic",
  "leeds-pharmacy",
  "vision-pharmacy",
  "banner-cross-pharmacy",
] as const;
const CAMPAIGNS = {
  "brook-pharmacy-demo-derby": "caf83fc0-9b8a-40a9-85f9-f79b99b094c5",
  "yorkshire-pharmacy-and-health-clinic": "f0792269-9f9e-4221-b851-495db93cf6a6",
  "leeds-pharmacy": "71b30b61-ef4e-4f60-911c-b0f0b1424ee8",
  "vision-pharmacy": "c6b16251-291c-4879-b143-ced92de37312",
  "banner-cross-pharmacy": "bdc9d7d1-f757-4812-99c1-44b6e03ea789",
} as const;

const failures: string[] = [];
function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
}

function hashTree(slug: string): string {
  const roots = [
    `data/pharmacy-campaigns/${slug}.json`,
    `data/pharmacy-content-packages/${slug}`,
    `data/pharmacy-local-page-campaign-runs/${slug}`,
    `data/pharmacy-ai-local-copy-pilots/${slug}`,
    `data/pharmacy-ai-local-copy-candidates/${slug}`,
    `data/pharmacy-ai-local-copy-checkpoints/${slug}`,
    `data/pharmacy-ai-local-copy-decisions/${slug}`,
    `data/pharmacy-master-admin/service-page-review/${slug}`,
    `data/pharmacy-master-admin/cluster-page-review/${slug}`,
    `data/pharmacy-master-admin/canonical-campaign-approval/${slug}`,
    `data/pharmacy-master-admin/canonical-campaign-publication/${slug}`,
    `data/pharmacy-master-admin/canonical-campaign-search/${slug}`,
    `data/pharmacy-search-console-authority/${slug}.json`,
    `data/growth-engine/${slug}-campaign-builder.json`,
    `output/pharmacy-content-ecosystem/${slug}`,
    `output/pharmacy-visual-experience/${slug}`,
    `output/pharmacy-publish/${slug}`,
    `data/pharmacy-indexing/${slug}.json`,
    `data/pharmacy-visibility/${slug}.json`,
    `output/${slug}/gsc-summary.json`,
    `output/${slug}/rank-tracking.json`,
    `output/${slug}/index-dashboard.json`,
  ];
  const files: string[] = [];
  for (const relative of roots) {
    const full = path.join(PHARMACY_WORKSPACE_ROOT, relative);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isFile()) files.push(full);
    else collect(full, files);
  }
  files.sort();
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(path.relative(PHARMACY_WORKSPACE_ROOT, file));
    hash.update("\0");
    hash.update(fs.readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function collect(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.isFile()) out.push(full);
  }
}

function writePage(kind: "service" | "locality", body: string, area?: string): void {
  const file = kind === "service"
    ? path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", FIXTURE, SERVICE, "index.html")
    : path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", FIXTURE, SERVICE, "local", area || "", "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function approve(pageType: "service" | "locality", areaSlug?: string): void {
  recordCanonicalCampaignPageDecision({
    tenantSlug: FIXTURE,
    campaignId: CAMPAIGN,
    serviceId: SERVICE,
    pageType,
    areaSlug,
    decision: "approved",
    source: "master-admin",
    reviewer: "cp05-fixture",
  });
}

function connect(): void {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-search-console-authority", `${FIXTURE}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    connected: true,
    canSubmitSitemaps: true,
    property: { matchedProperty: `https://${FIXTURE}.sites.pharmaconnect.uk/`, requestedProperty: `https://${FIXTURE}.sites.pharmaconnect.uk/` },
  }));
}

function cleanup(): void {
  for (const target of [
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-approval", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-publication", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-search", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-search", OTHER),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-search-console-authority", `${FIXTURE}.json`),
  ]) fs.rmSync(target, { recursive: true, force: true });
}

async function run(): Promise<void> {
  const before = Object.fromEntries(HISTORICAL.map((slug) => [slug, hashTree(slug)]));
  const source = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/canonicalCampaignSearchResultsService.ts"), "utf8");
  assert(!source.includes("brook-pharmacy") && !source.includes("synthetic-demo"), "canonical results path references demo data");
  cleanup();
  fs.writeFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`), JSON.stringify({
    version: 1,
    slug: FIXTURE,
    campaigns: [{
      id: CAMPAIGN,
      serviceId: SERVICE,
      status: "active",
      publishingStatus: "pending",
      publishedPages: 0,
      campaignAreas: AREAS.map((areaSlug, index) => ({ areaName: areaSlug, areaSlug, selected: true, priority: index + 1 })),
    }],
  }, null, 2));
  writePage("service", "<html><title>Service A</title><p>Service alpha search.</p></html>");
  writePage("locality", "<html><title>North A</title><p>North alpha search unique.</p></html>", "north-ward");
  writePage("locality", "<html><title>South A</title><p>South alpha search different.</p></html>", "south-ward");
  const loose = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", FIXTURE, SERVICE, "local", "unattached-ward", "index.html");
  fs.mkdirSync(path.dirname(loose), { recursive: true });
  fs.writeFileSync(loose, "<html><p>Unattached page.</p></html>");

  try {
    approve("service");
    approve("locality", "north-ward");
    approve("locality", "south-ward");
    const published = publishCanonicalCampaign({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(published.ok && published.publication?.current?.pages.length === 3, "fixture did not publish");
    const identity = resolveCanonicalSearchIdentity({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(identity.classification === "CANONICAL" && identity.pages.length === 3, "search identity count");
    assert(!identity.pages.some((page) => page.canonicalUrl.includes("unattached")), "unattached page entered search identity");

    const disconnected = await submitCanonicalCampaignSearch({ tenantSlug: FIXTURE, campaignId: CAMPAIGN, provider: { submitSitemap: async () => ({ ok: true }) } });
    assert(disconnected.ok === false && disconnected.submittedUrls.length === 0, "disconnected tenant submitted");
    const disconnectedResults = resolveCanonicalCampaignResults({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(disconnectedResults.pages.length === 3, "results failed without Search Console");
    assert(disconnectedResults.pages.every((page) => page.searchConsole.connectionStatus === "NOT_CONNECTED"), "missing connection was not reported");
    assert(disconnectedResults.totalImpressions === null && disconnectedResults.totalClicks === null, "missing Search Console became zero");
    assert(disconnectedResults.indexedPageCount === 0, "disconnected pages were marked indexed");

    connect();
    const urls = identity.pages.map((page) => page.canonicalUrl);
    const submitted = await submitCanonicalCampaignSearch({
      tenantSlug: FIXTURE,
      campaignId: CAMPAIGN,
      provider: { submitSitemap: async (request) => ({ ok: request.urls.length === 3 }) },
    });
    assert(submitted.ok && submitted.submittedUrls.length === 3, "submission did not accept the published URLs");
    let results = resolveCanonicalCampaignResults({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(results.pages.every((page) => page.submissionStatus === "SUBMITTED" && page.identity.campaignId === CAMPAIGN && page.identity.contentRevision), "submission identity missing");
    assert(results.indexedPageCount === 0 && results.pages.every((page) => page.indexingStatus !== "INDEXED"), "submission marked pages indexed");

    const unchecked = await checkCanonicalCampaignIndexing({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(unchecked.ok === false, "indexing check ran without a provider");
    await checkCanonicalCampaignIndexing({
      tenantSlug: FIXTURE,
      campaignId: CAMPAIGN,
      provider: { inspect: async (page) => ({ status: "INDEXED", indexedAt: "2026-09-27T00:00:00.000Z", evidenceRef: page.contentRevision }) },
    });
    await fetchCanonicalSearchConsolePerformance({
      tenantSlug: FIXTURE,
      campaignId: CAMPAIGN,
      provider: { fetchRows: async () => ({ ok: true, rows: [
        { canonicalUrl: urls[0], impressions: 10, clicks: 2, averagePosition: 4, measurementStart: "2026-09-01", measurementEnd: "2026-09-27" },
        { canonicalUrl: urls[1], impressions: 20, clicks: 3, averagePosition: 8, measurementStart: "2026-09-01", measurementEnd: "2026-09-27" },
        { canonicalUrl: urls[2], impressions: 5, clicks: 1, averagePosition: 6, measurementStart: "2026-09-01", measurementEnd: "2026-09-27" },
        { canonicalUrl: "https://example.invalid/unattached/", impressions: 999, clicks: 999, averagePosition: 1 },
      ] }) },
    });
    await recordCanonicalRankObservations({
      tenantSlug: FIXTURE,
      campaignId: CAMPAIGN,
      provider: { observe: async () => ({ ok: true, observations: [
        ...urls.map((canonicalUrl) => ({ canonicalUrl, query: "blood pressure", position: 7, checkedAt: "2026-09-27T01:00:00.000Z", provider: "fixture-rank", location: "Derby", device: "mobile" })),
        { canonicalUrl: "https://example.invalid/unattached/", query: "other", position: 1, checkedAt: "2026-09-27T01:00:00.000Z", provider: "fixture-rank" },
      ] }) },
    });
    results = resolveCanonicalCampaignResults({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(results.synthetic === false && results.pages.length === 3, "results page count");
    assert(results.totalImpressions === 35 && results.totalClicks === 6, `totals ${results.totalImpressions}/${results.totalClicks}`);
    assert(results.trackedKeywords === 3, "rank observations were not limited to canonical URLs");
    assert(results.pages.every((page) => page.searchConsole.attribution === CANONICAL_SEARCH_GSC_ATTRIBUTION && page.measurementRevisionMatch === false), "GSC was treated as revision-specific");
    assert(!JSON.stringify(results).includes("999"), "unattached Search Console row was copied");

    const southA = results.pages.find((page) => page.identity.areaSlug === "south-ward");
    writePage("locality", "<html><title>South B</title><p>South beta search replacement.</p></html>", "south-ward");
    approve("locality", "south-ward");
    const republished = publishCanonicalCampaign({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(republished.ok, "revision B did not publish");
    const next = resolveCanonicalCampaignResults({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    const southB = next.pages.find((page) => page.identity.areaSlug === "south-ward");
    assert(southB && southA && southB.identity.contentRevision !== southA.identity.contentRevision, "current revision did not become B");
    assert(southB.submissionStatus === "NOT_SUBMITTED" && southB.indexingStatus === "NOT_CHECKED" && southB.rankObservations.length === 0, "revision B inherited revision-specific state");
    assert(southB.searchConsole.impressions === null, "revision B received fabricated performance");
    assert(southB.urlLevelSearchConsole?.attribution === CANONICAL_SEARCH_GSC_ATTRIBUTION, "URL-level Search Console was not labelled");
    assert(southB.historyCount === 1, "revision A was not retained");
    assert(next.pages.find((page) => page.identity.pageType === "service")?.submissionStatus === "SUBMITTED", "unchanged page lost its submission");

    const publicationBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-publication", FIXTURE, `${CAMPAIGN}.json`));
    const failedSubmit = await submitCanonicalCampaignSearch({ tenantSlug: FIXTURE, campaignId: CAMPAIGN, provider: { submitSitemap: async () => { throw new Error("sitemap provider down"); } } });
    assert(failedSubmit.ok === false, "provider failure reported success");
    const afterFailure = resolveCanonicalCampaignResults({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(afterFailure.pages.find((page) => page.identity.pageType === "service")?.submissionStatus === "SUBMITTED", "provider failure cleared a successful submission");
    assert(afterFailure.indexedPageCount === 2, "provider failure invented or cleared indexing");
    assert(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-publication", FIXTURE, `${CAMPAIGN}.json`)).equals(publicationBefore), "provider failure changed publication");
    assert(!fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-search", OTHER)), "provider failure wrote another tenant");
    const failedIndex = await checkCanonicalCampaignIndexing({ tenantSlug: FIXTURE, campaignId: CAMPAIGN, provider: { inspect: async () => { throw new Error("inspection down"); } } });
    assert(failedIndex.ok === false, "indexing failure reported success");
    const failedGsc = await fetchCanonicalSearchConsolePerformance({ tenantSlug: FIXTURE, campaignId: CAMPAIGN, provider: { fetchRows: async () => { throw new Error("gsc down"); } } });
    assert(failedGsc.ok === false, "Search Console failure reported success");
    const preserved = resolveCanonicalCampaignResults({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(preserved.pages.find((page) => page.identity.pageType === "service")?.searchConsole.impressions === 10, "Search Console failure zeroed impressions");
    assert(preserved.pages.find((page) => page.identity.pageType === "service")?.indexingStatus === "INDEXED", "indexing failure cleared INDEXED");
  } finally {
    cleanup();
  }

  for (const slug of HISTORICAL) {
    const results = resolveCanonicalCampaignResults({ tenantSlug: slug, campaignId: CAMPAIGNS[slug] });
    assert(results.classification !== "CANONICAL" && results.pages.length === 0 && results.synthetic === false, `${slug} was treated as a canonical results campaign`);
  }
  assert(classifyExistingPublishIndex("banner-cross-pharmacy").classification === "HISTORICAL_UNSCOPED", "banner index classification changed");
  assert(classifyExistingPublishIndex("brook-pharmacy-demo-derby").classification === "ABSENT", "brook gained a publish index");
  assert(classifyLegacyRankFile("brook-pharmacy-demo-derby") !== "CANONICAL", "brook rank file was reclassified as canonical");
  const after = Object.fromEntries(HISTORICAL.map((slug) => [slug, hashTree(slug)]));
  const writeProtection = HISTORICAL.map((slug) => ({ slug, before: before[slug], after: after[slug], unchanged: before[slug] === after[slug] }));
  for (const row of writeProtection) assert(row.unchanged, `${row.slug} operational state changed`);
  console.log(JSON.stringify({ writeProtection }, null, 2));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("PASS cp05 search results, 0 failures");
}

run();
