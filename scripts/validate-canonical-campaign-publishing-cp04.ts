#!/usr/bin/env npx tsx
/**
 * CP04 canonical publication.
 * Fixture writes stay on an isolated tenant. Historical pharmacies are not published.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { recordCanonicalCampaignPageDecision } from "../src/pharmacy/canonicalCampaignApprovalService.ts";
import { resolveCanonicalPageContentRevision } from "../src/pharmacy/canonicalCampaignContentRevision.ts";
import {
  classifyExistingPublishIndex,
  publicationRecordPath,
  publishCanonicalCampaign,
  publishIndexPath,
  sitemapPath,
} from "../src/pharmacy/canonicalCampaignPublishingService.ts";
import { resolveProductOwnerCampaignContentPresentation } from "../src/pharmacy/masterAdminProductOwnerCampaignContentPresentation.ts";
import { resolveCampaignPublishingContentApproval } from "../src/pharmacy/masterAdminCampaignPublishingApprovalResolver.ts";

const FIXTURE = "cp04-publishing-fixture-tenant";
const CAMPAIGN = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const SERVICE = "blood-pressure-checks";
const AREAS = ["north-ward", "south-ward"] as const;
const HISTORICAL = [
  "brook-pharmacy-demo-derby",
  "yorkshire-pharmacy-and-health-clinic",
  "leeds-pharmacy",
  "vision-pharmacy",
  "banner-cross-pharmacy",
] as const;

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
    `data/growth-engine/${slug}-campaign-builder.json`,
    `output/pharmacy-content-ecosystem/${slug}`,
    `output/pharmacy-visual-experience/${slug}`,
    `output/pharmacy-publish/${slug}`,
    `data/pharmacy-indexing/${slug}.json`,
    `data/pharmacy-visibility/${slug}.json`,
    `data/pharmacy-search-console-authority/${slug}.json`,
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
    reviewer: "cp04-fixture",
  });
}

function cleanup(): void {
  for (const target of [
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${FIXTURE}.json`),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-approval", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-publication", FIXTURE),
  ]) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function run(): void {
  const before = Object.fromEntries(HISTORICAL.map((slug) => [slug, hashTree(slug)]));
  const route = fs.readFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/api-server/src/routes/api/masterAdminPlatform.ts"),
    "utf8",
  );
  const page = fs.readFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"),
    "utf8",
  );
  assert(route.includes("/canonical-publish") && route.includes("publishCanonicalCampaign"), "publish API is not connected");
  assert(page.includes("/canonical-publish"), "publish button is not connected");

  cleanup();
  fs.writeFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`),
    JSON.stringify({
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
    }, null, 2),
  );
  writePage("service", "<html><title>Service A</title><p>Service alpha.</p></html>");
  writePage("locality", "<html><title>North A</title><p>North alpha unique.</p></html>", "north-ward");
  writePage("locality", "<html><title>South A</title><p>South alpha different.</p></html>", "south-ward");

  try {
    const blocked = publishCanonicalCampaign({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(blocked.ok === false, "unpublished campaign passed preflight");
    assert(!fs.existsSync(publishIndexPath(FIXTURE)), "blocked publish wrote an index");

    approve("service");
    approve("locality", "north-ward");
    approve("locality", "south-ward");
    const ready = resolveProductOwnerCampaignContentPresentation({ slug: FIXTURE, campaignId: CAMPAIGN, serviceId: SERVICE });
    assert(ready.publishing.label === "Ready to Publish", `ui state ${ready.publishing.label}`);
    const published = publishCanonicalCampaign({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(published.ok && published.publication?.current?.pages.length === 3, "campaign did not publish 3 pages");
    const index = JSON.parse(fs.readFileSync(publishIndexPath(FIXTURE), "utf8")) as { version: number; pages: Array<Record<string, string>> };
    assert(index.version === 2 && index.pages.length === 3, "publish index page count");
    for (const entry of index.pages) {
      assert(entry.tenantSlug === FIXTURE && entry.campaignId === CAMPAIGN && entry.serviceId === SERVICE, "index identity");
      assert(entry.contentRevision && entry.deployedArtifactHash === entry.contentRevision, "deployed hash diverged");
      assert(entry.canonicalUrl.startsWith("https://"), "canonical url missing");
      assert(entry.publishedAt, "publishedAt missing");
      if (entry.pageType === "locality") assert(Boolean(entry.areaSlug), "locality area missing");
    }
    const sitemap = fs.readFileSync(sitemapPath(FIXTURE), "utf8");
    const locs = sitemap.match(/<loc>/g) || [];
    assert(locs.length === 3, `sitemap urls ${locs.length}`);
    const campaign = JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`), "utf8")) as {
      campaigns: Array<{ publishingStatus?: string; publishedPages?: number }>;
    };
    assert(campaign.campaigns[0]?.publishingStatus === "published" && campaign.campaigns[0]?.publishedPages === 3, "campaign status");
    const afterPublish = resolveProductOwnerCampaignContentPresentation({ slug: FIXTURE, campaignId: CAMPAIGN, serviceId: SERVICE });
    assert(afterPublish.publishing.label === "Published", `after publish ${afterPublish.publishing.label}`);
    assert(afterPublish.serviceApproved && afterPublish.localityApprovedCount === 2, "approval changed during publish");

    const southA = resolveCanonicalPageContentRevision({ tenantSlug: FIXTURE, serviceId: SERVICE, pageType: "locality", areaSlug: "south-ward" }).contentRevision;
    writePage("locality", "<html><title>South B</title><p>South beta replaced the published copy.</p></html>", "south-ward");
    const stalePublish = publishCanonicalCampaign({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(stalePublish.ok === false, "stale revision published");
    const stillA = JSON.parse(fs.readFileSync(publishIndexPath(FIXTURE), "utf8")) as { pages: Array<{ areaSlug?: string; contentRevision: string }> };
    assert(stillA.pages.find((page) => page.areaSlug === "south-ward")?.contentRevision === southA, "live revision changed before approval");
    const staleUi = resolveProductOwnerCampaignContentPresentation({ slug: FIXTURE, campaignId: CAMPAIGN, serviceId: SERVICE });
    assert(staleUi.publishing.label === "New revision requires approval", `stale ui ${staleUi.publishing.label}`);
    assert(resolveCampaignPublishingContentApproval(FIXTURE, { campaignId: CAMPAIGN, serviceId: SERVICE }).approved === false, "readiness stayed ready");

    approve("locality", "south-ward");
    const indexBefore = fs.readFileSync(publishIndexPath(FIXTURE));
    const recordBefore = fs.readFileSync(publicationRecordPath(FIXTURE, CAMPAIGN));
    const campaignBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`));
    const failed = publishCanonicalCampaign({ tenantSlug: FIXTURE, campaignId: CAMPAIGN, failBeforeCommit: true });
    assert(failed.ok === false, "forced failure reported success");
    assert(fs.readFileSync(publishIndexPath(FIXTURE)).equals(indexBefore), "failed publish changed the index");
    assert(fs.readFileSync(publicationRecordPath(FIXTURE, CAMPAIGN)).equals(recordBefore), "failed publish changed history");
    assert(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`)).equals(campaignBefore), "failed publish changed campaign status");
    const republished = publishCanonicalCampaign({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(republished.ok && republished.idempotent === false, "republish failed");
    const next = JSON.parse(fs.readFileSync(publishIndexPath(FIXTURE), "utf8")) as { pages: Array<{ areaSlug?: string; contentRevision: string }> };
    const southB = next.pages.find((page) => page.areaSlug === "south-ward")?.contentRevision;
    assert(southB && southB !== southA, "index did not move to revision B");
    const history = JSON.parse(fs.readFileSync(publicationRecordPath(FIXTURE, CAMPAIGN), "utf8")) as {
      current: { pages: unknown[] };
      history: Array<{ pages: Array<{ contentRevision: string; areaSlug: string | null }> }>;
    };
    assert(history.history.length === 1, "revision A was not retained");
    assert(history.history[0]?.pages.some((page) => page.contentRevision === southA), "history lost revision A");
    assert((fs.readFileSync(sitemapPath(FIXTURE), "utf8").match(/<loc>/g) || []).length === 3, "sitemap url count changed");
    const campaignAgain = JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`), "utf8")) as {
      campaigns: Array<{ publishedPages?: number; publishingStatus?: string }>;
    };
    assert(campaignAgain.campaigns[0]?.publishedPages === 3 && campaignAgain.campaigns[0]?.publishingStatus === "published", "status after republish");

    const beforeIdempotent = fs.readFileSync(publishIndexPath(FIXTURE));
    const again = publishCanonicalCampaign({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(again.ok && again.idempotent, "republishing the same revision was not idempotent");
    assert(fs.readFileSync(publishIndexPath(FIXTURE)).equals(beforeIdempotent), "idempotent publish rewrote the index");
    assert(JSON.parse(fs.readFileSync(publicationRecordPath(FIXTURE, CAMPAIGN), "utf8")).history.length === 1, "idempotent publish duplicated history");
  } finally {
    cleanup();
  }

  const banner = classifyExistingPublishIndex("banner-cross-pharmacy");
  assert(banner.classification === "HISTORICAL_UNSCOPED", `banner index ${banner.classification}`);
  const brook = classifyExistingPublishIndex("brook-pharmacy-demo-derby");
  assert(brook.classification === "ABSENT", `brook index ${brook.classification}`);
  const after = Object.fromEntries(HISTORICAL.map((slug) => [slug, hashTree(slug)]));
  const writeProtection = HISTORICAL.map((slug) => ({ slug, before: before[slug], after: after[slug], unchanged: before[slug] === after[slug] }));
  for (const row of writeProtection) assert(row.unchanged, `${row.slug} operational state changed`);
  console.log(JSON.stringify({ banner, brook, writeProtection }, null, 2));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("PASS cp04 publishing, 0 failures");
}

run();
